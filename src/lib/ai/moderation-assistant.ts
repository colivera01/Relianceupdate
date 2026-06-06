import { runStructuredAiTask } from "./client";
import { assertModerationAssistantOutputSafe } from "./output-guards";
import { MEDIA_MODERATION_ASSISTANT_PROMPT_VERSION } from "./prompt-registry";
import {
  moderationAssistantResultSchema,
  type ModerationAssistantResult,
} from "./schemas";

export type MediaModerationAssistantStage = {
  stageKey: "INTRO" | "IN_PROGRESS" | "COMPLETED";
  title: string;
  description: string | null;
  mimeType: string;
  fileSizeBytes: string;
  uploadedAt: string | null;
  currentModerationStatus: string;
  currentVisibilityStatus: string;
  currentModerationReason: string | null;
  employeeName: string | null;
};

export type MediaModerationAssistantContext = {
  bookingId: string;
  vendorId: string;
  vendorName: string | null;
  jobTitle: string;
  bookingStatus: string | null;
  serviceName: string | null;
  stages: MediaModerationAssistantStage[];
};

const TIGHT_STAGE_UPLOAD_WINDOW_MS = 5 * 60 * 1000;

export function buildMediaModerationAssistantInput(
  context: MediaModerationAssistantContext
): string {
  const stageLines = context.stages
    .map((stage) =>
      [
        `Stage: ${stage.stageKey}`,
        `Title: ${stage.title}`,
        `Description: ${stage.description || "Not provided"}`,
        `Mime type: ${stage.mimeType}`,
        `File size bytes: ${stage.fileSizeBytes}`,
        `Uploaded at: ${stage.uploadedAt || "Unknown"}`,
        `Current moderation status: ${stage.currentModerationStatus}`,
        `Current visibility status: ${stage.currentVisibilityStatus}`,
        `Current moderation reason: ${stage.currentModerationReason || "None"}`,
        `Employee label: ${stage.employeeName || "Not recorded"}`,
      ].join("\n")
    )
    .join("\n\n");

  return [
    "Reliance admin moderation request.",
    "Important scope: this review is metadata-only. You have NOT seen or watched the underlying video bytes.",
    "Do not claim to have visually verified the content.",
    "Booking titles may be custom labels and can differ from service names. Do not treat title/service naming differences alone as proof of wrong-job risk.",
    "Be conservative. If metadata is insufficient to justify approval or rejection, prefer needs_human_review.",
    "",
    `Booking ID: ${context.bookingId}`,
    `Vendor ID: ${context.vendorId}`,
    `Vendor name: ${context.vendorName || "Not provided"}`,
    `Job title: ${context.jobTitle}`,
    `Booking status: ${context.bookingStatus || "Unknown"}`,
    `Service name: ${context.serviceName || "Not provided"}`,
    "",
    "Stage metadata:",
    stageLines,
  ].join("\n");
}

export const MEDIA_MODERATION_ASSISTANT_INSTRUCTIONS = `
You are the Reliance AI Moderation Assistant for staged service-video packages.

Your job is to help an admin reviewer triage a complete Intro / In Progress / Completed service-video package.

Constraints:
- This pass is metadata-only. You cannot see the actual video content.
- Never say you watched, viewed, verified, or inspected the video itself.
- Be conservative. If the metadata alone is not enough, return "needs_human_review".
- Only recommend "approve" when the package metadata is internally consistent and does not surface an obvious policy or workflow concern.
- Recommend "flag" when the metadata suggests something unusual that should be escalated, but not necessarily rejected.
- Recommend "reject" when the metadata itself strongly indicates the package should not be approved in its current state.
- Use short, operator-friendly language.
- Mention workflow or policy concerns when relevant, especially privacy, consent, misleading labeling, wrong-job risk, or incomplete package signals.

Output requirements:
- Return valid JSON only.
- Keep summaries practical and concise.
- Findings should focus on the strongest operator-relevant signals.
`.trim();

function parseUploadedAt(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function allStagesShareSameFileSize(context: MediaModerationAssistantContext): boolean {
  const sizes = new Set(
    context.stages.map((stage) => String(stage.fileSizeBytes || "").trim()).filter(Boolean)
  );
  return context.stages.length >= 3 && sizes.size === 1;
}

function uploadsAreWithinTightWindow(context: MediaModerationAssistantContext): boolean {
  const timestamps = context.stages
    .map((stage) => parseUploadedAt(stage.uploadedAt))
    .filter((value): value is number => value !== null);

  if (timestamps.length !== context.stages.length || timestamps.length < 3) {
    return false;
  }

  const earliest = Math.min(...timestamps);
  const latest = Math.max(...timestamps);
  return latest - earliest <= TIGHT_STAGE_UPLOAD_WINDOW_MS;
}

function stagesCarryExplicitModerationReason(context: MediaModerationAssistantContext): boolean {
  return context.stages.some((stage) => Boolean(String(stage.currentModerationReason || "").trim()));
}

export function normalizeMediaModerationAssistantResult(
  context: MediaModerationAssistantContext,
  result: ModerationAssistantResult
): ModerationAssistantResult {
  const ambiguousRepeatedStagePattern =
    allStagesShareSameFileSize(context) &&
    uploadsAreWithinTightWindow(context) &&
    !stagesCarryExplicitModerationReason(context);

  if (
    !ambiguousRepeatedStagePattern
  ) {
    return result;
  }

  return {
    ...result,
    decision: "needs_human_review",
    confidence: "medium",
    recommendedActions: result.recommendedActions.includes(
      "Open the package and confirm each stage is a distinct recording before any approval decision."
    )
      ? result.recommendedActions
      : [
          "Open the package and confirm each stage is a distinct recording before any approval decision.",
          ...result.recommendedActions,
        ].slice(0, 6),
  };
}

export async function getMediaModerationAssistantSuggestion(
  context: MediaModerationAssistantContext,
  actorUserId: string
) {
  const result = await runStructuredAiTask({
    feature: "moderation_assistant",
    operation: "review_media_package",
    schema: moderationAssistantResultSchema,
    instructions: MEDIA_MODERATION_ASSISTANT_INSTRUCTIONS,
    input: buildMediaModerationAssistantInput(context),
    promptVersion: MEDIA_MODERATION_ASSISTANT_PROMPT_VERSION,
    actorUserId,
    entityId: context.bookingId,
    metadata: {
      analysisScope: "metadata_only",
      bookingId: context.bookingId,
      vendorId: context.vendorId,
      stageCount: context.stages.length,
    },
    maxOutputTokens: 700,
    reasoningEffort: "low",
    validateData: assertModerationAssistantOutputSafe,
  });

  return {
    ...result,
    data: normalizeMediaModerationAssistantResult(context, result.data),
  };
}

export type { ModerationAssistantResult };
