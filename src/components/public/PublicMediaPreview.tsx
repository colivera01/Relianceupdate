import { Image as ImageIcon, PlayCircle } from "lucide-react";

type PublicMediaType = "image" | "video" | null | undefined;

type PublicMediaPreviewProps = {
  alt: string;
  autoPlayVideo?: boolean;
  className: string;
  emptyLabel?: string;
  type?: PublicMediaType;
  url?: string | null;
  videoLabel?: string;
};

export function PublicMediaPreview({
  alt,
  autoPlayVideo = false,
  className,
  emptyLabel = "No public service video yet",
  type = null,
  url,
  videoLabel = "Service video available",
}: PublicMediaPreviewProps) {
  if (url && type === "image") {
    return <img src={url} alt={alt} className={className} />;
  }

  if (url && type === "video") {
    return (
      <div className={`relative overflow-hidden ${className} bg-slate-950`}>
        <video
          src={url}
          autoPlay={autoPlayVideo}
          loop={autoPlayVideo}
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,13,0.08),rgba(2,6,13,0.56))]" />
        <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-white backdrop-blur-md">
          <PlayCircle className="h-4 w-4" />
          <span className="text-xs font-medium">{videoLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(36,107,255,0.25),transparent_38%),linear-gradient(180deg,#0b1322_0%,#111d33_100%)]`}
    >
      <div className="rounded-[22px] border border-white/10 bg-white/6 px-5 py-5 text-center text-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white">
          <ImageIcon className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-white">Public service video</p>
        <p className="mt-1 max-w-[11rem] text-xs leading-5 text-white/64">{emptyLabel}</p>
      </div>
    </div>
  );
}
