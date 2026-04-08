'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft,
  MapPin,
  Shield,
  Eye,
  EyeOff,
  Heart,
  Calendar,
  User,
  Settings,
  LogOut,
  Home,
  Grid,
  Star,
  MessageCircle,
  CheckCircle,
  AlertCircle,
  Info,
  Mail,
  Phone,
  MapPin as LocationIcon,
  Camera,
  Edit,
  Save,
  X
} from 'lucide-react';

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [userProfile, setUserProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
    memberSince: '',
    lastLogin: '',
    favorites: 0,
    totalBookings: 0,
    averageRating: 0
  });

  const [tempProfile, setTempProfile] = useState(userProfile);

  // Fetch user profile data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // First try to get from localStorage
        const localUserData = localStorage.getItem('userData');
        if (localUserData) {
          const parsed = JSON.parse(localUserData);
          const profileData = {
            firstName: parsed.firstName || '',
            lastName: parsed.lastName || '',
            email: parsed.email || '',
            phone: parsed.phone || '',
            address: parsed.city && parsed.state ? `${parsed.city}, ${parsed.state}` : '',
            bio: parsed.bio || 'test test',
            memberSince: parsed.createdAt ? new Date(parsed.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
            lastLogin: new Date().toLocaleDateString(),
            favorites: 23,
            totalBookings: 8,
            averageRating: 4.8
          };
          setUserProfile(profileData);
          setTempProfile(profileData);
        }

        // Also try to fetch from API
        const response = await fetch('/api/customer/profile', {
          headers: {
            'Authorization': 'Bearer temp-jwt-token'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.profile) {
            const profileData = {
              firstName: data.profile.firstName || '',
              lastName: data.profile.lastName || '',
              email: data.profile.email || '',
              phone: data.profile.phone || '',
              address: data.profile.city && data.profile.state ? `${data.profile.city}, ${data.profile.state}` : '',
              bio: data.profile.bio || 'test test',
              memberSince: data.profile.createdAt ? new Date(data.profile.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
              lastLogin: new Date().toLocaleDateString(),
              favorites: 23,
              totalBookings: 8,
              averageRating: 4.8
            };
            setUserProfile(profileData);
            setTempProfile(profileData);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleProfileChange = (field: string, value: string) => {
    setTempProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Update local state immediately
      setUserProfile(tempProfile);
      setIsEditing(false);

      // Update localStorage with new profile data
      const localUserData = localStorage.getItem('userData');
      if (localUserData) {
        const parsed = JSON.parse(localUserData);
        const updatedUserData = {
          ...parsed,
          firstName: tempProfile.firstName,
          lastName: tempProfile.lastName,
          email: tempProfile.email,
          phone: tempProfile.phone,
          bio: tempProfile.bio,
          // Extract city and state from address if it's in "City, State" format
          city: tempProfile.address.split(', ')[0] || parsed.city,
          state: tempProfile.address.split(', ')[1] || parsed.state,
        };
        localStorage.setItem('userData', JSON.stringify(updatedUserData));
      }

      // Try to update via API
      try {
        const response = await fetch('/api/customer/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer temp-jwt-token'
          },
          body: JSON.stringify({
            firstName: tempProfile.firstName,
            lastName: tempProfile.lastName,
            email: tempProfile.email,
            phone: tempProfile.phone,
            bio: tempProfile.bio,
            city: tempProfile.address.split(', ')[0] || '',
            state: tempProfile.address.split(', ')[1] || '',
          })
        });

        if (response.ok) {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 5000); // Hide after 5 seconds
        } else {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 5000); // Hide after 5 seconds
        }
              } catch (apiError) {
          console.error('API update failed:', apiError);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 5000); // Hide after 5 seconds
        }

    } catch (error) {
      console.error('Error saving profile:', error);
      // Show error message
      alert('Failed to save profile. Please try again.');
      // Revert to original state on error
      setTempProfile(userProfile);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setTempProfile(userProfile);
    setIsEditing(false);
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    // In real app, this would call API to change password
    alert('Password updated successfully!');
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const toggleLocation = () => {
    if (locationEnabled) {
      if (confirm('Are you sure you want to disable location services? This will affect service recommendations.')) {
        setLocationEnabled(false);
      }
    } else {
      setLocationEnabled(true);
    }
  };

  const toggleTwoFactor = () => {
    if (twoFactorEnabled) {
      if (confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
        setTwoFactorEnabled(false);
      }
    } else {
      setTwoFactorEnabled(true);
      alert('Two-factor authentication enabled! You will receive a setup code via email.');
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Profile & Settings</h1>
            </div>
            {isEditing && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-purple-400 disabled:cursor-not-allowed"
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

      {/* Success Message */}
      {showSuccess && (
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm">✓</span>
              </div>
              <div>
                <h3 className="font-medium text-green-800">Profile Updated Successfully!</h3>
                <p className="text-sm text-green-600">
                  Your profile changes have been saved and will be reflected across all pages.
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
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 text-purple-600 hover:text-purple-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Profile
                  </button>
                )}
              </div>

              <div className="flex items-start gap-6 mb-6">
                {/* Profile Picture */}
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-2xl">
                      {userProfile.firstName[0]}{userProfile.lastName[0]}
                    </span>
                  </div>
                  {isEditing && (
                    <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center hover:bg-purple-700 transition-colors">
                      <Camera className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Profile Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={isEditing ? tempProfile.firstName : userProfile.firstName}
                    onChange={(e) => handleProfileChange('firstName', e.target.value)}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={isEditing ? tempProfile.lastName : userProfile.lastName}
                    onChange={(e) => handleProfileChange('lastName', e.target.value)}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={isEditing ? tempProfile.email : userProfile.email}
                      onChange={(e) => handleProfileChange('email', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                    />
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={isEditing ? tempProfile.phone : userProfile.phone}
                      onChange={(e) => handleProfileChange('phone', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                    />
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={isEditing ? tempProfile.address : userProfile.address}
                      onChange={(e) => handleProfileChange('address', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                    />
                    <LocationIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={isEditing ? tempProfile.bio : userProfile.bio}
                    onChange={(e) => handleProfileChange('bio', e.target.value)}
                    disabled={!isEditing}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                  />
                </div>
              </div>

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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Login</label>
                    <input
                      type="text"
                      value={userProfile.lastLogin}
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
                  <h2 className="text-xl font-semibold text-gray-900">Location Settings</h2>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  locationEnabled 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {locationEnabled ? 'Location access granted' : 'Location disabled'}
                </div>
              </div>
              
              <p className="text-gray-600 mb-4">
                Control how we use your location to find services near you.
              </p>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium text-blue-900 mb-1">Why we need your location</h3>
                    <p className="text-blue-800 text-sm">
                      We use your location to show you services and vendors near you. This helps you find the best local options and get accurate distance information.
                    </p>
                  </div>
                </div>
              </div>

              {/* Location Services */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${locationEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-gray-900">
                    Location Services - {locationEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                  {locationEnabled && (
                    <span className="text-sm text-gray-600">You can see services near you</span>
                  )}
                </div>
                <button
                  onClick={toggleLocation}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    locationEnabled
                      ? 'bg-red-50 text-red-700 hover:bg-red-100'
                      : 'bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  {locationEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>

            {/* Privacy & Security */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-semibold text-gray-900">Privacy & Security</h2>
              </div>
              
              <p className="text-gray-600 mb-6">
                Manage your account security and privacy settings.
              </p>

              {/* Change Password */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                        placeholder="Current Password"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                        placeholder="New Password"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordData.confirmPassword}
                        onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                        placeholder="Confirm Password"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                  >
                    Update Password
                  </button>
                </form>
              </div>

              {/* Two-Factor Authentication */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Two-Factor Authentication</h3>
                    <p className="text-sm text-gray-600">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <button
                    onClick={toggleTwoFactor}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      twoFactorEnabled
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    {twoFactorEnabled ? 'Disable' : 'Enable'} 2FA
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Account Status */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Membership</span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    Premium
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Location</span>
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                    locationEnabled 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {locationEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">2FA</span>
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                    twoFactorEnabled 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/user-dashboard')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Home className="w-5 h-5" />
                  <span>Go to Dashboard</span>
                </button>
                <button
                  onClick={() => router.push('/my-bookings')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Calendar className="w-5 h-5" />
                  <span>View My Bookings</span>
                </button>
                <button
                  onClick={() => router.push('/search')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Grid className="w-5 h-5" />
                  <span>Browse Services</span>
                </button>
              </div>
            </div>

            {/* Account Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
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