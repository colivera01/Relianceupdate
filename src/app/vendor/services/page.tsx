'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, Loader2, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { TutorialEntryPoint } from '@/components/guidance/TutorialEntryPoint';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import VendorOnboardingStatusPanel from '@/components/vendor/VendorOnboardingStatusPanel';
import { tutorialGuides } from '@/lib/user-guidance';
import { buildVendorGrowthSummary } from '@/lib/vendor-growth-summary';

type ServiceRow = {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  price: number;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ServiceFormData = {
  name: string;
  description: string;
  price: string;
  estimatedDuration: string;
};

type VendorCopySuggestion = {
  summary: string;
  confidence: 'low' | 'medium' | 'high';
  recommendedHeadline: string;
  recommendedDescription: string;
  recommendedBullets: string[];
  trustGaps: string[];
  riskyClaims: string[];
  nextEdits: string[];
};

function friendlyAiCopyError(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error || 'Failed to generate AI copy guidance');
  const lower = message.toLowerCase();
  if (lower.includes('disabled') || lower.includes('configuration') || lower.includes('openai')) {
    return 'AI Copy Assist is not active in this environment yet. Your service can still be saved normally; enable the OpenAI settings later to receive rewrite suggestions.';
  }
  return message;
}

const durationNotePattern = /(?:\n\s*)?Estimated duration:\s*(\d+)\s*minutes?\.?\s*$/i;
const legacyDurationPattern = /\(estimated\s+(\d+)\s+min\)/i;

function extractEstimatedDuration(description: string) {
  const directMatch = description.match(durationNotePattern);
  if (directMatch?.[1]) return directMatch[1];
  const legacyMatch = description.match(legacyDurationPattern);
  if (legacyMatch?.[1]) return legacyMatch[1];
  return '';
}

function stripEstimatedDurationNote(description: string) {
  return description
    .replace(durationNotePattern, '')
    .replace(legacyDurationPattern, '')
    .trim();
}

function descriptionWithEstimatedDuration(description: string, estimatedDuration: string) {
  const cleanDescription = stripEstimatedDurationNote(description);
  const duration = Number(estimatedDuration);
  if (!Number.isFinite(duration) || duration <= 0) return cleanDescription;
  return `${cleanDescription}\n\nEstimated duration: ${Math.round(duration)} minutes.`;
}

function mapApiService(service: any): ServiceRow {
  return {
    id: String(service?.id || ''),
    vendorId: String(service?.vendorId ?? service?.vendor_id ?? ''),
    name: String(service?.name || ''),
    description: String(service?.description || ''),
    price: Number(service?.price || 0),
    isPublished: Boolean(service?.isPublished),
    publishedAt: service?.publishedAt ? String(service.publishedAt) : null,
    createdAt: service?.created_at ? String(service.created_at) : null,
    updatedAt: service?.updated_at ? String(service.updated_at) : null,
  };
}

