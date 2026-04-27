'use client';

import React, { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { rating: number; comment: string }) => Promise<void> | void;
};

export function QuickReviewPanel({ open, submitting = false, onClose, onSubmit }: Props) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!open) {
      setRating(5);
      setHoverRating(0);
      setComment('');
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
        <p className="mt-1 text-sm text-gray-600">Your review is only posted after you tap submit.</p>
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
            onClick={() => onSubmit({ rating, comment })}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
