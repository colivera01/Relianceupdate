// src/app/dashboard/employees/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Shield, AlertTriangle } from 'lucide-react';
import { getVendorIdFromRequest } from '@/lib/auth';

export default function EmployeesPage() {
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    getVendorIdFromRequest(new Request('/')).then(id => {
      if (id) {
        setVendorId(id);
        fetchEmployees(id);
      }
    });
  }, []);

  const fetchEmployees = async (vid: string) => {
    try {
      const res = await fetch(`/api/vendors/${vid}/memberships?status=ACTIVE`);
      if (res.ok) {
        const data = await res.json();
        setMemberships(data.memberships);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const revokeMembership = async (membershipId: string) => {
    if (!vendorId) return;
    if (!confirm('Are you sure you want to revoke this membership?')) return;
    
    try {
      const res = await fetch(`/api/vendors/${vendorId}/memberships/${membershipId}/revoke`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchEmployees(vendorId);
      }
    } catch (err) {
      console.error('Error revoking membership:', err);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Active Employees</h1>

      {memberships.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No active employees
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {memberships.map((membership) => (
            <Card key={membership.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {membership.role === 'MANAGER' ? (
                    <Shield className="w-5 h-5 text-blue-600" />
                  ) : (
                    <User className="w-5 h-5 text-gray-600" />
                  )}
                  {membership.user?.name || membership.user?.email || 'Unknown User'}
                  <Badge className={membership.role === 'MANAGER' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}>
                    {membership.role}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Badge ID:</span>{' '}
                      <span className="font-medium">{membership.badgeId || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Approved:</span>{' '}
                      <span>{membership.approvedAt ? new Date(membership.approvedAt).toLocaleString() : 'N/A'}</span>
                    </div>
                  </div>
                  {membership.role !== 'MANAGER' && (
                    <Button
                      variant="destructive"
                      onClick={() => revokeMembership(membership.id)}
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Revoke
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

