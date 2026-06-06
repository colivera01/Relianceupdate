'use client';
import type { LucideIcon } from 'lucide-react';
import {
  Users,
  Briefcase,
  ClipboardList,
  HelpCircle,
  LogOut,
  Home,
  Activity,
  BarChart3,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import { useAuth } from '@/contexts/AuthContext';
import ProfileToggle from '@/components/ProfileToggle';
import { useAvailableRoles } from '@/hooks/useAvailableRoles';
import { RelianceLogo } from '@/components/public/RelianceLogo';

// TODO Future mobile: convert this sidebar into a bottom nav or slide-out
// drawer for an app-like experience on small screens. The sidebar is hidden
// below `md` for now so the main column owns the viewport on mobile, and a
// future commit should add a hamburger trigger + responsive drawer.

type SidebarLink = {
  label: string;
  icon: LucideIcon;
  href: string;
};

function buildVendorSupportHref(pathname: string): string {
  const returnTo = pathname || '/vendor/dashboard';
  const returnLabel = pathname.startsWith('/vendor/analytics')
    ? 'Back to Analytics & Trust'
    : pathname.startsWith('/vendor/reviews')
      ? 'Back to Reviews'
      : pathname.startsWith('/vendor/telemetry')
        ? 'Back to Telemetry'
        : pathname.startsWith('/vendor/services')
          ? 'Back to Services'
          : pathname.startsWith('/vendor/profile')
            ? 'Back to Profile & Settings'
            : pathname.startsWith('/vendor/jobs/')
              ? 'Back to Job Detail'
              : pathname.startsWith('/vendor/jobs')
                ? 'Back to Manage Jobs'
                : pathname.startsWith('/vendor/employees')
                  ? 'Back to Employees'
                  : 'Back to Vendor Dashboard';

  return `/vendor/support?returnTo=${encodeURIComponent(returnTo)}&returnLabel=${encodeURIComponent(returnLabel)}`;
}

const sidebarLinks: SidebarLink[] = [
  { label: 'Dashboard', icon: Home, href: '/vendor/dashboard' },
  { label: 'Analytics & Trust', icon: BarChart3, href: '/vendor/analytics' },
  { label: 'Reviews', icon: Star, href: '/vendor/reviews' },
  { label: 'Telemetry', icon: Activity, href: '/vendor/telemetry' },
  { label: 'Services', icon: ClipboardList, href: '/vendor/services' },
  { label: 'Profile & Settings', icon: Users, href: '/vendor/profile' },
  { label: 'Manage Jobs', icon: Briefcase, href: '/vendor/jobs' },
  { label: 'Employees', icon: Users, href: '/vendor/employees' },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const { data: vendorProfile, error, errorCode, approvalPending } = useVendorProfile();
  const { availableRoles, userId } = useAvailableRoles('vendor');
  const pathname = usePathname() || '';
  const sessionAllowsVendor =
    authUser?.userType === 'vendor' ||
    authUser?.userType === 'both' ||
    authUser?.availableProfiles?.includes('vendor');
  const isVendorOnboardingRoute =
    pathname === '/vendor/register' || pathname.startsWith('/vendor/invite/');
  const vendorSupportHref = buildVendorSupportHref(pathname);

  if (isVendorOnboardingRoute) {
    return <div className="min-h-screen">{children}</div>;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-900">Checking vendor access...</p>
          <p className="mt-2 text-sm text-slate-600">
            Reliance is confirming this vendor session before loading dashboard tools.
          </p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Vendor access required</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in with a vendor-enabled account to open dashboard, jobs, and team tools.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/auth/login?next=${encodeURIComponent(pathname || '/vendor/dashboard')}`}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!sessionAllowsVendor) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Vendor access required</h1>
          <p className="mt-2 text-sm text-slate-600">
            This signed-in account does not currently have vendor dashboard access.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/vendor/register"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Register as a vendor
            </Link>
            <Link
              href="/user-dashboard"
              className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Go to customer dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const vendorBusinessName =
    vendorProfile?.businessName ||
    vendorProfile?.name ||
    'Vendor Account';
  const vendorUserName = [vendorProfile?.firstName, vendorProfile?.lastName]
    .filter(Boolean)
    .join(' ');
  const vendorSecondary =
    vendorUserName || authUser?.email || vendorProfile?.email || '';
  const vendorAvatar = vendorProfile?.profilePhoto || null;
  const vendorInitials = vendorBusinessName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'V';
  const shouldBlockVendorTools =
    errorCode === 'VENDOR_ACCOUNT_RESTRICTED' ||
    errorCode === 'USER_ACCOUNT_RESTRICTED';
  const content = shouldBlockVendorTools ? (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <h1 className="text-2xl font-semibold text-amber-950">
        Vendor account restricted
      </h1>
      <p className="mt-2 text-sm">
        {error || 'Vendor tools are unavailable until this account is active again.'}
      </p>
      <p className="mt-4 text-sm">Public listing and vendor operations are disabled for this account state.</p>
    </div>
  ) : (
    <>
      {approvalPending ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
            Pending admin approval
          </p>
          <p className="mt-2 text-lg font-semibold">
            Your vendor account is not public yet, but you can keep finishing onboarding.
          </p>
          <p className="mt-2 text-sm text-amber-900/80">
            Continue updating your business profile and service drafts while Reliance reviews the account.
            Public listing and customer visibility only start after admin approval plus publish actions.
          </p>
        </div>
      ) : null}
      {children}
    </>
  );

  return (
    <div className="reliance-operator-shell reliance-grid-lines flex min-h-screen">
      {/* Sidebar - hidden below md (see mobile TODO above). */}
      <aside className="reliance-operator-sidebar hidden w-72 flex-col min-h-screen md:flex">
        {/* Logo area */}
        <div className="reliance-operator-sidebar-header flex items-center justify-center px-6 py-7">
          <RelianceLogo
            tone="light"
            blend
            compact
            className="justify-center"
            frameClassName="h-16 w-16"
          />
        </div>

        {/* Navigation area */}
        <div className="flex-1 text-white flex flex-col py-8 px-4">
          {/* Identity block - business-first */}
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
            {[...sidebarLinks, { label: 'Support & Help', icon: HelpCircle, href: vendorSupportHref }].map((link) => {
              const isActive =
                link.label === 'Support & Help'
                  ? pathname === '/vendor/support' || pathname.startsWith('/vendor/support/')
                  : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                key={link.label}
                href={link.href}
                className={`reliance-operator-nav-link flex items-center gap-3 px-3 py-2.5 rounded-2xl text-base font-medium transition-colors ${
                  isActive
                    ? 'reliance-operator-nav-link-active'
                    : ''
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
                className="reliance-operator-nav-link flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors text-base font-medium"
              >
                <LogOut size={18} />
                Log Out
              </Link>
            </div>
          </nav>

          {/* Footer */}
          <div className="pt-4 mt-4 border-t border-white/20 text-center">
            <div className="text-xs text-white/42">Reliance Copyright 2026</div>
          </div>
        </div>
      </aside>

      {/* Main column - no top profile header anymore; identity lives in the
          sidebar, and the role toggle sits above the page content. */}
      <main className="reliance-operator-main flex-1 flex flex-col overflow-auto">
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
            {content}
          </div>
        </div>
      </main>
    </div>
  );
}
