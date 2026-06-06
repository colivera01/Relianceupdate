'use client';

import { useState } from "react";
import { PlayCircle } from "lucide-react";

type LazyVideoFrameProps = {
  className: string;
  src: string;
  title: string;
  buttonLabel?: string;
  controls?: boolean;
  muted?: boolean;
};

export function LazyVideoFrame({
  className,
  src,
  title,
  buttonLabel = "Load video",
  controls = true,
  muted = false,
}: LazyVideoFrameProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  if (isLoaded) {
    return (
      <video
        src={src}
        className={className}
        controls={controls}
        muted={muted}
        playsInline
        preload="none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsLoaded(true)}
      className={`${className} bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors`}
      aria-label={`${buttonLabel}: ${title}`}
    >
      <div className="text-center px-3">
        <PlayCircle className="h-7 w-7 mx-auto mb-2" />
        <span className="text-xs font-medium">{buttonLabel}</span>
      </div>
    </button>
  );
}
