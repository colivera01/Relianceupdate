export default function AdminActivityLoading() {
  return (
    <div className="w-full max-w-6xl p-4 space-y-4">
      <div className="space-y-2">
        <div className="h-10 w-72 rounded bg-gray-200 animate-pulse" />
        <div className="h-4 w-[40rem] max-w-full rounded bg-gray-100 animate-pulse" />
      </div>

      <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Loading admin activity, AI monitoring, and operator actions...
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded border bg-white p-4 space-y-3"
          >
            <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
            <div className="h-8 w-16 rounded bg-gray-100 animate-pulse" />
            <div className="h-4 w-full rounded bg-gray-100 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="rounded border bg-white p-4 space-y-3">
          <div className="h-5 w-48 rounded bg-gray-200 animate-pulse" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded border p-3 space-y-2">
              <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>

        <div className="rounded border bg-white p-4 space-y-3">
          <div className="h-5 w-36 rounded bg-gray-200 animate-pulse" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-4 rounded bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
