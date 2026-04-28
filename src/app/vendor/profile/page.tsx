'use client';
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, CheckCircle, XCircle, Info, User, Shield, Bell, QrCode, Smartphone as DeviceIcon, Activity as ActivityIcon, Camera, RefreshCw, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import { useVendorDevices } from '@/hooks/useVendorDevices';
import { useVendorStorage } from '@/hooks/useVendorStorage';
import { VendorProfileUpdateRequest } from '@/types/vendor';

// BACKEND DEVELOPER NOTES:
// - GET /api/vendor/profile: Fetch vendor profile and settings (including Reliance Payments status)
// - POST /api/vendor/payments/enable: Enable Reliance Payments for the vendor
// - POST /api/vendor/payments/disable: Disable Reliance Payments for the vendor
// - Reliance Payments status should be stored in the vendor profile and reflected in both profile and billing pages
// - All endpoints should be authenticated and scoped to the current vendor
// - This file currently uses local state for demonstration purposes
//
// See also: billing page for payment history and payouts

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
  
  // Local UI state (not profile data)
  const [localFormData, setLocalFormData] = useState<Partial<VendorProfileUpdateRequest>>({});
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [pairingSuccess, setPairingSuccess] = useState(false);
  const [initialDeviceCount, setInitialDeviceCount] = useState(0);
  
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
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



  // Mock address suggestions
  const mockAddresses = [
    '123 Main St, Springfield, IL',
    '456 Oak Ave, Springfield, IL',
    '789 Pine Rd, Springfield, IL',
    '321 Elm St, Springfield, IL'
  ];

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
    setAddressQuery(value);
    setLocalFormData(prev => ({ ...prev, address: value }));
    if (value.length > 2) {
      setAddressSuggestions(mockAddresses.filter(addr => addr.toLowerCase().includes(value.toLowerCase())));
    } else {
      setAddressSuggestions([]);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setLocalFormData(prev => ({ ...prev, address: suggestion }));
    setAddressQuery(suggestion);
    setAddressSuggestions([]);
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check storage limit before uploading
    if (storage?.isOverLimit) {
      alert('Storage limit reached. Please delete existing media before uploading new files.');
      e.target.value = ''; // Reset file input
      return;
    }

    try {
      setUploadingPhoto(true);

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/vendor/profile/photo', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }

      const { url } = await res.json() as { url: string };

      // Persist on vendor profile
      await updateProfile({ profilePhoto: url });

      // Update local form state so the preview updates immediately
      setLocalFormData(prev => ({ ...prev, profilePhoto: url }));
      
      // Refresh storage usage after successful upload
      if (vendorId) {
        setTimeout(() => fetchStorage(), 1000);
      }
    } catch (err) {
      console.error('Error uploading photo', err);
      // Check if error is storage limit related
      if (err instanceof Error && err.message.includes('STORAGE_LIMIT_REACHED')) {
        alert('Storage limit reached. Please delete existing media before uploading new files.');
      }
      // you can show a toast here if you want
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
        twoFactorEnabled: securitySettings.twoFactorEnabled,
        loginNotifications: securitySettings.loginNotifications,
        sessionTimeout: securitySettings.sessionTimeout,
        passwordExpiry: securitySettings.passwordExpiry,
        failedLoginLockout: securitySettings.failedLoginLockout,
      });
      // Close modal after save
      setShowSecurityModal(false);
    } catch (err) {
      console.error('Error saving security settings:', err);
    }
  };

  const handleOpenPairModal = async () => {
    try {
      // Store initial device count before opening modal
      setInitialDeviceCount(devices.length);
      setPairingSuccess(false);
      await requestPairingCode();
      setShowPairModal(true);
    } catch (err) {
      console.error('Error requesting pairing code:', err);
    }
  };

  // Auto-refresh device list when pairing modal is open (poll every 2 seconds)
  // Also detect when a new device is paired
  useEffect(() => {
    if (showPairModal && pairing) {
      const interval = setInterval(() => {
        fetchDevices();
      }, 2000); // Poll every 2 seconds
      return () => clearInterval(interval);
    }
  }, [showPairModal, pairing, fetchDevices]);

  // Detect successful pairing (device count increased)
  useEffect(() => {
    if (showPairModal && pairing && devices.length > initialDeviceCount) {
      setPairingSuccess(true);
      // Auto-close modal after 3 seconds
      const timer = setTimeout(() => {
        setShowPairModal(false);
        setPairing(null);
        setCountdown(null);
        setPairingSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [devices.length, initialDeviceCount, showPairModal, pairing]);

  // Refresh device list when pairing modal closes
  useEffect(() => {
    if (!showPairModal) {
      fetchDevices();
    }
  }, [showPairModal, fetchDevices]);

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-8 py-8">
      {loading && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      )}

      {approvalPending && !loading && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-md w-full rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <h2 className="text-xl font-semibold text-amber-900 mb-2">Vendor account pending approval</h2>
            <p className="text-sm text-amber-800">
              You can access profile settings after admin approval.
            </p>
          </div>
        </div>
      )}
      
      {error && !loading && !approvalPending && (
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
      
      {!loading && !error && !approvalPending && profile && (
        <main className="flex flex-col xl:flex-row gap-8">
        {/* Profile Form */}
        <section className="flex-1 max-w-2xl space-y-6">
          {/* Enhanced Profile Information Card */}
          <Card className="bg-gradient-to-br from-white to-blue-50 border-blue-200 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-gray-800">Business Profile</CardTitle>
                  <p className="text-sm text-gray-600">Manage your business information and settings</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-6">
                {/* Profile Photo Section */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-gray-700">Business Profile Photo</label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img 
                        src={localFormData.profilePhoto || profile.profilePhoto || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&crop=center'} 
                        alt="Business Profile" 
                        className="w-24 h-24 rounded-lg object-cover border-2 border-gray-200"
                      />

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
                      <p className="text-sm text-gray-600 mb-2">Upload a professional photo of your business, team, or workspace</p>
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

                {/* Service Types Section */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-gray-700">Service Types Offered</label>
                  <p className="text-sm text-gray-600 mb-3">Select all the services your business provides</p>
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
                  <p className="text-sm text-gray-500 mt-2">Selected: {(localFormData.serviceTypes || []).length} service types</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Business Address</label>
                  <div className="relative">
                    <Input
                      name="address"
                      value={addressQuery || localFormData.address || ''}
                      onChange={handleAddressInput}
                      autoComplete="off"
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Enter your business address"
                    />
                    {addressSuggestions.length > 0 && (
                      <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-auto">
                        {addressSuggestions.map((suggestion, idx) => (
                          <li
                            key={idx}
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => handleSelectSuggestion(suggestion)}
                          >
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
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
                    <p className="text-sm text-gray-600">Manage paired employee devices</p>
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
              {devicesLoading ? (
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
                  <CardTitle className="text-xl text-gray-800">Automated Reminders & Follow-Ups</CardTitle>
                  <p className="text-sm text-gray-600">Configure automated customer communication</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">These messages are only sent for completed jobs.</p>
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
                      <div className="text-sm text-gray-600">Auto-send email/SMS after job completion (e.g., 24 hours later).</div>
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
                      <div className="font-medium text-gray-800">Invoice Reminders</div>
                      <div className="text-sm text-gray-600">Auto-remind for unpaid invoices</div>
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
                      <div className="text-sm text-gray-600">Schedule follow-up maintenance</div>
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
                      <div className="text-sm text-gray-600">Schedule post-service calls</div>
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
                  <p className="text-sm text-gray-600">Manage your notification settings</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(notificationSettings).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-orange-200 hover:bg-orange-50 transition-colors cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={value} 
                      onChange={e => setNotificationSettings(s => ({ ...s, [key]: e.target.checked }))}
                      className="w-4 h-4 text-orange-600"
                    />
                    <div>
                      <div className="font-medium text-gray-800 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                      <div className="text-sm text-gray-600">
                        {key === 'job' && 'New job requests'}
                        {key === 'review' && 'New customer reviews'}
                        {key === 'payout' && 'Payment processing'}
                        {key === 'support' && 'Support messages'}
                        {key === 'marketing' && 'Marketing updates'}
                        {key === 'updates' && 'System updates'}
                      </div>
                    </div>
                  </label>
                ))}
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
          <Card className="bg-gradient-to-br from-white to-red-50 border-red-200 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Shield className="w-5 h-5 text-red-600" />
                </div>
                <CardTitle className="text-lg text-gray-800">Security</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-600">Two-Factor Auth</span>
                    <p className="text-xs text-gray-500">Protect your account with two-factor authentication.</p>
                  </div>
                  <Badge className={(profile?.twoFactorEnabled ?? securitySettings.twoFactorEnabled) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                    {(profile?.twoFactorEnabled ?? securitySettings.twoFactorEnabled) ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Login Notifications</span>
                  <Badge className={(profile?.loginNotifications ?? securitySettings.loginNotifications) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                    {(profile?.loginNotifications ?? securitySettings.loginNotifications) ? 'On' : 'Off'}
                  </Badge>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full bg-white hover:bg-red-50"
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
            setInitialDeviceCount(0);
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
            ) : pairing && (
              <>
                <div className="text-3xl font-mono tracking-widest bg-gradient-to-r from-blue-100 to-blue-200 px-6 py-3 rounded-lg border-2 border-blue-300" aria-label="Pairing Code">
                  {pairing.code}
                </div>
                <div className="my-2" aria-label="QR Code Placeholder">
                  <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300">
                    <QrCode className="w-16 h-16" />
                  </div>
                </div>
                <div className="text-gray-700 text-center text-sm mb-4">
                  Ask your employee to enter this code in their mobile app within 5 minutes to pair their device with your business.
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="text-xs text-blue-800 font-medium mb-2">Pairing URL:</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-900 break-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}/device/pair` : '/device/pair'}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const url = typeof window !== 'undefined' ? `${window.location.origin}/device/pair` : '/device/pair';
                        navigator.clipboard.writeText(url);
                        // You could add a toast here
                      }}
                      className="text-xs"
                    >
                      Copy
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
                  {pairingLoading ? "Generating code..." : "Waiting for device to pair..."}
                </div>
              </>
            )}
            {!pairing && pairingLoading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Generating pairing code...</p>
              </div>
            )}
            {!pairing && !pairingLoading && (
              <div className="text-center py-8">
                <p className="text-gray-600">Failed to generate pairing code. Please try again.</p>
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
              <span className="text-sm font-medium">Two-Factor Authentication</span>
              <input 
                type="checkbox" 
                checked={securitySettings.twoFactorEnabled}
                onChange={(e) => setSecuritySettings(s => ({ ...s, twoFactorEnabled: e.target.checked }))}
                className="w-4 h-4 text-red-600"
              />
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