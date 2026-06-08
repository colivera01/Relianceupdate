import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, PlayCircle, ShieldCheck } from "lucide-react";
import { RelianceLogo } from "@/components/public/RelianceLogo";
import { cn } from "@/lib/utils";

type SignalCard = {
  label: string;
  detail: string;
};

type AuthExperienceShellProps = {
  backHref: string;
  backLabel: string;
  eyebrow?: string;
  title: string;
  description: string;
  heroTitle?: string;
  heroDescription?: string;
  heroBadge?: string;
  heroSignals?: SignalCard[];
  contentWidthClassName?: string;
  children: ReactNode;
};

const defaultSignals: SignalCard[] = [
  {
    label: "Customer Reviews",
    detail: "Public feedback from real completed jobs.",
  },
  {
    label: "Verified Service Videos",
    detail: "Before, during, and after service timelines.",
  },
  {
    label: "Reliance Trust Score",
    detail: "Measured performance beyond star ratings.",
  },
];

export function AuthExperienceShell({
  backHref,
  backLabel,
  eyebrow = "Know what you are comparing",
  title,
  description,
  heroTitle = "See reviews, service videos, and Trust Score in plain language.",
  heroDescription = "Reliance keeps customer reviews, public service videos, and the Reliance Trust Score separate so first-time customers can understand what they are seeing.",
  heroBadge = "Reviews, service videos, and Trust Score each tell a different part of the story.",
  heroSignals = defaultSignals,
  contentWidthClassName,
  children,
}: AuthExperienceShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(36,107,255,0.15),transparent_28%),linear-gradient(180deg,#f7f9fc_0%,#eef3fb_100%)] px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl items-stretch gap-6">
        <section className="reliance-dark-shell reliance-grid-lines hidden min-w-[340px] flex-1 rounded-[36px] p-8 text-white shadow-[0_32px_80px_rgba(6,12,24,0.36)] xl:flex xl:flex-col">
          <div className="flex items-center justify-between gap-4">
            <RelianceLogo
              href="/"
              tone="light"
              compact
              blend
              frameClassName="h-[5.8rem] w-[5.8rem]"
            />
            <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/72">
              Secure access
            </div>
          </div>

          <div className="mt-14">
            <div className="reliance-kicker text-white/72">{eyebrow}</div>
            <h2 className="mt-5 max-w-md font-display text-4xl font-semibold leading-tight">
              {heroTitle}
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/72">
              {heroDescription}
            </p>
          </div>

          <div className="mt-10 rounded-[28px] border border-white/12 bg-[linear-gradient(135deg,rgba(36,107,255,0.16),rgba(255,255,255,0.04))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/58">
                  What you can compare
                </p>
                <h3 className="mt-3 font-display text-4xl font-semibold text-white">3 trust signals</h3>
                <p className="mt-1 text-sm text-white/64">{heroBadge}</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/12 p-3 text-emerald-100">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {heroSignals.map((signal) => (
                <div
                  key={signal.label}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3"
                >
                  <div className="mt-0.5 rounded-full border border-white/10 bg-white/8 p-2 text-white/88">
                    {signal.label.includes("Videos") ? (
                      <PlayCircle className="h-4 w-4" />
                    ) : (
                      <BadgeCheck className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{signal.label}</p>
                    <p className="mt-1 text-xs leading-5 text-white/60">{signal.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto rounded-[24px] border border-white/10 bg-white/6 p-5 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
              Why this matters
            </p>
            <p className="mt-3 text-sm leading-7 text-white/72">
              Reliance is designed to help customers understand what is public, what is verified,
              and what they can do next without guessing.
            </p>
          </div>
        </section>

        <section className="flex w-full flex-1 items-center justify-center py-6 lg:py-8">
          <div className={cn("w-full max-w-xl", contentWidthClassName)}>
            <Link
              href={backHref}
              className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>

            <div className="mb-7">
              <p className="reliance-kicker">{eyebrow}</p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                {description}
              </p>
            </div>

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
