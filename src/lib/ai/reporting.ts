import { AI_FEATURE_KEYS, type AiFeatureKey } from "./config";
import {
  isAiOperatorFeedbackOutcome,
  type AiOperatorFeedbackOutcome,
} from "./feedback";

export type AiAuditLogRow = {
  id: string;
  actionType: string;
  entityId: string;
  actorUserId: string;
  metadata?: string | null;
  createdAt: Date | string;
};

type ParsedAiMetadata = Record<string, unknown>;

export type AiFeatureReportingSummary = {
  feature: string;
  featureLabel: string;
  responseCount: number;
  errorCount: number;
  feedbackCount: number;
  acceptedCount: number;
  overrodeCount: number;
  ignoredCount: number;
  followRatePct: number | null;
};

export type AiRecentRunSummary = {
  aiRunId: string;
  feature: string;
  featureLabel: string;
  operation: string;
  model: string | null;
  promptVersion: string | null;
  actorUserId: string;
  relatedEntityId: string;
  createdAt: Date | string;
  durationMs: number | null;
  totalTokens: number | null;
  feedbackOutcome: AiOperatorFeedbackOutcome | null;
  feedbackRecordedAt: Date | string | null;
};

export type AiActivityReport = {
  responseCount: number;
  errorCount: number;
  feedbackCount: number;
  acceptedCount: number;
  overrodeCount: number;
  ignoredCount: number;
  feedbackCoveragePct: number | null;
  followRatePct: number | null;
  featureSummaries: AiFeatureReportingSummary[];
  recentRuns: AiRecentRunSummary[];
};

export type AiActivityFeatureFilter = AiFeatureKey | "all";

type BuildAiActivityReportInput = {
  responseLogs: AiAuditLogRow[];
  feedbackLogs: AiAuditLogRow[];
  errorLogs: AiAuditLogRow[];
  recentRunLimit?: number;
  featureFilter?: AiActivityFeatureFilter;
};

function safeJsonParse(raw: string | null | undefined): ParsedAiMetadata {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ParsedAiMetadata)
      : {};
  } catch {
    return {};
  }
}

function cleanText(value: unknown): string | null {
  const next = String(value ?? "").trim();
  return next ? next : null;
}

function cleanNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isAiFeatureKey(value: unknown): value is AiFeatureKey {
  return AI_FEATURE_KEYS.includes(value as AiFeatureKey);
}

export function formatAiFeatureLabel(feature: string): string {
  switch (feature) {
    case "moderation_assistant":
      return "Moderation Assistant";
    case "dispute_summary_assistant":
      return "Dispute Summary Assistant";
    case "trust_score_explanations":
      return "Trust Score Explanations";
    case "vendor_coaching":
      return "Vendor Coaching";
    default:
      return "Unknown Feature";
  }
}

export function normalizeAiActivityFeatureFilter(
  value: unknown
): AiActivityFeatureFilter {
  const normalized = cleanText(value);
  if (!normalized || normalized === "all") return "all";
  return isAiFeatureKey(normalized) ? normalized : "all";
}

function readFeature(metadata: ParsedAiMetadata): string {
  const feature = cleanText(metadata.feature);
  return feature && isAiFeatureKey(feature) ? feature : "unknown";
}

function filterLogsByFeature(
  logs: AiAuditLogRow[],
  featureFilter: AiActivityFeatureFilter
): AiAuditLogRow[] {
  if (featureFilter === "all") return logs;
  return logs.filter((log) => {
    const metadata = safeJsonParse(log.metadata);
    return readFeature(metadata) === featureFilter;
  });
}

function buildFeedbackLookup(feedbackLogs: AiAuditLogRow[]) {
  const latestByRun = new Map<
    string,
    {
      outcome: AiOperatorFeedbackOutcome;
      createdAt: Date | string;
      feature: string;
    }
  >();

  for (const log of feedbackLogs) {
    const metadata = safeJsonParse(log.metadata);
    const outcome = metadata.outcome;
    if (!isAiOperatorFeedbackOutcome(outcome)) continue;

    const runId = cleanText(log.entityId);
    if (!runId) continue;

    const next = {
      outcome,
      createdAt: log.createdAt,
      feature: readFeature(metadata),
    };
    const existing = latestByRun.get(runId);
    if (!existing) {
      latestByRun.set(runId, next);
      continue;
    }

    const existingTime = new Date(existing.createdAt).getTime();
    const nextTime = new Date(next.createdAt).getTime();
    if (Number.isNaN(existingTime) || nextTime >= existingTime) {
      latestByRun.set(runId, next);
    }
  }

  return latestByRun;
}

function createEmptyFeatureSummary(feature: string): AiFeatureReportingSummary {
  return {
    feature,
    featureLabel: formatAiFeatureLabel(feature),
    responseCount: 0,
    errorCount: 0,
    feedbackCount: 0,
    acceptedCount: 0,
    overrodeCount: 0,
    ignoredCount: 0,
    followRatePct: null,
  };
}

