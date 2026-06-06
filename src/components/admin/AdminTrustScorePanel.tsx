'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAdminRequestHeaders } from '@/lib/admin-client';
import { isMeaningfulTrustScore } from '@/lib/trust-score-admin-display';

interface ComponentMetric {
  pct: number | null;
  numerator: number;
  denominator: number;
  weightPct: number;
}

interface TrustScoreExplanationDetails {
  overview: string;
  coverageSummary: string;
  strongestSignals: string[];
  watchItems: string[];
  methodology: string[];
}

interface AdminSnapshot {
  totalScorePct: number | null;
  components: {
    workflowCompletion: ComponentMetric;
    videoVerification: ComponentMetric;
    disputeFree: ComponentMetric;
    operationalReliability: ComponentMetric;
  } | null;
  computedAt: string | null;
  isCurrent: boolean | null;
  visibilityStatus: string | null;
  inputHash: string | null;
  lastRecalcReason: string | null;
  lastRecalcSource: string | null;
  scoreVersion?: number | null;
}

interface AdminTrustScore {
  scored: boolean;
  snapshot: AdminSnapshot | null;
  improvementHints?: string[];
  explanation?: string;
  explanationDetails?: TrustScoreExplanationDetails;
}

type SnapshotReadCapability = 'ok' | 'delegate_unavailable';

const METRIC_ROWS: Array<{ key: keyof NonNullable<AdminSnapshot['components']>; label: string }> = [
  { key: 'workflowCompletion', label: 'Verified Workflow Completion' },
  { key: 'videoVerification', label: 'Video Verification Success' },
  { key: 'disputeFree', label: 'Dispute-Free Completion' },
  { key: 'operationalReliability', label: 'Operational Reliability' },
];

function formatPct(pct: number | null): string {
  return pct === null || pct === undefined ? 'Not yet measurable' : `${pct}%`;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : '—';
}

export function AdminTrustScorePanel({
  vendorId,
  vendorName,
}: {
  vendorId: string;
  vendorName?: string;
}) {
  const [data, setData] = useState<AdminTrustScore | null>(null);
  const [snapshotReadCapability, setSnapshotReadCapability] =
    useState<SnapshotReadCapability>('ok');
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/trust-score`, {
        headers: getAdminRequestHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || json?.message || `Status ${res.status}`);
      }
      setData(json?.trustScore ?? null);
      setSnapshotReadCapability(
        json?.snapshotReadCapability === 'delegate_unavailable' ? 'delegate_unavailable' : 'ok'
      );
    } catch (err) {
      // Best-effort read: never blocks other admin actions on this page.
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to load Trust Score');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const recalculate = async () => {
    if (!vendorId) return;
    setRecalculating(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/trust-score/recalculate`, {
        method: 'POST',
        headers: getAdminRequestHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || json?.message || `Status ${res.status}`);
      }
      // Re-read the (now-current) snapshot; display stays snapshot-based, not a live browser calc.
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recalculate Trust Score');
    } finally {
      setRecalculating(false);
    }
  };

  const snapshot = data?.snapshot ?? null;
  const scored = isMeaningfulTrustScore(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#204080]" />
            Reliance Trust Score
            <Badge variant="outline">Admin only</Badge>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={recalculate}
            disabled={recalculating || loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Recalculating…' : 'Recalculate snapshot'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-gray-500">
          Platform-generated operational score (0–100%) for{' '}
          <span className="font-medium">{vendorName || vendorId}</span>. This is{' '}
          <span className="font-semibold">separate from Customer Rating</span> (voluntary customer
          reviews) and is read from the latest stored snapshot — it is not recalculated in the
          browser.
        </p>

        {error && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </div>
        )}

        {snapshotReadCapability === 'delegate_unavailable' && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <div className="font-medium">Trust Score read unavailable (stale dev server)</div>
            <p className="mt-1">
              This process cannot read stored Trust Score snapshots — the Prisma client was likely
              started before the snapshot model existed. Restart the dev server after{' '}
              <code className="text-xs">prisma generate</code> or schema migrations. This is not the
              same as a vendor being genuinely &quot;not yet scored&quot;.
            </p>
          </div>
        )}

        {loading && !data ? (
          <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
            Loading Trust Score…
          </div>
        ) : snapshotReadCapability === 'delegate_unavailable' ? null : !scored ? (
          <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600">
            <div className="font-medium text-gray-800">Not yet scored</div>
            <p className="mt-1">
              No meaningful Reliance Trust Score yet — there isn’t enough finalized platform activity
              (verified completions, video verification, disputes, operational outcomes) for this
              vendor. A snapshot exists but its metrics are not yet measurable.
            </p>
            {snapshot?.computedAt && (
              <p className="mt-2 text-xs text-gray-500">
                Last computed: {formatDateTime(snapshot.computedAt)}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="text-4xl font-bold text-[#204080]">
                {snapshot?.totalScorePct === null ? 'N/A' : `${snapshot?.totalScorePct}%`}
              </div>
              <div className="pb-1 text-sm text-gray-500">Total Reliance Trust Score</div>
            </div>

            <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
              {METRIC_ROWS.map(({ key, label }) => {
                const m = snapshot!.components![key];
                return (
                  <div key={key} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-800">{label}</span>
                      <span className="ml-2 text-xs text-gray-400">weight {m.weightPct}%</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">{formatPct(m.pct)}</div>
                      <div className="text-xs text-gray-400">
                        {m.numerator}/{m.denominator} finalized
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {Array.isArray(data?.improvementHints) && data!.improvementHints!.length > 0 && (
              <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">
                <div className="mb-1 font-medium text-gray-700">Improvement opportunities</div>
                <ul className="list-disc space-y-1 pl-4">
                  {data!.improvementHints!.map((hint, i) => (
                    <li key={i}>{hint}</li>
                  ))}
                </ul>
              </div>
            )}

            {data?.explanationDetails && (
              <div className="space-y-3 rounded-md border border-blue-100 bg-blue-50/60 p-3 text-xs text-gray-700">
                <div>
                  <div className="mb-1 font-medium text-gray-800">Why this score</div>
                  <p>{data.explanationDetails.overview}</p>
                </div>

                <div>
                  <div className="mb-1 font-medium text-gray-800">Coverage</div>
                  <p>{data.explanationDetails.coverageSummary}</p>
                </div>

                {data.explanationDetails.strongestSignals.length > 0 && (
                  <div>
                    <div className="mb-1 font-medium text-gray-800">Strongest signals</div>
                    <ul className="list-disc space-y-1 pl-4">
                      {data.explanationDetails.strongestSignals.map((item, index) => (
                        <li key={`strong-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.explanationDetails.watchItems.length > 0 && (
                  <div>
                    <div className="mb-1 font-medium text-gray-800">Watch items</div>
                    <ul className="list-disc space-y-1 pl-4">
                      {data.explanationDetails.watchItems.map((item, index) => (
                        <li key={`watch-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <div className="mb-1 font-medium text-gray-800">Methodology</div>
                  <ul className="list-disc space-y-1 pl-4">
                    {data.explanationDetails.methodology.map((item, index) => (
                      <li key={`method-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <div>Computed: {formatDateTime(snapshot?.computedAt ?? null)}</div>
              <div>Score version: {snapshot?.scoreVersion ?? '—'}</div>
              <div>Last trigger: {snapshot?.lastRecalcReason || '—'}</div>
              <div>Source: {snapshot?.lastRecalcSource || '—'}</div>
              <div>Visibility: {snapshot?.visibilityStatus || '—'}</div>
              <div className="truncate">Input hash: {snapshot?.inputHash || '—'}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminTrustScorePanel;
