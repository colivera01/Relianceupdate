"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getClientAuthHeaders } from "@/lib/client-session";
import { LAUNCH_SUPPORT_EMAIL } from "@/lib/support";

type ReportTargetType = "review" | "media_asset";

type ReportContentDialogProps = {
  targetType: ReportTargetType;
  targetId: string;
  isSignedIn: boolean;
  userId?: string | null;
  triggerLabel?: string;
  title?: string;
  description?: string;
  signInHref?: string;
  className?: string;
};

const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or abuse" },
  { value: "hate", label: "Hateful content" },
  { value: "nudity", label: "Nudity or sexual content" },
  { value: "violence", label: "Violence or threats" },
  { value: "spam", label: "Spam" },
  { value: "fraud", label: "Fraud or scam" },
  { value: "copyright", label: "Copyright concern" },
  { value: "privacy", label: "Privacy concern" },
  { value: "misleading", label: "Misleading content" },
  { value: "other", label: "Something else" },
] as const;

export function ReportContentDialog({
  targetType,
  targetId,
  isSignedIn,
  triggerLabel = "Report",
  title = "Report this content",
  description = "Tell us what feels wrong. Reliance will review it without notifying the person who posted it.",
  signInHref = "/auth/login",
  className,
}: ReportContentDialogProps) {
  const REPORT_REQUEST_TIMEOUT_MS = 15000;
  const [open, setOpen] = useState(false);
  const [reasonCategory, setReasonCategory] = useState<(typeof REPORT_REASONS)[number]["value"]>("privacy");
  const [reasonDetail, setReasonDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatusMessage(null);
    setErrorMessage(null);
  }, [open, targetId]);

  const canSubmit = isSignedIn && Boolean(targetId) && !submitting;

  const submitReport = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setStatusMessage(null);
    setErrorMessage(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REPORT_REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch("/api/reports/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getClientAuthHeaders(),
        },
        signal: controller.signal,
        body: JSON.stringify({
          targetType,
          targetId,
          reasonCategory,
          reasonDetail,
          severity: "medium",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.message || json?.error || "Could not submit report"));
      }
      setReasonDetail("");
      setStatusMessage("Thanks. Your report was sent to Reliance for review.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setErrorMessage(
          LAUNCH_SUPPORT_EMAIL
            ? `Report request timed out. Please try again. If the problem keeps happening, contact ${LAUNCH_SUPPORT_EMAIL}.`
            : "Report request timed out. Please try again."
        );
      } else {
        setErrorMessage(error instanceof Error ? error.message : "Could not submit report");
      }
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={className}>
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!isSignedIn ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900">
            <p className="font-medium">Sign in to report this content</p>
            <p className="mt-1 text-blue-800">
              Guest reporting is not available yet, so reports need to come from a signed-in Reliance account.
            </p>
            <a href={signInHref} className="mt-3 inline-flex rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Sign in to report
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-gray-900">Reason</span>
              <select
                value={reasonCategory}
                onChange={(event) => setReasonCategory(event.target.value as typeof reasonCategory)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {REPORT_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-gray-900">Optional details</span>
              <Textarea
                value={reasonDetail}
                onChange={(event) => setReasonDetail(event.target.value)}
                maxLength={1000}
                placeholder="Add a short note if it helps us understand the concern."
              />
            </label>
            {statusMessage ? <p className="text-sm text-emerald-700">{statusMessage}</p> : null}
            {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
          </div>
        )}

        {isSignedIn ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Close
            </Button>
            <Button type="button" onClick={() => void submitReport()} disabled={!canSubmit}>
              {submitting ? "Sending..." : "Submit report"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
