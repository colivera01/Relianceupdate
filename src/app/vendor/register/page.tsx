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
  const [pendingRequest, setPendingRequest] = useState(false);
  // Mock: toggle this to control if registration is auto-approved
  const autoApprove = false; // Set to true for instant registration, false for pending approval

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (businessType === 'Other' && customBusinessType) {
      setPendingRequest(true);
      setSubmitted(true);
      // Would add to pending business/service requests for admin approval
    } else if (businessType) {
      setSubmitted(true);
      setPendingRequest(!autoApprove);
      // Would proceed with normal registration or pending approval
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Register as a Vendor</CardTitle>
        </CardHeader>
        <CardContent>
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
              <Button type="submit" className="w-full">Register</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 