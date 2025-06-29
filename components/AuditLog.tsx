"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from '@/components/ui/dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, PieChart, Pie, Cell, Legend } from 'recharts';

interface AuditLogEntry {
  id: string;
  action: string;
  adminId: string;
  adminName: string;
  targetId?: string;
  targetType: string;
  details: string;
  timestamp: Date;
  ipAddress: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'user' | 'content' | 'security' | 'system';
  changes?: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
}

// Mock data generator
const generateMockAuditLogs = (): AuditLogEntry[] => {
  return Array.from({ length: 20 }, (_, i) => ({
    id: `log-${i}`,
    action: [
      'user_update',
      'content_delete',
      'permission_change',
      'security_alert',
      'system_config'
    ][i % 5],
    adminId: `admin-${i % 3}`,
    adminName: `Admin ${i % 3}`,
    targetId: `target-${i}`,
    targetType: ['user', 'content', 'role', 'system'][i % 4],
    details: `Detailed description of action ${i}`,
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    severity: ['low', 'medium', 'high', 'critical'][i % 4] as 'low' | 'medium' | 'high' | 'critical',
    category: ['user', 'content', 'security', 'system'][i % 4] as 'user' | 'content' | 'security' | 'system',
    changes: i % 2 === 0 ? [
      {
        field: 'status',
        oldValue: 'active',
        newValue: 'suspended'
      },
      {
        field: 'role',
        oldValue: 'user',
        newValue: 'admin'
      }
    ] : undefined
  }));
};

