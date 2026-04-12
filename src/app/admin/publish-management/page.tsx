'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';

type AdminVendor = {
  id: string;
  name: string | null;
  businessName: string | null;
  category: string | null;
  businessType: string | null;
  isPubliclyListed: boolean;
  publiclyListedAt: string | null;
  createdAt: string;
};

type AdminService = {
  id: string;
  vendorId: string;
  name: string;
  price: number;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
};

export default function AdminPublishManagementPage() {
  const [q, setQ] = useState('');
  const [vendors, setVendors] = useState<AdminVendor[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const adminHeaders = () => {
    const user = (() => {
      try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();
    const userId = user?.id || 'D43B6BB3-1A72-45EC-A362-A6E1E0580EA0';
    return {
      'Content-Type': 'application/json',
      'x-user-id': String(userId),
      'x-user-role': 'admin',
      'x-admin': 'true',
    };
  };

  const load = async (query = q) => {
    setLoading(true);
    setFeedback(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(`/api/admin/publish?${params.toString()}`, {
        method: 'GET',
        headers: adminHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || `Status ${res.status}`);
      setVendors(Array.isArray(json.vendors) ? json.vendors : []);
      setServices(Array.isArray(json.services) ? json.services : []);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to load publish controls',
      });
      setVendors([]);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const vendor of vendors) {
      map.set(vendor.id, vendor.businessName || vendor.name || vendor.id);
    }
    return map;
  }, [vendors]);

  const toggleVendorListing = async (vendor: AdminVendor) => {
    const next = !vendor.isPubliclyListed;
    setBusyId(`vendor:${vendor.id}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}/publish`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: JSON.stringify({ isPubliclyListed: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || `Status ${res.status}`);

      setVendors((prev) =>
        prev.map((v) =>
          v.id === vendor.id
            ? {
                ...v,
                isPubliclyListed: Boolean(json?.vendor?.isPubliclyListed),
                publiclyListedAt: json?.vendor?.publiclyListedAt ?? v.publiclyListedAt,
              }
            : v
        )
      );
      setFeedback({ type: 'success', message: json?.message || 'Vendor listing updated' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update vendor listing state',
      });
    } finally {
      setBusyId(null);
    }
  };

  const toggleServicePublish = async (service: AdminService) => {
    const next = !service.isPublished;
    setBusyId(`service:${service.id}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/services/${service.id}/publish`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: JSON.stringify({ isPublished: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || `Status ${res.status}`);

      setServices((prev) =>
        prev.map((s) =>
          s.id === service.id
            ? {
                ...s,
                isPublished: Boolean(json?.service?.isPublished),
                publishedAt: json?.service?.publishedAt ?? s.publishedAt,
              }
            : s
        )
      );
      setFeedback({ type: 'success', message: json?.message || 'Service publish state updated' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update service publish state',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Publish Management</h1>
          <p className="text-gray-600 mt-1">Admin controls for vendor listing and service publishing.</p>
        </div>
        <Button variant="outline" onClick={() => load(q)} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded border text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vendors/services by name, category, or description"
          />
          <Button onClick={() => load(q)} disabled={loading}>
            Apply
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendor Public Listing Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-gray-500">Loading vendors...</p>
          ) : vendors.length === 0 ? (
            <p className="text-gray-500">No vendors found.</p>
          ) : (
            vendors.map((vendor) => (
              <div key={vendor.id} className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium">{vendor.businessName || vendor.name || 'Unknown Vendor'}</p>
                  <p className="text-sm text-gray-600">
                    {vendor.category || vendor.businessType || 'Uncategorized'} • Created{' '}
                    {new Date(vendor.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-2">
                    {vendor.isPubliclyListed ? (
                      <Badge className="bg-green-100 text-green-800">Publicly Listed</Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-700">Not Listed</Badge>
                    )}
                    {vendor.publiclyListedAt ? (
                      <span className="text-xs text-gray-500">
                        First listed: {new Date(vendor.publiclyListedAt).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant={vendor.isPubliclyListed ? 'outline' : 'default'}
                  onClick={() => toggleVendorListing(vendor)}
                  disabled={busyId === `vendor:${vendor.id}`}
                >
                  {vendor.isPubliclyListed ? 'Unlist Vendor' : 'List Vendor Publicly'}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Publish Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-gray-500">Loading services...</p>
          ) : services.length === 0 ? (
            <p className="text-gray-500">No services found.</p>
          ) : (
            services.map((service) => (
              <div key={service.id} className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-gray-600">
                    Vendor: {vendorNameById.get(service.vendorId) || service.vendorId} • ${Number(service.price).toFixed(2)}
                  </p>
                  <div className="flex items-center gap-2">
                    {service.isPublished ? (
                      <Badge className="bg-blue-100 text-blue-800">Published</Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-700">Unpublished</Badge>
                    )}
                    {service.publishedAt ? (
                      <span className="text-xs text-gray-500">
                        First published: {new Date(service.publishedAt).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant={service.isPublished ? 'outline' : 'default'}
                  onClick={() => toggleServicePublish(service)}
                  disabled={busyId === `service:${service.id}`}
                >
                  {service.isPublished ? 'Unpublish Service' : 'Publish Service'}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
