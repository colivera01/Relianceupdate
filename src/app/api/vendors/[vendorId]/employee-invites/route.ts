import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";
import { sendEmployeeInviteNotification } from "@/lib/notifications/send-employee-invite";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

function hasNotificationConfig() {
  const hasEmail = Boolean(process.env.EMAIL_ENABLED !== "false" && process.env.RESEND_API_KEY);
  const hasSms = Boolean(
    process.env.SMS_ENABLED !== "false" &&
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
  );
  return hasEmail || hasSms;
}

function smsEnvState() {
  return {
    smsEnabled: process.env.SMS_ENABLED !== "false",
    hasTwilioAccountSid: Boolean(process.env.TWILIO_ACCOUNT_SID),
    hasTwilioAuthToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
    hasTwilioPhoneNumber: Boolean(process.env.TWILIO_PHONE_NUMBER),
  };
}

function allowSelfEmployeeInviteTestMode() {
  if (process.env.NODE_ENV === "production") return false;
  const serverFlag = String(process.env.ALLOW_SELF_EMPLOYEE_INVITE_TEST || "").trim().toLowerCase();
  const publicFlag = String(process.env.NEXT_PUBLIC_ALLOW_SELF_EMPLOYEE_INVITE_TEST || "").trim().toLowerCase();
  return serverFlag === "true" || publicFlag === "true";
}

function getRequestOrigin(request: Request): string | null {
  const origin = String(request.headers.get("origin") || "").trim();
  return origin || null;
}

function isLocalhostOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return /^http:\/\/localhost(?::\d+)?$/i.test(origin.trim());
}

function resolveInviteBaseUrl(request: Request, requestedOrigin?: string | null): string {
  const appBaseUrl = String(process.env.APP_BASE_URL || "").trim();
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    return appBaseUrl;
  }

  const bodyOrigin = String(requestedOrigin || "").trim();
  if (isLocalhostOrigin(bodyOrigin)) return bodyOrigin;
  if (appBaseUrl) return appBaseUrl;
  const headerOrigin = getRequestOrigin(request);
  if (headerOrigin) return headerOrigin;
  return "http://localhost:3000";
}

