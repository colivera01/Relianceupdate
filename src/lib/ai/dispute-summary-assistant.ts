import { runStructuredAiTask } from "./client";
import { assertDisputeSummaryOutputSafe } from "./output-guards";
import { DISPUTE_SUMMARY_ASSISTANT_PROMPT_VERSION } from "./prompt-registry";
import {
  disputeSummaryResultSchema,
  type DisputeSummaryResult,
} from "./schemas";

export type DisputeSummaryLinkedReview = {
  rating: number | null;
  comment: string | null;
  moderationStatus: string | null;
  visibilityStatus: string | null;
  moderationReason: string | null;
  createdAt: string | null;
  source: string | null;
  jobType: string | null;
  assignedEmployeeName: string | null;
};

export type DisputeSummaryLinkedMediaAsset = {
  mimeType: string | null;
  fileSizeBytes: string | null;
  moderationStatus: string | null;
  visibilityStatus: string | null;
  moderationReason: string | null;
  createdAt: string | null;
  sessionType: string | null;
  stageKey: string | null;
  sessionTitle: string | null;
  sessionDescription: string | null;
  deviceType: string | null;
  employeeName: string | null;
};

export type DisputeSummaryAssistantContext = {
  reportId: string;
  targetType: string;
  targetId: string;
  reportStatus: string;
  severity: string;
  reasonCategory: string;
  reasonDetail: string | null;
  reporterRole: string;
  autoHidden: boolean;
  createdAt: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  relatedTargetReportCount: number;
  bookingId: string | null;
  bookingTitle: string | null;
  bookingStatus: string | null;
  serviceName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  linkedReview: DisputeSummaryLinkedReview | null;
  linkedMediaAsset: DisputeSummaryLinkedMediaAsset | null;
};

const UNRESOLVED_REPORT_STATUSES = new Set(["open", "triaged", "under_review"]);

function buildLinkedReviewSection(review: DisputeSummaryLinkedReview | null): string {
  if (!review) {
    return "Linked review metadata: Not available.";
  }

  return [
    "Linked review metadata:",
    `Rating: ${review.rating ?? "Not recorded"}`,
    `Comment: ${review.comment || "Not provided"}`,
    `Review moderation status: ${review.moderationStatus || "Unknown"}`,
    `Review visibility status: ${review.visibilityStatus || "Unknown"}`,
    `Review moderation reason: ${review.moderationReason || "None"}`,
    `Review source: ${review.source || "Unknown"}`,
    `Review job type: ${review.jobType || "Not provided"}`,
    `Assigned employee label: ${review.assignedEmployeeName || "Not recorded"}`,
    `Review created at: ${review.createdAt || "Unknown"}`,
  ].join("\n");
}

function buildLinkedMediaSection(asset: DisputeSummaryLinkedMediaAsset | null): string {
  if (!asset) {
    return "Linked media metadata: Not available.";
  }

  return [
    "Linked media metadata:",
    `Mime type: ${asset.mimeType || "Unknown"}`,
    `File size bytes: ${asset.fileSizeBytes || "Unknown"}`,
    `Media moderation status: ${asset.moderationStatus || "Unknown"}`,
    `Media visibility status: ${asset.visibilityStatus || "Unknown"}`,
    `Media moderation reason: ${asset.moderationReason || "None"}`,
    `Media created at: ${asset.createdAt || "Unknown"}`,
    `Media session type: ${asset.sessionType || "Unknown"}`,
    `Video stage: ${asset.stageKey || "Not staged"}`,
    `Session title: ${asset.sessionTitle || "Not provided"}`,
    `Session description: ${asset.sessionDescription || "Not provided"}`,
    `Capture device type: ${asset.deviceType || "Unknown"}`,
    `Employee label: ${asset.employeeName || "Not recorded"}`,
  ].join("\n");
}

