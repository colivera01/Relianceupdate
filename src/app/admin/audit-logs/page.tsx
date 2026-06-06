'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAdminRequestHeaders } from '@/lib/admin-client';
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

const fallbackActionTypes = [
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_BANNED',
  'ACCOUNT_ACTIVE',
  'ACCOUNT_DEACTIVATED',
  'ai_request',
  'ai_response',
  'ai_feedback',
  'ai_error',
  'consent_requested',
  'device_error',
  'device_paired',
  'job_assigned',
  'job_approved',
  'job_rejected',
  'job_stage_uploaded',
  'job_started',
  'membership_accepted',
  'MFA_TRUSTED_DEVICE_REVOKED',
  'notification_attempt',
  'PROMOTION_CAMPAIGN_CREATED',
  'PROMOTION_CAMPAIGN_UPDATED',
  'PROMOTION_PACKAGE_UPDATED',
  'PROMOTION_REQUEST_SUBMITTED',
  'review_capture_submitted',
  'SERVICE_PUBLISHED',
  'SERVICE_UNPUBLISHED',
  'VENDOR_LISTED_PUBLICLY',
  'VENDOR_UNLISTED',
];

const fallbackEntityTypes = [
  'ai_run',
  'booking',
  'content_report',
  'device',
  'review',
  'service',
  'vendor',
];

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
  const [availableActionTypes, setAvailableActionTypes] = useState<string[]>(fallbackActionTypes);
  const [availableEntityTypes, setAvailableEntityTypes] = useState<string[]>(fallbackEntityTypes);

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
        headers: getAdminRequestHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || `Status ${res.status}`);

      setLogs(Array.isArray(json.logs) ? json.logs : []);
      setTotalPages(Number(json?.pagination?.totalPages || 0));
      setTotal(Number(json?.pagination?.total || 0));
      const nextActionTypes = Array.isArray(json?.meta?.actionTypes)
        ? json.meta.actionTypes.filter((item: unknown) => typeof item === 'string' && item.trim())
        : [];
      const nextEntityTypes = Array.isArray(json?.meta?.entityTypes)
        ? json.meta.entityTypes.filter((item: unknown) => typeof item === 'string' && item.trim())
        : [];
      setAvailableActionTypes(Array.from(new Set([...fallbackActionTypes, ...nextActionTypes])).sort());
      setAvailableEntityTypes(Array.from(new Set([...fallbackEntityTypes, ...nextEntityTypes])).sort());
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

  const actionTypeOptions = useMemo(
    () => Array.from(new Set([...availableActionTypes, ...logs.map((l) => l.actionType).filter(Boolean)])).sort(),
    [availableActionTypes, logs]
  );

  const entityTypeOptions = useMemo(
    () => Array.from(new Set([...availableEntityTypes, ...logs.map((l) => l.entityType).filter(Boolean)])).sort(),
    [availableEntityTypes, logs]
  );

  const applyFilters = () => {
    setPage(1);
    fetchLogs();
  };

  const hasActiveFilters = Boolean(search.trim()) || actionType !== 'all' || entityType !== 'all';

  const clearFilters = () => {
    setSearch('');
    setActionType('all');
    setEntityType('all');
    setPage(1);
    setTimeout(() => {
      fetchLogs();
    }, 0);
  };

  const currentFilterSummary = [
    search.trim() ? `Search: ${search.trim()}` : null,
    actionType !== 'all' ? `Action: ${actionType}` : null,
    entityType !== 'all' ? `Entity: ${entityType}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-1">
            Admin actions captured across vendor operations, booking workflows, moderation, device pairing, and AI assist activity.
          </p>
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
            placeholder="Search by entity ID or actor user ID"
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
            {entityTypeOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
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
        {hasActiveFilters ? (
          <CardContent className="pt-0 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">Current filters:</span> {currentFilterSummary}
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters} disabled={loading}>
              Clear Filters
            </Button>
          </CardContent>
        ) : null}
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
