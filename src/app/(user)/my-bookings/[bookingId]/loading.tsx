export default function BookingDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-900">Loading booking details...</p>
          <p className="text-xs text-blue-800">Fetching the service timeline, booking status, and review tools.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-2">
            <div className="h-8 w-72 rounded bg-gray-200 animate-pulse" />
            <div className="h-4 w-36 rounded bg-gray-100 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-24 rounded-lg bg-gray-100 animate-pulse" />
            <div className="h-10 w-36 rounded-lg bg-gray-100 animate-pulse" />
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-3">
          <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
          <div className="flex flex-wrap gap-3">
            <div className="h-6 w-24 rounded-full bg-gray-100 animate-pulse" />
            <div className="h-5 w-28 rounded bg-gray-100 animate-pulse" />
            <div className="h-5 w-20 rounded bg-gray-100 animate-pulse" />
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-4">
          <div className="h-5 w-32 rounded bg-gray-200 animate-pulse" />
          <div className="aspect-video w-full rounded bg-gray-100 animate-pulse" />
          <div className="h-4 w-64 rounded bg-gray-100 animate-pulse" />
          <div className="h-4 w-80 rounded bg-gray-100 animate-pulse" />
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-3">
          <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded border p-3 space-y-2">
                <div className="h-4 w-20 rounded bg-gray-100 animate-pulse" />
                <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
                <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-3">
          <div className="h-5 w-28 rounded bg-gray-200 animate-pulse" />
          <div className="h-4 w-72 rounded bg-gray-100 animate-pulse" />
          <div className="h-10 w-32 rounded-lg bg-gray-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
