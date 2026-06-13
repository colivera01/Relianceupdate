'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAdminRequestHeaders } from '@/lib/admin-client';

type AiOwnerQueueItem = {
  actionType: string;
  feature: string;
  title: string;
  summary: string;
  decision: string;
  confidence: 'low' | 'medium' | 'high';
  severity: 'info' | 'warning' | 'critical';
  surfaceHref: string;
  relatedEntityType: string;
  relatedEntityId: string;
  relatedEntityLabel: string;
  blockers: string[];
  recommendedActions: string[];
  generatedAt: string | null;
  actorUserId: string | null;
  currentStatus: string;
  reasonOpen: string;
};

type AiOwnerQueueResponse = {
  success: boolean;
  counts: {
    unresolved: number;
    redFlags: number;
    needsReview: number;
  };
  items: AiOwnerQueueItem[];
};

function severityClass(severity: AiOwnerQueueItem['severity']) {
  if (severity === 'critical') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (severity === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

function prettyDecision(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AdminAiReviewQueuePage() {
  const [data, setData] = useState<AiOwnerQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/ai/review-queue', {
        method: 'GET',
        headers: getAdminRequestHeaders(),
        cache: 'no-store',
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      setData(json as AiOwnerQueueResponse);
    } catch (loadError) {
      setData(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load the AI review queue'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Review Queue</h1>
          <p className="mt-2 text-gray-600">
            One owner queue for current AI red flags, recommendations still needing review,
            and unresolved AI-assisted cases.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6 text-sm text-blue-900">
          AI remains recommendation-only here. Final approvals, moderation outcomes, publishing,
          promotions, and triage decisions still stay manual.
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Unresolved AI Cases
            </div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {data?.counts.unresolved ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-red-600">
              Current Red Flags
            </div>
            <div className="mt-2 text-3xl font-bold text-red-700">
              {data?.counts.redFlags ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">
              Recommendations Needing Review
            </div>
            <div className="mt-2 text-3xl font-bold text-amber-700">
              {data?.counts.needsReview ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Loading current AI queue...
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No unresolved AI-assisted items are open right now.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={`${item.actionType}:${item.relatedEntityId}`}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={severityClass(item.severity)}>
                        {item.severity === 'critical'
                          ? 'Red flag'
                          : item.severity === 'warning'
                            ? 'Needs review'
                            : 'Open'}
                      </Badge>
                      <Badge variant="outline">
                        {prettyDecision(item.decision)}
                      </Badge>
                      <Badge variant="outline">
                        {item.confidence} confidence
                      </Badge>
                    </div>
                  </div>
                  <Link
                    href={item.surfaceHref}
                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Open workflow
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 text-blue-600" />
                    <p className="text-slate-800">{item.summary}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Why it is still open
                    </div>
                    <p className="mt-2 text-slate-800">{item.reasonOpen}</p>
                    <p className="mt-2 text-xs text-slate-600">{item.currentStatus}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Record
                    </div>
                    <p className="mt-2 text-slate-800">{item.relatedEntityLabel}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {item.relatedEntityType} {item.relatedEntityId}
                    </p>
                  </div>
                </div>

                {item.blockers.length > 0 ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      Blocking or risk signals
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-red-800">
                      {item.blockers.slice(0, 4).map((blocker) => (
                        <li key={blocker}>- {blocker}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {item.recommendedActions.length > 0 ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      Recommended next actions
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-blue-900">
                      {item.recommendedActions.slice(0, 4).map((action) => (
                        <li key={action}>- {action}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
