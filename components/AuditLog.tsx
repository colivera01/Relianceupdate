"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <Button onClick={exportLogs}>Export to CSV</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Input
          placeholder="Search logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="border rounded p-2"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          <option value="all">All Severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <select
          className="border rounded p-2"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          <option value="user">User</option>
          <option value="content">Content</option>
          <option value="security">Security</option>
          <option value="system">System</option>
        </select>
        <select
          className="border rounded p-2"
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
        >
          <option value="all">All Time</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
        <select
          className="border rounded p-2"
          value={adminFilter}
          onChange={(e) => setAdminFilter(e.target.value)}
        >
          <option value="all">All Admins</option>
          {Array.from(new Set(logs.map(log => log.adminId))).map(adminId => (
            <option key={adminId} value={adminId}>
              {logs.find(log => log.adminId === adminId)?.adminName}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <div key={log.id} className="border-b pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getSeverityColor(log.severity)}>
                      {log.severity.toUpperCase()}
                    </Badge>
                    <Badge className={getCategoryColor(log.category)}>
                      {log.category}
                    </Badge>
                    <span className="font-medium">{log.action.replace('_', ' ')}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {log.timestamp.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm mb-2">{log.details}</p>
                <div className="text-xs text-gray-400 flex justify-between">
                  <span>By {log.adminName} • IP: {log.ipAddress}</span>
                  <span>Target: {log.targetType} {log.targetId}</span>
                </div>
                {log.changes && (
                  <div className="mt-2 text-xs">
                    <p className="font-medium text-gray-600">Changes:</p>
                    {log.changes.map((change, i) => (
                      <div key={i} className="ml-4 text-gray-500">
                        {change.field}: {change.oldValue} → {change.newValue}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 