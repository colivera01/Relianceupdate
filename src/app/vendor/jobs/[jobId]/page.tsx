"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, PlayCircle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useVendorProfile } from "@/hooks/useVendorProfile";
import { getClientSessionHeaders } from "@/lib/client-session";
import { ManagerWorkRecordAttestation } from "@/components/vendor/ManagerWorkRecordAttestation";
import { PackageVisibilityCard } from "@/components/service-video/PackageVisibilityCard";
import { resolveVendorJobLifecyclePresentation } from "@/lib/vendor-job-lifecycle-presentation";
import { coreAdminAuditRejectionCategoryLabel } from "@/lib/core-admin-audit-categories";
import {
  STAGE_VIDEO_MAX_DURATION_SECONDS,
  formatStageVideoDuration,
  getStageVideoLimitCopy,
  getVideoFileDurationSeconds,
  isOverStageVideoLimit,
} from "@/lib/stage-video-guidance";
import { resolveManagerStageAssetState } from "@/lib/service-video-manager-stage-state";
import { formatRelianceDateTime } from "@/lib/reliance-date-time";
import {
  dateAndTimeInZone,
  DEFAULT_SERVICE_TIME_ZONE,
  zonedDateTimeToUtc,
} from "@/lib/booking-schedule";

type JobLike = {
  id: string;
  title?: string;
  client?: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerNotes?: string | null;
  requestNotes?: string | null;
  status?: string;
  operationalPhase?: string;
  source?: string;
  scheduleMode?: 'CUSTOMER_SELECTS_TIME' | 'VENDOR_TO_PROPOSE' | string;
  serviceTimeZone?: string | null;
  service_time_zone?: string | null;
  requestedFor?: string | null;
  serviceAddress?: string | null;
  requestLifecycle?: {
    state?: string | null;
    requestedAt?: string | null;
    requested_at?: string | null;
    requestedScheduledFor?: string | null;
    requested_scheduled_for?: string | null;
    respondedAt?: string | null;
    responded_at?: string | null;
    responseReason?: string | null;
    response_reason?: string | null;
    proposedScheduledFor?: string | null;
    proposed_scheduled_for?: string | null;
    customerRespondedAt?: string | null;
    customer_responded_at?: string | null;
    customerResponseReason?: string | null;
    customer_response_reason?: string | null;
  } | null;
  date?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  assignedEmployees?: string[];
  serviceName?: string;
  serviceType?: string;
  notes?: Array<{ text?: string }>;
  rejectionReason?: string | null;
  serviceVideoPackage?: {
    id: string;
    version: number;
    status: string;
    submittedAt?: string | null;
    stageEvidence?: Array<{
      stage: string;
      stageEvidenceId: string;
      stageVersion: number;
      mediaAssetId: string;
    }>;
    audioExpected?: boolean;
  } | null;
  serviceVideoPackageHistory?: Array<{
    id: string;
    version: number;
    status: string;
    isCurrent: boolean;
    submittedAt?: string | null;
  }>;
  managerReviewHistory?: Array<{
    id: string;
    packageId: string;
    packageVersion?: number | null;
    decision: string;
    targetedStages: string[];
    reason?: string | null;
    decidedAt?: string | null;
  }>;
  adminAuditDecision?: {
    decision: string;
    rejectionCategory?: string | null;
    reason?: string | null;
    decidedAt?: string | null;
    packageVersion?: number | null;
  } | null;
  rejectedAt?: string | null;
  cancellation?: {
    reason?: string | null;
    canceledAt?: string | null;
    canceledBy?: string | null;
    canceledByUserId?: string | null;
  } | null;
  recordingCompliance?: {
    location?: string | null;
    permissionRequired?: boolean;
    permissionStatus?: string | null;
    serviceOrderReleasedAt?: string | null;
    serviceOrderCurrent?: boolean;
    serviceOrderAnyReleased?: boolean;
    managerAttestationRequiredForRelease?: boolean;
    audioAllowed?: boolean;
    employeeParticipation?: {
      required: boolean;
      complete: boolean;
      status: "NOT_REQUIRED" | "ALLOWED" | "REQUIRED" | "DECLINED" | "STALE";
      requiredMembershipIds: string[];
      missingMembershipIds: string[];
      declinedMembershipIds: string[];
      staleMembershipIds: string[];
      inactiveMembershipIds: string[];
    } | null;
  } | null;
  packageVisibility?: {
    state: string;
    decision?: string | null;
    decidedAt?: string | null;
    publicReviewStatus?: string | null;
    privateProofReleased?: boolean;
  } | null;
  recordingAssessment?: {
    id: string;
    generation: number;
    locationType: string;
    siteControl?: string;
    intentionalParticipantPlan?: string;
    recordingBoundary?: string;
    prohibitedConditions?: string[];
    propertyScope?: string;
    peopleScope?: string;
    frameControl?: string;
    permissionRequired: boolean;
    scopeHash: string;
    audioAllowed: boolean;
  } | null;
};

type SessionDetails = {
  id: string;
  vendorJobVideoStage?: string | null;
  createdAt?: string | null;
  mediaAssets?: Array<{
    id: string;
    createdAt?: string | null;
    blobUrl?: string | null;
    moderationStatus?: string | null;
    title?: string | null;
    audioExpected?: boolean;
    audioPresence?: string | null;
    audioEvidenceVersion?: number;
    uploadState?: string | null;
  }>;
};

const STAGE_ORDER = [
  { key: "INTRO", label: "Starting Condition", cue: "Show the starting condition before work begins." },
  { key: "IN_PROGRESS", label: "Work in Progress", cue: "Show active progress while the service is underway." },
  { key: "COMPLETED", label: "Final Result", cue: "Show the final result clearly." },
] as const;

type ReviewStage = (typeof STAGE_ORDER)[number]["key"];

function normalizeStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "CONFIRMED") return "IN_PROGRESS";
  return normalized;
}

function serviceTimeZoneForJob(job: JobLike | null): string {
  return String(job?.serviceTimeZone || job?.service_time_zone || DEFAULT_SERVICE_TIME_ZONE).trim()
    || DEFAULT_SERVICE_TIME_ZONE;
}

function localDateTimeInputMin(timeZone: string): string {
  const { date, time } = dateAndTimeInZone(new Date(Date.now() + 60_000), timeZone);
  return `${date}T${time}`;
}

function proposedDateTimeToUtc(value: string, timeZone: string): Date | null {
  const [date = '', time = ''] = String(value || '').split('T');
  return zonedDateTimeToUtc({ date, time, timeZone });
}

function lifecycleBadgeClass(tone: string) {
  if (tone === "green") return "bg-emerald-100 text-emerald-800";
  if (tone === "blue") return "bg-blue-100 text-blue-800";
  if (tone === "red") return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800";
}

function readableEvidenceValue(value: string | null | undefined) {
  const normalized = String(value || "").trim().replaceAll("_", " ").toLowerCase();
  return normalized ? normalized.replace(/^\w/, (letter) => letter.toUpperCase()) : "Not recorded";
}

function isRealAzureBlobHostUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase().endsWith(".blob.core.windows.net");
  } catch {
    return false;
  }
}

function stageVideoTitle(stageKey: string) {
  const stage = STAGE_ORDER.find((item) => item.key === stageKey);
  return stage ? `${stage.label} Video` : "Stage Video";
}

function stageListLabel(stageKeys: string[]) {
  const labels = stageKeys
    .map((key) => STAGE_ORDER.find((stage) => stage.key === String(key).toUpperCase())?.label)
    .filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : "selected stage";
}

function actionErrorMessage(payload: any, fallback: string) {
  const message = String(payload?.error || payload?.message || fallback).trim();
  const code = String(payload?.code || "").trim();
  const details = typeof payload?.details === "string" ? payload.details.trim() : "";
  return [message, code ? `Code: ${code}` : "", details && details !== message ? details : ""]
    .filter(Boolean)
    .join(" ");
}

