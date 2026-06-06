"use client";

import { useMemo, useState } from "react";
import { Image as ImageIcon } from "lucide-react";

type ServiceImageProps = {
  src?: string | null;
  alt: string;
  title?: string | null;
  className?: string;
  fallbackClassName?: string;
};

function buildMonogram(value: string) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "R";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

export function ServiceImage({
  src,
  alt,
  title,
  className = "",
  fallbackClassName = "",
}: ServiceImageProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const normalizedSrc = String(src || "").trim();
  const showFallback = !normalizedSrc || imageFailed;
  const monogram = useMemo(() => buildMonogram(title || alt), [alt, title]);

  if (showFallback) {
    return (
      <div
        aria-label={alt}
        className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-sky-100 via-white to-blue-200 text-slate-700 ${className} ${fallbackClassName}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.2),_transparent_40%)]" />
        <div className="relative flex flex-col items-center gap-2 px-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-sm font-semibold shadow-sm ring-1 ring-white/70">
            {monogram}
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Service preview</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={normalizedSrc}
      alt={alt}
      className={className}
      onError={() => setImageFailed(true)}
    />
  );
}
