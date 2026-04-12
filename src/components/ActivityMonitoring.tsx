'use client';

import Link from 'next/link';

/**
 * Route-safe placeholder for admin activity monitoring.
 * Replace with full ActivityMonitoring when product spec is ready.
 */
export function ActivityMonitoring() {
  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Activity Monitoring</h1>
      <p className="text-sm text-gray-600">
        This surface is not fully implemented yet. Use audit logs for persisted admin actions.
      </p>
      <Link href="/admin/audit-logs" className="inline-block text-sm font-medium text-blue-600 underline">
        Open Audit Logs
      </Link>
    </div>
  );
}
