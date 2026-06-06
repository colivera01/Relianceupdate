export default function AdminSecurityLoading() {
  return (
    <div className="w-full max-w-4xl p-4 space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded bg-gray-200 animate-pulse" />
        <div className="h-4 w-96 rounded bg-gray-100 animate-pulse" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <div className="h-6 w-56 rounded bg-gray-200 animate-pulse" />
        <div className="h-4 w-full rounded bg-gray-100 animate-pulse" />
        <div className="h-4 w-5/6 rounded bg-gray-100 animate-pulse" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-28 rounded-lg bg-gray-50 animate-pulse" />
          <div className="h-28 rounded-lg bg-gray-50 animate-pulse" />
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Loading admin security controls, passkeys, and recovery guidance...
      </div>
    </div>
  );
}
