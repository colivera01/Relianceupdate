"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useVendorProfile } from "@/hooks/useVendorProfile";
import { getClientSessionHeaders } from "@/lib/client-session";

type JobLike = {
  id: string;
  title?: string;
  client?: string;
  status?: string;
  source?: string;
  date?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  assignedEmployees?: string[];
  serviceName?: string;
  serviceType?: string;
  notes?: Array<{ text?: string }>;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
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
  }>;
};

const STAGE_ORDER = [
  { key: "INTRO", label: "Intro (Before Service)" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed (Primary Proof)" },
] as const;

function normalizeStatus(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function formatDateTimeUtc(value: string | null | undefined) {
  if (!value) return "Unknown";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString("en-US", { timeZone: "UTC" });
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
  const [resolvedContextVendorId, setResolvedContextVendorId] = useState<string>("");

  const headers = useMemo(() => getClientSessionHeaders(userId), [userId]);
  const effectiveVendorId = String(resolvedContextVendorId || vendorId || "").trim();
  const normalizedStatus = normalizeStatus(job?.status);
  const isManager = role === "MANAGER";
  const isEmployee = role === "EMPLOYEE";

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
  const canSubmitForManagerReview = isEmployee && allStagesExist && normalizedStatus === "IN_PROGRESS";
  const canManagerReview = isManager && normalizedStatus === "AWAITING_REVIEW";

  const load = async () => {
    if (!jobId) {
      setLoading(false);
      setError("Missing job id.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let currentVendorId = String(effectiveVendorId || "").trim();
      const contextRes = await fetch("/api/vendor/context", {
        method: "GET",
        headers,
        cache: "no-store",
      });
      const contextJson = await contextRes.json().catch(() => ({}));
      setRole(String(contextJson?.role || "").trim().toUpperCase());
      if (!currentVendorId) {
        currentVendorId = String(contextJson?.vendorId || "").trim();
        if (currentVendorId) {
          setResolvedContextVendorId(currentVendorId);
        }
      }
      if (!currentVendorId) {
        throw new Error("Vendor context unavailable. Refresh and try again.");
      }

      const dashboardRes = await fetch(`/api/vendors/${currentVendorId}/dashboard`, {
        method: "GET",
        headers: { ...headers, "x-vendor-id": currentVendorId },
        cache: "no-store",
      });
      const dashboardJson = await dashboardRes.json().catch(() => ({}));
      if (!dashboardRes.ok) {
        throw new Error(String(dashboardJson?.error || "Failed to load job context"));
      }
      const jobs = [
        ...(Array.isArray(dashboardJson?.recentJobs) ? dashboardJson.recentJobs : []),
        ...(Array.isArray(dashboardJson?.archivedJobs) ? dashboardJson.archivedJobs : []),
      ] as JobLike[];
      const found = jobs.find((row) => String(row?.id || "") === jobId) || null;
      if (!found) {
        throw new Error("Job not found in vendor dashboard feed.");
      }
      setJob(found);

      const sessionsRes = await fetch(
        `/api/vendors/${currentVendorId}/media/sessions?bookingId=${encodeURIComponent(jobId)}`,
        { method: "GET", headers, cache: "no-store" }
      );
      const sessionsJson = await sessionsRes.json().catch(() => ({}));
      if (!sessionsRes.ok) throw new Error(String(sessionsJson?.error || "Failed to load proof sessions"));
      const baseSessions = Array.isArray(sessionsJson?.sessions) ? sessionsJson.sessions : [];
      const details = await Promise.all(
        baseSessions.map(async (session: { id?: string }) => {
          const sessionId = String(session?.id || "").trim();
          if (!sessionId) return null;
          const detailRes = await fetch(`/api/vendors/${currentVendorId}/media/sessions/${sessionId}`, {
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
    void load();
  }, [effectiveVendorId, jobId, userId, vendorProfileLoading]);

  const watchStage = async (stageKey: string) => {
    if (!effectiveVendorId) return;
    const session = stageMap.get(stageKey);
    const asset = session?.mediaAssets?.[0];
    if (!asset?.id) return;
    window.open(
      `/api/vendors/${effectiveVendorId}/media/${asset.id}/download`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const uploadStage = async (stageKey: string, file: File) => {
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
      setError(e instanceof Error ? e.message : "Failed to upload stage proof");
    } finally {
      setUploadingStage(null);
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
      setActionMessage("Rejected and returned for corrections.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject completion");
    } finally {
      setSubmitting(false);
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
    if (job?.rejectionReason) events.push("Rejected by manager");
    if (normalizedStatus === "COMPLETED") events.push("Completed");
    return events;
  }, [job, stageMap, normalizedStatus]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/vendor/jobs" className="text-sm text-blue-700 hover:underline">
            ← Back to Jobs
          </Link>
        </div>

        {loading ? <Card><CardContent className="p-6 text-sm text-gray-600">Loading job detail...</CardContent></Card> : null}
        {error ? <Card><CardContent className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</CardContent></Card> : null}
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
                  <Badge className="bg-blue-100 text-blue-800">{normalizedStatus || "UNKNOWN"}</Badge>
                  {canSubmitForManagerReview ? (
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submitForManagerReview} disabled={submitting}>
                      {submitting ? "Submitting..." : "Submit for Manager Review"}
                    </Button>
                  ) : null}
                  {canManagerReview ? (
                    <div className="flex flex-wrap gap-2">
                      <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={approveCompletion} disabled={submitting}>
                        Approve Completion
                      </Button>
                      <Button variant="outline" className="border-amber-300 text-amber-900" onClick={() => setRejectOpen(true)} disabled={submitting}>
                        Reject Completion
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {job.rejectionReason ? (
              <Card>
                <CardContent className="p-4 rounded-lg border border-amber-200 bg-amber-50">
                  <p className="text-sm font-semibold text-amber-900">Rejected by manager</p>
                  <p className="mt-1 text-sm text-amber-800">{job.rejectionReason}</p>
                  <p className="mt-2 text-xs text-amber-700">Fix required proof items, then resubmit for manager review.</p>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Proof Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {STAGE_ORDER.map((stage) => {
                    const stageSession = stageMap.get(stage.key);
                    const latestAsset = stageSession?.mediaAssets?.[0];
                    const hasUpload = Boolean(latestAsset?.id);
                    const stageIsNext = nextMissingStage === stage.key;
                    const isCompletedStage = stage.key === "COMPLETED";
                    return (
                      <div
                        key={stage.key}
                        className={`rounded-lg border p-4 ${
                          isCompletedStage ? "border-emerald-300 bg-emerald-50/50" : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-gray-900">{stage.label}</p>
                          <Badge
                            variant="outline"
                            className={hasUpload ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"}
                          >
                            {hasUpload ? "Uploaded" : "Missing"}
                          </Badge>
                        </div>
                        {hasUpload ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-gray-600">
                              Uploaded:{" "}
                              {latestAsset?.createdAt || stageSession?.createdAt
                                ? formatDateTimeUtc(String(latestAsset?.createdAt || stageSession?.createdAt))
                                : "Unknown"}
                            </p>
                            <Button size="sm" variant="outline" onClick={() => void watchStage(stage.key)}>
                              Watch
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-gray-500">No proof uploaded yet.</p>
                        )}
                        <div className="mt-3">
                          {isEmployee ? (
                            <label className="inline-flex cursor-pointer items-center text-sm text-blue-700 hover:underline">
                              Upload
                              <input
                                type="file"
                                accept="video/*"
                                className="hidden"
                                disabled={Boolean(uploadingStage)}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  void uploadStage(stage.key, file);
                                  e.currentTarget.value = "";
                                }}
                              />
                            </label>
                          ) : (
                            <p className="mt-1 text-xs text-gray-500">Employee upload action only.</p>
                          )}
                          {stageIsNext && isEmployee ? (
                            <p className="mt-1 text-xs font-medium text-blue-700">Next required stage</p>
                          ) : null}
                          {uploadingStage === stage.key ? <p className="mt-1 text-xs text-blue-700">Uploading...</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {canSubmitForManagerReview ? (
                  <div className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-900 font-semibold">
                      All 3 stages uploaded. Ready to submit for manager review.
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
              <DialogTitle>Reject Completion</DialogTitle>
            </DialogHeader>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full rounded border p-2 text-sm"
              rows={4}
              placeholder="Required: explain what must be fixed before resubmission."
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button className="bg-amber-600 hover:bg-amber-700" onClick={rejectCompletion} disabled={submitting}>
                {submitting ? "Submitting..." : "Reject Completion"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

