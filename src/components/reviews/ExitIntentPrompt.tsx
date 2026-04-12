'use client';

import React from 'react';

type Props = {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
};

export function ExitIntentPrompt({ open, onStay, onLeave }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
        <h3 className="text-base font-semibold text-gray-900">Before you go</h3>
        <p className="mt-2 text-sm text-gray-700">
          Share quick feedback from this service video. No review will be posted unless you explicitly submit one.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onStay} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Stay
          </button>
          <button onClick={onLeave} className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
