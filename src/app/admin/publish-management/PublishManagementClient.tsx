'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getAdminRequestHeaders } from '@/lib/admin-client';
import { RefreshCw } from 'lucide-react';
import type { AdminPublishService, AdminPublishVendor } from '@/lib/admin-publish-controls';

type PublishManagementClientProps = {
  initialQuery: string;
  initialServices: AdminPublishService[];
  initialVendors: AdminPublishVendor[];
};

type PendingPublishAction =
  | { kind: 'vendor'; vendor: AdminPublishVendor; next: boolean }
  | { kind: 'service'; service: AdminPublishService; next: boolean }
  | null;

export default function PublishManagementClient({
  initialQuery,
  initialServices,
  initialVendors,
}: PublishManagementClientProps) {
  const [q, setQ] = useState(initialQuery);
  const [vendors, setVendors] = useState(initialVendors);
  const [services, setServices] = useState(initialServices);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aiBusyVendorId, setAiBusyVendorId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingPublishAction>(null);

  const load = async (query = q) => {
    setLoading(true);
    setFeedback(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(`/api/admin/publish?${params.toString()}`, {
        method: 'GET',
        headers: getAdminRequestHeaders(),
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

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const vendor of vendors) {
      map.set(vendor.id, vendor.businessName || vendor.name || vendor.id);
    }
    return map;
  }, [vendors]);

  const toggleVendorListing = async (vendor: AdminPublishVendor) => {
    const next = !vendor.isPubliclyListed;
    setBusyId(`vendor:${vendor.id}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}/publish`, {
        method: 'PATCH',
        headers: getAdminRequestHeaders(),
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

  const toggleServicePublish = async (service: AdminPublishService) => {
    const next = !service.isPublished;
    setBusyId(`service:${service.id}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/services/${service.id}/publish`, {
        method: 'PATCH',
        headers: getAdminRequestHeaders(),
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

  const queueVendorListingToggle = (vendor: AdminPublishVendor) => {
    setPendingAction({
      kind: 'vendor',
      vendor,
      next: !vendor.isPubliclyListed,
    });
  };

  const queueServicePublishToggle = (service: AdminPublishService) => {
    setPendingAction({
      kind: 'service',
      service,
      next: !service.isPublished,
    });
  };

  const closePendingAction = () => setPendingAction(null);

  const requestAiPublishReadiness = async (vendor: AdminPublishVendor) => {
    setAiBusyVendorId(vendor.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/publish/vendors/${vendor.id}/assist`, {
        method: 'POST',
        headers: getAdminRequestHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || `Status ${res.status}`);
      await load(q);
      setFeedback({
        type: 'success',
        message: json?.message || 'AI publish readiness recommendation generated',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to generate AI publish readiness recommendation',
      });
    } finally {
      setAiBusyVendorId(null);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.kind === 'vendor') {
      await toggleVendorListing(pendingAction.vendor);
    } else {
      await toggleServicePublish(pendingAction.service);
    }
    setPendingAction(null);
  };

  const pendingActionTitle =
    pendingAction?.kind === 'vendor'
      ? pendingAction.next
        ? 'List Vendor Publicly'
        : 'Unlist Vendor'
      : pendingAction?.kind === 'service'
        ? pendingAction.next
          ? 'Publish Service'
          : 'Unpublish Service'
        : '';

  const pendingActionDescription =
    pendingAction?.kind === 'vendor'
      ? pendingAction.next
        ? `This will make ${pendingAction.vendor.businessName || pendingAction.vendor.name || 'this vendor'} visible in the public Reliance marketplace.`
        : `This will remove ${pendingAction.vendor.businessName || pendingAction.vendor.name || 'this vendor'} from the public Reliance marketplace. Existing internal records stay intact.`
      : pendingAction?.kind === 'service'
        ? pendingAction.next
          ? `This will publish ${pendingAction.service.name} so it can appear in public Reliance service discovery.`
          : `This will remove ${pendingAction.service.name} from public Reliance service discovery. Existing internal records stay intact.`
        : '';

  const pendingActionConfirmLabel =
    pendingAction?.kind === 'vendor'
      ? pendingAction.next
        ? 'Confirm Listing'
        : 'Confirm Unlist'
      : pendingAction?.kind === 'service'
        ? pendingAction.next
          ? 'Confirm Publish'
          : 'Confirm Unpublish'
        : 'Confirm';

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
            <p className="text-gray-500">Loading vendor listing status...</p>
          ) : vendors.length === 0 ? (
            <p className="text-gray-500">No vendors found.</p>
          ) : (
            vendors.map((vendor) => (
              <div key={vendor.id} className="border rounded p-3 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="space-y-3 flex-1">
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
                  <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                          AI Publish Readiness
                        </div>
                        <p className="mt-1 text-xs text-blue-800">
                          Recommendation only. Listing and publishing decisions stay manual.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => requestAiPublishReadiness(vendor)}
                        disabled={aiBusyVendorId === vendor.id}
                      >
                        {aiBusyVendorId === vendor.id
                          ? 'Checking...'
                          : vendor.aiRecommendation
                            ? 'Refresh AI Review'
                            : 'Run AI Review'}
                      </Button>
                    </div>
                    {vendor.aiRecommendation ? (
                      <div className="rounded-md border border-blue-200 bg-white p-3 text-sm">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {String(vendor.aiRecommendation.suggestion.decision || '')
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (char) => char.toUpperCase())}
                          </Badge>
                          <Badge variant="outline">
                            {vendor.aiRecommendation.suggestion.confidence} confidence
                          </Badge>
                        </div>
                        <p className="mt-3 text-slate-800">
                          {vendor.aiRecommendation.suggestion.summary}
                        </p>
                        {vendor.aiRecommendation.suggestion.blockingIssues?.length ? (
                          <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                            <div className="font-semibold uppercase tracking-wide text-amber-700">
                              Open blockers
                            </div>
                            <ul className="mt-2 space-y-1">
                              {vendor.aiRecommendation.suggestion.blockingIssues
                                .slice(0, 3)
                                .map((issue) => (
                                  <li key={issue}>- {issue}</li>
                                ))}
                            </ul>
                          </div>
                        ) : null}
                        {vendor.aiRecommendation.suggestion.recommendedActions?.length ? (
                          <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                            <div className="font-semibold uppercase tracking-wide text-slate-700">
                              Suggested next actions
                            </div>
                            <ul className="mt-2 space-y-1">
                              {vendor.aiRecommendation.suggestion.recommendedActions
                                .slice(0, 3)
                                .map((action) => (
                                  <li key={action}>- {action}</li>
                                ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant={vendor.isPubliclyListed ? 'outline' : 'default'}
                  onClick={() => queueVendorListingToggle(vendor)}
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
            <p className="text-gray-500">Loading service publish status...</p>
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
                  onClick={() => queueServicePublishToggle(service)}
                  disabled={busyId === `service:${service.id}`}
                >
                  {service.isPublished ? 'Unpublish Service' : 'Publish Service'}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && closePendingAction()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingActionTitle}</DialogTitle>
            <DialogDescription>{pendingActionDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closePendingAction}>
              Cancel
            </Button>
            <Button onClick={confirmPendingAction} disabled={Boolean(busyId)}>
              {pendingActionConfirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
