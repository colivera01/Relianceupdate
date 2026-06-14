// BACKEND DEVELOPER NOTES:
// - On submit, if businessType is 'Other', add to pending business/service requests for admin approval
// - Otherwise, proceed with normal registration
// - Integrate with service catalog for business type options

'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TutorialEntryPoint } from '@/components/guidance/TutorialEntryPoint';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getServiceTemplatesForCategory } from '@/config/service-templates';
import { useAuth } from '@/contexts/AuthContext';
import { tutorialGuides } from '@/lib/user-guidance';
import { getTemplateServiceDefaultDetail } from '@/lib/register-flow';

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
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const darkFieldClass = 'border-white/12 bg-slate-900/90 text-white placeholder:text-white/40';
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [customBusinessType, setCustomBusinessType] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [primaryServiceCategory, setPrimaryServiceCategory] = useState('');
  const [selectedTemplateServices, setSelectedTemplateServices] = useState<
    Array<{ templateKey: string; name: string; defaultDuration?: number; price?: number; description?: string; source?: string }>
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
    if (!address.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      setError('Street address, city, state, and ZIP code are required before vendor review can start.');
      return;
    }
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
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          zipCode: zipCode.trim(),
          selectedServices: selectedServicesPayload,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || 'Failed to register vendor account'));
      }

      setPendingRequest(Boolean(payload?.requiresApproval ?? true));
      setSubmitted(true);
      window.setTimeout(() => {
        router.push('/vendor/dashboard');
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register vendor account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const alreadyVendorEnabled =
    user?.userType === 'vendor' ||
    user?.userType === 'both' ||
    user?.availableProfiles?.includes('vendor');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-white/72">
          Loading vendor onboarding…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <Card className="w-full max-w-2xl border-white/10 bg-slate-950 text-white shadow-[0_24px_70px_rgba(15,23,42,0.45)]">
          <CardHeader>
            <CardTitle className="text-3xl">Start vendor onboarding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-white/72">
            <div className="flex justify-end">
              <TutorialEntryPoint guide={tutorialGuides.vendorProfileSetup} surface="dark" />
            </div>
            <p>
              This page is for signed-in users who are adding a vendor profile to an existing Reliance account.
              If you are brand new to Reliance, create your vendor account first.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/auth/register?type=vendor"
                className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-500"
              >
                Create a new vendor account
              </Link>
              <Link
                href="/auth/login?next=%2Fvendor%2Fregister"
                className="inline-flex items-center rounded-full border border-white/14 bg-white/6 px-4 py-2 font-semibold text-white transition hover:bg-white/10"
              >
                Sign in to continue vendor setup
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadyVendorEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <Card className="w-full max-w-2xl border-white/10 bg-slate-950 text-white shadow-[0_24px_70px_rgba(15,23,42,0.45)]">
          <CardHeader>
            <CardTitle className="text-3xl">Vendor access already exists</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-white/72">
            <div className="flex justify-end">
              <TutorialEntryPoint guide={tutorialGuides.vendorProfileSetup} surface="dark" />
            </div>
            <p>
              This account already has vendor access or a vendor application in progress. Continue in the vendor dashboard instead of starting a duplicate request.
            </p>
            <Button onClick={() => router.push('/vendor/dashboard')} className="bg-blue-600 hover:bg-blue-500 text-white">
              Open vendor dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8">
      <Card className="w-full max-w-3xl border-white/10 bg-slate-950 text-white shadow-[0_24px_70px_rgba(15,23,42,0.45)]">
        <CardHeader>
          <CardTitle className="text-3xl">Continue vendor setup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-end">
            <TutorialEntryPoint guide={tutorialGuides.vendorProfileSetup} surface="dark" />
          </div>
          {error && (
            <div className="mb-4 rounded border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          {submitted ? (
            pendingRequest ? (
              <div className="text-center text-amber-200 font-medium">
                Vendor setup saved. Admin approval is now pending, and you are being sent to the vendor dashboard.
              </div>
            ) : (
              <div className="text-center text-green-200 font-medium">
                Registration successful! Welcome to Reliance.
              </div>
            )
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-4 text-sm text-blue-100">
                Use this signed-in flow when you already have a Reliance account and need to add a vendor business profile. Your business will stay internal until admin approval and publish steps are complete.
              </div>
              <div className="rounded-lg border border-white/12 bg-white/5 p-4 text-sm text-white/72">
                Business photo upload is handled later from <span className="font-semibold text-white">Vendor Profile</span> after vendor access is active. This setup flow saves your business details, services, and approval request first.
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-white/88">Business Name</label>
                <Input
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  required
                  className={darkFieldClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-white/88">Business Type</label>
                <select
                  className="w-full rounded border border-white/12 bg-slate-900/90 px-3 py-2 text-white"
                  style={{ colorScheme: 'dark' }}
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
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1 text-white/88">Street Address</label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} required className={darkFieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-white/88">City</label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} required className={darkFieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-white/88">State</label>
                  <Input value={state} onChange={(e) => setState(e.target.value)} required className={darkFieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-white/88">ZIP Code</label>
                  <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} required className={darkFieldClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-white/88">Primary Service Category</label>
                <select
                  className="w-full rounded border border-white/12 bg-slate-900/90 px-3 py-2 text-white"
                  style={{ colorScheme: 'dark' }}
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
                  {serviceCatalog.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-white/88">
                  Starter Services for Your Menu
                </label>
                <p className="mb-3 text-xs leading-5 text-white/56">
                  Optional at signup: choose common services for {primaryServiceCategory || 'your category'}.
                  These become starter Services Offered items you can refine later before customers request service.
                </p>
                {primaryServiceCategory && availableTemplates.length > 0 ? (
                  <div className="space-y-2 rounded border border-white/12 bg-white/5 p-3">
                    {availableTemplates.map((template, idx) => {
                      const templateKey = `${idx}-${template.name}`;
                      const selected = selectedTemplateServices.some((s) => s.templateKey === templateKey);
                      const selectedService = selectedTemplateServices.find((s) => s.templateKey === templateKey);
                      return (
                        <div key={`${template.name}-${template.defaultDuration}`} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
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
                            <span className="flex flex-wrap items-center gap-2">
                              <span>{template.name}</span>
                              <span className="rounded-full border border-blue-400/30 bg-blue-500/12 px-2 py-0.5 text-[11px] font-semibold text-blue-100">
                                Typical time: {template.defaultDuration} min
                              </span>
                            </span>
                          </label>
                          {selected ? (
                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div className="space-y-1">
                                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/46">Service Name</label>
                                <Input
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
                                  placeholder="Service name"
                                  className={darkFieldClass}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/46">Estimated Duration (minutes)</label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={selectedService?.defaultDuration ?? getTemplateServiceDefaultDetail(primaryServiceCategory, template.name).defaultDuration}
                                  onChange={(e) => {
                                    const nextDuration = e.target.value ? Number(e.target.value) : undefined;
                                    setSelectedTemplateServices((prev) =>
                                      prev.map((item) =>
                                        item.templateKey === templateKey
                                          ? { ...item, defaultDuration: nextDuration }
                                          : item
                                      )
                                    );
                                  }}
                                  placeholder="Estimated duration"
                                  className={darkFieldClass}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/46">Starting Price (optional)</label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={selectedService?.price ?? ''}
                                  onChange={(e) => {
                                    const nextPrice = e.target.value ? Number(e.target.value) : undefined;
                                    setSelectedTemplateServices((prev) =>
                                      prev.map((item) =>
                                        item.templateKey === templateKey
                                          ? { ...item, price: nextPrice }
                                          : item
                                      )
                                    );
                                  }}
                                  placeholder="Starting price"
                                  className={darkFieldClass}
                                />
                              </div>
                              <div className="space-y-1 md:col-span-2">
                                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/46">Customer-Facing Description</label>
                                <textarea
                                  value={selectedService?.description || ''}
                                  onChange={(e) => {
                                    const nextDescription = e.target.value;
                                    setSelectedTemplateServices((prev) =>
                                      prev.map((item) =>
                                        item.templateKey === templateKey
                                          ? { ...item, description: nextDescription }
                                          : item
                                      )
                                    );
                                  }}
                                  rows={3}
                                  placeholder="Describe what the customer can expect from this service."
                                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${darkFieldClass}`}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : primaryServiceCategory ? (
                  <p className="text-xs text-amber-200">
                    Starter templates are not configured for this category yet. Add your services below so onboarding can still continue.
                  </p>
                ) : (
                  <p className="text-xs text-white/48">Select a primary service category to load templates.</p>
                )}
              </div>
              <div className="rounded border border-white/12 bg-white/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-white/88">Custom Services Offered</label>
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
                  <p className="text-xs text-white/48">Add custom services when templates do not include what you offer.</p>
                ) : (
                  <div className="space-y-3">
                    {customServices.map((custom) => (
                      <div key={custom.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/46">Service Name</label>
                            <Input
                              placeholder="Service name *"
                              value={custom.name}
                              className={darkFieldClass}
                              onChange={(e) =>
                                setCustomServices((prev) =>
                                  prev.map((item) => (item.id === custom.id ? { ...item, name: e.target.value } : item))
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/46">Estimated Duration (minutes)</label>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Estimated duration"
                              value={custom.defaultDuration}
                              className={darkFieldClass}
                              onChange={(e) =>
                                setCustomServices((prev) =>
                                  prev.map((item) =>
                                    item.id === custom.id ? { ...item, defaultDuration: e.target.value } : item
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/46">Starting Price (optional)</label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Starting price"
                              value={custom.price}
                              className={darkFieldClass}
                              onChange={(e) =>
                                setCustomServices((prev) =>
                                  prev.map((item) => (item.id === custom.id ? { ...item, price: e.target.value } : item))
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/46">Customer-Facing Description</label>
                            <textarea
                              placeholder="Describe what the customer can expect from this service."
                              value={custom.description}
                              rows={3}
                              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${darkFieldClass}`}
                              onChange={(e) =>
                                setCustomServices((prev) =>
                                  prev.map((item) =>
                                    item.id === custom.id ? { ...item, description: e.target.value } : item
                                  )
                                )
                              }
                            />
                          </div>
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
                {customServiceError ? <p className="mt-2 text-xs text-red-300">{customServiceError}</p> : null}
              </div>
              {businessType === 'Other' && (
                <div className="rounded border border-white/12 bg-white/5 p-3">
                  <label className="block text-sm font-medium mb-1 text-white/88">Custom Business Type</label>
                  <Input
                    value={customBusinessType}
                    onChange={e => setCustomBusinessType(e.target.value)}
                    placeholder="Enter your business type"
                    required
                    className={darkFieldClass}
                  />
                </div>
              )}
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Register'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 
