import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SupportChatPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl border-amber-200 bg-amber-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-3 text-amber-700">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Live Chat Is Not Available in This Launch</CardTitle>
              <p className="mt-1 text-sm text-amber-800">
                The previous chat was simulated and did not connect to support staff.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700">
          <p>
            Reliance support for this launch is handled through published support guidance and the
            active launch contact path for your environment, not an in-app live chat queue.
          </p>
          <Button asChild>
            <Link href="/vendor/support">Back to Support</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
