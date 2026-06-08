'use client';

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";

type TrustScoreEducationCardProps = {
  surface?: "light" | "dark";
  className?: string;
};

const surfaceClasses = {
  light: {
    shell: "border-slate-200 bg-slate-50 text-slate-900",
    summary: "text-slate-700",
    helper: "text-slate-600",
    badge: "border-blue-200 bg-white text-blue-800",
    button: "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
  },
  dark: {
    shell: "border-white/10 bg-white/5 text-white",
    summary: "text-white/80",
    helper: "text-white/72",
    badge: "border-white/12 bg-white/8 text-blue-100",
    button: "border-white/12 bg-white/6 text-white hover:bg-white/10",
  },
} as const;

const reviewBullets = [
  "Based on customer-submitted ratings and reviews.",
  "Helps you understand public customer sentiment.",
  "Appears publicly only after moderation when required.",
];

const trustBullets = [
  "Based on verified completed work and finalized platform outcomes.",
  "Uses service-video and operational signals, not review sentiment.",
  "Can appear as early-stage, emerging, or established depending on verified activity depth.",
  "Stays separate from Customer Rating by design.",
];

export function TrustScoreEducationCard({
  surface = "light",
  className = "",
}: TrustScoreEducationCardProps) {
  const [open, setOpen] = useState(false);
  const styles = surfaceClasses[surface];

  return (
    <section className={`rounded-3xl border p-4 shadow-sm ${styles.shell} ${className}`.trim()}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${styles.badge}`}>
            <Info className="h-3.5 w-3.5" />
            What is Reliance Trust Score?
          </div>
          <p className={`text-sm leading-6 ${styles.summary}`}>
            Customer Rating shows what people said. The Reliance Trust Score shows what Reliance has verified about completed work.
          </p>
          <p className={`text-xs leading-5 ${styles.helper}`}>
            New providers can show an early-stage Trust Score before public reviews are available.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${styles.button}`}
        >
          {open ? "Hide details" : "Learn the difference"}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open ? (
        <div className={`mt-4 grid gap-3 md:grid-cols-2 ${styles.helper}`}>
          <div className="rounded-2xl border border-inherit bg-white/5 p-4">
            <p className="text-sm font-semibold">Customer Rating</p>
            <ul className="mt-2 space-y-1.5 text-sm leading-6">
              {reviewBullets.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-inherit bg-white/5 p-4">
            <p className="text-sm font-semibold">Reliance Trust Score</p>
            <ul className="mt-2 space-y-1.5 text-sm leading-6">
              {trustBullets.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
