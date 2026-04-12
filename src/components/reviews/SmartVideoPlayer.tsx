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
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

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
          setAccessError(json?.error || 'Video access is not available');
        }
      } catch (e: unknown) {
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return;
        setAccessError('Failed to start review session');
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
    if (!reviewWindowId || !trimmedUserId) return;
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
    if (!reviewWindowId || !trimmedUserId) return;
    setReviewSubmitting(true);
    setSubmitError(null);
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
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to submit review');
      setShowQuickReview(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

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
    <div className={`relative ${className || ''}`} data-testid="e2e-smart-video-player">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls={reviewApisEnabled ? !accessError : true}
        className="w-full rounded-lg border bg-black"
      />
      {reviewApisEnabled && submitError ? <p className="mt-2 text-xs text-red-600">{submitError}</p> : null}
      {reviewApisEnabled && accessError ? <p className="mt-2 text-xs text-red-600">{accessError}</p> : null}

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

      {reviewApisEnabled && prompt !== 'none' ? (
        <ReviewOverlay
          title={prompt === 'soft' ? 'How was the service so far?' : 'Still with us? Share quick feedback'}
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
          <QuickReviewPanel open={showQuickReview} onClose={() => setShowQuickReview(false)} onSubmit={handleQuickSubmit} submitting={reviewSubmitting} />
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
