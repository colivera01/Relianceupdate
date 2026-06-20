import type { VendorJobVideoStage } from "@/lib/vendor-job-video-stages";

export type EmployeeStageProgress = Record<VendorJobVideoStage, boolean>;

export type EmployeeCaptureDevice = {
  deviceType?: string | null;
  deviceName?: string | null;
  model?: string | null;
  os?: string | null;
};

export const EMPLOYEE_STAGE_ORDER: VendorJobVideoStage[] = [
  "INTRO",
  "IN_PROGRESS",
  "COMPLETED",
];

export function getNextEmployeeCaptureStage(progress: EmployeeStageProgress): VendorJobVideoStage {
  for (const stage of EMPLOYEE_STAGE_ORDER) {
    if (!progress[stage]) return stage;
  }
  return "COMPLETED";
}

export function getEmployeeStageStep(stage: VendorJobVideoStage): number {
  return Math.max(1, EMPLOYEE_STAGE_ORDER.indexOf(stage) + 1);
}

export function getCompletedEmployeeCaptureCount(progress: EmployeeStageProgress): number {
  return EMPLOYEE_STAGE_ORDER.filter((stage) => progress[stage]).length;
}

export function getEmployeeCaptureActionLabel(
  stage: VendorJobVideoStage,
  hasExistingVideo: boolean
): string {
  const prefix = hasExistingVideo ? "Retake" : "Record";
  if (stage === "INTRO") return `${prefix} Before`;
  if (stage === "IN_PROGRESS") return `${prefix} During`;
  return `${prefix} Completed`;
}

export function getEmployeeCaptureStageHeading(stage: VendorJobVideoStage): string {
  if (stage === "INTRO") return "Capture the before view";
  if (stage === "IN_PROGRESS") return "Capture the work in progress";
  return "Capture the completed result";
}

export function getEmployeeCaptureDeviceLabel(device: EmployeeCaptureDevice | null): string {
  const deviceType = String(device?.deviceType || "").trim().toUpperCase();
  if (deviceType === "HEADSET") return "Headset capture";
  if (deviceType === "PHONE") return "This phone";
  const fallback = String(device?.deviceName || device?.model || "").trim();
  return fallback || "This device";
}

export function getEmployeeCaptureSupportCopy(device: EmployeeCaptureDevice | null): string {
  const deviceType = String(device?.deviceType || "").trim().toUpperCase();
  if (deviceType === "HEADSET") {
    return "Capture this stage hands-free, then review and retake it before moving on if needed.";
  }
  return "Use the phone camera for a short clip that clearly shows this stage. You can retake the stage on-site before moving on.";
}
