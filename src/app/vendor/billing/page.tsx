// BACKEND DEVELOPER NOTES:
// - POST /api/vendor/payments/enable: Enable Reliance Payments for the vendor (requires authentication)
// - POST /api/vendor/payments/disable: Disable Reliance Payments for the vendor
// - GET /api/vendor/payments/history: Get payment history for the vendor (list of payouts, status, amount, date)
// - POST /api/vendor/payments/request-payout: Request a payout (amount, bank info, etc.)
// - GET /api/vendor/payments/status: Get current Reliance Payments status (enabled/disabled)
// - All endpoints should be authenticated and scoped to the current vendor
// - Learn More modal content can be managed statically or fetched from a CMS if needed
// - This file currently uses local state and mock data for demonstration purposes
//
// See also: profile page for payments opt-in toggle

'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

export default function VendorBillingPage() {
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [showPayout, setShowPayout] = useState(false);
  const [showLearnMore, setShowLearnMore] = useState(false);
  // Mock payment history
  const paymentHistory = [
    { id: 'P-1001', amount: 250, date: '2024-06-01', status: 'Paid' },
    { id: 'P-1002', amount: 120, date: '2024-05-15', status: 'Paid' },
    { id: 'P-1003', amount: 80, date: '2024-05-01', status: 'Pending' },
  ];
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-4">Billing & Earnings</h1>
      {!paymentsEnabled ? (
        <div className="bg-blue-50 border border-blue-200 rounded p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">Enable Reliance Payments</h2>
          <p className="mb-4 text-gray-700">Bill your customers and receive payouts directly through Reliance. Enable this feature to track your earnings and request payouts from one place.</p>
          <Button onClick={() => setPaymentsEnabled(true)} variant="default">Enable Reliance Payments</Button>
          <button onClick={() => setShowLearnMore(true)} className="ml-4 text-blue-700 underline hover:text-blue-900 text-sm bg-transparent border-none p-0" type="button">Learn More</button>
        </div>
      ) : (
        <>
          <div className="bg-green-50 border border-green-200 rounded p-6 mb-6">
            <h2 className="text-lg font-semibold mb-2">Reliance Payments Enabled</h2>
            <p className="mb-2 text-gray-700">You can now bill customers and receive payouts through Reliance. Below is your payment history and payout status.</p>
            <Button onClick={() => setShowPayout(true)} variant="default">Request Payout</Button>
          </div>
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Payment History</h3>
            <table className="w-full text-sm border rounded">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Payment ID</th>
                  <th className="p-2 text-left">Amount</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2">{p.id}</td>
                    <td className="p-2">${p.amount}</td>
                    <td className="p-2">{p.date}</td>
                    <td className="p-2">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showPayout && (
            <div className="bg-white border border-gray-200 rounded p-4 mb-4">
              <h4 className="font-semibold mb-2">Request Payout</h4>
              <p className="mb-2 text-gray-700">This is a placeholder for the payout request flow. Backend integration will be added later.</p>
              <Button onClick={() => setShowPayout(false)} variant="ghost">Close</Button>
            </div>
          )}
        </>
      )}
      {/* Learn More Modal */}
      <Dialog open={showLearnMore} onOpenChange={setShowLearnMore}>
        <DialogContent className="max-w-lg w-full sm:max-w-xl p-2 sm:p-6">
          <DialogHeader>
            <DialogTitle>About Reliance Payments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold mb-1">Why Use Reliance Payments?</h2>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                <li>Bill your customers and receive payouts directly through the platform.</li>
                <li>Track all your earnings and payouts in one place.</li>
                <li>Offer your customers a secure, trusted payment experience.</li>
                <li>Save time with automated payment tracking and reporting.</li>
              </ul>
            </div>
            <div>
              <h2 className="font-semibold mb-1">Fees & Payouts</h2>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                <li>Standard transaction fee: 2.9% + $0.30 per payment (subject to change).</li>
                <li>Payouts are processed within 1-2 business days.</li>
                <li>No monthly or hidden fees.</li>
              </ul>
            </div>
            <div>
              <h2 className="font-semibold mb-1">Security & Support</h2>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                <li>All payments are processed securely via Stripe (PCI-compliant).</li>
                <li>Dispute resolution and support available for all transactions.</li>
                <li>Your data and your customers’ data are protected at all times.</li>
              </ul>
            </div>
            <div>
              <h2 className="font-semibold mb-1">How It Works</h2>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                <li>Enable Reliance Payments in your settings or here on the Billing page.</li>
                <li>Connect your bank account (coming soon).</li>
                <li>Start billing customers and track your earnings in real time.</li>
                <li>Request payouts whenever you’re ready.</li>
              </ul>
            </div>
            <div className="text-xs text-gray-500">Have more questions? Contact support for more details.</div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 