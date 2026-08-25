"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useVendorProfile } from "@/hooks/useVendorProfile";
import { getClientSessionHeaders } from "@/lib/client-session";
import { PublicationWorkflowCard } from "@/components/service-video/PublicationWorkflowCard";
import { MediaLifecycleCard } from "@/components/service-video/MediaLifecycleCard";
import { resolveVendorJobLifecyclePresentation } from "@/lib/vendor-job-lifecycle-presentation";
import {
  STAGE_VIDEO_MAX_DURATION_SECONDS,
  formatStageVideoDuration,
  getStageVideoLimitCopy,
  getVideoFileDurationSeconds,
  isOverStageVideoLimit,
} from "@/lib/stage-video-guidance";

type JobLike = {
  id: string;
  title?: string;
  client?: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  status?: string;
  operationalPhase?: string;
  source?: string;
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
  } | null;
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
  }>;
};

const STAGE_ORDER = [
  { key: "INTRO", label: "Starting Condition", cue: "Show the starting condition before work begins." },
  { key: "IN_PROGRESS", label: "Work in Progress", cue: "Show active progress while the service is underway." },
  { key: "COMPLETED", label: "Final Result", cue: "Show the final result clearly." },
] as const;

function normalizeStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "CONFIRMED") return "IN_PROGRESS";
  return normalized;
}

function formatDateTimeUtc(value: string | null | undefined) {
  if (!value) return "Unknown";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString("en-US");
}

