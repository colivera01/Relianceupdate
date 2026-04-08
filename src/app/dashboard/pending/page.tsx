// src/app/dashboard/pending/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { getVendorIdFromRequest } from '@/lib/auth';

export default function PendingPage() {
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    getVendorIdFromRequest(new Request('/')).then(id => {
      if (id) {
        setVendorId(id);
        fetchPending(id);
      }
    });
  }, []);

  const fetchPending = async (vid: string) => {
    try {
      const res = await fetch(`/api/vendors/${vid}/memberships?status=PENDING`);
      if (res.ok) {
        const data = await res.json();
        setMemberships(data.memberships);
      }
    } catch (err) {
      console.error('Error fetching pending:', err);
    } finally {
      setLoading(false);
    }
  };

  const approveMembership = async (membershipId: string) => {
    if (!vendorId) return;
    try {
      const res = await fetch(`/api/vendors/${vendorId}/memberships/${membershipId}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchPending(vendorId);
      }
    } catch (err) {
      console.error('Error approving membership:', err);
    }
  };

  const denyMembership = async (membershipId: string) => {
    if (!vendorId) return;
    try {
      const res = await fetch(`/api/vendors/${vendorId}/memberships/${membershipId}/deny`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchPending(vendorId);
      }
    } catch (err) {
      console.error('Error denying membership:', err);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Pending Memberships</h1>

      {memberships.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No pending membership requests
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {memberships.map((membership) => (
            <Card key={membership.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  {membership.user?.name || membership.user?.email || 'Unknown User'}
                  <Badge className="bg-yellow-100 text-yellow-700">PENDING</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Badge ID:</span>{' '}
                      <span className="font-medium">{membership.badgeId || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Requested:</span>{' '}
                      <span>{new Date(membership.requestedAt).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Device Model:</span>{' '}
                      <span>{membership.pendingDeviceModel || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">OS:</span>{' '}
                      <span>{membership.pendingDeviceOs || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => approveMembership(membership.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => denyMembership(membership.id)}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Deny
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

