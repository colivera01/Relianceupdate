import type {
  DisputeEvalExpectation,
  ModerationEvalExpectation,
  VendorCoachingEvalExpectation,
} from "./evals";

export const AI_EVAL_TEMP_REPORT_REASON =
  "Temporary AI eval case for saved admin assistant quality checks.";

export const AI_EVAL_TEMP_REPORT_RESOLUTION =
  "Internal AI eval case. No external action required.";

export const moderationEvalCases: ReadonlyArray<{
  id: string;
  bookingId: string;
  expectation: ModerationEvalExpectation;
}> = [
  {
    id: "metro-repeated-stage-public-package-1",
    bookingId: "cmpvgqq56002csokkx191m987",
    expectation: {
      expectedDecision: "needs_human_review",
      expectedConfidence: "medium",
      requiredSignalGroups: [
        ["duplicate", "repetitive", "same file size", "identical file size"],
      ],
    },
  },
  {
    id: "metro-repeated-stage-public-package-2",
    bookingId: "cmpv8a5nl0007sob42f84wtp9",
    expectation: {
      expectedDecision: "needs_human_review",
      expectedConfidence: "medium",
      requiredSignalGroups: [
        ["duplicate", "reused", "same file size", "identical file size"],
        ["employee", "attribution", "traceability", "employee label", "worker"],
      ],
    },
  },
  {
    id: "metro-repeated-stage-public-package-3",
    bookingId: "cmpv8dr6a0009sob4v471pwoq",
    expectation: {
      expectedDecision: "needs_human_review",
      expectedConfidence: "medium",
      requiredSignalGroups: [
        ["duplicate", "same file size", "identical file size"],
        ["employee", "attribution", "traceability", "employee label", "worker"],
      ],
    },
  },
] as const;

export const disputeEvalCase: Readonly<{
  id: string;
  reviewId: string;
  createPayload: {
    targetType: "review";
    targetId: string;
    reasonCategory: "privacy";
    reasonDetail: string;
    severity: "medium";
  };
  dismissResolutionNotes: string;
  expectation: DisputeEvalExpectation;
}> = {
  id: "temp-privacy-review-limited-evidence",
  reviewId: "cmpve555g000ysokkgaggvr8s",
  createPayload: {
    targetType: "review",
    targetId: "cmpve555g000ysokkgaggvr8s",
    reasonCategory: "privacy",
    reasonDetail: AI_EVAL_TEMP_REPORT_REASON,
    severity: "medium",
  },
  dismissResolutionNotes: AI_EVAL_TEMP_REPORT_RESOLUTION,
  expectation: {
    expectedNextStep: "needs_admin_review",
    expectedConfidence: ["low", "medium"],
    requiredSignalGroups: [
      ["privacy"],
      ["no linked media", "linked media is not available", "no media available"],
      ["metadata", "limited evidence", "review text only", "one-sided/incomplete"],
    ],
  },
} as const;

export const vendorCoachingEvalCase: Readonly<{
  id: string;
  requestBody: {
    vendorName: string;
    trustScore: {
      scored: true;
      totalScorePct: number;
      explanationOverview: string;
      coverageSummary: string;
      strongestSignals: string[];
      watchItems: string[];
      improvementHints: string[];
      components: {
        workflowCompletion: { pct: number; numerator: number; denominator: number; weightPct: number };
        videoVerification: { pct: number; numerator: number; denominator: number; weightPct: number };
        disputeFree: { pct: number; numerator: number; denominator: number; weightPct: number };
      };
    };
    coachingPlan: {
      summary: string;
      priorityActions: string[];
      strengths: string[];
      operationalNotes: string[];
    };
    dashboardSnapshot: {
      totalBookings: number;
      totalClients: number;
      rating: number;
      ratingCount: number;
      approvedVideos: number;
      pendingVideos: number;
      archivedVideos: number;
      totalVideoAssets: number;
      storagePercentUsed: number;
      completedJobs: number;
      inProgressJobs: number;
      scheduledJobs: number;
      reviewCoverage: number;
    };
  };
  expectation: VendorCoachingEvalExpectation;
}> = {
  id: "metro-vendor-coaching-summary",
  requestBody: {
    vendorName: "Metro Home Care Pros",
    trustScore: {
      scored: true,
      totalScorePct: 98,
      explanationOverview:
        "Workflow completion and dispute-free outcomes are strong while video verification is the main watch item.",
      coverageSummary:
        "Coverage comes from all finalized Reliance activity currently on record.",
      strongestSignals: [
        "Verified workflow completion is perfect.",
        "Dispute-free completion is holding at 100%.",
      ],
      watchItems: ["Video verification is the lowest active signal at 93.75%."],
      improvementHints: ["Review the rejected staged-video package before the next audit submission."],
      components: {
        workflowCompletion: { pct: 100, numerator: 23, denominator: 23, weightPct: 35 },
        videoVerification: { pct: 93.75, numerator: 15, denominator: 16, weightPct: 30 },
        disputeFree: { pct: 100, numerator: 23, denominator: 23, weightPct: 35 },
      },
    },
    coachingPlan: {
      summary:
        "Video verification is the lowest active Reliance Trust Score signal at 93.75%.",
      priorityActions: [
        "Review the rejected staged-video package before the next audit submission.",
      ],
      strengths: [
        "Workflow completion is perfect right now (23 of 23 finalized).",
        "Dispute-free completion is holding at 100%, which means finalized service issues are not dragging the score down.",
      ],
      operationalNotes: [
        "Storage is 82% full. Archive or clean up older internal-only media before storage pressure affects daily operations.",
      ],
    },
    dashboardSnapshot: {
      totalBookings: 16,
      totalClients: 3,
      rating: 4.8,
      ratingCount: 5,
      approvedVideos: 7,
      pendingVideos: 2,
      archivedVideos: 1,
      totalVideoAssets: 10,
      storagePercentUsed: 82,
      completedJobs: 1,
      inProgressJobs: 1,
      scheduledJobs: 0,
      reviewCoverage: 100,
    },
  },
  expectation: {
    expectedConfidence: "medium",
    requiredSignalGroups: [
      ["video verification", "staged-video", "rejected"],
      ["workflow completion", "dispute-free", "video verification"],
      ["storage", "82%"],
    ],
  },
} as const;
