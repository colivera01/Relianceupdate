import { prisma } from "@/server/db";
import { VENDOR_JOB_VIDEO_STAGE_LABELS } from "@/lib/vendor-job-video-stages";
import { REQUIRED_MEDIA_MODERATION_STAGE_KEYS } from "@/lib/admin-media-moderation-packages";
import { launchExcludedVendorIds } from "@/lib/internal-identities";
import {
  resolveCoreAdminAuditPendingPackages,
  type CoreAdminAuditQueueIssue,
} from "@/lib/service-video-admin-audit";

type GetAdminMediaModerationQueueOptions = {
  moderationStatus?: string | null;
  vendorId?: string | null;
  uploadedByMembershipId?: string | null;
  date?: string | null;
  search?: string | null;
  packageId?: string | null;
  includeInternal?: boolean;
  limit?: number;
};

export type AdminMediaModerationQueueResult = {
  packages: any[];
  diagnostics: CoreAdminAuditQueueIssue[];
  totalPending: number;
};

function toQueuePackage(candidate: any) {
  const assetById = new Map(
    candidate.mediaAssets.map((asset: any) => [String(asset.id), asset]),
  );
  const videosByStage = Object.fromEntries(
    candidate.packageStages.map((stage: any) => {
      const asset: any = assetById.get(String(stage.mediaAssetId));
      const label = VENDOR_JOB_VIDEO_STAGE_LABELS[stage.stage as keyof typeof VENDOR_JOB_VIDEO_STAGE_LABELS];
      return [stage.stage, {
        assetId: asset.id,
        title: `${candidate.booking.title || candidate.booking.service?.name || "Service Video"}: ${label}`,
        vendorId: candidate.booking.vendorId,
        vendorName: candidate.booking.vendor?.businessName || candidate.booking.vendor?.name || null,
        mediaSessionId: asset.mediaSessionId || null,
        bookingId: candidate.booking.id,
        jobTitle: candidate.booking.title || null,
        bookingStatus: candidate.booking.status || null,
        clientName: candidate.booking.clientName || candidate.booking.user?.name || null,
        vendorJobVideoStageKey: stage.stage,
        vendorJobVideoStageLabel: label,
        isPrimaryProofStageVideo: stage.stage === "COMPLETED",
        serviceId: candidate.booking.service?.id || null,
        serviceName: candidate.booking.service?.name || null,
        uploadedByMembershipId: asset.uploadedByMembershipId || null,
        employeeName: asset.mediaSession?.employee?.name || null,
        moderationStatus: asset.moderationStatus,
        visibilityStatus: asset.visibilityStatus,
        archiveStatus: asset.archiveStatus,
        moderationReason: asset.moderationReason,
        moderatedAt: asset.moderatedAt,
        createdAt: asset.createdAt,
        mimeType: asset.mimeType,
        bytes: typeof asset.bytes === "bigint" ? asset.bytes.toString() : String(asset.bytes || "0"),
        audioExpected: Boolean(asset.audioExpected),
        audioPresence: String(asset.audioPresence || "LEGACY_UNKNOWN"),
        audioTrackCount: asset.audioTrackCount == null ? null : Number(asset.audioTrackCount),
        audioCodec: asset.audioCodec || null,
        audioEvidenceVersion: Number(asset.audioEvidenceVersion || 1),
        previewRef: asset.blobUrl || null,
        downloadRef: `/api/vendors/${candidate.booking.vendorId}/media/${asset.id}/download`,
        adminDownloadRef: `/api/admin/media/${asset.id}/download`,
      }];
    }),
  ) as Record<string, any>;
  const videos = REQUIRED_MEDIA_MODERATION_STAGE_KEYS.map((stage) => videosByStage[stage]);
  return {
    packageId: candidate.package.id,
    bookingId: candidate.booking.id,
    jobTitle: candidate.booking.title || candidate.booking.service?.name || "Service Video",
    bookingStatus: candidate.booking.status || null,
    vendorId: candidate.booking.vendorId,
    vendorName: candidate.booking.vendor?.businessName || candidate.booking.vendor?.name || null,
    clientName: candidate.booking.clientName || candidate.booking.user?.name || null,
    serviceName: candidate.booking.service?.name || null,
    createdAt: candidate.managerDecision.decidedAt || candidate.package.submittedAt || null,
    uploadedByMembershipIds: Array.from(new Set(videos.map((video) => String(video.uploadedByMembershipId || "")).filter(Boolean))),
    moderationStatuses: Array.from(new Set(videos.map((video) => String(video.moderationStatus || "pending_review")))),
    visibilityStatuses: Array.from(new Set(videos.map((video) => String(video.visibilityStatus || "private")))),
    packageReadiness: "READY_FOR_ADMIN_REVIEW",
    packageVersion: candidate.package.version,
    packageHash: candidate.package.packageHash,
    managerDecisionId: candidate.managerDecision.id,
    managerSubmitterName:
      candidate.managerMembership?.user?.name ||
      candidate.managerMembership?.user?.email ||
      "Vendor manager",
    managerSubmittedAt: candidate.managerDecision.decidedAt,
    managerAttestationHash: candidate.managerDecision.attestationHash,
    adminAuditEvidenceVersion: candidate.package.auditEvidenceVersion,
    videosByStage,
    audioAudit: candidate.audioAudit,
    recordingScope:
      candidate.recordingAssessmentInterpretation?.kind === "SIMPLIFIED_V1"
        ? {
            contractVersion: candidate.recordingAssessmentInterpretation.contractVersion,
            siteControl: candidate.recordingAssessmentInterpretation.canonical.siteControl,
            intentionalParticipantPlan: candidate.recordingAssessmentInterpretation.canonical.intentionalParticipantPlan,
            recordingBoundary: candidate.recordingAssessmentInterpretation.canonical.recordingBoundary,
            prohibitedConditions: candidate.recordingAssessmentInterpretation.canonical.prohibitedConditions,
          }
        : null,
  };
}

