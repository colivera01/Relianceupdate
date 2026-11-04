'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, ChevronRight, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { getClientSessionHeaders } from '@/lib/client-session';
import type { CustomerNotificationHistoryItem } from '@/lib/customer-notifications';

type Filter = 'all' | 'unread';

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function CustomerNotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<CustomerNotificationHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const headers = useCallback(
    () => ({ ...getClientSessionHeaders(user?.id), 'Content-Type': 'application/json' }),
    [user?.id],
  );

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/customer/notifications', {
        headers: headers(),
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body?.error || 'Notifications could not be loaded.'));
      setNotifications(Array.isArray(body?.notifications) ? body.notifications : []);
      setTotalCount(Number(body?.totalCount || 0));
      setUnreadCount(Number(body?.unreadCount || 0));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Notifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const visible = useMemo(
    () => filter === 'unread' ? notifications.filter((notification) => !notification.read) : notifications,
    [filter, notifications],
  );
  const shownUnreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const markRead = async (notification: CustomerNotificationHistoryItem, openAfter: boolean) => {
    if (notification.read) {
      if (openAfter) router.push(notification.href);
      return;
    }
    setPendingId(notification.id);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(
        `/api/customer/notifications/${encodeURIComponent(notification.id)}/read`,
        { method: 'POST', headers: headers(), credentials: 'same-origin' },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body?.error || 'The notification could not be updated.'));
      const readAt = typeof body?.readAt === 'string' ? body.readAt : null;
      setNotifications((items) => items.map((item) => item.id === notification.id
        ? { ...item, read: true, readAt }
        : item));
      setUnreadCount((count) => Math.max(0, count - 1));
      setStatusMessage('Notification marked read.');
      if (openAfter) router.push(notification.href);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'The notification could not be updated.');
      if (openAfter) router.push(notification.href);
    } finally {
      setPendingId(null);
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/customer/notifications', {
        method: 'POST',
        headers: headers(),
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'MARK_ALL_READ' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body?.error || 'Notifications could not be updated.'));
      const readAt = typeof body?.readAt === 'string' ? body.readAt : null;
      setNotifications((items) => items.map((item) => ({ ...item, read: true, readAt: item.readAt || readAt })));
      setUnreadCount(0);
      setStatusMessage('All notifications are marked read.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Notifications could not be updated.');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <section aria-labelledby="customer-notifications-title" className="space-y-6 text-white">
      <header className="rounded-[28px] border border-white/10 bg-white/6 px-5 py-6 shadow-[0_18px_60px_rgba(4,9,20,0.18)] backdrop-blur-xl sm:px-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200">Customer activity</p>
            <h1 id="customer-notifications-title" className="mt-2 text-3xl font-semibold">Notifications</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Review service-request responses, recording decisions, appointment reminders, and Service Video updates connected to your account.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-300/20 bg-blue-500/10 px-4 py-3 text-sm">
            <span className="font-semibold text-white">{unreadCount}</span>{' '}
            <span className="text-blue-100/80">unread</span>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2" role="group" aria-label="Notification filters">
          {(['all', 'unread'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                filter === value ? 'bg-blue-600 text-white' : 'border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
              }`}
            >
              {value === 'all' ? `Recent (${notifications.length})` : `Unread shown (${shownUnreadCount})`}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void loadNotifications()} disabled={loading}>
            <RefreshCw aria-hidden="true" className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button type="button" variant="outline" onClick={() => void markAllRead()} disabled={!unreadCount || markingAll}>
            <CheckCheck aria-hidden="true" className="mr-2 h-4 w-4" />
            {markingAll ? 'Marking...' : 'Mark all read'}
          </Button>
        </div>
      </div>

      <div aria-live="polite" className="sr-only">{statusMessage}</div>
      {error ? <div role="alert" className="rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
      {!loading && totalCount > notifications.length ? (
        <p className="rounded-2xl border border-blue-300/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          Showing the most recent {notifications.length} of {totalCount} notifications. The unread total above covers your full notification history.
        </p>
      ) : null}

      <div
        id="customer-notification-list"
        aria-label={`${filter} notifications`}
        aria-busy={loading}
        className="space-y-3"
      >
        {loading ? (
          <Card className="border-white/10 bg-white/5 text-white"><CardContent className="p-6" role="status">Loading notifications...</CardContent></Card>
        ) : visible.length ? (
          visible.map((notification) => (
            <article
              key={notification.id}
              className={`rounded-[24px] border p-5 transition-colors ${
                notification.read ? 'border-white/10 bg-white/5' : 'border-blue-300/30 bg-blue-500/10'
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${notification.read ? 'bg-white/8 text-slate-300' : 'bg-blue-500/20 text-blue-200'}`}>
                    <Bell aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-white">{notification.title}</h2>
                      {!notification.read ? <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">New</span> : null}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{notification.message}</p>
                    <p className="mt-2 text-xs text-slate-400">{formatNotificationDate(notification.createdAt)} · {notification.vendorName}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  {!notification.read ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Mark notification about ${notification.serviceName} as read`}
                      onClick={() => void markRead(notification, false)}
                      disabled={pendingId === notification.id}
                    >
                      {pendingId === notification.id ? 'Updating...' : 'Mark read'}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    aria-label={`Open Service Record for ${notification.serviceName}`}
                    onClick={() => void markRead(notification, true)}
                    disabled={pendingId === notification.id}
                  >
                    Open Service Record <ChevronRight aria-hidden="true" className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <Card className="border-white/10 bg-white/5 text-white">
            <CardContent className="p-8 text-center">
              <Bell aria-hidden="true" className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 text-lg font-semibold">
                {filter === 'unread'
                  ? unreadCount > 0
                    ? 'No unread notifications in recent activity'
                    : 'You are all caught up'
                  : 'No notifications yet'}
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                {filter === 'unread'
                  ? unreadCount > 0
                    ? 'Older unread updates are included in the total above. Mark all read when you have finished reviewing your account.'
                    : 'There are no unread service updates.'
                  : 'New service and Service Video updates will appear here.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
