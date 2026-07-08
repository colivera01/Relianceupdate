"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Flashlight, FlashlightOff } from "lucide-react";
import { GuidanceCallout } from "@/components/guidance/GuidanceCallout";
import { TutorialEntryPoint } from "@/components/guidance/TutorialEntryPoint";
import { useAuth } from "@/contexts/AuthContext";
import { getClientSessionHeaders } from "@/lib/client-session";
import { normalizeEmployeeJobStatusLabel, shouldShowEmployeeStartButton } from "@/lib/employee-job-status";
import {
  getCompletedEmployeeCaptureCount,
  getEmployeeCaptureDeviceLabel,
  getEmployeeCaptureStageHeading,
  getEmployeeCaptureSupportCopy,
  getEmployeeStageStep,
  getNextEmployeeCaptureStage,
} from "@/lib/employee-stage-capture";
import {
  STAGE_VIDEO_MAX_DURATION_SECONDS,
  formatStageVideoDuration,
  getStageVideoLimitCopy,
  getVideoFileDurationSeconds,
  isOverStageVideoLimit,
} from "@/lib/stage-video-guidance";
import { tutorialGuides } from "@/lib/user-guidance";

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
  recordingCompliance?: RecordingComplianceState | null;
  stageProgress: { INTRO: boolean; IN_PROGRESS: boolean; COMPLETED: boolean };
  canMarkComplete: boolean;
};

type RecordingLocationChoice = "business" | "residence" | "customer-business";

type RecordingComplianceState = {
  location: RecordingLocationChoice | null;
  consentAccepted: boolean;
  consentToken: string;
  locationVerified: boolean;
  locationVerifiedAt: string | null;
  serviceOrderReleasedAt: string | null;
  releasedMembershipIds: string[];
};

type StageFeedbackState = {
  status: "uploading" | "success" | "error";
  message: string;
};

type PairedDeviceState = {
  deviceId: string;
  deviceUid: string;
  deviceName: string | null;
  deviceType: string;
  vendorId: string;
  membershipId: string;
  pairedAt: string | null;
  lastSeenAt: string | null;
  model: string | null;
  os: string | null;
  appVersion: string | null;
  status: string;
};

const STAGES = [
  { key: "INTRO", label: "Starting Condition", cue: "Show the starting condition before work begins." },
  { key: "IN_PROGRESS", label: "Work in Progress", cue: "Show active progress while the service is underway." },
  { key: "COMPLETED", label: "Final Result", cue: "Show the final result clearly." },
] as const;

type CapturedVideoDraft = {
  jobId: string;
  stage: (typeof STAGES)[number]["key"];
  file: File;
  previewUrl: string;
  durationSeconds: number;
  locationProof: LocationProof | null;
};

type LocationProof = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  source: "browser_geolocation";
};

function getRecordingLocation(job: EmployeeJob): RecordingLocationChoice {
  const value = String(job.recordingCompliance?.location || "").trim().toLowerCase();
  if (value === "residence" || value === "customer-business") return value;
  return "business";
}

function employeePhoneLocationRequired(job: EmployeeJob): boolean {
  const location = getRecordingLocation(job);
  return location === "business" || location === "customer-business";
}

const EMPLOYEE_JOBS_TIMEOUT_MS = 20000;
const EMPLOYEE_PAIR_TIMEOUT_MS = 15000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutHandle = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutHandle);
  }
}

function historyFingerprint(job: EmployeeJob): string {
  return [
    job.vendorId,
    job.vendorName,
    job.title,
    job.customer.name || "",
    job.customer.phone || "",
    job.bookingDate || "",
    String(job.status || "").trim().toUpperCase(),
    job.stageProgress.INTRO ? "1" : "0",
    job.stageProgress.IN_PROGRESS ? "1" : "0",
    job.stageProgress.COMPLETED ? "1" : "0",
  ].join("::");
}

function dedupeCompletedHistoryJobs(jobs: EmployeeJob[]): EmployeeJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const fingerprint = historyFingerprint(job);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

function getOrCreateDeviceUid() {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem("employee_device_uid");
  if (existing) return existing;
  const generated = `phone_${crypto.randomUUID()}`;
  localStorage.setItem("employee_device_uid", generated);
  return generated;
}

function shortDeviceLabel(device: PairedDeviceState | null): string {
  if (!device) return "";
  const rawName = String(device.deviceName || device.model || "").trim();
  const normalizedOs = String(device.os || "").trim();
  const combined = `${rawName} ${normalizedOs}`.toLowerCase();

  if (combined.includes("iphone")) return "iPhone";
  if (combined.includes("ipad")) return "iPad";
  if (combined.includes("android")) return "Android phone";
  if (combined.includes("electron") || combined.includes("codex/")) return "Employee browser";
  if (combined.includes("windows")) return "Windows browser";
  if (combined.includes("macintosh") || combined.includes("mac os")) return "Mac browser";
  if (combined.includes("linux")) return "Linux browser";
  if (rawName && !rawName.startsWith("Mozilla/") && rawName.length <= 50) return rawName;
  if (normalizedOs && normalizedOs.length <= 24) {
    return `${normalizedOs} ${device.deviceType === "HEADSET" ? "headset" : "device"}`;
  }
  return device.deviceType === "HEADSET" ? "Employee headset" : "Employee phone";
}

function getClientDeviceModelLabel(): string {
  if (typeof navigator === "undefined") return "Employee phone";
  const ua = navigator.userAgent || "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android phone";
  if (/Electron|Codex/i.test(ua)) return "Employee browser";
  if (/Windows/i.test(ua)) return "Windows browser";
  if (/Macintosh|Mac OS/i.test(ua)) return "Mac browser";
  if (/Linux/i.test(ua)) return "Linux browser";
  return "Employee phone";
}

function getClientDeviceOsLabel(): string {
  if (typeof navigator === "undefined") return "";
  const platform = navigator.platform || "";
  if (/iPhone|iPad|iPod/i.test(platform)) return "iOS";
  if (/Android/i.test(platform)) return "Android";
  if (/Win/i.test(platform)) return "Windows";
  if (/Mac/i.test(platform)) return "macOS";
  if (/Linux/i.test(platform)) return "Linux";
  return platform || "";
}

function isCompletedStatus(status: string | null | undefined): boolean {
  return String(status || "").trim().toUpperCase() === "COMPLETED";
}

function isAwaitingReviewStatus(status: string | null | undefined): boolean {
  return String(status || "").trim().toUpperCase() === "AWAITING_REVIEW";
}

function shouldAllowStageUpload(status: string | null | undefined): boolean {
  const normalized = String(status || "").trim().toUpperCase();
  return normalized !== "AWAITING_REVIEW" && normalized !== "COMPLETED";
}

function submitButtonLabel(status: string | null | undefined): string {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "AWAITING_REVIEW") return "Awaiting Manager Review";
  if (normalized === "COMPLETED") return "Completed";
  return "Submit for Manager Review";
}

function submitHelperText(job: EmployeeJob): string | null {
  const normalized = String(job.status || "").trim().toUpperCase();
  if (normalized === "AWAITING_REVIEW") return "All 3 stage videos are uploaded. Manager review is in progress.";
  if (normalized === "COMPLETED") return "All 3 stage videos are complete and manager-approved.";
  if (!job.canMarkComplete) return "Complete all 3 stage videos first.";
  return null;
}

