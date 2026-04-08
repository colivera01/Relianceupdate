// src/app/dashboard/invites/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, QrCode, Plus, X } from 'lucide-react';
import { getVendorIdFromRequest } from '@/lib/auth';

export default function InvitesPage() {
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    // Get vendor ID (temporary - replace with real auth)
    getVendorIdFromRequest(new Request('/')).then(id => {
      if (id) {
        setVendorId(id);
        fetchInvites(id);
      }
    });
  }, []);

  const fetchInvites = async (vid: string) => {
    try {
      const res = await fetch(`/api/vendors/${vid}/invites`);
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites);
      }
    } catch (err) {
      console.error('Error fetching invites:', err);
    } finally {
      setLoading(false);
    }
  };

  const createInvite = async () => {
    if (!vendorId) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiresInHours: 24,
          maxUses: null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvites([data, ...invites]);
      }
    } catch (err) {
      console.error('Error creating invite:', err);
    } finally {
      setCreating(false);
    }
  };

  const deactivateInvite = async (inviteId: string) => {
    if (!vendorId) return;
    try {
      const res = await fetch(`/api/vendors/${vendorId}/invites/${inviteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      if (res.ok) {
        fetchInvites(vendorId);
      }
    } catch (err) {
      console.error('Error deactivating invite:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Invites</h1>
        <Button onClick={createInvite} disabled={creating}>
          <Plus className="w-4 h-4 mr-2" />
          Create Invite
        </Button>
      </div>

      <div className="grid gap-4">
        {invites.map((invite) => (
          <Card key={invite.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Code: {invite.code}
                    {invite.isActive ? (
                      <Badge className="bg-green-100 text-green-700">Active</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-700">Inactive</Badge>
                    )}
                  </CardTitle>
                </div>
                {invite.isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deactivateInvite(invite.id)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Deactivate
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Invite URL</label>
                  <div className="flex gap-2 mt-1">
                    <Input value={invite.inviteUrl} readOnly className="flex-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(invite.inviteUrl)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Expires:</span>{' '}
                    <span>{new Date(invite.expiresAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Uses:</span>{' '}
                    <span>
                      {invite.usesCount} {invite.maxUses ? `/ ${invite.maxUses}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

