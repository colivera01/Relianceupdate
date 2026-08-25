import { prisma } from "@/server/db";
import {
  resolveVendorJobVideoStageFromSession,
  VENDOR_JOB_VIDEO_STAGE_LABELS,
} from "@/lib/vendor-job-video-stages";
import {
  REQUIRED_MEDIA_MODERATION_STAGE_KEYS,
  buildCompleteMediaModerationPackages,
} from "@/lib/admin-media-moderation-packages";
import { launchExcludedVendorIds } from "@/lib/internal-identities";
import { getRelianceOps, parseCustomerMetadataRecord } from "@/lib/vendor-job-operational-phase";
import { loadCoreAdminAuditCandidate } from "@/lib/service-video-admin-audit";

type GetAdminMediaModerationQueueOptions = {
  moderationStatus?: string | null;
  vendorId?: string | null;
  uploadedByMembershipId?: string | null;
  date?: string | null;
  search?: string | null;
  includeInternal?: boolean;
  limit?: number;
};

export async function getAdminMediaModerationQueue(
  options: GetAdminMediaModerationQueueOptions = {}
) {
  const moderationStatus = String(options.moderationStatus || "").trim();
  const vendorId = String(options.vendorId || "").trim();
  const uploadedByMembershipId = String(options.uploadedByMembershipId || "").trim();
  const date = String(options.date || "").trim();
  const search = String(options.search || "").trim();
  const includeInternal = options.includeInternal === true;
  const limit = Math.min(Math.max(Number(options.limit || 30) || 30, 1), 200);
  const rawAssetTake = Math.min(
    limit * REQUIRED_MEDIA_MODERATION_STAGE_KEYS.length * 3,
    1000
  );

  const excludedVendorIds = includeInternal ? [] : launchExcludedVendorIds();
  const where: any = {
    deletedAt: null,
    mediaSession: {
      is: {
        bookingId: { not: null },
        vendorJobVideoStage: {
          in: [...REQUIRED_MEDIA_MODERATION_STAGE_KEYS],
        },
      },
    },
  };

  if (vendorId) {
    if (!includeInternal && excludedVendorIds.includes(vendorId)) {
      return [];
    }
    where.vendorId = vendorId;
  } else if (excludedVendorIds.length > 0) {
    where.vendorId = { notIn: excludedVendorIds };
  }

  if (uploadedByMembershipId) where.uploadedByMembershipId = uploadedByMembershipId;
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      where.createdAt = { gte: start, lte: end };
    }
  }

  const assets = await (prisma as any).mediaAsset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      vendorId: true,
      mediaSessionId: true,
      uploadedByMembershipId: true,
      moderationStatus: true,
      visibilityStatus: true,
      archiveStatus: true,
      moderationReason: true,
      moderatedAt: true,
      createdAt: true,
      mimeType: true,
      bytes: true,
      audioExpected: true,
      audioPresence: true,
      audioTrackCount: true,
      audioCodec: true,
      audioEvidenceVersion: true,
      blobUrl: true,
      vendor: {
        select: {
          id: true,
          name: true,
          businessName: true,
        },
      },
      mediaSession: {
        select: {
          serviceId: true,
          sessionType: true,
          vendorJobVideoStage: true,
          title: true,
          booking: {
            select: {
              id: true,
              title: true,
              clientName: true,
              status: true,
              customerMetadata: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
            },
          },
          employee: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    take: rawAssetTake,
  });

  const normalized = assets.map((asset: any) => {
    const session = asset.mediaSession;
    const title = session?.title || session?.booking?.title || "Untitled Media";
    const stageKey = resolveVendorJobVideoStageFromSession({
      vendorJobVideoStage: session?.vendorJobVideoStage,
      sessionType: session?.sessionType,
    });
    const vendorJobVideoStageLabel =
      stageKey === "LEGACY_OTHER"
        ? "Legacy / unspecified"
        : VENDOR_JOB_VIDEO_STAGE_LABELS[stageKey];
    const isPrimaryProofStageVideo = stageKey === "COMPLETED";
    const bookingMetadata = parseCustomerMetadataRecord(session?.booking?.customerMetadata || null);
    const bookingOperationalPhase = getRelianceOps(bookingMetadata).operational_phase || null;

    return {
      assetId: asset.id,
      title,
      vendorId: asset.vendorId,
      vendorName: asset.vendor?.businessName || asset.vendor?.name || null,
      mediaSessionId: asset.mediaSessionId || null,
      bookingId: session?.booking?.id || null,
      jobTitle: session?.booking?.title || null,
      bookingStatus: session?.booking?.status || null,
      bookingOperationalPhase,
      clientName: session?.booking?.clientName || null,
      vendorJobVideoStageKey: stageKey,
      vendorJobVideoStageLabel,
      isPrimaryProofStageVideo,
      serviceId: session?.service?.id || session?.serviceId || null,
      serviceName: session?.service?.name || null,
      uploadedByMembershipId: asset.uploadedByMembershipId || null,
      employeeName: session?.employee?.name || null,
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
      downloadRef: `/api/vendors/${asset.vendorId}/media/${asset.id}/download`,
      adminDownloadRef: `/api/admin/media/${asset.id}/download`,
    };
  });

  const completePackages = buildCompleteMediaModerationPackages(normalized);
  const launchFacingPackages = includeInternal
    ? completePackages
    : completePackages.filter(
        (pack: any) => !excludedVendorIds.includes(String(pack.vendorId || "").trim())
      );
  const managerSubmittedPackages = launchFacingPackages.filter((pack: any) => {
    const bookingStatus = String(pack.bookingStatus || "").trim().toUpperCase();
    const phase = String(
      pack.videosByStage?.COMPLETED?.bookingOperationalPhase ||
        pack.videosByStage?.INTRO?.bookingOperationalPhase ||
        pack.videosByStage?.IN_PROGRESS?.bookingOperationalPhase ||
        ""
    ).trim().toUpperCase();
    return bookingStatus === "COMPLETED" && phase === "AWAITING_ADMIN_REVIEW";
  });

  const managerApprovedPackages = (
    await Promise.all(
      managerSubmittedPackages.map(async (pack: any) => {
        try {
          const candidate = await loadCoreAdminAuditCandidate(prisma as any, pack.bookingId);
          const exactAssetIds = new Set(
            candidate.packageStages.map((stage) => String(stage.mediaAssetId)),
          );
          const displayedAssetIds = new Set(
            REQUIRED_MEDIA_MODERATION_STAGE_KEYS.map((stage) =>
              String(pack.videosByStage?.[stage]?.assetId || ""),
            ),
          );
          if (
            exactAssetIds.size !== REQUIRED_MEDIA_MODERATION_STAGE_KEYS.length ||
            displayedAssetIds.size !== REQUIRED_MEDIA_MODERATION_STAGE_KEYS.length ||
            Array.from(exactAssetIds).some((assetId) => !displayedAssetIds.has(assetId))
          ) {
            return null;
          }
          const managerSubmitter = await (prisma as any).user.findUnique({
            where: { id: candidate.managerDecision.managerUserId },
            select: { name: true, email: true },
          });
          return {
            ...pack,
            packageId: candidate.package.id,
            packageVersion: candidate.package.version,
            packageHash: candidate.package.packageHash,
            managerDecisionId: candidate.managerDecision.id,
            managerSubmitterName:
              managerSubmitter?.name || managerSubmitter?.email || "Vendor manager",
            managerSubmittedAt: candidate.managerDecision.decidedAt,
            managerAttestationHash: candidate.managerDecision.attestationHash,
            adminAuditEvidenceVersion: candidate.package.auditEvidenceVersion,
            audioAudit: candidate.audioAudit,
          };
        } catch {
          return null;
        }
      }),
    )
  ).filter(Boolean);

  const filteredByStatus = moderationStatus
    ? managerApprovedPackages.filter((pack) =>
        pack.moderationStatuses.some(
          (status: string) =>
            String(status || "").toLowerCase() === moderationStatus.toLowerCase()
        )
      )
    : managerApprovedPackages;

  const filteredBySearch = search
    ? filteredByStatus.filter((item: any) => {
        const q = search.toLowerCase();
        return (
          String(item.jobTitle || "").toLowerCase().includes(q) ||
          String(item.clientName || "").toLowerCase().includes(q) ||
          String(item.vendorName || "").toLowerCase().includes(q) ||
          String(item.bookingStatus || "").toLowerCase().includes(q) ||
          String(item.serviceName || "").toLowerCase().includes(q) ||
          REQUIRED_MEDIA_MODERATION_STAGE_KEYS.some((stage) =>
            String(item.videosByStage?.[stage]?.title || "").toLowerCase().includes(q)
          )
        );
      })
    : filteredByStatus;

  return filteredBySearch.slice(0, limit);
}
