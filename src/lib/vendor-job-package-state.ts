import { normalizeVendorJobVideoStage, type VendorJobVideoStage } from "@/lib/vendor-job-video-stages";

const REQUIRED_STAGES: VendorJobVideoStage[] = ["INTRO", "IN_PROGRESS", "COMPLETED"];

type SessionLike = {
  id: string;
  vendorJobVideoStage?: string | null;
  sessionType?: string | null;
  status?: string | null;
  mediaAssets?: Array<{
    id?: string | null;
    createdAt?: Date | string | null;
    moderationStatus?: string | null;
  }>;
};

type StageState = {
  exists: boolean;
  latestModerationStatus: string | null;
};

export type VendorJobPackageState = {
  hasStagedPackage: boolean;
  hasAllRequiredStages: boolean;
  hasAllRequiredStagesApproved: boolean;
  stages: Record<VendorJobVideoStage, StageState>;
};

function sortNewest(a: { createdAt?: Date | string | null }, b: { createdAt?: Date | string | null }) {
  const av = new Date(a.createdAt || 0).getTime();
  const bv = new Date(b.createdAt || 0).getTime();
  return bv - av;
}

export function evaluateVendorJobPackageState(sessions: SessionLike[]): VendorJobPackageState {
  const stageBuckets: Record<VendorJobVideoStage, SessionLike[]> = {
    INTRO: [],
    IN_PROGRESS: [],
    COMPLETED: [],
  };

  for (const session of sessions) {
    const stage = normalizeVendorJobVideoStage(session.vendorJobVideoStage);
    const sessionType = String(session.sessionType || "").trim().toUpperCase();
    if (!stage || sessionType !== "JOB_SERVICE_VIDEO") continue;
    stageBuckets[stage].push(session);
  }

  const stages = REQUIRED_STAGES.reduce((acc, stage) => {
    const sessionsForStage = stageBuckets[stage];
    if (sessionsForStage.length === 0) {
      acc[stage] = { exists: false, latestModerationStatus: null };
      return acc;
    }
    const assets = sessionsForStage
      .flatMap((session) => (Array.isArray(session.mediaAssets) ? session.mediaAssets : []))
      .filter(Boolean)
      .sort(sortNewest);
    const latestAsset = assets[0];
    acc[stage] = {
      exists: Boolean(latestAsset),
      latestModerationStatus: latestAsset?.moderationStatus
        ? String(latestAsset.moderationStatus).trim().toLowerCase()
        : null,
    };
    return acc;
  }, {} as Record<VendorJobVideoStage, StageState>);

  const hasAllRequiredStages = REQUIRED_STAGES.every((stage) => stages[stage].exists);
  const hasAllRequiredStagesApproved =
    hasAllRequiredStages &&
    REQUIRED_STAGES.every((stage) => stages[stage].latestModerationStatus === "approved");

  const hasStagedPackage = REQUIRED_STAGES.some((stage) => stageBuckets[stage].length > 0);

  return {
    hasStagedPackage,
    hasAllRequiredStages,
    hasAllRequiredStagesApproved,
    stages,
  };
}

