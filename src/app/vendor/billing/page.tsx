import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function VendorBillingPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle>Billing and payouts are not enabled yet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700">
          <p>
            Reliance is not processing payments inside the platform yet. In-app billing,
            payout requests, platform fees, and payment history will be introduced in a
            later release once those tools are ready for vendors and customers.
          </p>
          <p>
            You can still maintain service prices on your profile so customers understand
            your usual rates, but Reliance is not charging, collecting, or distributing
            funds through this launch version.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild>
              <Link href="/vendor/dashboard">Back to Dashboard</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/vendor/profile">Edit Vendor Profile</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
