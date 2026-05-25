'use client';
import type { LucideIcon } from 'lucide-react';
import {
  Users,
  Star,
  Briefcase,
  HelpCircle,
  LogOut,
  Home,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import ProfileToggle from '@/components/ProfileToggle';
import { useAvailableRoles } from '@/hooks/useAvailableRoles';

// TODO Future mobile: convert this sidebar into a bottom nav or slide-out
// drawer for an app-like experience on small screens. The sidebar is hidden
// below `md` for now so the main column owns the viewport on mobile, and a
// future commit should add a hamburger trigger + responsive drawer.

type SidebarLink = {
  label: string;
  icon: LucideIcon;
  href: string;
};

const sidebarLinks: SidebarLink[] = [
  { label: 'Dashboard', icon: Home, href: '/vendor/dashboard' },
  { label: 'Telemetry', icon: Activity, href: '/vendor/telemetry' },
  { label: 'Profile & Settings', icon: Users, href: '/vendor/profile' },
  { label: 'View Reviews', icon: Star, href: '/vendor/reviews' },
  { label: 'Manage Jobs', icon: Briefcase, href: '/vendor/jobs' },
  { label: 'Employees', icon: Users, href: '/vendor/employees' },
  { label: 'Support & Help', icon: HelpCircle, href: '/vendor/support' },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const { data: vendorProfile } = useVendorProfile();
  const { availableRoles, userId } = useAvailableRoles('vendor');
  const pathname = usePathname() || '';

  const vendorBusinessName =
    vendorProfile?.businessName ||
    vendorProfile?.name ||
    'Vendor Account';
  const vendorUserName = [vendorProfile?.firstName, vendorProfile?.lastName]
    .filter(Boolean)
    .join(' ');
  const vendorSecondary =
    vendorUserName || vendorProfile?.email || '';
  const vendorAvatar = vendorProfile?.profilePhoto || null;
  const vendorInitials = vendorBusinessName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'V';

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar — hidden below md (see mobile TODO above). */}
      <aside className="hidden md:flex w-64 flex-col min-h-screen">
        {/* Logo area */}
        <div className="bg-white flex items-center px-6 py-8 border-b border-gray-200 justify-center">
          <img src="/reliance-logo.png" alt="Reliance Logo" className="w-32 h-32 rounded" />
        </div>

        {/* Navigation area */}
        <div className="flex-1 bg-blue-800 text-white flex flex-col py-8 px-4">
          {/* Identity block — business-first */}
          <div className="flex flex-col items-center mb-8 px-2">
            <div className="relative mb-4">
              {vendorAvatar ? (
                <img
                  src={vendorAvatar}
                  alt={vendorBusinessName}
                  className="w-16 h-16 rounded-full border-2 border-white/20 shadow-md object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-white/20 shadow-md bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                  {vendorInitials}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full" />
              </div>
            </div>
            <div className="text-center min-w-0 w-full">
              <div className="font-semibold text-lg mb-1 truncate">{vendorBusinessName}</div>
              {vendorSecondary && (
                <div className="text-blue-100 text-sm break-all">{vendorSecondary}</div>
              )}
              {vendorProfile && (
                <div className="mt-2">
                  <span className="px-2 py-1 bg-white/20 text-white text-xs rounded-full">
                    Vendor
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 space-y-1">
            <div className="text-xs font-semibold text-blue-200 uppercase tracking-wider mb-4 px-3">
              Navigation
            </div>
            {sidebarLinks.map((link) => {
              const isActive =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white hover:bg-blue-700'
                  }`}
                >
                  <link.icon size={18} />
                  <span className="flex-1 truncate">{link.label}</span>
                </Link>
              );
            })}

            <div className="mt-4 pt-4 border-t border-white/20">
              <Link
                href="/logout"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-white hover:bg-blue-700 transition-colors text-base font-medium"
              >
                <LogOut size={18} />
                Log Out
              </Link>
            </div>
          </nav>

          {/* Footer */}
          <div className="pt-4 mt-4 border-t border-white/20 text-center">
            <div className="text-xs text-blue-200">Reliance</div>
            <div className="text-xs text-blue-300">© 2024 All rights reserved</div>
          </div>
        </div>
      </aside>

      {/* Main column — no top profile header anymore; identity lives in the
          sidebar, and the role toggle sits above the page content. */}
      <main className="flex-1 flex flex-col overflow-auto">
        <div className="flex-1 overflow-x-hidden">
          <div className="w-full max-w-6xl px-6 pt-10 pb-6">
            {availableRoles.length > 1 ? (
              <div className="mb-6 flex items-center justify-end">
                <ProfileToggle
                  currentProfile="vendor"
                  availableProfiles={availableRoles}
                  userId={userId}
                />
              </div>
            ) : null}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