export async function GET(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId } = await context.params;
    await requireVendorManager(request, vendorId);
    const inviteBaseUrl = resolveInviteBaseUrl(request);

    const [invites, pendingMemberships] = await Promise.all([
      (prisma as any).vendorInvite.findMany({
        where: { vendorId, isActive: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      (prisma as any).vendorMembership.findMany({
        where: { vendorId, status: { in: ["PENDING", "pending"] } },
        include: {
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { requestedAt: "desc" },
        take: 50,
      }),
    ]);

    const unusedPendingMemberships = [...pendingMemberships];

    return NextResponse.json({
      invites: invites.map((invite: any) => {
        const inviteCreatedAt = invite.createdAt ? new Date(invite.createdAt).getTime() : 0;
        const matchedMembershipIndex = unusedPendingMemberships.findIndex((membership: any) => {
          const requestedAt = membership?.requestedAt ? new Date(membership.requestedAt).getTime() : 0;
          if (!inviteCreatedAt || !requestedAt) return false;
          return Math.abs(inviteCreatedAt - requestedAt) <= 1000 * 60 * 10;
        });
        const matchedMembership =
          matchedMembershipIndex >= 0
            ? unusedPendingMemberships.splice(matchedMembershipIndex, 1)[0]
            : null;

        return {
          id: invite.id,
          code: invite.code,
          token: invite.token,
          status: "invited",
          isActive: Boolean(invite.isActive),
          sentAt: invite.createdAt,
          expiresAt: invite.expiresAt,
          usesCount: invite.usesCount,
          canCancel: Boolean(invite.isActive),
          inviteUrl: `${inviteBaseUrl}/vendor/invite/${invite.token}`,
          recipient: matchedMembership
            ? {
                name: matchedMembership.user?.name || null,
                email: matchedMembership.user?.email || null,
                phone: matchedMembership.user?.phone || null,
                role: matchedMembership.role || null,
              }
            : null,
        };
      }),
      notificationsConfigured: hasNotificationConfig(),
      allowSelfEmployeeInviteTestMode: allowSelfEmployeeInviteTestMode(),
    });
  } catch (error: any) {
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to fetch employee invites" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  let step = "init";
  let debug: Record<string, unknown> = {};
  try {
    step = "resolve_vendor_and_manager";
    const { vendorId } = await context.params;
    const { userId } = await requireVendorManager(request, vendorId);
    debug = { ...debug, vendorId, managerUserId: userId };
    step = "parse_body";
    const body = await request.json().catch(() => ({}));

    const name = String(body?.name || "").trim();
    const emailRaw = String(body?.email || "").trim();
    const email = emailRaw.toLowerCase();
    const phone = String(body?.phone || "").trim();
    const role = String(body?.role || "EMPLOYEE").trim().toUpperCase() || "EMPLOYEE";
    const isDev = process.env.NODE_ENV !== "production";
    const allowSelf = body?.allowSelfInvite === true;
    const origin = String(body?.origin || "").trim();
    debug = { ...debug, inviteeName: name, inviteeEmail: email, inviteePhone: phone, role };

    if (!name || (!email && !phone)) {
      return NextResponse.json(
        { error: "name and at least one contact (email or phone) are required" },
        { status: 422 }
      );
    }

    step = "lookup_or_create_user";
    let inviteeUser = null as any;
    if (email) {
      inviteeUser = await (prisma as any).user.findUnique({
        where: { email },
      });
    }
    if (!inviteeUser && phone) {
      inviteeUser = await (prisma as any).user.findUnique({
        where: { phone },
      });
    }

    if (!inviteeUser) {
      const fallbackEmail = `invite+${Date.now()}-${crypto.randomBytes(4).toString("hex")}@reliance.local`;
      const phoneOwner = phone
        ? await (prisma as any).user.findUnique({
            where: { phone },
            select: { id: true },
          })
        : null;
      inviteeUser = await (prisma as any).user.create({
        data: {
          name,
          email: email || fallbackEmail,
          phone: phoneOwner ? null : phone || null,
        },
      });
    } else {
      const currentPhone = String(inviteeUser.phone || "").trim();
      const currentName = String(inviteeUser.name || "").trim();
      const shouldUpdatePhone = Boolean(phone && currentPhone !== phone);
      const shouldUpdateName = Boolean(name && currentName !== name);
      if (shouldUpdatePhone || shouldUpdateName) {
        inviteeUser = await (prisma as any).user.update({
          where: { id: inviteeUser.id },
          data: {
            ...(shouldUpdateName ? { name } : {}),
            ...(shouldUpdatePhone ? { phone } : {}),
          },
        });
      }
    }

    step = "upsert_membership";
    step = "upsert_membership";
    const existingMembership = await (prisma as any).vendorMembership.findUnique({
      where: {
        vendorId_userId: {
          vendorId,
          userId: inviteeUser.id,
        },
      },
      select: { id: true, role: true, status: true },
    });
    const existingRole = String(existingMembership?.role || "").trim().toUpperCase();
    const existingStatus = String(existingMembership?.status || "").trim().toUpperCase();
    const selfInviteByManagerContact =
      existingMembership &&
      existingRole === "MANAGER" &&
      existingStatus === "ACTIVE" &&
      String(inviteeUser?.id || "") === String(userId);
    const allowSelfInvite = isDev && allowSelf && selfInviteByManagerContact;

    if (existingMembership && existingRole === "MANAGER" && existingStatus === "ACTIVE" && !allowSelfInvite) {
      return NextResponse.json(
        {
          error:
            "This person is already an active manager for this vendor. Use a different employee email/phone, or enable dev test mode locally.",
          code: "ALREADY_ACTIVE_MANAGER",
        },
        { status: 409 }
      );
    }

    let membershipUserId = String(inviteeUser.id);
    let inviteTestMode = false;
    if (allowSelfInvite) {
      step = "create_dev_test_identity";
      inviteTestMode = true;
      const aliasStamp = Date.now();
      const aliasEmail = `test+${aliasStamp}_${email || "employee@reliance.local"}`;
      const aliasPhone = phone ? `test_${phone}` : null;
      const devUser = await (prisma as any).user.create({
        data: {
          name: `${name || inviteeUser.name || "Employee"} (Test)`,
          email: aliasEmail,
          phone: aliasPhone,
        },
      });
      membershipUserId = String(devUser.id);
    }

    if (existingMembership && !inviteTestMode) {
      await (prisma as any).vendorMembership.update({
        where: { id: existingMembership.id },
        data: {
          role: role === "MANAGER" ? "MANAGER" : "EMPLOYEE",
          // Preserve ACTIVE status if already active.
          status: existingStatus === "ACTIVE" ? "ACTIVE" : "PENDING",
        },
      });
    } else {
      await (prisma as any).vendorMembership.create({
        data: {
          vendorId,
          userId: membershipUserId,
          role: role === "MANAGER" ? "MANAGER" : "EMPLOYEE",
          status: "PENDING",
        },
      });
    }

    step = "create_invite_record";
    const code = crypto.randomBytes(3).toString("hex").toUpperCase();
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const invite = await (prisma as any).vendorInvite.create({
      data: {
        vendorId,
        code,
        token,
        createdByUserId: userId,
        expiresAt,
        maxUses: 1,
        usesCount: 0,
        isActive: true,
      },
    });

    const inviteBaseUrl = resolveInviteBaseUrl(request, origin);
    const inviteUrl = `${inviteBaseUrl}/vendor/invite/${invite.token}`;
    step = "send_notification";
    let notification: Awaited<ReturnType<typeof sendEmployeeInviteNotification>> | null = null;
    let notificationError: string | null = null;
    try {
      const vendor = await (prisma as any).vendor.findUnique({
        where: { id: vendorId },
        select: { businessName: true, name: true },
      });
      notification = await sendEmployeeInviteNotification({
        inviteId: invite.id,
        actorUserId: String(userId),
        inviteLink: inviteUrl,
        vendorName: String(vendor?.businessName || vendor?.name || "Reliance Vendor"),
        inviteeName: name,
        inviteeEmail: email || null,
        inviteePhone: phone || null,
      });
    } catch (err: any) {
      notificationError = err?.message || String(err);
    }

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        token: invite.token,
        code: invite.code,
        status: "invited",
        sentAt: invite.createdAt,
        expiresAt: invite.expiresAt,
        inviteUrl,
        recipient: {
          name,
          email: email || null,
          phone: phone || null,
          role: role === "MANAGER" ? "MANAGER" : "EMPLOYEE",
        },
      },
      notificationsConfigured: hasNotificationConfig(),
      allowSelfEmployeeInviteTestMode: allowSelfEmployeeInviteTestMode(),
      inviteTestMode,
      notification,
      smsDelivery: (() => {
        const sms = notification?.channels?.find((c) => c.channel === "sms");
        return {
          env: smsEnvState(),
          phoneNumberUsed: notification?.phoneNumberUsed ?? null,
          attempted: Boolean(sms?.attempted),
          success: Boolean(sms?.success),
          errorCode: sms?.errorCode ?? null,
          errorMessage: sms?.errorMessage ?? null,
          trialRestriction: Boolean(sms?.trialRestriction),
        };
      })(),
      notificationError,
      manualLinkRequired: !notification?.anySuccess,
      delivery: hasNotificationConfig()
        ? notification?.anySuccess
          ? "Invite notification sent via configured channel(s)."
          : "Notification send not confirmed; share manual invite link."
        : "Notifications not configured. Use manual invite link for testing.",
    });
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const errorCode = error?.code || null;
    const errorMeta = error?.meta || null;
    console.error("[employee-invites][POST] error", {
      step,
      ...debug,
      error: errorMessage,
      code: errorCode,
      meta: errorMeta,
    });
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (String(errorCode).toUpperCase() === "P2002") {
      return NextResponse.json(
        {
          error: "That email or phone number is already used by another Reliance account.",
          code: "CONTACT_ALREADY_USED",
        },
        { status: 409 }
      );
    }
    const nonProd = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        error: "Failed to create employee invite",
        message: errorMessage,
        code: errorCode,
        ...(nonProd
          ? {
              step,
              meta: errorMeta,
              details: {
                ...debug,
                step,
                prismaCode: errorCode,
                prismaMeta: errorMeta,
                prismaMessage: errorMessage,
              },
            }
          : {}),
      },
      { status: 500 }
    );
  }
}