export function buildDisputeSummaryAssistantInput(
  context: DisputeSummaryAssistantContext
): string {
  return [
    "Reliance admin reported-content case summary request.",
    "Important scope: you are summarizing a stored content report and linked product metadata only.",
    "Do not claim you interviewed the customer, interviewed the vendor, or watched raw video bytes.",
    "Use cautious language when the evidence is incomplete or one-sided.",
    "",
    `Report ID: ${context.reportId}`,
    `Target type: ${context.targetType}`,
    `Target ID: ${context.targetId}`,
    `Current report status: ${context.reportStatus}`,
    `Severity: ${context.severity}`,
    `Reason category: ${context.reasonCategory}`,
    `Reason detail: ${context.reasonDetail || "Not provided"}`,
    `Reporter role: ${context.reporterRole}`,
    `Auto hidden: ${context.autoHidden ? "Yes" : "No"}`,
    `Created at: ${context.createdAt || "Unknown"}`,
    `Resolved at: ${context.resolvedAt || "Not resolved"}`,
    `Resolution notes: ${context.resolutionNotes || "None"}`,
    `Total reports on this target: ${String(context.relatedTargetReportCount)}`,
    "",
    "Linked booking context:",
    `Booking ID: ${context.bookingId || "Not linked"}`,
    `Booking title: ${context.bookingTitle || "Not provided"}`,
    `Booking status: ${context.bookingStatus || "Unknown"}`,
    `Service name: ${context.serviceName || "Not provided"}`,
    `Vendor ID: ${context.vendorId || "Not linked"}`,
    `Vendor name: ${context.vendorName || "Not provided"}`,
    "",
    buildLinkedReviewSection(context.linkedReview),
    "",
    buildLinkedMediaSection(context.linkedMediaAsset),
  ].join("\n");
}

export const DISPUTE_SUMMARY_ASSISTANT_INSTRUCTIONS = `
You are the Reliance AI Dispute Summary Assistant for admin reported-content cases.

Your job is to help an admin quickly understand a content report, the linked booking context, and any linked review or media metadata.

Constraints:
- This is not a final decision-maker. You are assisting a human admin.
- You do not have party interviews, private communications, or raw video playback unless explicitly stated. Do not imply you reviewed evidence that is not present.
- Treat the report as an allegation plus product metadata, not a proven fact pattern.
- Be conservative when evidence is incomplete or conflicting.
- Prefer "needs_admin_review" when the case still requires a human judgment call.
- Use short, operator-friendly language.
- Timeline items should focus on what happened in the recorded system state, not speculation.
- Disputed points should isolate the main factual disagreements or moderation concerns.

Output requirements:
- Return valid JSON only.
- Keep summaries concise and operational.
- Recommended next step should be the single best admin workflow next action from the available enum values.
`.trim();

export function normalizeDisputeSummaryAssistantResult(
  context: DisputeSummaryAssistantContext,
  result: DisputeSummaryResult
): DisputeSummaryResult {
  const normalizedStatus = String(context.reportStatus || "").trim().toLowerCase();
  const hasLinkedMedia = Boolean(context.linkedMediaAsset);
  const hasResolutionNotes = Boolean(String(context.resolutionNotes || "").trim());
  const thinEvidenceUnresolved =
    UNRESOLVED_REPORT_STATUSES.has(normalizedStatus) &&
    !hasLinkedMedia &&
    !hasResolutionNotes &&
    result.recommendedNextStep === "needs_admin_review";

  if (!thinEvidenceUnresolved) {
    return result;
  }

  const riskFlags = result.riskFlags.includes("limited metadata evidence")
    ? result.riskFlags
    : [...result.riskFlags, "limited metadata evidence"].slice(0, 8);

  if (result.confidence !== "high") {
    return {
      ...result,
      riskFlags,
    };
  }

  return {
    ...result,
    confidence: "medium",
    riskFlags,
  };
}

export async function getDisputeSummaryAssistantSuggestion(
  context: DisputeSummaryAssistantContext,
  actorUserId: string
) {
  const result = await runStructuredAiTask({
    feature: "dispute_summary_assistant",
    operation: "summarize_content_report_case",
    schema: disputeSummaryResultSchema,
    instructions: DISPUTE_SUMMARY_ASSISTANT_INSTRUCTIONS,
    input: buildDisputeSummaryAssistantInput(context),
    promptVersion: DISPUTE_SUMMARY_ASSISTANT_PROMPT_VERSION,
    actorUserId,
    entityId: context.reportId,
    metadata: {
      analysisScope: "content_report_and_linked_records",
      reportId: context.reportId,
      targetType: context.targetType,
      targetId: context.targetId,
      bookingId: context.bookingId,
      vendorId: context.vendorId,
      reportStatus: context.reportStatus,
      severity: context.severity,
    },
    maxOutputTokens: 750,
    reasoningEffort: "low",
    validateData: assertDisputeSummaryOutputSafe,
  });

  return {
    ...result,
    data: normalizeDisputeSummaryAssistantResult(context, result.data),
  };
}

export type { DisputeSummaryResult };
