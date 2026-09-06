export type VendorJobWorkflowBucket =
  | "active"
  | "manager_review"
  | "moderator_review"
  | "canceled"
  | "private_complete"
  | "public_approved"
  | "rejected";

type VendorJobLike = Record<string, any>;

function normalized(value: unknown): string {
  return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function packageStatus(job: VendorJobLike): string {
  return normalized(job?.serviceVideoPackage?.status);
}

function adminDecision(job: VendorJobLike): string {
  return normalized(job?.adminAuditDecision?.decision);
}

function hasPublicMedia(job: VendorJobLike): boolean {
  return (Array.isArray(job?.videos) ? job.videos : []).some(
    (video: VendorJobLike) => normalized(video?.visibilityStatus) === "PUBLIC",
  );
}

function hasRejectedMedia(job: VendorJobLike): boolean {
  return (Array.isArray(job?.videos) ? job.videos : []).some((video: VendorJobLike) => {
    const moderation = normalized(video?.moderationStatus || video?.status);
    return moderation === "REJECTED";
  });
}

export function preserveVendorDashboardCanonicalEvidence(job: VendorJobLike) {
  return {
    serviceVideoPackage: job?.serviceVideoPackage ?? null,
    adminAuditDecision: job?.adminAuditDecision ?? null,
    packageVisibility: job?.packageVisibility ?? null,
    rejectionReason: job?.rejectionReason ?? null,
    rejectedAt: job?.rejectedAt ?? null,
  };
}

export function hasCanonicalPrivateProof(job: VendorJobLike): boolean {
  return packageStatus(job) === "PRIVATE_APPROVED" && adminDecision(job) === "PASS";
}

export function isTerminalAdminAuditJob(job: VendorJobLike): boolean {
  const decision = adminDecision(job);
  const status = packageStatus(job);
  return (
    decision === "PASS" ||
    decision === "REJECT" ||
    status === "PRIVATE_APPROVED" ||
    status === "ADMIN_REJECTED"
  );
}

export function canExposeVendorJobArchiveAction(job: VendorJobLike): boolean {
  return normalized(job?.status) === "COMPLETED" && !isTerminalAdminAuditJob(job);
}

export function getVendorJobWorkflowBucket(job: VendorJobLike): VendorJobWorkflowBucket {
  const phase = normalized(job?.operationalPhase);
  const status = normalized(job?.status);
  const decision = adminDecision(job);
  const currentPackageStatus = packageStatus(job);

  if (
    decision === "REJECT" ||
    currentPackageStatus === "ADMIN_REJECTED" ||
    phase === "REJECTED" ||
    status === "REJECTED" ||
    hasRejectedMedia(job)
  ) {
    return "rejected";
  }

  // Historical Public records may predate the Core Admin Audit contract.
  if (hasPublicMedia(job)) return "public_approved";
  if (hasCanonicalPrivateProof(job)) return "private_complete";
  if (status === "CANCELED" || status === "CANCELLED") return "canceled";

  if (
    phase === "AWAITING_ADMIN_REVIEW" &&
    currentPackageStatus === "AWAITING_ADMIN_REVIEW" &&
    !decision &&
    job?.canonicalAdminAuditPending !== false
  ) {
    return "moderator_review";
  }

  if (
    phase === "AWAITING_VENDOR_REVIEW" ||
    status === "AWAITING_REVIEW" ||
    status === "AWAITING_MANAGER_REVIEW"
  ) {
    return "manager_review";
  }

  return "active";
}
