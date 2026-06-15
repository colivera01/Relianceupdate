'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { GuidanceCallout } from '@/components/guidance/GuidanceCallout';
import { TutorialEntryPoint } from '@/components/guidance/TutorialEntryPoint';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import VendorOnboardingStatusPanel from '@/components/vendor/VendorOnboardingStatusPanel';
import { tutorialGuides } from '@/lib/user-guidance';
import { buildVendorGrowthSummary } from '@/lib/vendor-growth-summary';
import { getServiceTemplatesForCategory, type ServiceTemplate } from '@/config/service-templates';

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
  const serviceCategory = String(
    vendorProfile?.category || vendorProfile?.businessType || ''
  ).trim();
  const serviceTemplates = useMemo(
    () => getServiceTemplatesForCategory(serviceCategory),
    [serviceCategory]
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

  const openCreateModalFromTemplate = (template: ServiceTemplate) => {
    setEditingService(null);
    setFormData({
      name: template.name,
      description: '',
      price: '',
      estimatedDuration: String(template.defaultDuration || ''),
    });
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
              ? 'Business profile is currently visible as public proof on Reliance.'
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
      setCopyError(error instanceof Error ? error.message : 'Failed to generate AI copy guidance');
    } finally {
      setCopyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {vendorProfile?.onboarding ? (
          <div className="mb-6">
            <VendorOnboardingStatusPanel profile={vendorProfile} />
          </div>
        ) : null}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Services Offered</h1>
            <p className="text-gray-600">
              Build the menu of work customers can understand before they request help from your business.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <TutorialEntryPoint guide={tutorialGuides.vendorServices} surface="light" />
            <button
              onClick={openCreateModal}
              disabled={!vendorId || vendorLoading}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-2 text-white transition-all duration-200 hover:from-blue-700 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Service to Menu
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold text-blue-950">This is your customer-facing Services Offered menu</p>
          <p className="mt-1">
            Think of each service offered as a menu item customers can compare before requesting help. Clear names,
            simple descriptions, estimated duration, and honest reference pricing help customers
            understand what you provide. Saving a service offered here does not create a service
            record or service video by itself; it prepares the service customers can request after Reliance publishes it.
          </p>
          <p className="mt-2 text-blue-900/80">
            If you selected starter services during registration, this is where you refine them into polished public-facing options.
          </p>
        </div>

        {serviceCategory ? (
          <section className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Common service starters
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  Choose common services for {serviceCategory}
                </h2>
                <p className="mt-1 text-sm leading-6 text-blue-900/78">
                  Start with a common service, then edit the name, duration, price, and description
                  before saving it to your Services Offered menu.
                </p>
              </div>
              <button
                onClick={openCreateModal}
                disabled={!vendorId || vendorLoading}
                className="inline-flex items-center justify-center rounded-full border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add custom service
              </button>
            </div>

            {serviceTemplates.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {serviceTemplates.map((template) => (
                  <button
                    key={template.name}
                    type="button"
                    onClick={() => openCreateModalFromTemplate(template)}
                    disabled={!vendorId || vendorLoading}
                    className="rounded-xl border border-blue-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <p className="font-semibold text-slate-950">{template.name}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Typical time: {template.defaultDuration} min
                    </p>
                    <span className="mt-3 inline-flex rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                      Use template
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4 text-sm text-blue-900/78">
                No starter templates are configured for {serviceCategory} yet. Add a custom service
                below.
              </div>
            )}
          </section>
        ) : null}

        <GuidanceCallout
          title="What customers can see"
          description="Services offered here are saved internally first. Customers only see them after Reliance publishes them."
          bullets={[
            `${growthSummary.metrics[1].value} published service${growthSummary.metrics[1].value === '1' ? '' : 's'} offered currently help customers find the business.`,
            'Not-public services stay internal until Reliance finishes the publishing step.',
            'Stronger service copy improves discovery and helps customers understand what they can request.',
          ]}
          tone="slate"
          className="mb-4"
        />

        <GuidanceCallout
          title="Why your Services Offered may still not be public"
          description="Saving a service prepares it for review, but customer discovery still depends on vendor approval, public vendor listing, and admin publishing."
          bullets={[
            'Service saved: Reliance stores the service internally for review.',
            'Vendor approved and listed: customers can find the business profile.',
            'Service published: the service becomes publicly discoverable and request-ready.',
          ]}
          tone="blue"
          className="mb-4"
        />

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
              <div key={service.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{cleanDescription || 'No description'}</p>
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
                      {service.isPublished ? 'Published for customers' : 'Saved, not public yet'}
                    </div>
                  </div>
                </div>

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
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                  Publishing stays admin-managed for this launch. Use delete only for services you no longer want Reliance to keep on file.
                </div>
              </div>
              );
            })}
          </div>
        )}

        {showFormModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white mx-4">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingService ? 'Edit Service Offered' : 'Add Service to Your Menu'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    This becomes one customer-facing service option after Reliance publishes it.
                  </p>
                </div>
                <button
                  onClick={closeFormModal}
                  disabled={formSaving}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Service Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Example: Outlet installation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Explain what customers can expect, what is included, and what may affect the final scope."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.estimatedDuration}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, estimatedDuration: e.target.value }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Example: 60"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Shown as a customer-facing estimate so people understand the typical time involved.
                  </p>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-blue-700">
                        <Sparkles className="h-4 w-4" />
                        <p className="text-xs font-semibold uppercase tracking-[0.18em]">AI Copy Assist</p>
                      </div>
                      <p className="mt-2 text-sm text-blue-950">
                        Use AI to turn rough service details into clearer customer language. It can suggest a stronger title, simpler description, trust points, and claims to avoid before the service appears publicly.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void requestServiceCopySuggestion()}
                      disabled={copyLoading || !vendorId}
                      className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {copyLoading
                        ? 'Generating...'
                        : copySuggestion
                          ? 'Refresh AI Suggestion'
                          : 'Improve Service Copy'}
                    </button>
                  </div>

                  {copyMessage ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {copyMessage}
                    </div>
                  ) : null}
                  {copyError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {copyError}
                    </div>
                  ) : null}

                  {copySuggestion ? (
                    <div className="rounded-lg border border-blue-100 bg-white p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-700">
                          {copySuggestion.confidence.charAt(0).toUpperCase() + copySuggestion.confidence.slice(1)} confidence
                        </span>
                      </div>
                      <p className="text-sm text-slate-800">{copySuggestion.summary}</p>
                      <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Suggested service title</p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">{copySuggestion.recommendedHeadline}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Suggested description</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{copySuggestion.recommendedDescription}</p>
                      </div>
                      {copySuggestion.recommendedBullets.length > 0 ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Suggested trust points</p>
                          <ul className="mt-2 space-y-1 text-sm text-slate-700">
                            {copySuggestion.recommendedBullets.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {copySuggestion.trustGaps.length > 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">What customers may still question</p>
                          <ul className="mt-2 space-y-1 text-sm text-amber-800">
                            {copySuggestion.trustGaps.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {copySuggestion.riskyClaims.length > 0 ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Claims to avoid or soften</p>
                          <ul className="mt-2 space-y-1 text-sm text-red-800">
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
                          Use Suggested Title and Description
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reference Price ($) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Required for service records, but shown as a customer-facing estimate/reference
                    until in-app billing tools are introduced.
                  </p>
                </div>

                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {formError}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={closeFormModal}
                  disabled={formSaving}
                  className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleSaveService().catch(() => undefined);
                  }}
                  disabled={formSaving || !vendorId}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-2 text-white hover:from-blue-700 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingService ? 'Update Service Offered' : 'Save Service Offered'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

