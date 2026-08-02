// src/app/admin/notifications/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ShieldAlert,
  UserX,
  Sparkles,
  ClipboardCheck,
} from 'lucide-react';
import { getAdminRequestHeaders } from '@/lib/admin-client';

interface AdminNotification {
  id: string;
  vendorId: string | null;
  type: string;
  title: string;
  message: string;
  metadata: string | null;
  read: boolean;
  createdAt: string;
  vendor?: {
    businessName: string | null;
    name: string;
  };
}

interface SupportTriageRecommendation {
  aiRunId: string;
  promptVersion: string;
  model: string;
  generatedAt?: string | null;
  suggestion: {
    summary: string;
    confidence: 'low' | 'medium' | 'high';
    urgentItems: string[];
    soonItems: string[];
    batchLaterItems: string[];
    redFlags: string[];
    recommendedActions: string[];
  };
}

interface SupportTriageState {
  aiEnabled: boolean;
  counts: {
    unreadCount: number;
    totalCount: number;
  };
  latestRecommendation: SupportTriageRecommendation | null;
}

const APPROVAL_NOTIFICATION_TYPES = new Set([
  'VENDOR_APPROVAL_REQUIRED',
  'MEDIA_MODERATION_REQUIRED',
  'REVIEW_MODERATION_REQUIRED',
  'PROMOTION_REQUEST',
]);

function isApprovalNotification(type: string) {
  return APPROVAL_NOTIFICATION_TYPES.has(type);
}

