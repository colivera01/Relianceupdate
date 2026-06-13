import { runStructuredAiTask } from "./client";
import { SUPPORT_INBOX_TRIAGE_PROMPT_VERSION } from "./prompt-registry";
import {
  supportInboxTriageAssistantResultSchema,
  type SupportInboxTriageAssistantResult,
} from "./schemas";

export type SupportInboxNotificationSummary = {
  id: string;
  type: string;
  title: string;
  message: string;
  vendorName: string | null;
  createdAt: string | null;
  read: boolean;
};

export type SupportInboxTriageAssistantContext = {
  unreadCount: number;
  totalCount: number;
  notifications: SupportInboxNotificationSummary[];
};

function buildInput(context: SupportInboxTriageAssistantContext): string {
  return [
    "Reliance support and alert inbox triage request.",
    "Important scope: this is a triage summary for current internal admin notifications, not an external email inbox.",
    "Group the current unread items into urgent, soon, and batch-later follow-up.",
    "",
    `Unread notifications: ${context.unreadCount}`,
    `Total notifications in current slice: ${context.totalCount}`,
    "Notification summaries:",
    context.notifications.length
      ? context.notifications
          .slice(0, 25)
          .map(
            (item) =>
              `- ${item.type} | ${item.title} | ${item.vendorName || "No vendor"} | ${item.createdAt || "Unknown time"} | ${item.message}`
          )
          .join("\n")
      : "- No notifications available",
  ].join("\n");
}

const INSTRUCTIONS = `
You are the Reliance AI Support Inbox Triage Assistant.

Your job is to help an owner or admin quickly prioritize current unread internal notifications.

Constraints:
- Recommendation only.
- Do not claim ticket ownership, email delivery, or real-world outreach happened.
- Stay grounded in the notification list only.
- Use red flags for safety, abuse, repeated blocking issues, or items that could damage trust if ignored.
- "Soon" should capture items worth same-day or next-pass follow-up but not emergency attention.

Output requirements:
- Return valid JSON only.
- Keep each triage item concise and actionable.
`.trim();

export async function getSupportInboxTriageAssistantSuggestion(
  context: SupportInboxTriageAssistantContext,
  actorUserId: string
) {
  const result = await runStructuredAiTask({
    feature: "support_inbox_triage",
    operation: "triage_support_and_alert_inbox",
    schema: supportInboxTriageAssistantResultSchema,
    instructions: INSTRUCTIONS,
    input: buildInput(context),
    promptVersion: SUPPORT_INBOX_TRIAGE_PROMPT_VERSION,
    actorUserId,
    entityId: "admin_support_inbox",
    metadata: {
      analysisScope: "support_inbox_triage",
      unreadCount: context.unreadCount,
      totalCount: context.totalCount,
    },
    maxOutputTokens: 750,
    reasoningEffort: "low",
  });

  return {
    ...result,
    data: normalizeSupportInboxTriageAssistantResult(result.data),
  };
}

function normalizeSupportInboxTriageAssistantResult(
  result: SupportInboxTriageAssistantResult
): SupportInboxTriageAssistantResult {
  if (result.confidence === "high") {
    return {
      ...result,
      confidence: "medium",
    };
  }
  return result;
}
