'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, CheckCircle, XCircle, Info, User, Shield, Bell, Smartphone as DeviceIcon, Activity as ActivityIcon, Camera, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import { useVendorDevices } from '@/hooks/useVendorDevices';
import { useVendorStorage } from '@/hooks/useVendorStorage';
import { VendorProfileUpdateRequest } from '@/types/vendor';
import VendorOnboardingStatusPanel from '@/components/vendor/VendorOnboardingStatusPanel';
import { buildVendorGrowthSummary } from '@/lib/vendor-growth-summary';

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

export default function VendorProfilePage() {
  const { data: profile, loading, error, saving, approvalPending, updateProfile, refetch } = useVendorProfile();
  
  const {
    devices,
    loading: devicesLoading,
    error: devicesError,
    pairing,
    pairingLoading,
    fetchDevices,
    requestPairingCode,
    revokeDevice,
    setPairing,
  } = useVendorDevices();

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
  const [showPairModal, setShowPairModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [pairingSuccess, setPairingSuccess] = useState(false);
  const [pairingInviteEmail, setPairingInviteEmail] = useState('');
  const [pairingInvitePhone, setPairingInvitePhone] = useState('');
  const [pairingBaseUrlOverride, setPairingBaseUrlOverride] = useState('');
  const [pairingInviteFeedback, setPairingInviteFeedback] = useState<string | null>(null);
  
  const [reminders, setReminders] = useState({ review: true, invoice: false, maintenance: true, followUp: true });
  const [showReminderToast, setShowReminderToast] = useState(false);
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
      });
      
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

  // Countdown effect - derive from pairing.expiresAt
  useEffect(() => {
    if (!pairing) {
      setCountdown(null);
      return;
    }
    
    const expires = new Date(pairing.expiresAt).getTime();
    
    const update = () => {
      const remaining = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setCountdown(remaining);
    };
    
    update(); // Initial update
    const id = setInterval(update, 1000);
    
    return () => clearInterval(id);
  }, [pairing]);

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
      await updateProfile({
        loginNotifications: securitySettings.loginNotifications,
        sessionTimeout: securitySettings.sessionTimeout,
      });
      // Close modal after save
      setShowSecurityModal(false);
    } catch (err) {
      console.error('Error saving security settings:', err);
    }
  };

  const handleOpenPairModal = async () => {
    setPairingSuccess(false);
    setPairingInviteFeedback(null);
    setPairing(null);
    setCountdown(null);
    setShowPairModal(true);
  };

  const handleStartPairing = async (sendInvite: boolean) => {
    try {
      setPairingSuccess(false);
      setPairingInviteFeedback(null);
      const result = await requestPairingCode({
        inviteEmail: sendInvite ? pairingInviteEmail : undefined,
        invitePhone: sendInvite ? pairingInvitePhone : undefined,
        baseUrlOverride: pairingBaseUrlOverride,
      });

      const feedback = sendInvite
        ? result.inviteDelivery?.summaryMessage ||
          (result.inviteDelivery?.email?.attempted || result.inviteDelivery?.sms?.attempted
            ? "Invite sending was attempted. If it did not arrive, use the backup link and code below."
            : "No invite channel was available. Use the backup link and code below.")
        : "Backup link and pairing code ready to share manually.";
      setPairingInviteFeedback(feedback);
    } catch (err) {
      console.error('Error requesting pairing code:', err);
      setPairingInviteFeedback(err instanceof Error ? err.message : 'Failed to create pairing invite.');
    }
  };

  const runtimeIsLocalOnly =
    typeof window !== 'undefined' &&
    /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = String(window.localStorage.getItem('reliance_pairing_base_url_override') || '').trim();
    if (saved) {
      setPairingBaseUrlOverride(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const normalized = pairingBaseUrlOverride.trim();
    if (normalized) {
      window.localStorage.setItem('reliance_pairing_base_url_override', normalized);
    } else {
      window.localStorage.removeItem('reliance_pairing_base_url_override');
    }
  }, [pairingBaseUrlOverride]);

  // Refresh device list and pairing status while pairing modal is open.
  useEffect(() => {
    if (!showPairModal || !pairing?.code || pairingSuccess) {
      return;
    }

    let isCancelled = false;
    const poll = async () => {
      try {
        const [statusRes] = await Promise.all([
          fetch(`/api/device/pairing/status?code=${encodeURIComponent(pairing.code)}`, {
            cache: 'no-store',
          }),
          fetchDevices(),
        ]);
        const statusJson = await statusRes.json().catch(() => ({}));
        if (isCancelled) return;

        if (statusRes.ok && statusJson?.status === 'paired') {
          setPairingSuccess(true);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Error polling pairing status:', error);
        }
      }
    };

    void poll();
    const interval = setInterval(() => {
      void poll();
    }, 2000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [fetchDevices, pairing?.code, pairingSuccess, showPairModal]);

  // Auto-close vendor pairing modal after success, even when an existing device was re-paired.
  useEffect(() => {
    if (!showPairModal || !pairingSuccess) {
      return;
    }
    const timer = setTimeout(() => {
      setShowPairModal(false);
      setPairing(null);
      setCountdown(null);
      setPairingSuccess(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [pairingSuccess, setPairing, showPairModal]);

  // Refresh device list when pairing modal closes
  useEffect(() => {
    if (!showPairModal) {
      fetchDevices();
    }
  }, [showPairModal, fetchDevices]);

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
      ? 'Business profile is currently visible as public proof on Reliance.'
      : 'Business profile is not public yet.',
    Number(profile?.publishedServiceCount || 0) > 0
      ? `${Number(profile?.publishedServiceCount || 0)} published services offered help customers find this business.`
      : 'No services are publicly published yet.',
    Number(profile?.ratingCount || 0) > 0
      ? `${Number(profile?.ratingCount || 0)} public customer reviews are visible.`
      : 'No public customer reviews are visible yet.',
  ].filter(Boolean) as string[];

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
      setVendorCopyError(
        err instanceof Error ? err.message : 'Failed to generate AI copy guidance'
      );
    } finally {
      setVendorCopyLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="w-full">
      <div className="mb-6 rounded-2xl border border-white/60 bg-white/85 p-5 shadow-sm">
        <h1 className="text-3xl font-semibold text-gray-900">Public Credibility Center</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage the business details, public signals, and account settings that shape how customers experience your business.
        </p>
      </div>

      {loading && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/60 bg-white/80 p-6 shadow-sm">
            <div className="mb-4 h-6 w-52 animate-pulse rounded bg-slate-200" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
            </div>
            <p className="mt-4 text-sm text-gray-600">Loading your vendor profile...</p>
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
        <section className="flex-1 max-w-2xl space-y-6">
          {profile.onboarding ? <VendorOnboardingStatusPanel profile={profile} /> : null}
          <Card className="border-blue-200 bg-blue-50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-blue-950">What customers see</CardTitle>
              <p className="text-sm text-blue-900">
                Use this summary to understand whether customers can find your business and which public signals are helping them trust you.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {growthSummary.metrics.slice(0, 4).map((metric) => (
                  <div key={metric.label} className="min-w-0 rounded-xl border border-blue-100 bg-white p-4">
                    <p className="break-words text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                    <p className="mt-2 break-words text-lg font-semibold text-slate-950">{metric.value}</p>
                    <p className="mt-2 break-words text-sm leading-6 text-slate-600">{metric.detail}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-blue-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Public profile status</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{growthSummary.visibilityTitle}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{growthSummary.visibilityDetail}</p>
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
          <Card className="border-violet-200 bg-violet-50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-violet-700">
                    <Sparkles className="h-4 w-4" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em]">AI Copy Assist</p>
                  </div>
                  <CardTitle className="mt-2 text-xl text-violet-950">Make your public business story easier to trust</CardTitle>
                  <p className="mt-2 text-sm text-violet-900">
                    This assistant rewrites your public-facing bio in clearer customer language without changing any approval, publishing, or Trust Score rules.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white"
                  onClick={requestVendorCopySuggestion}
                  disabled={vendorCopyLoading || !vendorId}
                >
                  {vendorCopyLoading
                    ? 'Generating...'
                    : vendorCopySuggestion
                      ? 'Refresh AI Suggestion'
                      : 'Suggest Better Bio'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {vendorCopyMessage ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {vendorCopyMessage}
                </div>
              ) : null}
              {vendorCopyError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {vendorCopyError}
                </div>
              ) : null}
              {vendorCopySuggestion ? (
                <div className="rounded-xl border border-violet-100 bg-white p-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {vendorCopySuggestion.confidence.charAt(0).toUpperCase() + vendorCopySuggestion.confidence.slice(1)} confidence
                    </Badge>
                    <Badge variant="outline">Headline suggestion included</Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">AI summary</p>
                    <p className="mt-2 text-sm text-slate-800">{vendorCopySuggestion.summary}</p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Suggested opening line</p>
                      <p className="mt-2 text-base font-semibold text-slate-950">
                        {vendorCopySuggestion.recommendedHeadline}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {vendorCopySuggestion.recommendedDescription}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Suggested proof points</p>
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {vendorCopySuggestion.recommendedBullets.length > 0 ? (
                            vendorCopySuggestion.recommendedBullets.map((item) => (
                              <li key={item}>- {item}</li>
                            ))
                          ) : (
                            <li>No extra bullet points were suggested.</li>
                          )}
                        </ul>
                      </div>
                      {vendorCopySuggestion.trustGaps.length > 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">What customers may still question</p>
                          <ul className="mt-2 space-y-1 text-sm text-amber-800">
                            {vendorCopySuggestion.trustGaps.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {vendorCopySuggestion.riskyClaims.length > 0 ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Claims to avoid or soften</p>
                      <ul className="mt-2 space-y-1 text-sm text-red-800">
                        {vendorCopySuggestion.riskyClaims.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {vendorCopySuggestion.nextEdits.length > 0 ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Recommended next edits</p>
                      <ul className="mt-2 space-y-1 text-sm text-blue-900">
                        {vendorCopySuggestion.nextEdits.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() =>
                        setLocalFormData((current) => ({
                          ...current,
                          bio: vendorCopySuggestion.recommendedDescription,
                        }))
                      }
                    >
                      Use Suggested Bio
                    </Button>
                    <p className="text-xs text-slate-600">
                      The suggested opening line is shown here for guidance. Your actual saved profile field on this page is the business bio below.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-violet-200 bg-white px-4 py-5 text-sm text-slate-600">
                  Run AI Copy Assist to get a clearer profile bio draft based on your current business details and existing public trust signals.
                </div>
              )}
            </CardContent>
          </Card>
          {/* Enhanced Profile Information Card */}
          <Card className="bg-gradient-to-br from-white to-blue-50 border-blue-200 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-gray-800">Business Profile</CardTitle>
                  <p className="text-sm text-gray-600">Manage saved business information customers and staff rely on</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                Profile fields on this page save to your vendor profile. Device pairing and storage limits use live vendor APIs; future-only launch features are marked where they appear.
              </div>
              <form className="space-y-6">
                {/* Profile Photo Section */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-gray-700">Business Profile Photo</label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {localFormData.profilePhoto || profile.profilePhoto ? (
                        <img 
                          src={localFormData.profilePhoto || profile.profilePhoto || ''} 
                          alt="Business Profile" 
                          className="w-24 h-24 rounded-lg object-cover border-2 border-gray-200"
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-gray-200 bg-gradient-to-br from-slate-100 to-blue-100 text-2xl font-semibold text-slate-700">
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
                        className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto || (storage?.isOverLimit ?? false)}
                        title={storage?.isOverLimit ? 'Storage limit reached. Delete existing media to upload new files.' : undefined}
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-2">Upload a professional photo of your business, team, or workspace. Customers will use it as a first impression when your public profile is live.</p>
                      <button
                        type="button"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <label className="block text-sm font-medium mb-2 text-gray-700">Business Bio</label>
                  <textarea
                    name="bio"
                    value={localFormData.bio || ''}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Tell customers about your business, experience, and what makes you unique..."
                  />
                  <p className="text-sm text-gray-500 mt-1">Shown on your public profile and job listings.</p>
                </div>

                {/* Business specialties section */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-gray-700">Business Specialties</label>
                  <p className="text-sm text-gray-600 mb-3">
                    Select broad specialties for your profile. Customer-visible services offered are managed from Services Offered.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {serviceTypeOptions.map((serviceType) => (
                      <div key={serviceType} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={serviceType}
                          checked={(localFormData.serviceTypes || []).includes(serviceType)}
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
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={serviceType} className="text-sm text-gray-700 cursor-pointer">
                          {serviceType}
                        </label>
                      </div>
                    ))}
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

          {/* Enhanced Device Management Card */}
          <Card className="bg-gradient-to-br from-white to-indigo-50 border-indigo-200 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <DeviceIcon className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-gray-800">Device Management</CardTitle>
                    <p className="text-sm text-gray-600">
                      Pair employee phones for stage video capture. Headsets should be connected from a paired phone when supported—this page does not handle Bluetooth pairing directly.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchDevices()}
                  disabled={devicesLoading}
                  className="bg-white hover:bg-indigo-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${devicesLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {devicesError ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Device list is temporarily unavailable.</p>
                      <p className="mt-1 text-amber-800">
                        Your profile is still usable. Refresh devices or try again after the connection recovers.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchDevices()}
                        disabled={devicesLoading}
                        className="mt-3 bg-white hover:bg-amber-50"
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${devicesLoading ? 'animate-spin' : ''}`} />
                        Retry Devices
                      </Button>
                    </div>
                  </div>
                </div>
              ) : devicesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading devices...</p>
                </div>
              ) : devices.length === 0 ? (
                <div className="text-center py-8">
                  <DeviceIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No devices paired yet</p>
                  <Button 
                    variant="outline" 
                    onClick={handleOpenPairModal}
                    className="bg-white hover:bg-indigo-50"
                  >
                    <DeviceIcon className="w-4 h-4 mr-2" />
                    Pair New Device
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {devices.map(dev => (
                    <div key={dev.id} className="flex items-center gap-4 p-4 bg-white rounded-lg border border-indigo-200 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-indigo-200">
                        <DeviceIcon className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-800">
                            {dev.deviceName ?? dev.deviceType ?? "Device"}
                          </span>
                          <Badge className="text-xs bg-indigo-100 text-indigo-700">
                            {dev.deviceType}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-4">
                          <span>Last seen: {dev.lastSeenAt ? new Date(dev.lastSeenAt).toLocaleDateString() : "—"}</span>
                          <span>Added: {dev.createdAt ? new Date(dev.createdAt).toLocaleDateString() : "—"}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            try {
                              await revokeDevice(dev.id);
                            } catch (err) {
                              console.error('Error revoking device:', err);
                            }
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button 
                    variant="outline" 
                    onClick={handleOpenPairModal}
                    className="w-full bg-white hover:bg-indigo-50"
                  >
                    <DeviceIcon className="w-4 h-4 mr-2" />
                    Pair Additional Device
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Reminders & Notifications Card */}
          <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Bell className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-gray-800">Reminder Preferences</CardTitle>
                  <p className="text-sm text-gray-600">Save communication preferences for supported launch workflows</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  These preferences are saved to your profile. Reliance only sends supported launch communications; delayed automation may be limited.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={reminders.review} 
                      onChange={e => setReminders(r => ({ ...r, review: e.target.checked }))}
                      className="w-4 h-4 text-purple-600"
                    />
                    <div>
                      <div className="font-medium text-gray-800">Review Requests</div>
                      <div className="text-sm text-gray-600">Request reviews after eligible completed jobs.</div>
                    </div>
                    <Info className="w-4 h-4 text-purple-500 ml-auto" />
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={reminders.invoice} 
                      onChange={e => setReminders(r => ({ ...r, invoice: e.target.checked }))}
                      className="w-4 h-4 text-purple-600"
                    />
                    <div>
                      <div className="font-medium text-gray-800">Follow-up Reminders</div>
                      <div className="text-sm text-gray-600">Save your preference for future post-service follow-up reminders.</div>
                    </div>
                    <Info className="w-4 h-4 text-purple-500 ml-auto" />
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={reminders.maintenance} 
                      onChange={e => setReminders(r => ({ ...r, maintenance: e.target.checked }))}
                      className="w-4 h-4 text-purple-600"
                    />
                    <div>
                      <div className="font-medium text-gray-800">Maintenance Alerts</div>
                      <div className="text-sm text-gray-600">Save your preference for future maintenance follow-up prompts.</div>
                    </div>
                    <Info className="w-4 h-4 text-purple-500 ml-auto" />
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={reminders.followUp} 
                      onChange={e => setReminders(r => ({ ...r, followUp: e.target.checked }))}
                      className="w-4 h-4 text-purple-600"
                    />
                    <div>
                      <div className="font-medium text-gray-800">Follow-up Calls</div>
                      <div className="text-sm text-gray-600">Save your preference for post-service call reminders.</div>
                    </div>
                    <Info className="w-4 h-4 text-purple-500 ml-auto" />
                  </label>
                </div>
                <Button 
                  onClick={handleSaveReminders} 
                  className="w-fit bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white"
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
          <Card className="bg-gradient-to-br from-white to-orange-50 border-orange-200 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Bell className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-gray-800">Notification Preferences</CardTitle>
                  <p className="text-sm text-gray-600">Manage saved notification settings for active launch features</p>
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
                    className={`flex items-center gap-3 p-3 bg-white rounded-lg border border-orange-200 transition-colors ${
                      copy.disabled ? 'opacity-75 cursor-not-allowed' : 'hover:bg-orange-50 cursor-pointer'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      checked={value} 
                      onChange={e => setNotificationSettings(s => ({ ...s, [key]: e.target.checked }))}
                      disabled={copy.disabled}
                      className="w-4 h-4 text-orange-600"
                    />
                    <div>
                      <div className="font-medium text-gray-800">{copy.label}</div>
                      <div className="text-sm text-gray-600">{copy.description}</div>
                    </div>
                  </label>
                  );
                })}
              </div>
              <Button 
                onClick={handleSaveNotifications} 
                className="w-fit mt-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white"
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
          <Card className="border-blue-200 bg-blue-50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2">
                  <Shield className="h-5 w-5 text-blue-700" />
                </div>
                <CardTitle className="text-lg text-blue-950">Account Protection</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm text-blue-950">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Vendor sign-in protection</span>
                    <Badge className="bg-blue-100 text-blue-800">
                      Active
                    </Badge>
                  </div>
                  <p className="text-xs leading-5 text-blue-900">
                    Review MFA, passkeys, and login alerts from Security Settings. This protects dashboard,
                    team, and job access.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">Login notifications</span>
                  <Badge className={(profile?.loginNotifications ?? securitySettings.loginNotifications) ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>
                    {(profile?.loginNotifications ?? securitySettings.loginNotifications) ? 'On' : 'Off'}
                  </Badge>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full bg-white hover:bg-blue-50"
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

      {/* Modals - Always rendered (controlled by their own state) */}
      {/* Enhanced Pair Device Modal */}
      <Dialog 
        open={showPairModal} 
        onOpenChange={(open) => {
          setShowPairModal(open);
          if (!open) {
            setPairing(null);
            setCountdown(null);
            setPairingSuccess(false);
            setPairingInviteFeedback(null);
            setPairingInviteEmail('');
            setPairingInvitePhone('');
          }
        }}
      >
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DeviceIcon className="w-5 h-5 text-blue-600" />
              Pair Employee Device
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex flex-col items-center gap-4">
            {pairingSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-green-700 mb-2">Device Paired Successfully!</h3>
                <p className="text-gray-600 mb-4">The device has been added to your account.</p>
                <p className="text-sm text-gray-500">This window will close automatically...</p>
              </div>
            ) : pairing ? (
              <>
                {pairingInviteFeedback ? (
                  <div className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    {pairingInviteFeedback}
                  </div>
                ) : null}
                <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Reliance is waiting for the employee phone to open the link and confirm pairing. The backup code stays available if the employee needs to enter it manually.
                </div>
                <div className="text-3xl font-mono tracking-widest bg-gradient-to-r from-blue-100 to-blue-200 px-6 py-3 rounded-lg border-2 border-blue-300" aria-label="Pairing Code">
                  {pairing.code}
                </div>
                <div className="text-gray-700 text-center text-sm mb-4">
                  Send this link to the employee phone you want to pair. The link already includes the code, and the 6-digit code stays available as a backup.
                </div>
                {pairing.linkAccessMode === 'local_only' ? (
                  <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    This pairing link uses a local-only Reliance address for this environment. It can open on this machine, but it is not ready as a true phone email/text link until <code className="font-mono">APP_BASE_URL</code> points to a public or phone-reachable URL.
                  </div>
                ) : null}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="text-xs text-blue-800 font-medium mb-2">Shareable pairing link:</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-900 break-all">
                      {pairing.pairingUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(pairing.pairingUrl);
                      }}
                      className="text-xs"
                    >
                      Copy link
                    </Button>
                  </div>
                </div>
                <div className="text-blue-600 font-semibold mt-2 text-lg" aria-live="polite">
                  {countdown != null
                    ? `${Math.floor(countdown / 60)}:${(countdown % 60)
                        .toString()
                        .padStart(2, "0")}`
                    : "00:00"}
                </div>
                <div className="text-green-700 font-medium text-sm" aria-live="polite">
                  {pairingLoading ? "Generating code..." : "Waiting for the phone to confirm pairing..."}
                </div>
              </>
            ) : null}
            {!pairing && pairingLoading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Generating pairing code...</p>
              </div>
            )}
            {!pairing && !pairingLoading && (
              <div className="w-full space-y-4">
                {pairingInviteFeedback ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {pairingInviteFeedback}
                  </div>
                ) : null}
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  Enter the employee contact details below. Reliance will try to send a pairing link first, and you can still use the backup link and code if needed.
                </div>
                {runtimeIsLocalOnly ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    This vendor session is running on a local-only Reliance address. Email or text pairing invites from this screen are useful for copy review, but they will not open on another phone until you set <code className="font-mono">APP_BASE_URL</code> or enter a phone-reachable pairing URL below.
                  </div>
                ) : null}
                {runtimeIsLocalOnly ? (
                  <div className="space-y-2">
                    <label htmlFor="pairing-base-url" className="text-sm font-medium text-gray-700">
                      Phone-reachable pairing URL
                    </label>
                    <Input
                      id="pairing-base-url"
                      type="url"
                      placeholder="https://your-staging-or-tunnel-url.com"
                      value={pairingBaseUrlOverride}
                      onChange={(e) => setPairingBaseUrlOverride(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      Optional in local development. Reliance will use this exact base URL in the invite link, so make sure the employee phone can actually open it.
                    </p>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <label htmlFor="pairing-invite-email" className="text-sm font-medium text-gray-700">
                    Employee email
                  </label>
                  <Input
                    id="pairing-invite-email"
                    type="email"
                    placeholder="employee@example.com"
                    value={pairingInviteEmail}
                    onChange={(e) => setPairingInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="pairing-invite-phone" className="text-sm font-medium text-gray-700">
                    Employee phone
                  </label>
                  <Input
                    id="pairing-invite-phone"
                    type="tel"
                    placeholder="(407) 555-1234"
                    value={pairingInvitePhone}
                    onChange={(e) => setPairingInvitePhone(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Email sending is supported now. Text delivery will only send if SMS is configured for this environment.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    onClick={() => handleStartPairing(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Send Pairing Link
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleStartPairing(false)}
                  >
                    Use Backup Code Only
                  </Button>
                </div>
              </div>
            )}
            {!pairingSuccess && (
              <Button variant="outline" onClick={() => setShowPairModal(false)} className="w-full bg-white hover:bg-gray-50">
                Close
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Login Notifications</span>
              <input 
                type="checkbox" 
                checked={securitySettings.loginNotifications}
                onChange={(e) => setSecuritySettings(s => ({ ...s, loginNotifications: e.target.checked }))}
                className="w-4 h-4 text-red-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Session Timeout (minutes)</label>
              <Input 
                type="number" 
                value={securitySettings.sessionTimeout}
                onChange={(e) => setSecuritySettings(s => ({ ...s, sessionTimeout: Number(e.target.value) }))}
                className="w-24"
              />
            </div>
            <Button 
              className="w-full bg-red-600 hover:bg-red-700 text-white"
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
