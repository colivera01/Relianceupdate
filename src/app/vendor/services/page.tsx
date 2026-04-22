'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { useVendorProfile } from '@/hooks/useVendorProfile';

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
};

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
  });
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const publishBlockerMessage =
    'Publish/archive actions are blocked: no vendor-scoped publish/archive service route is available yet.';

  const sortedServices = useMemo(
    () =>
      [...services].sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      }),
    [services]
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
    setFormData({ name: '', description: '', price: '' });
    setFormError('');
    setShowFormModal(true);
  };

  const openEditModal = (service: ServiceRow) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description,
      price: String(service.price),
    });
    setFormError('');
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    if (formSaving) return;
    setShowFormModal(false);
    setEditingService(null);
    setFormError('');
  };

  const handleSaveService = async () => {
    if (formSaving || !vendorId) return;
    const name = formData.name.trim();
    const description = formData.description.trim();
    const price = Number(formData.price);

    if (!name || !description || !Number.isFinite(price) || price < 0) {
      setFormError('Service name, description, and a non-negative price are required.');
      return;
    }

    setFormSaving(true);
    setFormError('');
    try {
      if (editingService) {
        const updateRes = await fetch(`/api/services/${encodeURIComponent(editingService.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
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
            description,
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Service Management</h1>
            <p className="text-gray-600">Manage persisted services for your vendor profile.</p>
          </div>
          <button
            onClick={openCreateModal}
            disabled={!vendorId || vendorLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Create Service
          </button>
        </div>

        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
          {publishBlockerMessage}
        </div>

        {approvalPending && (
          <div className="p-4 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            Vendor account pending approval
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
            Loading services...
          </div>
        ) : sortedServices.length === 0 ? (
          <div className="p-6 bg-white rounded-2xl border border-gray-200 text-gray-600">
            No services found for this vendor.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedServices.map((service) => (
              <div key={service.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{service.description || 'No description'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-purple-600">${service.price.toFixed(2)}</div>
                    <div
                      className={`text-xs mt-1 ${
                        service.isPublished ? 'text-green-700' : 'text-amber-700'
                      }`}
                    >
                      {service.isPublished ? 'Published' : 'Unpublished'}
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
                <div className="flex gap-2 mt-2">
                  <button
                    disabled
                    title={publishBlockerMessage}
                    className="flex-1 px-3 py-2 border border-gray-300 text-gray-400 rounded-lg cursor-not-allowed"
                  >
                    Publish
                  </button>
                  <button
                    disabled
                    title={publishBlockerMessage}
                    className="flex-1 px-3 py-2 border border-gray-300 text-gray-400 rounded-lg cursor-not-allowed"
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showFormModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full mx-4">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingService ? 'Edit Service' : 'Create Service'}
                </h2>
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter service name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Describe your service"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price ($) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0.00"
                  />
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
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingService ? 'Update Service' : 'Create Service'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

