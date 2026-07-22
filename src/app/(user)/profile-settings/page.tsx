'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getClientAuthHeaders } from '@/lib/client-session';
import { AddressAutocompleteInput } from '@/components/AddressAutocompleteInput';
import type { AddressAutocompleteSuggestion } from '@/lib/address-autocomplete';
import { 
  MapPin,
  Shield,
  LogOut,
  CheckCircle,
  AlertCircle,
  Info,
  Mail,
  Phone,
  MapPin as LocationIcon,
  Edit,
  Save,
  X,
  Camera,
  Trash2,
} from 'lucide-react';

type CustomerProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profilePhoto: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  memberSince: string;
};

type SaveFeedback =
  | { type: 'success'; title: string; message: string }
  | { type: 'error'; title: string; message: string };

const emptyProfile: CustomerProfile = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  profilePhoto: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  memberSince: 'Not available',
};

function trimProfileForSave(profile: CustomerProfile): CustomerProfile {
  return {
    ...profile,
    firstName: profile.firstName.trim(),
    lastName: profile.lastName.trim(),
    email: profile.email.trim(),
    phone: profile.phone.trim(),
    address: profile.address.trim(),
    city: profile.city.trim(),
    state: profile.state.trim(),
    zipCode: profile.zipCode.trim(),
  };
}

function validateCustomerProfile(profile: CustomerProfile): string | null {
  if (!profile.firstName.trim()) return 'First name is required.';
  if (!profile.lastName.trim()) return 'Last name is required.';
  if (!profile.email.trim()) return 'Email address is required.';
  if (!/\S+@\S+\.\S+/.test(profile.email.trim())) return 'Enter a valid email address.';
  if (!profile.phone.trim()) return 'Phone number is required.';
  const normalizedPhone = profile.phone.replace(/[\s\-\(\)]/g, '');
  if (!/^[\+]?[1-9][\d]{0,15}$/.test(normalizedPhone)) return 'Enter a valid phone number.';
  return null;
}

function formatProfileDate(value: unknown) {
  if (!value) return 'Not available';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString();
}

function normalizeProfile(rawProfile: any): CustomerProfile {
  return {
    firstName: String(rawProfile?.firstName || ''),
    lastName: String(rawProfile?.lastName || ''),
    email: String(rawProfile?.email || ''),
    phone: String(rawProfile?.phone || ''),
    profilePhoto: String(rawProfile?.profilePhoto || rawProfile?.avatar || ''),
    address: String(rawProfile?.address || ''),
    city: String(rawProfile?.city || ''),
    state: String(rawProfile?.state || ''),
    zipCode: String(rawProfile?.zipCode || ''),
    memberSince: formatProfileDate(rawProfile?.createdAt),
  };
}

function mergeProfile(base: CustomerProfile, candidate: Partial<CustomerProfile> | null | undefined): CustomerProfile {
  if (!candidate) return base;

  const next = { ...base };
  for (const [rawKey, rawValue] of Object.entries(candidate)) {
    const key = rawKey as keyof CustomerProfile;
    if (typeof rawValue !== 'string') continue;
    const trimmedValue = rawValue.trim();
    if (key === 'profilePhoto') {
      next[key] = rawValue as CustomerProfile[typeof key];
      continue;
    }
    if (!trimmedValue) continue;
    if (key === 'memberSince' && trimmedValue === 'Not available') continue;
    next[key] = rawValue as CustomerProfile[typeof key];
  }

  return next;
}

function buildAuthProfile(name: string | null | undefined, email: string | null | undefined, phone: string | null | undefined): Partial<CustomerProfile> {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
    email: String(email || ''),
    phone: String(phone || ''),
  };
}

