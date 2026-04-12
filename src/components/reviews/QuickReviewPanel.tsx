'use client';

import React, { useState } from 'react';

type Props = {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { rating: number; comment: string }) => Promise<void> | void;
};

export function QuickReviewPanel({ open, submitting = false, onClose, onSubmit }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

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
          <div className="mt-1 flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => setRating(value)}
                className={`h-8 w-8 rounded-full text-sm ${rating >= value ? 'bg-yellow-400' : 'bg-gray-200'}`}
              >
                {value}
              </button>
            ))}
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
