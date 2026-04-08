# Vendor Dashboard Page Files

## 0. Type Definitions
**File:** `src/types/vendor.ts`

```tsx
// src/types/vendor.ts

export interface VendorDashboardProfile {
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
  id: number;
  title: string;
  client: string;
  amount: number;
  status: 'completed' | 'in progress' | 'scheduled';
  date: string; // ISO string
}

export interface VendorReview {
  id: number;
  client: string;
  rating: number;
  comment: string;
  date: string;
  jobType: string;
}

export interface VendorInsight {
  id: number;
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
}

export interface VendorNotification {
  id: number;
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
```

---

## 1. Main Dashboard Page
**File:** `src/app/vendor/dashboard/page.tsx`

```tsx
"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Calendar, DollarSign, Users, Star, TrendingUp } from 'lucide-react';
import { VendorDashboardProfile, VendorJob, VendorReview, VendorInsight, VendorNotification } from '@/types/vendor';

export default function VendorDashboard() {
  // All hooks must be declared at the top, before any conditional returns
  const [vendorData, setVendorData] = useState<VendorDashboardProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showProfileCard, setShowProfileCard] = useState(true);
  const [showAvailability, setShowAvailability] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Mock data for demo/investor presentations
  const [clients] = useState([
    { id: 1, name: 'Sarah Johnson', email: 'sarah@email.com', phone: '555-1234', jobs: 5, totalValue: 850, status: 'active', lastContact: '2024-06-15', notes: 'Prefers morning appointments.', tags: ['VIP', 'Regular'], avatar: 'https://randomuser.me/api/portraits/women/44.jpg' },
    { id: 2, name: 'Mike Chen', email: 'mike@email.com', phone: '555-5678', jobs: 3, totalValue: 420, status: 'active', lastContact: '2024-06-10', notes: 'Always pays on time.', tags: ['Punctual'], avatar: 'https://randomuser.me/api/portraits/men/45.jpg' },
    { id: 3, name: 'Lisa Rodriguez', email: 'lisa@email.com', phone: '555-8765', jobs: 2, totalValue: 280, status: 'active', lastContact: '2024-06-12', notes: 'Requested eco-friendly products.', tags: ['Eco-friendly'], avatar: 'https://randomuser.me/api/portraits/women/46.jpg' },
    { id: 4, name: 'David Wilson', email: 'david@email.com', phone: '555-4321', jobs: 1, totalValue: 150, status: 'inactive', lastContact: '2024-05-20', notes: 'New client, first job completed.', tags: ['New'], avatar: 'https://randomuser.me/api/portraits/men/47.jpg' },
    { id: 5, name: 'Emily Brown', email: 'emily@email.com', phone: '555-9876', jobs: 4, totalValue: 620, status: 'active', lastContact: '2024-06-14', notes: 'Lives in downtown area.', tags: ['Downtown', 'Regular'], avatar: 'https://randomuser.me/api/portraits/women/48.jpg' }
  ]);
  
  const [recentJobs] = useState<VendorJob[]>([
    { id: 1, title: 'Kitchen Sink Repair', client: 'Sarah Johnson', amount: 120.00, status: 'completed', date: '2024-01-10' },
    { id: 2, title: 'Bathroom Faucet Installation', client: 'Mike Chen', amount: 95.00, status: 'completed', date: '2024-01-08' },
    { id: 3, title: 'Garbage Disposal Repair', client: 'Lisa Rodriguez', amount: 150.00, status: 'in progress', date: '2024-01-12' },
    { id: 4, title: 'Drain Cleaning', client: 'David Wilson', amount: 85.00, status: 'scheduled', date: '2024-01-15' },
    { id: 5, title: 'Water Heater Inspection', client: 'Emily Brown', amount: 65.00, status: 'scheduled', date: '2024-01-18' }
  ]);
  
  const [recentReviews] = useState<VendorReview[]>([
    { id: 1, client: 'Sarah Johnson', rating: 5, comment: 'Excellent service, very professional! Fixed my sink quickly and cleaned up after.', date: '2024-01-10', jobType: 'Kitchen Sink Repair' },
    { id: 2, client: 'Mike Chen', rating: 5, comment: 'Great work, on time and clean. Would definitely hire again.', date: '2024-01-08', jobType: 'Bathroom Faucet Installation' },
    { id: 3, client: 'David Wilson', rating: 4, comment: 'Good service, would recommend. Minor issue with timing but quality work.', date: '2024-01-05', jobType: 'Drain Cleaning' },
    { id: 4, client: 'Emily Brown', rating: 5, comment: 'Outstanding! Professional, punctual, and excellent work quality.', date: '2024-01-03', jobType: 'Water Heater Repair' }
  ]);
  
  const [insights] = useState<VendorInsight[]>([
    { id: 1, title: 'Peak Booking Times', value: '2-4 PM', change: '+15%', trend: 'up' },
    { id: 2, title: 'Most Requested Service', value: 'Deep Cleaning', change: '+8%', trend: 'up' },
    { id: 3, title: 'Client Retention Rate', value: '87%', change: '+3%', trend: 'up' },
    { id: 4, title: 'Average Job Duration', value: '2.5 hrs', change: '-5%', trend: 'down' }
  ]);
  
  const [notifications] = useState<VendorNotification[]>([
    { id: 1, type: 'job', title: 'New Booking Request', message: 'Sarah Johnson requested a deep cleaning for tomorrow', time: '2 hours ago', read: false, priority: 'high' },
    { id: 2, type: 'review', title: 'New Review Posted', message: 'Mike Chen left a 5-star review for your services', time: '4 hours ago', read: false, priority: 'medium' },
    { id: 3, type: 'payment', title: 'Payment Received', message: 'Payment of $150 received from Emily Rodriguez', time: '1 day ago', read: true, priority: 'low' },
    { id: 4, type: 'reminder', title: 'Follow-up Reminder', message: 'Follow up with David Kim about recurring service', time: '2 days ago', read: true, priority: 'medium' }
  ]);

  // Fetch vendor profile data on component mount
  useEffect(() => {
    const fetchVendorData = async () => {
      try {
        const response = await fetch('/api/vendor/profile', {
          headers: {
            'Authorization': 'Bearer temp-jwt-token'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setVendorData(data.profile);
        } else {
          setError('Failed to fetch vendor data');
        }
      } catch (error) {
        console.error('Error fetching vendor data:', error);
        setError('Failed to fetch vendor data');
      } finally {
        setLoading(false);
      }
    };

    fetchVendorData();
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Display vendor registration data at the top
  const renderVendorInfo = () => {
    if (!vendorData) return null;

    return (
      <div className="mb-8">
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Welcome, {vendorData.firstName} {vendorData.lastName}!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold text-gray-700">Business Information</h4>
                <p className="text-sm text-gray-600">Business: {vendorData.businessName}</p>
                <p className="text-sm text-gray-600">Type: {vendorData.businessType}</p>
                <p className="text-sm text-gray-600">Category: {vendorData.category}</p>
                <p className="text-sm text-gray-600">Founded: {vendorData.foundedYear}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700">Contact Information</h4>
                <p className="text-sm text-gray-600">Email: {vendorData.email}</p>
                <p className="text-sm text-gray-600">Phone: {vendorData.phone}</p>
                <p className="text-sm text-gray-600">Location: {vendorData.city}, {vendorData.state}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700">Services</h4>
                <p className="text-sm text-gray-600">
                  Service Types: {Array.isArray(vendorData.serviceTypes) ? vendorData.serviceTypes.join(', ') : vendorData.serviceTypes}
                </p>
                <p className="text-sm text-gray-600">
                  Specializations: {Array.isArray(vendorData.specializations) ? vendorData.specializations.join(', ') : vendorData.specializations}
                </p>
                <p className="text-sm text-gray-600">
                  Service Areas: {Array.isArray(vendorData.serviceAreas) ? vendorData.serviceAreas.join(', ') : vendorData.serviceAreas}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Color map for Tailwind classes - prevents class purging
  const colorMap = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
  } as const;

  // Stats using mock data for demo, or real data if available
  const stats = [
    { label: 'Total Bookings', value: vendorData?.totalBookings || recentJobs.length, icon: Calendar, color: 'blue' as keyof typeof colorMap },
    { label: 'Total Earnings', value: `$${vendorData?.totalEarnings || recentJobs.reduce((sum, job) => sum + job.amount, 0)}`, icon: DollarSign, color: 'green' as keyof typeof colorMap },
    { label: 'Total Clients', value: vendorData?.totalClients || clients.length, icon: Users, color: 'purple' as keyof typeof colorMap },
    { label: 'Average Rating', value: vendorData?.rating || (recentReviews.reduce((sum, review) => sum + review.rating, 0) / recentReviews.length).toFixed(1), icon: Star, color: 'yellow' as keyof typeof colorMap },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {renderVendorInfo()}
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const colors = colorMap[stat.color];
            return (
              <Card key={stat.label} className="bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-full ${colors.bg}`}>
                      <stat.icon className={`h-6 w-6 ${colors.text}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Jobs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Recent Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">{job.title}</h4>
                      <p className="text-sm text-gray-600">{job.client}</p>
                      <p className="text-xs text-gray-500">{job.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">${job.amount}</p>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        job.status === 'completed' ? 'bg-green-100 text-green-800' : 
                        job.status === 'in progress' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Reviews */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-600" />
                Recent Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentReviews.map((review) => (
                  <div key={review.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{review.client}</h4>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating ? 'text-yellow-500 fill-current' : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{review.comment}</p>
                    <p className="text-xs text-gray-500">{review.date}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Insights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {insights.map((insight) => (
            <Card key={insight.id} className="bg-white">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">{insight.title}</p>
                  <p className="text-xl font-bold text-gray-900">{insight.value}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <TrendingUp className={`h-4 w-4 ${
                      insight.trend === 'up' ? 'text-green-500' : 'text-red-500'
                    }`} />
                    <span className={`text-sm ${
                      insight.trend === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {insight.change}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Notifications */}
        <Card className="bg-white mb-8">
          <CardHeader>
            <CardTitle>Recent Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div key={notification.id} className={`flex items-center gap-3 p-3 rounded-lg ${
                  notification.read ? 'bg-gray-50' : 'bg-blue-50'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    notification.priority === 'high' ? 'bg-red-500' : 
                    notification.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                  }`} />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{notification.title}</h4>
                    <p className="text-sm text-gray-600">{notification.message}</p>
                    <p className="text-xs text-gray-500">{notification.time}</p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                onClick={() => setShowAvailability(!showAvailability)}
                className="w-full h-20 text-lg"
                variant="outline"
              >
                <Calendar className="h-6 w-6 mr-2" />
                Manage Availability
              </Button>
              <Button 
                onClick={() => setShowPricing(!showPricing)}
                className="w-full h-20 text-lg"
                variant="outline"
              >
                <DollarSign className="h-6 w-6 mr-2" />
                Update Pricing
              </Button>
              <Button 
                className="w-full h-20 text-lg"
                variant="outline"
              >
                <TrendingUp className="h-6 w-6 mr-2" />
                View Analytics
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## 2. Vendor Layout (Sidebar & Header)
**File:** `src/app/vendor/layout.tsx`

```tsx
'use client';
import { Users, HardDrive, Star, Briefcase, DollarSign, HelpCircle, LogOut, AlertTriangle, Home } from 'lucide-react';
import { Button } from '../../components/ui/button';
import Link from 'next/link';
import ProfileHeader from '../../components/ProfileHeader';

const sidebarLinks = [
  { label: 'Dashboard', icon: Home, href: '/vendor' },
  { label: 'Profile & Settings', icon: Users, href: '/vendor/profile' },
  { label: 'View Reviews', icon: Star, href: '/vendor/reviews' },
  { label: 'Manage Jobs', icon: Briefcase, href: '/vendor/jobs' },
  { label: 'Employees', icon: Users, href: '/vendor/employees' },
  { label: 'Billing & Earnings', icon: DollarSign, href: '/vendor/billing' },
  { label: 'Support & Help', icon: HelpCircle, href: '/vendor/support' },
  { label: 'Logout', icon: LogOut, href: '/logout' },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col min-h-screen">
        {/* Logo area - white background */}
        <div className="bg-white flex items-center px-6 py-8 border-b border-gray-200 justify-center">
          <img src="/reliance-logo.png" alt="Reliance Logo" className="w-32 h-32 rounded" />
        </div>
        {/* Blue navigation area */}
        <div className="flex-1 bg-blue-800 text-white flex flex-col py-8 px-4">
          {/* Vendor Profile Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <img
                src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&crop=center"
                alt="Business Profile"
                className="w-16 h-16 rounded-full border-2 border-white/20 shadow-md object-cover"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-lg mb-1">Sparkle Clean Pro</div>
              <div className="text-blue-100 text-sm">Professional Cleaning</div>
              <div className="mt-2">
                <span className="px-2 py-1 bg-white/20 text-white text-xs rounded-full">
                  Verified Vendor
                </span>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {sidebarLinks.map((link, idx) => (
              <div key={link.label} className="relative">
                {link.href ? (
                  <Link href={link.href}>
                    <Button 
                      variant="ghost" 
                      className={`w-full justify-start text-white hover:bg-blue-700 rounded-lg px-3 py-2 text-base font-medium ${
                        link.alert ? 'bg-red-600 hover:bg-red-700 animate-pulse' : ''
                      }`}
                    >
                      <link.icon className="w-5 h-5 mr-3" />
                      {link.label}
                      {link.badge && (
                        <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          {link.badge}
                        </span>
                      )}
                    </Button>
                  </Link>
                ) : (
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start text-white hover:bg-blue-700 rounded-lg px-3 py-2 text-base font-medium ${
                      link.alert ? 'bg-red-600 hover:bg-red-700 animate-pulse' : ''
                    }`}
                  >
                    <link.icon className="w-5 h-5 mr-3" />
                    {link.label}
                    {link.badge && (
                      <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        {link.badge}
                      </span>
                    )}
                  </Button>
                )}
                {/* Insert toggles directly after Logout button */}
                {link.label === 'Logout' && (
                  <div className="flex flex-col gap-2 mt-4">
                    <button
                      className="flex items-center gap-2 border border-yellow-400 text-yellow-400 px-3 py-2 rounded hover:bg-yellow-50 hover:text-blue-800 transition-colors font-medium"
                      onClick={() => window.location.href = '/admin/dashboard'}
                    >
                      <span className="w-4 h-4 inline-block">🏛️</span>
                      Switch to Admin View
                    </button>
                    <button
                      className="flex items-center gap-2 border border-green-400 text-green-400 px-3 py-2 rounded hover:bg-green-50 hover:text-blue-800 transition-colors font-medium"
                      onClick={() => window.location.href = '/user-dashboard'}
                    >
                      <span className="w-4 h-4 inline-block">👤</span>
                      Switch to User View
                    </button>
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="mt-auto text-xs text-blue-200 px-2 mb-4">Reliance © 2023</div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col">
        {/* Profile Header with Toggle */}
        <ProfileHeader 
          userData={{
            id: 'vendor-1',
            firstName: 'John',
            lastName: 'Smith',
            email: 'john@techsolutions.com',
            businessName: 'Sparkle Clean Pro',
            category: 'Professional Cleaning'
          }} 
          currentProfile="vendor"
          className="sticky top-0 z-40"
        />
        
        {/* Main Content */}
        <div className="flex-1 px-4 md:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

---

## 3. ProfileHeader Component
**File:** `src/components/ProfileHeader.tsx`

```tsx
'use client';
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { User, Briefcase, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ProfileToggle from './ProfileToggle';

interface ProfileHeaderProps {
  userData: any;
  currentProfile: 'customer' | 'vendor';
  className?: string;
}

export default function ProfileHeader({ 
  userData, 
  currentProfile,
  className = '' 
}: ProfileHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<('customer' | 'vendor')[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Determine available profiles based on user data
    const profiles: ('customer' | 'vendor')[] = ['customer'];
    
    // If user has vendor data, add vendor profile
    if (userData?.businessName || userData?.category) {
      profiles.push('vendor');
    }
    
    setAvailableProfiles(profiles);
  }, [userData]);

  const handleLogout = () => {
    // Clear local storage
    localStorage.removeItem('userData');
    localStorage.removeItem('authToken');
    sessionStorage.clear();
    
    // Redirect to login
    router.push('/auth/login');
  };

  const handleProfileSettings = () => {
    if (currentProfile === 'vendor') {
      router.push('/vendor/profile');
    } else {
      router.push('/profile-settings');
    }
    setIsDropdownOpen(false);
  };

  const getProfileIcon = (profile: 'customer' | 'vendor') => {
    return profile === 'customer' ? <User className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />;
  };

  const getProfileLabel = (profile: 'customer' | 'vendor') => {
    return profile === 'customer' ? 'Customer' : 'Vendor';
  };

  const getProfileColor = (profile: 'customer' | 'vendor') => {
    return profile === 'customer' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
  };

  if (!userData) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between p-4 bg-white border-b border-gray-200 ${className}`}>
      {/* Left side - Profile info */}
      <div className="flex items-center gap-4">
        <Avatar className="w-10 h-10">
          <AvatarImage src={userData.avatar || userData.profilePhoto} alt={userData.firstName} />
          <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
            {userData.firstName?.charAt(0)}{userData.lastName?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {userData.firstName} {userData.lastName}
          </h2>
          <div className="flex items-center gap-2">
            <Badge className={getProfileColor(currentProfile)}>
              {getProfileIcon(currentProfile)}
              {getProfileLabel(currentProfile)}
            </Badge>
            {availableProfiles.length > 1 && (
              <span className="text-sm text-gray-500">
                • {availableProfiles.length} profiles available
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-3">
        {/* Profile Toggle - Only show if multiple profiles available */}
        {availableProfiles.length > 1 && (
          <ProfileToggle
            currentProfile={currentProfile}
            availableProfiles={availableProfiles}
            userId={userData.id}
          />
        )}

        {/* Profile Menu Dropdown */}
        <div className="relative">
          <Button
            variant="ghost"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </Button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <div className="p-2">
                <button
                  onClick={handleProfileSettings}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Profile Settings
                </button>
                
                <hr className="my-2" />
                
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md hover:bg-gray-50 transition-colors text-red-600 hover:text-red-700"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 4. ProfileToggle Component
**File:** `src/components/ProfileToggle.tsx`

```tsx
'use client';
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { User, Briefcase, ChevronDown, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProfileToggleProps {
  currentProfile: 'customer' | 'vendor';
  availableProfiles: ('customer' | 'vendor')[];
  userId: string;
  className?: string;
}

export default function ProfileToggle({ 
  currentProfile, 
  availableProfiles, 
  userId,
  className = '' 
}: ProfileToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeProfile, setActiveProfile] = useState(currentProfile);
  const router = useRouter();

  // Update active profile when prop changes
  useEffect(() => {
    setActiveProfile(currentProfile);
  }, [currentProfile]);

  const handleProfileSwitch = async (targetProfile: 'customer' | 'vendor') => {
    if (targetProfile === activeProfile) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/profile/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || 'temp-jwt-token'}`
        },
        body: JSON.stringify({
          userId,
          targetProfileType: targetProfile
        })
      });

      if (response.ok) {
        const data = await response.json();
        setActiveProfile(targetProfile);
        
        // Navigate to the appropriate dashboard
        if (targetProfile === 'vendor') {
          router.push('/vendor/dashboard');
        } else {
          router.push('/user-dashboard');
        }
        
        setIsOpen(false);
      } else {
        const error = await response.json();
        console.error('Profile switch failed:', error);
        alert('Failed to switch profile. Please try again.');
      }
    } catch (error) {
      console.error('Profile switch error:', error);
      alert('Failed to switch profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getProfileIcon = (profile: 'customer' | 'vendor') => {
    return profile === 'customer' ? <User className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />;
  };

  const getProfileLabel = (profile: 'customer' | 'vendor') => {
    return profile === 'customer' ? 'Customer' : 'Vendor';
  };

  const getProfileColor = (profile: 'customer' | 'vendor') => {
    return profile === 'customer' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 min-w-[140px] justify-between"
      >
        <div className="flex items-center gap-2">
          {getProfileIcon(activeProfile)}
          <span className="hidden sm:inline">{getProfileLabel(activeProfile)}</span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 px-2 py-1 mb-2">
              Switch Profile
            </div>
            
            {availableProfiles.map((profile) => (
              <button
                key={profile}
                onClick={() => handleProfileSwitch(profile)}
                disabled={isLoading}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md hover:bg-gray-50 transition-colors ${
                  profile === activeProfile ? 'bg-gray-100' : ''
                }`}
              >
                {getProfileIcon(profile)}
                <span className="flex-1">{getProfileLabel(profile)}</span>
                {profile === activeProfile && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 rounded-md flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
}
```

---

## 5. UI Components

### Card Component
**File:** `src/components/ui/card.tsx`

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

### Button Component
**File:** `src/components/ui/button.tsx`

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

### Badge Component
**File:** `src/components/ui/badge.tsx`

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-transparent bg-green-500 text-white hover:bg-green-500/80",
        warning:
          "border-transparent bg-yellow-500 text-white hover:bg-yellow-500/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

### Avatar Component
**File:** `src/components/ui/avatar.tsx`

```tsx
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl"
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 w-8",
      md: "h-10 w-10", 
      lg: "h-12 w-12",
      xl: "h-16 w-16"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full",
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
Avatar.displayName = "Avatar"

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: "sm" | "md" | "lg" | "xl"
}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 w-8",
      md: "h-10 w-10",
      lg: "h-12 w-12", 
      xl: "h-16 w-16"
    }

    return (
      <img
        ref={ref}
        className={cn("aspect-square h-full w-full object-cover", className)}
        {...props}
      />
    )
  }
)
AvatarImage.displayName = "AvatarImage"

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl"
}

const AvatarFallback = React.forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 w-8 text-sm",
      md: "h-10 w-10 text-sm",
      lg: "h-12 w-12 text-base",
      xl: "h-16 w-16 text-lg"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full bg-gray-200 text-gray-600 font-medium",
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
```

---

## Notes

1. **Dependencies**: These components require:
   - `lucide-react` for icons
   - `next/navigation` for routing
   - `@radix-ui/react-slot` for Button component
   - `class-variance-authority` for variant management
   - `@/lib/utils` for `cn` utility function (typically a Tailwind class merger)

2. **Refactoring Applied**: 
   - ✅ Removed duplicate `ProfileHeader` (layout handles it)
   - ✅ Fixed dynamic Tailwind classes using `colorMap` to prevent class purging
   - ✅ Added TypeScript interfaces for all data structures
   - ✅ Properly typed `vendorData` state

3. **Backend Integration**: The dashboard currently uses mock data. To connect to backend:
   - Create endpoint: `GET /api/vendor/dashboard`
   - Return `VendorDashboardResponse` shape
   - Update `useEffect` to fetch from `/api/vendor/dashboard` instead of `/api/vendor/profile`
   - Replace mock data with API response

4. **Styling**: Uses Tailwind CSS classes. Ensure Tailwind is properly configured in your project.

