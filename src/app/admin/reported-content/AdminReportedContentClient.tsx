'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getAdminRequestHeaders } from '@/lib/admin-client';

type ReportRow = {
  id: string;
  targetType: string;
  targetId: string;
  bookingId: string | null;
  vendorId: string | null;
  reportedUserId: string | null;
  reportedVendorId: string | null;
  reporterUserId: string | null;
  reporterVendorId: string | null;
  reporterRole: string;
  reasonCategory: string;
  reasonDetail: string | null;
  status: string;
  severity: string;
  autoHidden: boolean;
  createdAt: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  moderationHref: string | null;
};

type DisputeSummarySuggestion = {
  aiRunId: string;
  analysisScope: 'content_report_and_linked_records';
  promptVersion: string;
  model: string;
  usage: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
  } | null;
  suggestion: {
    summary: string;
    disputeType:
      | 'delivery_or_completion'
      | 'video_or_verification'
      | 'billing_or_refund'
      | 'conduct_or_safety'
      | 'other';
    confidence: 'low' | 'medium' | 'high';
    timeline: string[];
    disputedPoints: string[];
    recommendedNextStep:
      | 'close_no_action'
      | 'needs_vendor_follow_up'
      | 'needs_customer_follow_up'
      | 'needs_admin_review';
    riskFlags: string[];
  };
  feedback:
    | {
        outcome: 'accepted' | 'overrode' | 'ignored';
      }
    | null;
};

type AiFeedbackOutcome = 'accepted' | 'overrode' | 'ignored';

type ReportFilters = {
  targetType: string;
  status: string;
  severity: string;
  reasonCategory: string;
  q: string;
};

const defaultFilters: ReportFilters = {
  targetType: '',
  status: '',
  severity: '',
  reasonCategory: '',
  q: '',
};

const statuses = [
  'open',
  'triaged',
  'under_review',
  'resolved_action_taken',
  'resolved_no_action',
  'dismissed',
];
const severities = ['low', 'medium', 'high', 'critical'];
const reasons = [
  'harassment',
  'hate',
  'nudity',
  'violence',
  'spam',
  'fraud',
  'copyright',
  'privacy',
  'misleading',
  'other',
];

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString();
}

function severityClass(severity: string): string {
  if (severity === 'critical') return 'bg-red-600 text-white';
  if (severity === 'high') return 'bg-orange-100 text-orange-800';
  if (severity === 'medium') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-700';
}

function statusClass(status: string): string {
  if (status.startsWith('resolved') || status === 'dismissed') {
    return 'bg-green-100 text-green-800';
  }
  if (status === 'under_review') return 'bg-blue-100 text-blue-800';
  if (status === 'triaged') return 'bg-purple-100 text-purple-800';
  return 'bg-red-50 text-red-700';
}

function feedbackOutcomeLabel(outcome: AiFeedbackOutcome): string {
  if (outcome === 'accepted') return 'Followed';
  if (outcome === 'overrode') return 'Overrode';
  return 'Ignored';
}

function statusRequiresResolutionNotes(status: string): boolean {
  return (
    status === 'resolved_action_taken' ||
    status === 'resolved_no_action' ||
    status === 'dismissed'
  );
}

