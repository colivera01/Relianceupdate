import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VendorGrowthSummary } from "@/lib/vendor-growth-summary";
import { Eye, Megaphone, ShieldCheck, Star, Video } from "lucide-react";

const toneClasses: Record<
  "success" | "warning" | "neutral",
  { card: string; badge: string }
> = {
  success: {
    card: "border-emerald-200 bg-emerald-50",
    badge: "border-emerald-200 bg-emerald-100 text-emerald-800",
  },
  warning: {
    card: "border-blue-200 bg-blue-50",
    badge: "border-blue-200 bg-blue-100 text-blue-900",
  },
  neutral: {
    card: "border-slate-200 bg-slate-50",
    badge: "border-slate-200 bg-white text-slate-700",
  },
};

const metricIcons = [Eye, ShieldCheck, Star, Video] as const;

export function VendorBusinessVisibilitySection({
  summary,
}: {
  summary: VendorGrowthSummary;
}) {
  const promotionTone = toneClasses[summary.promotionStatus.tone];

  return (
    <section className="mb-8 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            What customers can see
          </div>
          <h2 className="font-display text-3xl font-semibold text-slate-950">
            {summary.visibilityTitle}
          </h2>
          <p className="text-sm leading-7 text-slate-600">{summary.visibilityDetail}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {summary.publicProfileHref ? (
            <Button asChild className="rounded-full bg-[var(--reliance-blue)] text-white hover:bg-[#1a58db]">
              <Link href={summary.publicProfileHref}>View Public Profile</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/vendor/services">Manage Services Offered</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summary.metrics.map((metric, index) => {
          const Icon = metricIcons[index] || Eye;
          const tone = toneClasses[metric.tone];
          return (
            <div key={metric.label} className={`rounded-3xl border p-4 ${tone.card}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {metric.label}
                </div>
                <Icon className="h-4 w-4 text-slate-500" />
              </div>
              <div className="mt-3 text-lg font-semibold text-slate-950">{metric.value}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{metric.detail}</p>
            </div>
          );
        })}

        <div className={`rounded-3xl border p-4 ${promotionTone.card}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Promotion eligibility
            </div>
            <Megaphone className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-3">
            <Badge variant="outline" className={promotionTone.badge}>
              {summary.promotionStatus.label}
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{summary.promotionStatus.detail}</p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
              Best next steps to grow
            </div>
            <p className="text-sm leading-7 text-blue-900">
              Each step below is based on your current public readiness, published services offered, reviews,
              and approved service videos.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {summary.nextSteps.map((step) => (
            <div key={step.label} className="rounded-2xl border border-blue-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-950">{step.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
              <Button asChild variant="outline" size="sm" className="mt-4 rounded-full">
                <Link href={step.href}>Open next step</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default VendorBusinessVisibilitySection;
