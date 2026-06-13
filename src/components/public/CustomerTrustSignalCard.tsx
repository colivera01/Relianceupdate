"use client";

import { cn } from "@/lib/utils";
import type { CustomerTrustScoreCopy } from "@/lib/customer-trust-score-copy";

type CustomerTrustSignalCardProps = {
  copy: CustomerTrustScoreCopy;
  className?: string;
};

const toneClasses: Record<CustomerTrustScoreCopy["tone"], string> = {
  muted: "border border-slate-200 bg-slate-50 text-slate-900",
  calm: "border border-blue-100 bg-blue-50 text-slate-950",
  balanced: "border border-sky-100 bg-sky-50 text-slate-950",
  strong:
    "border border-blue-400/30 bg-[linear-gradient(160deg,rgba(9,21,43,0.98),rgba(16,40,79,0.96),rgba(23,76,151,0.92))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
};

const labelClasses: Record<CustomerTrustScoreCopy["tone"], string> = {
  muted: "text-slate-500",
  calm: "text-blue-700",
  balanced: "text-sky-700",
  strong: "text-blue-100/92",
};

const detailClasses: Record<CustomerTrustScoreCopy["tone"], string> = {
  muted: "text-slate-600",
  calm: "text-slate-700",
  balanced: "text-slate-700",
  strong: "text-blue-100/78",
};

const headlineClasses: Record<CustomerTrustScoreCopy["emphasis"], string> = {
  subtle: "text-base",
  standard: "text-lg",
  strong: "text-xl",
};

export function CustomerTrustSignalCard({
  copy,
  className,
}: CustomerTrustSignalCardProps) {
  return (
    <div className={cn("rounded-2xl px-3 py-2", toneClasses[copy.tone], className)}>
      <div className={cn("text-[10px] font-semibold uppercase tracking-[0.22em]", labelClasses[copy.tone])}>
        {copy.label}
      </div>
      <div className={cn("mt-1 font-semibold", headlineClasses[copy.emphasis])}>{copy.headline}</div>
      <div className={cn("mt-1 text-xs leading-5", detailClasses[copy.tone])}>{copy.detail}</div>
    </div>
  );
}
