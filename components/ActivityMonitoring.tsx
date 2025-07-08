"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { Download } from 'lucide-react';

interface UserActivity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  ipAddress: string;
  location: string;
  deviceInfo: string;
  timestamp: Date;
  status: 'normal' | 'suspicious' | 'blocked';
  details: string;
}

interface LoginAttempt {
  id: string;
  userId: string;
  userName: string;
  timestamp: Date;
  status: 'success' | 'failed';
  ipAddress: string;
  location: string;
  deviceInfo: string;
  failureReason?: string;
}

// Mock data generator
const generateMockData = () => {
  const activities: UserActivity[] = Array.from({ length: 10 }, (_, i) => ({
    id: `act-${i}`,
    userId: `user-${i}`,
    userName: `User ${i}`,
    action: ['login', 'file_upload', 'profile_update', 'password_change'][i % 4],
    ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    location: ['New York', 'London', 'Tokyo', 'Sydney'][i % 4],
    deviceInfo: ['Chrome/Windows', 'Safari/MacOS', 'Firefox/Linux'][i % 3],
    timestamp: new Date(Date.now() - Math.random() * 86400000),
    status: ['normal', 'suspicious', 'normal', 'blocked'][i % 4] as 'normal' | 'suspicious' | 'blocked',
    details: 'User performed standard operation',
  }));

  const loginAttempts: LoginAttempt[] = Array.from({ length: 5 }, (_, i) => ({
    id: `login-${i}`,
    userId: `user-${i}`,
    userName: `User ${i}`,
    timestamp: new Date(Date.now() - Math.random() * 86400000),
    status: i % 3 === 0 ? 'failed' : 'success',
    ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    location: ['New York', 'London', 'Tokyo', 'Sydney'][i % 4],
    deviceInfo: ['Chrome/Windows', 'Safari/MacOS', 'Firefox/Linux'][i % 3],
    failureReason: i % 3 === 0 ? 'Invalid credentials' : undefined,
  }));

  return { activities, loginAttempts };
};

