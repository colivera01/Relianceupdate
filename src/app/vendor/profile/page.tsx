'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, CheckCircle, XCircle, Info, User, Shield, Bell, Camera, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import { useVendorStorage } from '@/hooks/useVendorStorage';
import { VendorProfileUpdateRequest } from '@/types/vendor';
import { buildVendorGrowthSummary } from '@/lib/vendor-growth-summary';
import {
  defaultBusinessHours,
  formatBusinessTime,
  getBusinessHoursStatus,
  normalizeBusinessHours,
  serializeBusinessHours,
  type BusinessHoursDayKey,
  type BusinessHoursSchedule,
} from '@/lib/business-hours';

// BACKEND DEVELOPER NOTES:
// - GET /api/vendor/profile: Fetch vendor profile and settings.
// - All endpoints should be authenticated and scoped to the current vendor.
// - Profile, device, and storage interactions below should stay tied to real APIs.

// DEVELOPER NOTES (Backend API Requirements)
//
// 1. Device Pairing (canonical APIs):
//    - POST /api/device/pairing/request → { code, expiresAt }
//    - POST /api/device/pairing/confirm { code, deviceUid, deviceType, deviceName } → { success, device }
//    - POST /api/device/heartbeat { phoneDeviceUid, deviceMeta } → { status, vendorId, membershipId, role }
//    - GET /api/devices?vendorId=... → list of paired devices
//    - Devices table canonical identity: deviceUid (employeeId kept as legacy fallback)
//
// 2. Media Upload:
//    - POST /api/media/upload { file, jobId, employeeId, deviceId, vendorId, timestamp }
//    - GET /api/media?jobId=... → media for a job
//
// 3. Jobs:
//    - GET /api/jobs?employeeId=... → jobs assigned to employee
//
// All endpoints require authentication and should validate employee/vendor relationship.
//
// End DEVELOPER NOTES

const notificationPreferenceCopy: Record<string, { label: string; description: string; disabled?: boolean }> = {
  job: {
    label: 'Job requests',
    description: 'New job requests and service-record updates',
  },
  review: {
    label: 'Customer reviews',
    description: 'New video-backed customer reviews',
  },
  payout: {
    label: 'Payment updates',
    description: 'Billing and payout tools will be announced before they go live',
    disabled: true,
  },
  support: {
    label: 'Support messages',
    description: 'Important support conversations',
  },
  marketing: {
    label: 'Marketing updates',
    description: 'Optional product and promotional updates',
  },
  updates: {
    label: 'System updates',
    description: 'Reliance platform announcements',
  },
};

const businessHourDayLabels: Record<BusinessHoursDayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
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
    return 'AI Copy Assist is not active in this environment yet. You can still save your profile normally; enable the OpenAI settings later to receive rewrite suggestions.';
  }
  return message;
}

