import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MessagesPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-10">
      <Card className="max-w-2xl border-blue-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-3 text-blue-700">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>In-app messaging is not available on this launch</CardTitle>
              <p className="mt-1 text-sm text-gray-600">
                Customer conversations are not routed through a live Reliance inbox yet.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700">
          <p>
            Reliance currently focuses on service records, public service videos,
            customer reviews, Trust Score context, and vendor job operations. Messaging will return once the
            customer conversation tools have full backend support.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/my-bookings">View My Service Records</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/profile-settings">Profile Settings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