export default function VendorServicesPage() {
  const { data: vendorProfile, loading: vendorLoading, approvalPending, error: vendorProfileError } = useVendorProfile();
  const vendorId = String(vendorProfile?.id || '').trim();

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState('');

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRow | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    description: '',
    price: '',
    estimatedDuration: '',
  });
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [copySuggestion, setCopySuggestion] = useState<VendorCopySuggestion | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');

  const sortedServices = useMemo(
    () =>
      [...services].sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      }),
    [services]
  );
  const growthSummary = useMemo(
    () =>
      buildVendorGrowthSummary({
        vendorId,
        businessName: vendorProfile?.businessName || null,
        onboarding: vendorProfile?.onboarding || null,
        publishedReviewCount: Number(vendorProfile?.ratingCount || 0),
        approvedServiceVideoCount: 0,
      }),
    [vendorId, vendorProfile]
  );
  const reloadServices = useCallback(async () => {
    if (!vendorId) return;
    setServicesLoading(true);
    setServicesError('');
    try {
      const res = await fetch(`/api/services?vendorId=${encodeURIComponent(vendorId)}&limit=100`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Failed to load services (${res.status})`);
      }
      const rows = Array.isArray(payload?.services) ? payload.services : [];
      setServices(
        rows
          .map(mapApiService)
          .filter((service: ServiceRow) => service.id && service.vendorId === vendorId)
      );
    } catch (error) {
      setServices([]);
      setServicesError(error instanceof Error ? error.message : 'Failed to load services');
    } finally {
      setServicesLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;
    reloadServices().catch(() => {
      setServicesLoading(false);
      setServicesError('Failed to load services');
    });
  }, [vendorId, reloadServices]);

  const openCreateModal = () => {
    setEditingService(null);
    setFormData({ name: '', description: '', price: '', estimatedDuration: '' });
    setFormError('');
    setCopySuggestion(null);
    setCopyError('');
    setCopyMessage('');
    setShowFormModal(true);
  };

  const openEditModal = (service: ServiceRow) => {
    const estimatedDuration = extractEstimatedDuration(service.description);
    setEditingService(service);
    setFormData({
      name: service.name,
      description: stripEstimatedDurationNote(service.description),
      price: String(service.price),
      estimatedDuration,
    });
    setFormError('');
    setCopySuggestion(null);
    setCopyError('');
    setCopyMessage('');
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    if (formSaving) return;
    setShowFormModal(false);
    setEditingService(null);
    setFormError('');
    setCopySuggestion(null);
    setCopyError('');
    setCopyMessage('');
  };

  const handleSaveService = async () => {
    if (formSaving || !vendorId) return;
    const name = formData.name.trim();
    const description = formData.description.trim();
    const price = Number(formData.price);
    const estimatedDuration = formData.estimatedDuration.trim()
      ? Number(formData.estimatedDuration)
      : null;

    if (!name || !description || !Number.isFinite(price) || price < 0) {
      setFormError('Service name, description, and a non-negative reference price are required.');
      return;
    }
    if (
      estimatedDuration !== null &&
      (!Number.isFinite(estimatedDuration) || estimatedDuration <= 0)
    ) {
      setFormError('Estimated duration must be a positive number of minutes.');
      return;
    }
    const publicDescription = descriptionWithEstimatedDuration(
      description,
      estimatedDuration === null ? '' : String(estimatedDuration)
    );

    setFormSaving(true);
    setFormError('');
    try {
      if (editingService) {
        const updateRes = await fetch(`/api/services/${encodeURIComponent(editingService.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description: publicDescription,
            price,
          }),
        });
        const updatePayload = await updateRes.json().catch(() => ({}));
        if (!updateRes.ok) {
          throw new Error(updatePayload?.error || `Failed to update service (${updateRes.status})`);
        }
      } else {
        const createRes = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description: publicDescription,
            price,
            vendor_id: vendorId,
          }),
        });
        const createPayload = await createRes.json().catch(() => ({}));
        if (!createRes.ok) {
          throw new Error(createPayload?.error || `Failed to create service (${createRes.status})`);
        }
      }

      setShowFormModal(false);
      setEditingService(null);
      await reloadServices();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save service');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteService = async (service: ServiceRow) => {
    if (deleteLoadingId) return;
    setDeleteLoadingId(service.id);
    setServicesError('');
    try {
      const res = await fetch(`/api/services/${encodeURIComponent(service.id)}`, {
        method: 'DELETE',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Failed to delete service (${res.status})`);
      }
      await reloadServices();
    } catch (error) {
      setServicesError(error instanceof Error ? error.message : 'Failed to delete service');
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const requestServiceCopySuggestion = async () => {
    if (!vendorId) return;
    setCopyLoading(true);
    setCopyError('');
    setCopyMessage('');
    try {
      const response = await fetch('/api/vendor/copy-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendorId,
          mode: 'service_draft',
          businessName:
            String(vendorProfile?.businessName || vendorProfile?.name || 'Your business').trim() ||
            'Your business',
          category: vendorProfile?.category || null,
          city: vendorProfile?.city || null,
          state: vendorProfile?.state || null,
          currentHeadline: formData.name.trim() || null,
          currentDescription: formData.description,
          currentBullets: [],
          trustSignals: [
            vendorProfile?.membershipStatus === 'ACTIVE'
              ? 'Vendor account is approved on Reliance.'
              : 'Vendor account is still awaiting approval.',
            vendorProfile?.isPubliclyListed
              ? 'Business profile is currently visible to customers on Reliance.'
              : 'Business profile is not public yet.',
            Number(vendorProfile?.publishedServiceCount || 0) > 0
              ? `${Number(vendorProfile?.publishedServiceCount || 0)} published services offered already help customers find this business.`
              : 'No services are publicly published yet.',
            Number(vendorProfile?.ratingCount || 0) > 0
              ? `${Number(vendorProfile?.ratingCount || 0)} public customer reviews are visible.`
              : 'No public customer reviews are visible yet.',
          ],
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      setCopySuggestion(json?.suggestion || null);
      setCopyMessage(json?.message || 'AI service copy guidance generated.');
    } catch (error) {
      console.error('Error generating service copy suggestion:', error);
      setCopyError(friendlyAiCopyError(error));
    } finally {
      setCopyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {vendorProfile?.onboarding ? (
          <div className="mb-6">
            <VendorOnboardingStatusPanel profile={vendorProfile} compact />
          </div>
        ) : null}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Services Offered</h1>
            <p className="text-gray-600">
              Create the services customers can search for, compare, and request from your business.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <TutorialEntryPoint guide={tutorialGuides.vendorServices} surface="light" />
            <button
              onClick={openCreateModal}
              disabled={!vendorId || vendorLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-blue-300/40 bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:via-blue-600 hover:to-sky-600 hover:shadow-[0_18px_42px_rgba(37,99,235,0.36)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              Add Service
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-blue-300/25 bg-blue-500/10 p-5 text-blue-50">
          <p className="text-sm font-semibold text-blue-100">Build your service menu</p>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-100/85">
            Each service you create becomes an option customers can search for and request. When you later
            create a work record or job, you can attach it to one of these saved services.
          </p>
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          <details className="group rounded-2xl border border-white/10 bg-slate-950/65 p-4 text-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-blue-100">
              <span>Why your Services Offered may still not be public</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-blue-200 transition group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Saving a service stores it for your business first. Customers see it after your vendor
              profile is approved, your business is listed, and Reliance publishes the service for public discovery.
            </p>
          </details>

          <details className="group rounded-2xl border border-white/10 bg-slate-950/65 p-4 text-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-blue-100">
              <span>What customers can see</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-blue-200 transition group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Published services can appear on your public profile, browse/search results, and future
              customer request flows. Customers use them to understand what you offer before a work
              record or service video is created.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Currently published: {growthSummary.metrics[1].value} service{growthSummary.metrics[1].value === '1' ? '' : 's'}.
            </p>
          </details>
        </div>

        {approvalPending && (
          <div className="p-4 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            Vendor account pending approval. Your services offered are saved for admin review, but they are not publicly visible yet.
          </div>
        )}

        {!approvalPending && vendorProfileError && (
          <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {vendorProfileError}
          </div>
        )}

        {!vendorId && !vendorLoading && (
          <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            Vendor context is not available. Service management is disabled.
          </div>
        )}

        {servicesError && (
          <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {servicesError}
          </div>
        )}

        {servicesLoading ? (
          <div className="p-6 bg-white rounded-2xl border border-gray-200 text-gray-600 flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading services offered...
          </div>
        ) : sortedServices.length === 0 ? (
          <div className="p-6 bg-white rounded-2xl border border-gray-200 text-gray-600">
            No services offered added yet. Add the first service customers should be able to understand and request.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedServices.map((service) => {
              const cleanDescription = stripEstimatedDurationNote(service.description);
              const estimatedDuration = extractEstimatedDuration(service.description);

              return (
              <div
                key={service.id}
                className={`rounded-2xl border p-4 shadow-sm ${
                  service.isPublished
                    ? 'border-gray-200 bg-white'
                    : 'border-dashed border-amber-300 bg-slate-100 opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                    <p className={`mt-1 text-sm ${service.isPublished ? 'text-gray-600' : 'text-slate-500'}`}>
                      {cleanDescription || 'No description'}
                    </p>
                    {estimatedDuration ? (
                      <p className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        Estimated duration: {estimatedDuration} min
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">${service.price.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Reference estimate</div>
                    <div
                      className={`text-xs mt-1 ${
                        service.isPublished ? 'text-green-700' : 'text-amber-700'
                      }`}
                    >
                      {service.isPublished ? 'Published for customers' : 'Pending admin approval'}
                    </div>
                  </div>
                </div>
                {!service.isPublished ? (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    New service pending admin approval. Once approved, this service will be activated for customers.
                  </div>
                ) : null}

                <div className="text-xs text-gray-500 mb-4">
                  Updated:{' '}
                  {service.updatedAt ? new Date(service.updatedAt).toLocaleDateString() : 'Unknown'}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(service)}
                    className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteService(service)}
                    disabled={deleteLoadingId === service.id}
                    className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleteLoadingId === service.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-3 py-5 sm:items-center sm:p-4">
            <div className="flex max-h-[calc(100dvh-2.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-blue-300/20 bg-slate-950 text-white shadow-2xl sm:max-h-[88vh]">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {editingService ? 'Edit Service' : 'Add Service'}
                  </h2>
                  <p className="mt-1 max-w-xl text-sm leading-5 text-slate-300">
                    Save one service customers can choose later. Jobs and videos are created separately.
                  </p>
                </div>
                <button
                  onClick={closeFormModal}
                  disabled={formSaving}
                  className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_190px]">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-100">Service Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="Example: Outlet installation"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-100">
                    Time Estimate
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.estimatedDuration}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, estimatedDuration: e.target.value }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="Minutes"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Minutes customers can expect.
                  </p>
                </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-100">Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="min-h-[104px] w-full resize-y rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="Tell customers what is included and what they can expect."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-100">
                      Price Estimate ($) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      placeholder="0.00"
                    />
                    <p className="mt-2 text-xs text-slate-400">Shown as a reference estimate.</p>
                  </div>

                  <div className="rounded-xl border border-blue-300/25 bg-blue-500/10 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-blue-100">
                          <Sparkles className="h-4 w-4" />
                          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Need help wording it?</p>
                        </div>
                        <p className="mt-1 text-sm text-blue-100/80">
                          AI can clean up the name and description before customers see it.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void requestServiceCopySuggestion()}
                        disabled={copyLoading || !vendorId}
                        className="shrink-0 rounded-xl border border-blue-300/40 bg-slate-950 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {copyLoading ? 'Checking...' : copySuggestion ? 'Try Again' : 'Improve Text'}
                      </button>
                    </div>

                  {copyMessage ? (
                    <div className="mt-3 rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                      {copyMessage}
                    </div>
                  ) : null}
                  {copyError ? (
                    <div className="mt-3 rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                      {copyError}
                    </div>
                  ) : null}

                  {copySuggestion ? (
                    <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-slate-950/80 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-600 px-2 py-1 text-xs text-slate-300">
                          {copySuggestion.confidence.charAt(0).toUpperCase() + copySuggestion.confidence.slice(1)} confidence
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{copySuggestion.summary}</p>
                      <div className="rounded-lg border border-blue-300/20 bg-blue-500/10 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Suggested service title</p>
                        <p className="mt-2 text-sm font-semibold text-white">{copySuggestion.recommendedHeadline}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Suggested description</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{copySuggestion.recommendedDescription}</p>
                      </div>
                      {copySuggestion.recommendedBullets.length > 0 ? (
                        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Suggested trust points</p>
                          <ul className="mt-2 space-y-1 text-sm text-slate-300">
                            {copySuggestion.recommendedBullets.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {copySuggestion.trustGaps.length > 0 ? (
                        <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">What customers may still question</p>
                          <ul className="mt-2 space-y-1 text-sm text-amber-100">
                            {copySuggestion.trustGaps.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {copySuggestion.riskyClaims.length > 0 ? (
                        <div className="rounded-lg border border-red-300/30 bg-red-500/10 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-200">Claims to avoid or soften</p>
                          <ul className="mt-2 space-y-1 text-sm text-red-100">
                            {copySuggestion.riskyClaims.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((current) => ({
                              ...current,
                              name: copySuggestion.recommendedHeadline,
                              description: copySuggestion.recommendedDescription,
                            }))
                          }
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                          Use This Text
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                </div>

                {formError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-100">
                    <AlertCircle className="w-4 h-4" />
                    {formError}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-white/10 bg-slate-950 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  onClick={closeFormModal}
                  disabled={formSaving}
                  className="w-full rounded-xl border border-white/15 px-5 py-2.5 text-slate-200 hover:bg-white/10 disabled:opacity-50 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleSaveService().catch(() => undefined);
                  }}
                  disabled={formSaving || !vendorId}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-2.5 font-semibold text-white hover:from-blue-700 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Service
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

