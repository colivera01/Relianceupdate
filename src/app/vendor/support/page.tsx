import SupportTicketsPage from '../../../../components/SupportTicketsPage';
import { Button } from '../../../components/ui/button';
import Link from 'next/link';

export default function VendorSupportPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Vendor Support & Help</h1>
          <p className="mb-2 text-gray-600">Submit support tickets, track their status, and get help for your vendor account and services.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/vendor/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <p className="text-blue-900 font-medium">Need help fast? Check our <Link href="/knowledge-base" className="underline text-blue-700 hover:text-blue-900">Knowledge Base</Link> for instant answers, or submit a ticket below for personalized support.</p>
      </div>
      <SupportTicketsPage />
    </div>
  );
} 