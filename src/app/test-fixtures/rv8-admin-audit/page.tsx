import { notFound } from "next/navigation";

import AdminMediaModerationClient from "@/app/admin/media-moderation/AdminMediaModerationClient";

const stages = ["INTRO", "IN_PROGRESS", "COMPLETED"] as const;

export default function Rv8AdminAuditFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();
  const videosByStage = Object.fromEntries(stages.map((stage, index) => [stage, {
    assetId: `audit-asset-${index + 1}`,
    title: `Audit stage ${index + 1}`,
    vendorId: "audit-vendor-1",
    vendorName: "Electro LLC",
    mediaSessionId: `audit-session-${index + 1}`,
    bookingId: "audit-booking-1",
    jobTitle: "Outlet Installation",
    bookingStatus: "COMPLETED",
    clientName: "Reliance Demo Customer",
    vendorJobVideoStageKey: stage,
    vendorJobVideoStageLabel: stage,
    isPrimaryProofStageVideo: stage === "COMPLETED",
    serviceId: "service-1",
    serviceName: "Outlet Installation",
    uploadedByMembershipId: "employee-membership-1",
    employeeName: "Bradley Coopers",
    moderationStatus: "pending_review",
    visibilityStatus: "private",
    archiveStatus: "active",
    moderationReason: null,
    moderatedAt: null,
    createdAt: "2026-08-24T21:00:00.000Z",
    mimeType: "video/webm",
    bytes: "1024",
    previewRef: null,
    downloadRef: null,
    adminDownloadRef: null,
  }]));

  return (
    <AdminMediaModerationClient
      initialAiModerationEnabled={false}
      initialPackages={[{
        packageId: "audit-package-1",
        bookingId: "audit-booking-1",
        jobTitle: "Outlet Installation",
        bookingStatus: "COMPLETED",
        vendorId: "audit-vendor-1",
        vendorName: "Electro LLC",
        clientName: "Reliance Demo Customer",
        serviceName: "Outlet Installation",
        createdAt: "2026-08-24T21:00:00.000Z",
        uploadedByMembershipIds: ["employee-membership-1"],
        moderationStatuses: ["pending_review"],
        visibilityStatuses: ["private"],
        packageReadiness: "READY_FOR_ADMIN_REVIEW",
        packageVersion: 3,
        managerSubmitterName: "Electro LLC Manager",
        managerSubmittedAt: "2026-08-24T21:05:00.000Z",
        managerAttestationHash: "verified-attestation",
        videosByStage,
      }] as any}
    />
  );
}
