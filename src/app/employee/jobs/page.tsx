"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getClientSessionHeaders } from "@/lib/client-session";

type EmployeeJob = {
  id: string;
  vendorId: string;
  vendorName: string;
  title: string;
  status: string;
  customer: { name: string | null; email: string | null; phone: string | null };
  bookingDate: string | null;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  stageProgress: { INTRO: boolean; IN_PROGRESS: boolean; COMPLETED: boolean };
  canMarkComplete: boolean;
};

type StageFeedbackState = {
  status: "uploading" | "success" | "error";
  message: string;
};

const STAGES = [
  { key: "INTRO", label: "Before / Intro" },
  { key: "IN_PROGRESS", label: "During / In Progress" },
  { key: "COMPLETED", label: "After / Completed" },
] as const;

function toStageValue(stage: (typeof STAGES)[number]["key"]) {
  return stage === "INTRO" ? "before" : stage === "IN_PROGRESS" ? "during" : "after";
}

function getOrCreateDeviceUid() {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem("employee_device_uid");
  if (existing) return existing;
  const generated = `phone_${crypto.randomUUID()}`;
  localStorage.setItem("employee_device_uid", generated);
  return generated;
}

function normalizeStatusLabel(value: string | null | undefined): string {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "PENDING") return "Pending";
  if (normalized === "IN_PROGRESS") return "In Progress";
  if (normalized === "AWAITING_REVIEW") return "Awaiting Review";
  if (normalized === "COMPLETED") return "Completed";
  if (normalized === "REJECTED" || normalized === "NEEDS_CHANGES") return "Needs Changes";
  return normalized
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Unknown";
}

