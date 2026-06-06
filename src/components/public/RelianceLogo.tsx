import Link from "next/link";
import { cn } from "@/lib/utils";

type RelianceLogoProps = {
  href?: string;
  tone?: "dark" | "light";
  compact?: boolean;
  blend?: boolean;
  blendMaskMode?: "contain" | "cover";
  className?: string;
  frameClassName?: string;
  imageClassName?: string;
  labelClassName?: string;
  forceLabel?: boolean;
};

function LogoInner({
  tone = "dark",
  compact = false,
  blend = false,
  blendMaskMode = "contain",
  className,
  frameClassName,
  imageClassName,
  labelClassName,
  forceLabel = false,
}: Omit<RelianceLogoProps, "href">) {
  const blendLogo = tone === "light" && blend;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {blendLogo ? (
        <div
          className={cn(
            "relative shrink-0",
            frameClassName || "h-16 w-16"
          )}
        >
          <div className="pointer-events-none absolute inset-[-8%] rounded-[32px] bg-[radial-gradient(circle_at_32%_25%,rgba(255,255,255,0.28),rgba(130,167,255,0.22)_32%,rgba(36,107,255,0.18)_58%,transparent_76%)] blur-xl" />
          <div
            role="img"
            aria-label="Reliance"
            className={cn(
              "relative z-[1] h-full w-full bg-[linear-gradient(145deg,#ffffff_4%,#edf4ff_20%,#a8c6ff_46%,#5c95ff_72%,#246bff_100%)]",
              blendMaskMode === "cover"
                ? "[mask-image:url('/reliance-logo.png')] [mask-repeat:no-repeat] [mask-position:center] [mask-size:cover]"
                : "[mask-image:url('/reliance-logo.png')] [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain]",
              blendMaskMode === "cover"
                ? "[-webkit-mask-image:url('/reliance-logo.png')] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:cover]"
                : "[-webkit-mask-image:url('/reliance-logo.png')] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain]"
            )}
          />
        </div>
      ) : (
        <div
          className={cn(
            "relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border shadow-sm",
            tone === "light"
              ? "border-white/15 bg-white/10 backdrop-blur-md"
              : "border-slate-200/80 bg-white",
            frameClassName
          )}
        >
          <img
            src="/reliance-logo.png"
            alt="Reliance"
            className={cn(
              "relative z-[1] h-9 w-9 object-contain",
              tone === "light" ? "brightness-0 invert" : "",
              imageClassName
            )}
          />
        </div>
      )}
      {!compact ? (
        <div className={cn("min-w-0", forceLabel ? "block" : "hidden sm:block")}>
          <div
            className={cn(
              "font-display text-[0.98rem] font-semibold uppercase tracking-[0.32em]",
              tone === "light" ? "text-white" : "text-slate-950",
              labelClassName
            )}
          >
            Reliance
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RelianceLogo({
  href,
  tone = "dark",
  compact = false,
  blend = false,
  blendMaskMode = "contain",
  className,
  frameClassName,
  imageClassName,
  labelClassName,
  forceLabel = false,
}: RelianceLogoProps) {
  if (!href) {
    return (
      <LogoInner
        tone={tone}
        compact={compact}
        blend={blend}
        blendMaskMode={blendMaskMode}
        className={className}
        frameClassName={frameClassName}
        imageClassName={imageClassName}
        labelClassName={labelClassName}
        forceLabel={forceLabel}
      />
    );
  }

  return (
    <Link href={href} className="inline-flex">
      <LogoInner
        tone={tone}
        compact={compact}
        blend={blend}
        blendMaskMode={blendMaskMode}
        className={className}
        frameClassName={frameClassName}
        imageClassName={imageClassName}
        labelClassName={labelClassName}
        forceLabel={forceLabel}
      />
    </Link>
  );
}
