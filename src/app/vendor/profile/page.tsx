'use client';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, HardDrive, Settings, LogOut, HelpCircle, CheckCircle, XCircle, ArrowLeft, Info, User, Mail, Phone, MapPin, Clock, Shield, CreditCard, Bell, Smartphone, Wifi, Database, Activity, Zap, Eye, EyeOff, QrCode, Smartphone as DeviceIcon, Database as StorageIcon, Activity as ActivityIcon, Zap as LightningIcon, Camera } from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

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
  const [profile, setProfile] = useState({
    businessName: 'Sparkle Clean Pro',
    address: '123 Main St',
    city: 'New York',
    state: 'NY',
    totalEmployees: 8,
    pairedDevice: true,
    email: 'contact@sparklecleanpro.com',
    phone: '(555) 123-4567',
    website: 'www.sparklecleanpro.com',
    businessType: 'Home Services',
    foundedYear: 2019,
    licenseNumber: 'CLEAN-2019-001',
    insuranceProvider: 'CleanShield Insurance',
    insuranceExpiry: '2025-12-31',
    // Enhanced fields for user service detail page
    yearsInBusiness: 5,
    insuranceStatus: true,
    bondingStatus: true,
    serviceAreas: ['Downtown', 'Midtown', 'Upper East Side'],
    specializations: ['Deep Cleaning', 'Eco-friendly', 'Same Day Service'],
    responseTimeSettings: '2 hours',
    emergencyContact: '(555) 987-6543',
    // New fields
    bio: 'Professional cleaning services with over 5 years of experience. We specialize in residential and commercial cleaning with eco-friendly products and same-day service options.',
    profilePhoto: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&crop=center',
    serviceTypes: ['House Cleaning', 'Deep Cleaning', 'Move-in/Move-out Cleaning', 'Commercial Cleaning', 'Carpet Cleaning']
  });
  const [saving, setSaving] = useState(false);
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

  // Countdown effect
  useEffect(() => {
    if (!showPairModal) return;
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [showPairModal, countdown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleAddressInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddressQuery(e.target.value);
    setProfile({ ...profile, address: e.target.value });
    if (e.target.value.length > 2) {
      setAddressSuggestions(mockAddresses.filter(addr => addr.toLowerCase().includes(e.target.value.toLowerCase())));
    } else {
      setAddressSuggestions([]);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setProfile({ ...profile, address: suggestion });
    setAddressQuery(suggestion);
    setAddressSuggestions([]);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 1000);
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
      <main className="flex-1 p-8 flex gap-8 max-w-7xl mx-auto">
        {/* Profile Form */}
        <section className="flex-1 max-w-2xl space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/vendor">
              <Button variant="outline" size="sm" className="bg-white shadow-sm hover:shadow-md transition-shadow">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>

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
                        src={profile.profilePhoto} 
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
                      value={profile.businessName} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Business Type</label>
                    <Input 
                      name="businessType" 
                      value={profile.businessType} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Business Bio Section */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-gray-700">Business Bio</label>
                  <textarea
                    name="bio"
                    value={profile.bio}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Tell customers about your business, experience, and what makes you unique..."
                  />
                  <p className="text-sm text-gray-500 mt-1">This will be displayed on your service listings and profile page</p>
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
                          checked={profile.serviceTypes.includes(serviceType)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setProfile({
                                ...profile,
                                serviceTypes: [...profile.serviceTypes, serviceType]
                              });
                            } else {
                              setProfile({
                                ...profile,
                                serviceTypes: profile.serviceTypes.filter(type => type !== serviceType)
                              });
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
                  <p className="text-sm text-gray-500 mt-2">Selected: {profile.serviceTypes.length} service types</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Business Address</label>
                  <div className="relative">
                    <Input
                      name="address"
                      value={addressQuery || profile.address}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">City</label>
                    <Input 
                      name="city" 
                      value={profile.city} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">State</label>
                    <Input 
                      name="state" 
                      value={profile.state} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Founded Year</label>
                    <Input 
                      name="foundedYear" 
                      type="number"
                      value={profile.foundedYear} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Email</label>
                    <Input 
                      name="email" 
                      type="email"
                      value={profile.email} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Phone</label>
                    <Input 
                      name="phone" 
                      value={profile.phone} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Enhanced Performance Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Years in Business</label>
                    <Input 
                      name="yearsInBusiness" 
                      type="number"
                      value={profile.yearsInBusiness} 
                      onChange={handleChange}
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
                      checked={profile.insuranceStatus}
                      onChange={(e) => setProfile({...profile, insuranceStatus: e.target.checked})}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="text-sm font-medium text-gray-700">Insured</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="bondingStatus"
                      checked={profile.bondingStatus}
                      onChange={(e) => setProfile({...profile, bondingStatus: e.target.checked})}
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
                      value={profile.licenseNumber} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Total Employees</label>
                    <Input 
                      name="totalEmployees" 
                      type="number" 
                      value={profile.totalEmployees} 
                      onChange={handleChange}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="font-medium text-blue-800">Device Pairing Status:</span>
                  {profile.pairedDevice ? (
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
                      <div className="text-sm text-gray-600">Auto-send after job completion</div>
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
                    Enable Reliance Payments to bill your customers and receive payouts directly through the platform.
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
                  <span className="text-sm text-gray-600">Two-Factor Auth</span>
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
    </div>
  );
} 