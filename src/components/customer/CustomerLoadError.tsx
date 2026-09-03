import { RotateCcw } from 'lucide-react';

export function CustomerLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" aria-label="Load error" className="my-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950">
    <p>{message}</p>
    <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 font-semibold hover:bg-red-100"><RotateCcw className="h-4 w-4" />Retry</button>
  </div>;
}
