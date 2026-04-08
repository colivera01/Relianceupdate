# Vendor Profile & Settings - Complete Code Review

**Date:** $(date)  
**Purpose:** Full code display for ChatGPT review

---

## File 1: Profile Page Component

**File:** `src/app/vendor/profile/page.tsx`

```typescript
'use client';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, HardDrive, Settings, LogOut, HelpCircle, CheckCircle, XCircle, Info, User, Mail, Phone, MapPin, Clock, Shield, CreditCard, Bell, Smartphone, Wifi, Database, Activity, Zap, Eye, EyeOff, QrCode, Smartphone as DeviceIcon, Database as StorageIcon, Activity as ActivityIcon, Zap as LightningIcon, Camera } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useVendorProfile } from '@/hooks/useVendorProfile';
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
// 1. Device Pairing:
//    - POST /api/pairing/request { employeeId, vendorId } → { code, expiresAt, qrCodeUrl }
//    - POST /api/pairing/confirm { code, deviceId } → { success, employeeId, vendorId, deviceId }
//    - GET /api/devices?vendorId=... → list of paired devices
//    - Devices table: id, employeeId, vendorId, deviceType, lastPaired
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
  const { data: profile, loading, error, saving, updateProfile, refetch } = useVendorProfile();
  
  // Local UI state (not profile data)
  const [localFormData, setLocalFormData] = useState<Partial<VendorProfileUpdateRequest>>({});
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pairedDevices, setPairedDevices] = useState([
    { id: 'dev-1', employeeName: 'Maria Lopez', employeePhoto: 'https://randomuser.me/api/portraits/women/44.jpg', employeeRole: 'Technician', lastPaired: '2024-06-01', deviceInfo: 'iPhone 14, iOS 17', status: 'online', batteryLevel: 85 },
    { id: 'dev-2', employeeName: 'James Lee', employeePhoto: 'https://randomuser.me/api/portraits/men/45.jpg', employeeRole: 'Technician', lastPaired: '2024-05-28', deviceInfo: 'Samsung Tablet, Android 13', status: 'offline', batteryLevel: 23 },
  ]);
  const [countdown, setCountdown] = useState(300); // 5 minutes
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [reminders, setReminders] = useState({ review: true, invoice: false, maintenance: true, followUp: true });
  const [showReminderToast, setShowReminderToast] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({ job: true, review: true, payout: false, support: true, marketing: false, updates: true });
  const [showNotifToast, setShowNotifToast] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    }
  }, [profile]);

  // Countdown effect
  useEffect(() => {
    if (!showPairModal) return;
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [showPairModal, countdown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setLocalFormData(prev => ({ ...prev, [name]: value }));
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

  function handleSaveReminders() {
    setShowReminderToast(true);
    setTimeout(() => setShowReminderToast(false), 2000);
  }

  function handleSaveNotifications() {
    setShowNotifToast(true);
    setTimeout(() => setShowNotifToast(false), 2000);
  }

  // Mock pairing code and status
  const pairingCode = 'A1B2C3';
  const pairingStatus = 'Waiting for device to pair...';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {loading && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      )}
      
      {error && !loading && (
        <div className="flex items-center justify-center min-h-screen">
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
        <main className="flex-1 p-8 flex gap-8 max-w-7xl mx-auto">
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
                      <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors">
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-2">Upload a professional photo of your business, team, or workspace</p>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                        Change Photo
                      </button>
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

                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="font-medium text-blue-800">Device Pairing Status:</span>
                  {pairedDevices.length > 0 ? (
                    <Badge className="bg-green-100 text-green-700 border-green-300">
                      <CheckCircle className="w-4 h-4 mr-1" /> Active
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 border-red-300">
                      <XCircle className="w-4 h-4 mr-1" /> Inactive
                    </Badge>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="ml-auto bg-white hover:bg-blue-50"
                    onClick={() => setShowPairModal(true)}
                  >
                    <DeviceIcon className="w-4 h-4 mr-2" />
                    Manage Devices
                  </Button>
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

          {/* Enhanced Device Management Card */}
          <Card className="bg-gradient-to-br from-white to-indigo-50 border-indigo-200 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <DeviceIcon className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-gray-800">Device Management</CardTitle>
                  <p className="text-sm text-gray-600">Manage paired employee devices</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pairedDevices.length === 0 ? (
                <div className="text-center py-8">
                  <DeviceIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No devices paired yet</p>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPairModal(true)}
                    className="bg-white hover:bg-indigo-50"
                  >
                    <DeviceIcon className="w-4 h-4 mr-2" />
                    Pair New Device
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {pairedDevices.map(dev => (
                    <div key={dev.id} className="flex items-center gap-4 p-4 bg-white rounded-lg border border-indigo-200 hover:shadow-md transition-shadow">
                      <img src={dev.employeePhoto} alt={dev.employeeName} className="w-12 h-12 rounded-full border-2 border-indigo-200" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-800">{dev.employeeName}</span>
                          <Badge className={`text-xs ${dev.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {dev.status === 'online' ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 mb-1">{dev.employeeRole}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-4">
                          <span>Last paired: {dev.lastPaired}</span>
                          <span>Battery: {dev.batteryLevel}%</span>
                          <span>{dev.deviceInfo}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="bg-white hover:bg-indigo-50">
                          <ActivityIcon className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => setPairedDevices(pairedDevices.filter(d => d.id !== dev.id))}
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPairModal(true)}
                    className="w-full bg-white hover:bg-indigo-50"
                  >
                    <DeviceIcon className="w-4 h-4 mr-2" />
                    Pair Additional Device
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Reliance Payments Card */}
          <Card className="bg-gradient-to-br from-white to-emerald-50 border-emerald-200 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <CreditCard className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-gray-800">Reliance Payments</CardTitle>
                  <p className="text-sm text-gray-600">Manage your payment processing settings</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-white rounded-lg border border-emerald-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-800">Payment Processing</span>
                    <Badge className={paymentsEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                      {paymentsEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Use Reliance to charge customers and receive payouts to your bank account.
                  </p>
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => setPaymentsEnabled(!paymentsEnabled)}
                      className={paymentsEnabled ? 
                        'bg-red-600 hover:bg-red-700 text-white' : 
                        'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }
                    >
                      {paymentsEnabled ? 'Disable Payments' : 'Enable Payments'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowPaymentModal(true)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Button>
                  </div>
                </div>
                {paymentsEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-white rounded-lg border border-emerald-200">
                      <div className="text-lg font-bold text-emerald-600">2.9%</div>
                      <div className="text-xs text-emerald-600">Processing Fee</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-emerald-200">
                      <div className="text-lg font-bold text-emerald-600">24h</div>
                      <div className="text-xs text-emerald-600">Payout Time</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-emerald-200">
                      <div className="text-lg font-bold text-emerald-600">$0</div>
                      <div className="text-xs text-emerald-600">Setup Fee</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Enhanced Right Panel */}
        <aside className="w-80 space-y-6">
          {/* Enhanced Storage Usage Card */}
          <Card className="bg-gradient-to-br from-white to-blue-50 border-blue-200 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <StorageIcon className="w-5 h-5 text-blue-600" />
                </div>
                <CardTitle className="text-lg text-gray-800">Storage Usage</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Used</span>
                  <span className="font-medium">75 GB</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full" style={{width: '75%'}}></div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total</span>
                  <span className="font-medium">100 GB</span>
                </div>
                <div className="text-xs text-gray-500 text-center">25 GB remaining</div>
                <p className="text-xs text-gray-500 mt-2">Used for photos, contracts, and other uploaded files.</p>
              </div>
            </CardContent>
          </Card>

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
                  <Badge className={securitySettings.twoFactorEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                    {securitySettings.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Login Notifications</span>
                  <Badge className={securitySettings.loginNotifications ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                    {securitySettings.loginNotifications ? 'On' : 'Off'}
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

      {/* Enhanced Pair Device Modal */}
      <Dialog open={showPairModal} onOpenChange={setShowPairModal}>
        <DialogContent className="max-w-md bg-white" aria-modal="true" aria-labelledby="pairing-title">
          <DialogTitle id="pairing-title" className="flex items-center gap-2">
            <DeviceIcon className="w-5 h-5 text-blue-600" />
            Pair Employee Device
          </DialogTitle>
          <div className="mt-4 flex flex-col items-center gap-4">
            <div className="text-3xl font-mono tracking-widest bg-gradient-to-r from-blue-100 to-blue-200 px-6 py-3 rounded-lg border-2 border-blue-300" aria-label="Pairing Code">
              {pairingCode}
            </div>
            <div className="my-2" aria-label="QR Code Placeholder">
              <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300">
                <QrCode className="w-16 h-16" />
              </div>
            </div>
            <div className="text-gray-700 text-center text-sm">
              Ask your employee to enter this code in their mobile app within 5 minutes to pair their device with your business.
            </div>
            <div className="text-blue-600 font-semibold mt-2 text-lg" aria-live="polite">
              {Math.floor(countdown/60)}:{(countdown%60).toString().padStart(2,'0')}
            </div>
            <div className="text-green-700 font-medium text-sm" aria-live="polite">
              {pairingStatus}
            </div>
            <Button variant="outline" onClick={() => setShowPairModal(false)} className="w-full bg-white hover:bg-gray-50">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Security Settings Modal */}
      <Dialog open={showSecurityModal} onOpenChange={setShowSecurityModal}>
        <DialogContent className="max-w-lg bg-white">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            Security Settings
          </DialogTitle>
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
            <Button className="w-full bg-red-600 hover:bg-red-700 text-white">
              Save Security Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Settings Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-lg bg-white">
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            Payment Settings
          </DialogTitle>
          <div className="mt-4 space-y-4">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <h4 className="font-medium text-emerald-800 mb-2">Current Plan</h4>
              <p className="text-sm text-emerald-700">Standard Payment Processing</p>
              <p className="text-xs text-emerald-600 mt-1">2.9% + $0.30 per transaction</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing Fee</span>
                <span className="font-medium">2.9%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Fixed Fee</span>
                <span className="font-medium">$0.30</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Payout Time</span>
                <span className="font-medium">24 hours</span>
              </div>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              Update Payment Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
```

---

## File 2: useVendorProfile Hook

**File:** `src/hooks/useVendorProfile.ts`

```typescript
"use client";
import { useEffect, useState, useCallback } from "react";
import { VendorProfileResponse, VendorProfile, VendorProfileUpdateRequest } from "@/types/vendor";

export function useVendorProfile() {
  const [data, setData] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/vendor/profile", {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const json = (await res.json()) as VendorProfileResponse;
      if (json.success && json.profile) {
        setData(json.profile);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (updates: VendorProfileUpdateRequest) => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/vendor/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const json = (await res.json()) as VendorProfileResponse;
      if (json.success && json.profile) {
        setData(json.profile);
        return json.profile;
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      throw err; // Re-throw so component can handle
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { 
    data, 
    loading, 
    error, 
    saving,
    refetch: fetchProfile,
    updateProfile,
  };
}
```

---

## File 3: API Route

**File:** `src/app/api/vendor/profile/route.ts`

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getVendorIdFromRequest } from "@/lib/auth";
import { VendorProfileResponse, VendorProfileUpdateRequest } from "@/types/vendor";

export async function GET(request: Request) {
  try {
    const vendorId = await getVendorIdFromRequest(request);

    if (!vendorId) {
      return NextResponse.json(
        { error: "Unauthorized: no vendor ID" },
        { status: 401 }
      );
    }

    // Fetch vendor from Prisma
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        employees: {
          select: { id: true }, // Just count, don't fetch all data
        },
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Calculate derived fields
    const totalEmployees = vendor.employees.length;
    const yearsInBusiness = vendor.foundedYear
      ? new Date().getFullYear() - vendor.foundedYear
      : null;

    // Map Prisma data to VendorProfile
    const profile = {
      id: vendor.id,
      firstName: vendor.firstName ?? null,
      lastName: vendor.lastName ?? null,
      name: vendor.name,
      businessName: vendor.businessName ?? null,
      businessType: vendor.businessType ?? null,
      category: vendor.category ?? null,
      foundedYear: vendor.foundedYear ?? null,
      email: vendor.email ?? null,
      phone: vendor.phone ?? null,
      city: vendor.city ?? null,
      state: vendor.state ?? null,
      address: vendor.address ?? null,
      zipCode: vendor.zipCode ?? null,
      bio: vendor.bio ?? null,
      website: vendor.website ?? null,
      licenseNumber: vendor.licenseNumber ?? null,
      insuranceStatus: vendor.insuranceStatus ?? false,
      insuranceProvider: vendor.insuranceProvider ?? null,
      insuranceExpiry: vendor.insuranceExpiry?.toISOString() ?? null,
      bondingStatus: vendor.bondingStatus ?? false,
      emergencyContact: vendor.emergencyContact ?? null,
      responseTimeSettings: vendor.responseTimeSettings ?? null,
      profilePhoto: vendor.profilePhoto ?? null,
      // Convert comma-separated strings to arrays
      serviceTypes: vendor.serviceTypes ? vendor.serviceTypes.split(',').map(s => s.trim()).filter(Boolean) : [],
      specializations: vendor.specializations ? vendor.specializations.split(',').map(s => s.trim()).filter(Boolean) : [],
      serviceAreas: vendor.serviceAreas ? vendor.serviceAreas.split(',').map(s => s.trim()).filter(Boolean) : [],
      // Calculated fields
      totalEmployees,
      yearsInBusiness,
    };

    const response: VendorProfileResponse = {
      success: true,
      profile,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Vendor profile GET error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const vendorId = await getVendorIdFromRequest(request);

    if (!vendorId) {
      return NextResponse.json(
        { error: "Unauthorized: no vendor ID" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as VendorProfileUpdateRequest;

    // Build update data object (only include defined fields)
    const updateData: Record<string, any> = {};
    
    if (body.firstName !== undefined) updateData.firstName = body.firstName || null;
    if (body.lastName !== undefined) updateData.lastName = body.lastName || null;
    if (body.businessName !== undefined) updateData.businessName = body.businessName || null;
    if (body.businessType !== undefined) updateData.businessType = body.businessType || null;
    if (body.category !== undefined) updateData.category = body.category || null;
    if (body.foundedYear !== undefined) updateData.foundedYear = body.foundedYear || null;
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.city !== undefined) updateData.city = body.city || null;
    if (body.state !== undefined) updateData.state = body.state || null;
    if (body.address !== undefined) updateData.address = body.address || null;
    if (body.zipCode !== undefined) updateData.zipCode = body.zipCode || null;
    if (body.bio !== undefined) updateData.bio = body.bio || null;
    if (body.website !== undefined) updateData.website = body.website || null;
    if (body.licenseNumber !== undefined) updateData.licenseNumber = body.licenseNumber || null;
    if (body.insuranceStatus !== undefined) updateData.insuranceStatus = body.insuranceStatus;
    if (body.insuranceProvider !== undefined) updateData.insuranceProvider = body.insuranceProvider || null;
    if (body.insuranceExpiry !== undefined) updateData.insuranceExpiry = body.insuranceExpiry ? new Date(body.insuranceExpiry) : null;
    if (body.bondingStatus !== undefined) updateData.bondingStatus = body.bondingStatus;
    if (body.emergencyContact !== undefined) updateData.emergencyContact = body.emergencyContact || null;
    if (body.responseTimeSettings !== undefined) updateData.responseTimeSettings = body.responseTimeSettings || null;
    if (body.profilePhoto !== undefined) updateData.profilePhoto = body.profilePhoto || null;
    // Convert arrays to comma-separated strings
    if (body.serviceTypes !== undefined) updateData.serviceTypes = body.serviceTypes.length > 0 ? body.serviceTypes.join(', ') : null;
    if (body.specializations !== undefined) updateData.specializations = body.specializations.length > 0 ? body.specializations.join(', ') : null;
    if (body.serviceAreas !== undefined) updateData.serviceAreas = body.serviceAreas.length > 0 ? body.serviceAreas.join(', ') : null;

    // Update vendor in Prisma
    const updatedVendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: updateData,
      include: {
        employees: {
          select: { id: true },
        },
      },
    });

    // Map back to VendorProfile format
    const totalEmployees = updatedVendor.employees.length;
    const yearsInBusiness = updatedVendor.foundedYear
      ? new Date().getFullYear() - updatedVendor.foundedYear
      : null;

    const profile = {
      id: updatedVendor.id,
      firstName: updatedVendor.firstName ?? null,
      lastName: updatedVendor.lastName ?? null,
      name: updatedVendor.name,
      businessName: updatedVendor.businessName ?? null,
      businessType: updatedVendor.businessType ?? null,
      category: updatedVendor.category ?? null,
      foundedYear: updatedVendor.foundedYear ?? null,
      email: updatedVendor.email ?? null,
      phone: updatedVendor.phone ?? null,
      city: updatedVendor.city ?? null,
      state: updatedVendor.state ?? null,
      address: updatedVendor.address ?? null,
      zipCode: updatedVendor.zipCode ?? null,
      bio: updatedVendor.bio ?? null,
      website: updatedVendor.website ?? null,
      licenseNumber: updatedVendor.licenseNumber ?? null,
      insuranceStatus: updatedVendor.insuranceStatus ?? false,
      insuranceProvider: updatedVendor.insuranceProvider ?? null,
      insuranceExpiry: updatedVendor.insuranceExpiry?.toISOString() ?? null,
      bondingStatus: updatedVendor.bondingStatus ?? false,
      emergencyContact: updatedVendor.emergencyContact ?? null,
      responseTimeSettings: updatedVendor.responseTimeSettings ?? null,
      profilePhoto: updatedVendor.profilePhoto ?? null,
      serviceTypes: updatedVendor.serviceTypes ? updatedVendor.serviceTypes.split(',').map(s => s.trim()).filter(Boolean) : [],
      specializations: updatedVendor.specializations ? updatedVendor.specializations.split(',').map(s => s.trim()).filter(Boolean) : [],
      serviceAreas: updatedVendor.serviceAreas ? updatedVendor.serviceAreas.split(',').map(s => s.trim()).filter(Boolean) : [],
      totalEmployees,
      yearsInBusiness,
    };

    const response: VendorProfileResponse = {
      success: true,
      profile,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Vendor profile PUT error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
```

---

## File 4: Type Definitions

**File:** `src/types/vendor.ts`

```typescript
// src/types/vendor.ts

export interface VendorDashboardProfile {
  id?: string;
  firstName: string;
  lastName: string;
  businessName: string;
  businessType: string;
  category: string;
  foundedYear: number | string;
  email: string;
  phone: string;
  city: string;
  state: string;
  serviceTypes: string[] | string;
  specializations: string[] | string;
  serviceAreas: string[] | string;
  totalBookings?: number;
  totalEarnings?: number;
  totalClients?: number;
  rating?: number;
}

export interface VendorJob {
  id: string;
  title: string;
  client: string;
  amount: number;
  status: 'completed' | 'in progress' | 'scheduled';
  date: string; // ISO string
}

export interface VendorReview {
  id: string;
  client: string;
  rating: number;
  comment: string;
  date: string;
  jobType: string;
}

export interface VendorInsight {
  id: string;
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
}

export interface VendorNotification {
  id: string;
  type: 'job' | 'review' | 'payment' | 'reminder';
  title: string;
  message: string;
  time: string;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface VendorDashboardResponse {
  profile: VendorDashboardProfile;
  stats: {
    totalBookings: number;
    totalEarnings: number;
    totalClients: number;
    rating: number;
  };
  recentJobs: VendorJob[];
  recentReviews: VendorReview[];
  insights: VendorInsight[];
  notifications: VendorNotification[];
}

// Profile-specific types (separate from dashboard)
export interface VendorProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string;
  businessName: string | null;
  businessType: string | null;
  category: string | null;
  foundedYear: number | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  zipCode: string | null;
  bio: string | null;
  website: string | null;
  licenseNumber: string | null;
  insuranceStatus: boolean;
  insuranceProvider: string | null;
  insuranceExpiry: string | null; // ISO string
  bondingStatus: boolean;
  emergencyContact: string | null;
  responseTimeSettings: string | null;
  profilePhoto: string | null;
  // Array fields (stored as comma-separated strings in DB)
  serviceTypes: string[];
  specializations: string[];
  serviceAreas: string[];
  // Calculated fields
  totalEmployees: number; // From employees relation
  yearsInBusiness: number | null; // Calculated from foundedYear
}

export interface VendorProfileResponse {
  success: boolean;
  profile: VendorProfile;
}

export interface VendorProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  businessName?: string;
  businessType?: string;
  category?: string;
  foundedYear?: number;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  address?: string;
  zipCode?: string;
  bio?: string;
  website?: string;
  licenseNumber?: string;
  insuranceStatus?: boolean;
  insuranceProvider?: string;
  insuranceExpiry?: string;
  bondingStatus?: boolean;
  emergencyContact?: string;
  responseTimeSettings?: string;
  profilePhoto?: string;
  serviceTypes?: string[];
  specializations?: string[];
  serviceAreas?: string[];
}
```

---

## File 5: Prisma Schema (Vendor Model)

**File:** `prisma/schema.prisma`

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

// SQL Server doesn't support Prisma enums, using String instead
// EmployeeRole: "MANAGER" | "TECHNICIAN"
// BookingStatus: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED"

model Vendor {
  id                  String    @id @default(cuid())
  firstName           String?
  lastName            String?
  name                String    // Keep for backward compatibility
  businessName        String?
  businessType        String?
  category            String?
  foundedYear         Int?
  email               String?   @unique
  phone               String?
  city                String?
  state               String?
  address             String?
  zipCode             String?
  bio                 String?
  website             String?
  licenseNumber       String?
  insuranceStatus     Boolean   @default(false)
  insuranceProvider   String?
  insuranceExpiry     DateTime?
  bondingStatus       Boolean   @default(false)
  emergencyContact    String?
  responseTimeSettings String?
  profilePhoto        String?
  serviceTypes        String?   // Can be comma-separated for now
  specializations     String?   // Can be comma-separated for now
  serviceAreas        String?   // Can be comma-separated for now
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  demo                Boolean   @default(false)
  seedBatchId         String?
  
  // Relations
  employees           Employee[]
  services            Service[]
  bookings            Booking[]
  reviews             Review[]

  @@map("vendors")
}

model Employee {
  id          String      @id @default(cuid())
  vendorId    String
  name        String
  email       String
  role        String  // "MANAGER" | "TECHNICIAN"
  photoUrl    String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  demo        Boolean     @default(false)
  seedBatchId String?
  
  // Relations
  vendor      Vendor      @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@map("employees")
}

model Service {
  id          String   @id @default(cuid())
  vendorId    String
  name        String
  description String?
  price       Float
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  demo        Boolean  @default(false)
  seedBatchId String?
  
  // Relations
  vendor      Vendor    @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  bookings    Booking[]

  @@map("services")
}

model User {
  id          String   @id @default(cuid())
  name        String
  email       String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  demo        Boolean  @default(false)
  seedBatchId String?
  
  // Relations
  bookings    Booking[]
  reviews     Review[]

  @@map("users")
}

model Booking {
  id           String        @id @default(cuid())
  userId       String
  serviceId    String
  vendorId     String
  title        String?       // Job/service title
  clientName   String?       // Client name (or use user relation)
  amount       Float?        // Booking amount
  status       String @default("PENDING")  // "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED"
  scheduledFor DateTime?
  date         DateTime?    // Job completion or scheduled date
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  demo         Boolean       @default(false)
  seedBatchId  String?
  
  // Relations
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  service      Service       @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  vendor       Vendor        @relation(fields: [vendorId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@map("bookings")
}

model Review {
  id          String   @id @default(cuid())
  userId      String
  vendorId    String
  clientName  String?  // Client name (or use user relation)
  jobType     String?  // Type of job/service reviewed
  rating      Int
  comment     String?
  date        DateTime? // Review date (defaults to createdAt if not set)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  demo        Boolean  @default(false)
  seedBatchId String?
  
  // Relations
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  vendor      Vendor   @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@map("reviews")
}
```

---

## File 6: Authentication Utility

**File:** `src/lib/auth.ts`

```typescript
import { cookies } from 'next/headers';
// import jwt from 'jsonwebtoken'; // Uncomment when ready to use real JWT

interface JWTPayload {
  userId?: string;
  vendorId?: string;
  email?: string;
  role?: string;
}

/**
 * Extract and verify JWT token from cookies or headers
 * For now, this is stubbed to return vendorId: 1
 * TODO: Replace with real JWT verification when auth is fully implemented
 */
export async function verifyJwt(token: string): Promise<JWTPayload> {
  // TODO: Replace this stub with real JWT verification
  // Example implementation:
  // const secret = process.env.JWT_SECRET;
  // if (!secret) throw new Error('JWT_SECRET not configured');
  // const decoded = jwt.verify(token, secret) as JWTPayload;
  // return decoded;

  // Stub: For now, accept temp token and return default vendorId
  if (token === 'temp-jwt-token' || !token) {
    return { vendorId: '1', userId: '1' };
  }

  // In production, verify the actual JWT token here
  throw new Error('Invalid token');
}

/**
 * Get vendor ID from request (checks cookies first, then Authorization header)
 * 
 * TEMPORARY: For local development, this returns a hardcoded vendorId.
 * Replace with real auth extraction when JWT is fully implemented.
 */
export async function getVendorIdFromRequest(_request: Request): Promise<string | null> {
  // TEMPORARY: Local development only
  // Use your seeded vendor ID from Prisma Studio / seed script
  return 'cmipm4d6v0000sosgqvb8tp63'; // Sparkle Cleaning Pro (Cesar)
}
```

---

## File 7: Database Client

**File:** `src/server/db.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Construct connection string programmatically to avoid parsing issues
function getDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL;
  
  if (dbUrl) {
    // Log the actual connection string (first 80 chars for security)
    console.log('[db.ts] DATABASE_URL from env, length:', dbUrl.length);
    console.log('[db.ts] DATABASE_URL preview:', dbUrl.substring(0, 80) + '...');
    
    // Check if it contains the problematic encoding
    if (dbUrl.includes('%2320') || dbUrl.includes('%23')) {
      console.warn('[db.ts] WARNING: Connection string contains %23 (#) encoding - this may cause issues');
    }
    
    return dbUrl;
  }
  
  // Fallback: construct from individual env vars if needed
  // This is just for testing - you should use DATABASE_URL
  throw new Error('DATABASE_URL environment variable is not set');
}

let prisma: PrismaClient;

try {
  const connectionString = getDatabaseUrl();
  
  // Try creating PrismaClient with explicit connection string
  prisma = globalForPrisma.prisma ?? new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
  }
} catch (error: any) {
  console.error('[db.ts] ERROR creating PrismaClient:', error.message);
  console.error('[db.ts] Error name:', error.name);
  if (error.stack) {
    console.error('[db.ts] Error stack:', error.stack);
  }
  throw error;
}

export { prisma };
```

---

## Summary

All files have been displayed above. The "Back to Dashboard" button has been removed from the profile page along with the unused `ArrowLeft` and `Link` imports.

**Changes Made:**
- ✅ Removed `ArrowLeft` from lucide-react imports
- ✅ Removed `Link` from next/link import
- ✅ Removed the "Back to Dashboard" button and its wrapper div (lines 216-223)

**Status:** All code displayed and button removed successfully.



