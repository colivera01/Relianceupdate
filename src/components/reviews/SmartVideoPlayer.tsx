'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReviewOverlay } from './ReviewOverlay';
import { ExitIntentPrompt } from './ExitIntentPrompt';
import { QuickReviewPanel } from './QuickReviewPanel';
import { PrivateFeedbackPanel } from './PrivateFeedbackPanel';

type Props = {
  src: string;
  poster?: string;
  bookingId: string;
  vendorId: string;
  mediaSessionId: string;
  className?: string;
  /** When false, plays video only (no review window, prompts, or review API calls). Default true. */
  reviewCaptureEnabled?: boolean;
  /**
   * Customer user id for `x-user-id` on review APIs — same model as `/my-bookings` media/list.
   * If omitted or blank while `reviewCaptureEnabled` is true, review APIs are skipped (watch-only).
   */
  userId?: string | null;
};

export function SmartVideoPlayer({
  src,
  poster,
  bookingId,
  vendorId,
  mediaSessionId,
  className,
  reviewCaptureEnabled = true,
  userId,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [reviewWindowId, setReviewWindowId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<'none' | 'soft' | 'reinforcement'>('none');
  const [showExit, setShowExit] = useState(false);
  const [showQuickReview, setShowQuickReview] = useState(false);
  const [showPrivateFeedback, setShowPrivateFeedback] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessErrorDetails, setAccessErrorDetails] = useState<string | null>(null);
  const [reviewAlreadySubmitted, setReviewAlreadySubmitted] = useState(false);

  const trimmedUserId = useMemo(() => String(userId ?? '').trim(), [userId]);
  /** Review APIs + UI; false ⇒ watch-only (terminal cancel, or missing user id). Consent checks on server unchanged when true. */
  const reviewApisEnabled = Boolean(reviewCaptureEnabled && trimmedUserId);

  const reviewJsonHeaders = useMemo(
    () =>
      ({
        'Content-Type': 'application/json',
        'x-user-id': trimmedUserId,
      }) as const,
    [trimmedUserId]
  );

  const isReady = useMemo(
    () => Boolean(reviewApisEnabled && reviewWindowId),
    [reviewApisEnabled, reviewWindowId]
  );

  useEffect(() => {
    setReviewAlreadySubmitted(false);
  }, [bookingId, mediaSessionId]);

  const logPromptEvent = useCallback(
    async (eventType: string, metadata?: Record<string, unknown>) => {
      const id = reviewWindowId;
      if (!id || !trimmedUserId) return;
      await fetch('/api/reviews/prompt-event', {
        method: 'POST',
        headers: { ...reviewJsonHeaders },
        body: JSON.stringify({ reviewWindowId: id, eventType, metadata: metadata || null }),
      });
    },
    [reviewWindowId, trimmedUserId, reviewJsonHeaders]
  );

  useEffect(() => {
    if (!reviewApisEnabled) {
      setReviewWindowId(null);
      setAccessError(null);
      setAccessErrorDetails(null);
      setPrompt('none');
      setShowExit(false);
      setShowQuickReview(false);
      setShowPrivateFeedback(false);
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      setAccessError(null);
      setAccessErrorDetails(null);
      try {
        const res = await fetch('/api/reviews/window/start', {
          method: 'POST',
          headers: { ...reviewJsonHeaders },
          body: JSON.stringify({ bookingId, vendorId, mediaSessionId }),
          signal: ac.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && json?.reviewWindow?.id) {
          setReviewWindowId(String(json.reviewWindow.id));
        } else {
          const backendError = String(json?.error || json?.message || 'Video access is not available');
          const backendStep = String(json?.step || json?.details?.step || 'unknown_step');
          const backendCode = String(json?.code || json?.details?.code || 'none');
          const backendMeta = json?.meta ?? json?.details?.meta ?? null;
          const backendDetailError = String(json?.details?.error || backendError);
          setAccessError(backendError);
          setAccessErrorDetails(
            `review window start failed (${res.status}) | step=${backendStep} code=${backendCode} | bookingId=${bookingId} vendorId=${vendorId} mediaSessionId=${mediaSessionId} x-user-id=${trimmedUserId || 'missing'} | backend="${backendDetailError}" meta=${JSON.stringify(backendMeta)}`
          );
        }
      } catch (e: unknown) {
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return;
        const message = e instanceof Error ? e.message : 'Failed to start review session';
        setAccessError(message);
        setAccessErrorDetails(
          `review window start request error | bookingId=${bookingId} vendorId=${vendorId} mediaSessionId=${mediaSessionId} x-user-id=${trimmedUserId || 'missing'} | error="${message}"`
        );
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [bookingId, vendorId, mediaSessionId, reviewApisEnabled, reviewJsonHeaders]);

  useEffect(() => {
    if (!reviewApisEnabled) return;
    const video = videoRef.current;
    if (!video || !isReady) return;
    let softTimer: ReturnType<typeof setTimeout> | null = null;
    let reinforcementTimer: ReturnType<typeof setTimeout> | null = null;
    let playStarted = false;

    const onPlay = () => {
      if (playStarted) return;
      playStarted = true;
      softTimer = setTimeout(() => {
        setPrompt('soft');
        void logPromptEvent('soft_prompt_shown');
      }, 3000);
      reinforcementTimer = setTimeout(() => {
        setPrompt((prev) => (prev === 'none' ? 'reinforcement' : prev));
        void logPromptEvent('reinforcement_prompt_shown');
      }, 10000);
    };
    video.addEventListener('play', onPlay);
    return () => {
      video.removeEventListener('play', onPlay);
      if (softTimer) clearTimeout(softTimer);
      if (reinforcementTimer) clearTimeout(reinforcementTimer);
    };
  }, [reviewApisEnabled, isReady, logPromptEvent]);

  const openExitIntent = useCallback(async () => {
    setShowExit(true);
    await logPromptEvent('exit_prompt_shown');
  }, [logPromptEvent]);

  const handleSentiment = async (sentiment: 'positive' | 'neutral' | 'negative') => {
    setPrompt('none');
    setSubmitSuccess(null);
    if (!reviewWindowId || !trimmedUserId || reviewAlreadySubmitted) return;
    await fetch('/api/reviews/sentiment', {
      method: 'POST',
      headers: { ...reviewJsonHeaders },
      body: JSON.stringify({ reviewWindowId, sentiment }),
    });
    if (sentiment === 'positive') {
      await logPromptEvent('quick_review_opened');
      setShowQuickReview(true);
    } else {
      await logPromptEvent('private_feedback_opened');
      setShowPrivateFeedback(true);
    }
  };

  const handleQuickSubmit = async (payload: { rating: number; comment: string }) => {
    if (!reviewWindowId || !trimmedUserId || reviewSubmitting) return;
    setReviewSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const res = await fetch('/api/reviews/create', {
        method: 'POST',
        headers: { ...reviewJsonHeaders },
        body: JSON.stringify({
          reviewWindowId,
          bookingId,
          vendorId,
          rating: payload.rating,
          comment: payload.comment,
          submittedVia: 'video_overlay',
        }),
      });
      const body = await res.json().catch(() => ({}));
      const submissionSucceeded = res.ok || body?.success === true;
      if (!submissionSucceeded) {
        const backendCode = String(body?.code || 'none');
        const backendError = String(body?.error || '');
        const backendMessage = String(body?.message || '');
        const isReviewAlreadySubmitted =
          res.status === 409 &&
          (backendCode === 'REVIEW_ALREADY_EXISTS' ||
            backendError.toLowerCase().includes('review already exists') ||
            backendMessage.toLowerCase().includes('review already exists'));
        if (isReviewAlreadySubmitted) {
          setReviewAlreadySubmitted(true);
          setShowQuickReview(false);
          setPrompt('none');
          setShowPrivateFeedback(false);
          setSubmitError(null);
          setSubmitSuccess('You already submitted a review for this service.');
          return;
        }

        const fallbackError = String(body?.error || 'Failed to submit review');
        const backendStep = String(body?.step || body?.details?.step || 'unknown_step');
        const backendMeta = body?.meta ?? body?.details?.meta ?? null;
        const backendDetails = body?.details ?? null;
        throw new Error(
          `Failed to create review (${res.status}) | error="${fallbackError}" code=${backendCode} message="${backendMessage}" step=${backendStep} meta=${JSON.stringify(
            backendMeta
          )} details=${JSON.stringify(backendDetails)}`
        );
      }
      await logPromptEvent('quick_review_submitted', { rating: payload.rating });
      setShowQuickReview(false);
      setPrompt('none');
      setShowPrivateFeedback(false);
      setReviewAlreadySubmitted(true);
      setSubmitError(null);
      setSubmitSuccess('Thank you for your feedback.');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  useEffect(() => {
    if (!submitSuccess) return;
    const timer = setTimeout(() => setSubmitSuccess(null), 3500);
    return () => clearTimeout(timer);
  }, [submitSuccess]);

  const handleCloseWithoutReview = async () => {
    if (reviewWindowId && trimmedUserId) {
      await fetch('/api/reviews/window/expire', {
        method: 'POST',
        headers: { ...reviewJsonHeaders },
        body: JSON.stringify({ reviewWindowId }),
      });
    }
    setShowExit(false);
  };

  return (
    <div className={`relative w-full max-w-full overflow-hidden ${className || ''}`} data-testid="e2e-smart-video-player">
      <div className="flex w-full items-center justify-center overflow-hidden rounded-lg border bg-black">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls={reviewApisEnabled ? !accessError : true}
          className="block h-auto w-full max-h-[70vh] object-contain bg-black"
        />
      </div>
      {reviewApisEnabled && submitError ? <p className="mt-2 text-xs text-red-600">{submitError}</p> : null}
      {reviewApisEnabled && submitSuccess ? <p className="mt-2 text-xs text-emerald-700">{submitSuccess}</p> : null}
      {reviewApisEnabled && accessError ? <p className="mt-2 text-xs text-red-600">{accessError}</p> : null}
      {reviewApisEnabled && accessErrorDetails ? (
        <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
          {accessErrorDetails}
        </p>
      ) : null}

      {reviewApisEnabled && !accessError && reviewWindowId ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void openExitIntent()}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            Done watching
          </button>
        </div>
      ) : null}

      {reviewApisEnabled && !reviewAlreadySubmitted && prompt !== 'none' ? (
        <ReviewOverlay
          title={prompt === 'soft' ? 'How was your completed service?' : 'Please confirm your experience after reviewing the completed proof.'}
          onDismiss={async () => {
            setPrompt('none');
            await logPromptEvent('dismissed', { phase: prompt });
          }}
          onPositive={() => void handleSentiment('positive')}
          onNeutral={() => void handleSentiment('neutral')}
          onNegative={() => void handleSentiment('negative')}
        />
      ) : null}

      {reviewApisEnabled ? (
        <>
          <ExitIntentPrompt open={showExit} onStay={() => setShowExit(false)} onLeave={() => void handleCloseWithoutReview()} />
          <QuickReviewPanel
            open={showQuickReview && !reviewAlreadySubmitted}
            onClose={() => setShowQuickReview(false)}
            onSubmit={handleQuickSubmit}
            submitting={reviewSubmitting}
          />
          <PrivateFeedbackPanel
            open={showPrivateFeedback}
            onClose={() => setShowPrivateFeedback(false)}
            onSubmit={async (message) => {
              await logPromptEvent('dismissed', { privateFeedback: message || null });
              setShowPrivateFeedback(false);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
