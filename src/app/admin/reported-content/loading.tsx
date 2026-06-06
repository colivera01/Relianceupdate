export default function AdminReportedContentLoading() {
  return (
    <div className="w-full max-w-6xl p-4 space-y-4">
      <div className="space-y-2">
        <div className="h-10 w-72 rounded bg-gray-200 animate-pulse" />
        <div className="h-4 w-[34rem] max-w-full rounded bg-gray-100 animate-pulse" />
      </div>

      <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Loading reported content, AI case assistance, and resolution controls...
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-10 rounded border bg-white animate-pulse"
          />
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded border bg-white p-4 space-y-3"
          >
            <div className="h-5 w-56 rounded bg-gray-200 animate-pulse" />
            <div className="h-4 w-full rounded bg-gray-100 animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-gray-100 animate-pulse" />
            <div className="flex gap-2">
              <div className="h-9 w-28 rounded bg-gray-200 animate-pulse" />
              <div className="h-9 w-28 rounded bg-gray-100 animate-pulse" />
              <div className="h-9 w-36 rounded bg-gray-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
