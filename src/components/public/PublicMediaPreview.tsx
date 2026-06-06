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
  emptyLabel = "No public preview",
  type = null,
  url,
  videoLabel = "Video preview available",
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
    <div className={`${className} bg-gray-100 flex items-center justify-center`}>
      <div className="text-center text-gray-500 px-3">
        <ImageIcon className="h-5 w-5 mx-auto mb-1" />
        <span className="text-xs">{emptyLabel}</span>
      </div>
    </div>
  );
}