function prettyConfidence(value: 'low' | 'medium' | 'high') {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)} confidence`;
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [supportTriage, setSupportTriage] = useState<SupportTriageState | null>(null);
  const [loading, setLoading] = useState(true);
  const [triageLoading, setTriageLoading] = useState(false);
  const [error, setError] = useState('');
  const [triageError, setTriageError] = useState('');
  const [triageMessage, setTriageMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'approvals' | 'storage' | 'safety' | 'reports' | 'accounts'>('all');

  const fetchNotificationsData = async () => {
    const res = await fetch('/api/admin/notifications', {
      headers: getAdminRequestHeaders(),
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || json?.message || `Status ${res.status}`);
    }
    return Array.isArray(json.notifications) ? json.notifications : [];
  };

  const fetchSupportTriageData = async (): Promise<SupportTriageState> => {
    const res = await fetch('/api/admin/support-triage', {
      headers: getAdminRequestHeaders(),
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || json?.message || `Status ${res.status}`);
    }
    return {
      aiEnabled: Boolean(json?.aiEnabled),
      counts: {
        unreadCount: Number(json?.counts?.unreadCount || 0),
        totalCount: Number(json?.counts?.totalCount || 0),
      },
      latestRecommendation: json?.latestRecommendation || null,
    };
  };

  const loadAll = async () => {
    setLoading(true);
    setError('');
    setTriageError('');
    setTriageMessage('');

    const [notificationsResult, triageResult] = await Promise.allSettled([
      fetchNotificationsData(),
      fetchSupportTriageData(),
    ]);

    if (notificationsResult.status === 'fulfilled') {
      setNotifications(notificationsResult.value);
    } else {
      console.error('Error fetching notifications:', notificationsResult.reason);
      setNotifications([]);
      setError(
        notificationsResult.reason instanceof Error
          ? notificationsResult.reason.message
          : 'Failed to load notifications'
      );
    }

    if (triageResult.status === 'fulfilled') {
      setSupportTriage(triageResult.value);
    } else {
      console.error('Error fetching support triage:', triageResult.reason);
      setSupportTriage(null);
      setTriageError(
        triageResult.reason instanceof Error
          ? triageResult.reason.message
          : 'Failed to load AI support triage'
      );
    }

    setLoading(false);
  };

  const refreshSupportTriageOnly = async () => {
    try {
      const next = await fetchSupportTriageData();
      setSupportTriage(next);
      setTriageError('');
    } catch (err) {
      console.error('Error refreshing support triage:', err);
      setTriageError(err instanceof Error ? err.message : 'Failed to load AI support triage');
    }
  };

  const runSupportTriage = async () => {
    setTriageLoading(true);
    setTriageError('');
    setTriageMessage('');
    try {
      const res = await fetch('/api/admin/support-triage', {
        method: 'POST',
        headers: getAdminRequestHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || json?.message || `Status ${res.status}`);
      }
      setTriageMessage(json?.message || 'AI support triage generated.');
      await refreshSupportTriageOnly();
    } catch (err) {
      console.error('Error running support triage:', err);
      setTriageError(
        err instanceof Error ? err.message : 'Failed to generate AI support triage'
      );
    } finally {
      setTriageLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/notifications/${id}/read`, {
        method: 'POST',
        headers: getAdminRequestHeaders(),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      await loadAll();
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/admin/notifications/read-all', {
        method: 'POST',
        headers: getAdminRequestHeaders(),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      await loadAll();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'approvals') return isApprovalNotification(n.type);
    if (filter === 'storage') return n.type.startsWith('STORAGE');
    if (filter === 'safety') return n.type === 'ACCOUNT_ACTION' || n.type === 'CONTENT_REPORT';
    if (filter === 'reports') return n.type === 'CONTENT_REPORT';
    if (filter === 'accounts') return n.type === 'ACCOUNT_ACTION';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const approvalAlerts = notifications.filter((n) => !n.read && isApprovalNotification(n.type)).length;
  const storageAlerts = notifications.filter((n) => n.type.startsWith('STORAGE') && !n.read).length;
  const safetyAlerts = notifications.filter(
    (n) => !n.read && (n.type === 'ACCOUNT_ACTION' || n.type === 'CONTENT_REPORT')
  ).length;
  const contentReportAlerts = notifications.filter((n) => n.type === 'CONTENT_REPORT' && !n.read).length;
  const accountActionAlerts = notifications.filter((n) => n.type === 'ACCOUNT_ACTION' && !n.read).length;
  const latestSuggestion = supportTriage?.latestRecommendation?.suggestion || null;

  const parseMetadata = (value: string | null): Record<string, any> | null => {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  };

  const getNotificationIcon = (type: string) => {
    if (isApprovalNotification(type)) return <ClipboardCheck className="w-5 h-5 text-blue-600" />;
    if (type === 'STORAGE_LIMIT_REACHED') return <XCircle className="w-5 h-5 text-red-600" />;
    if (type === 'STORAGE_ALERT') return <AlertTriangle className="w-5 h-5 text-orange-600" />;
    if (type === 'CONTENT_REPORT') return <ShieldAlert className="w-5 h-5 text-red-600" />;
    if (type === 'ACCOUNT_ACTION') return <UserX className="w-5 h-5 text-purple-600" />;
    return <Bell className="w-5 h-5 text-blue-600" />;
  };

  const getNotificationColor = (type: string) => {
    if (isApprovalNotification(type)) return 'bg-blue-50 border-blue-200';
    if (type === 'STORAGE_LIMIT_REACHED') return 'bg-red-50 border-red-200';
    if (type === 'STORAGE_ALERT') return 'bg-orange-50 border-orange-200';
    if (type === 'CONTENT_REPORT') return 'bg-red-50 border-red-200';
    if (type === 'ACCOUNT_ACTION') return 'bg-purple-50 border-purple-200';
    return 'bg-blue-50 border-blue-200';
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Notifications</h1>
          <p className="text-gray-600 mt-1">Monitor system alerts, reported content, account actions, and AI triage guidance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{notifications.length}</div>
            <div className="text-sm text-gray-600">Total Notifications</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{unreadCount}</div>
            <div className="text-sm text-gray-600">Unread</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{approvalAlerts}</div>
            <div className="text-sm text-gray-600">Need Approval</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{storageAlerts}</div>
            <div className="text-sm text-gray-600">Storage Alerts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{safetyAlerts}</div>
            <div className="text-sm text-gray-600">Safety Alerts</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-700">
                <Sparkles className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                  AI Support Inbox Triage
                </p>
              </div>
              <p className="mt-2 text-sm text-blue-900">
                This assistant reviews the current internal admin notification feed and groups what needs urgent follow-up, what can wait for the next pass, and what can be batched later.
              </p>
              <p className="mt-2 text-xs text-blue-800">
                Recommendation only. This is based on internal Reliance notifications, not an external email inbox.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="bg-white"
                onClick={() => void refreshSupportTriageOnly()}
                disabled={triageLoading}
              >
                Refresh AI State
              </Button>
              <Button
                type="button"
                onClick={() => void runSupportTriage()}
                disabled={triageLoading || !supportTriage?.aiEnabled}
              >
                {!supportTriage?.aiEnabled
                  ? 'AI Triage Disabled'
                  : triageLoading
                    ? 'Running AI triage...'
                    : latestSuggestion
                      ? 'Refresh AI Triage'
                      : 'Run AI Triage'}
              </Button>
              <Button asChild type="button" variant="outline" className="bg-white">
                <Link href="/admin/ai-review-queue">Open AI Review Queue</Link>
              </Button>
            </div>
          </div>

          {!supportTriage?.aiEnabled ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              AI support inbox triage is currently disabled for this environment. Admin approval emails and dashboard alerts still work.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-blue-100 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unread now</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {supportTriage?.counts.unreadCount ?? unreadCount}
              </div>
            </div>
            <div className="rounded-lg border border-blue-100 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current slice</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {supportTriage?.counts.totalCount ?? notifications.length}
              </div>
            </div>
            <div className="rounded-lg border border-blue-100 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Red flags in latest AI pass</div>
              <div className="mt-2 text-2xl font-bold text-red-700">
                {latestSuggestion?.redFlags.length ?? 0}
              </div>
            </div>
          </div>

          {triageMessage ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {triageMessage}
            </div>
          ) : null}

          {triageError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {triageError}
            </div>
          ) : null}

          {latestSuggestion ? (
            <div className="rounded-lg border border-blue-100 bg-white p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{prettyConfidence(latestSuggestion.confidence)}</Badge>
                {supportTriage?.latestRecommendation?.generatedAt ? (
                  <Badge variant="outline">
                    Updated {new Date(supportTriage.latestRecommendation.generatedAt).toLocaleString()}
                  </Badge>
                ) : null}
              </div>

              <p className="text-sm text-slate-800">{latestSuggestion.summary}</p>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Urgent</div>
                  <ul className="mt-2 space-y-1 text-sm text-red-800">
                    {latestSuggestion.urgentItems.length > 0 ? (
                      latestSuggestion.urgentItems.slice(0, 4).map((item) => <li key={item}>- {item}</li>)
                    ) : (
                      <li>No urgent items identified.</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Soon</div>
                  <ul className="mt-2 space-y-1 text-sm text-amber-800">
                    {latestSuggestion.soonItems.length > 0 ? (
                      latestSuggestion.soonItems.slice(0, 4).map((item) => <li key={item}>- {item}</li>)
                    ) : (
                      <li>No same-pass follow-up items identified.</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">Batch later</div>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {latestSuggestion.batchLaterItems.length > 0 ? (
                      latestSuggestion.batchLaterItems.slice(0, 4).map((item) => <li key={item}>- {item}</li>)
                    ) : (
                      <li>No batch-later items identified.</li>
                    )}
                  </ul>
                </div>
              </div>

              {latestSuggestion.redFlags.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
                    Current AI red flags
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-red-800">
                    {latestSuggestion.redFlags.slice(0, 5).map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {latestSuggestion.recommendedActions.length > 0 ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Recommended next actions
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-blue-900">
                    {latestSuggestion.recommendedActions.slice(0, 5).map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-blue-200 bg-white px-4 py-5 text-sm text-slate-600">
              Run AI triage to generate the first grouped summary for current internal notifications.
            </div>
          )}
        </CardContent>
      </Card>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex gap-2 mb-4">
        <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')} size="sm">
          All
        </Button>
        <Button variant={filter === 'unread' ? 'default' : 'outline'} onClick={() => setFilter('unread')} size="sm">
          Unread ({unreadCount})
        </Button>
        <Button variant={filter === 'approvals' ? 'default' : 'outline'} onClick={() => setFilter('approvals')} size="sm">
          Approvals ({approvalAlerts})
        </Button>
        <Button variant={filter === 'storage' ? 'default' : 'outline'} onClick={() => setFilter('storage')} size="sm">
          Storage Alerts
        </Button>
        <Button variant={filter === 'safety' ? 'default' : 'outline'} onClick={() => setFilter('safety')} size="sm">
          Safety ({safetyAlerts})
        </Button>
        <Button variant={filter === 'reports' ? 'default' : 'outline'} onClick={() => setFilter('reports')} size="sm">
          Reports ({contentReportAlerts})
        </Button>
        <Button variant={filter === 'accounts' ? 'default' : 'outline'} onClick={() => setFilter('accounts')} size="sm">
          Account Actions ({accountActionAlerts})
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading notification activity...</p>
          </CardContent>
        </Card>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No notifications match the current filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredNotifications.map((notification) => {
            const metadata = parseMetadata(notification.metadata);
            return (
              <Card
                key={notification.id}
                className={`${getNotificationColor(notification.type)} ${!notification.read ? 'border-2' : ''}`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getNotificationIcon(notification.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                          {!notification.read && (
                            <Badge className="bg-blue-600 text-white text-xs">New</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {notification.type}
                          </Badge>
                        </div>
                        <p className="text-gray-700 mb-2">{notification.message}</p>
                        {notification.vendor && (
                          <p className="text-sm text-gray-600 mb-2">
                            Vendor: <strong>{notification.vendor.businessName || notification.vendor.name}</strong>
                          </p>
                        )}
                        {metadata && (
                          <div className="text-xs text-gray-500 bg-white p-2 rounded mt-2">
                            {notification.type === 'CONTENT_REPORT' && (
                              <div className="space-y-1">
                                {metadata.reportId && <div>Report ID: {metadata.reportId}</div>}
                                {metadata.targetType && <div>Target: {metadata.targetType} {metadata.targetId}</div>}
                                {metadata.reasonCategory && <div>Reason: {metadata.reasonCategory}</div>}
                                {metadata.severity && <div>Severity: {metadata.severity}</div>}
                                <Link
                                  href="/admin/reported-content"
                                  className="inline-flex text-[#204080] font-medium hover:underline"
                                >
                                  Open reported content queue
                                </Link>
                              </div>
                            )}
                            {notification.type === 'ACCOUNT_ACTION' && (
                              <div className="space-y-1">
                                {metadata.targetType && <div>Account: {metadata.targetType} {metadata.targetId}</div>}
                                {metadata.status && <div>Status: {metadata.status}</div>}
                                {metadata.reasonCategory && <div>Reason: {metadata.reasonCategory}</div>}
                                <Link
                                  href="/admin/accounts?tab=restricted"
                                  className="inline-flex text-[#204080] font-medium hover:underline"
                                >
                                  Open account controls
                                </Link>
                              </div>
                            )}
                            {notification.type === 'VENDOR_APPROVAL_REQUIRED' && (
                              <div className="space-y-1">
                                {metadata.businessName && <div>Vendor: {metadata.businessName}</div>}
                                {metadata.category && <div>Category: {metadata.category}</div>}
                                <Link
                                  href="/admin/vendors/approval-queue"
                                  className="inline-flex text-[#204080] font-medium hover:underline"
                                >
                                  Open vendor approval queue
                                </Link>
                              </div>
                            )}
                            {notification.type === 'MEDIA_MODERATION_REQUIRED' && (
                              <div className="space-y-1">
                                {metadata.bookingId && <div>Booking ID: {metadata.bookingId}</div>}
                                {metadata.moderationQueuedAssets && (
                                  <div>Queued assets: {metadata.moderationQueuedAssets}</div>
                                )}
                                <Link
                                  href="/admin/media-moderation"
                                  className="inline-flex text-[#204080] font-medium hover:underline"
                                >
                                  Open media moderation
                                </Link>
                              </div>
                            )}
                            {notification.type === 'REVIEW_MODERATION_REQUIRED' && (
                              <div className="space-y-1">
                                {metadata.reviewId && <div>Review ID: {metadata.reviewId}</div>}
                                {metadata.rating && <div>Rating: {metadata.rating} stars</div>}
                                <Link
                                  href="/admin/reviews"
                                  className="inline-flex text-[#204080] font-medium hover:underline"
                                >
                                  Open review moderation
                                </Link>
                              </div>
                            )}
                            {notification.type === 'PROMOTION_REQUEST' && (
                              <div className="space-y-1">
                                {metadata.packageName && <div>Package: {metadata.packageName}</div>}
                                {metadata.promotionCampaignId && (
                                  <div>Campaign ID: {metadata.promotionCampaignId}</div>
                                )}
                                <Link
                                  href="/admin/promoted-listings"
                                  className="inline-flex text-[#204080] font-medium hover:underline"
                                >
                  Open featured proof
                                </Link>
                              </div>
                            )}
                            {metadata.threshold && <div>Threshold: {metadata.threshold}%</div>}
                            {metadata.percentUsed && (
                              <div>Usage: {parseFloat(metadata.percentUsed).toFixed(1)}%</div>
                            )}
                            {metadata.usedBytes && (
                              <div>Used: {(parseFloat(metadata.usedBytes) / (1024 * 1024)).toFixed(2)} MB</div>
                            )}
                            {metadata.limitBytes && (
                              <div>Limit: {(parseFloat(metadata.limitBytes) / (1024 * 1024)).toFixed(2)} MB</div>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {!notification.read && (
                      <Button variant="outline" size="sm" onClick={() => void markAsRead(notification.id)}>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Mark Read
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
