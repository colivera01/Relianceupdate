'use client';

import React from 'react';

type Props = {
  title: string;
  onPositive: () => void;
  onNeutral: () => void;
  onNegative: () => void;
  onDismiss: () => void;
};

export function ReviewOverlay({ title, onPositive, onNeutral, onNegative, onDismiss }: Props) {
  return (
    <div className="absolute inset-x-4 bottom-4 z-20 rounded-lg border bg-white/95 p-3 shadow">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <button onClick={onDismiss} className="text-xs text-gray-600 hover:text-gray-900">
          Dismiss
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-600">How was this service video experience?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onPositive} className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
          Positive
        </button>
        <button onClick={onNeutral} className="rounded bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800">
          Neutral
        </button>
        <button onClick={onNegative} className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">
          Negative
        </button>
      </div>
    </div>
  );
}
