'use client';

import Link from "next/link";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HelpCircle, PlayCircle } from "lucide-react";
import type { TutorialGuide } from "@/lib/user-guidance";

type EntrySurface = "light" | "dark";

type TutorialEntryPointProps = {
  guide: TutorialGuide;
  triggerLabel?: string;
  surface?: EntrySurface;
  className?: string;
};

const triggerClasses = {
  light:
    "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
  dark:
    "border-white/12 bg-white/6 text-white hover:bg-white/10",
} as const;

export function TutorialEntryPoint({
  guide,
  triggerLabel = "Watch How This Works",
  surface = "light",
  className = "",
}: TutorialEntryPointProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${triggerClasses[surface]} ${className}`.trim()}
      >
        <PlayCircle className="h-4 w-4" />
        {triggerLabel}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-4 max-h-[calc(100dvh-2rem)] max-w-2xl translate-y-0 overflow-y-auto p-4 sm:top-[5vh] sm:max-h-[90dvh] sm:p-6">
          <DialogHeader>
            <div className="mb-2 inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-800">
              {guide.badge}
            </div>
            <DialogTitle className="text-2xl">{guide.title}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-slate-600">
              {guide.summary}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {guide.video ? (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-sm">
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">{guide.video.title}</p>
                  <p className="mt-1 text-xs text-slate-300">
                    Watch the quick walkthrough, then use the steps below as a checklist.
                  </p>
                </div>
                <video
                  className="aspect-video w-full bg-black"
                  controls
                  preload="metadata"
                  playsInline
                  src={guide.video.src}
                  title={guide.video.title}
                >
                  {guide.video.captionsSrc ? (
                    <track
                      kind="captions"
                      src={guide.video.captionsSrc}
                      srcLang="en"
                      label={guide.video.captionsLabel || "English"}
                      default
                    />
                  ) : null}
                  Your browser does not support embedded video playback.
                </video>
              </div>
            ) : null}

            <div className="space-y-3">
              {guide.steps.map((step, index) => (
                <div key={`${step.title}-${index}`} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">{step.title}</p>
                    <p className="text-sm leading-6 text-slate-600">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {guide.reminders?.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-amber-900">
                  <HelpCircle className="h-4 w-4" />
                  <p className="text-sm font-semibold">Keep in mind</p>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-amber-900">
                  {guide.reminders.map((reminder) => (
                    <li key={reminder} className="flex gap-2">
                      <span className="mt-1 text-xs">-</span>
                      <span>{reminder}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!guide.video || guide.relatedLinks?.length ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                {!guide.video ? (
                  <>
                    <p className="text-sm font-semibold text-slate-900">Tutorial video coming soon</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {guide.futureVideoNote || "A future tutorial video can be linked from this exact help entry point without changing the workflow around it."}
                    </p>
                  </>
                ) : null}
                {guide.relatedLinks?.length ? (
                  <div className={guide.video ? "flex flex-wrap gap-2" : "mt-3 flex flex-wrap gap-2"}>
                    {guide.relatedLinks.map((link) => (
                      <Link
                        key={`${guide.title}-${link.href}`}
                        href={link.href}
                        className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
