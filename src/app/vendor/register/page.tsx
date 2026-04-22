// BACKEND DEVELOPER NOTES:
// - On submit, if businessType is 'Other', add to pending business/service requests for admin approval
// - Otherwise, proceed with normal registration
// - Integrate with service catalog for business type options

'use client';
import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const serviceCatalog = [
  'Automotive Repair',
  'Automotive Detailing',
  'Adjuster',
  'Barber',
  'Body Shop',
  'Car Wash',
  'Contractors',
  'Dealership',
  'Electrician',
  'Electronic Device Repair',
  'HVAC Heating and Air Conditioning',
  'Home cleaners',
  'Hair/Nail Salon',
  'Landscaping',
  'Locksmith',
  'Medical Services',
  'Moving Services',
  'Pool Cleaning Services',
  'Pet Grooming',
  'Plumbing',
  'Painting Services',
  'Pest/Exterminating Services',
  'Security Installation',
  'Roofing Services',
  'Towing',
  'Tree Services',
  'Other',
];

export default function VendorRegisterPage() {
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [customBusinessType, setCustomBusinessType] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !businessType.trim()) return;
    if (businessType === 'Other' && !customBusinessType.trim()) return;

    setError('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/vendor/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessType: businessType.trim(),
          customBusinessType: customBusinessType.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || 'Failed to register vendor account'));
      }

      setPendingRequest(Boolean(payload?.requiresApproval ?? true));
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register vendor account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Register as a Vendor</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {submitted ? (
            pendingRequest ? (
              <div className="text-center text-yellow-700 font-medium">
                Your registration is pending approval. You will be notified once your business is approved.
              </div>
            ) : (
              <div className="text-center text-green-700 font-medium">
                Registration successful! Welcome to Reliance.
              </div>
            )
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium mb-1">Business Name</label>
                <Input
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Business Type</label>
                <select
                  className="border rounded px-3 py-2 w-full"
                  value={businessType}
                  onChange={e => setBusinessType(e.target.value)}
                  required
                >
                  <option value="">Select a business type</option>
                  {serviceCatalog.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              {businessType === 'Other' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Custom Business Type</label>
                  <Input
                    value={customBusinessType}
                    onChange={e => setCustomBusinessType(e.target.value)}
                    placeholder="Enter your business type"
                    required
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Register'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 