function statusBadgeClass(status: string) {
  if (status === "COMPLETED") return "bg-green-100 text-green-800";
  if (status === "IN_PROGRESS") return "bg-blue-100 text-blue-800";
  if (status === "AWAITING_REVIEW" || status === "PENDING") return "bg-yellow-100 text-yellow-800";
  if (status === "REJECTED" || status === "CANCELED") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-700";
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
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingStage, setUploadingStage] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [playbackTitle, setPlaybackTitle] = useState("");
  const [playbackError, setPlaybackError] = useState("");
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const [resendingCompletedOrder, setResendingCompletedOrder] = useState(false);
  const [resolvingPlaybackStage, setResolvingPlaybackStage] = useState<string | null>(null);
  const headers = useMemo(() => getClientSessionHeaders(userId), [userId]);
  const effectiveVendorId = String(vendorId || "").trim();
  const normalizedStatus = normalizeStatus(job?.status);
  const isManager = role === "MANAGER";
  const isEmployee = role === "EMPLOYEE";
  const lastAutoLoadKeyRef = useRef<string>("");

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

  const nextMissingStage = useMemo(() => {
    for (const stage of STAGE_ORDER) {
      const stageSession = stageMap.get(stage.key);
      const hasUpload = Boolean(stageSession?.mediaAssets?.some((a) => !a?.id ? false : true));
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
      locationSelected: Boolean(job?.recordingCompliance?.location),
      permissionRequired: job?.recordingCompliance?.permissionRequired === true,
      permissionState: job?.recordingCompliance?.permissionStatus,
      hasCustomerContact: Boolean(job?.customerEmail || job?.customerPhone),
      assigned: Boolean(job?.assignedEmployees?.length),
      allVideosPresent: allStagesExist,
      nextStageLabel: nextStage,
      serviceOrderSent: Boolean(job?.recordingCompliance?.serviceOrderReleasedAt),
      consentRecipientLabel: job?.customerEmail || job?.customerPhone || "the customer",
    });
  }, [allStagesExist, job, nextMissingStage, normalizedStatus]);

  const load = async () => {
    if (!jobId) {
      setLoading(false);
      setError("Missing job id.");
      return;
    }
    if (vendorProfileLoading) {
      return;
    }
    if (!effectiveVendorId) {
      setLoading(false);
      setError("Vendor context unavailable. Refresh and try again.");
      return;
    }
    setLoading(true);
    setError(null);
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
      setError(e instanceof Error ? e.message : "Failed to load job detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      setError("Missing job id.");
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

  const watchStage = async (stageKey: string) => {
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
      setPlaybackOpen(true);
    } catch (e) {
      setPlaybackError(e instanceof Error ? e.message : "Unable to open this video.");
    } finally {
      setResolvingPlaybackStage(null);
    }
  };

  const uploadStage = async (stageKey: string, file: File, durationSeconds: number) => {
    if (!effectiveVendorId || !jobId) return;
    setUploadingStage(stageKey);
    setActionMessage(null);
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
      setError(e instanceof Error ? e.message : "Failed to upload stage video");
    } finally {
      setUploadingStage(null);
    }
  };

  const validateAndUploadStage = async (stageKey: string, file: File) => {
    setActionMessage(null);
    try {
      const durationSeconds = await getVideoFileDurationSeconds(file);
      if (isOverStageVideoLimit(durationSeconds)) {
        setError(
          `Clip is ${formatStageVideoDuration(durationSeconds)}. Retake a ${formatStageVideoDuration(STAGE_VIDEO_MAX_DURATION_SECONDS)} max video for this stage.`
        );
        return;
      }
      await uploadStage(stageKey, file, durationSeconds);
    } catch {
      setError("Could not read the video duration. Retake or choose a 30-second max clip.");
    }
  };

  const submitForManagerReview = async () => {
    if (!jobId) return;
    setSubmitting(true);
    setActionMessage(null);
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
      setError(e instanceof Error ? e.message : "Failed to submit for manager review");
    } finally {
      setSubmitting(false);
    }
  };

  const approveCompletion = async () => {
    if (!effectiveVendorId || !jobId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/vendors/${effectiveVendorId}/jobs/${encodeURIComponent(jobId)}/approve`, {
        method: "POST",
        headers,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error || json?.message || "Approval failed"));
      setActionMessage("Completion approved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve completion");
    } finally {
      setSubmitting(false);
    }
  };

  const rejectCompletion = async () => {
    if (!effectiveVendorId || !jobId) return;
    const reason = String(rejectReason || "").trim();
    if (!reason) {
      setError("Rejection reason is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/vendors/${effectiveVendorId}/jobs/${encodeURIComponent(jobId)}/reject`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error || json?.message || "Rejection failed"));
      setRejectOpen(false);
      setRejectReason("");
      setActionMessage("Completed work order rejected.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject completion");
    } finally {
      setSubmitting(false);
    }
  };

  const resendCompletedWorkOrder = async () => {
    if (!effectiveVendorId || !jobId) return;
    setResendingCompletedOrder(true);
    setActionMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/vendors/${effectiveVendorId}/jobs/${encodeURIComponent(jobId)}/actions`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESEND_COMPLETED_WORK_ORDER" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(String(json?.message || json?.error || "Failed to resend completed work order"));
      }
      setActionMessage(json?.message || "Completed work order resent to the customer.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resend completed work order");
    } finally {
      setResendingCompletedOrder(false);
    }
  };

  const activityEvents = useMemo(() => {
    const events: string[] = [];
    if (job?.createdAt) events.push(`Created: ${formatDateTimeUtc(job.createdAt)}`);
    if (job?.assignedEmployees?.length) events.push(`Assigned: ${job.assignedEmployees.join(", ")}`);
    for (const stage of STAGE_ORDER) {
      const s = stageMap.get(stage.key);
      const ts = s?.mediaAssets?.[0]?.createdAt || s?.createdAt;
      if (ts) events.push(`${stage.label} uploaded: ${formatDateTimeUtc(ts)}`);
    }
    if (normalizedStatus === "AWAITING_REVIEW") events.push("Submitted for manager review");
    if (job?.adminAuditDecision?.decision === "REJECT") {
      events.push(`Reliance Audit failed: ${formatDateTimeUtc(job.adminAuditDecision.decidedAt)}`);
    } else if (job?.rejectionReason) {
      events.push("Rejected by manager");
    }
    if (normalizedStatus === "CANCELED") {
      const actor = String(job?.cancellation?.canceledBy || "Vendor manager").trim();
      const reason = String(job?.cancellation?.reason || "No reason recorded").trim();
      const when = formatDateTimeUtc(job?.cancellation?.canceledAt || job?.updatedAt);
      events.push(`Canceled by ${actor}: ${reason} (${when})`);
    }
    if (normalizedStatus === "COMPLETED") events.push("Completed");
    return events;
  }, [job, stageMap, normalizedStatus]);

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
        {error ? (
          <Card>
            <CardContent className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg space-y-2">
              <p>We couldn't load this job.</p>
              <Button size="sm" variant="outline" onClick={() => void load()}>
                Retry
              </Button>
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
                    {job.date ? <Badge variant="outline">Date: {formatDateTimeUtc(job.date)}</Badge> : null}
                    {job.assignedEmployees?.length ? (
                      <Badge variant="outline">Assigned: {job.assignedEmployees.join(", ")}</Badge>
                    ) : (
                      <Badge variant="outline">Assigned: None</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 lg:items-end">
                  <Badge className={statusBadgeClass(normalizedStatus || "UNKNOWN")}>{normalizedStatus || "UNKNOWN"}</Badge>
                  {canSubmitForManagerReview ? (
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submitForManagerReview} disabled={submitting}>
                      {submitting ? "Submitting..." : "Submit for Manager Review"}
                    </Button>
                  ) : null}
                  {normalizedStatus === "COMPLETED" ? (
                    <Button
                      variant="outline"
                      onClick={resendCompletedWorkOrder}
                      disabled={resendingCompletedOrder}
                    >
                      {resendingCompletedOrder ? "Resending..." : "Resend Completed Work Order"}
                    </Button>
                  ) : null}
                  {canManagerReview ? (
                    <div className="flex flex-wrap gap-2">
                      <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={approveCompletion} disabled={submitting}>
                        Submit to Reliance Audit
                      </Button>
                      <Button variant="outline" className="border-amber-300 text-amber-900" onClick={() => setRejectOpen(true)} disabled={submitting}>
                        Request Stage Correction
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase text-blue-700">Current Service Order status</p>
                <h2 className="mt-1 text-xl font-semibold text-gray-950">{lifecycle.label}</h2>
                <p className="mt-2 text-sm text-gray-700">{lifecycle.detail}</p>
                <dl className="mt-4 grid gap-3 border-t border-gray-200 pt-4 text-sm sm:grid-cols-3">
                  <div><dt className="font-semibold text-gray-900">Why</dt><dd className="mt-1 text-gray-600">{lifecycle.why}</dd></div>
                  <div><dt className="font-semibold text-gray-900">Who acts next</dt><dd className="mt-1 text-gray-600">{lifecycle.responsibleParticipant}</dd></div>
                  <div><dt className="font-semibold text-gray-900">What resolves it</dt><dd className="mt-1 text-gray-600">{lifecycle.resolution}</dd></div>
                </dl>
              </CardContent>
            </Card>

            {job.adminAuditDecision?.decision === "REJECT" ? (
              <Card>
                <CardContent className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-semibold text-rose-900">Reliance Audit Failed</p>
                  <p className="mt-1 text-sm text-rose-800">
                    This Service Video package did not meet the required audit standards. The Reliance work record is terminal and read-only.
                  </p>
                  {job.adminAuditDecision.rejectionCategory ? (
                    <p className="mt-2 text-xs text-rose-800">Category: {job.adminAuditDecision.rejectionCategory}</p>
                  ) : null}
                  {job.adminAuditDecision.reason ? (
                    <p className="mt-1 text-xs text-rose-800">Reason: {job.adminAuditDecision.reason}</p>
                  ) : null}
                </CardContent>
              </Card>
            ) : job.rejectionReason ? (
              <Card>
                <CardContent className="p-4 rounded-lg border border-amber-200 bg-amber-50">
                  <p className="text-sm font-semibold text-amber-900">Rejected by manager</p>
                  <p className="mt-1 text-sm text-amber-800">{job.rejectionReason}</p>
                  <p className="mt-2 text-xs text-amber-700">This completed work order is closed as rejected and will not move to public moderation.</p>
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

            {normalizedStatus === "COMPLETED" && effectiveVendorId ? (
              <>
                <PublicationWorkflowCard role="vendor" bookingId={jobId} vendorId={effectiveVendorId} />
                <MediaLifecycleCard role="vendor" bookingId={jobId} />
              </>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Video Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {STAGE_ORDER.map((stage) => {
                    const stageSession = stageMap.get(stage.key);
                    const latestAsset = stageSession?.mediaAssets?.[0];
                    const hasUpload = Boolean(latestAsset?.id);
                    const stageIsNext = nextMissingStage === stage.key;
                    const stageCardClass = hasUpload
                      ? "border-emerald-400/35 bg-emerald-500/12"
                      : "border-blue-300/18 bg-slate-950/70";
                    return (
                      <div
                        key={stage.key}
                        className={`rounded-xl border p-4 text-white shadow-sm ${stageCardClass}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-white">{stage.label}</p>
                          <Badge
                            variant="outline"
                            className={hasUpload ? "border-emerald-300/55 text-emerald-100" : "border-amber-300/55 text-amber-100"}
                          >
                            {hasUpload ? "Uploaded" : "Missing"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-blue-50/75">{stage.cue}</p>
                        <p className="mt-1 text-xs font-medium text-blue-200">{getStageVideoLimitCopy()}</p>
                        {hasUpload ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-blue-50/70">
                              Uploaded:{" "}
                              {latestAsset?.createdAt || stageSession?.createdAt
                                ? formatDateTimeUtc(String(latestAsset?.createdAt || stageSession?.createdAt))
                                : "Unknown"}
                            </p>
                            <Button
                              size="sm"
                              onClick={() => void watchStage(stage.key)}
                              disabled={resolvingPlaybackStage === stage.key}
                              className="bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:bg-blue-500"
                            >
                              {resolvingPlaybackStage === stage.key ? "Opening..." : "Watch"}
                            </Button>
                            <p className="text-xs text-gray-600">
                              Retakes happen from the employee recording workspace before manager review.
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
                  <p><span className="text-gray-600">Created:</span> {formatDateTimeUtc(job.createdAt || null)}</p>
                  <p><span className="text-gray-600">Updated:</span> {formatDateTimeUtc(job.updatedAt || null)}</p>
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

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Completed Work Order</DialogTitle>
              <DialogDescription>
                This closes the completed work order as rejected. It will not return to the employee for correction or move into public moderation.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full rounded border p-2 text-sm"
              rows={4}
              placeholder="Required: explain why this completed work order is rejected."
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button className="bg-amber-600 hover:bg-amber-700" onClick={rejectCompletion} disabled={submitting}>
                {submitting ? "Submitting..." : "Reject Work Order"}
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
            }
          }}
        >
          <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden sm:max-w-3xl">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{playbackTitle || "Stage Video"}</DialogTitle>
              <DialogDescription>
                Playback for this stage video. Use the video controls to expand full screen.
              </DialogDescription>
            </DialogHeader>
            {playbackUrl ? (
              <video
                className="max-h-[60dvh] w-full rounded-lg border border-slate-700 bg-black object-contain"
                controls
                autoPlay
                src={playbackUrl}
              >
                Your browser does not support HTML5 video playback.
              </video>
            ) : (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {playbackError || "Video preview is temporarily unavailable."}
              </div>
            )}
            <DialogFooter className="flex-shrink-0">
              <Button variant="outline" onClick={() => setPlaybackOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
