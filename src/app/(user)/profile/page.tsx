'use client';
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  MapPin,
  Info,
  Star,
  Heart,
  Calendar,
  Shield,
  Bell,
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Key
} from 'lucide-react';

export default function UserProfilePage() {
  // User Profile State
  const [profile, setProfile] = useState({
    name: 'Jane Doe',
    email: 'jane.doe@email.com',
    phone: '(555) 123-4567',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    memberSince: '2024-01-15',
    premiumMember: true,
    totalBookings: 23,
    totalReviews: 12,
    totalFavorites: 8
  });

  // Location Settings
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Privacy & Security
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [publicProfile, setPublicProfile] = useState(true);

  // Notification Settings
  const [notifications, setNotifications] = useState({
    bookingConfirmations: true,
    bookingReminders: true,
    newServices: true,
    specialOffers: true,
    reviewRequests: true,
    marketing: false,
    email: true,
    sms: false,
    push: true
  });

  // UI State
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Check location permission on mount
  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    if (!navigator.geolocation) {
      setLocationPermission('unknown');
      return;
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      setLocationPermission(permission.state);
      setLocationEnabled(permission.state === 'granted');
      
      permission.addEventListener('change', () => {
        setLocationPermission(permission.state);
        setLocationEnabled(permission.state === 'granted');
      });
    } catch (error) {
      console.log('Permission API not supported');
      setLocationPermission('unknown');
    }
  };

  const handleEnableLocation = () => {
    setLocationLoading(true);

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setLocationEnabled(true);
        setLocationPermission('granted');
        setLocationLoading(false);
        
        // Backend call: POST /api/user/location/enable
        console.log('Location enabled:', { lat: latitude, lng: longitude });
      },
      (error) => {
        console.log('Location error:', error);
        setLocationEnabled(false);
        setLocationPermission('denied');
        setLocationLoading(false);
        alert('Unable to get your location. Please check your browser settings.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  const handleDisableLocation = () => {
    setLocationEnabled(false);
    setUserLocation(null);
    setLocationPermission('denied');
    
    // Backend call: POST /api/user/location/disable
    console.log('Location disabled');
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Backend call: PATCH /api/user/profile
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (passwordData.new !== passwordData.confirm) {
      alert('New passwords do not match');
      return;
    }
    
    if (passwordData.new.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }

    setSaving(true);
    try {
      // Backend call: POST /api/user/password/change
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPasswordData({ current: '', new: '', confirm: '' });
      alert('Password changed successfully');
    } catch (error) {
      alert('Failed to change password');
    }
    setSaving(false);
  };

  const getLocationStatusText = () => {
    switch (locationPermission) {
      case 'granted':
        return 'Location access granted';
      case 'denied':
        return 'Location access denied';
      case 'prompt':
        return 'Location permission not set';
      default:
        return 'Location status unknown';
    }
  };

  const getLocationStatusColor = () => {
    switch (locationPermission) {
      case 'granted':
        return 'bg-green-100 text-green-800';
      case 'denied':
        return 'bg-red-100 text-red-800';
      case 'prompt':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account and preferences</p>
        </div>
        <Button 
          onClick={handleSaveProfile}
          disabled={saving}
          className="flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Save Status */}
      {saveStatus === 'success' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800">Changes saved successfully!</span>
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <XCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">Failed to save changes. Please try again.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Profile Information</CardTitle>
                  <p className="text-sm text-gray-600">Update your personal details</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <img 
                  src={profile.avatar} 
                  alt={profile.name} 
                  className="w-20 h-20 rounded-full border-2 border-gray-200"
                />
                <div className="flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <Input 
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <Input 
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        placeholder="Enter your email"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <Input 
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        placeholder="Enter your phone number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
                      <Input 
                        value={new Date(profile.memberSince).toLocaleDateString()}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <CardTitle>Location Settings</CardTitle>
                  <p className="text-sm text-gray-600">Control how we use your location to find services near you</p>
                </div>
                <Badge className={getLocationStatusColor()}>
                  {getLocationStatusText()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 mb-1">Why we need your location</h4>
                    <p className="text-sm text-blue-800">
                      We use your location to show you services and vendors near you. 
                      This helps you find the best local options and get accurate distance information.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${locationEnabled ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div>
                    <div className="font-medium">Location Services</div>
                    <div className="text-sm text-gray-600">
                      {locationEnabled 
                        ? 'Enabled - You can see services near you' 
                        : 'Disabled - Limited to general service listings'
                      }
                    </div>
                  </div>
                </div>
                <Button
                  variant={locationEnabled ? "outline" : "default"}
                  onClick={locationEnabled ? handleDisableLocation : handleEnableLocation}
                  disabled={locationLoading}
                  className="flex items-center gap-2"
                >
                  {locationLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      Enabling...
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4" />
                      {locationEnabled ? 'Disable' : 'Enable'}
                    </>
                  )}
                </Button>
              </div>

              {userLocation && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">
                      Location detected: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Privacy & Security */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Privacy & Security</CardTitle>
                  <p className="text-sm text-gray-600">Manage your account security and privacy settings</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Password Change */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Change Password</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"}
                        value={passwordData.current}
                        onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                        placeholder="Current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <Input 
                      type={showPassword ? "text" : "password"}
                      value={passwordData.new}
                      onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                      placeholder="New password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                    <Input 
                      type={showPassword ? "text" : "password"}
                      value={passwordData.confirm}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                      placeholder="Confirm password"
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleChangePassword}
                  disabled={!passwordData.current || !passwordData.new || !passwordData.confirm}
                  className="flex items-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  Change Password
                </Button>
              </div>

              {/* Privacy Settings */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Privacy Settings</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={publicProfile}
                      onChange={(e) => setPublicProfile(e.target.checked)}
                      className="rounded"
                    />
                    <div>
                      <div className="font-medium">Public Profile</div>
                      <div className="text-sm text-gray-600">Allow vendors to see your profile information</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={twoFactorEnabled}
                      onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                      className="rounded"
                    />
                    <div>
                      <div className="font-medium">Two-Factor Authentication</div>
                      <div className="text-sm text-gray-600">Add an extra layer of security to your account</div>
                    </div>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Bell className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <CardTitle>Notification Preferences</CardTitle>
                  <p className="text-sm text-gray-600">Choose how and when you want to be notified</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Booking Notifications</h4>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notifications.bookingConfirmations}
                      onChange={(e) => setNotifications({ ...notifications, bookingConfirmations: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Booking confirmations</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notifications.bookingReminders}
                      onChange={(e) => setNotifications({ ...notifications, bookingReminders: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Booking reminders</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notifications.reviewRequests}
                      onChange={(e) => setNotifications({ ...notifications, reviewRequests: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Review requests</span>
                  </label>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Marketing & Updates</h4>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notifications.newServices}
                      onChange={(e) => setNotifications({ ...notifications, newServices: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">New services near you</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notifications.specialOffers}
                      onChange={(e) => setNotifications({ ...notifications, specialOffers: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Special offers</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notifications.marketing}
                      onChange={(e) => setNotifications({ ...notifications, marketing: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Marketing emails</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold">{profile.totalBookings}</div>
                  <div className="text-sm text-gray-600">Total Bookings</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Star className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <div className="font-semibold">{profile.totalReviews}</div>
                  <div className="text-sm text-gray-600">Reviews Given</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Heart className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <div className="font-semibold">{profile.totalFavorites}</div>
                  <div className="text-sm text-gray-600">Favorites</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Membership</span>
                <Badge className={profile.premiumMember ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}>
                  {profile.premiumMember ? 'Premium' : 'Free'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Location</span>
                <Badge className={locationEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {locationEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">2FA</span>
                <Badge className={twoFactorEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 