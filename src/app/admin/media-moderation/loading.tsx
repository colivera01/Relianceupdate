export default function AdminMediaModerationLoading() {
  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Media Moderation</h1>
        <p className="mt-1 text-sm text-gray-600">
          Loading the staged service video moderation queue...
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-3 h-5 w-48 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-3 md:grid-cols-4">
          <div className="h-10 animate-pulse rounded bg-slate-100" />
          <div className="h-10 animate-pulse rounded bg-slate-100" />
          <div className="h-10 animate-pulse rounded bg-slate-100" />
          <div className="h-10 animate-pulse rounded bg-slate-100" />
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-3 h-5 w-64 animate-pulse rounded bg-slate-200" />
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="h-24 animate-pulse rounded bg-slate-100" />
              <div className="h-24 animate-pulse rounded bg-slate-100" />
              <div className="h-24 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
