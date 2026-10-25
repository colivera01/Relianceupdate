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
    operationalReliability?: CoachingMetric;
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

  const pendingServiceOrders = toNumber(
    dashboard.pendingModerationServiceOrderCount ?? dashboard.pendingModerationProofs
  );
  const approvedServiceOrders = toNumber(
    dashboard.approvedServiceOrderCount ?? dashboard.approvedProofs
  );
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
  const publicReviewCount = toNumber(
    dashboard.stats?.publicWrittenReviewCount ?? dashboard.recentReviews?.length
  );

  const workflowCompletion = trustScore?.components?.workflowCompletion ?? null;
  const videoVerification = trustScore?.components?.videoVerification ?? null;
  const disputeFree = trustScore?.components?.disputeFree ?? null;

  const strengths: string[] = [];
  const priorityActions: string[] = [];
  const operationalNotes: string[] = [];

  if (!trustScore?.scored || trustScore.totalScorePct === null || !trustScore.components) {
    return {
      summary:
        "This account does not yet have complete finalized evidence for a Reliance Trust Score coaching plan.",
      priorityActions: [
        "Finish more jobs through finalized completion so workflow and dispute-free metrics become measurable.",
        "Make sure each completed job has distinct staged service videos so verification outcomes can contribute to the score.",
      ],
      strengths:
        approvedServiceOrders > 0
          ? [`${approvedServiceOrders} Service Order video package${approvedServiceOrders === 1 ? " is" : "s are"} already approved.`]
          : [],
      operationalNotes:
        inProgressJobs > 0
          ? [`${inProgressJobs} job${inProgressJobs === 1 ? "" : "s"} currently in progress will help build measurable coverage once finalized.`]
          : [],
    };
  }

  if (trustScore.totalScorePct >= 95) {
    strengths.push(`Your current Reliance Trust Score is ${trustScore.totalScorePct}/100.`);
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
  if (pendingServiceOrders === 0 && approvedServiceOrders > 0) {
    strengths.push("There is no current Reliance Audit backlog in the Service Order video pipeline.");
  }

  const scoreOpportunities = [
    workflowCompletion?.pct !== null && workflowCompletion
      ? {
          label: "Workflow completion",
          pct: workflowCompletion.pct,
          weightPct: workflowCompletion.weightPct,
          action: `Workflow completion is ${workflowCompletion.pct}%. Reduce cancellations and make sure scheduled work reaches finalized completion whenever service actually happens.`,
        }
      : null,
    videoVerification?.pct !== null && videoVerification
      ? {
          label: "Video verification",
          pct: videoVerification.pct,
          weightPct: videoVerification.weightPct,
          action: `Video verification is ${videoVerification.pct}%. Tighten stage capture quality so Starting Condition, Work in Progress, and Final Result videos are clearly distinct and moderation-ready.`,
        }
      : null,
    disputeFree?.pct !== null && disputeFree
      ? {
          label: "Dispute-free completion",
          pct: disputeFree.pct,
          weightPct: disputeFree.weightPct,
          action: `Dispute-free completion is ${disputeFree.pct}%. Review validated disputes, refunds, or confirmed service failures to prevent repeat issues.`,
        }
      : null,
  ]
    .filter(
      (item): item is { label: string; pct: number; weightPct: number; action: string } =>
        item !== null && item.pct < 100,
    )
    .sort((a, b) => a.pct - b.pct || b.weightPct - a.weightPct);

  priorityActions.push(...scoreOpportunities.map((item) => item.action));

  if (pendingServiceOrders > 0) {
    operationalNotes.push(
      `${pendingServiceOrders} Service Order video package${pendingServiceOrders === 1 ? " is" : "s are"} awaiting Reliance Audit. No vendor action is required unless Reliance returns a correction request; finalized outcomes will appear after review.`
    );
  }

  if (storagePercentUsed >= 80) {
    operationalNotes.push(
      `Storage is ${Math.round(storagePercentUsed)}% full. Archive or clean up older internal-only media before storage pressure affects daily operations.`
    );
  }

  if (publicReviewCount === 0 && completedJobs > 0) {
    operationalNotes.push(
      "No public written reviews are available yet. Reviews remain optional customer feedback and are separate from the Reliance Trust Score."
    );
  } else if (publicReviewCount > 0 && completedJobs > 0) {
    operationalNotes.push(
      `${publicReviewCount} public written review${publicReviewCount === 1 ? " is" : "s are"} visible alongside ${completedJobs} completed job${completedJobs === 1 ? "" : "s"}.`
    );
  }

  if (inProgressJobs > 0) {
    operationalNotes.push(
      `${inProgressJobs} job${inProgressJobs === 1 ? "" : "s"} currently in progress should be watched for clean completion and staged video follow-through.`
    );
  }

  if (priorityActions.length === 0) {
    priorityActions.push(
      "No corrective score action is required from the finalized evidence currently on record. Continue the same completion, staged-video, and issue-resolution practices."
    );
  }

  const summary = scoreOpportunities[0]
    ? `The clearest verified reliability opportunity is ${scoreOpportunities[0].label.toLowerCase()} at ${scoreOpportunities[0].pct}%.`
    : `The finalized evidence currently supports a ${trustScore.totalScorePct}/100 Reliance Trust Score with no corrective score action required.`;

  return {
    summary,
    priorityActions,
    strengths,
    operationalNotes,
  };
}
