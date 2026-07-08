import { prisma } from "@/server/db";
import { sendEmail } from "@/lib/email/resend";
import {
  buildRelianceEmailHtml,
  escapeRelianceEmailHtml,
  getPublicEmailBaseUrl,
} from "@/lib/email/reliance-template";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";

export type TeamInviteAcceptedNotificationInput = {
  inviteId: string;
  vendorId: string;
  actorUserId: string;
  vendorName: string;
  vendorEmail?: string | null;
  employeeName: string;
  employeeEmail?: string | null;
  employeePhone?: string | null;
  employeeRole?: string | null;
  baseUrl?: string | null;
};

export type TeamInviteAcceptedNotificationResult = {
  attempted: number;
  sent: number;
  recipients: string[];
  errors: string[];
};

type ManagerRecipient = {
  name: string | null;
  email: string;
};

function normalizeEmail(value?: string | null): string | null {
  const email = String(value || "").trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

function normalizeDisplay(value?: string | null, fallback = "Not provided"): string {
  const text = String(value || "").trim();
  return text || fallback;
}

function teamRosterUrl(baseUrl?: string | null): string {
  return `${getPublicEmailBaseUrl(baseUrl)}/vendor/employees`;
}

async function loadManagerRecipients(
  vendorId: string,
  fallbackVendorEmail?: string | null
): Promise<ManagerRecipient[]> {
  const memberships = await (prisma as any).vendorMembership.findMany({
    where: {
      vendorId,
      status: { in: ["ACTIVE", "active"] },
      role: { in: ["MANAGER", "manager"] },
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    take: 25,
  });

  const recipients = new Map<string, ManagerRecipient>();

  for (const membership of memberships || []) {
    const email = normalizeEmail(membership?.user?.email);
    if (!email) continue;
    recipients.set(email, {
      email,
      name: membership?.user?.name || null,
    });
  }

  const vendorEmail = normalizeEmail(fallbackVendorEmail);
  if (vendorEmail && !recipients.has(vendorEmail)) {
    recipients.set(vendorEmail, {
      email: vendorEmail,
      name: null,
    });
  }

  return Array.from(recipients.values());
}

export async function sendTeamInviteAcceptedNotification(
  input: TeamInviteAcceptedNotificationInput
): Promise<TeamInviteAcceptedNotificationResult> {
  const vendorName = normalizeDisplay(input.vendorName, "your Reliance team");
  const employeeName = normalizeDisplay(input.employeeName, "A team member");
  const employeeEmail = normalizeEmail(input.employeeEmail);
  const employeePhone = normalizeDisplay(input.employeePhone);
  const employeeRole = normalizeDisplay(input.employeeRole, "Employee");
  const rosterUrl = teamRosterUrl(input.baseUrl);
  const recipients = await loadManagerRecipients(input.vendorId, input.vendorEmail);
  const safeEmployeeName = escapeRelianceEmailHtml(employeeName);
  const safeVendorName = escapeRelianceEmailHtml(vendorName);

  const result: TeamInviteAcceptedNotificationResult = {
    attempted: 0,
    sent: 0,
    recipients: recipients.map((recipient) => recipient.email),
    errors: [],
  };

  if (!recipients.length) {
    result.errors.push("no_vendor_manager_email");
    return result;
  }

  const subject = `Reliance team update: ${employeeName} accepted the invite`;
  const text = [
    `${employeeName} accepted the team invite for ${vendorName}.`,
    "",
    "They now appear in your Team roster and can be assigned work records when needed.",
    "",
    `Employee: ${employeeName}`,
    `Email: ${employeeEmail || "Not provided"}`,
    `Phone: ${employeePhone}`,
    `Role: ${employeeRole}`,
    "",
    `View team roster: ${rosterUrl}`,
    "",
    "- Reliance Team",
  ].join("\n");

  for (const recipient of recipients) {
    const html = buildRelianceEmailHtml({
      eyebrow: "Team invite accepted",
      headline: `${employeeName} joined your team`,
      greeting: recipient.name ? `Hi ${recipient.name},` : undefined,
      bodyHtml: `
        <p style="margin:0 0 14px;"><strong style="color:#ffffff;">${safeEmployeeName}</strong> accepted the team invite for <strong style="color:#ffffff;">${safeVendorName}</strong>.</p>
        <p style="margin:0;">They now appear in your Team roster and can be assigned work records when needed.</p>
      `,
      details: [
        { label: "Team member", value: employeeName },
        { label: "Email", value: employeeEmail || "Not provided" },
        { label: "Phone", value: employeePhone },
        { label: "Role", value: employeeRole },
        { label: "Vendor team", value: vendorName },
      ],
      cta: {
        label: "View Team Roster",
        href: rosterUrl,
      },
      fallbackHref: rosterUrl,
      footerNote: "This team alert was generated automatically by Reliance.",
      baseUrl: input.baseUrl,
    });

    result.attempted += 1;
    const sendResult = await sendEmail({
      to: recipient.email,
      subject,
      text,
      html,
    });

    if (sendResult.ok) {
      result.sent += 1;
    } else if (sendResult.errorMessage) {
      result.errors.push(sendResult.errorMessage);
    }

    await logNotificationAttempt(input.actorUserId, input.inviteId, {
      kind: "employee_invite_accepted",
      channel: "email",
      recipient: recipient.email,
      success: sendResult.ok,
      providerMessageId: sendResult.providerMessageId,
      fallbackLink: rosterUrl,
      errorMessage: sendResult.errorMessage,
    });
  }

  return result;
}
