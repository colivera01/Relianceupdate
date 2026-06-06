import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ContactSupportPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl border-amber-200 bg-amber-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-3 text-amber-700">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Support tickets are not available on this launch</CardTitle>
              <p className="mt-1 text-sm text-amber-800">
                Use the published support inbox instead of the old in-app form.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700">
          <p>
            Reliance does not process vendor support tickets inside the app yet.
            Use the active dashboard, jobs, media, storage, and profile tools,
            and reach out through the published support channel when assistance
            is needed.
          </p>
          <Button asChild>
            <Link href="/vendor/support">Back to Support</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
