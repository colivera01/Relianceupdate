'use client';

import Link from 'next/link';
import { Tags } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PricingManagement() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl border-amber-200 bg-amber-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-3 text-amber-700">
              <Tags className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Pricing templates are not live on this launch</CardTitle>
              <p className="mt-1 text-sm text-amber-800">
                The previous pricing builder only stored temporary local changes and did not update real vendor pricing.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700">
          <p>
            Reliance already exposes the live vendor profile and services surfaces used in this launch. Those are
            the places to review your public service details while the retired template-based pricing editor stays
            offline.
          </p>
          <p>
            When structured pricing management is brought back, it will be connected to persisted vendor services
            instead of a local-only draft form.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/vendor/profile">Open Profile &amp; Settings</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/vendor/services">Open Services Offered</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
