import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import { sendTeamInviteAcceptedNotification } from "@/lib/notifications/send-team-invite-accepted";

interface RouteParams {
  params: Promise<{ token: string }>;
}

function allowSelfEmployeeInviteTestMode() {
  if (process.env.NODE_ENV === "production") return false;
  const serverFlag = String(process.env.ALLOW_SELF_EMPLOYEE_INVITE_TEST || "").trim().toLowerCase();
  const publicFlag = String(process.env.NEXT_PUBLIC_ALLOW_SELF_EMPLOYEE_INVITE_TEST || "").trim().toLowerCase();
  return serverFlag === "true" || publicFlag === "true";
}

type InviteLookupDiagnostics = {
  tokenReceived: string;
  inviteFound: boolean;
  inviteId: string | null;
  isActive: boolean | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  status: string;
  vendorId: string | null;
};

type VendorInviteLookup = {
  id: string;
  vendorId: string;
  token: string;
  code: string | null;
  expiresAt: Date | string | null;
  maxUses: number | null;
  usesCount: number;
  isActive: boolean;
};

type InviteVendorLookup = {
  id: string;
  name: string | null;
  businessName: string | null;
  email: string | null;
  phone: string | null;
};

type InviteWithVendorLookup = {
  invite: VendorInviteLookup | null;
  vendor: InviteVendorLookup | null;
};

