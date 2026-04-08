// src/app/admin/notifications/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

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
  const [filter, setFilter] = useState<'all' | 'unread' | 'storage'>('all');

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/notifications', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      setNotifications(json.notifications || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/notifications/${id}/read`, {
        method: 'POST',
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
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const storageAlerts = notifications.filter((n) => n.type.startsWith('STORAGE') && !n.read).length;

  const getNotificationIcon = (type: string) => {
    if (type === 'STORAGE_LIMIT_REACHED') return <XCircle className="w-5 h-5 text-red-600" />;
    if (type === 'STORAGE_ALERT') return <AlertTriangle className="w-5 h-5 text-orange-600" />;
    return <Bell className="w-5 h-5 text-blue-600" />;
  };

  const getNotificationColor = (type: string) => {
    if (type === 'STORAGE_LIMIT_REACHED') return 'bg-red-50 border-red-200';
    if (type === 'STORAGE_ALERT') return 'bg-orange-50 border-orange-200';
    return 'bg-blue-50 border-blue-200';
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Notifications</h1>
          <p className="text-gray-600 mt-1">Monitor system alerts and vendor activity</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
      </div>

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
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading notifications...</p>
          </CardContent>
        </Card>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No notifications found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredNotifications.map((notification) => {
            const metadata = notification.metadata ? JSON.parse(notification.metadata) : null;
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

