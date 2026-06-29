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
    src: "/homepage/service-video-stages/before-service.mp4",
    accentClassName: "text-[#8CB6FF]",
    glowClassName: "from-[#246BFF]/30 via-[#82A7FF]/18 to-transparent",
    shellClassName: "border-[#246BFF]/28 bg-[linear-gradient(180deg,rgba(10,27,55,0.96),rgba(6,14,27,0.96))]",
  },
  {
    title: "Work in Progress",
    cue: "Customers can watch active progress instead of guessing what happened mid-service.",
    previewEndSeconds: 29.76,
    src: "/homepage/service-video-stages/during-service.mp4",
    accentClassName: "text-[#7FD8FF]",
    glowClassName: "from-[#51BFFF]/28 via-[#246BFF]/14 to-transparent",
    shellClassName: "border-[#51BFFF]/24 bg-[linear-gradient(180deg,rgba(8,26,43,0.97),rgba(5,14,24,0.96))]",
  },
  {
    title: "Final Result",
    cue: "Customers can see the finished outcome clearly when the work is complete.",
    previewEndSeconds: 15,
    src: "/homepage/service-video-stages/completed-service.mp4",
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
      className={`group relative overflow-hidden rounded-[32px] border ${stage.shellClassName} p-5 shadow-[0_20px_55px_rgba(3,8,18,0.34)] xl:p-6`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${stage.glowClassName} blur-2xl`}
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center xl:gap-7">
        <div
          className="relative mx-auto w-full max-w-[14rem] overflow-hidden rounded-[24px] border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:mx-0 xl:max-w-[15.5rem] 2xl:max-w-[16.5rem]"
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
            <Badge className="border-white/12 bg-white/8 px-3 py-1 text-sm text-white hover:bg-white/8">
              {stage.title}
            </Badge>
          </div>

          <div className="mt-4 text-3xl font-semibold leading-tight text-white xl:text-[2.35rem]">
            {stage.title}
          </div>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-white/74 xl:text-xl xl:leading-9">
            {stage.cue}
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-base text-white/78 xl:text-lg">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2.5">
              <Clock3 className="h-4 w-4 xl:h-5 xl:w-5" />
              {formatStageVideoDuration(playbackWindow.visibleDurationSeconds)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2.5">
              <Lock className="h-4 w-4 xl:h-5 xl:w-5" />
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
    <div className="reliance-glass rounded-[36px] border border-white/10 px-7 py-7 shadow-[0_30px_80px_rgba(4,9,20,0.36)] xl:px-8 xl:py-8">
      <div className="flex flex-col gap-7">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-white/62 xl:text-sm">
            See how service videos work
          </div>
          <div className="mt-4 font-display text-[2.7rem] font-semibold leading-tight text-white xl:text-[3.25rem] 2xl:text-[3.55rem]">
            Starting condition, work in progress, and final result in one clear story
          </div>
          <p className="mt-5 max-w-5xl text-lg leading-8 text-white/74 xl:text-xl xl:leading-9">
            These are short approved stage previews, not full-job recordings. Each public clip is
            capped at {formatStageVideoDuration(STAGE_VIDEO_MAX_DURATION_SECONDS)} so customers can
            quickly understand the starting condition, the work in progress, and the final result
            before they choose.
          </p>
        </div>

        <div className="space-y-5">
          {STAGE_PREVIEWS.map((stage) => (
            <StageVideoCard key={stage.title} stage={stage} />
          ))}
        </div>

      </div>
    </div>
  );
}
