'use client';

import React, { useEffect, useState } from 'react';
import {
  getReviewAttributionCustomerExplanation,
  type ReviewAttributionTarget,
} from '@/lib/review-attribution-intent';

type Props = {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    rating: number;
    comment: string;
    reviewAttributionTarget: ReviewAttributionTarget;
  }) => Promise<void> | void;
};

export function QuickReviewPanel({ open, submitting = false, onClose, onSubmit }: Props) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reviewAttributionTarget, setReviewAttributionTarget] =
    useState<ReviewAttributionTarget>('overall_business');

  useEffect(() => {
    if (!open) {
      setRating(5);
      setHoverRating(0);
      setComment('');
      setReviewAttributionTarget('overall_business');
    }
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-testid="e2e-quick-review-panel"
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-lg">
        <h3 className="text-base font-semibold text-gray-900">Quick Review</h3>
        <p className="mt-1 text-sm text-gray-600">
          Your review is only posted after you tap submit. Your star rating affects the vendor's public
          business rating after Reliance review approval.
        </p>
        <div className="mt-3">
          <label className="text-sm font-medium text-gray-700">Rating</label>
          <p className="mt-1 text-xs text-gray-500">Tap a star to rate your completed service.</p>
          <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                onMouseEnter={() => setHoverRating(value)}
                className="text-2xl leading-none text-yellow-500 transition-transform hover:scale-110"
                aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
              >
                {(hoverRating || rating) >= value ? '★' : '☆'}
              </button>
            ))}
            <span className="ml-2 text-sm text-gray-600">{rating}/5</span>
          </div>
        </div>
        <div className="mt-3">
          <label className="text-sm font-medium text-gray-700">What is this feedback mainly about?</label>
          <div className="mt-2 space-y-2">
            {[
              {
                value: 'overall_business',
                label: 'Overall business experience',
                helper: 'Use this for the full service experience.',
              },
              {
                value: 'assigned_team',
                label: 'The assigned worker or crew',
                helper: 'Use this when the feedback is clearly about the person or team who performed the work.',
              },
              {
                value: 'scheduling_management',
                label: 'Scheduling, communication, or management',
                helper: 'Use this when the issue is not mainly about the worker who performed the service.',
              },
              {
                value: 'not_sure',
                label: 'Not sure',
                helper: 'Reliance will keep it as business feedback unless the context is clear.',
              },
            ].map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-3 text-sm hover:border-blue-300 hover:bg-blue-50/50"
              >
                <input
                  type="radio"
                  name="review-attribution-target"
                  value={option.value}
                  checked={reviewAttributionTarget === option.value}
                  onChange={() => setReviewAttributionTarget(option.value as ReviewAttributionTarget)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-gray-900">{option.label}</span>
                  <span className="block text-xs leading-5 text-gray-600">{option.helper}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
            {getReviewAttributionCustomerExplanation(reviewAttributionTarget)}
          </div>
        </div>
        <div className="mt-3">
          <label className="text-sm font-medium text-gray-700">Comment (optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            rows={4}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button
            disabled={submitting}
            onClick={() => onSubmit({ rating, comment, reviewAttributionTarget })}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
