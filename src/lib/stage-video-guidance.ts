import type { VendorJobVideoStage } from "@/lib/vendor-job-video-stages";

export const STAGE_VIDEO_MAX_DURATION_SECONDS = 30;

export const STAGE_VIDEO_GUIDANCE: Record<
  VendorJobVideoStage,
  { label: string; cue: string }
> = {
  INTRO: {
    label: "Before Service",
    cue: "Show the area or condition before work begins.",
  },
  IN_PROGRESS: {
    label: "During Service",
    cue: "Show active progress or work being performed.",
  },
  COMPLETED: {
    label: "Completed",
    cue: "Show the final result clearly.",
  },
};

export function getStageVideoGuidance(stage: VendorJobVideoStage | "" | null | undefined) {
  return stage ? STAGE_VIDEO_GUIDANCE[stage] ?? null : null;
}

export function formatStageVideoDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds || 0));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function getStageVideoLimitCopy() {
  return `Keep each stage video to ${formatStageVideoDuration(STAGE_VIDEO_MAX_DURATION_SECONDS)} or less.`;
}

export function isOverStageVideoLimit(seconds: number) {
  return Number.isFinite(seconds) && seconds > STAGE_VIDEO_MAX_DURATION_SECONDS;
}

export function getVideoFileDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Could not read video duration."));
        return;
      }
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Could not read video duration."));
    };
    video.src = objectUrl;
  });
}