function profileInitials(profile: CustomerProfile): string {
  const initials = `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.trim().toUpperCase();
  return initials || 'U';
}

function readStoredProfile(): { profile: Partial<CustomerProfile>; locationPreferenceEnabled: boolean | null } {
  if (typeof window === 'undefined') {
    return { profile: {}, locationPreferenceEnabled: null };
  }

  try {
    const raw = sessionStorage.getItem('userData') || sessionStorage.getItem('user');
    if (!raw) {
      return { profile: {}, locationPreferenceEnabled: null };
    }

    const parsed = JSON.parse(raw);
    const storedProfile = mergeProfile(
      mergeProfile(emptyProfile, buildAuthProfile(parsed?.name, parsed?.email, parsed?.phone)),
      normalizeProfile(parsed)
    );
    return {
      profile: storedProfile,
      locationPreferenceEnabled:
        typeof parsed?.locationPreferenceEnabled === 'boolean'
          ? parsed.locationPreferenceEnabled
          : null,
    };
  } catch {
    return { profile: {}, locationPreferenceEnabled: null };
  }
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user: authUser, isAuthenticated, isLoading: authLoading, updateUser } = useAuth();
  const sessionHeaders = useMemo(() => getClientAuthHeaders(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [feedback, setFeedback] = useState<SaveFeedback | null>(null);

  const [userProfile, setUserProfile] = useState<CustomerProfile>(emptyProfile);

  const [tempProfile, setTempProfile] = useState(userProfile);
  const customerInitials = useMemo(() => profileInitials(tempProfile), [tempProfile]);
  const customerPhotoUrl = tempProfile.profilePhoto || userProfile.profilePhoto || '';
  const profileValidationMessage = isEditing ? validateCustomerProfile(tempProfile) : null;

  // Fetch user profile data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (authLoading) {
        return;
      }

      const authProfile = buildAuthProfile(authUser?.name, authUser?.email, authUser?.phone);
      const stored = readStoredProfile();
      const seededProfile = mergeProfile(mergeProfile(emptyProfile, authProfile), stored.profile);
      setUserProfile(seededProfile);
      setTempProfile(seededProfile);
      if (stored.locationPreferenceEnabled !== null) {
        setLocationEnabled(stored.locationPreferenceEnabled);
      }

      if (!isAuthenticated) {
        setFeedback({
          type: 'error',
          title: 'Sign in required',
          message: 'Sign in to view and update your customer profile settings.',
        });
        setLoading(false);
        return;
      }

      try {

        const response = await fetch('/api/customer/profile', {
          headers: {
            'Content-Type': 'application/json',
            ...sessionHeaders,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.profile) {
            const profileData = mergeProfile(seededProfile, normalizeProfile(data.profile));
            setUserProfile(profileData);
            setTempProfile(profileData);
            setLocationEnabled(Boolean(data.profile.locationPreferenceEnabled));
          }
        } else {
          const payload = await response.json().catch(() => ({}));
          setFeedback({
            type: 'error',
            title: 'Profile load issue',
            message: String(payload?.error || payload?.message || 'Some profile details could not be refreshed. Saved account details are shown where available.'),
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setFeedback({
          type: 'error',
          title: 'Profile load issue',
          message: 'Some profile details could not be refreshed. Please try again if saved data looks out of date.',
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchUserData();
  }, [authLoading, authUser?.email, authUser?.name, authUser?.phone, isAuthenticated, sessionHeaders]);

  const handleProfileChange = (field: string, value: string) => {
    setTempProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleAddressSuggestion = (suggestion: AddressAutocompleteSuggestion) => {
    setTempProfile(prev => ({
      ...prev,
      address: suggestion.address,
      city: suggestion.city,
      state: suggestion.state,
      zipCode: suggestion.zipCode,
    }));
  };

  const parseProfileSaveError = async (response: Response) => {
    try {
      const body = await response.json();
      return body?.message || body?.error || 'Profile changes could not be saved.';
    } catch {
      return 'Profile changes could not be saved.';
    }
  };

  const updateLocalUserData = (
    profile: CustomerProfile,
    nextLocationEnabled: boolean,
    nextPhotoUrl?: string | null
  ) => {
    const localUserData = sessionStorage.getItem('userData');
    const parsed = localUserData ? JSON.parse(localUserData) : {};
    const resolvedPhotoUrl = typeof nextPhotoUrl === 'string' ? nextPhotoUrl : profile.profilePhoto;
    const updatedUserData = {
      ...parsed,
      name: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone,
      profilePhoto: resolvedPhotoUrl || null,
      avatar: resolvedPhotoUrl || null,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zipCode: profile.zipCode,
      locationPreferenceEnabled: nextLocationEnabled,
    };
    sessionStorage.setItem('userData', JSON.stringify(updatedUserData));
  };

  const saveProfileToApi = async (profile: CustomerProfile, nextLocationEnabled: boolean) => {
    const response = await fetch('/api/customer/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...sessionHeaders,
      },
      body: JSON.stringify({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        zipCode: profile.zipCode,
        locationPreferenceEnabled: nextLocationEnabled,
      })
    });

    if (!response.ok) {
      throw new Error(await parseProfileSaveError(response));
    }

    const data = await response.json();
    if (data?.success === false) {
      throw new Error(data?.message || data?.error || 'Profile changes could not be saved.');
    }

    return data.profile ? normalizeProfile(data.profile) : profile;
  };

  const handleSaveProfile = async () => {
    const profileToSave = trimProfileForSave(tempProfile);
    const validationMessage = validateCustomerProfile(profileToSave);
    if (validationMessage) {
      setFeedback({
        type: 'error',
        title: 'Required profile details missing',
        message: validationMessage,
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const savedProfile = await saveProfileToApi(profileToSave, locationEnabled);
      setUserProfile(savedProfile);
      setTempProfile(savedProfile);
      updateLocalUserData(savedProfile, locationEnabled, savedProfile.profilePhoto);
      updateUser({
        name: [savedProfile.firstName, savedProfile.lastName].filter(Boolean).join(' '),
        email: savedProfile.email,
        phone: savedProfile.phone,
        avatar: savedProfile.profilePhoto || undefined,
      });
      setIsEditing(false);
      setFeedback({
        type: 'success',
        title: 'Profile updated',
        message: 'Your saved profile details were updated successfully.',
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      setFeedback({
        type: 'error',
        title: 'Profile not saved',
        message: error instanceof Error ? error.message : 'Profile changes could not be saved. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setTempProfile(userProfile);
    setIsEditing(false);
  };

  const toggleLocation = async () => {
    const nextLocationEnabled = !locationEnabled;
    if (locationEnabled) {
      if (!confirm('Turn off your saved address for nearby-service suggestions?')) {
        return;
      }
    }

    setSavingLocation(true);
    setFeedback(null);
    try {
      const savedProfile = await saveProfileToApi(userProfile, nextLocationEnabled);
      setUserProfile(savedProfile);
      setTempProfile(savedProfile);
      setLocationEnabled(nextLocationEnabled);
      updateLocalUserData(savedProfile, nextLocationEnabled, savedProfile.profilePhoto);
      setFeedback({
        type: 'success',
        title: 'Location preference updated',
        message: nextLocationEnabled
          ? 'Reliance can use your saved address when nearby-service suggestions are available.'
          : 'Reliance will not use your saved address for nearby-service suggestions.',
      });
    } catch (error) {
      console.error('Error saving location preference:', error);
      setFeedback({
        type: 'error',
        title: 'Location preference not saved',
        message: error instanceof Error ? error.message : 'Location preference could not be saved. Please try again.',
      });
    } finally {
      setSavingLocation(false);
    }
  };

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/customer/profile/photo', {
        method: 'POST',
        headers: {
          ...sessionHeaders,
        },
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          String(payload?.error || payload?.message || `Photo upload failed with status ${response.status}`)
        );
      }

      const nextPhotoUrl = String(payload?.photoUrl || payload?.url || '').trim();
      if (!nextPhotoUrl) {
        throw new Error('Profile photo upload completed, but no image URL was returned.');
      }

      const nextProfile = {
        ...userProfile,
        profilePhoto: nextPhotoUrl,
      };

      setUserProfile(nextProfile);
      setTempProfile((prev) => ({ ...prev, profilePhoto: nextPhotoUrl }));
      updateLocalUserData(nextProfile, locationEnabled, nextPhotoUrl);
      updateUser({ avatar: nextPhotoUrl });
      setFeedback({
        type: 'success',
        title: 'Profile photo updated',
        message: 'Your customer profile photo is now live across your signed-in account pages.',
      });
    } catch (error) {
      console.error('Customer profile photo upload error:', error);
      setFeedback({
        type: 'error',
        title: 'Photo upload failed',
        message: error instanceof Error ? error.message : 'Customer profile photo could not be uploaded.',
      });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async () => {
    if (!customerPhotoUrl) return;
    if (!confirm('Remove your current customer profile photo?')) {
      return;
    }

    setRemovingPhoto(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/customer/profile/photo', {
        method: 'DELETE',
        headers: {
          ...sessionHeaders,
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          String(payload?.error || payload?.message || `Photo removal failed with status ${response.status}`)
        );
      }

      const nextProfile = {
        ...userProfile,
        profilePhoto: '',
      };

      setUserProfile(nextProfile);
      setTempProfile((prev) => ({ ...prev, profilePhoto: '' }));
      updateLocalUserData(nextProfile, locationEnabled, '');
      updateUser({ avatar: undefined });
      setFeedback({
        type: 'success',
        title: 'Profile photo removed',
        message: 'Your customer profile photo was removed and your initials are now shown again.',
      });
    } catch (error) {
      console.error('Customer profile photo delete error:', error);
      setFeedback({
        type: 'error',
        title: 'Photo removal failed',
        message: error instanceof Error ? error.message : 'Customer profile photo could not be removed.',
      });
    } finally {
      setRemovingPhoto(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-2xl border border-blue-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Profile & Settings</h1>
          <p className="mt-3 text-gray-700">
            Sign in to view your profile details, update saved preferences, and manage customer account settings.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => router.push('/auth/login?next=%2Fprofile-settings')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Sign In
            </button>
            <button
              onClick={() => router.push('/discover')}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Browse Services
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-white">Profile & Settings</h1>
            </div>
            {isEditing && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-2 px-4 py-2 text-slate-300 transition-colors hover:text-white"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Feedback */}
      {feedback && (
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className={`border rounded-lg p-4 mb-4 ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                feedback.type === 'success' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {feedback.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
              </div>
              <div>
                <h3 className={`font-medium ${
                  feedback.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>{feedback.title}</h3>
                <p className={`text-sm ${
                  feedback.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {feedback.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Information */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-6 shadow-[0_20px_70px_rgba(3,8,20,0.22)]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Profile Details
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelected}
              />
              <div className="flex items-start gap-6 mb-6">
                <div className="relative shrink-0">
                  <div className="relative">
                    {customerPhotoUrl ? (
                      <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-blue-300/25 bg-slate-950/90 p-2 shadow-sm ring-1 ring-blue-200/20">
                        <img
                          src={customerPhotoUrl}
                          alt={`${tempProfile.firstName || userProfile.firstName || 'Customer'} profile photo`}
                          className="h-full w-full rounded-xl object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-blue-300/25 bg-gradient-to-br from-blue-600 to-cyan-500">
                        <span className="text-white font-semibold text-2xl">
                          {customerInitials}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto || removingPhoto}
                      className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-950/30 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Change customer profile photo"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="min-w-0 pt-1">
                  <p className="text-sm font-semibold text-gray-900">Customer profile photo</p>
                  <p className="mt-1 text-sm leading-6 text-gray-600">
                    {customerPhotoUrl
                      ? 'This photo is visible on your signed-in customer profile.'
                      : 'Initials are shown until you upload a profile photo.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto || removingPhoto}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                    >
                      <Camera className="h-4 w-4" />
                      {uploadingPhoto ? 'Uploading...' : customerPhotoUrl ? 'Change Photo' : 'Upload Photo'}
                    </button>
                    {customerPhotoUrl ? (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={uploadingPhoto || removingPhoto}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        {removingPhoto ? 'Removing...' : 'Remove Photo'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Profile Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={isEditing ? tempProfile.firstName : userProfile.firstName}
                    onChange={(e) => handleProfileChange('firstName', e.target.value)}
                    disabled={!isEditing}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={isEditing ? tempProfile.lastName : userProfile.lastName}
                    onChange={(e) => handleProfileChange('lastName', e.target.value)}
                    disabled={!isEditing}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={isEditing ? tempProfile.email : userProfile.email}
                      onChange={(e) => handleProfileChange('email', e.target.value)}
                      disabled={!isEditing}
                      required
                      className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                    />
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={isEditing ? tempProfile.phone : userProfile.phone}
                      onChange={(e) => handleProfileChange('phone', e.target.value)}
                      disabled={!isEditing}
                      required
                      className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                    />
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <div className="relative">
                    <AddressAutocompleteInput
                      value={isEditing ? tempProfile.address : userProfile.address}
                      onChange={(value) => handleProfileChange('address', value)}
                      onSelectAddress={handleAddressSuggestion}
                      disabled={!isEditing}
                      inputClassName="w-full border border-gray-300 px-3 py-2 pl-10 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                    />
                    <LocationIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={isEditing ? tempProfile.city : userProfile.city}
                    onChange={(e) => handleProfileChange('city', e.target.value)}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={isEditing ? tempProfile.state : userProfile.state}
                      onChange={(e) => handleProfileChange('state', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                    <input
                      type="text"
                      value={isEditing ? tempProfile.zipCode : userProfile.zipCode}
                      onChange={(e) => handleProfileChange('zipCode', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                    />
                  </div>
                </div>
              </div>

              {profileValidationMessage ? (
                <div className="mt-4 rounded-lg border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {profileValidationMessage}
                </div>
              ) : null}

              {/* Account Info (Read-only) */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
                    <input
                      type="text"
                      value={userProfile.memberSince}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sign-in Activity</label>
                    <input
                      type="text"
                      value="Recent sign-in history is not shown here yet"
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Location Settings */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-6 h-6 text-green-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Address for Nearby Services</h2>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  locationEnabled 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {locationEnabled ? 'Saved address on' : 'Saved address off'}
                </div>
              </div>
              
              <p className="text-gray-600 mb-4">
                Control whether Reliance should use your saved profile address when nearby services are available.
              </p>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium text-blue-900 mb-1">How this works</h3>
                    <p className="text-blue-800 text-sm">
                      If browser location is unavailable, Reliance can use your saved address on supported customer proof views to calculate nearby services offered when providers have usable coordinates.
                    </p>
                  </div>
                </div>
              </div>

              {/* Location Services */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${locationEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-gray-900">
                    Use saved address for nearby services - {locationEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                  {locationEnabled && (
                    <span className="text-sm text-gray-600">Used on supported nearby-service views when a saved address is available</span>
                  )}
                </div>
                <button
                  onClick={toggleLocation}
                  disabled={savingLocation || saving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    locationEnabled
                      ? 'bg-red-50 text-red-700 hover:bg-red-100'
                      : 'bg-green-50 text-green-700 hover:bg-green-100'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <MapPin className="w-4 h-4" />
                  {savingLocation
                    ? 'Saving...'
                    : locationEnabled
                    ? 'Turn Off'
                    : 'Turn On'}
                </button>
              </div>
            </div>

            {/* Privacy & Security */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Privacy & Security</h2>
              </div>
              
              <p className="text-gray-600 mb-6">
                Keep your account details current, use account recovery when needed, and manage optional passkeys from Secure Account.
              </p>

              {/* Change Password */}
              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Password Changes</h3>
                    <p className="text-sm text-gray-600">
                      Use the Forgot Password flow on the sign-in page any time you need to reset your password. Customer passkeys stay optional in Secure Account.
                    </p>
                  </div>
                  <span className="shrink-0 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                    Recovery available
                  </span>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => router.push('/auth/forgot-password')}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    Open Password Recovery
                  </button>
                </div>
              </div>

              {/* Two-Factor Authentication */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Passkeys & Sign-In Protection</h3>
                    <p className="text-sm text-gray-600">
                      Customer accounts can add a passkey from Secure Account. Email-code MFA is currently reserved
                      for vendor and admin sign-ins.
                    </p>
                  </div>
                  <span className="shrink-0 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                    Optional
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Account Status */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-6 shadow-[0_20px_70px_rgba(3,8,20,0.22)]">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Profile Details</span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    Editable
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Saved Address</span>
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                    locationEnabled 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {locationEnabled ? 'Preferred' : 'Off'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Security</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                    Basic protection active
                  </span>
                </div>
              </div>
            </div>

            {/* Account Actions */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-6 shadow-[0_20px_70px_rgba(3,8,20,0.22)]">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to log out?')) {
                      router.push('/');
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
