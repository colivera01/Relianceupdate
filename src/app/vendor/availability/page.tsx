'use client';

import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function VendorAvailabilityPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-3 text-amber-700">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Availability scheduling is not live on this launch</CardTitle>
              <p className="mt-1 text-sm text-amber-800">
                The old weekly scheduler only saved local demo state and did not control real booking availability.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700">
          <p>
            Reliance does not yet use an in-app vendor calendar to approve or block customer booking windows.
            For this launch, vendors should manage incoming jobs through the live dashboard, jobs, and employee
            assignment flows instead of relying on a fake saved schedule.
          </p>
          <p>
            When a real availability system is introduced, it will persist to the backend and affect live
            booking behavior. Until then, this page stays visible only as an honest launch note.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild>
              <Link href="/vendor/jobs">Open Manage Jobs</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/vendor/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
