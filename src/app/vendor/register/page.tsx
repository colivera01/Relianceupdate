// BACKEND DEVELOPER NOTES:
// - On submit, if businessType is 'Other', add to pending business/service requests for admin approval
// - Otherwise, proceed with normal registration
// - Integrate with service catalog for business type options

'use client';
import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getServiceTemplatesForCategory, SERVICE_TEMPLATES } from '@/config/service-templates';

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
  type CustomServiceDraft = {
    id: string;
    name: string;
    defaultDuration: string;
    price: string;
    description: string;
  };
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [customBusinessType, setCustomBusinessType] = useState('');
  const [primaryServiceCategory, setPrimaryServiceCategory] = useState('');
  const [selectedTemplateServices, setSelectedTemplateServices] = useState<
    Array<{ templateKey: string; name: string; defaultDuration: number; price?: number; description?: string; source?: string }>
  >([]);
  const [customServices, setCustomServices] = useState<CustomServiceDraft[]>([]);
  const [customServiceError, setCustomServiceError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const availableTemplates = getServiceTemplatesForCategory(primaryServiceCategory);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !businessType.trim()) return;
    if (businessType === 'Other' && !customBusinessType.trim()) return;
    if (primaryServiceCategory && selectedTemplateServices.length === 0) {
      setError('Select at least one service you offer.');
      return;
    }

    const customServicesPayload = customServices.map((service) => ({
      name: service.name.trim(),
      defaultDuration: service.defaultDuration.trim() ? Number(service.defaultDuration) : undefined,
      price: service.price.trim() ? Number(service.price) : undefined,
      description: service.description.trim() || undefined,
      source: 'vendor_custom',
    }));
    const invalidCustom = customServicesPayload.find((service) => !service.name);
    if (invalidCustom) {
      setCustomServiceError('Custom service name is required.');
      return;
    }
    const invalidCustomNumber = customServicesPayload.find(
      (service) =>
        (service.defaultDuration !== undefined && (!Number.isFinite(service.defaultDuration) || service.defaultDuration <= 0)) ||
        (service.price !== undefined && (!Number.isFinite(service.price) || service.price < 0))
    );
    if (invalidCustomNumber) {
      setCustomServiceError('Custom service duration must be positive and price cannot be negative.');
      return;
    }

    const combinedNames = [
      ...selectedTemplateServices.map((service) => service.name.trim()),
      ...customServicesPayload.map((service) => service.name.trim()),
    ]
      .filter(Boolean)
      .map((name) => name.toLowerCase());
    if (new Set(combinedNames).size !== combinedNames.length) {
      setCustomServiceError('Duplicate service names are not allowed across template and custom services.');
      return;
    }
    setCustomServiceError('');

    const selectedServicesPayload = [...selectedTemplateServices, ...customServicesPayload]
      .map((service) => ({
        name: service.name.trim(),
        defaultDuration: service.defaultDuration,
        price: service.price,
        description: service.description,
        source: service.source,
      }))
      .filter((service) => service.name.length > 0);
    if (primaryServiceCategory && selectedServicesPayload.length === 0) {
      setError('Select at least one service you offer.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      // Temporary debug aid for verifying outbound registration payload.
      console.log('[vendor-register] selectedServices payload', selectedServicesPayload);
      const response = await fetch('/api/vendor/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessType: businessType.trim(),
          customBusinessType: customBusinessType.trim(),
          category: primaryServiceCategory.trim(),
          selectedServices: selectedServicesPayload,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || 'Failed to register vendor account'));
      }

      setPendingRequest(Boolean(payload?.requiresApproval ?? true));
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register vendor account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Register as a Vendor</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
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
              <div>
                <label className="block text-sm font-medium mb-1">Primary Service Category</label>
                <select
                  className="border rounded px-3 py-2 w-full"
                  value={primaryServiceCategory}
                  onChange={(e) => {
                    const category = e.target.value;
                    setPrimaryServiceCategory(category);
                    const templates = getServiceTemplatesForCategory(category);
                    setSelectedTemplateServices(
                      templates.map((t, idx) => ({ templateKey: `${idx}-${t.name}`, ...t }))
                    );
                    setCustomServices([]);
                    setCustomServiceError('');
                  }}
                >
                  <option value="">Select a primary service category</option>
                  {Object.keys(SERVICE_TEMPLATES).map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Prebuilt Service Templates</label>
                {primaryServiceCategory && availableTemplates.length > 0 ? (
                  <div className="space-y-2 rounded border p-3">
                    {availableTemplates.map((template, idx) => {
                      const templateKey = `${idx}-${template.name}`;
                      const selected = selectedTemplateServices.some((s) => s.templateKey === templateKey);
                      const selectedService = selectedTemplateServices.find((s) => s.templateKey === templateKey);
                      return (
                        <div key={`${template.name}-${template.defaultDuration}`} className="rounded border p-2">
                          <label className="flex items-center gap-2 text-sm font-medium">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTemplateServices((prev) => [
                                    ...prev,
                                    { templateKey, ...template },
                                  ]);
                                  return;
                                }
                                setSelectedTemplateServices((prev) =>
                                  prev.filter((item) => item.templateKey !== templateKey)
                                );
                              }}
                            />
                            {template.name} ({template.defaultDuration} min)
                          </label>
                          {selected ? (
                            <Input
                              className="mt-2"
                              value={selectedService?.name || template.name}
                              onChange={(e) => {
                                const nextName = e.target.value;
                                setSelectedTemplateServices((prev) =>
                                  prev.map((item) =>
                                    item.templateKey === templateKey
                                      ? { ...item, name: nextName }
                                      : item
                                  )
                                );
                              }}
                              placeholder="Edit service name"
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Select a primary service category to load templates.</p>
                )}
              </div>
              <div className="rounded border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium">Custom Services</label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setCustomServices((prev) => [
                        ...prev,
                        {
                          id: `custom-${Date.now()}-${prev.length}`,
                          name: '',
                          defaultDuration: '',
                          price: '',
                          description: '',
                        },
                      ])
                    }
                  >
                    + Add custom service
                  </Button>
                </div>
                {customServices.length === 0 ? (
                  <p className="text-xs text-gray-500">Add custom services when templates do not include what you offer.</p>
                ) : (
                  <div className="space-y-3">
                    {customServices.map((custom) => (
                      <div key={custom.id} className="rounded border p-2">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <Input
                            placeholder="Service name *"
                            value={custom.name}
                            onChange={(e) =>
                              setCustomServices((prev) =>
                                prev.map((item) => (item.id === custom.id ? { ...item, name: e.target.value } : item))
                              )
                            }
                          />
                          <Input
                            type="number"
                            min="1"
                            placeholder="Duration (minutes)"
                            value={custom.defaultDuration}
                            onChange={(e) =>
                              setCustomServices((prev) =>
                                prev.map((item) =>
                                  item.id === custom.id ? { ...item, defaultDuration: e.target.value } : item
                                )
                              )
                            }
                          />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Price"
                            value={custom.price}
                            onChange={(e) =>
                              setCustomServices((prev) =>
                                prev.map((item) => (item.id === custom.id ? { ...item, price: e.target.value } : item))
                              )
                            }
                          />
                          <Input
                            placeholder="Description"
                            value={custom.description}
                            onChange={(e) =>
                              setCustomServices((prev) =>
                                prev.map((item) =>
                                  item.id === custom.id ? { ...item, description: e.target.value } : item
                                )
                              )
                            }
                          />
                        </div>
                        <button
                          type="button"
                          className="mt-2 text-xs text-red-600"
                          onClick={() => setCustomServices((prev) => prev.filter((item) => item.id !== custom.id))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {customServiceError ? <p className="mt-2 text-xs text-red-600">{customServiceError}</p> : null}
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
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Register'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 