function captureLinkSubmitButtonLabel(status: string | null | undefined): string {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "AWAITING_REVIEW") return "Sent to Manager";
  if (normalized === "COMPLETED") return "Completed";
  return "Send Videos to Manager";
}

function getCaptureLinkStepLabel(stage: (typeof STAGES)[number]["key"]): string {
  if (stage === "INTRO") return "Before";
  if (stage === "IN_PROGRESS") return "During";
  return "Finished";
}

function getStageCardActionLabel(input: {
  isOpening: boolean;
  isSaved: boolean;
  hasDraft: boolean;
  hasCaptureToken: boolean;
  stage: (typeof STAGES)[number]["key"];
}): string {
  if (input.isOpening) return "Opening camera...";
  if (input.hasDraft) return "Preview open - finish or retake";
  if (input.isSaved) return "Recorded - tap to edit";
  if (input.hasCaptureToken) return `Tap to record ${getCaptureLinkStepLabel(input.stage)}`;
  return "Required";
}

export default function EmployeeJobsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<EmployeeJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingServiceOrderMessage, setPendingServiceOrderMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [stageFeedback, setStageFeedback] = useState<Record<string, StageFeedbackState>>({});
  const [pairedDevice, setPairedDevice] = useState<PairedDeviceState | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [showCompletedHistory, setShowCompletedHistory] = useState(false);
  const [focusedStageByJobId, setFocusedStageByJobId] = useState<Record<string, (typeof STAGES)[number]["key"]>>({});
  const [focusedJobId, setFocusedJobId] = useState("");
  const [captureToken, setCaptureToken] = useState("");
  const [recordingOpeningKey, setRecordingOpeningKey] = useState<string | null>(null);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);
  const [recordingStarted, setRecordingStarted] = useState(false);
  const [recordingSecondsLeft, setRecordingSecondsLeft] = useState(STAGE_VIDEO_MAX_DURATION_SECONDS);
  const [activeCameraStream, setActiveCameraStream] = useState<MediaStream | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchError, setTorchError] = useState<string | null>(null);
  const [capturedDraft, setCapturedDraft] = useState<CapturedVideoDraft | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStopTimerRef = useRef<number | null>(null);
  const recordingCountdownTimerRef = useRef<number | null>(null);
  const activeCameraStreamRef = useRef<MediaStream | null>(null);
  const activeCameraContextRef = useRef<{
    job: EmployeeJob;
    stage: (typeof STAGES)[number]["key"];
    locationProof: LocationProof | null;
  } | null>(null);
  const capturedDraftUrlRef = useRef<string | null>(null);
  const fallbackCaptureRef = useRef<{
    job: EmployeeJob;
    stage: (typeof STAGES)[number]["key"];
    locationProof: LocationProof | null;
  } | null>(null);
  const userId = useMemo(() => String(user?.id || "").trim(), [user?.id]);
  const hasCaptureToken = Boolean(captureToken);

  const employeeRequestHeaders = (contentType = true): Record<string, string> => ({
    ...(contentType ? { "Content-Type": "application/json" } : {}),
    ...getClientSessionHeaders(userId),
    ...(captureToken ? { "x-employee-capture-token": captureToken } : {}),
  });

  const currentJobs = useMemo(() => {
    const activeJobs = jobs.filter((job) => !isCompletedStatus(job.status));
    if (!focusedJobId) return activeJobs;
    return [...activeJobs].sort((a, b) => {
      if (a.id === focusedJobId) return -1;
      if (b.id === focusedJobId) return 1;
      return 0;
    });
  }, [focusedJobId, jobs]);
  const completedJobs = useMemo(
    () => dedupeCompletedHistoryJobs(jobs.filter((job) => isCompletedStatus(job.status))),
    [jobs]
  );

  const loadJobs = async () => {
    if (!userId && !captureToken) return;
    setLoading(true);
    setError(null);
    try {
      const url = captureToken
        ? `/api/employee/jobs?ct=${encodeURIComponent(captureToken)}`
        : "/api/employee/jobs";
      const res = await fetchWithTimeout(url, {
        headers: employeeRequestHeaders(),
        cache: "no-store",
      }, EMPLOYEE_JOBS_TIMEOUT_MS);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load assigned jobs.");
      setJobs(Array.isArray(json?.jobs) ? json.jobs : []);
      setPendingServiceOrderMessage(
        json?.pendingServiceOrder
          ? String(
              json?.message ||
                "This service order is assigned, but it is not ready for recording yet. Your manager still needs to send the service order or finish any required customer-consent check."
            )
          : null
      );
    } catch (e) {
      const message =
        e instanceof Error && e.message === "Request timed out"
          ? "Assigned jobs took too long to load. Please retry."
          : e instanceof Error
            ? e.message
            : "Failed to load jobs";
      setError(message);
      setJobs([]);
      setPendingServiceOrderMessage(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("jobId");
    const token = params.get("ct") || params.get("captureToken") || "";
    setFocusedJobId(String(jobId || "").trim());
    if (token.trim()) {
      const normalizedToken = token.trim();
      setCaptureToken(normalizedToken);
      sessionStorage.setItem("employee_capture_token", normalizedToken);
    } else {
      const storedToken = sessionStorage.getItem("employee_capture_token") || "";
      if (storedToken.trim()) setCaptureToken(storedToken.trim());
    }
  }, []);

  useEffect(() => {
    if (!userId && !captureToken) return;
    void loadJobs();
  }, [userId, captureToken]);

  useEffect(() => {
    if (!liveVideoRef.current) return;
    liveVideoRef.current.srcObject = activeCameraStream;
  }, [activeCameraStream, recordingKey]);

  useEffect(() => {
    return () => {
      if (recordingStopTimerRef.current !== null) {
        window.clearTimeout(recordingStopTimerRef.current);
      }
      if (recordingCountdownTimerRef.current !== null) {
        window.clearInterval(recordingCountdownTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      activeCameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (capturedDraftUrlRef.current) {
        URL.revokeObjectURL(capturedDraftUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const overlayOpen = Boolean(recordingKey || capturedDraft);
    if (!overlayOpen) return;

    const scrollY = window.scrollY;
    const { documentElement, body } = document;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;

    documentElement.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      documentElement.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [recordingKey, capturedDraft]);

  useEffect(() => {
    if (captureToken) return;
    if (!userId) return;
    const pair = async () => {
      const deviceUid = getOrCreateDeviceUid();
      try {
        const res = await fetchWithTimeout("/api/employee/device/pair", {
          method: "POST",
          headers: employeeRequestHeaders(),
          body: JSON.stringify({
            deviceUid,
            deviceType: "PHONE",
            model: getClientDeviceModelLabel(),
            os: getClientDeviceOsLabel(),
            appVersion: "employee-web-v1",
          }),
        }, EMPLOYEE_PAIR_TIMEOUT_MS);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.pairing?.deviceId) {
          setPairingError(json?.error || "Could not pair this device.");
          setPairedDevice(null);
          return;
        }
        setPairingError(null);
        setPairedDevice({
          deviceId: String(json.pairing.deviceId),
          deviceUid: String(json.pairing.deviceUid || deviceUid),
          deviceName: json.pairing.deviceName || null,
          deviceType: String(json.pairing.deviceType || "PHONE"),
          vendorId: String(json.pairing.vendorId || ""),
          membershipId: String(json.pairing.membershipId || ""),
          pairedAt: json.pairing.pairedAt ? String(json.pairing.pairedAt) : null,
          lastSeenAt: json.pairing.lastSeenAt ? String(json.pairing.lastSeenAt) : null,
          model: json.pairing.model || null,
          os: json.pairing.os || null,
          appVersion: json.pairing.appVersion || null,
          status: String(json.pairing.status || "active"),
        });
      } catch (e) {
        const message =
          e instanceof Error && e.message === "Request timed out"
            ? "Phone setup took too long. Reload to retry."
            : e instanceof Error
              ? e.message
              : "Could not prepare this phone for video capture.";
        setPairingError(message);
        setPairedDevice(null);
      }
    };
    void pair();
  }, [userId, captureToken]);

  const startJob = async (jobId: string) => {
    setActionMessage(null);
    const res = await fetch(`/api/employee/jobs/${jobId}/start`, {
      method: "POST",
      headers: employeeRequestHeaders(),
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
      headers: employeeRequestHeaders(),
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

  const uploadStageVideo = async (
    job: EmployeeJob,
    stage: (typeof STAGES)[number]["key"],
    file: File,
    durationSeconds: number,
    locationProof: LocationProof | null
  ) => {
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
      const deviceIdForUpload = pairedDevice?.deviceId || null;
      const recordingLocation = getRecordingLocation(job);
      const compliance = job.recordingCompliance || null;

      const createSessionRes = await fetch(`/api/vendors/${job.vendorId}/media/sessions`, {
        method: "POST",
        headers: employeeRequestHeaders(),
        body: JSON.stringify({
          bookingId: job.id,
          vendorJobVideoStage: stage,
          sessionType: "JOB_SERVICE_VIDEO",
          replaceExisting: true,
          locationContext: recordingLocation,
          consentAccepted: Boolean(compliance?.consentAccepted),
          consentToken: String(compliance?.consentToken || "").trim(),
          locationProof,
          deviceId: deviceIdForUpload,
          deviceType: pairedDevice?.deviceType || "PHONE",
        }),
      });
      const createSessionJson = await createSessionRes.json().catch(() => ({}));
      if (!createSessionRes.ok || !createSessionJson?.session?.id) {
        throw new Error(
          createSessionJson?.message || createSessionJson?.error || "Failed to create stage session"
        );
      }
      const mediaSessionId = String(createSessionJson.session.id);

      const initRes = await fetch(`/api/vendors/${job.vendorId}/media/upload/init`, {
        method: "POST",
        headers: employeeRequestHeaders(),
        body: JSON.stringify({
          fileName: file.name,
          expectedBytes: file.size,
          mimeType: file.type || "video/mp4",
          bookingId: job.id,
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
        headers: employeeRequestHeaders(),
        body: JSON.stringify({
          assetId: initJson.assetId,
          blobKey: initJson.blobKey,
          blobUrl: null,
          bytes: file.size,
          mimeType: file.type || "video/mp4",
          mediaSessionId,
          deviceId: deviceIdForUpload,
          durationSeconds,
        }),
      });
      const completeJson = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok || !completeJson?.success) {
        throw new Error(completeJson?.error || "Failed to finalize upload");
      }

      const stageRes = await fetch(`/api/employee/jobs/${job.id}/stage`, {
        method: "POST",
        headers: employeeRequestHeaders(),
        body: JSON.stringify({ stage }),
      });
      const stageJson = await stageRes.json().catch(() => ({}));
      if (!stageRes.ok || !stageJson?.success) {
        throw new Error(stageJson?.error || "Failed to mark stage complete");
      }

      setActionMessage(
        hadExistingStageVideo
          ? "Stage video replaced successfully."
          : `${stage.replace("_", " ")} video uploaded.`
      );
      setStageFeedback((prev) => ({
        ...prev,
        [uploadKey]: {
          status: "success",
          message: hadExistingStageVideo ? "Stage video replaced successfully." : "Uploaded successfully",
        },
      }));
      setFocusedStageByJobId((current) => ({
        ...current,
        [job.id]: getNextEmployeeCaptureStage({
          ...job.stageProgress,
          [stage]: true,
        }),
      }));
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload stage video");
      setStageFeedback((prev) => ({
        ...prev,
        [uploadKey]: { status: "error", message: "Upload failed, try again" },
      }));
    } finally {
      setUploadingKey(null);
    }
  };

  const clearCapturedDraft = () => {
    setCapturedDraft((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      if (capturedDraftUrlRef.current === current?.previewUrl) {
        capturedDraftUrlRef.current = null;
      }
      return null;
    });
  };

  const stopActiveCameraStream = (stream: MediaStream | null = activeCameraStream) => {
    stream?.getTracks().forEach((track) => track.stop());
    if (!stream || activeCameraStreamRef.current === stream) {
      activeCameraStreamRef.current = null;
    }
    activeCameraContextRef.current = null;
    setTorchSupported(false);
    setTorchOn(false);
    setTorchError(null);
    setRecordingStarted(false);
    setActiveCameraStream(null);
  };

  const getActiveVideoTrack = () => activeCameraStreamRef.current?.getVideoTracks()[0] || null;

  const mediaTrackSupportsTorch = (track: MediaStreamTrack | null | undefined) => {
    const capabilities =
      typeof track?.getCapabilities === "function"
        ? (track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean })
        : null;
    return Boolean(capabilities?.torch);
  };

  const mediaStreamSupportsTorch = (stream: MediaStream) =>
    mediaTrackSupportsTorch(stream.getVideoTracks()[0]);

  const stopMediaStream = (stream: MediaStream | null | undefined) => {
    stream?.getTracks().forEach((track) => track.stop());
  };

  const requestRearCameraStream = async () => {
    const baseVideoConstraints = {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    };
    const preferredConstraints: MediaStreamConstraints[] = [
      {
        video: {
          ...baseVideoConstraints,
          facingMode: { exact: "environment" },
        },
        audio: false,
      },
      {
        video: {
          ...baseVideoConstraints,
          facingMode: { ideal: "environment" },
        },
        audio: false,
      },
      { video: true, audio: false },
    ];

    let lastError: unknown = null;
    let fallbackStream: MediaStream | null = null;
    for (const constraints of preferredConstraints) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (mediaStreamSupportsTorch(stream)) {
          stopMediaStream(fallbackStream);
          return stream;
        }
        if (!fallbackStream) {
          fallbackStream = stream;
        } else {
          stopMediaStream(stream);
        }
      } catch (error) {
        lastError = error;
      }
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === "videoinput" && device.deviceId);
      const sortedVideoInputs = [...videoInputs].sort((a, b) => {
        const aLabel = a.label.toLowerCase();
        const bLabel = b.label.toLowerCase();
        const aRear = /(back|rear|environment)/i.test(aLabel) ? 0 : 1;
        const bRear = /(back|rear|environment)/i.test(bLabel) ? 0 : 1;
        return aRear - bRear;
      });

      for (const device of sortedVideoInputs) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...baseVideoConstraints,
              deviceId: { exact: device.deviceId },
            },
            audio: false,
          });
          if (mediaStreamSupportsTorch(stream)) {
            stopMediaStream(fallbackStream);
            return stream;
          }
          if (!fallbackStream) {
            fallbackStream = stream;
          } else {
            stopMediaStream(stream);
          }
        } catch {
          // Some mobile browsers expose camera ids that cannot be reopened directly.
        }
      }
    } catch {
      // Device enumeration is a best-effort step after camera permission.
    }

    if (fallbackStream) return fallbackStream;
    throw lastError instanceof Error ? lastError : new Error("Camera access failed.");
  };

  const updateTorchSupport = (stream: MediaStream) => {
    const nextTorchSupported = mediaStreamSupportsTorch(stream);
    setTorchSupported(nextTorchSupported);
    setTorchOn(false);
    setTorchError(
      nextTorchSupported
        ? null
        : "Flashlight is not exposed by this browser/camera. Try opening this link in Chrome if your phone has a rear flash."
    );
  };

  const toggleTorch = async () => {
    const track = getActiveVideoTrack();
    if (!track) return;
    const nextTorchOn = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorchOn } as MediaTrackConstraintSet],
      });
      setTorchOn(nextTorchOn);
      setTorchError(null);
    } catch {
      setTorchSupported(false);
      setTorchOn(false);
      setTorchError("Flashlight is not available from this browser.");
    }
  };

  const clearRecordingTimers = () => {
    if (recordingStopTimerRef.current !== null) {
      window.clearTimeout(recordingStopTimerRef.current);
      recordingStopTimerRef.current = null;
    }
    if (recordingCountdownTimerRef.current !== null) {
      window.clearInterval(recordingCountdownTimerRef.current);
      recordingCountdownTimerRef.current = null;
    }
  };

  const stopCameraRecording = () => {
    clearRecordingTimers();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const closeCameraPreview = () => {
    clearRecordingTimers();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    setRecordingKey(null);
    setRecordingStarted(false);
    setRecordingSecondsLeft(STAGE_VIDEO_MAX_DURATION_SECONDS);
    stopActiveCameraStream();
  };

  const requestLocationProof = async (
    job: EmployeeJob,
    stage: (typeof STAGES)[number]["key"]
  ): Promise<LocationProof> => {
    const nextRecordingKey = `${job.id}:${stage}`;
    if (!navigator.geolocation) {
      throw new Error("This phone cannot verify location. Use a browser with location access enabled.");
    }
    setStageFeedback((prev) => ({
      ...prev,
      [nextRecordingKey]: {
        status: "uploading",
        message: "Allow location access so Reliance can confirm this recording is at the registered business address.",
      },
    }));
    return new Promise<LocationProof>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy)) {
            reject(new Error("Location verification returned invalid coordinates. Try again from the job location."));
            return;
          }
          resolve({
            latitude,
            longitude,
            accuracyMeters: accuracy,
            capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
            source: "browser_geolocation",
          });
        },
        () => reject(new Error("Location access was blocked. Allow location access, then tap the stage again.")),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
      );
    });
  };

  const prepareCapturedDraftFromFile = async (
    job: EmployeeJob,
    stage: (typeof STAGES)[number]["key"],
    file: File,
    source: "native-camera" | "recorder" = "native-camera",
    locationProof: LocationProof | null = null
  ) => {
    const nextRecordingKey = `${job.id}:${stage}`;
    let durationSeconds = 1;
    let durationWarning = false;
    try {
      durationSeconds = await getVideoFileDurationSeconds(file);
      if (isOverStageVideoLimit(durationSeconds)) {
        setStageFeedback((prev) => ({
          ...prev,
          [nextRecordingKey]: {
            status: "error",
            message: `Clip is ${formatStageVideoDuration(durationSeconds)}. Retake a ${formatStageVideoDuration(
              STAGE_VIDEO_MAX_DURATION_SECONDS
            )} max video.`,
          },
        }));
        return;
      }
    } catch {
      durationWarning = true;
    }
    clearCapturedDraft();
    const previewUrl = URL.createObjectURL(file);
    capturedDraftUrlRef.current = previewUrl;
    setCapturedDraft({ jobId: job.id, stage, file, previewUrl, durationSeconds, locationProof });
    setStageFeedback((prev) => ({
      ...prev,
      [nextRecordingKey]: {
        status: durationWarning ? "uploading" : "success",
        message: durationWarning
          ? "Preview the video. Reliance will verify the 30-second limit when you confirm."
          : "Preview the video. Confirm to save it to the project, or retake it.",
      },
    }));
  };

  const openNativeCameraFallback = (
    job: EmployeeJob,
    stage: (typeof STAGES)[number]["key"],
    locationProof: LocationProof | null,
    message = "Opening the phone camera. After recording, preview it here before saving."
  ) => {
    const nextRecordingKey = `${job.id}:${stage}`;
    fallbackCaptureRef.current = { job, stage, locationProof };
    setRecordingOpeningKey(null);
    setStageFeedback((prev) => ({
      ...prev,
      [nextRecordingKey]: {
        status: "uploading",
        message,
      },
    }));
    fallbackCaptureInputRef.current?.click();
  };

  const openNativeCameraForFlash = () => {
    const context = activeCameraContextRef.current;
    if (!context) return;
    const { job, stage, locationProof } = context;
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    setRecordingKey(null);
    setRecordingSecondsLeft(STAGE_VIDEO_MAX_DURATION_SECONDS);
    stopActiveCameraStream();
    openNativeCameraFallback(
      job,
      stage,
      locationProof,
      "Opening your phone camera. Use the phone flash if needed, then preview it here before saving."
    );
  };

  const startCameraRecording = async (
    job: EmployeeJob,
    stage: (typeof STAGES)[number]["key"]
  ) => {
    const nextRecordingKey = `${job.id}:${stage}`;
    setError(null);
    setActionMessage(null);
    setRecordingOpeningKey(nextRecordingKey);
    const needsLocationProof = employeePhoneLocationRequired(job);
    setStageFeedback((prev) => ({
      ...prev,
      [nextRecordingKey]: {
        status: "uploading",
        message: needsLocationProof
          ? "Checking location before opening the camera."
          : "Opening the camera.",
      },
    }));
    clearCapturedDraft();
    let locationProof: LocationProof | null = null;
    if (needsLocationProof) {
      try {
        locationProof = await requestLocationProof(job, stage);
      } catch (error) {
        setStageFeedback((prev) => ({
          ...prev,
          [nextRecordingKey]: {
            status: "error",
            message: error instanceof Error ? error.message : "Location verification failed. Try again.",
          },
        }));
        setRecordingOpeningKey(null);
        return;
      }
    }
    setStageFeedback((prev) => ({
      ...prev,
      [nextRecordingKey]: {
        status: "uploading",
        message: `Opening the camera. Start recording when the shot is framed. Recording stops automatically at ${formatStageVideoDuration(
          STAGE_VIDEO_MAX_DURATION_SECONDS
        )}.`,
      },
    }));

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      openNativeCameraFallback(job, stage, locationProof, "Your browser needs the phone camera recorder. Record the clip, then preview it here before saving.");
      return;
    }

    try {
      const stream = await requestRearCameraStream();
      activeCameraContextRef.current = { job, stage, locationProof };
      activeCameraStreamRef.current = stream;
      mediaRecorderRef.current = null;
      recordingChunksRef.current = [];
      setRecordingKey(nextRecordingKey);
      setRecordingOpeningKey(null);
      setRecordingStarted(false);
      setRecordingSecondsLeft(STAGE_VIDEO_MAX_DURATION_SECONDS);
      setActiveCameraStream(stream);
      updateTorchSupport(stream);
      setStageFeedback((prev) => ({
        ...prev,
        [nextRecordingKey]: {
          status: "uploading",
          message: "Camera is ready. Frame the shot, then tap Start Recording.",
        },
      }));
    } catch (error) {
      setRecordingKey(null);
      setRecordingOpeningKey(null);
      setRecordingStarted(false);
      setRecordingSecondsLeft(STAGE_VIDEO_MAX_DURATION_SECONDS);
      stopActiveCameraStream();
      if (error instanceof Error && error.name === "NotAllowedError") {
        setStageFeedback((prev) => ({
          ...prev,
          [nextRecordingKey]: {
            status: "error",
            message: "Camera access was blocked. Allow camera access in the browser and tap the stage again.",
          },
        }));
      } else {
        openNativeCameraFallback(job, stage, locationProof, "The in-page camera did not open on this phone. Use the phone camera recorder, then preview it here before saving.");
      }
    }
  };

  const beginCameraRecording = () => {
    const context = activeCameraContextRef.current;
    const stream = activeCameraStreamRef.current;
    if (!context || !stream || !recordingKey) return;

    const { job, stage, locationProof } = context;
    const nextRecordingKey = `${job.id}:${stage}`;
    try {
      const mimeType = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const startedAt = Date.now();
      recordingChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      setRecordingStarted(true);
      setRecordingSecondsLeft(STAGE_VIDEO_MAX_DURATION_SECONDS);
      setStageFeedback((prev) => ({
        ...prev,
        [nextRecordingKey]: {
          status: "uploading",
          message: `Recording live camera video. Recording stops automatically at ${formatStageVideoDuration(
            STAGE_VIDEO_MAX_DURATION_SECONDS
          )}.`,
        },
      }));

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        setStageFeedback((prev) => ({
          ...prev,
          [nextRecordingKey]: {
            status: "error",
            message: "Camera recording failed. Retake this stage from the camera.",
          },
        }));
        stopActiveCameraStream(stream);
        setRecordingKey(null);
        setRecordingStarted(false);
      };
      recorder.onstop = () => {
        clearRecordingTimers();
        const durationSeconds = Math.max(
          1,
          Math.min(STAGE_VIDEO_MAX_DURATION_SECONDS, (Date.now() - startedAt) / 1000)
        );
        const blobType = recorder.mimeType || "video/webm";
        const blob = new Blob(recordingChunksRef.current, { type: blobType });
        const extension = blobType.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `${stage.toLowerCase()}-${Date.now()}.${extension}`, {
          type: blobType,
        });
        const previewUrl = URL.createObjectURL(blob);
        capturedDraftUrlRef.current = previewUrl;
        stopActiveCameraStream(stream);
        setRecordingKey(null);
        setRecordingStarted(false);
        setCapturedDraft({ jobId: job.id, stage, file, previewUrl, durationSeconds, locationProof });
        setStageFeedback((prev) => ({
          ...prev,
          [nextRecordingKey]: {
            status: "success",
            message: "Preview the video. Confirm to save it to the project, or retake it.",
          },
        }));
      };

      recorder.start();
      recordingCountdownTimerRef.current = window.setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
        setRecordingSecondsLeft(Math.max(0, STAGE_VIDEO_MAX_DURATION_SECONDS - elapsedSeconds));
      }, 250);
      recordingStopTimerRef.current = window.setTimeout(
        () => stopCameraRecording(),
        STAGE_VIDEO_MAX_DURATION_SECONDS * 1000
      );
    } catch (error) {
      setRecordingKey(null);
      setRecordingStarted(false);
      setRecordingSecondsLeft(STAGE_VIDEO_MAX_DURATION_SECONDS);
      stopActiveCameraStream();
      setStageFeedback((prev) => ({
        ...prev,
        [nextRecordingKey]: {
          status: "error",
          message: error instanceof Error ? error.message : "Camera recording failed. Retake this stage from the camera.",
        },
      }));
    }
  };

  const confirmCapturedDraft = async (job: EmployeeJob) => {
    if (!capturedDraft || capturedDraft.jobId !== job.id) return;
    const draft = capturedDraft;
    setCapturedDraft(null);
    if (capturedDraftUrlRef.current === draft.previewUrl) {
      capturedDraftUrlRef.current = null;
    }
    URL.revokeObjectURL(draft.previewUrl);
    await uploadStageVideo(job, draft.stage, draft.file, draft.durationSeconds, draft.locationProof);
  };

  const renderJobCard = (job: EmployeeJob, historyMode = false) => {
    const openedFromAssignmentLink = !historyMode && focusedJobId === job.id;
    const normalizedStatus = String(job.status || "").trim().toUpperCase();
    const showUploadControls = !historyMode && shouldAllowStageUpload(normalizedStatus);
    const showStartButton = !historyMode && shouldShowEmployeeStartButton(normalizedStatus);
    const helperText = historyMode ? null : submitHelperText(job);
    const selectedStageKey =
      focusedStageByJobId[job.id] || getNextEmployeeCaptureStage(job.stageProgress);
    const selectedStage = STAGES.find((stage) => stage.key === selectedStageKey) || STAGES[0];
    const selectedStageDone = Boolean(job.stageProgress[selectedStage.key]);
    const selectedStageFeedbackKey = `${job.id}:${selectedStage.key}`;
    const completedStageCount = getCompletedEmployeeCaptureCount(job.stageProgress);
    const stageProgressLabel = `Step ${getEmployeeStageStep(selectedStage.key)} of ${STAGES.length}`;
    const captureDeviceLabel = getEmployeeCaptureDeviceLabel(pairedDevice);
    const captureSupportCopy = getEmployeeCaptureSupportCopy(pairedDevice);
    const selectedDraft =
      capturedDraft?.jobId === job.id && capturedDraft.stage === selectedStage.key ? capturedDraft : null;
    const selectedRecordingKey = `${job.id}:${selectedStage.key}`;
    const isRecordingSelectedStage = recordingKey === selectedRecordingKey;
    const isRecordingAnotherStage = Boolean(recordingKey && recordingKey !== selectedRecordingKey);
    const isOpeningSelectedStage = recordingOpeningKey === selectedRecordingKey;
    const selectedStageFeedback = stageFeedback[selectedStageFeedbackKey] || null;
    const canOfferNativeCameraRetry =
      hasCaptureToken &&
      showUploadControls &&
      !selectedDraft &&
      !isRecordingSelectedStage &&
      selectedStageFeedback?.status === "error";
    const canStartStageFromCard =
      hasCaptureToken &&
      showUploadControls &&
      !selectedDraft &&
      !recordingKey &&
      !recordingOpeningKey &&
      !uploadingKey;
    const countdownIsUrgent = recordingSecondsLeft <= 10;

    return (
      <Fragment key={job.id}>
      {isRecordingSelectedStage ? (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-black/85 via-black/30 to-transparent px-5 pb-10 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">
              {recordingStarted ? "Recording stage" : "Camera ready"}
            </p>
            <h2 className="mt-1 text-2xl font-bold leading-tight">{selectedStage.label}</h2>
            <p className="mt-1 text-sm leading-5 text-blue-50/85">{selectedStage.cue}</p>
          </div>
          <video
            ref={liveVideoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full flex-1 bg-black object-cover"
          />
          {!recordingStarted ? (
            <button
              type="button"
              onClick={closeCameraPreview}
              className="absolute right-4 top-4 z-30 rounded-full border border-white/25 bg-black/75 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-black/40 transition active:scale-[0.98]"
              aria-label="Cancel recording and choose another stage"
            >
              Cancel
            </button>
          ) : null}
          {recordingStarted ? (
            <div
              className={`absolute right-4 top-4 z-20 rounded-full border px-4 py-2 text-lg font-black shadow-lg ${
                countdownIsUrgent
                  ? "border-red-300 bg-red-600 text-white"
                  : "border-white/35 bg-black/70 text-white"
              }`}
            >
              0:{String(recordingSecondsLeft).padStart(2, "0")}
            </div>
          ) : null}
          <div
            className="absolute bottom-0 left-0 right-0 z-20 space-y-3 bg-gradient-to-t from-black via-black/95 to-transparent px-5 pb-5 pt-16"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            {!recordingStarted ? (
              <p className="rounded-xl border border-blue-300/50 bg-blue-600/20 px-4 py-3 text-center text-base font-bold text-blue-50">
                Frame the shot first. The 30-second timer starts after you tap Start Recording.
              </p>
            ) : countdownIsUrgent ? (
              <p className="rounded-xl border border-red-300/60 bg-red-600/25 px-4 py-3 text-center text-base font-bold text-red-50">
                Finish the shot. Recording stops soon.
              </p>
            ) : null}
            {torchSupported ? (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-base font-bold text-white transition active:scale-[0.99]"
                aria-pressed={torchOn}
              >
                {torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
                {torchOn ? "Turn Flashlight Off" : "Turn Flashlight On"}
              </button>
            ) : torchError ? (
              <div>
                {!recordingStarted ? (
                  <button
                    type="button"
                    onClick={openNativeCameraForFlash}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200/70 bg-white/12 px-5 py-3 text-base font-bold text-white shadow-lg shadow-black/35 transition active:scale-[0.99]"
                  >
                    <Flashlight className="h-5 w-5" />
                    Use Phone Camera With Flash
                  </button>
                ) : null}
              </div>
            ) : null}
            {recordingStarted ? (
              <button
                type="button"
                onClick={stopCameraRecording}
                className="w-full rounded-2xl border border-blue-200 bg-blue-600 px-5 py-4 text-lg font-bold text-white shadow-lg shadow-blue-950/40 transition active:scale-[0.99]"
              >
                Stop and Preview
              </button>
            ) : (
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={beginCameraRecording}
                  className="w-full rounded-2xl border border-blue-200 bg-blue-600 px-5 py-4 text-lg font-bold text-white shadow-lg shadow-blue-950/40 transition active:scale-[0.99]"
                >
                  Start Recording
                </button>
                <button
                  type="button"
                  onClick={closeCameraPreview}
                  className="w-full rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-base font-bold text-white transition active:scale-[0.99]"
                >
                  Cancel and Choose Another Stage
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {selectedDraft ? (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-black/85 via-black/30 to-transparent px-5 pb-10 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Preview before saving</p>
            <h2 className="mt-1 text-2xl font-bold leading-tight">{selectedStage.label}</h2>
            <p className="mt-1 text-sm leading-5 text-blue-50/85">
              Confirm to save this clip to the project, or retake it now.
            </p>
          </div>
          <video
            src={selectedDraft.previewUrl}
            controls
            playsInline
            className="h-full w-full flex-1 bg-black object-contain"
          />
          <div
            className="absolute bottom-0 left-0 right-0 z-20 space-y-3 bg-gradient-to-t from-black via-black/95 to-transparent px-5 pb-5 pt-16"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={() => void confirmCapturedDraft(job)}
              disabled={Boolean(uploadingKey)}
              className="w-full rounded-2xl border border-emerald-200 bg-emerald-600 px-5 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-950/40 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploadingKey === selectedStageFeedbackKey ? "Saving..." : "Confirm and Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                clearCapturedDraft();
                void startCameraRecording(job, selectedStage.key);
              }}
              disabled={Boolean(uploadingKey)}
              className="w-full rounded-2xl border border-white/25 bg-white/10 px-5 py-4 text-lg font-bold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Retake
            </button>
          </div>
        </div>
      ) : null}
      <div
        key={job.id}
        className={`rounded-2xl border p-4 shadow-sm ${
          openedFromAssignmentLink
            ? "border-blue-400/35 bg-blue-950/45 text-blue-50"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            {openedFromAssignmentLink ? (
              <p className="mb-2 inline-flex rounded-full border border-blue-300/30 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-100">
                Job assignment
              </p>
            ) : null}
            <p className={`text-base font-semibold ${openedFromAssignmentLink ? "text-white" : "text-gray-900"}`}>
              {job.title}
            </p>
            <p className={`text-xs ${openedFromAssignmentLink ? "text-blue-100/70" : "text-gray-500"}`}>
              {job.vendorName}
            </p>
            <p className={`mt-1 text-xs ${openedFromAssignmentLink ? "text-blue-50/75" : "text-gray-600"}`}>
              Customer: {job.customer.name || "Unknown"}
              {job.customer.phone ? ` - ${job.customer.phone}` : ""}
            </p>
            {job.bookingDate ? (
              <p className={`mt-1 text-[11px] ${openedFromAssignmentLink ? "text-blue-100/60" : "text-gray-500"}`}>
                Service date: {new Date(job.bookingDate).toLocaleString()}
              </p>
            ) : null}
          </div>
          {!hasCaptureToken ? (
            <span className="rounded border bg-gray-100 px-2 py-1 text-xs text-gray-700">
              {normalizeEmployeeJobStatusLabel(job.status)}
            </span>
          ) : null}
        </div>

        {historyMode ? (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
            {STAGES.map((stage) => (
              <span
                key={`${job.id}:${stage.key}:history`}
                className={`rounded px-2 py-1 ${
                  job.stageProgress[stage.key]
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {stage.label}: {job.stageProgress[stage.key] ? "Uploaded" : "Missing"}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {STAGES.map((stage, index) => {
                const done = Boolean(job.stageProgress[stage.key]);
                const selected = selectedStage.key === stage.key;
                const stageActionKey = `${job.id}:${stage.key}`;
                const isOpeningThisStage = recordingOpeningKey === stageActionKey;
                const canStartThisStage = canStartStageFromCard;
                return (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() => {
                      setFocusedStageByJobId((current) => ({
                        ...current,
                        [job.id]: stage.key,
                      }));
                      if (canStartThisStage) {
                        void startCameraRecording(job, stage.key);
                      }
                    }}
                    disabled={Boolean(hasCaptureToken && (isRecordingAnotherStage || recordingOpeningKey || uploadingKey))}
                    className={`min-h-[128px] rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-blue-300 bg-blue-600/35 shadow-[0_0_0_1px_rgba(147,197,253,0.35)]"
                        : done
                          ? "border-emerald-400/35 bg-emerald-500/12 hover:border-emerald-300"
                          : "border-white/10 bg-slate-950/55 hover:border-blue-300/60 hover:bg-blue-600/10"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-base font-bold ${
                            isOpeningThisStage
                              ? "border-blue-200 bg-blue-200 text-blue-950"
                              : done
                            ? "border-emerald-300 bg-emerald-400/20 text-emerald-100"
                            : selected
                              ? "border-blue-200 bg-blue-200 text-blue-950"
                              : "border-blue-200/30 bg-white/5 text-blue-100"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-lg font-bold leading-6 text-white">{stage.label}</p>
                        <p className="mt-2 text-sm leading-6 text-blue-50/85">{stage.cue}</p>
                        <p
                          className={`mt-4 inline-flex rounded-full px-4 py-2 text-sm font-bold ${
                            isOpeningThisStage
                              ? "bg-blue-300/25 text-blue-50"
                              : done
                              ? "bg-emerald-400/15 text-emerald-100"
                              : hasCaptureToken
                                ? "bg-blue-300/15 text-blue-100"
                                : "bg-white/10 text-blue-100"
                          }`}
                        >
                          {getStageCardActionLabel({
                            isOpening: isOpeningThisStage,
                            isSaved: done,
                            hasDraft: Boolean(capturedDraft?.jobId === job.id && capturedDraft.stage === stage.key),
                            hasCaptureToken,
                            stage: stage.key,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-200">
                    {stageProgressLabel}
                  </p>
                  <h3 className="text-2xl font-bold leading-tight text-white">
                    {getEmployeeCaptureStageHeading(selectedStage.key)}
                  </h3>
                  <p className="text-base leading-7 text-blue-50/80">{selectedStage.cue}</p>
                </div>
                <div className="space-y-1 text-left sm:text-right">
                  <p className="text-base font-bold text-blue-50">
                    {completedStageCount} of {STAGES.length} stages uploaded
                  </p>
                  <p className={`text-base font-bold ${selectedStageDone ? "text-emerald-200" : "text-amber-200"}`}>
                    {selectedStageDone ? "This stage already has a video." : "This stage still needs a video."}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-base text-blue-50/85 sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-white">Capture source:</span> {captureDeviceLabel}
                </p>
                <p className="font-semibold text-blue-200">{getStageVideoLimitCopy()}</p>
              </div>
              <p className="mt-3 text-base leading-7 text-blue-50/75">
                {hasCaptureToken
                  ? "Tap the stage card above to open the camera. If your phone asks for camera or microphone access, choose Allow."
                  : captureSupportCopy}
              </p>

              {selectedStageDone ? (
                <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3">
                  <p className="text-sm font-semibold text-amber-100">
                    This stage is saved. You can replace it before sending all videos to the manager.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-100/75">
                    Retaking this stage replaces the current video for this step after you confirm the new preview.
                  </p>
                </div>
              ) : null}

              {showUploadControls ? (
                <div className="mt-3 space-y-3">
                  {isRecordingSelectedStage ? (
                    <p className="rounded-xl border border-blue-300/20 bg-blue-300/10 px-4 py-3 text-base font-semibold text-blue-50">
                      Camera is open full screen.
                    </p>
                  ) : isOpeningSelectedStage ? (
                    <p className="rounded-xl border border-blue-300/25 bg-blue-300/10 px-4 py-3 text-base font-semibold text-blue-50">
                      Opening camera. Allow location or camera access if your phone asks.
                    </p>
                  ) : selectedDraft ? (
                    <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-base font-semibold text-emerald-50">
                      Preview is open full screen. Confirm to save it, or retake the clip.
                    </p>
                  ) : hasCaptureToken ? (
                    <div className="space-y-2">
                      <p className="rounded-xl border border-blue-300/15 bg-blue-300/5 px-4 py-3 text-base leading-7 text-blue-50/80">
                        {selectedStageDone
                          ? "This saved stage can be replaced if the video needs to be fixed. Nothing changes until you confirm the new preview."
                          : "Select a stage card above to record directly from this device. Nothing is saved until you confirm the preview."}
                      </p>
                      {selectedStageDone ? (
                        <button
                          type="button"
                          onClick={() => void startCameraRecording(job, selectedStage.key)}
                          disabled={Boolean(uploadingKey) || Boolean(recordingOpeningKey) || isRecordingAnotherStage}
                          className="w-full rounded-xl border border-amber-200 bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Retake Saved Video
                        </button>
                      ) : null}
                      {canOfferNativeCameraRetry ? (
                        <button
                          type="button"
                          onClick={() => void startCameraRecording(job, selectedStage.key)}
                          className="w-full rounded-xl border border-blue-300 bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                          Open Phone Camera
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void startCameraRecording(job, selectedStage.key)}
                        disabled={Boolean(uploadingKey) || Boolean(recordingOpeningKey) || isRecordingAnotherStage}
                        className="rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Record Live Camera
                      </button>
                      <span className="text-[11px] text-blue-100/60">
                        Record directly from this device. Nothing is saved until you confirm the preview.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-blue-100/60">
                  Uploads are locked while manager review is pending.
                </p>
              )}

              {selectedStageFeedback && !isRecordingSelectedStage && !selectedDraft ? (
                <p
                  className={`mt-3 text-sm font-semibold ${
                    selectedStageFeedback.status === "error"
                      ? "text-red-200"
                      : selectedStageFeedback.status === "success"
                      ? "text-emerald-200"
                      : "text-blue-200"
                  }`}
                >
                  {selectedStageFeedback.message}
                </p>
              ) : null}
            </div>
          </div>
        )}

        {job.rejectionReason && normalizedStatus === "IN_PROGRESS" ? (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold">Manager requested changes</p>
            <p className="mt-1">{job.rejectionReason}</p>
            <p className="mt-2 text-[11px] text-amber-900">
              Review the requested changes, re-upload the needed video stage, then submit again.
            </p>
            {job.rejectedAt ? (
              <p className="mt-1 text-[11px] text-amber-700">
                Rejected on {new Date(job.rejectedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        ) : null}

        {!historyMode ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {showStartButton && !hasCaptureToken ? (
              <button
                type="button"
                onClick={() => void startJob(job.id)}
                className="rounded border border-blue-300 px-3 py-1 text-xs text-blue-700 hover:bg-blue-50"
              >
                Start Job
              </button>
            ) : null}
            <button
              type="button"
              disabled={!job.canMarkComplete || isAwaitingReviewStatus(normalizedStatus) || isCompletedStatus(normalizedStatus)}
              onClick={() => void completeJob(job.id)}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                hasCaptureToken
                  ? "w-full border-emerald-300 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                  : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              {hasCaptureToken ? captureLinkSubmitButtonLabel(normalizedStatus) : submitButtonLabel(normalizedStatus)}
            </button>
            {helperText ? (
              <span className={`text-xs ${hasCaptureToken ? "text-blue-100/70" : "text-gray-500"}`}>
                {helperText}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      </Fragment>
    );
  };

  if (authLoading && !hasCaptureToken) {
    return (
      <div className="reliance-operator-shell reliance-grid-lines min-h-screen p-4">
        <div className="mx-auto w-full max-w-2xl rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-900">Checking employee access...</p>
          <p className="mt-2 text-sm text-gray-600">
            Reliance is confirming this employee session before loading assigned jobs.
          </p>
        </div>
      </div>
    );
  }

  if (!userId && !hasCaptureToken) {
    return (
      <div className="reliance-operator-shell reliance-grid-lines min-h-screen p-4">
        <div className="mx-auto w-full max-w-2xl rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Employee access required</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in with an employee-enabled account to open assigned jobs and stage uploads.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/auth/login?next=%2Femployee%2Fjobs"
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Sign in
            </Link>
            <Link
              href="/help"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Support &amp; Help
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reliance-operator-shell reliance-grid-lines min-h-screen p-4">
      <input
        ref={fallbackCaptureInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          setRecordingOpeningKey(null);
          const file = event.currentTarget.files?.[0];
          const fallbackCapture = fallbackCaptureRef.current;
          event.currentTarget.value = "";
          if (!file || !fallbackCapture) return;
          void prepareCapturedDraftFromFile(
            fallbackCapture.job,
            fallbackCapture.stage,
            file,
            "native-camera",
            fallbackCapture.locationProof
          );
        }}
      />
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="reliance-operator-hero rounded-[28px] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
                {hasCaptureToken ? "Job recording link" : "Employee workspace"}
              </div>
              <h1 className="mt-4 text-2xl font-bold text-gray-900">
                {hasCaptureToken ? "Record Service Videos" : "Assigned Jobs"}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                {hasCaptureToken
                  ? "Use this phone to record each short stage, preview it, then save it to the project."
                  : "Mobile-friendly employee workflow for Starting Condition, Work in Progress, and Final Result videos."}
              </p>
            </div>
            {!hasCaptureToken ? (
              <div className="flex flex-wrap gap-2">
                <TutorialEntryPoint guide={tutorialGuides.employeeJobs} surface="dark" />
                <Link
                  href="/help"
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Support &amp; Help
                </Link>
                <Link
                  href="/logout"
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Sign Out
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {hasCaptureToken ? (
          <div className="rounded-2xl border border-blue-400/30 bg-blue-950/35 p-4 text-blue-50 shadow-sm">
            <p className="text-sm font-semibold">3 short videos. Preview before saving.</p>
            <p className="mt-1 text-xs leading-5 text-blue-100/80">
              Tap a stage card, allow camera access if your phone asks, then confirm the preview before moving on.
            </p>
          </div>
        ) : (
          <GuidanceCallout
            title="How the stage-video workflow progresses"
            description="Employees capture Starting Condition, Work in Progress, and Final Result videos in order, then submit the full package for manager review."
            bullets={[
              'Starting Condition video shows what the customer should see before work begins.',
              'Work in Progress video shows active work or progress while the service is happening.',
              'Final Result video shows the finished outcome customers will later understand.',
            ]}
            tone="blue"
          />
        )}

        {error ? (
          <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        ) : null}
        {actionMessage ? (
          <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {actionMessage}
          </p>
        ) : null}

        {loading ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Loading assigned jobs. If nothing appears after a moment, reload or ask your manager to confirm a job is assigned to this account.
          </div>
        ) : null}

        {!loading && error && jobs.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-sm font-semibold text-amber-900">Employee workspace temporarily unavailable</p>
            <p className="mt-1 text-sm text-amber-800">
              Your assigned jobs could not be loaded right now. This usually means the connected database is paused or
              temporarily unavailable.
            </p>
            <ul className="mt-3 space-y-2 text-xs text-amber-800">
              <li>1. Reload this page in a minute to retry.</li>
              <li>2. If the problem continues, ask your manager to confirm Reliance is fully online.</li>
              <li>3. Do not assume your job queue is empty until this warning clears.</li>
            </ul>
          </div>
        ) : null}

        {!loading && !error && jobs.length === 0 ? (
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            {pendingServiceOrderMessage ? (
              <>
                <p className="text-sm font-semibold text-gray-900">Service order not ready yet</p>
                <p className="mt-1 text-sm text-gray-600">{pendingServiceOrderMessage}</p>
                <ul className="mt-3 space-y-2 text-xs text-gray-700">
                  <li>1. Keep this email link.</li>
                  <li>2. Wait for your manager to finish the required checks.</li>
                  <li>3. Open the link again when your manager confirms the order is ready.</li>
                </ul>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-900">Welcome to your work view</p>
                <p className="mt-1 text-sm text-gray-600">
                  You do not have any jobs assigned yet. When your manager assigns one, it will appear here.
                </p>
                <ul className="mt-3 space-y-2 text-xs text-gray-700">
                  <li>1. Open the assigned job link on the phone you will use on-site.</li>
                  <li>2. Keep the page open while you capture each short service-video stage.</li>
                  <li>
                    3. When a job appears, tap <span className="font-semibold">Start Job</span>, capture Starting
                    Condition / Work in Progress / Final Result, then submit for manager review.
                  </li>
                </ul>
              </>
            )}
          </div>
        ) : null}

        {!loading && !error && focusedJobId && jobs.length > 0 && !jobs.some((job) => job.id === focusedJobId) ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
            This assignment link opened correctly, but that job is not currently assigned to this employee account.
            Ask the manager to confirm the job assignment if you expected to see it here.
          </div>
        ) : null}

        {!loading && currentJobs.length === 0 && completedJobs.length > 0 ? (
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">No active jobs right now</p>
            <p className="mt-1 text-sm text-gray-600">
              Your actionable work queue is clear. Completed jobs are tucked into history so this page stays focused on
              current work.
            </p>
            <button
              type="button"
              onClick={() => setShowCompletedHistory((value) => !value)}
              className="mt-3 rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {showCompletedHistory ? "Hide completed history" : `Show completed history (${completedJobs.length})`}
            </button>
          </div>
        ) : null}

        {currentJobs.map((job) => renderJobCard(job))}

        {completedJobs.length > 0 ? (
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Completed history</p>
                <p className="mt-1 text-sm text-gray-600">
                  Older finished jobs are kept out of the main workflow so this screen stays focused on current work.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCompletedHistory((value) => !value)}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {showCompletedHistory ? "Hide completed jobs" : `Show completed jobs (${completedJobs.length})`}
              </button>
            </div>

            {showCompletedHistory ? (
              <div className="mt-4 space-y-3">
                {completedJobs.slice(0, 8).map((job) => renderJobCard(job, true))}
                {completedJobs.length > 8 ? (
                  <p className="text-xs text-gray-500">
                    Showing the latest 8 completed jobs out of {completedJobs.length}.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
