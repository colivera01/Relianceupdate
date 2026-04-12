'use client';

import React, { useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void> | void;
};

export function PrivateFeedbackPanel({ open, onClose, onSubmit }: Props) {
  const [message, setMessage] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-lg">
        <h3 className="text-base font-semibold text-gray-900">Private Feedback</h3>
        <p className="mt-1 text-sm text-gray-600">
          This does not create a public review. It is shared privately for service follow-up.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-3 w-full rounded border px-3 py-2 text-sm"
          rows={5}
          placeholder="Tell us what went wrong or what could be improved"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Close
          </button>
          <button
            onClick={() => onSubmit(message)}
            className="rounded bg-gray-800 px-3 py-2 text-sm text-white hover:bg-black"
          >
            Save Feedback
          </button>
        </div>
      </div>
    </div>
  );
}
