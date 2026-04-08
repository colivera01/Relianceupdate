// src/app/dashboard/devices/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Smartphone, Headphones, User, Clock, Settings } from 'lucide-react';
import { getVendorIdFromRequest } from '@/lib/auth';

export default function DevicesPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);

  useEffect(() => {
    getVendorIdFromRequest(new Request('/')).then(id => {
      if (id) {
        setVendorId(id);
        fetchDevices(id);
        fetchMemberships(id);
      }
    });
  }, []);

  const fetchDevices = async (vid: string) => {
    try {
      const res = await fetch(`/api/vendors/${vid}/devices`);
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices);
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberships = async (vid: string) => {
    try {
      const res = await fetch(`/api/vendors/${vid}/memberships?status=ACTIVE`);
      if (res.ok) {
        const data = await res.json();
        setMemberships(data.memberships);
      }
    } catch (err) {
      console.error('Error fetching memberships:', err);
    }
  };

  const handleAssign = (device: any) => {
    setSelectedDevice(device);
    setAssignModalOpen(true);
  };

  const assignHeadset = async (membershipId: string) => {
    if (!vendorId || !selectedDevice) return;
    try {
      const res = await fetch(`/api/vendors/${vendorId}/headsets/${selectedDevice.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId }),
      });
      if (res.ok) {
        setAssignModalOpen(false);
        setSelectedDevice(null);
        fetchDevices(vendorId);
      }
    } catch (err) {
      console.error('Error assigning headset:', err);
    }
  };

  const unassignHeadset = async (deviceId: string) => {
    if (!vendorId) return;
    if (!confirm('Are you sure you want to unassign this headset?')) return;
    try {
      const res = await fetch(`/api/vendors/${vendorId}/headsets/${deviceId}/unassign`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchDevices(vendorId);
      }
    } catch (err) {
      console.error('Error unassigning headset:', err);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  const phones = devices.filter((d) => d.deviceType === 'PHONE');
  const headsets = devices.filter((d) => d.deviceType === 'HEADSET');

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Devices</h1>

      {/* Phones Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Phones ({phones.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {phones.length === 0 ? (
            <p className="text-gray-500">No phones registered</p>
          ) : (
            <div className="space-y-2">
              {phones.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-medium">{device.model || device.deviceUid}</div>
                      <div className="text-sm text-gray-500">
                        Last seen: {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'Never'}
                      </div>
                    </div>
                  </div>
                  <Badge className={device.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                    {device.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Headsets Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="w-5 h-5" />
            Headsets ({headsets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {headsets.length === 0 ? (
            <p className="text-gray-500">No headsets registered</p>
          ) : (
            <div className="space-y-2">
              {headsets.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Headphones className="w-5 h-5 text-purple-600" />
                    <div>
                      <div className="font-medium">{device.model || device.deviceUid}</div>
                      <div className="text-sm text-gray-500">
                        {device.assignedTo ? (
                          <span>
                            Assigned to: {device.assignedTo.user?.name || device.assignedTo.user?.email || 'Unknown'}
                          </span>
                        ) : (
                          <span className="text-orange-600">Unassigned</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        Last seen: {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'Never'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {device.assignedTo ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unassignHeadset(device.id)}
                      >
                        Unassign
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleAssign(device)}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Assign
                      </Button>
                    )}
                    <Badge className={device.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                      {device.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Headset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Employee</label>
              <Select onValueChange={assignHeadset}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee" />
                </SelectTrigger>
                <SelectContent>
                  {memberships
                    .filter((m) => m.role === 'EMPLOYEE')
                    .map((membership) => (
                      <SelectItem key={membership.id} value={membership.id}>
                        {membership.user?.name || membership.user?.email || 'Unknown'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