export function ActivityMonitoring() {
  const { toast } = useToast();
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [filterUser, setFilterUser] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [displayMode, setDisplayMode] = useState<'scroll' | 'pagination'>('scroll');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    // Initial load
    const { activities, loginAttempts } = generateMockData();
    setActivities(activities);
    setLoginAttempts(loginAttempts);

    // Simulate real-time updates
    const interval = setInterval(() => {
      if (isMonitoring) {
        const newActivity: UserActivity = {
          id: `act-${Date.now()}`,
          userId: `user-${Math.floor(Math.random() * 10)}`,
          userName: `User ${Math.floor(Math.random() * 10)}`,
          action: ['login', 'file_upload', 'profile_update'][Math.floor(Math.random() * 3)],
          ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          location: ['New York', 'London', 'Tokyo'][Math.floor(Math.random() * 3)],
          deviceInfo: ['Chrome/Windows', 'Safari/MacOS', 'Firefox/Linux'][Math.floor(Math.random() * 3)],
          timestamp: new Date(),
          status: Math.random() > 0.8 ? 'suspicious' : 'normal',
          details: 'Real-time activity detected',
        };

        setActivities(prev => [newActivity, ...prev.slice(0, 9)]);

        // Show toast for suspicious activity
        if (newActivity.status === 'suspicious') {
          toast({
            title: "Suspicious Activity Detected",
            description: `User ${newActivity.userName} from ${newActivity.location}`,
            variant: "destructive",
          });
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isMonitoring, toast]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'suspicious':
        return <Badge variant="destructive">Suspicious</Badge>;
      case 'blocked':
        return <Badge variant="destructive">Blocked</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'success':
        return <Badge variant="default">Success</Badge>;
      default:
        return <Badge>Normal</Badge>;
    }
  };

  const handleBlock = async (userId: string) => {
    toast({
      title: "User Blocked",
      description: `User ${userId} has been blocked`,
      variant: "default",
    });
  };

  // Filtered and searched activities
  const filteredActivities = activities.filter(a =>
    (filterUser === 'all' || a.userName === filterUser) &&
    (filterAction === 'all' || a.action === filterAction) &&
    (filterStatus === 'all' || a.status === filterStatus) &&
    (!search || a.userName.toLowerCase().includes(search.toLowerCase()) || a.action.toLowerCase().includes(search.toLowerCase()) || a.details.toLowerCase().includes(search.toLowerCase()))
  );
  // Pagination logic
  const totalPages = Math.ceil(filteredActivities.length / ITEMS_PER_PAGE);
  const paginatedActivities = filteredActivities.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Export to CSV
  const handleExportCSV = () => {
    setExporting(true);
    const headers = ['User', 'Action', 'Status', 'IP', 'Location', 'Device', 'Timestamp', 'Details'];
    const rows = filteredActivities.map(a => [a.userName, a.action, a.status, a.ipAddress, a.location, a.deviceInfo, a.timestamp.toLocaleString(), a.details]);
    const csv = [headers, ...rows].map(r => r.map(x => `"${x}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'activity_log.csv';
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  // Unique values for filters
  const users = Array.from(new Set(activities.map(a => a.userName)));
  const actions = Array.from(new Set(activities.map(a => a.action)));
  const statuses = Array.from(new Set(activities.map(a => a.status)));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">Activity Monitoring <span className="ml-2 text-green-600 animate-pulse">● Live</span></h2>
        <Button 
          variant={isMonitoring ? "destructive" : "default"}
          onClick={() => setIsMonitoring(!isMonitoring)}
        >
          {isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
        </Button>
      </div>
      {/* Display Mode Toggle */}
      <div className="flex gap-4 items-center mb-2">
        <span className="text-sm font-medium">Display Mode:</span>
        <Button
          variant={displayMode === 'scroll' ? 'default' : 'outline'}
          onClick={() => { setDisplayMode('scroll'); setCurrentPage(1); }}
          size="sm"
        >
          Scrollable List
        </Button>
        <Button
          variant={displayMode === 'pagination' ? 'default' : 'outline'}
          onClick={() => { setDisplayMode('pagination'); setCurrentPage(1); }}
          size="sm"
        >
          Pagination
        </Button>
      </div>
      {/* Filters and Search */}
      <div className="flex flex-wrap gap-4 items-end mb-2">
        <div>
          <label className="block text-xs font-medium mb-1">User</label>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger>{filterUser === 'all' ? 'All' : filterUser}</SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {users.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Action</label>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger>{filterAction === 'all' ? 'All' : filterAction}</SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Status</label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>{filterStatus === 'all' ? 'All' : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}</SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {statuses.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Search</label>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user, action, details..." className="w-48" />
        </div>
        <Button onClick={handleExportCSV} disabled={exporting} variant="outline" className="flex items-center gap-2"><Download className="w-4 h-4" /> Export CSV</Button>
      </div>
      {/* Activity List */}
      {displayMode === 'scroll' ? (
        <div className="border rounded-lg max-h-[400px] overflow-y-auto">
          {filteredActivities.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No activities found.</div>
          ) : (
            filteredActivities.map(a => (
              <Card key={a.id} className="border-b last:border-b-0">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{a.userName}</CardTitle>
                    <div className="text-xs text-gray-500">{a.action} • {a.location} • {a.timestamp.toLocaleString()}</div>
                  </div>
                  {getStatusBadge(a.status)}
                </CardHeader>
                <CardContent className="text-sm flex flex-col gap-1">
                  <div><span className="font-medium">IP:</span> {a.ipAddress}</div>
                  <div><span className="font-medium">Device:</span> {a.deviceInfo}</div>
                  <div><span className="font-medium">Details:</span> {a.details}</div>
                  <Button size="xs" variant="outline" className="mt-2 w-fit" onClick={() => handleBlock(a.userId)}>Block User</Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div>
          {paginatedActivities.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No activities found.</div>
          ) : (
            paginatedActivities.map(a => (
              <Card key={a.id} className="border-b last:border-b-0">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{a.userName}</CardTitle>
                    <div className="text-xs text-gray-500">{a.action} • {a.location} • {a.timestamp.toLocaleString()}</div>
                  </div>
                  {getStatusBadge(a.status)}
                </CardHeader>
                <CardContent className="text-sm flex flex-col gap-1">
                  <div><span className="font-medium">IP:</span> {a.ipAddress}</div>
                  <div><span className="font-medium">Device:</span> {a.deviceInfo}</div>
                  <div><span className="font-medium">Details:</span> {a.details}</div>
                  <Button size="xs" variant="outline" className="mt-2 w-fit" onClick={() => handleBlock(a.userId)}>Block User</Button>
                </CardContent>
              </Card>
            ))
          )}
          {/* Pagination Controls */}
          <div className="flex justify-center items-center gap-4 mt-4">
            <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Previous</Button>
            <span className="text-sm">Page {currentPage} of {totalPages}</span>
            <Button size="sm" variant="outline" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next</Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Login Attempts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loginAttempts.map((attempt) => (
              <div key={attempt.id} className="border-b pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{attempt.userName}</span>
                    {getStatusBadge(attempt.status)}
                  </div>
                  <span className="text-sm text-gray-500">
                    {attempt.timestamp.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm mb-2">
                  {attempt.location} • {attempt.deviceInfo}
                </p>
                <div className="text-xs text-gray-400">
                  IP: {attempt.ipAddress}
                  {attempt.failureReason && (
                    <span className="text-red-500 ml-2">
                      Reason: {attempt.failureReason}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {/* Backend Developer Notes */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">📋 Backend Developer Notes</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>Endpoints Needed:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><code>GET /api/activity</code> - Fetch activity logs (support filters: user, action, status, search, date range, pagination)</li>
            <li><code>GET /api/activity/stream</code> - Real-time activity updates (WebSocket or SSE)</li>
            <li><code>GET /api/activity/export</code> - Export filtered activity logs (CSV, PDF)</li>
            <li><code>POST /api/activity/block-user</code> - Block user from activity feed</li>
          </ul>
          <p className="mt-2"><strong>Real-Time:</strong> Use WebSocket or Server-Sent Events for live updates.</p>
          <p><strong>Export:</strong> Support CSV/PDF export for filtered logs.</p>
          <p><strong>Security:</strong> Log all admin actions and restrict access to authorized roles.</p>
        </div>
      </div>
    </div>
  );
} 