export function buildAiActivityReport(
  input: BuildAiActivityReportInput
): AiActivityReport {
  const recentRunLimit = Math.max(1, Math.min(input.recentRunLimit ?? 8, 25));
  const featureFilter = normalizeAiActivityFeatureFilter(input.featureFilter);
  const filteredResponseLogs = filterLogsByFeature(input.responseLogs, featureFilter);
  const filteredFeedbackLogs = filterLogsByFeature(input.feedbackLogs, featureFilter);
  const filteredErrorLogs = filterLogsByFeature(input.errorLogs, featureFilter);
  const feedbackByRun = buildFeedbackLookup(filteredFeedbackLogs);
  const featureMap = new Map<string, AiFeatureReportingSummary>();
  const touchFeature = (feature: string) => {
    if (!featureMap.has(feature)) {
      featureMap.set(feature, createEmptyFeatureSummary(feature));
    }
    return featureMap.get(feature)!;
  };

  let acceptedCount = 0;
  let overrodeCount = 0;
  let ignoredCount = 0;

  for (const log of filteredFeedbackLogs) {
    const metadata = safeJsonParse(log.metadata);
    const outcome = metadata.outcome;
    if (!isAiOperatorFeedbackOutcome(outcome)) continue;

    const featureSummary = touchFeature(readFeature(metadata));
    featureSummary.feedbackCount += 1;

    if (outcome === "accepted") {
      featureSummary.acceptedCount += 1;
      acceptedCount += 1;
    } else if (outcome === "overrode") {
      featureSummary.overrodeCount += 1;
      overrodeCount += 1;
    } else {
      featureSummary.ignoredCount += 1;
      ignoredCount += 1;
    }
  }

  for (const log of filteredResponseLogs) {
    const metadata = safeJsonParse(log.metadata);
    touchFeature(readFeature(metadata)).responseCount += 1;
  }

  for (const log of filteredErrorLogs) {
    const metadata = safeJsonParse(log.metadata);
    touchFeature(readFeature(metadata)).errorCount += 1;
  }

  const recentRuns = filteredResponseLogs
    .map((log) => {
      const metadata = safeJsonParse(log.metadata);
      const aiRunId =
        cleanText(metadata.responseId) ||
        cleanText(metadata.requestId) ||
        `response-log:${log.id}`;
      const feedback = feedbackByRun.get(aiRunId);
      return {
        aiRunId,
        feature: readFeature(metadata),
        featureLabel: formatAiFeatureLabel(readFeature(metadata)),
        operation: cleanText(metadata.operation) || "unknown_operation",
        model: cleanText(metadata.model),
        promptVersion: cleanText(metadata.promptVersion),
        actorUserId: cleanText(log.actorUserId) || "system_ai",
        relatedEntityId: cleanText(log.entityId) || "unknown_entity",
        createdAt: log.createdAt,
        durationMs: cleanNumber(metadata.durationMs),
        totalTokens:
          cleanNumber((metadata.usage as { totalTokens?: unknown } | null | undefined)?.totalTokens) ??
          cleanNumber((metadata.usage as { total_tokens?: unknown } | null | undefined)?.total_tokens),
        feedbackOutcome: feedback?.outcome ?? null,
        feedbackRecordedAt: feedback?.createdAt ?? null,
      } satisfies AiRecentRunSummary;
    })
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )
    .slice(0, recentRunLimit);

  const decisiveFeedbackCount = acceptedCount + overrodeCount;
  const responseCount = filteredResponseLogs.length;
  const feedbackCount = acceptedCount + overrodeCount + ignoredCount;

  const featureSummaries = Array.from(featureMap.values())
    .map((summary) => {
      const decisiveFeatureCount = summary.acceptedCount + summary.overrodeCount;
      return {
        ...summary,
        followRatePct: decisiveFeatureCount
          ? Math.round((summary.acceptedCount / decisiveFeatureCount) * 100)
          : null,
      };
    })
    .sort((left, right) => {
      if (right.responseCount !== left.responseCount) {
        return right.responseCount - left.responseCount;
      }
      return left.featureLabel.localeCompare(right.featureLabel);
    });

  return {
    responseCount,
    errorCount: filteredErrorLogs.length,
    feedbackCount,
    acceptedCount,
    overrodeCount,
    ignoredCount,
    feedbackCoveragePct: responseCount
      ? Math.round((feedbackCount / responseCount) * 100)
      : null,
    followRatePct: decisiveFeedbackCount
      ? Math.round((acceptedCount / decisiveFeedbackCount) * 100)
      : null,
    featureSummaries,
    recentRuns,
  };
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeAiRecentRunsCsv(runs: AiRecentRunSummary[]): string {
  const header = [
    "aiRunId",
    "feature",
    "featureLabel",
    "operation",
    "model",
    "promptVersion",
    "actorUserId",
    "relatedEntityId",
    "createdAt",
    "durationMs",
    "totalTokens",
    "feedbackOutcome",
    "feedbackRecordedAt",
  ];

  const rows = runs.map((run) =>
    [
      run.aiRunId,
      run.feature,
      run.featureLabel,
      run.operation,
      run.model || "",
      run.promptVersion || "",
      run.actorUserId,
      run.relatedEntityId,
      String(run.createdAt),
      run.durationMs == null ? "" : String(run.durationMs),
      run.totalTokens == null ? "" : String(run.totalTokens),
      run.feedbackOutcome || "",
      run.feedbackRecordedAt == null ? "" : String(run.feedbackRecordedAt),
    ]
      .map((cell) => escapeCsvCell(String(cell)))
      .join(",")
  );

  return [header.join(","), ...rows].join("\n");
}