export function AuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>(generateMockAuditLogs());
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("all");
  const [adminFilter, setAdminFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [live, setLive] = useState(true);

  // Real-time auto-refresh (mock)
  useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => {
      // TODO: Replace with backend fetch for real-time logs
      setLogs(generateMockAuditLogs());
    }, 5000);
    return () => clearInterval(interval);
  }, [live]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'security':
        return 'bg-red-100 text-red-800';
      case 'user':
        return 'bg-blue-100 text-blue-800';
      case 'content':
        return 'bg-purple-100 text-purple-800';
      case 'system':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.adminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === "all" || log.severity === severityFilter;
    const matchesCategory = categoryFilter === "all" || log.category === categoryFilter;
    const matchesAdmin = adminFilter === "all" || log.adminId === adminFilter;

    let matchesTime = true;
    const now = new Date();
    if (timeRange === "24h") {
      matchesTime = now.getTime() - log.timestamp.getTime() <= 24 * 60 * 60 * 1000;
    } else if (timeRange === "7d") {
      matchesTime = now.getTime() - log.timestamp.getTime() <= 7 * 24 * 60 * 60 * 1000;
    } else if (timeRange === "30d") {
      matchesTime = now.getTime() - log.timestamp.getTime() <= 30 * 24 * 60 * 60 * 1000;
    }

    return matchesSearch && matchesSeverity && matchesCategory && matchesTime && matchesAdmin;
  });

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

  // Analytics data
  const actionCounts = Object.entries(
    filteredLogs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([action, count]) => ({ action, count }));

  const severityCounts = ['low', 'medium', 'high', 'critical'].map(sev => ({
    severity: sev,
    count: filteredLogs.filter(l => l.severity === sev).length
  }));

  const adminCounts = Array.from(new Set(filteredLogs.map(l => l.adminName))).map(admin => ({
    admin,
    count: filteredLogs.filter(l => l.adminName === admin).length
  }));

  const exportLogs = () => {
    const csv = [
      ['ID', 'Action', 'Admin', 'Target Type', 'Target ID', 'Details', 'Timestamp', 'IP Address', 'Severity', 'Category'].join(','),
      ...filteredLogs.map(log => [
        log.id,
        log.action,
        log.adminName,
        log.targetType,
        log.targetId || '',
        `"${log.details}"`,
        log.timestamp.toISOString(),
        log.ipAddress,
        log.severity,
        log.category
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // PDF Export (mock)
  const exportPDF = () => {
    alert('PDF export is a backend task. See backend notes.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">Audit Log {live && <span className="ml-2 text-green-600 animate-pulse">● Live</span>}</h2>
        <div className="flex gap-2">
          <Button onClick={exportLogs}>Export CSV</Button>
          <Button onClick={exportPDF} variant="outline">Export PDF</Button>
          <Button onClick={() => setLive(l => !l)} variant={live ? 'destructive' : 'default'}>{live ? 'Pause Live' : 'Resume Live'}</Button>
        </div>
      </div>
      {/* Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card><CardHeader><CardTitle>Actions</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><BarChart data={actionCounts}><XAxis dataKey="action" /><YAxis allowDecimals={false} /><Bar dataKey="count" fill="#3B82F6" /><ChartTooltip /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>Severity</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={severityCounts} dataKey="count" nameKey="severity" cx="50%" cy="50%" outerRadius={60} label>{severityCounts.map((entry, idx) => <Cell key={entry.severity} fill={["#22c55e","#eab308","#f97316","#ef4444"][idx]} />)}</Pie></PieChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>By Admin</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><BarChart data={adminCounts}><XAxis dataKey="admin" /><YAxis allowDecimals={false} /><Bar dataKey="count" fill="#6366f1" /><ChartTooltip /></BarChart></ResponsiveContainer></CardContent></Card>
      </div>
      {/* Filters/Search */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Input placeholder="Search logs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <select className="border rounded p-2" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}><option value="all">All Severities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
        <select className="border rounded p-2" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">All Categories</option><option value="user">User</option><option value="content">Content</option><option value="security">Security</option><option value="system">System</option></select>
        <select className="border rounded p-2" value={timeRange} onChange={e => setTimeRange(e.target.value)}><option value="all">All Time</option><option value="24h">Last 24 Hours</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option></select>
        <select className="border rounded p-2" value={adminFilter} onChange={e => setAdminFilter(e.target.value)}><option value="all">All Admins</option>{Array.from(new Set(logs.map(log => log.adminId))).map(adminId => (<option key={adminId} value={adminId}>{logs.find(log => log.adminId === adminId)?.adminName}</option>))}</select>
        <Input placeholder="Target ID" value={/* add state for target filter */''} onChange={() => {}} />
      </div>
      {/* Pagination */}
      <div className="flex justify-between items-center my-2">
        <span className="text-sm">Page {page} of {totalPages} ({filteredLogs.length} logs)</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
        </div>
      </div>
      {/* Log List */}
      <Card><CardContent className="pt-6"><div className="space-y-4">
        {paginatedLogs.map((log) => (
          <div key={log.id} className={`border-b pb-4 cursor-pointer hover:bg-gray-50 rounded transition ${log.severity === 'critical' ? 'border-red-400 bg-red-50' : ''}`} onClick={() => setSelectedLog(log)}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Tooltip content={log.severity.charAt(0).toUpperCase() + log.severity.slice(1)}><Badge className={getSeverityColor(log.severity)}>{log.severity.toUpperCase()}</Badge></Tooltip>
                <Tooltip content={log.category.charAt(0).toUpperCase() + log.category.slice(1)}><Badge className={getCategoryColor(log.category)}>{log.category}</Badge></Tooltip>
                <span className="font-medium">{log.action.replace('_', ' ')}</span>
              </div>
              <span className="text-sm text-gray-500">{log.timestamp.toLocaleString()}</span>
            </div>
            <p className="text-sm mb-2">{log.details}</p>
            <div className="text-xs text-gray-400 flex justify-between">
              <span>By {log.adminName} • IP: {log.ipAddress}</span>
              <span>Target: {log.targetType} {log.targetId}</span>
            </div>
            {log.changes && (<div className="mt-2 text-xs"><p className="font-medium text-gray-600">Changes:</p>{log.changes.map((change, i) => (<div key={i} className="ml-4 text-gray-500">{change.field}: {change.oldValue} → {change.newValue}</div>))}</div>)}
          </div>
        ))}
      </div></CardContent></Card>
      {/* Drilldown Modal */}
      {selectedLog && <Modal open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}><Card><CardHeader><CardTitle>Log Details</CardTitle></CardHeader><CardContent><div className="space-y-2"><div><b>Action:</b> {selectedLog.action}</div><div><b>Admin:</b> {selectedLog.adminName} ({selectedLog.adminId})</div><div><b>Target:</b> {selectedLog.targetType} {selectedLog.targetId}</div><div><b>Details:</b> {selectedLog.details}</div><div><b>Timestamp:</b> {selectedLog.timestamp.toLocaleString()}</div><div><b>IP Address:</b> {selectedLog.ipAddress}</div><div><b>Severity:</b> {selectedLog.severity}</div><div><b>Category:</b> {selectedLog.category}</div>{selectedLog.changes && (<div><b>Changes:</b><ul className="ml-4 list-disc">{selectedLog.changes.map((c, i) => (<li key={i}>{c.field}: {c.oldValue} → {c.newValue}</li>))}</ul></div>)}</div></CardContent></Card></Modal>}
      {/* Retention/Compliance Info */}
      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">Audit logs are retained for 1 year and are immutable. Only authorized admins can view or export logs. All access is logged for compliance.</div>
      {/* Backend Developer Notes */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">📋 Backend Developer Notes</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>Endpoints Needed:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><code>GET /api/audit-logs</code> - Fetch audit logs (support filters: admin, action, severity, category, time range, target, search, pagination)</li>
            <li><code>GET /api/audit-logs/export</code> - Export filtered audit logs (CSV, PDF)</li>
            <li><code>GET /api/audit-logs/analytics</code> - Analytics for actions, severity, admin breakdown</li>
            <li><code>GET /api/audit-logs/stream</code> - Real-time updates (WebSocket/SSE)</li>
          </ul>
          <p className="mt-2"><strong>Filtering:</strong> Support advanced filtering and search for all fields.</p>
          <p><strong>Export:</strong> Support CSV/PDF export for filtered logs.</p>
          <p><strong>Analytics:</strong> Provide endpoints for action, severity, and admin breakdowns.</p>
          <p><strong>Real-Time:</strong> Use WebSocket or SSE for live updates.</p>
          <p><strong>Security:</strong> Log all admin actions and restrict access to authorized roles. Ensure audit logs are immutable and tamper-evident. Log all access to audit logs for compliance.</p>
          <p><strong>Retention:</strong> Retain logs for at least 1 year (configurable). Provide retention info in API and UI.</p>
        </div>
      </div>
    </div>
  );
} 