export async function getAdminMediaModerationQueueResult(
  options: GetAdminMediaModerationQueueOptions = {},
): Promise<AdminMediaModerationQueueResult> {
  const limit = Math.min(Math.max(Number(options.limit || 30) || 30, 1), 200);
  const excludedVendorIds = options.includeInternal === true ? [] : launchExcludedVendorIds();
  const resolved = await resolveCoreAdminAuditPendingPackages(prisma as any, {
    vendorId: String(options.vendorId || "").trim() || null,
  });
  let packages = resolved.candidates
    .filter((candidate) => !excludedVendorIds.includes(String(candidate.booking.vendorId)))
    .map(toQueuePackage);
  const diagnostics = resolved.issues.filter(
    (issue) => !excludedVendorIds.includes(String(issue.vendorId)),
  );

  const totalPending = packages.length;
  const exactPackageId = String(options.packageId || "").trim();
  if (exactPackageId) packages = packages.filter((item) => item.packageId === exactPackageId);
  const uploader = String(options.uploadedByMembershipId || "").trim();
  if (uploader) packages = packages.filter((item) => item.uploadedByMembershipIds.includes(uploader));
  const moderation = String(options.moderationStatus || "").trim().toLowerCase();
  if (moderation) packages = packages.filter((item) => item.moderationStatuses.some((status: string) => String(status).toLowerCase() === moderation));
  const date = String(options.date || "").trim();
  if (date) packages = packages.filter((item) => String(new Date(item.managerSubmittedAt).toISOString()).startsWith(date));
  const search = String(options.search || "").trim().toLowerCase();
  if (search) {
    packages = packages.filter((item) => [item.jobTitle, item.clientName, item.vendorName, item.bookingStatus, item.serviceName, item.packageId]
      .some((value) => String(value || "").toLowerCase().includes(search)));
  }
  return {
    packages: packages.slice(0, limit),
    diagnostics: diagnostics.filter((issue) => !exactPackageId || issue.packageId === exactPackageId),
    totalPending,
  };
}

export async function getAdminMediaModerationQueue(
  options: GetAdminMediaModerationQueueOptions = {},
) {
  return (await getAdminMediaModerationQueueResult(options)).packages;
}
