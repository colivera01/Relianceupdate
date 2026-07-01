import { runStructuredAiTask } from "./client";
import { ADMIN_NOTIFICATION_EMAIL_SUMMARY_PROMPT_VERSION } from "./prompt-registry";
import {
  adminNotificationEmailSummaryResultSchema,
  type AdminNotificationEmailSummaryResult,
} from "./schemas";

export type AdminNotificationEmailSummaryContext = {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  details: Array<{ label: string; value: string }>;
  adminUrl: string;
};

const INSTRUCTIONS = `
You are the Reliance Admin Alert Email Summary Assistant.

Your job is to help the Reliance owner quickly understand one admin alert email.

Rules:
- The original notification remains the source of truth.
- You are not approving, rejecting, moderating, suspending, or changing anything.
- Stay grounded only in the provided alert title, message, type, admin link, and details.
- Do not invent customer, vendor, media, review, storage, payment, or legal facts.
- Keep language direct and useful for an owner checking email on a phone.
- Suggested next action must direct the admin to review the linked admin surface, not to skip review.
- Use high risk only when the alert suggests privacy, safety, account restriction, public visibility, content report, or customer-trust impact.
`.trim();

function buildInput(context: AdminNotificationEmailSummaryContext): string {
  const detailLines = context.details.length
    ? context.details
        .slice(0, 8)
        .map((detail) => `- ${detail.label}: ${detail.value}`)
        .join("\n")
    : "- No additional details provided.";

  return [
    "Reliance single admin alert email summary request.",
    "",
    `Notification ID: ${context.notificationId}`,
    `Notification type: ${context.type}`,
    `Title: ${context.title}`,
    `Message: ${context.message}`,
    `Admin review link: ${context.adminUrl}`,
    "",
    "Details:",
    detailLines,
  ].join("\n");
}

export async function getAdminNotificationEmailSummary(
  context: AdminNotificationEmailSummaryContext,
  actorUserId: string
): Promise<AdminNotificationEmailSummaryResult> {
  const result = await runStructuredAiTask({
    feature: "support_inbox_triage",
    operation: "summarize_single_admin_alert_email",
    schema: adminNotificationEmailSummaryResultSchema,
    instructions: INSTRUCTIONS,
    input: buildInput(context),
    promptVersion: ADMIN_NOTIFICATION_EMAIL_SUMMARY_PROMPT_VERSION,
    actorUserId,
    entityId: context.notificationId,
    metadata: {
      notificationType: context.type,
      notificationId: context.notificationId,
      analysisScope: "admin_alert_email_summary",
    },
    maxOutputTokens: 450,
    reasoningEffort: "minimal",
  });

  return normalizeAdminNotificationEmailSummary(result.data);
}

function normalizeAdminNotificationEmailSummary(
  summary: AdminNotificationEmailSummaryResult
): AdminNotificationEmailSummaryResult {
  if (summary.confidence === "high") {
    return {
      ...summary,
      confidence: "medium",
    };
  }

  return summary;
}
