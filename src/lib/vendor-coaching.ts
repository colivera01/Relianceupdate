import type { VendorDashboardResponse } from "@/types/vendor";

export interface CoachingMetric {
  pct: number | null;
  numerator: number;
  denominator: number;
  weightPct: number;
}

export interface VendorTrustScoreForCoaching {
  scored: boolean;
  totalScorePct: number | null;
  components: {
    workflowCompletion: CoachingMetric;
    videoVerification: CoachingMetric;
    disputeFree: CoachingMetric;
    operationalReliability: CoachingMetric;
  } | null;
}

export interface VendorCoachingPlan {
  summary: string;
  priorityActions: string[];
  strengths: string[];
  operationalNotes: string[];
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function buildVendorCoachingPlan(
  trustScore: VendorTrustScoreForCoaching | null | undefined,
  dashboard: VendorDashboardResponse | null | undefined
): VendorCoachingPlan {
  if (!dashboard) {
    return {
      summary: "Live coaching will appear after the vendor dashboard finishes loading.",
      priorityActions: [],
      strengths: [],
      operationalNotes: [],
    };
  }

  const pendingModerationProofs = toNumber(dashboard.pendingModerationProofs);
  const approvedProofs = toNumber(dashboard.approvedProofs);
  const storagePercentUsed = toNumber(dashboard.storagePercentUsed);
  const completedJobs =
    typeof dashboard.lifecycleCounts?.completed === "number"
      ? dashboard.lifecycleCounts.completed
      : Array.isArray(dashboard.recentJobs)
      ? dashboard.recentJobs.filter((job) => job.status === "completed").length
      : 0;
  const inProgressJobs =
    typeof dashboard.lifecycleCounts?.inProgress === "number"
      ? dashboard.lifecycleCounts.inProgress
      : Array.isArray(dashboard.recentJobs)
      ? dashboard.recentJobs.filter((job) => job.status === "in progress").length
      : 0;
  const publicReviewCount = Array.isArray(dashboard.recentReviews) ? dashboard.recentReviews.length : 0;

  const workflowCompletion = trustScore?.components?.workflowCompletion ?? null;
  const videoVerification = trustScore?.components?.videoVerification ?? null;
  const disputeFree = trustScore?.components?.disputeFree ?? null;
  const operationalReliability = trustScore?.components?.operationalReliability ?? null;

  const strengths: string[] = [];
  const priorityActions: string[] = [];
  const operationalNotes: string[] = [];

  if (!trustScore?.scored || trustScore.totalScorePct === null || !trustScore.components) {
    return {
      summary:
        "This account does not have enough finalized Reliance activity for a meaningful Trust Score coaching plan yet.",
      priorityActions: [
        "Finish more jobs through finalized completion so workflow and dispute-free metrics become measurable.",
        "Make sure each completed job has distinct staged service videos so verification outcomes can contribute to the score.",
      ],
      strengths:
        approvedProofs > 0
          ? [`${approvedProofs} service video asset${approvedProofs === 1 ? "" : "s"} already approved.`]
          : [],
      operationalNotes:
        inProgressJobs > 0
          ? [`${inProgressJobs} job${inProgressJobs === 1 ? "" : "s"} currently in progress will help build measurable coverage once finalized.`]
          : [],
    };
  }

  if (trustScore.totalScorePct >= 95) {
    strengths.push(`Your current Reliance Trust Score is strong at ${trustScore.totalScorePct}%.`);
  }
  if (workflowCompletion?.pct === 100) {
    strengths.push(
      `Workflow completion is perfect right now (${workflowCompletion.numerator} of ${workflowCompletion.denominator} finalized).`
    );
  }
  if (disputeFree?.pct === 100) {
    strengths.push(
      `Dispute-free completion is holding at 100%, which means finalized service issues are not dragging the score down.`
    );
  }
  if (videoVerification?.pct === 100) {
    strengths.push(
      `Video verification is fully intact with ${videoVerification.numerator} of ${videoVerification.denominator} finalized packages approved.`
    );
  }
  if (pendingModerationProofs === 0 && approvedProofs > 0) {
    strengths.push("There is no current moderation backlog in the service video pipeline.");
  }

  if (operationalReliability && operationalReliability.pct !== null && operationalReliability.pct < 95) {
    priorityActions.push(
      `Operational reliability is the main Trust Score drag at ${operationalReliability.pct}%. Review canceled, late, or otherwise non-clean completions first.`
    );
  }

  if (workflowCompletion && workflowCompletion.pct !== null && workflowCompletion.pct < 100) {
    priorityActions.push(
      `Workflow completion is ${workflowCompletion.pct}%. Reduce cancellations and make sure scheduled work reaches finalized completion whenever service actually happens.`
    );
  }

  if (videoVerification && videoVerification.pct !== null && videoVerification.pct < 100) {
    priorityActions.push(
      `Video verification is ${videoVerification.pct}%. Tighten stage capture quality so Before, During Service, and Completed Service videos are clearly distinct and moderation-ready.`
    );
  }

  if (pendingModerationProofs > 0) {
    priorityActions.push(
      `${pendingModerationProofs} service video package${pendingModerationProofs === 1 ? "" : "s"} still await moderation. Clearing that queue is the fastest way to strengthen verification coverage.`
    );
  }

  if (disputeFree && disputeFree.pct !== null && disputeFree.pct < 100) {
    priorityActions.push(
      `Dispute-free completion is ${disputeFree.pct}%. Review validated disputes, refunds, or confirmed service failures to prevent repeat issues.`
    );
  }

  if (storagePercentUsed >= 80) {
    operationalNotes.push(
      `Storage is ${Math.round(storagePercentUsed)}% full. Archive or clean up older internal-only media before storage pressure affects daily operations.`
    );
  }

  if (publicReviewCount === 0 && completedJobs > 0) {
    operationalNotes.push(
      "Completed jobs exist, but there are no recent public reviews in the current dashboard slice. Keep the review request loop healthy for broader marketplace trust."
    );
  } else if (publicReviewCount > 0 && completedJobs > 0) {
    operationalNotes.push(
      `${publicReviewCount} recent public review${publicReviewCount === 1 ? "" : "s"} are visible against ${completedJobs} recent completed job${completedJobs === 1 ? "" : "s"}.`
    );
  }

  if (inProgressJobs > 0) {
    operationalNotes.push(
      `${inProgressJobs} job${inProgressJobs === 1 ? "" : "s"} currently in progress should be watched for clean completion and staged video follow-through.`
    );
  }

  if (priorityActions.length === 0) {
    priorityActions.push(
      "No major score weak point stands out right now. Keep completion quality, staged video discipline, and operational follow-through consistent."
    );
  }

  const summary =
    priorityActions[0] ||
    `Your current Trust Score is ${trustScore.totalScorePct}%, with the strongest gains coming from verified workflow quality and clean finalized outcomes.`;

  return {
    summary,
    priorityActions,
    strengths,
    operationalNotes,
  };
}
