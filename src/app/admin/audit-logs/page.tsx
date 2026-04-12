'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw } from 'lucide-react';

type AuditLogRow = {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string;
  actorUserId: string;
  previousValue: string | null;
  newValue: string | null;
  metadata: string | null;
  createdAt: string;
};

function prettyJson(value: string | null): string {
  if (!value) return '-';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('all');
  const [entityType, setEntityType] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  const adminHeaders = () => {
    const user = (() => {
      try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();
    const userId = user?.id || 'D43B6BB3-1A72-45EC-A362-A6E1E0580EA0';
    return {
      'Content-Type': 'application/json',
      'x-user-id': String(userId),
      'x-user-role': 'admin',
      'x-admin': 'true',
    };
  };

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (actionType !== 'all') params.set('actionType', actionType);
      if (entityType !== 'all') params.set('entityType', entityType);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        method: 'GET',
        headers: adminHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || `Status ${res.status}`);

      setLogs(Array.isArray(json.logs) ? json.logs : []);
      setTotalPages(Number(json?.pagination?.totalPages || 0));
      setTotal(Number(json?.pagination?.total || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit logs');
      setLogs([]);
      setTotalPages(0);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const actionTypeOptions = useMemo(() => {
    const values = new Set(logs.map((l) => l.actionType).filter(Boolean));
    return Array.from(values).sort();
  }, [logs]);

  const applyFilters = () => {
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-1">Admin actions captured for marketplace publish/listing controls.</p>
        </div>
        <Button variant="outline" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input
            placeholder="Search by entityId or actorUserId"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All action types</option>
            {actionTypeOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All entities</option>
            <option value="vendor">vendor</option>
            <option value="service">service</option>
            <option value="review">review</option>
          </select>
          <select
            value={String(limit)}
            onChange={(e) => {
              setPage(1);
              setLimit(Number(e.target.value));
            }}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>
          <Button onClick={applyFilters} disabled={loading}>
            Apply Filters
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">Loading audit logs...</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-red-600">{error}</CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No audit log records found for the current filters.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="py-3 text-sm text-gray-600">
              Showing {logs.length} of {total} total logs.
            </CardContent>
          </Card>

          <div className="space-y-3">
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div><span className="font-semibold">Action:</span> {log.actionType}</div>
                    <div><span className="font-semibold">When:</span> {new Date(log.createdAt).toLocaleString()}</div>
                    <div><span className="font-semibold">Entity Type:</span> {log.entityType}</div>
                    <div><span className="font-semibold">Entity ID:</span> {log.entityId}</div>
                    <div className="md:col-span-2"><span className="font-semibold">Actor User ID:</span> {log.actorUserId}</div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">Previous Value</p>
                      <pre className="text-xs bg-gray-50 border rounded p-2 overflow-auto max-h-56 whitespace-pre-wrap">
                        {prettyJson(log.previousValue)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">New Value</p>
                      <pre className="text-xs bg-gray-50 border rounded p-2 overflow-auto max-h-56 whitespace-pre-wrap">
                        {prettyJson(log.newValue)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">Metadata</p>
                      <pre className="text-xs bg-gray-50 border rounded p-2 overflow-auto max-h-56 whitespace-pre-wrap">
                        {prettyJson(log.metadata)}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-700">Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}