export default function VendorJobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = String(params?.jobId || "").trim();
  const { user } = useAuth();
  const { data: profile, resolvedVendorId, loading: vendorProfileLoading } = useVendorProfile();
  const vendorId = String(profile?.id || resolvedVendorId || "").trim();
  const userId =
    typeof user?.id === "string"
      ? user.id.trim()
      : typeof user?.id === "number"
      ? String(user.id)
      : user?.id && typeof user.id === "object" && typeof (user.id as any).id === "string"
      ? String((user.id as any).id).trim()
      : user?.id && typeof user.id === "object" && typeof (user.id as any).id === "number"
      ? String((user.id as any).id)
      : "";

  const [job, setJob] = useState<JobLike | null>(null);
  const [sessions, setSessions] = useState<SessionDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");
  const [auditConfirmOpen, setAuditConfirmOpen] = useState(false);
  const [auditAcknowledged, setAuditAcknowledged] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionStages, setCorrectionStages] = useState<ReviewStage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingStage, setUploadingStage] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [playbackTitle, setPlaybackTitle] = useState("");
  const [playbackError, setPlaybackError] = useState("");
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const [playbackStage, setPlaybackStage] = useState<ReviewStage | null>(null);
  const [playbackCompleted, setPlaybackCompleted] = useState(false);
  const [reviewedStages, setReviewedStages] = useState<ReviewStage[]>([]);
  const [resendingCompletedOrder, setResendingCompletedOrder] = useState(false);
  const [serviceRequestDialog, setServiceRequestDialog] = useState<'DECLINE' | 'COUNTER' | null>(null);
  const [serviceRequestReason, setServiceRequestReason] = useState('');
  const [serviceRequestProposedAt, setServiceRequestProposedAt] = useState('');
  const [serviceRequestSubmitting, setServiceRequestSubmitting] = useState(false);
  const serviceRequestIdempotencyRef = useRef<{ action: string; requestId: string } | null>(null);
  const [resolvingPlaybackStage, setResolvingPlaybackStage] = useState<string | null>(null);
  const headers = useMemo(() => getClientSessionHeaders(userId), [userId]);
  const effectiveVendorId = String(vendorId || "").trim();
  const normalizedStatus = normalizeStatus(job?.status);
  const isManager = role === "MANAGER";
  const isEmployee = role === "EMPLOYEE";
  const correctionPending = String(job?.serviceVideoPackage?.status || "").toUpperCase() === "CORRECTION_REQUESTED";
  const lastAutoLoadKeyRef = useRef<string>("");
  const serviceRequestState = String(
    job?.requestLifecycle?.state ||
      (String(job?.source || '').toLowerCase() === 'customer_booking' && normalizedStatus === 'PENDING' ? 'REQUESTED' : '')
  ).trim().toUpperCase();
  const serviceRequestResponseReason = String(
    job?.requestLifecycle?.responseReason || job?.requestLifecycle?.response_reason || ''
  ).trim();
  const serviceRequestProposedFor = String(
    job?.requestLifecycle?.proposedScheduledFor || job?.requestLifecycle?.proposed_scheduled_for || ''
  ).trim();
  const serviceRequestTimeZone = serviceTimeZoneForJob(job);

  const stageMap = useMemo(() => {
    const out = new Map<string, SessionDetails | null>();
    for (const stage of STAGE_ORDER) out.set(stage.key, null);
    for (const s of sessions) {
      const stage = String(s.vendorJobVideoStage || "").trim().toUpperCase();
      if (!out.has(stage)) continue;
      const current = out.get(stage);
      if (!current) {
        out.set(stage, s);
        continue;
      }
      const currentTs = new Date(String(current.createdAt || 0)).getTime();
      const nextTs = new Date(String(s.createdAt || 0)).getTime();
      if (nextTs >= currentTs) out.set(stage, s);
    }
    return out;
  }, [sessions]);

  const packageStageMap = useMemo(() => {
    const out = new Map<
      string,
      NonNullable<NonNullable<JobLike["serviceVideoPackage"]>["stageEvidence"]>[number]
    >();
    for (const stage of job?.serviceVideoPackage?.stageEvidence || []) {
      const key = String(stage?.stage || "").trim().toUpperCase();
      if (key) out.set(key, stage);
    }
    return out;
  }, [job?.serviceVideoPackage?.stageEvidence]);

  const reviewableStageKeys = useMemo(
    () => STAGE_ORDER.filter((stage) => resolveManagerStageAssetState(stageMap.get(stage.key)).saved).map((stage) => stage.key),
    [stageMap],
  );
  const allStagesReviewed = reviewableStageKeys.length === STAGE_ORDER.length &&
    reviewableStageKeys.every((stage) => reviewedStages.includes(stage));

  useEffect(() => {
    setReviewedStages([]);
    setPlaybackStage(null);
    setPlaybackCompleted(false);
  }, [job?.serviceVideoPackage?.id, job?.serviceVideoPackage?.version]);

  const nextMissingStage = useMemo(() => {
    for (const stage of STAGE_ORDER) {
      const stageSession = stageMap.get(stage.key);
      const hasUpload = resolveManagerStageAssetState(stageSession).saved;
      if (!hasUpload) return stage.key;
    }
    return null;
  }, [stageMap]);

  const allStagesExist = !nextMissingStage;
  const canSubmitForManagerReview =
    allStagesExist &&
    (isEmployee || isManager) &&
    ["PENDING", "IN_PROGRESS"].includes(normalizedStatus);
  const canManagerReview = isManager && normalizedStatus === "AWAITING_REVIEW";
  const lifecycle = useMemo(() => {
    const nextStage = STAGE_ORDER.find((stage) => stage.key === nextMissingStage)?.label || "next stage";
    return resolveVendorJobLifecyclePresentation({
      status: normalizedStatus,
      operationalPhase: job?.operationalPhase,
      rejectionReason: job?.rejectionReason,
      adminAuditDecision: job?.adminAuditDecision?.decision,
      adminAuditRejectionCategory: job?.adminAuditDecision?.rejectionCategory,
      adminAuditRejectionReason: job?.adminAuditDecision?.reason,
      adminAuditDecidedAt: job?.adminAuditDecision?.decidedAt,
      correctionPending,
      locationSelected: Boolean(job?.recordingCompliance?.location),
      permissionRequired: job?.recordingCompliance?.permissionRequired === true,
      permissionState: job?.recordingCompliance?.permissionStatus,
      hasCustomerContact: Boolean(job?.customerEmail || job?.customerPhone),
      assigned: Boolean(job?.assignedEmployees?.length),
      allVideosPresent: allStagesExist,
      nextStageLabel: nextStage,
      serviceOrderSent: job?.recordingCompliance?.serviceOrderCurrent === true,
      consentRecipientLabel: job?.customerEmail || job?.customerPhone || "the customer",
    });
  }, [allStagesExist, correctionPending, job, nextMissingStage, normalizedStatus]);

  const load = async () => {
    if (!jobId) {
      setLoading(false);
      setLoadError("Missing job id.");
      return;
    }
    if (vendorProfileLoading) {
      return;
    }
    if (!effectiveVendorId) {
      setLoading(false);
      setLoadError("Vendor context unavailable. Refresh and try again.");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const contextRes = await fetch("/api/vendor/context", {
        method: "GET",
        headers,
        cache: "no-store",
      });
      const contextJson = await contextRes.json().catch(() => ({}));
      setRole(String(contextJson?.role || "").trim().toUpperCase());

      const jobRes = await fetch(`/api/vendors/${effectiveVendorId}/jobs/${encodeURIComponent(jobId)}`, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      const jobJson = await jobRes.json().catch(() => ({}));
      if (!jobRes.ok || !jobJson?.job) {
        throw new Error(String(jobJson?.error || "Failed to load job detail"));
      }
      setJob(jobJson.job as JobLike);

      const sessionsRes = await fetch(
        `/api/vendors/${effectiveVendorId}/media/sessions?bookingId=${encodeURIComponent(jobId)}`,
        { method: "GET", headers, cache: "no-store" }
      );
      const sessionsJson = await sessionsRes.json().catch(() => ({}));
      if (!sessionsRes.ok) throw new Error(String(sessionsJson?.error || "Failed to load video sessions"));
      const baseSessions = Array.isArray(sessionsJson?.sessions) ? sessionsJson.sessions : [];
      const details = await Promise.all(
        baseSessions.map(async (session: { id?: string }) => {
          const sessionId = String(session?.id || "").trim();
          if (!sessionId) return null;
          const detailRes = await fetch(`/api/vendors/${effectiveVendorId}/media/sessions/${sessionId}`, {
            method: "GET",
            headers,
            cache: "no-store",
          });
          const detailJson = await detailRes.json().catch(() => ({}));
          if (!detailRes.ok) return null;
          return detailJson?.session as SessionDetails;
        })
      );
      setSessions(details.filter((d): d is SessionDetails => Boolean(d)));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load job detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      setLoadError("Missing job id.");
      return;
    }
    if (vendorProfileLoading || !effectiveVendorId) {
      return;
    }
    const loadKey = `${effectiveVendorId}:${jobId}`;
    if (lastAutoLoadKeyRef.current === loadKey) {
      return;
    }
    lastAutoLoadKeyRef.current = loadKey;
    void load();
  }, [effectiveVendorId, jobId, vendorProfileLoading]);

  const watchStage = async (stageKey: ReviewStage) => {
    if (!effectiveVendorId) return;
    const session = stageMap.get(stageKey);
    const asset = session?.mediaAssets?.[0];
    if (!asset?.id) return;
    try {
      if (resolvingPlaybackStage === stageKey) return;
      setResolvingPlaybackStage(stageKey);
      setPlaybackError("");
      const res = await fetch(
        `/api/vendors/${effectiveVendorId}/media/${encodeURIComponent(asset.id)}/download`,
        { method: "GET", headers, cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      const downloadUrl = String(json?.downloadUrl || json?.url || "").trim();
      if (!res.ok || !downloadUrl || !isRealAzureBlobHostUrl(downloadUrl)) {
        throw new Error(String(json?.error || "Video preview could not be loaded."));
      }
      setPlaybackUrl(downloadUrl);
      setPlaybackTitle(stageVideoTitle(stageKey));
      setPlaybackStage(stageKey);
      setPlaybackCompleted(false);
      setPlaybackOpen(true);
    } catch (e) {
      setPlaybackError(e instanceof Error ? e.message : "Unable to open this video.");
    } finally {
      setResolvingPlaybackStage(null);
    }
  };

  const markPlaybackReviewed = () => {
    if (!playbackStage) return;
    setPlaybackCompleted(true);
    setReviewedStages((current) => Array.from(new Set([...current, playbackStage])));
  };

  const adjacentPlaybackStage = (direction: -1 | 1): ReviewStage | null => {
    if (!playbackStage) return null;
    const currentIndex = STAGE_ORDER.findIndex((stage) => stage.key === playbackStage);
    const next = STAGE_ORDER[currentIndex + direction];
    if (!next) return null;
    return resolveManagerStageAssetState(stageMap.get(next.key)).saved ? next.key : null;
  };

  const uploadStage = async (stageKey: string, file: File, durationSeconds: number) => {
    if (!effectiveVendorId || !jobId) return;
    setUploadingStage(stageKey);
    setActionMessage(null);
    setActionError(null);
    try {
      const sessionRes = await fetch(`/api/vendors/${effectiveVendorId}/media/sessions`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: jobId,
          vendorJobVideoStage: stageKey,
          sessionType: "JOB_SERVICE_VIDEO",
          replaceExisting: true,
          locationContext: "business",
        }),
      });
      const sessionJson = await sessionRes.json().catch(() => ({}));
      if (!sessionRes.ok || !sessionJson?.session?.id) {
        throw new Error(String(sessionJson?.message || sessionJson?.error || "Failed to create stage session"));
      }
      const mediaSessionId = String(sessionJson.session.id);

      const initRes = await fetch(`/api/vendors/${effectiveVendorId}/media/upload/init`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          expectedBytes: file.size,
          mimeType: file.type || "video/mp4",
        }),
      });
      const initJson = await initRes.json().catch(() => ({}));
      if (!initRes.ok || !initJson?.sasUrl || !initJson?.assetId || !initJson?.blobKey) {
        throw new Error(String(initJson?.error || "Failed to initialize upload"));
      }

      const putRes = await fetch(String(initJson.sasUrl), {
        method: "PUT",
        headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": file.type || "video/mp4" },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      const completeRes = await fetch(`/api/vendors/${effectiveVendorId}/media/upload/complete`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: initJson.assetId,
          blobKey: initJson.blobKey,
          blobUrl: null,
          bytes: file.size,
          mimeType: file.type || "video/mp4",
          mediaSessionId,
          durationSeconds,
        }),
      });
      const completeJson = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok || !completeJson?.success) {
        throw new Error(String(completeJson?.error || "Failed to finalize upload"));
      }

      const stageRes = await fetch(`/api/employee/jobs/${jobId}/stage`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ stage: stageKey }),
      });
      const stageJson = await stageRes.json().catch(() => ({}));
      if (!stageRes.ok || !stageJson?.success) {
        throw new Error(String(stageJson?.error || "Failed to mark stage complete"));
      }

      setActionMessage(`${stageKey} stage uploaded.`);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to upload stage video");
    } finally {
      setUploadingStage(null);
    }
  };

  const validateAndUploadStage = async (stageKey: string, file: File) => {
    setActionMessage(null);
    try {
      const durationSeconds = await getVideoFileDurationSeconds(file);
      if (isOverStageVideoLimit(durationSeconds)) {
        setActionError(
          `Clip is ${formatStageVideoDuration(durationSeconds)}. Retake a ${formatStageVideoDuration(STAGE_VIDEO_MAX_DURATION_SECONDS)} max video for this stage.`
        );
        return;
      }
      await uploadStage(stageKey, file, durationSeconds);
    } catch {
      setActionError("Could not read the video duration. Retake or choose a 30-second max clip.");
    }
  };

  const submitForManagerReview = async () => {
    if (!jobId) return;
    setSubmitting(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/employee/jobs/${jobId}/complete`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error || "Failed to submit"));
      setActionMessage("Submitted for manager review.");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to submit for manager review");
    } finally {
      setSubmitting(false);
    }
  };

  const approveCompletion = async () => {
    if (!effectiveVendorId || !jobId || !job?.serviceVideoPackage) return;
    if (!allStagesReviewed) {
      setActionError("Review all three current stage videos before submitting this package to Reliance Audit.");
      return;
    }
    if (!auditAcknowledged) {
      setActionError("Confirm that you reviewed the exact current stage videos before submitting them for Reliance Audit.");
      return;
    }
    setSubmitting(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/vendors/${effectiveVendorId}/jobs/${encodeURIComponent(jobId)}/approve`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          managerReviewAcknowledged: true,
          packageId: job.serviceVideoPackage.id,
          packageVersion: job.serviceVideoPackage.version,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(actionErrorMessage(json, "The package could not be submitted for Reliance Audit."));
      setAuditConfirmOpen(false);
      setAuditAcknowledged(false);
      setActionMessage(String(json?.message || "The exact package was submitted for Reliance Audit. Customer access remains locked until Admin PASS."));
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "The package could not be submitted for Reliance Audit.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCorrectionStage = (stage: ReviewStage, checked: boolean) => {
    setCorrectionStages((current) =>
      checked
        ? Array.from(new Set([...current, stage]))
        : current.filter((item) => item !== stage),
    );
  };

  const requestStageCorrection = async () => {
    if (!effectiveVendorId || !jobId || !job?.serviceVideoPackage) return;
    const reason = String(correctionReason || "").trim();
    if (correctionStages.length === 0) {
      setActionError("Select at least one video stage that needs correction.");
      return;
    }
    if (!reason) {
      setActionError("Explain what the Employee needs to correct in the selected stage or stages.");
      return;
    }
    setSubmitting(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/vendors/${effectiveVendorId}/jobs/${encodeURIComponent(jobId)}/reject`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          correctionReason: reason,
          stages: correctionStages,
          packageId: job.serviceVideoPackage.id,
          packageVersion: job.serviceVideoPackage.version,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(actionErrorMessage(json, "The correction request could not be sent."));
      setCorrectionOpen(false);
      setCorrectionReason("");
      setCorrectionStages([]);
      setActionMessage("The selected video stages were returned to the Employee for correction.");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "The correction request could not be sent.");
    } finally {
      setSubmitting(false);
    }
  };

  const resendCompletedWorkOrder = async () => {
    if (!effectiveVendorId || !jobId) return;
    setResendingCompletedOrder(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/vendors/${effectiveVendorId}/jobs/${encodeURIComponent(jobId)}/actions`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESEND_COMPLETED_WORK_ORDER" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(String(json?.message || json?.error || "Failed to resend Private Service Record access"));
      }
      setActionMessage(json?.message || "Private Service Record access resent to the customer.");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to resend Private Service Record access");
    } finally {
      setResendingCompletedOrder(false);
    }
  };

  const respondToServiceRequest = async (action: 'ACCEPT_SERVICE_REQUEST' | 'DECLINE_SERVICE_REQUEST' | 'COUNTER_SERVICE_REQUEST') => {
    if (!effectiveVendorId || !jobId || serviceRequestSubmitting) return;
    const reason = serviceRequestReason.trim();
    if (action !== 'ACCEPT_SERVICE_REQUEST' && reason.length < 3) {
      setActionError('Add a short explanation (at least 3 characters) so the customer understands your response.');
      return;
    }
    let proposedScheduledFor: string | undefined;
    if (action === 'COUNTER_SERVICE_REQUEST') {
      const proposed = proposedDateTimeToUtc(serviceRequestProposedAt, serviceRequestTimeZone);
      if (!serviceRequestProposedAt || !proposed || proposed.getTime() <= Date.now()) {
        setActionError('Choose a valid future date and time.');
        return;
      }
      proposedScheduledFor = proposed.toISOString();
    }
    if (serviceRequestIdempotencyRef.current?.action !== action) {
      serviceRequestIdempotencyRef.current = {
        action,
        requestId: globalThis.crypto?.randomUUID?.() || `service-request-response-${Date.now()}`,
      };
    }
    setServiceRequestSubmitting(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const response = await fetch(`/api/vendors/${effectiveVendorId}/jobs/${encodeURIComponent(jobId)}/actions`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: action === 'ACCEPT_SERVICE_REQUEST' ? undefined : reason,
          proposedScheduledFor,
          requestId: serviceRequestIdempotencyRef.current.requestId,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body?.message || body?.error || 'Unable to respond to this service request.'));
      setActionMessage(String(body?.message || (action === 'ACCEPT_SERVICE_REQUEST'
        ? 'Service request accepted. The customer has been notified.'
        : action === 'COUNTER_SERVICE_REQUEST'
          ? 'New appointment time proposed. The customer has been notified.'
          : 'Service request declined. The customer has been notified.')));
      setServiceRequestDialog(null);
      setServiceRequestReason('');
      setServiceRequestProposedAt('');
      serviceRequestIdempotencyRef.current = null;
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to respond to this service request.');
    } finally {
      setServiceRequestSubmitting(false);
    }
  };

  const activityEvents = useMemo(() => {
    const events: Array<{ key: string; at: number; label: string }> = [];
    const addEvent = (key: string, value: string | null | undefined, label: string) => {
      const at = value ? new Date(value).getTime() : Number.NaN;
      events.push({ key, at: Number.isFinite(at) ? at : Number.MAX_SAFE_INTEGER, label });
    };
    if (job?.createdAt) {
      addEvent(
        "created",
        job.createdAt,
        String(job.source || '').toLowerCase() === 'customer_booking'
          ? `Customer service request received: ${formatRelianceDateTime(job.createdAt)}`
          : `Created: ${formatRelianceDateTime(job.createdAt)}`,
      );
    }
    const requestLifecycle = job?.requestLifecycle;
    const requestState = String(requestLifecycle?.state || '').trim().toUpperCase();
    const respondedAt = requestLifecycle?.respondedAt || requestLifecycle?.responded_at || null;
    const customerRespondedAt = requestLifecycle?.customerRespondedAt || requestLifecycle?.customer_responded_at || null;
    const proposedFor = requestLifecycle?.proposedScheduledFor || requestLifecycle?.proposed_scheduled_for || null;
    if (requestState === 'VENDOR_ACCEPTED') addEvent('request-accepted', respondedAt, 'Service request accepted and customer notified');
    if (requestState === 'COUNTEROFFERED') addEvent('request-countered', respondedAt, `New appointment time proposed${proposedFor ? `: ${formatRelianceDateTime(proposedFor)}` : ''}`);
    if (requestState === 'SCHEDULED') addEvent('request-scheduled', customerRespondedAt || respondedAt, `Appointment scheduled${job?.requestedFor ? `: ${formatRelianceDateTime(job?.requestedFor)}` : ''}`);
    if (requestState === 'VENDOR_DECLINED') addEvent('request-declined', respondedAt, 'Service request declined and customer notified');
    if (requestState === 'CUSTOMER_DECLINED') addEvent('request-customer-declined', customerRespondedAt, 'Customer declined the proposed appointment time');
    if (job?.assignedEmployees?.length) {
      addEvent("assigned", job.createdAt, `Assigned: ${job.assignedEmployees.join(", ")}`);
    }
    for (const stage of STAGE_ORDER) {
      const s = stageMap.get(stage.key);
      const stageState = resolveManagerStageAssetState(s);
      const ts = stageState.asset?.createdAt || s?.createdAt;
      const packageStage = packageStageMap.get(stage.key);
      if (stageState.saved && ts) {
        addEvent(
          `stage-${stage.key}-${String(ts)}`,
          ts,
          `${stage.label} ${Number(packageStage?.stageVersion || 1) > 1 ? "replacement saved" : "saved"}: ${formatRelianceDateTime(ts)}`,
        );
      }
    }

    const packageHistory = job?.serviceVideoPackageHistory || [];
    for (const pkg of packageHistory) {
      const when = pkg.submittedAt || null;
      addEvent(
        `package-${pkg.id}`,
        when,
        `${pkg.version > 1 ? "Corrected package" : "Package"} v${pkg.version} submitted for Manager Review${when ? `: ${formatRelianceDateTime(when)}` : ""}`,
      );
    }
    for (const decision of job?.managerReviewHistory || []) {
      const packageVersion = decision.packageVersion ?? packageHistory.find((pkg) => pkg.id === decision.packageId)?.version;
      const packageLabel = packageVersion ? `package v${packageVersion}` : "the reviewed package";
      if (String(decision.decision).toUpperCase() === "CORRECTION_REQUESTED") {
        const when = decision.decidedAt || null;
        const reason = String(decision.reason || "").trim();
        addEvent(
          `manager-decision-${decision.id}`,
          when,
          `Manager requested correction for ${stageListLabel(decision.targetedStages)} on ${packageLabel}${reason ? `: ${reason}` : ""}${when ? ` (${formatRelianceDateTime(when)})` : ""}`,
        );
      }
    }
    if (packageHistory.length === 0 && normalizedStatus === "AWAITING_REVIEW") {
      addEvent("manager-review-current", job?.updatedAt, "Current package submitted for Manager Review");
    }
    if (String(job?.operationalPhase || "").toUpperCase() === "AWAITING_ADMIN_REVIEW") {
      addEvent("audit-submitted", job?.updatedAt, "Submitted to Reliance Audit");
    }
    if (job?.adminAuditDecision?.decision === "PASS") {
      addEvent("audit-pass", job.adminAuditDecision.decidedAt, `Reliance Audit passed: ${formatRelianceDateTime(job.adminAuditDecision.decidedAt)}`);
      if (job.packageVisibility?.privateProofReleased) {
        addEvent("private-proof", job.adminAuditDecision.decidedAt, `Private Service Record available to customer: ${formatRelianceDateTime(job.adminAuditDecision.decidedAt)}`);
      }
    } else if (job?.adminAuditDecision?.decision === "REJECT") {
      addEvent("audit-reject", job.adminAuditDecision.decidedAt, `Reliance Audit failed: ${formatRelianceDateTime(job.adminAuditDecision.decidedAt)}`);
    } else if (job?.rejectionReason && (job?.managerReviewHistory || []).length === 0) {
      addEvent("legacy-correction", job.rejectedAt, "Stage correction requested by manager");
    }
    if (job?.packageVisibility?.decision === "KEEP_PRIVATE") {
      addEvent("visibility-private", job.packageVisibility.decidedAt, `Customer kept Private: ${formatRelianceDateTime(job.packageVisibility.decidedAt)}`);
    } else if (job?.packageVisibility?.decision === "SHARE_PUBLICLY") {
      addEvent("visibility-public", job.packageVisibility.decidedAt, `Customer authorized Public sharing: ${formatRelianceDateTime(job.packageVisibility.decidedAt)}`);
      if (job.packageVisibility.state === "PUBLIC_WAITING_PERMISSION") addEvent("public-permission", job.packageVisibility.decidedAt, "Waiting for Public-sharing permission");
      if (job.packageVisibility.state === "PUBLIC_REVIEW_PENDING") addEvent("public-review", job.packageVisibility.decidedAt, "Historical Public processing pending");
      if (job.packageVisibility.state === "PUBLIC") addEvent("public-live", job.packageVisibility.decidedAt, "Service Video became Public");
    }
    if (normalizedStatus === "CANCELED") {
      const actor = String(job?.cancellation?.canceledBy || "Vendor manager").trim();
      const reason = String(job?.cancellation?.reason || "No reason recorded").trim();
      const when = formatRelianceDateTime(job?.cancellation?.canceledAt || job?.updatedAt);
      addEvent("canceled", job?.cancellation?.canceledAt || job?.updatedAt, `Canceled by ${actor}: ${reason} (${when})`);
    }
    return events
      .sort((left, right) => left.at - right.at || left.key.localeCompare(right.key))
      .map((event) => event.label);
  }, [job, normalizedStatus, packageStageMap, stageMap]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/vendor/jobs" className="text-sm text-blue-700 hover:underline">
            ← Back to Jobs
          </Link>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
              <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-gray-200 animate-pulse" />
            </CardContent>
          </Card>
        ) : null}
        {loadError ? (
          <Card>
            <CardContent className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg space-y-2">
              <p className="font-semibold">We couldn't load this job.</p>
              <p>{loadError}</p>
              <Button size="sm" variant="outline" onClick={() => void load()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}
        {actionError ? (
          <Card>
            <CardContent className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">That action was not completed.</p>
                  <p className="mt-1">{actionError}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActionError(null)}>
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
        {actionMessage ? <Card><CardContent className="p-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">{actionMessage}</CardContent></Card> : null}

        {job ? (
          <>
            <Card>
              <CardContent className="p-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-gray-900">{job.title || "Job Detail"}</h1>
                  <p className="text-sm text-gray-700">Client: {job.client || "Unknown client"}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">Reference: {job.id}</Badge>
                    <Badge variant="outline">
                      Source: {String(job.source || "").toLowerCase() === "customer_booking" ? "Customer Booking" : "Vendor-Created Job"}
                    </Badge>
                    {job.date ? <Badge variant="outline">Date: {formatRelianceDateTime(job.date)}</Badge> : null}
                    {job.assignedEmployees?.length ? (
                      <Badge variant="outline">Assigned: {job.assignedEmployees.join(", ")}</Badge>
                    ) : (
                      <Badge variant="outline">Assigned: None</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 lg:items-end">
                  <Badge className={lifecycleBadgeClass(lifecycle.tone)}>{lifecycle.label}</Badge>
                  {normalizedStatus === "COMPLETED" && !job.adminAuditDecision ? (
                    <Badge variant="outline">Employee recording completed</Badge>
                  ) : null}
                  {canSubmitForManagerReview ? (
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submitForManagerReview} disabled={submitting}>
                      {submitting ? "Submitting..." : "Submit for Manager Review"}
                    </Button>
                  ) : null}
                  {job.adminAuditDecision?.decision === "PASS" ? (
                    <Button
                      variant="outline"
                      onClick={resendCompletedWorkOrder}
                      disabled={resendingCompletedOrder}
                      className="h-auto min-h-10 whitespace-normal text-center"
                    >
                      {resendingCompletedOrder ? "Resending..." : "Resend Private Service Record Access"}
                    </Button>
                  ) : null}
                  {canManagerReview ? (
                    <p className="max-w-sm text-sm text-blue-50/75 lg:text-right">
                      Review the exact current package below. Manager decisions appear after the three stage videos.
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {String(job.source || '').toLowerCase() === 'customer_booking' ? (
              <Card className="overflow-hidden border-blue-200">
                <CardHeader className="border-b border-blue-100 bg-blue-50">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Customer service request</p>
                      <CardTitle className="mt-1 text-slate-950">
                        {serviceRequestState === 'REQUESTED' ? 'Your response is needed'
                          : serviceRequestState === 'COUNTEROFFERED' ? 'Waiting for customer response'
                            : serviceRequestState === 'VENDOR_ACCEPTED' ? 'Accepted by your business'
                              : serviceRequestState === 'SCHEDULED' ? 'Appointment scheduled'
                                : serviceRequestState === 'VENDOR_DECLINED' ? 'Declined by your business'
                                  : serviceRequestState === 'CUSTOMER_DECLINED' ? 'Customer declined proposed time'
                                    : 'Service request status'}
                      </CardTitle>
                      <p className="mt-2 max-w-3xl text-sm text-slate-700">
                        {serviceRequestState === 'REQUESTED' ? 'Review the customer details below. Accepting confirms their requested time; proposing a time requires the customer to accept before it is scheduled.'
                          : serviceRequestState === 'COUNTEROFFERED' ? 'The appointment is not scheduled yet. Reliance notified the customer and is waiting for their decision.'
                            : serviceRequestState === 'VENDOR_ACCEPTED' || serviceRequestState === 'SCHEDULED' ? 'The customer has been notified that the appointment is scheduled.'
                              : serviceRequestState === 'VENDOR_DECLINED' ? 'The customer was notified that your business could not accept the request.'
                                : serviceRequestState === 'CUSTOMER_DECLINED' ? 'The proposed time was not scheduled. Follow up through a new request if another time should be considered.'
                                  : 'Open request details and activity are shown below.'}
                      </p>
                    </div>
                    <Badge className={serviceRequestState === 'REQUESTED' ? 'bg-blue-600 text-white' : serviceRequestState === 'COUNTEROFFERED' ? 'bg-amber-500 text-amber-950' : 'bg-slate-700 text-white'}>
                      {serviceRequestState === 'REQUESTED' ? 'Action required' : serviceRequestState.replaceAll('_', ' ') || 'REQUEST'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 p-5">
                  <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <div><dt className="font-medium text-slate-500">Requested appointment</dt><dd className="mt-1 font-semibold text-slate-950">{job.requestedFor ? formatRelianceDateTime(job.requestedFor) : 'Customer asked you to propose a time'}</dd></div>
                    <div><dt className="font-medium text-slate-500">Service address</dt><dd className="mt-1 font-semibold text-slate-950">{job.serviceAddress || 'Not provided'}</dd></div>
                    <div><dt className="font-medium text-slate-500">Customer contact</dt><dd className="mt-1 font-semibold text-slate-950">{[job.customerEmail, job.customerPhone].filter(Boolean).join(' · ') || 'Not provided'}</dd></div>
                    {job.notes?.[0]?.text || job.requestNotes || job.customerNotes ? <div className="sm:col-span-2 lg:col-span-3"><dt className="font-medium text-slate-500">Customer instructions</dt><dd className="mt-1 whitespace-pre-wrap text-slate-950">{job.notes?.[0]?.text || job.requestNotes || job.customerNotes}</dd></div> : null}
                    {serviceRequestProposedFor ? <div><dt className="font-medium text-slate-500">Time you proposed</dt><dd className="mt-1 font-semibold text-slate-950">{formatRelianceDateTime(serviceRequestProposedFor)}</dd></div> : null}
                    {serviceRequestResponseReason ? <div className="sm:col-span-2"><dt className="font-medium text-slate-500">Response note</dt><dd className="mt-1 text-slate-950">{serviceRequestResponseReason}</dd></div> : null}
                  </dl>

                  {isManager && serviceRequestState === 'REQUESTED' ? (
                    <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:flex-wrap">
                      {job.requestedFor ? (
                        <Button className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={serviceRequestSubmitting} onClick={() => void respondToServiceRequest('ACCEPT_SERVICE_REQUEST')}>
                          {serviceRequestSubmitting ? 'Sending response...' : 'Accept requested time'}
                        </Button>
                      ) : null}
                      <Button variant="outline" disabled={serviceRequestSubmitting} onClick={() => {
                        setActionError(null);
                        setServiceRequestReason('');
                        setServiceRequestProposedAt('');
                        setServiceRequestDialog('COUNTER');
                      }}>{job.requestedFor ? 'Propose a new time' : 'Propose an appointment time'}</Button>
                      <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" disabled={serviceRequestSubmitting} onClick={() => {
                        setActionError(null);
                        setServiceRequestReason('');
                        setServiceRequestDialog('DECLINE');
                      }}>Decline request</Button>
                    </div>
                  ) : null}
                  {!isManager && serviceRequestState === 'REQUESTED' ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">A vendor manager must respond before this request can become a Service Order.</p> : null}
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase text-gray-500">Recording permission requirement</p>
                  <p className="mt-1 font-semibold text-white">
                    {job.recordingCompliance?.permissionRequired
                      ? "Customer recording permission"
                      : "Customer permission not required for this location"}
                  </p>
                  <p className="mt-1 text-sm text-blue-50/85">
                    {job.recordingCompliance?.permissionRequired
                      ? readableEvidenceValue(job.recordingCompliance?.permissionStatus)
                      : "The Customer is not an intended recording participant in the approved scope."}
                  </p>
                  <p className="mt-2 text-xs text-blue-50/65">
                    Recording participation and Private or Public visibility remain separate decisions.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase text-gray-500">Approved recording scope</p>
                  <p className="mt-1 text-sm text-gray-800">Location: {readableEvidenceValue(job.recordingAssessment?.locationType || job.recordingCompliance?.location)}</p>
                  {job.recordingAssessment?.intentionalParticipantPlan ? (
                    <>
                      <p className="mt-1 text-sm text-gray-800">Site control: {readableEvidenceValue(job.recordingAssessment.siteControl)}</p>
                      <p className="mt-1 text-sm text-gray-800">Intentionally identifiable: {readableEvidenceValue(job.recordingAssessment.intentionalParticipantPlan)}</p>
                      <p className="mt-1 text-sm text-gray-800">Boundary: Service area, equipment or item, and the work being performed</p>
                      <p className="mt-2 text-xs text-gray-500">Minors, unrelated people or conversations, private or sensitive information, credentials, keys, security details, and confidential information must not be recorded.</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-gray-800">Property: {readableEvidenceValue(job.recordingAssessment?.propertyScope)}</p>
                      <p className="mt-1 text-sm text-gray-800">People: {readableEvidenceValue(job.recordingAssessment?.peopleScope)}</p>
                      <p className="mt-1 text-sm text-gray-800">Camera: {readableEvidenceValue(job.recordingAssessment?.frameControl)}</p>
                    </>
                  )}
                  <p className="mt-1 text-sm text-gray-800">Recording: {job.recordingAssessment?.audioAllowed ? 'Video + audio' : 'Video only'}</p>
                  {job.recordingCompliance?.employeeParticipation?.required ? (
                    <p className="mt-1 text-sm text-gray-800">
                      Employee participation: {job.recordingCompliance.employeeParticipation.complete
                        ? "Verified for every assigned Employee"
                        : job.recordingCompliance.employeeParticipation.status === "DECLINED"
                          ? "Declined - recording remains locked"
                          : job.recordingCompliance.employeeParticipation.status === "STALE"
                            ? "A new verified decision is required"
                            : "Waiting for every assigned Employee"}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {isManager && job.recordingAssessment ? (
              <Card>
                <CardContent className="p-5">
                  <ManagerWorkRecordAttestation
                    vendorId={effectiveVendorId}
                    bookingId={job.id}
                    headers={headers}
                    serviceOrderCurrent={job.recordingCompliance?.serviceOrderCurrent === true}
                  />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase text-blue-700">Current Service Order status</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{lifecycle.label}</h2>
                <p className="mt-2 text-sm text-blue-50/85">{lifecycle.detail}</p>
                <dl className="mt-4 grid gap-3 border-t border-gray-200 pt-4 text-sm sm:grid-cols-3">
                  <div><dt className="font-semibold text-white">Why</dt><dd className="mt-1 text-blue-50/75">{lifecycle.why}</dd></div>
                  <div><dt className="font-semibold text-white">Who acts next</dt><dd className="mt-1 text-blue-50/75">{lifecycle.responsibleParticipant}</dd></div>
                  <div><dt className="font-semibold text-white">What resolves it</dt><dd className="mt-1 text-blue-50/75">{lifecycle.resolution}</dd></div>
                </dl>
              </CardContent>
            </Card>

            {job.adminAuditDecision?.decision === "PASS" ? (
              <Card>
                <CardContent className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-950">Reliance Audit Passed</p>
                  <p className="mt-1 text-sm text-emerald-900">
                    Reliance approved the exact submitted Service Video package and made the Private Service Record available to the customer. No video was published.
                  </p>
                  <p className="mt-2 text-xs text-emerald-800">
                    Audit completed: {formatRelianceDateTime(job.adminAuditDecision.decidedAt)}. This record is read-only.
                  </p>
                </CardContent>
              </Card>
            ) : job.adminAuditDecision?.decision === "REJECT" ? (
              <Card>
                <CardContent className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-semibold text-rose-900">Reliance Audit Failed</p>
                  <p className="mt-1 text-sm text-rose-800">
                    This Service Video package did not meet the required audit standards. The Reliance work record is permanently closed and read-only. This does not mean the underlying real-world service failed.
                  </p>
                  {job.adminAuditDecision.rejectionCategory ? (
                    <p className="mt-2 text-xs text-rose-800">Category: {coreAdminAuditRejectionCategoryLabel(job.adminAuditDecision.rejectionCategory)}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-rose-800">Audit completed: {formatRelianceDateTime(job.adminAuditDecision.decidedAt)}</p>
                  {job.adminAuditDecision.reason ? (
                    <p className="mt-1 text-xs text-rose-800">Reason: {job.adminAuditDecision.reason}</p>
                  ) : null}
                </CardContent>
              </Card>
            ) : job.rejectionReason ? (
              <Card>
                <CardContent className="p-4 rounded-lg border border-amber-200 bg-amber-50">
                  <p className="text-sm font-semibold text-amber-900">Stage correction requested</p>
                  <p className="mt-1 text-sm text-amber-800">{job.rejectionReason}</p>
                  <p className="mt-2 text-xs text-amber-700">Only the selected stage or stages return to the Employee for a retake. The Work Record remains active, and customer access stays locked.</p>
                </CardContent>
              </Card>
            ) : null}

            {normalizedStatus === "CANCELED" ? (
              <Card>
                <CardContent className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-semibold text-rose-900">Service Order canceled</p>
                  <p className="mt-1 text-sm text-rose-800">No further Reliance work-record or recording action is available.</p>
                  <p className="mt-2 text-xs text-rose-700">
                    {job.cancellation?.reason ? `Reason: ${job.cancellation.reason}` : 'No cancellation reason was recorded.'}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {normalizedStatus === "COMPLETED" ? (
              <PackageVisibilityCard role="vendor" bookingId={jobId} />
            ) : null}

            <Card>
              <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Video Timeline</CardTitle>
                  <p className="mt-1 text-sm text-blue-50/70">
                    Review the exact current package in stage order before making a Manager decision.
                  </p>
                </div>
                {job.serviceVideoPackage ? (
                  <Badge variant="outline" className="w-fit border-blue-300/40 text-blue-100">
                    {job.serviceVideoPackage.version > 1 ? "Corrected package" : "Current package"} v{job.serviceVideoPackage.version}
                  </Badge>
                ) : null}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {STAGE_ORDER.map((stage) => {
                    const stageSession = stageMap.get(stage.key);
                    const stageState = resolveManagerStageAssetState(stageSession);
                    const latestAsset = stageState.asset;
                    const hasUpload = stageState.saved;
                    const packageStage = packageStageMap.get(stage.key);
                    const correctedReplacement = Number(packageStage?.stageVersion || 1) > 1;
                    const reviewed = reviewedStages.includes(stage.key);
                    const correctionRequestedForStage = correctionPending && stageState.correctionRequested;
                    const stageIsNext = nextMissingStage === stage.key;
                    const stageCardClass = correctionRequestedForStage
                      ? "border-amber-400/40 bg-amber-500/10"
                      : hasUpload
                      ? "border-emerald-400/35 bg-emerald-500/12"
                      : "border-blue-300/18 bg-slate-950/70";
                    return (
                      <div
                        key={stage.key}
                        className={`rounded-xl border p-4 text-white shadow-sm ${stageCardClass}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-white">{stage.label}</p>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Badge
                              variant="outline"
                              className={hasUpload ? "border-emerald-300/55 text-emerald-100" : "border-amber-300/55 text-amber-100"}
                            >
                              {correctionRequestedForStage
                                ? "Correction requested"
                                : hasUpload
                                  ? correctedReplacement
                                    ? "Corrected replacement"
                                    : "Current package video"
                                  : "Missing"}
                            </Badge>
                            {canManagerReview && hasUpload ? (
                              <Badge
                                variant="outline"
                                className={reviewed ? "border-cyan-300/55 text-cyan-100" : "border-slate-400/45 text-slate-300"}
                              >
                                {reviewed ? "Reviewed" : "Review required"}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-blue-50/75">{stage.cue}</p>
                        <p className="mt-1 text-xs font-medium text-blue-200">{getStageVideoLimitCopy()}</p>
                        {hasUpload || correctionRequestedForStage ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-blue-50/70">
                              {correctionRequestedForStage ? "Prior upload:" : "Uploaded:"}{" "}
                              {latestAsset?.createdAt || stageSession?.createdAt
                                ? formatRelianceDateTime(String(latestAsset?.createdAt || stageSession?.createdAt))
                                : "Unknown"}
                            </p>
                            <p className="text-xs font-medium text-blue-100">
                              Audio: {latestAsset?.audioPresence === "PRESENT"
                                ? "Present"
                                : latestAsset?.audioPresence === "ABSENT"
                                  ? "Not present"
                                  : "Historical / not independently detected"}
                              {latestAsset?.audioExpected ? " (approved)" : ""}
                            </p>
                            <Button
                              size="sm"
                              onClick={() => void watchStage(stage.key)}
                              disabled={resolvingPlaybackStage === stage.key}
                              className="bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:bg-blue-500"
                              aria-label={`${correctionRequestedForStage ? "Watch prior" : "Watch"} ${stage.label} video`}
                            >
                              <PlayCircle className="mr-2 h-4 w-4" />
                              {resolvingPlaybackStage === stage.key
                                ? "Opening..."
                                : correctionRequestedForStage
                                  ? "Watch prior version"
                                  : `Watch ${stage.label}`}
                            </Button>
                            <p className="text-xs text-blue-50/70">
                              {correctionRequestedForStage
                                ? "This preserved video remains in history but cannot satisfy the current stage. The Employee must save a new retake."
                                : "Retakes happen from the employee recording workspace before manager review."}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-blue-50/65">
                            {stage.key === "INTRO"
                              ? "No video yet — upload the intro (before service) video."
                              : stage.key === "IN_PROGRESS"
                                ? "No video yet — upload the in-progress video."
                                : "No video yet — upload the completion video."}
                          </p>
                        )}
                        {stageIsNext ? (
                          <p className="mt-3 text-xs font-medium text-blue-200">
                            Next required stage. The assigned employee records this from their secure job link.
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {canManagerReview ? (
                  <div className="mt-6 rounded-lg border border-blue-300/25 bg-slate-950/55 p-4 text-white" data-testid="manager-review-decision-panel">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">Manager review progress: {reviewedStages.length} of 3 stages reviewed</p>
                        <p className="mt-1 text-sm text-blue-50/70">
                          Watch each current video through once. Then submit the exact package or request correction only for the affected stage.
                        </p>
                      </div>
                      {allStagesReviewed ? (
                        <Badge className="w-fit bg-emerald-600 text-white">Review complete</Badge>
                      ) : (
                        <Badge variant="outline" className="w-fit border-amber-300/55 text-amber-100">Review in progress</Badge>
                      )}
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          setActionError(null);
                          setAuditAcknowledged(false);
                          setAuditConfirmOpen(true);
                        }}
                        disabled={submitting || !allStagesExist || !allStagesReviewed}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Submit to Reliance Audit
                      </Button>
                      <Button
                        variant="outline"
                        className="border-amber-300 text-amber-100 hover:bg-amber-500/10 hover:text-amber-50"
                        onClick={() => {
                          setActionError(null);
                          setCorrectionReason("");
                          setCorrectionStages([]);
                          setCorrectionOpen(true);
                        }}
                        disabled={submitting}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Request Stage Correction
                      </Button>
                    </div>
                    {!allStagesReviewed ? (
                      <p className="mt-3 text-xs text-amber-100">Submit becomes available after all three current stage videos have been reviewed.</p>
                    ) : null}
                  </div>
                ) : null}
                {canSubmitForManagerReview ? (
                  <div className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-900 font-semibold">
                      {isManager
                        ? "All 3 stages uploaded. Submit this package for manager review before approval."
                        : "All 3 stages uploaded. Ready to submit for manager review."}
                    </p>
                    <Button className="mt-3 bg-emerald-600 hover:bg-emerald-700" onClick={submitForManagerReview} disabled={submitting}>
                      {submitting ? "Submitting..." : "Submit for Manager Review"}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Job Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><span className="text-gray-600">Client:</span> {job.client || "Unknown"}</p>
                  <p><span className="text-gray-600">Customer email:</span> {job.customerEmail || "Not saved"}</p>
                  <p><span className="text-gray-600">Customer phone:</span> {job.customerPhone || "Not saved"}</p>
                  <p><span className="text-gray-600">Service:</span> {job.serviceName || job.serviceType || "General Service"}</p>
                  <p><span className="text-gray-600">Job ID:</span> {job.id}</p>
                  <p><span className="text-gray-600">Created:</span> {formatRelianceDateTime(job.createdAt || null)}</p>
                  <p><span className="text-gray-600">Updated:</span> {formatRelianceDateTime(job.updatedAt || null)}</p>
                  <p><span className="text-gray-600">Notes:</span> {job.notes?.[0]?.text || "No notes available"}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  {activityEvents.length > 0 ? (
                    <div className="space-y-2">
                      {activityEvents.map((event, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="mt-2 h-2 w-2 rounded-full bg-blue-500" />
                          <p className="text-sm text-gray-700">{event}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No activity data available yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        <Dialog
          open={Boolean(serviceRequestDialog)}
          onOpenChange={(open) => {
            if (open || serviceRequestSubmitting) return;
            setServiceRequestDialog(null);
            setServiceRequestReason('');
            setServiceRequestProposedAt('');
          }}
        >
          <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{serviceRequestDialog === 'COUNTER' ? 'Propose a new appointment time' : 'Decline service request'}</DialogTitle>
              <DialogDescription>
                {serviceRequestDialog === 'COUNTER'
                  ? 'The customer must accept your proposal before the appointment is scheduled.'
                  : 'The customer will be notified and will see your explanation in their Service Record.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {serviceRequestDialog === 'COUNTER' ? (
                <div>
                  <label htmlFor="detail-proposed-service-time" className="mb-1 block text-sm font-medium text-slate-800">Proposed date and time ({serviceRequestTimeZone})</label>
                  <input
                    id="detail-proposed-service-time"
                    type="datetime-local"
                    min={localDateTimeInputMin(serviceRequestTimeZone)}
                    value={serviceRequestProposedAt}
                    onChange={(event) => setServiceRequestProposedAt(event.target.value)}
                    disabled={serviceRequestSubmitting}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  />
                  <p className="mt-1 text-xs text-slate-600">Times are interpreted in the business service timezone: {serviceRequestTimeZone}.</p>
                </div>
              ) : null}
              <div>
                <label htmlFor="detail-service-response-reason" className="mb-1 block text-sm font-medium text-slate-800">{serviceRequestDialog === 'COUNTER' ? 'Why this time works better' : 'Reason for declining'}</label>
                <textarea
                  id="detail-service-response-reason"
                  value={serviceRequestReason}
                  onChange={(event) => setServiceRequestReason(event.target.value)}
                  rows={4}
                  disabled={serviceRequestSubmitting}
                  placeholder={serviceRequestDialog === 'COUNTER' ? 'For example: Our first available technician can arrive at this time.' : 'Give the customer a clear, respectful explanation.'}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:space-x-0">
              <Button type="button" variant="outline" disabled={serviceRequestSubmitting} onClick={() => setServiceRequestDialog(null)}>Cancel</Button>
              <Button
                type="button"
                disabled={serviceRequestSubmitting}
                className={serviceRequestDialog === 'DECLINE' ? 'bg-red-600 text-white hover:bg-red-700' : ''}
                onClick={() => void respondToServiceRequest(serviceRequestDialog === 'COUNTER' ? 'COUNTER_SERVICE_REQUEST' : 'DECLINE_SERVICE_REQUEST')}
              >
                {serviceRequestSubmitting ? 'Sending response...' : serviceRequestDialog === 'COUNTER' ? 'Send proposed time' : 'Decline and notify customer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={auditConfirmOpen}
          onOpenChange={(open) => {
            setAuditConfirmOpen(open);
            if (!open) setAuditAcknowledged(false);
          }}
        >
          <DialogContent className="reliance-mobile-dialog border-white/10 bg-[#08101d] text-white sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Submit exact package to Reliance Audit</DialogTitle>
              <DialogDescription className="text-blue-50/75">
                This records the Manager submission for the exact current package. Customer access remains locked until Reliance Audit returns PASS.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
              <p><span className="font-semibold text-white">Package version:</span> {job?.serviceVideoPackage?.version ?? "Unknown"}</p>
              <div>
                <p className="font-semibold text-white">Exact stage videos</p>
                <ul className="mt-1 space-y-1 text-blue-50/80">
                  {STAGE_ORDER.map((stage) => (
                    <li key={stage.key} className="flex items-center justify-between gap-3">
                      <span>{stage.label}</span>
                      <span className={reviewedStages.includes(stage.key) ? "text-emerald-200" : "text-amber-200"}>
                        {stageMap.get(stage.key)?.mediaAssets?.[0]?.id
                          ? reviewedStages.includes(stage.key)
                            ? "Current package video reviewed"
                            : "Current package video present; review required"
                          : "Missing"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <p><span className="font-semibold text-white">Audio scope:</span> {job?.recordingAssessment?.audioAllowed ? "Video and approved audio" : "Video only; no audio"}</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-blue-300/30 bg-blue-500/10 p-4 text-sm leading-6 text-blue-50">
              <Checkbox
                checked={auditAcknowledged}
                onCheckedChange={(checked) => setAuditAcknowledged(checked === true)}
                className="mt-0.5 h-5 w-5 border-2 border-blue-300 bg-slate-950 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
              />
              <span>I reviewed the three current stage videos and am submitting this exact package for Reliance Audit.</span>
            </label>
            <DialogFooter className="gap-2 sm:space-x-0">
              <Button
                variant="outline"
                className="border-slate-500 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => setAuditConfirmOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={approveCompletion} disabled={submitting || !auditAcknowledged || !allStagesReviewed}>
                {submitting ? "Submitting..." : "Submit to Reliance Audit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={correctionOpen}
          onOpenChange={(open) => {
            setCorrectionOpen(open);
            if (!open) {
              setCorrectionReason("");
              setCorrectionStages([]);
            }
          }}
        >
          <DialogContent className="reliance-mobile-dialog border-white/10 bg-[#08101d] text-white sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Request stage correction</DialogTitle>
              <DialogDescription className="text-blue-50/75">
                Select only the stage videos the Employee must retake. Unselected stages remain bound to this Work Record. Customer access and Public use remain unchanged and locked.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2" role="group" aria-label="Video stages requiring correction">
              {STAGE_ORDER.map((stage) => {
                const checked = correctionStages.includes(stage.key);
                return (
                  <label key={stage.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-blue-50">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleCorrectionStage(stage.key, value === true)}
                      className="mt-0.5 h-5 w-5 border-2 border-blue-300 bg-slate-950 data-[state=checked]:border-amber-400 data-[state=checked]:bg-amber-500 data-[state=checked]:text-slate-950"
                    />
                    <span><span className="block font-semibold text-white">{stage.label}</span><span className="text-blue-50/70">{stage.cue}</span></span>
                  </label>
                );
              })}
            </div>
            <label className="space-y-2 text-sm font-semibold text-white">
              Correction instructions
            <textarea
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              className="w-full rounded border border-white/20 bg-slate-950 p-3 text-sm font-normal text-white placeholder:text-blue-100/50"
              rows={4}
              placeholder="Required: explain what must be corrected in the selected stage or stages."
            />
            </label>
            <DialogFooter className="gap-2 sm:space-x-0">
              <Button
                variant="outline"
                className="border-slate-500 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => setCorrectionOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700"
                onClick={requestStageCorrection}
                disabled={submitting || correctionStages.length === 0 || !correctionReason.trim()}
              >
                {submitting ? "Sending..." : "Send Correction Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={playbackOpen}
          onOpenChange={(open) => {
            setPlaybackOpen(open);
            if (!open) {
              setPlaybackUrl("");
              setPlaybackTitle("");
              setPlaybackStage(null);
              setPlaybackCompleted(false);
            }
          }}
        >
          <DialogContent className="reliance-mobile-dialog flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden border-white/10 bg-[#08101d] text-white sm:max-w-3xl">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{playbackTitle || "Stage Video"}</DialogTitle>
              <DialogDescription className="text-blue-50/75">
                Watch this current package video through once to mark the stage reviewed. Use the video controls to expand full screen.
              </DialogDescription>
            </DialogHeader>
            {playbackUrl ? (
              <div className="space-y-3">
                <video
                  key={`${playbackStage || "stage"}:${playbackUrl}`}
                  className="max-h-[58dvh] w-full rounded-lg border border-slate-700 bg-black object-contain"
                  controls
                  autoPlay
                  onEnded={markPlaybackReviewed}
                  src={playbackUrl}
                >
                  Your browser does not support HTML5 video playback.
                </video>
                <div className={`rounded-lg border px-3 py-2 text-sm ${
                  playbackCompleted || (playbackStage && reviewedStages.includes(playbackStage))
                    ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
                    : "border-blue-300/20 bg-white/5 text-blue-50/75"
                }`}>
                  {playbackCompleted || (playbackStage && reviewedStages.includes(playbackStage))
                    ? "This stage is marked reviewed for the current page visit."
                    : "Review status updates when playback reaches the end."}
                </div>
              </div>
            ) : (
              <div className="rounded border border-rose-400/35 bg-rose-500/10 p-3 text-sm text-rose-100">
                {playbackError || "Video preview is temporarily unavailable."}
              </div>
            )}
            <DialogFooter className="flex-shrink-0 gap-2 sm:space-x-0">
              <Button
                variant="outline"
                className="border-slate-500 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => {
                  const previous = adjacentPlaybackStage(-1);
                  if (previous) void watchStage(previous);
                }}
                disabled={!adjacentPlaybackStage(-1) || Boolean(resolvingPlaybackStage)}
                aria-label="Watch previous stage video"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                className="border-slate-500 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => {
                  const next = adjacentPlaybackStage(1);
                  if (next) void watchStage(next);
                }}
                disabled={!adjacentPlaybackStage(1) || Boolean(resolvingPlaybackStage)}
                aria-label="Watch next stage video"
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
              <Button variant="outline" className="border-slate-500 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => setPlaybackOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
