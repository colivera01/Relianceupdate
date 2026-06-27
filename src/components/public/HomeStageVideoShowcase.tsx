"use client";

import { useEffect, useRef } from "react";
import { Clock3, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  STAGE_VIDEO_MAX_DURATION_SECONDS,
  formatStageVideoDuration,
} from "@/lib/stage-video-guidance";

type StagePreview = {
  title: string;
  cue: string;
  previewEndSeconds: number;
  previewStartSeconds?: number;
  src: string;
  accentClassName: string;
  glowClassName: string;
  shellClassName: string;
};

function getStagePlaybackWindow(stage: StagePreview) {
  const startSeconds = Math.max(0, stage.previewStartSeconds ?? 0);
  const endSeconds = Math.max(
    startSeconds,
    Math.min(STAGE_VIDEO_MAX_DURATION_SECONDS, stage.previewEndSeconds)
  );

  return {
    startSeconds,
    endSeconds,
    visibleDurationSeconds: Math.max(0, endSeconds - startSeconds),
  };
}

const STAGE_PREVIEWS: StagePreview[] = [
  {
    title: "Starting Condition",
    cue: "Customers can see the space, surface, or issue before work begins.",
    previewStartSeconds: 4,
    previewEndSeconds: 20.55,
    src: "/homepage/stage-previews/before.mp4",
    accentClassName: "text-[#8CB6FF]",
    glowClassName: "from-[#246BFF]/30 via-[#82A7FF]/18 to-transparent",
    shellClassName: "border-[#246BFF]/28 bg-[linear-gradient(180deg,rgba(10,27,55,0.96),rgba(6,14,27,0.96))]",
  },
  {
    title: "Work in Progress",
    cue: "Customers can watch active progress instead of guessing what happened mid-service.",
    previewEndSeconds: 29.76,
    src: "/homepage/stage-previews/during.mp4",
    accentClassName: "text-[#7FD8FF]",
    glowClassName: "from-[#51BFFF]/28 via-[#246BFF]/14 to-transparent",
    shellClassName: "border-[#51BFFF]/24 bg-[linear-gradient(180deg,rgba(8,26,43,0.97),rgba(5,14,24,0.96))]",
  },
  {
    title: "Final Result",
    cue: "Customers can see the finished outcome clearly when the work is complete.",
    previewEndSeconds: 15,
    src: "/homepage/stage-previews/completed.mp4",
    accentClassName: "text-[#63E2B5]",
    glowClassName: "from-[#35D6A5]/28 via-[#1E8F77]/14 to-transparent",
    shellClassName: "border-[#35D6A5]/24 bg-[linear-gradient(180deg,rgba(7,29,28,0.96),rgba(6,17,24,0.96))]",
  },
];

function StageVideoCard({ stage }: { stage: StagePreview }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playbackWindow = getStagePlaybackWindow(stage);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const keepPlaying = () => {
      video.muted = true;
      const playAttempt = video.play();
      if (playAttempt && typeof playAttempt.catch === "function") {
        playAttempt.catch(() => {});
      }
    };

    const jumpToPreviewStart = () => {
      if (Math.abs(video.currentTime - playbackWindow.startSeconds) > 0.08) {
        video.currentTime = playbackWindow.startSeconds;
      }
      keepPlaying();
    };

    const keepWithinLimit = () => {
      if (
        video.currentTime >= playbackWindow.endSeconds - 0.08 ||
        video.currentTime < playbackWindow.startSeconds - 0.08
      ) {
        jumpToPreviewStart();
      }
    };

    jumpToPreviewStart();
    video.addEventListener("loadedmetadata", jumpToPreviewStart);
    video.addEventListener("canplay", jumpToPreviewStart);
    video.addEventListener("timeupdate", keepWithinLimit);

    return () => {
      video.removeEventListener("loadedmetadata", jumpToPreviewStart);
      video.removeEventListener("canplay", jumpToPreviewStart);
      video.removeEventListener("timeupdate", keepWithinLimit);
    };
  }, [playbackWindow.endSeconds, playbackWindow.startSeconds]);

  return (
    <div
      className={`group relative overflow-hidden rounded-[26px] border ${stage.shellClassName} p-3 shadow-[0_20px_55px_rgba(3,8,18,0.34)]`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${stage.glowClassName} blur-2xl`}
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="relative mx-auto w-full max-w-[10.5rem] overflow-hidden rounded-[22px] border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:mx-0"
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="aspect-[9/16] w-full bg-slate-950">
            <video
              ref={videoRef}
              src={stage.src}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              controls={false}
              disablePictureInPicture
              controlsList="nodownload nofullscreen noremoteplayback"
              tabIndex={-1}
              draggable={false}
              aria-label={`${stage.title} preview video`}
              className="pointer-events-none h-full w-full select-none object-cover"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,12,0.04),rgba(2,6,12,0.42))]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-white/12 bg-white/8 text-white hover:bg-white/8">
              {stage.title}
            </Badge>
          </div>

          <div className="mt-3 text-xl font-semibold leading-tight text-white">
            {stage.title}
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
            {stage.cue}
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/74">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/6 px-3 py-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {formatStageVideoDuration(playbackWindow.visibleDurationSeconds)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/6 px-3 py-1.5">
              <Lock className="h-3.5 w-3.5" />
              Preview only
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeStageVideoShowcase() {
  return (
    <div className="reliance-glass rounded-[30px] border border-white/10 px-5 py-5 shadow-[0_30px_80px_rgba(4,9,20,0.36)]">
      <div className="flex flex-col gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/62">
            See how service videos work
          </div>
          <div className="mt-3 font-display text-[1.85rem] font-semibold leading-tight text-white">
            Starting condition, work in progress, and final result in one clear story
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
            These are short approved stage previews, not full-job recordings. Each public clip is
            capped at {formatStageVideoDuration(STAGE_VIDEO_MAX_DURATION_SECONDS)} so customers can
            quickly understand the starting condition, the work in progress, and the final result
            before they choose.
          </p>
        </div>

        <div className="space-y-4">
          {STAGE_PREVIEWS.map((stage) => (
            <StageVideoCard key={stage.title} stage={stage} />
          ))}
        </div>

      </div>
    </div>
  );
}