async function withTimeout<T>(promise: Promise<T>, label: string, ms = 7000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout:${label}:${ms}ms`)), ms)
    ),
  ]);
}

function requestBaseUrl(request: Request): string | null {
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

async function getInviteWithVendor(token: string): Promise<InviteWithVendorLookup> {
  const invite = await withTimeout<VendorInviteLookup | null>(
    (prisma as any).vendorInvite.findFirst({
      where: { token },
      select: {
        id: true,
        vendorId: true,
        token: true,
        code: true,
        expiresAt: true,
        maxUses: true,
        usesCount: true,
        isActive: true,
      },
    }),
    "vendorInvite.findFirst"
  );
  if (!invite) return { invite: null, vendor: null };
  const vendor = await withTimeout<InviteVendorLookup | null>(
    (prisma as any).vendor.findUnique({
      where: { id: invite.vendorId },
      select: { id: true, name: true, businessName: true, email: true, phone: true },
    }),
    "vendor.findUnique"
  );
  return { invite, vendor };
}

function classifyInvite(invite: VendorInviteLookup | null): string {
  if (!invite) return "NOT_FOUND";
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return "EXPIRED";
  if (!invite.isActive && invite.maxUses && invite.usesCount >= invite.maxUses) return "ALREADY_ACCEPTED";
  if (!invite.isActive) return "CANCELLED_OR_INACTIVE";
  if (invite.maxUses && invite.usesCount >= invite.maxUses) return "ALREADY_ACCEPTED";
  return "ACTIVE";
}

function diagnosticsFor(token: string, invite: VendorInviteLookup | null): InviteLookupDiagnostics {
  const status = classifyInvite(invite);
  return {
    tokenReceived: token,
    inviteFound: Boolean(invite),
    inviteId: invite?.id ?? null,
    isActive: invite ? Boolean(invite.isActive) : null,
    expiresAt: invite?.expiresAt ? new Date(invite.expiresAt).toISOString() : null,
    acceptedAt: status === "ALREADY_ACCEPTED" ? new Date().toISOString() : null,
    status,
    vendorId: invite?.vendorId ?? null,
  };
}

export async function GET(_request: Request, context: RouteParams): Promise<NextResponse> {
  const nonProd = process.env.NODE_ENV !== "production";
  const { token } = await context.params;
  const tokenReceived = String(token || "").trim();
  try {
    const { invite, vendor } = await getInviteWithVendor(tokenReceived);
    const diagnostics = diagnosticsFor(tokenReceived, invite);
    const status = diagnostics.status;
    if (status !== "ACTIVE" || !invite || !vendor) {
      const isAlreadyAccepted = status === "ALREADY_ACCEPTED";
      const isCancelled = status === "CANCELLED_OR_INACTIVE";
      return NextResponse.json(
        {
          success: false,
          code: status,
          error: isAlreadyAccepted
            ? "Invite has already been accepted."
            : isCancelled
              ? "Invite is inactive or cancelled."
              : "Invite is invalid or expired.",
          ...(nonProd ? { diagnostics } : {}),
        },
        { status: isAlreadyAccepted || isCancelled ? 409 : 404 }
      );
    }

    return NextResponse.json({
      success: true,
      invite: {
        token: invite.token,
        code: invite.code,
        expiresAt: invite.expiresAt,
        vendor: {
          id: vendor.id,
          name: vendor.businessName || vendor.name,
        },
      },
      ...(nonProd ? { diagnostics } : {}),
    });
  } catch (error: any) {
    const diagnostics = {
      tokenReceived,
      inviteFound: false,
      isActive: null,
      expiresAt: null,
      acceptedAt: null,
      status: "LOOKUP_ERROR",
      vendorId: null,
      prismaCode: error?.code ?? null,
      prismaMeta: error?.meta ?? null,
      prismaMessage: error?.message ?? String(error),
    };
    return NextResponse.json(
      {
        success: false,
        code: "INVITE_LOOKUP_FAILED",
        error: "Failed to load invite.",
        ...(nonProd ? { diagnostics } : {}),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  let step = "init";
  const debug: Record<string, unknown> = {};
  try {
    step = "resolve_token_param";
    const { token } = await context.params;
    const tokenReceived = String(token || "").trim();
    debug.token = tokenReceived;

    step = "token_lookup";
    const lookup = await getInviteWithVendor(tokenReceived);
    const invite = lookup.invite;
    const diagnostics = diagnosticsFor(tokenReceived, invite);
    debug.invite = diagnostics;
    if (!invite || diagnostics.status === "EXPIRED" || diagnostics.status === "NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          error: "Invite is invalid or expired",
          code: diagnostics.status || "INVALID_INVITE",
          ...(process.env.NODE_ENV !== "production" ? { step, details: { ...debug } } : {}),
        },
        { status: 404 }
      );
    }
    if (diagnostics.status === "ALREADY_ACCEPTED" || diagnostics.status === "CANCELLED_OR_INACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: "Invite has already been used",
          code: diagnostics.status,
          ...(process.env.NODE_ENV !== "production" ? { step, details: { ...debug } } : {}),
        },
        { status: 409 }
      );
    }
    if (invite.maxUses && invite.usesCount >= invite.maxUses) {
      return NextResponse.json(
        {
          success: false,
          error: "Invite has already been used",
          code: "MAX_USES_REACHED",
          ...(process.env.NODE_ENV !== "production" ? { step, details: { ...debug } } : {}),
        },
        { status: 409 }
      );
    }

    step = "parse_accept_body";
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const phone = String(body?.phone || "").trim();

    if (!name || (!email && !phone)) {
      return NextResponse.json(
        {
          success: false,
          error: "name and at least one contact (email or phone) are required",
          code: "INVALID_ACCEPT_PAYLOAD",
          ...(process.env.NODE_ENV !== "production" ? { step, details: { ...debug } } : {}),
        },
        { status: 422 }
      );
    }

    step = "existing_user_lookup";
    let user = email
      ? await (prisma as any).user.findUnique({
          where: { email },
        })
      : null;
    if (!user && phone) {
      user = await (prisma as any).user.findUnique({
        where: { phone },
      });
    }

    if (!user) {
      step = "user_create";
      const phoneOwner = phone
        ? await (prisma as any).user.findUnique({
            where: { phone },
            select: { id: true },
          })
        : null;
      user = await (prisma as any).user.create({
        data: {
          name,
          email: email || null,
          phone: phoneOwner ? null : phone || null,
        },
      });
    } else {
      step = "user_update";
      const phoneOwner = phone
        ? await (prisma as any).user.findUnique({
            where: { phone },
            select: { id: true },
          })
        : null;
      user = await (prisma as any).user.update({
        where: { id: user.id },
        data: {
          // On accept, prefer submitted invite identity so roster shows the actual employee.
          name: name || user.name,
          email: email || user.email || null,
          phone: phone && (!phoneOwner || phoneOwner.id === user.id) ? phone : user.phone || null,
        },
      });
    }
    debug.userId = user?.id ?? null;

    step = "membership_lookup_for_matched_user";
    const membershipForMatchedUser = user
      ? await (prisma as any).vendorMembership.findUnique({
          where: {
            vendorId_userId: {
              vendorId: String(invite.vendorId),
              userId: user.id,
            },
          },
          select: { id: true, role: true, status: true },
        })
      : null;

    let createdDevAlias = false;
    if (
      membershipForMatchedUser &&
      String(membershipForMatchedUser.role || "").trim().toUpperCase() === "MANAGER" &&
      String(membershipForMatchedUser.status || "").trim().toUpperCase() === "ACTIVE"
    ) {
      step = "dev_self_invite_alias_creation";
      if (!allowSelfEmployeeInviteTestMode()) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This person is already an active manager for this vendor. Use a different employee email/phone, or enable dev test mode locally.",
            code: "ALREADY_ACTIVE_MANAGER",
            ...(process.env.NODE_ENV !== "production" ? { step, details: { ...debug } } : {}),
          },
          { status: 409 }
        );
      }
      const aliasStamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const baseLocal = email && email.includes("@") ? email.split("@")[0] : `employee-test-${aliasStamp}`;
      const baseDomain = email && email.includes("@") ? email.split("@")[1] : "reliance.local";
      const aliasEmail = `${baseLocal}+employee-test-${aliasStamp}@${baseDomain}`;
      const aliasPhone = phone ? `${phone}-test-${Math.random().toString(16).slice(2, 6)}` : null;
      user = await (prisma as any).user.create({
        data: {
          // Keep internal alias contact identity, but preserve real display name.
          name,
          email: aliasEmail,
          phone: aliasPhone,
        },
      });
      createdDevAlias = true;
    }

    step = "membership_activate_upsert";
    const membership = await (prisma as any).vendorMembership.upsert({
      where: {
        vendorId_userId: {
          vendorId: String(invite.vendorId),
          userId: user.id,
        },
      },
      update: {
        role: "EMPLOYEE",
        status: "ACTIVE",
        approvedAt: new Date(),
      },
      create: {
        vendorId: invite.vendorId,
        userId: user.id,
        role: "EMPLOYEE",
        status: "ACTIVE",
        approvedAt: new Date(),
      },
    });

    step = "invite_mark_accepted";
    await (prisma as any).vendorInvite.update({
      where: { id: invite.id },
      data: { usesCount: invite.usesCount + 1, isActive: false },
    });

    await recordLifecycleAudit({
      actionType: "membership_accepted",
      entityType: "membership",
      entityId: String(membership.id),
      actorUserId: String(user.id),
      newValue: {
        vendorId: String(membership.vendorId),
        role: String(membership.role),
        status: String(membership.status),
      },
      metadata: {
        inviteId: String(invite.id),
        inviteCode: String(invite.code),
        devTestModeAliasUserCreated: createdDevAlias,
      },
    });

    step = "notify_vendor_invite_accepted";
    let vendorNotification: Awaited<ReturnType<typeof sendTeamInviteAcceptedNotification>> | null = null;
    try {
      const vendorName = lookup.vendor?.businessName || lookup.vendor?.name || "Reliance Vendor";
      vendorNotification = await sendTeamInviteAcceptedNotification({
        inviteId: String(invite.id),
        vendorId: String(invite.vendorId),
        actorUserId: String(user.id),
        vendorName,
        vendorEmail: lookup.vendor?.email || null,
        employeeName: String(user.name || name),
        employeeEmail: String(user.email || email || ""),
        employeePhone: String(user.phone || phone || ""),
        employeeRole: String(membership.role || "EMPLOYEE"),
        baseUrl: requestBaseUrl(request),
      });
    } catch (notificationError) {
      console.error("[vendor-invite] failed to send team invite accepted notification", notificationError);
    }

    return NextResponse.json({
      success: true,
      devTestModeAliasUserCreated: createdDevAlias,
      vendorNotification,
      membership: {
        id: membership.id,
        vendorId: membership.vendorId,
        role: membership.role,
        status: membership.status,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      ...(process.env.NODE_ENV !== "production" ? { step } : {}),
    });
  } catch (error: any) {
    const nonProd = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to accept invite",
        code: error?.code || "INVITE_ACCEPT_FAILED",
        message: error?.message || String(error),
        ...(nonProd
          ? {
              step,
              details: {
                ...debug,
                prismaCode: error?.code || null,
                prismaMeta: error?.meta || null,
                prismaMessage: error?.message || String(error),
              },
            }
          : {}),
      },
      { status: 500 }
    );
  }
}