export default function VendorProfilePage() {
  const { data: profile, loading, error, saving, approvalPending, updateProfile, refetch } = useVendorProfile();
  
  // Storage usage
  const vendorId = profile?.id || null;
  const { storage, loading: storageLoading, fetchStorage } = useVendorStorage(vendorId);
  
  // Photo upload ref and state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [vendorCopySuggestion, setVendorCopySuggestion] = useState<VendorCopySuggestion | null>(null);
  const [vendorCopyLoading, setVendorCopyLoading] = useState(false);
  const [vendorCopyError, setVendorCopyError] = useState<string | null>(null);
  const [vendorCopyMessage, setVendorCopyMessage] = useState<string | null>(null);
  
  // Local UI state (not profile data)
  const [localFormData, setLocalFormData] = useState<Partial<VendorProfileUpdateRequest>>({});
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  
  const [reminders, setReminders] = useState({ review: true, invoice: false, maintenance: true, followUp: true });
  const [showReminderToast, setShowReminderToast] = useState(false);
  const [businessHours, setBusinessHours] = useState<BusinessHoursSchedule>(() => defaultBusinessHours());
  const [showBusinessHoursToast, setShowBusinessHoursToast] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({ job: true, review: true, payout: false, support: true, marketing: false, updates: true });
  const [showNotifToast, setShowNotifToast] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    loginNotifications: true,
    sessionTimeout: 30,
    passwordExpiry: 90,
    failedLoginLockout: 5
  });

  // Service type options
  const serviceTypeOptions = [
    'House Cleaning',
    'Deep Cleaning', 
    'Move-in/Move-out Cleaning',
    'Commercial Cleaning',
    'Carpet Cleaning',
    'Window Cleaning',
    'Kitchen Deep Clean',
    'Bathroom Deep Clean',
    'Laundry Services',
    'Pet-friendly Cleaning',
    'Eco-friendly Cleaning',
    'Post-Construction Cleaning',
    'Regular Maintenance',
    'One-time Cleaning',
    'Emergency Cleaning'
  ];

  // Sync local form data with profile data when it loads
  useEffect(() => {
    if (profile) {
      setLocalFormData({
        businessName: profile.businessName ?? '',
        businessType: profile.businessType ?? '',
        category: profile.category ?? '',
        bio: profile.bio ?? '',
        address: profile.address ?? '',
        city: profile.city ?? '',
        state: profile.state ?? '',
        zipCode: profile.zipCode ?? '',
        foundedYear: profile.foundedYear ?? undefined,
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        website: profile.website ?? '',
        licenseNumber: profile.licenseNumber ?? '',
        insuranceProvider: profile.insuranceProvider ?? '',
        insuranceExpiry: profile.insuranceExpiry ?? undefined,
        insuranceStatus: profile.insuranceStatus,
        bondingStatus: profile.bondingStatus,
        emergencyContact: profile.emergencyContact ?? '',
        responseTimeSettings: profile.responseTimeSettings ?? '',
        profilePhoto: profile.profilePhoto ?? '',
        serviceTypes: profile.serviceTypes ?? [],
        specializations: profile.specializations ?? [],
        serviceAreas: profile.serviceAreas ?? [],
        businessHoursJson: profile.businessHoursJson ?? null,
      });
      setBusinessHours(normalizeBusinessHours(profile.businessHoursJson || null));
      
      // Initialize reminders from profile
      
      // Refresh storage when profile loads
      if (profile.id) {
        fetchStorage();
      }
      if (profile.reminders) {
        setReminders({
          review: profile.reminders.review ?? true,
          invoice: profile.reminders.invoice ?? false,
          maintenance: profile.reminders.maintenance ?? true,
          followUp: profile.reminders.followUp ?? true,
        });
      }
      
      // Initialize notificationSettings from profile
      if (profile.notificationSettings) {
        setNotificationSettings({
          job: profile.notificationSettings.job ?? true,
          review: profile.notificationSettings.review ?? true,
          payout: profile.notificationSettings.payout ?? false,
          support: profile.notificationSettings.support ?? true,
          marketing: profile.notificationSettings.marketing ?? false,
          updates: profile.notificationSettings.updates ?? true,
        });
      }
      
      // Initialize securitySettings from profile
      setSecuritySettings({
        twoFactorEnabled: profile.twoFactorEnabled ?? false,
        loginNotifications: profile.loginNotifications ?? true,
        sessionTimeout: profile.sessionTimeout ?? 30,
        passwordExpiry: profile.passwordExpiry ?? 90,
        failedLoginLockout: profile.failedLoginLockout ?? 5,
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setLocalFormData(prev => ({
      ...prev,
      [name]:
        name === 'foundedYear'
          ? (value ? Number(value) : undefined)
          : value,
    }));
  };

  const handleAddressInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalFormData(prev => ({ ...prev, address: value }));
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPhoto(true);

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/vendor/profile/photo', {
        method: 'POST',
        body: formData,
      });

      const payload = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : `Upload failed with status ${res.status}`;
        throw new Error(message);
      }

      const { url } = payload as { url: string };

      // Update local form state so the preview updates immediately
      setLocalFormData(prev => ({ ...prev, profilePhoto: url }));
      await refetch();
    } catch (err) {
      console.error('Error uploading photo', err);
      alert(err instanceof Error ? err.message : 'Profile photo upload failed.');
    } finally {
      setUploadingPhoto(false);
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    try {
      await updateProfile(localFormData);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (err) {
      // Error already handled in hook
      console.error('Error updating profile:', err);
    }
  };

  const handleSaveReminders = async () => {
    try {
      await updateProfile({
        reminders: {
          review: reminders.review,
          invoice: reminders.invoice,
          maintenance: reminders.maintenance,
          followUp: reminders.followUp,
        },
      });
      setShowReminderToast(true);
      setTimeout(() => setShowReminderToast(false), 2000);
    } catch (err) {
      console.error('Error saving reminders:', err);
    }
  };

  const updateBusinessHourDay = (
    dayKey: BusinessHoursDayKey,
    updates: Partial<BusinessHoursSchedule['days'][number]>
  ) => {
    setBusinessHours((current) => ({
      ...current,
      days: current.days.map((day) => (day.day === dayKey ? { ...day, ...updates } : day)),
    }));
  };

  const handleSaveBusinessHours = async () => {
    try {
      const serialized = serializeBusinessHours(businessHours);
      await updateProfile({ businessHoursJson: serialized });
      setLocalFormData((current) => ({ ...current, businessHoursJson: serialized }));
      setShowBusinessHoursToast(true);
      setTimeout(() => setShowBusinessHoursToast(false), 2000);
    } catch (err) {
      console.error('Error saving business hours:', err);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      await updateProfile({
        notificationSettings: {
          job: notificationSettings.job,
          review: notificationSettings.review,
          payout: notificationSettings.payout,
          support: notificationSettings.support,
          marketing: notificationSettings.marketing,
          updates: notificationSettings.updates,
        },
      });
      setShowNotifToast(true);
      setTimeout(() => setShowNotifToast(false), 2000);
    } catch (err) {
      console.error('Error saving notifications:', err);
    }
  };
  
  const handleSaveSecuritySettings = async () => {
    try {
      const normalizedSessionTimeout = Math.min(
        1440,
        Math.max(5, Math.round(Number(securitySettings.sessionTimeout) || 30))
      );
      await updateProfile({
        loginNotifications: securitySettings.loginNotifications,
        sessionTimeout: normalizedSessionTimeout,
      });
      setSecuritySettings((current) => ({
        ...current,
        sessionTimeout: normalizedSessionTimeout,
      }));
      // Close modal after save
      setShowSecurityModal(false);
    } catch (err) {
      console.error('Error saving security settings:', err);
    }
  };

  const businessDisplayName =
    String(localFormData.businessName || profile?.businessName || profile?.name || 'Your business').trim() ||
    'Your business';
  const businessInitials = businessDisplayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'RB';
  const growthSummary = buildVendorGrowthSummary({
    vendorId: profile?.id || null,
    businessName: profile?.businessName || null,
    onboarding: profile?.onboarding || null,
    publishedReviewCount: Number(profile?.ratingCount || 0),
    approvedServiceVideoCount: 0,
  });
  const vendorCopyTrustSignals = [
    profile?.membershipStatus === 'ACTIVE'
      ? 'Vendor account is approved on Reliance.'
      : 'Vendor account is still awaiting approval.',
    profile?.isPubliclyListed
      ? 'Business profile is currently visible to customers on Reliance.'
      : 'Business profile is not public yet.',
    Number(profile?.publishedServiceCount || 0) > 0
      ? `${Number(profile?.publishedServiceCount || 0)} published services offered help customers find this business.`
      : 'No services are publicly published yet.',
    Number(profile?.ratingCount || 0) > 0
      ? `${Number(profile?.ratingCount || 0)} public customer reviews are visible.`
      : 'No public customer reviews are visible yet.',
  ].filter(Boolean) as string[];
  const savedBusinessHoursStatus = getBusinessHoursStatus(localFormData.businessHoursJson ? businessHours : null);
  const editedBusinessHoursStatus = getBusinessHoursStatus(businessHours);

  const requestVendorCopySuggestion = async () => {
    if (!vendorId) return;
    setVendorCopyLoading(true);
    setVendorCopyError(null);
    setVendorCopyMessage(null);
    try {
      const response = await fetch('/api/vendor/copy-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendorId,
          mode: 'profile_bio',
          businessName: businessDisplayName,
          category: String(localFormData.category || profile?.category || '').trim() || null,
          city: String(localFormData.city || profile?.city || '').trim() || null,
          state: String(localFormData.state || profile?.state || '').trim() || null,
          currentHeadline: businessDisplayName,
          currentDescription: String(localFormData.bio || profile?.bio || ''),
          currentBullets: Array.isArray(localFormData.serviceTypes)
            ? localFormData.serviceTypes.slice(0, 5)
            : [],
          trustSignals: vendorCopyTrustSignals.slice(0, 6),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      setVendorCopySuggestion(json?.suggestion || null);
      setVendorCopyMessage(json?.message || 'AI vendor copy guidance generated.');
    } catch (err) {
      console.error('Error generating vendor copy suggestion:', err);
      setVendorCopyError(friendlyAiCopyError(err));
    } finally {
      setVendorCopyLoading(false);
    }
  };

  return (
    <div className="text-white">
      <div className="w-full">
      <div className="mb-6 rounded-3xl border border-white/10 bg-slate-950/75 p-5 shadow-[0_20px_70px_rgba(3,8,20,0.28)]">
        <h1 className="text-3xl font-semibold text-white">Public Credibility Center</h1>
        <p className="mt-1 text-sm text-slate-300">
          Manage the business details, public signals, and account settings that shape how customers experience your business.
        </p>
      </div>

      {loading && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-6 shadow-sm">
            <div className="mb-4 h-6 w-52 animate-pulse rounded bg-white/10" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-24 animate-pulse rounded-xl bg-white/8" />
              <div className="h-24 animate-pulse rounded-xl bg-white/8" />
            </div>
            <p className="mt-4 text-sm text-slate-300">Loading your vendor profile...</p>
          </div>
        </div>
      )}

      {error && !loading && !profile && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <XCircle className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={refetch}>
              Try Again
            </Button>
          </div>
        </div>
      )}
      
      {!loading && !error && profile && (
        <main className="flex flex-col xl:flex-row gap-8">
        {/* Profile Form */}
        <section className="flex flex-1 max-w-2xl flex-col gap-6">
          <Card className="order-2 border border-blue-400/20 bg-slate-950/75 text-white shadow-[0_20px_70px_rgba(3,8,20,0.22)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-white">What customers see</CardTitle>
              <p className="text-sm leading-6 text-slate-300">
                Use this summary to understand whether customers can find your business and which public signals are helping them trust you.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {growthSummary.metrics.slice(0, 4).map((metric) => (
                  <div key={metric.label} className="min-w-0 rounded-xl border border-blue-300/20 bg-slate-900/78 p-4">
                    <p className="break-words text-xs font-semibold uppercase tracking-[0.14em] text-blue-100/70">{metric.label}</p>
                    <p className="mt-2 break-words text-lg font-semibold text-white">{metric.value}</p>
                    <p className="mt-2 break-words text-sm leading-6 text-slate-300">{metric.detail}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-blue-300/20 bg-slate-900/78 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100/70">Public profile status</p>
                <p className="mt-2 text-lg font-semibold text-white">{growthSummary.visibilityTitle}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{growthSummary.visibilityDetail}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {growthSummary.publicProfileHref ? (
                    <Button asChild size="sm" className="bg-[var(--reliance-blue)] text-white hover:bg-[#1a58db]">
                      <Link href={growthSummary.publicProfileHref}>Open Public Profile</Link>
                    </Button>
                  ) : null}
                  <Button asChild size="sm" variant="outline">
                    <Link href="/vendor/services">Manage public services</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Enhanced Profile Information Card */}
          <Card className="order-1 border border-blue-400/20 bg-slate-950/75 text-white shadow-[0_20px_70px_rgba(3,8,20,0.22)] [&_input]:border-white/10 [&_input]:bg-slate-900/75 [&_input]:text-white [&_input]:placeholder:text-slate-500 [&_label]:!text-blue-100 [&_p]:!text-slate-300 [&_select]:border-white/10 [&_select]:bg-slate-900/75 [&_select]:text-white [&_textarea]:border-white/10 [&_textarea]:bg-slate-900/75 [&_textarea]:text-white [&_textarea]:placeholder:text-slate-500">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-blue-300/20 bg-blue-500/12 p-2">
                  <User className="w-6 h-6 text-blue-100" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Business Profile</CardTitle>
                  <p className="text-sm text-slate-300">Manage saved business information customers and staff rely on</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6 rounded-lg border border-blue-300/20 bg-blue-500/10 p-3 text-sm leading-6 text-blue-100">
                Profile fields on this page save to your vendor profile. Future-only launch features are marked where they appear.
              </div>
              <form className="space-y-6">
                {/* Profile Photo Section */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-gray-700">Business Profile Photo</label>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="relative shrink-0">
                      {localFormData.profilePhoto || profile.profilePhoto ? (
                        <div className="flex h-80 w-full max-w-[260px] items-center justify-center overflow-hidden rounded-3xl border border-blue-300/25 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-2 shadow-[0_18px_40px_rgba(3,8,20,0.28)]">
                          <img
                            src={localFormData.profilePhoto || profile.profilePhoto || ''}
                            alt="Business Profile"
                            className="h-full w-full rounded-2xl object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-80 w-full max-w-[260px] items-center justify-center rounded-3xl border border-blue-300/25 bg-gradient-to-br from-slate-800 to-blue-950 text-4xl font-semibold text-blue-100 shadow-[0_18px_40px_rgba(3,8,20,0.28)]">
                          {businessInitials}
                        </div>
                      )}

                      {/* Hidden file input */}
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handlePhotoSelected}
                      />

                      <button
                        type="button"
                        className="absolute -bottom-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-950/30 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto || (storage?.isOverLimit ?? false)}
                        title={storage?.isOverLimit ? 'Storage limit reached. Delete existing media to upload new files.' : undefined}
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-2 text-sm leading-6 text-slate-300">Upload a professional photo of your business, team, or workspace. Customers will use it as a first impression when your public profile is live.</p>
                      <p className="mb-3 text-xs leading-5 text-slate-400">Vertical job-site photos work well here. Reliance fits the full image inside a polished preview instead of cutting off important details.</p>
                      <button
                        type="button"
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto || (storage?.isOverLimit ?? false)}
                        title={storage?.isOverLimit ? 'Storage limit reached. Delete existing media to upload new files.' : undefined}
                      >
                        {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
                      </button>
                      {storage?.isOverLimit && (
                        <p className="text-xs text-red-600 mt-1">Uploads disabled - storage full</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Business Name</label>
                    <Input 
                      name="businessName" 
                      value={localFormData.businessName || ''} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Business Type</label>
                    <Input 
                      name="businessType" 
                      value={localFormData.businessType || ''} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Service Category</label>
                  <Input 
                    name="category" 
                    value={localFormData.category || ''} 
                    onChange={handleChange}
                    placeholder="e.g., Cleaning, Landscaping, Plumbing"
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">The primary category for your business</p>
                </div>

                {/* Business Bio Section */}
                <div className="mb-6">
                  <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Business Bio</label>
                      <p className="mt-1 text-xs text-slate-400">
                        Write it yourself, or let AI improve the same bio using the business details you already shared.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-blue-300/20 bg-slate-900/80 text-white hover:bg-slate-800"
                      onClick={requestVendorCopySuggestion}
                      disabled={vendorCopyLoading || !vendorId}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {vendorCopyLoading
                        ? 'Improving...'
                        : vendorCopySuggestion
                          ? 'Improve Again'
                          : 'Improve with AI'}
                    </Button>
                  </div>
                  <textarea
                    name="bio"
                    value={localFormData.bio || ''}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Tell customers about your business, experience, and what makes you unique..."
                  />
                  <p className="text-sm text-gray-500 mt-1">Shown on your public profile and job listings.</p>
                  {vendorCopyMessage ? (
                    <div className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                      {vendorCopyMessage}
                    </div>
                  ) : null}
                  {vendorCopyError ? (
                    <div className="mt-3 rounded-lg border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {vendorCopyError}
                    </div>
                  ) : null}
                  {vendorCopySuggestion ? (
                    <div className="mt-4 rounded-2xl border border-blue-300/20 bg-slate-900/78 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100/70">AI suggested bio</p>
                          <p className="mt-1 text-xs text-slate-400">
                            Review it first. Using the suggestion replaces the text in your Business Bio field.
                          </p>
                        </div>
                        <Badge variant="outline">
                          {vendorCopySuggestion.confidence.charAt(0).toUpperCase() + vendorCopySuggestion.confidence.slice(1)} confidence
                        </Badge>
                      </div>
                      <p className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 p-4 text-sm leading-6 text-slate-200">
                        {vendorCopySuggestion.recommendedDescription}
                      </p>
                      {vendorCopySuggestion.riskyClaims.length > 0 ? (
                        <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
                          <span className="font-semibold">AI caution:</span> {vendorCopySuggestion.riskyClaims.join(' ')}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          className="bg-blue-600 text-white hover:bg-blue-700"
                          onClick={() =>
                            setLocalFormData((current) => ({
                              ...current,
                              bio: vendorCopySuggestion.recommendedDescription,
                            }))
                          }
                        >
                          Use This Bio
                        </Button>
                        <p className="text-xs text-slate-400">
                          You can still edit the bio manually after applying it.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Business specialties section */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-gray-700">Business Specialties</label>
                  <p className="text-sm text-gray-600 mb-3">
                    Select broad specialties for your profile. Customer-visible services offered are managed from Services Offered.
                  </p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {serviceTypeOptions.map((serviceType) => {
                      const isSelected = (localFormData.serviceTypes || []).includes(serviceType);

                      return (
                        <label
                          key={serviceType}
                          htmlFor={serviceType}
                          className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                            isSelected
                              ? 'border-blue-300/70 bg-blue-500/20 text-white shadow-[0_0_0_1px_rgba(96,165,250,0.28),0_12px_28px_rgba(37,99,235,0.18)]'
                              : 'border-white/10 bg-slate-900/60 text-slate-300 hover:border-blue-300/35 hover:bg-blue-500/10 hover:text-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            id={serviceType}
                            checked={isSelected}
                            onChange={(e) => {
                              const currentTypes = localFormData.serviceTypes || [];
                              if (e.target.checked) {
                                setLocalFormData(prev => ({
                                  ...prev,
                                  serviceTypes: [...currentTypes, serviceType]
                                }));
                              } else {
                                setLocalFormData(prev => ({
                                  ...prev,
                                  serviceTypes: currentTypes.filter(type => type !== serviceType)
                                }));
                              }
                            }}
                            className="sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                              isSelected
                                ? 'border-blue-200 bg-blue-500 text-white'
                                : 'border-slate-500 bg-slate-950/80'
                            }`}
                          >
                            {isSelected ? <CheckCircle className="h-3.5 w-3.5" /> : null}
                          </span>
                          <span className="leading-5">{serviceType}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">Selected: {(localFormData.serviceTypes || []).length} specialties</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Business Address</label>
                  <Input
                    name="address"
                    value={localFormData.address || ''}
                    onChange={handleAddressInput}
                    autoComplete="street-address"
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter your business street address"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the address manually and save it to your profile. Street autocomplete is not connected in this environment yet.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">City</label>
                    <Input 
                      name="city" 
                      value={localFormData.city || ''} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">State</label>
                    <Input 
                      name="state" 
                      value={localFormData.state || ''} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">ZIP Code</label>
                    <Input 
                      name="zipCode" 
                      value={localFormData.zipCode || ''} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Founded Year</label>
                    <Input 
                      name="foundedYear" 
                      type="number"
                      value={localFormData.foundedYear || ''} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                {profile.yearsInBusiness !== null && (
                  <div className="text-sm text-gray-600">
                    Years in Business: <span className="font-medium">{profile.yearsInBusiness}</span> (calculated from founded year)
                  </div>
                )}
                <div className="text-sm text-gray-600">
                  Rating:{" "}
                  <span className="font-medium">
                    {typeof profile.ratingAverage === "number" ? profile.ratingAverage.toFixed(1) : "0.0"}
                  </span>{" "}
                  ({Number(profile.ratingCount || 0)} review{Number(profile.ratingCount || 0) === 1 ? "" : "s"})
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Email</label>
                    <Input 
                      name="email" 
                      type="email"
                      value={localFormData.email || ''} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Phone</label>
                    <Input 
                      name="phone" 
                      value={localFormData.phone || ''} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Website</label>
                    <Input 
                      name="website" 
                      type="url"
                      value={localFormData.website || ''} 
                      onChange={handleChange}
                      placeholder="https://example.com"
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Emergency Contact</label>
                    <Input 
                      name="emergencyContact" 
                      value={localFormData.emergencyContact || ''} 
                      onChange={handleChange}
                      placeholder="Name and phone number"
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Response Time Settings</label>
                    <Input 
                      name="responseTimeSettings" 
                      value={localFormData.responseTimeSettings || ''} 
                      onChange={handleChange}
                      placeholder="e.g., Within 2 hours"
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>




                {/* Insurance & Bonding */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="insuranceStatus"
                      checked={localFormData.insuranceStatus || false}
                      onChange={(e) => setLocalFormData(prev => ({...prev, insuranceStatus: e.target.checked}))}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="text-sm font-medium text-gray-700">Insured</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="bondingStatus"
                      checked={localFormData.bondingStatus || false}
                      onChange={(e) => setLocalFormData(prev => ({...prev, bondingStatus: e.target.checked}))}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="text-sm font-medium text-gray-700">Bonded</label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">License Number</label>
                    <Input 
                      name="licenseNumber" 
                      value={localFormData.licenseNumber || ''} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Insurance Provider</label>
                    <Input 
                      name="insuranceProvider" 
                      value={localFormData.insuranceProvider || ''} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Policy Expiration Date</label>
                    <Input 
                      name="insuranceExpiry" 
                      type="date"
                      value={localFormData.insuranceExpiry ? new Date(localFormData.insuranceExpiry).toISOString().split('T')[0] : ''} 
                      onChange={(e) => setLocalFormData(prev => ({...prev, insuranceExpiry: e.target.value ? new Date(e.target.value).toISOString() : undefined}))}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Total Employees</label>
                    <Input 
                      name="totalEmployees" 
                      type="number" 
                      value={profile.totalEmployees} 
                      readOnly
                      className="border-gray-300 bg-gray-50 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Calculated from your employee list</p>
                  </div>
                </div>

                {showSuccessToast && (
                  <div className="p-3 bg-green-100 border border-green-300 rounded-lg text-green-700 font-medium">
                    ✓ Profile updated successfully!
                  </div>
                )}

                <Button 
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200" 
                  onClick={handleSave} 
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Save Profile
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card className="order-3 border border-blue-400/20 bg-slate-950/75 text-white shadow-[0_20px_70px_rgba(3,8,20,0.22)]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/12 p-2">
                  <Settings className="h-6 w-6 text-emerald-100" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Business Hours</CardTitle>
                  <p className="text-sm text-slate-300">
                    Set the weekly hours customers see on browse and provider cards.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-slate-900/75 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100/70">
                  Current customer label
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {savedBusinessHoursStatus.configured ? editedBusinessHoursStatus.label : savedBusinessHoursStatus.label}
                </p>
                {savedBusinessHoursStatus.configured && editedBusinessHoursStatus.todayLabel ? (
                  <p className="mt-1 text-sm text-slate-300">{editedBusinessHoursStatus.todayLabel}</p>
                ) : (
                  <p className="mt-1 text-sm text-slate-300">Customers will see that hours are not listed yet.</p>
                )}
              </div>
              <div className="grid gap-3">
                {businessHours.days.map((day) => (
                  <div
                    key={day.day}
                    className="grid gap-3 rounded-xl border border-blue-300/20 bg-slate-900/75 p-3 sm:grid-cols-[1fr_auto_auto]"
                  >
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(event) => updateBusinessHourDay(day.day, { enabled: event.target.checked })}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className="grid h-5 w-5 shrink-0 place-items-center rounded border border-blue-200/50 bg-slate-950/80 shadow-inner transition peer-checked:border-blue-200 peer-checked:bg-blue-500 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-300/50"
                      >
                        {day.enabled ? <span className="h-2 w-2 rounded-sm bg-white" /> : null}
                      </span>
                      <span className="font-semibold text-white">{businessHourDayLabels[day.day]}</span>
                      <span className="text-sm text-slate-400">
                        {day.enabled ? `${formatBusinessTime(day.open)}-${formatBusinessTime(day.close)}` : 'Closed'}
                      </span>
                    </label>
                    <label className="text-sm text-slate-300">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-blue-100/60">Open</span>
                      <input
                        type="time"
                        value={day.open}
                        disabled={!day.enabled}
                        onChange={(event) => updateBusinessHourDay(day.day, { open: event.target.value })}
                        className="h-11 w-full min-w-[9.75rem] rounded-lg border border-white/10 bg-slate-950/80 px-3 pr-4 text-base leading-none text-white disabled:opacity-50 sm:w-[9.75rem]"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-blue-100/60">Close</span>
                      <input
                        type="time"
                        value={day.close}
                        disabled={!day.enabled}
                        onChange={(event) => updateBusinessHourDay(day.day, { close: event.target.value })}
                        className="h-11 w-full min-w-[9.75rem] rounded-lg border border-white/10 bg-slate-950/80 px-3 pr-4 text-base leading-none text-white disabled:opacity-50 sm:w-[9.75rem]"
                      />
                    </label>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={handleSaveBusinessHours}
                  disabled={saving}
                  className="bg-[var(--reliance-blue)] text-white hover:bg-[#1a58db]"
                >
                  Save Business Hours
                </Button>
                {showBusinessHoursToast ? (
                  <span className="rounded-lg border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100">
                    Hours saved.
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>
          {/* Enhanced Reminders & Notifications Card */}
          <Card className="order-4 border border-blue-400/20 bg-slate-950/75 text-white shadow-[0_20px_70px_rgba(3,8,20,0.22)]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-blue-300/20 bg-blue-500/12 p-2">
                  <Bell className="h-6 w-6 text-blue-100" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Reminder Preferences</CardTitle>
                  <p className="text-sm text-slate-300">Save communication preferences for supported launch workflows</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="mb-4 text-sm leading-6 text-slate-300">
                  These preferences are saved to your profile. Reliance only sends supported launch communications; delayed automation may be limited.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-blue-300/20 bg-slate-900/75 p-3 transition-colors hover:bg-slate-800">
                    <input 
                      type="checkbox" 
                      checked={reminders.review} 
                      onChange={e => setReminders(r => ({ ...r, review: e.target.checked }))}
                      className="h-4 w-4 accent-blue-500"
                    />
                    <div>
                      <div className="font-medium text-white">Review Requests</div>
                      <div className="text-sm text-slate-300">Request reviews after eligible completed jobs.</div>
                    </div>
                    <Info className="ml-auto h-4 w-4 text-blue-100/55" />
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-blue-300/20 bg-slate-900/75 p-3 transition-colors hover:bg-slate-800">
                    <input 
                      type="checkbox" 
                      checked={reminders.invoice} 
                      onChange={e => setReminders(r => ({ ...r, invoice: e.target.checked }))}
                      className="h-4 w-4 accent-blue-500"
                    />
                    <div>
                      <div className="font-medium text-white">Follow-up Reminders</div>
                      <div className="text-sm text-slate-300">Save your preference for future post-service follow-up reminders.</div>
                    </div>
                    <Info className="ml-auto h-4 w-4 text-blue-100/55" />
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-blue-300/20 bg-slate-900/75 p-3 transition-colors hover:bg-slate-800">
                    <input 
                      type="checkbox" 
                      checked={reminders.maintenance} 
                      onChange={e => setReminders(r => ({ ...r, maintenance: e.target.checked }))}
                      className="h-4 w-4 accent-blue-500"
                    />
                    <div>
                      <div className="font-medium text-white">Maintenance Alerts</div>
                      <div className="text-sm text-slate-300">Save your preference for future maintenance follow-up prompts.</div>
                    </div>
                    <Info className="ml-auto h-4 w-4 text-blue-100/55" />
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-blue-300/20 bg-slate-900/75 p-3 transition-colors hover:bg-slate-800">
                    <input 
                      type="checkbox" 
                      checked={reminders.followUp} 
                      onChange={e => setReminders(r => ({ ...r, followUp: e.target.checked }))}
                      className="h-4 w-4 accent-blue-500"
                    />
                    <div>
                      <div className="font-medium text-white">Follow-up Calls</div>
                      <div className="text-sm text-slate-300">Save your preference for post-service call reminders.</div>
                    </div>
                    <Info className="ml-auto h-4 w-4 text-blue-100/55" />
                  </label>
                </div>
                <Button 
                  onClick={handleSaveReminders} 
                  className="w-fit bg-[var(--reliance-blue)] text-white hover:bg-[#1a58db]"
                >
                  Save Reminder Settings
                </Button>
                {showReminderToast && (
                  <div className="mt-2 p-3 bg-green-100 border border-green-300 rounded-lg text-green-700 font-medium">
                    ✓ Reminder settings saved successfully!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Notification Settings Card */}
          <Card className="order-5 border border-blue-400/20 bg-slate-950/75 text-white shadow-[0_20px_70px_rgba(3,8,20,0.22)]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-blue-300/20 bg-blue-500/12 p-2">
                  <Bell className="h-6 w-6 text-blue-100" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Notification Preferences</CardTitle>
                  <p className="text-sm text-slate-300">Manage saved notification settings for active launch features</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(notificationSettings).map(([key, value]) => {
                  const copy = notificationPreferenceCopy[key] ?? {
                    label: key.replace(/([A-Z])/g, ' $1').trim(),
                    description: 'Notification preference',
                  };
                  return (
                  <label
                    key={key}
                    className={`flex items-center gap-3 rounded-lg border border-blue-300/20 bg-slate-900/75 p-3 transition-colors ${
                      copy.disabled ? 'cursor-not-allowed opacity-55 grayscale' : 'cursor-pointer hover:bg-slate-800'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      checked={value} 
                      onChange={e => setNotificationSettings(s => ({ ...s, [key]: e.target.checked }))}
                      disabled={copy.disabled}
                      className="h-4 w-4 accent-blue-500"
                    />
                    <div>
                      <div className="font-medium text-white">{copy.label}</div>
                      <div className="text-sm text-slate-300">{copy.description}</div>
                    </div>
                  </label>
                  );
                })}
              </div>
              <Button 
                onClick={handleSaveNotifications} 
                className="mt-4 w-fit bg-[var(--reliance-blue)] text-white hover:bg-[#1a58db]"
              >
                Save Notification Settings
              </Button>
              {showNotifToast && (
                <div className="mt-2 p-3 bg-green-100 border border-green-300 rounded-lg text-green-700 font-medium">
                  ✓ Notification settings saved successfully!
                </div>
              )}
            </CardContent>
          </Card>

        </section>

        {/* Enhanced Right Panel */}
        <aside className="w-full xl:w-80 space-y-6">
          {/* Enhanced Security Card */}
          <Card className="border border-blue-400/20 bg-slate-950/75 text-white shadow-[0_20px_70px_rgba(3,8,20,0.22)]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-blue-300/20 bg-blue-500/12 p-2">
                  <Shield className="h-5 w-5 text-blue-100" />
                </div>
                <CardTitle className="text-lg text-white">Account Protection</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm text-slate-200">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Vendor sign-in protection</span>
                    <Badge className="border border-blue-300/20 bg-blue-500/15 text-blue-100">
                      Active
                    </Badge>
                  </div>
                  <p className="text-xs leading-5 text-slate-300">
                    Review email sign-in alerts and dashboard timeout rules. These settings protect dashboard,
                    team, and job access.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">Login notifications</span>
                  <Badge className={(profile?.loginNotifications ?? securitySettings.loginNotifications) ? 'border border-emerald-300/25 bg-emerald-500/15 text-emerald-100' : 'border border-slate-500/25 bg-slate-800 text-slate-200'}>
                    {(profile?.loginNotifications ?? securitySettings.loginNotifications) ? 'On' : 'Off'}
                  </Badge>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full border-white/15 bg-slate-900 text-white hover:bg-slate-800"
                  onClick={() => setShowSecurityModal(true)}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Security Settings
                </Button>
              </div>
            </CardContent>
          </Card>


        </aside>
      </main>
      )}
      </div>
      {/* Security Settings Modal */}
      <Dialog open={showSecurityModal} onOpenChange={setShowSecurityModal}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-600" />
              Security Settings
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Vendor Sign-In Protection</span>
                <p className="text-xs text-gray-500">
                  Email-code verification is active for vendor sign-ins. Add or manage passkeys from Secure Account.
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                Active
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-sm font-medium">Email login alerts</span>
                <p className="mt-1 text-xs text-slate-500">
                  Send an email alert when this account signs in to vendor tools.
                </p>
              </div>
              <input 
                type="checkbox" 
                checked={securitySettings.loginNotifications}
                onChange={(e) => setSecuritySettings(s => ({ ...s, loginNotifications: e.target.checked }))}
                className="mt-1 h-4 w-4 accent-blue-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Vendor session timeout (minutes)</label>
              <Input 
                type="number" 
                min={5}
                max={1440}
                value={securitySettings.sessionTimeout}
                onChange={(e) => setSecuritySettings(s => ({ ...s, sessionTimeout: Number(e.target.value) }))}
                className="w-24"
              />
              <p className="mt-1 text-xs text-slate-500">
                Vendor access expires after this many minutes from sign-in. Minimum 5 minutes.
              </p>
            </div>
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSaveSecuritySettings}
            >
              Save Security Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
} 
