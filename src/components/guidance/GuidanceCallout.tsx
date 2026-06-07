import type { ReactNode } from "react";

type GuidanceTone = "blue" | "amber" | "emerald" | "slate";
type GuidanceSurface = "light" | "dark";

type GuidanceCalloutProps = {
  eyebrow?: string;
  title: string;
  description: string;
  bullets?: string[];
  tone?: GuidanceTone;
  surface?: GuidanceSurface;
  className?: string;
  children?: ReactNode;
};

const palette = {
  light: {
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    slate: "border-slate-200 bg-slate-50 text-slate-900",
  },
  dark: {
    blue: "border-blue-400/25 bg-blue-500/10 text-white",
    amber: "border-amber-400/25 bg-amber-500/10 text-white",
    emerald: "border-emerald-400/25 bg-emerald-500/10 text-white",
    slate: "border-white/10 bg-white/5 text-white",
  },
} as const;

export function GuidanceCallout({
  eyebrow,
  title,
  description,
  bullets,
  tone = "blue",
  surface = "light",
  className = "",
  children,
}: GuidanceCalloutProps) {
  const toneClasses = palette[surface][tone];
  const subtleText = surface === "dark" ? "text-white/72" : "text-slate-700";
  const eyebrowText = surface === "dark" ? "text-white/56" : "text-slate-500";
  const bulletText = surface === "dark" ? "text-white/76" : "text-slate-700";

  return (
    <section className={`rounded-3xl border p-4 shadow-sm ${toneClasses} ${className}`.trim()}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${eyebrowText}`}>{eyebrow}</p>
        ) : null}
        <h3 className="text-base font-semibold">{title}</h3>
        <p className={`text-sm leading-6 ${subtleText}`}>{description}</p>
        {bullets?.length ? (
          <ul className={`space-y-1.5 pt-1 text-sm ${bulletText}`}>
            {bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2">
                <span className="mt-1 text-xs">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {children ? <div className="pt-2">{children}</div> : null}
      </div>
    </section>
  );
}
