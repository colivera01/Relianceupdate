'use client';

import { useEffect, useState } from 'react';

export default function ReviewAuditPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    bookingId: '',
    vendorId: '',
    customer: '',
    reviewWindowStatus: '',
    sentiment: '',
    consentStatus: '',
    dateFrom: '',
    dateTo: '',
  });

  const adminHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': 'D43B6BB3-1A72-45EC-A362-A6E1E0580EA0',
    'x-user-role': 'admin',
    'x-admin': 'true',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const res = await fetch(`/api/admin/review-audit?${params.toString()}`, {
      headers: adminHeaders(),
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error || 'Failed to load review audit');
      setRows([]);
      setTotal(0);
    } else {
      setRows(Array.isArray(json?.rows) ? json.rows : []);
      setTotal(Number(json?.pagination?.total ?? 0));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-7xl p-4 space-y-4">
      <h1 className="text-3xl font-bold text-gray-900">Review Audit</h1>
      <p className="text-sm text-gray-600">Customer review-window, consent, sentiment, and outcome history.</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded border bg-white p-3">
        <input placeholder="Booking ID" className="rounded border px-2 py-1 text-sm" value={filters.bookingId} onChange={(e) => setFilters((f) => ({ ...f, bookingId: e.target.value }))} />
        <input placeholder="Vendor ID" className="rounded border px-2 py-1 text-sm" value={filters.vendorId} onChange={(e) => setFilters((f) => ({ ...f, vendorId: e.target.value }))} />
        <input placeholder="Customer contact/user" className="rounded border px-2 py-1 text-sm" value={filters.customer} onChange={(e) => setFilters((f) => ({ ...f, customer: e.target.value }))} />
        <input placeholder="Window status" className="rounded border px-2 py-1 text-sm" value={filters.reviewWindowStatus} onChange={(e) => setFilters((f) => ({ ...f, reviewWindowStatus: e.target.value }))} />
        <input placeholder="Sentiment" className="rounded border px-2 py-1 text-sm" value={filters.sentiment} onChange={(e) => setFilters((f) => ({ ...f, sentiment: e.target.value }))} />
        <input placeholder="Consent status" className="rounded border px-2 py-1 text-sm" value={filters.consentStatus} onChange={(e) => setFilters((f) => ({ ...f, consentStatus: e.target.value }))} />
        <input type="date" className="rounded border px-2 py-1 text-sm" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
        <input type="date" className="rounded border px-2 py-1 text-sm" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
        <button onClick={load} className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">Apply Filters</button>
      </div>

      {loading ? <div className="rounded border bg-white p-6 text-sm text-gray-500">Loading...</div> : null}
      {error ? <div className="rounded border bg-red-50 p-6 text-sm text-red-700">{error}</div> : null}
      {!loading && !error ? (
        <div className="space-y-2">
          <div className="rounded border bg-white px-3 py-2 text-xs text-gray-600">
            Total matching rows: {total}. Click a row for full JSON detail (consent chain, prompts, sentiment, outcome).
          </div>
          {rows.length === 0 ? <div className="rounded border bg-white p-6 text-sm text-gray-500">No rows found for the current filters.</div> : null}
          {rows.map((row) => (
            <button
              key={row.reviewWindowId}
              onClick={() => setSelected(row)}
              className="w-full rounded border bg-white p-3 text-left hover:bg-gray-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Window {row.reviewWindowId}</p>
                  <p className="text-xs text-gray-600">Booking {row.booking?.id} • Vendor {row.vendor?.businessName || row.vendor?.name || row.vendor?.id}</p>
                </div>
                <div className="text-xs text-gray-700">Status: {row.status}</div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Review Audit Detail</h2>
              <button onClick={() => setSelected(null)} className="text-sm text-gray-600 hover:text-gray-900">Close</button>
            </div>
            <pre className="rounded border bg-gray-50 p-3 text-xs whitespace-pre-wrap">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
