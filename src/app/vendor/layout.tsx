'use client';
import type { LucideIcon } from 'lucide-react';
import { Users, HardDrive, Star, Briefcase, DollarSign, HelpCircle, LogOut, AlertTriangle, Home } from 'lucide-react';
import { Button } from '../../components/ui/button';
import Link from 'next/link';
import ProfileHeader from '../../components/ProfileHeader';
import { useVendorProfile } from '@/hooks/useVendorProfile';

type SidebarLink = {
  label: string;
  icon: LucideIcon;
  href: string;
  alert?: boolean;
  badge?: number | string;
};

const sidebarLinks: SidebarLink[] = [
  { label: 'Dashboard', icon: Home, href: '/vendor/dashboard' },
  { label: 'Profile & Settings', icon: Users, href: '/vendor/profile' },
  { label: 'View Reviews', icon: Star, href: '/vendor/reviews' },
  { label: 'Manage Jobs', icon: Briefcase, href: '/vendor/jobs' },
  { label: 'Employees', icon: Users, href: '/vendor/employees' },
  { label: 'Billing & Earnings', icon: DollarSign, href: '/vendor/billing' },
  { label: 'Support & Help', icon: HelpCircle, href: '/vendor/support' },
  { label: 'Logout', icon: LogOut, href: '/logout' },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const { data: vendorProfile } = useVendorProfile();
  const vendorDisplayName =
    vendorProfile?.businessName ||
    vendorProfile?.name ||
    [vendorProfile?.firstName, vendorProfile?.lastName].filter(Boolean).join(" ") ||
    "Vendor Account";
  const vendorCategory = vendorProfile?.category || vendorProfile?.businessType || "Vendor";

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
              <div className="font-semibold text-lg mb-1">{vendorDisplayName}</div>
              <div className="text-blue-100 text-sm">{vendorCategory}</div>
              <div className="mt-2">
                <span className="px-2 py-1 bg-white/20 text-white text-xs rounded-full">
                  {vendorProfile ? 'Verified Vendor' : 'Vendor Context Loading'}
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
          userData={
            vendorProfile
              ? {
                  id: vendorProfile.id,
                  firstName: vendorProfile.firstName || '',
                  lastName: vendorProfile.lastName || '',
                  email: vendorProfile.email || '',
                  businessName: vendorProfile.businessName || '',
                  category: vendorProfile.category || '',
                  profilePhoto: vendorProfile.profilePhoto || undefined,
                }
              : null
          }
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