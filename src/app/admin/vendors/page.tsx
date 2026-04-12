'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VendorsPage() {
  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Vendor Management</h1>
        <p className="text-gray-600 mt-1">
          Stable entry point for vendor governance actions while legacy vendor management UI is unavailable.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Management Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/admin/publish-management">
            <Button>Publish Management</Button>
          </Link>
          <Link href="/admin/vendors/approval-queue">
            <Button variant="outline">Approval Queue</Button>
          </Link>
          <Link href="/admin/audit-logs">
            <Button variant="outline">Audit Logs</Button>
          </Link>
          <Link href="/admin/dashboard">
            <Button variant="outline">Admin Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}