export default function AdminReportedContentClient({
  initialAiDisputeSummaryEnabled,
}: {
  initialAiDisputeSummaryEnabled: boolean;
}) {
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(defaultFilters);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [aiFeedbackLoadingId, setAiFeedbackLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [aiSuggestionsById, setAiSuggestionsById] = useState<
    Record<string, DisputeSummarySuggestion>
  >({});

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value.trim()) params.set(key, value.trim());
    });
    params.set('limit', '25');
    return params.toString();
  }, [appliedFilters]);

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/reported-content?${queryString}`, {
        headers: getAdminRequestHeaders(),
        cache: 'no-store',
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      const rows = Array.isArray(json?.reports) ? json.reports : [];
      setReports(rows);
      setResolutionNotes((current) => {
        const next = { ...current };
        rows.forEach((report: ReportRow) => {
          if (next[report.id] === undefined) {
            next[report.id] = report.resolutionNotes || '';
          }
        });
        return next;
      });
    } catch (err) {
      setReports([]);
      setError(err instanceof Error ? err.message : 'Failed to load reported content');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const updateFilter = (key: keyof ReportFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  const updateReportStatus = async (report: ReportRow, status: string) => {
    setSavingId(report.id);
    setError('');
    try {
      const response = await fetch('/api/admin/reported-content', {
        method: 'PATCH',
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          reportId: report.id,
          status,
          resolutionNotes: resolutionNotes[report.id] || '',
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      await fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update report');
    } finally {
      setSavingId(null);
    }
  };

  const requestAiSummary = async (report: ReportRow) => {
    setAiLoadingId(report.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/reported-content/${report.id}/assist`, {
        method: 'POST',
        headers: getAdminRequestHeaders(),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      setAiSuggestionsById((current) => ({
        ...current,
        [report.id]: {
          aiRunId: String(json?.aiRunId || json?.responseId || ''),
          analysisScope: 'content_report_and_linked_records',
          promptVersion: String(json?.promptVersion || ''),
          model: String(json?.model || ''),
          usage: json?.usage || null,
          suggestion: json?.suggestion,
          feedback: null,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI dispute summary');
    } finally {
      setAiLoadingId(null);
    }
  };

  const recordAiSummaryFeedback = async (
    report: ReportRow,
    outcome: AiFeedbackOutcome
  ): Promise<'recorded' | 'skipped' | 'failed'> => {
    const aiSuggestion = aiSuggestionsById[report.id];
    if (!aiSuggestion?.aiRunId || aiSuggestion.feedback) {
      return 'skipped';
    }

    setAiFeedbackLoadingId(report.id);
    try {
      const response = await fetch('/api/admin/ai/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminRequestHeaders(),
        },
        body: JSON.stringify({
          aiRunId: aiSuggestion.aiRunId,
          feature: 'dispute_summary_assistant',
          operation: 'summarize_content_report_case',
          relatedEntityType: 'content_report',
          relatedEntityId: report.id,
          outcome,
          source: 'admin_reported_content',
          promptVersion: aiSuggestion.promptVersion,
          model: aiSuggestion.model,
          recommendedAction: aiSuggestion.suggestion.recommendedNextStep,
          actualAction: report.status,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setAiSuggestionsById((current) => {
        const existing = current[report.id];
        if (!existing) return current;
        return {
          ...current,
          [report.id]: {
            ...existing,
            feedback: {
              outcome,
            },
          },
        };
      });
      return 'recorded';
    } catch (err) {
      console.warn('[admin/reported-content] failed to record AI feedback', {
        reportId: report.id,
        outcome,
        error: err instanceof Error ? err.message : String(err),
      });
      return 'failed';
    } finally {
      setAiFeedbackLoadingId(null);
    }
  };

  const openCount = reports.filter((report) => report.status === 'open').length;
  const highRiskCount = reports.filter(
    (report) => report.severity === 'high' || report.severity === 'critical'
  ).length;

  return (
    <div className="space-y-6">
      <header className="reliance-operator-hero rounded-[32px] px-6 py-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
              Admin moderation
            </div>
            <h1 className="font-display text-4xl font-semibold text-white sm:text-5xl">
          Reported content review stays inside the same proof-of-service trust system
            </h1>
            <p className="text-sm leading-7 text-white/72 sm:text-base">
              Review persisted content reports and jump into the existing review or media moderation tools.
            </p>
          </div>
          <Button variant="outline" onClick={fetchReports} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Reported content summary">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-white">{reports.length}</div>
            <div className="text-sm text-gray-600">Reports in current view</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{openCount}</div>
            <div className="text-sm text-gray-600">Open reports</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{highRiskCount}</div>
            <div className="text-sm text-gray-600">High or critical severity</div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="space-y-1">
            <Label htmlFor="targetType">Target</Label>
            <select
              id="targetType"
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              value={filters.targetType}
              onChange={(event) => updateFilter('targetType', event.target.value)}
            >
              <option value="">All targets</option>
              <option value="review">Reviews</option>
              <option value="media_asset">Media assets</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              value={filters.status}
              onChange={(event) => updateFilter('status', event.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="severity">Severity</Label>
            <select
              id="severity"
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              value={filters.severity}
              onChange={(event) => updateFilter('severity', event.target.value)}
            >
              <option value="">All severities</option>
              {severities.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="reasonCategory">Reason</Label>
            <select
              id="reasonCategory"
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              value={filters.reasonCategory}
              onChange={(event) => updateFilter('reasonCategory', event.target.value)}
            >
              <option value="">All reasons</option>
              {reasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="q">Search</Label>
            <Input
              id="q"
              value={filters.q}
              onChange={(event) => updateFilter('q', event.target.value)}
              placeholder="ID, note, vendor"
            />
          </div>
          <div className="md:col-span-5 flex flex-wrap gap-2">
            <Button type="button" onClick={applyFilters} disabled={loading}>
              Apply Filters
            </Button>
            <Button type="button" variant="outline" onClick={clearFilters} disabled={loading}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">Loading reported content queue...</CardContent>
        </Card>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-gray-400" />
            <p className="text-gray-600">No reports match the current filters.</p>
            <p className="mt-2 text-sm text-gray-500">Try broadening the filters or clear them to return to the launch-facing queue.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const aiSuggestion = aiSuggestionsById[report.id];
            const aiActionBusy = aiLoadingId === report.id;
            const aiFeedbackBusy = aiFeedbackLoadingId === report.id;
            const reportNotes = resolutionNotes[report.id] || '';
            const hasResolutionNotes = reportNotes.trim().length > 0;

            return (
              <Card key={report.id} className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={severityClass(report.severity)}>{report.severity}</Badge>
                        <Badge className={statusClass(report.status)}>{formatLabel(report.status)}</Badge>
                        <Badge variant="outline">{formatLabel(report.targetType)}</Badge>
                        {report.autoHidden && (
                          <Badge variant="outline" className="border-orange-300 text-orange-700">
                            auto hidden
                          </Badge>
                        )}
                      </div>
                      <div>
                        <h2 className="font-semibold text-gray-900">
                          {formatLabel(report.targetType)} report for {report.reasonCategory}
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">
                          Target ID: <span className="font-mono">{report.targetId}</span>
                          {report.bookingId ? (
                            <>
                              {' '}
                              | Booking ID: <span className="font-mono">{report.bookingId}</span>
                            </>
                          ) : null}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          Reporter: {report.reporterRole}
                          {report.reporterUserId ? ` user ${report.reporterUserId}` : ''}
                          {report.reporterVendorId ? ` vendor ${report.reporterVendorId}` : ''}
                        </p>
                      </div>
                      {report.reasonDetail && (
                        <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                          {report.reasonDetail}
                        </div>
                      )}
                      <div className="grid grid-cols-1 gap-2 text-xs text-gray-500 md:grid-cols-2">
                        <div>Created: {formatDate(report.createdAt)}</div>
                        <div>Resolved: {formatDate(report.resolvedAt)}</div>
                        <div>Vendor ID: {report.vendorId || report.reportedVendorId || 'Not linked'}</div>
                        <div>User ID: {report.reportedUserId || 'Not linked'}</div>
                      </div>
                      {report.moderationHref && (
                        <Link
                          href={report.moderationHref}
                          className="inline-flex items-center text-sm font-medium text-[var(--reliance-blue-soft)] hover:text-white"
                        >
                          Open matching moderation surface
                          <ExternalLink className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      )}
                      {initialAiDisputeSummaryEnabled ? (
                        <div className="reliance-operator-surface rounded-2xl border border-sky-200/70 bg-sky-50/70 p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium text-gray-900">AI Case Assist</div>
                              <p className="text-xs text-gray-600">
                                Report and linked-record summary only. The AI does not watch raw media or interview either side in this version.
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={aiActionBusy}
                              onClick={() => requestAiSummary(report)}
                            >
                              <Sparkles className="mr-1 h-4 w-4" />
                              {aiActionBusy ? 'Analyzing...' : 'Generate AI Summary'}
                            </Button>
                          </div>
                          {aiSuggestion ? (
                            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 space-y-3 shadow-[0_18px_55px_rgba(4,10,22,0.24)]">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="bg-sky-700 text-white hover:bg-sky-700">
                                  Case type: {formatLabel(aiSuggestion.suggestion.disputeType)}
                                </Badge>
                                <Badge variant="outline">
                                  Confidence: {formatLabel(aiSuggestion.suggestion.confidence)}
                                </Badge>
                                <Badge variant="outline">
                                  Next step: {formatLabel(aiSuggestion.suggestion.recommendedNextStep)}
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-900">{aiSuggestion.suggestion.summary}</div>
                              {aiSuggestion.suggestion.disputedPoints.length ? (
                                <div className="space-y-2">
                                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                    Main disputed points
                                  </div>
                                  <ul className="list-disc pl-5 text-sm text-gray-700">
                                    {aiSuggestion.suggestion.disputedPoints.map((point, index) => (
                                      <li key={`${report.id}:point:${index}`}>{point}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {aiSuggestion.suggestion.timeline.length ? (
                                <div className="space-y-2">
                                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                    Timeline
                                  </div>
                                  <ul className="list-disc pl-5 text-sm text-gray-700">
                                    {aiSuggestion.suggestion.timeline.map((item, index) => (
                                      <li key={`${report.id}:timeline:${index}`}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {aiSuggestion.suggestion.riskFlags.length ? (
                                <div className="space-y-2">
                                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                    Risk flags
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {aiSuggestion.suggestion.riskFlags.map((flag) => (
                                      <Badge key={`${report.id}:risk:${flag}`} variant="outline">
                                        {formatLabel(flag)}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              <div className="rounded-2xl border border-dashed border-white/14 bg-white/5 p-3 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                    Operator feedback
                                  </div>
                                  {aiSuggestion.feedback ? (
                                    <Badge variant="outline">
                                      {feedbackOutcomeLabel(aiSuggestion.feedback.outcome)}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-gray-500">
                                      After you resolve or advance the case, record whether you followed, overrode, or ignored this AI summary.
                                    </span>
                                  )}
                                </div>
                                {!aiSuggestion.feedback ? (
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={aiFeedbackBusy}
                                      onClick={async () => {
                                        const result = await recordAiSummaryFeedback(report, 'accepted');
                                        if (result === 'recorded') {
                                          setError('');
                                        }
                                      }}
                                    >
                                      Mark Followed
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={aiFeedbackBusy}
                                      onClick={async () => {
                                        const result = await recordAiSummaryFeedback(report, 'overrode');
                                        if (result === 'recorded') {
                                          setError('');
                                        }
                                      }}
                                    >
                                      Mark Overrode
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={aiFeedbackBusy}
                                      onClick={async () => {
                                        const result = await recordAiSummaryFeedback(report, 'ignored');
                                        if (result === 'recorded') {
                                          setError('');
                                        }
                                      }}
                                    >
                                      Mark Ignored
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                Model: {aiSuggestion.model || 'Unknown'}
                                {aiSuggestion.usage?.totalTokens ? ` • Tokens: ${aiSuggestion.usage.totalTokens}` : ''}
                                {aiSuggestion.promptVersion ? ` • Prompt: ${aiSuggestion.promptVersion}` : ''}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="w-full space-y-3 lg:w-80">
                      <div className="space-y-1">
                        <Label htmlFor={`notes-${report.id}`}>Resolution notes</Label>
                        <Textarea
                          id={`notes-${report.id}`}
                          value={reportNotes}
                          onChange={(event) =>
                            setResolutionNotes((current) => ({
                              ...current,
                              [report.id]: event.target.value,
                            }))
                          }
                          placeholder="Required for resolved or dismissed reports"
                        />
                        <p className="text-xs text-gray-500">
                          Add clear notes before marking a report resolved or dismissed.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {statuses.map((status) => (
                          <Button
                            key={status}
                            type="button"
                            size="sm"
                            variant={report.status === status ? 'default' : 'outline'}
                            disabled={
                              savingId === report.id ||
                              (statusRequiresResolutionNotes(status) && !hasResolutionNotes)
                            }
                            onClick={() => updateReportStatus(report, status)}
                          >
                            {formatLabel(status)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="flex gap-3 pt-6 text-sm text-orange-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            This is a first-pass queue for persisted reports. Public guest report buttons, appeal flows,
            assigned case ownership, and automated escalations remain intentionally deferred.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