export default function EmployeeJobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<EmployeeJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [stageFeedback, setStageFeedback] = useState<Record<string, StageFeedbackState>>({});
  const userId = useMemo(() => String(user?.id || "").trim(), [user?.id]);

  const loadJobs = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/employee/jobs", {
        headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load assigned jobs.");
      setJobs(Array.isArray(json?.jobs) ? json.jobs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    void loadJobs();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const pair = async () => {
      const deviceUid = getOrCreateDeviceUid();
      await fetch("/api/employee/device/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
        body: JSON.stringify({
          deviceUid,
          deviceType: "PHONE",
          model: navigator.userAgent,
          os: navigator.platform,
          appVersion: "employee-web-v1",
        }),
      });
    };
    void pair();
  }, [userId]);

  const startJob = async (jobId: string) => {
    setActionMessage(null);
    const res = await fetch(`/api/employee/jobs/${jobId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error || "Failed to start job");
      return;
    }
    setActionMessage("Job started.");
    await loadJobs();
  };

  const completeJob = async (jobId: string) => {
    setActionMessage(null);
    const res = await fetch(`/api/employee/jobs/${jobId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error || "Failed to complete job");
      return;
    }
    const nextStatus = String(json?.job?.status || "").trim().toUpperCase();
    setActionMessage(
      nextStatus === "AWAITING_REVIEW"
        ? "Submitted for manager review."
        : "Job update submitted."
    );
    await loadJobs();
  };

  const uploadStageVideo = async (job: EmployeeJob, stage: (typeof STAGES)[number]["key"], file: File) => {
    const uploadKey = `${job.id}:${stage}`;
    const hadExistingStageVideo = Boolean(job.stageProgress?.[stage]);
    setUploadingKey(uploadKey);
    setError(null);
    setActionMessage(null);
    setStageFeedback((prev) => ({
      ...prev,
      [uploadKey]: { status: "uploading", message: "Uploading..." },
    }));
    try {
      const createSessionRes = await fetch(`/api/vendors/${job.vendorId}/media/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
        body: JSON.stringify({
          bookingId: job.id,
          vendorJobVideoStage: stage,
          sessionType: "JOB_SERVICE_VIDEO",
          replaceExisting: true,
          locationContext: "business",
        }),
      });
      const createSessionJson = await createSessionRes.json().catch(() => ({}));
      if (!createSessionRes.ok || !createSessionJson?.session?.id) {
        throw new Error(createSessionJson?.message || createSessionJson?.error || "Failed to create stage session");
      }
      const mediaSessionId = String(createSessionJson.session.id);

      const initRes = await fetch(`/api/vendors/${job.vendorId}/media/upload/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
        body: JSON.stringify({
          fileName: file.name,
          expectedBytes: file.size,
          mimeType: file.type || "video/mp4",
        }),
      });
      const initJson = await initRes.json().catch(() => ({}));
      if (!initRes.ok || !initJson?.sasUrl || !initJson?.assetId || !initJson?.blobKey) {
        throw new Error(initJson?.error || "Failed to initialize upload");
      }

      const putRes = await fetch(String(initJson.sasUrl), {
        method: "PUT",
        headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": file.type || "video/mp4" },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status})`);
      }

      const completeRes = await fetch(`/api/vendors/${job.vendorId}/media/upload/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
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
        throw new Error(completeJson?.error || "Failed to finalize upload");
      }

      const stageRes = await fetch(`/api/employee/jobs/${job.id}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientSessionHeaders(userId) },
        body: JSON.stringify({ stage }),
      });
      const stageJson = await stageRes.json().catch(() => ({}));
      if (!stageRes.ok || !stageJson?.success) {
        throw new Error(stageJson?.error || "Failed to mark stage complete");
      }

      setActionMessage(hadExistingStageVideo ? "Stage video replaced successfully." : `${stage.replace("_", " ")} proof uploaded.`);
      setStageFeedback((prev) => ({
        ...prev,
        [uploadKey]: {
          status: "success",
          message: hadExistingStageVideo ? "Stage video replaced successfully." : "Uploaded successfully",
        },
      }));
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload stage proof");
      setStageFeedback((prev) => ({
        ...prev,
        [uploadKey]: { status: "error", message: "Upload failed, try again" },
      }));
    } finally {
      setUploadingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="rounded-lg border bg-white p-4">
          <h1 className="text-xl font-bold text-gray-900">Assigned Jobs</h1>
          <p className="mt-1 text-sm text-gray-600">Mobile-friendly employee workflow for Intro, In Progress, and Completed proof videos.</p>
        </div>

        {error ? <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {actionMessage ? <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{actionMessage}</p> : null}

        {loading ? <p className="text-sm text-gray-600">Loading assigned jobs…</p> : null}
        {!loading && jobs.length === 0 ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-gray-600">No assigned jobs found for your active employee membership.</div>
        ) : null}

        {jobs.map((job) => (
          <div key={job.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{job.title}</p>
                <p className="text-xs text-gray-500">{job.vendorName}</p>
                <p className="mt-1 text-xs text-gray-600">
                  Customer: {job.customer.name || "Unknown"} {job.customer.phone ? `• ${job.customer.phone}` : ""}
                </p>
              </div>
              <span className="rounded border bg-gray-100 px-2 py-1 text-xs text-gray-700">{normalizeStatusLabel(job.status)}</span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {STAGES.map((stage) => {
                const done = Boolean(job.stageProgress[stage.key]);
                return (
                  <label key={stage.key} className="rounded border p-2 text-xs">
                    <p className="font-medium text-gray-800">{stage.label}</p>
                    <p className={done ? "text-emerald-700" : "text-gray-500"}>{done ? "Uploaded" : "Required"}</p>
                    {done ? (
                      <p className="mt-1 text-[11px] text-amber-700">
                        Uploading again will replace the current video for this stage.
                      </p>
                    ) : null}
                    <input
                      type="file"
                      accept="video/*"
                      className="mt-2 block w-full text-[11px]"
                      disabled={Boolean(uploadingKey)}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void uploadStageVideo(job, stage.key, file);
                        e.currentTarget.value = "";
                      }}
                    />
                    {stageFeedback[`${job.id}:${stage.key}`] ? (
                      <p
                        className={`mt-1 text-[11px] ${
                          stageFeedback[`${job.id}:${stage.key}`].status === "error"
                            ? "text-red-700"
                            : stageFeedback[`${job.id}:${stage.key}`].status === "success"
                            ? "text-emerald-700"
                            : "text-blue-700"
                        }`}
                      >
                        {stageFeedback[`${job.id}:${stage.key}`].message}
                      </p>
                    ) : null}
                  </label>
                );
              })}
            </div>

            {job.rejectionReason && String(job.status || "").toUpperCase() === "IN_PROGRESS" ? (
              <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-semibold">Manager requested changes</p>
                <p className="mt-1">{job.rejectionReason}</p>
                <p className="mt-2 text-[11px] text-amber-900">
                  Review the requested changes, re-upload the needed proof stage, then submit again.
                </p>
                {job.rejectedAt ? (
                  <p className="mt-1 text-[11px] text-amber-700">
                    Rejected on {new Date(job.rejectedAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void startJob(job.id)}
                className="rounded border border-blue-300 px-3 py-1 text-xs text-blue-700 hover:bg-blue-50"
              >
                Start Job
              </button>
              <button
                type="button"
                disabled={!job.canMarkComplete}
                onClick={() => void completeJob(job.id)}
                className="rounded border border-emerald-300 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Submit for Manager Review
              </button>
              {!job.canMarkComplete ? <span className="text-xs text-gray-500">Complete all 3 stages first.</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
