"use client";

import { cn } from "@/lib/utils";
import type { CustomerTrustScoreCopy } from "@/lib/customer-trust-score-copy";

type CustomerTrustSignalCardProps = {
  copy: CustomerTrustScoreCopy;
  className?: string;
};

const toneClasses: Record<CustomerTrustScoreCopy["tone"], string> = {
  muted: "border border-slate-200 bg-slate-50 text-slate-800",
  calm: "border border-blue-100 bg-blue-50 text-blue-950",
  balanced: "border border-cyan-100 bg-cyan-50 text-cyan-950",
  strong: "border border-emerald-100 bg-emerald-50 text-emerald-950",
};

const labelClasses: Record<CustomerTrustScoreCopy["tone"], string> = {
  muted: "text-slate-500",
  calm: "text-blue-700",
  balanced: "text-cyan-700",
  strong: "text-emerald-700",
};

const detailClasses: Record<CustomerTrustScoreCopy["tone"], string> = {
  muted: "text-slate-600",
  calm: "text-blue-800/80",
  balanced: "text-cyan-800/80",
  strong: "text-emerald-800/80",
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
