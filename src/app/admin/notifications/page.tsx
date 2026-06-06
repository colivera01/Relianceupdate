// src/app/admin/notifications/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, CheckCircle, XCircle, RefreshCw, ShieldAlert, UserX } from 'lucide-react';
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

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'storage' | 'safety' | 'reports' | 'accounts'>('all');

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/notifications', {
        headers: getAdminRequestHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      setNotifications(json.notifications || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/notifications/${id}/read`, {
        method: 'POST',
        headers: getAdminRequestHeaders(),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      await fetchNotifications();
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
      await fetchNotifications();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'storage') return n.type.startsWith('STORAGE');
    if (filter === 'safety') return n.type === 'ACCOUNT_ACTION' || n.type === 'CONTENT_REPORT';
    if (filter === 'reports') return n.type === 'CONTENT_REPORT';
    if (filter === 'accounts') return n.type === 'ACCOUNT_ACTION';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const storageAlerts = notifications.filter((n) => n.type.startsWith('STORAGE') && !n.read).length;
  const safetyAlerts = notifications.filter(
    (n) => !n.read && (n.type === 'ACCOUNT_ACTION' || n.type === 'CONTENT_REPORT')
  ).length;
  const contentReportAlerts = notifications.filter((n) => n.type === 'CONTENT_REPORT' && !n.read).length;
  const accountActionAlerts = notifications.filter((n) => n.type === 'ACCOUNT_ACTION' && !n.read).length;

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
    if (type === 'STORAGE_LIMIT_REACHED') return <XCircle className="w-5 h-5 text-red-600" />;
    if (type === 'STORAGE_ALERT') return <AlertTriangle className="w-5 h-5 text-orange-600" />;
    if (type === 'CONTENT_REPORT') return <ShieldAlert className="w-5 h-5 text-red-600" />;
    if (type === 'ACCOUNT_ACTION') return <UserX className="w-5 h-5 text-purple-600" />;
    return <Bell className="w-5 h-5 text-blue-600" />;
  };

  const getNotificationColor = (type: string) => {
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
          <p className="text-gray-600 mt-1">Monitor system alerts, reported content, and account actions</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchNotifications}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={markAllAsRead}
            >
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

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex gap-2 mb-4">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
          size="sm"
        >
          All
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'outline'}
          onClick={() => setFilter('unread')}
          size="sm"
        >
          Unread ({unreadCount})
        </Button>
        <Button
          variant={filter === 'storage' ? 'default' : 'outline'}
          onClick={() => setFilter('storage')}
          size="sm"
        >
          Storage Alerts
        </Button>
        <Button
          variant={filter === 'safety' ? 'default' : 'outline'}
          onClick={() => setFilter('safety')}
          size="sm"
        >
          Safety ({safetyAlerts})
        </Button>
        <Button
          variant={filter === 'reports' ? 'default' : 'outline'}
          onClick={() => setFilter('reports')}
          size="sm"
        >
          Reports ({contentReportAlerts})
        </Button>
        <Button
          variant={filter === 'accounts' ? 'default' : 'outline'}
          onClick={() => setFilter('accounts')}
          size="sm"
        >
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
                                  href="/admin/vendors"
                                  className="inline-flex text-[#204080] font-medium hover:underline"
                                >
                                  Open account controls
                                </Link>
                              </div>
                            )}
                            {metadata.threshold && (
                              <div>Threshold: {metadata.threshold}%</div>
                            )}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                      >
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

