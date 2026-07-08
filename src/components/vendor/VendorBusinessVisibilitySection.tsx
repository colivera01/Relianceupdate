import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VendorGrowthSummary } from "@/lib/vendor-growth-summary";
import { Eye, ShieldCheck, Star, Video } from "lucide-react";

const toneClasses: Record<
  "success" | "warning" | "neutral",
  { card: string; badge: string }
> = {
  success: {
    card: "border-blue-400/30 bg-blue-500/10",
    badge: "border-blue-300/40 bg-blue-500/15 text-blue-100",
  },
  warning: {
    card: "border-blue-300/20 bg-slate-900/72",
    badge: "border-blue-300/35 bg-blue-500/12 text-blue-100",
  },
  neutral: {
    card: "border-white/10 bg-white/6",
    badge: "border-white/12 bg-white/8 text-white/78",
  },
};

const metricIcons = [Eye, ShieldCheck, Star, Video] as const;

export function VendorBusinessVisibilitySection({
  summary,
}: {
  summary: VendorGrowthSummary;
}) {
  return (
    <section className="mb-8 rounded-[32px] border border-white/10 bg-slate-950/65 p-6 shadow-[0_22px_70px_rgba(2,6,14,0.28)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-100/70">
            What customers can see
          </div>
          <h2 className="font-display text-3xl font-semibold text-white">
            {summary.visibilityTitle}
          </h2>
          <p className="text-sm leading-7 text-slate-300">{summary.visibilityDetail}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {summary.publicProfileHref ? (
            <Button asChild className="rounded-full bg-[var(--reliance-blue)] text-white hover:bg-[#1a58db]">
              <a href={summary.publicProfileHref}>View Public Profile</a>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="rounded-full">
            <a href="/vendor/services">Manage Services Offered</a>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.metrics.map((metric, index) => {
          const Icon = metricIcons[index] || Eye;
          const tone = toneClasses[metric.tone];
          return (
            <div key={metric.label} className={`rounded-3xl border p-4 ${tone.card}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-100/62">
                  {metric.label}
                </div>
                <Icon className="h-4 w-4 text-blue-100/55" />
              </div>
              <div className="mt-3 text-lg font-semibold text-white">{metric.value}</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{metric.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-3xl border border-blue-400/20 bg-blue-500/10 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
              Best next steps to grow
            </div>
            <p className="text-sm leading-7 text-blue-100/86">
              Each step below is based on your current public readiness, published services offered, reviews,
              and approved service videos.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {summary.nextSteps.map((step) => (
            <div key={step.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-sm font-semibold text-white">{step.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default VendorBusinessVisibilitySection;
