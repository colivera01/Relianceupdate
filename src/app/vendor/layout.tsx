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
import VendorSessionGuard from '@/components/vendor/VendorSessionGuard';
import VendorManagerRecoveryPanel from '@/components/auth/VendorManagerRecoveryPanel';
import { isVendorManagerWorkflowPath } from '@/lib/vendor-access-recovery';

// TODO Future mobile: convert this sidebar into a bottom nav or slide-out
// drawer for an app-like experience on small screens. The sidebar is hidden
// below `md` for now so the main column owns the viewport on mobile, and a
// future commit should add a hamburger trigger + responsive drawer.

type SidebarLink = {
  label: string;
  icon: LucideIcon;
  href: string;
  iconClassName: string;
};

function buildVendorSupportHref(pathname: string): string {
  const returnTo = pathname || '/vendor/dashboard';
  const returnLabel = pathname.startsWith('/vendor/analytics')
    ? 'Back to Analytics & Trust'
    : pathname.startsWith('/vendor/reviews')
      ? 'Back to Reviews'
    : pathname.startsWith('/vendor/telemetry')
        ? 'Back to Service Video Activity'
        : pathname.startsWith('/vendor/services')
          ? 'Back to Services Offered'
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
  { label: 'Dashboard', icon: Home, href: '/vendor/dashboard', iconClassName: 'text-blue-200' },
  { label: 'Analytics & Trust', icon: BarChart3, href: '/vendor/analytics', iconClassName: 'text-cyan-200' },
  { label: 'Reviews', icon: Star, href: '/vendor/reviews', iconClassName: 'text-amber-200' },
  { label: 'Service Video Activity', icon: Activity, href: '/vendor/telemetry', iconClassName: 'text-emerald-200' },
  { label: 'Services Offered', icon: ClipboardList, href: '/vendor/services', iconClassName: 'text-sky-200' },
  { label: 'Profile & Settings', icon: Users, href: '/vendor/profile', iconClassName: 'text-violet-200' },
  { label: 'Manage Jobs', icon: Briefcase, href: '/vendor/jobs', iconClassName: 'text-orange-200' },
  { label: 'Employees', icon: Users, href: '/vendor/employees', iconClassName: 'text-teal-200' },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const {
    data: vendorProfile,
    error,
    errorCode,
    approvalPending,
    loading: vendorProfileLoading,
    hasResolvedVendorContext,
  } = useVendorProfile();
  const { availableRoles, userId } = useAvailableRoles('vendor');
  const pathname = usePathname() || '';
  const isVendorManagerWorkflow = isVendorManagerWorkflowPath(pathname);
  const hasLiveVendorAccess =
    Boolean(vendorProfile?.id) ||
    approvalPending ||
    hasResolvedVendorContext;
  const isVendorOnboardingRoute =
    pathname === '/vendor/register' || pathname.startsWith('/vendor/invite/');
  const vendorSupportHref = buildVendorSupportHref(pathname);
  const hasCustomerVendorLinkedAccess =
    availableRoles.includes('customer') && availableRoles.includes('vendor');
  const mobileVendorLinks = [
    sidebarLinks[0],
    sidebarLinks[4],
    sidebarLinks[6],
    sidebarLinks[7],
    sidebarLinks[5],
  ];

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
    if (isVendorManagerWorkflow) {
      return (
        <VendorManagerRecoveryPanel
          authenticated={false}
          fallbackPath={pathname || '/vendor/jobs'}
        />
      );
    }
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

  if (!hasLiveVendorAccess && vendorProfileLoading) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-900">Checking vendor access...</p>
          <p className="mt-2 text-sm text-slate-600">
            Reliance is confirming whether this signed-in account has active vendor access.
          </p>
        </div>
      </div>
    );
  }

  if (!hasLiveVendorAccess) {
    if (isVendorManagerWorkflow) {
      return (
        <VendorManagerRecoveryPanel
          authenticated
          fallbackPath={pathname || '/vendor/jobs'}
        />
      );
    }
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
            Continue updating your business profile and saved services while Reliance reviews the account.
            Public listing and customer visibility only start after admin approval plus publish actions.
          </p>
        </div>
      ) : null}
      {children}
    </>
  );

  return (
    <div className="reliance-operator-shell reliance-grid-lines flex min-h-screen">
      <VendorSessionGuard />
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
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 p-1.5 shadow-lg shadow-blue-950/30 ring-1 ring-blue-300/10">
                  <img
                    src={vendorAvatar}
                    alt={vendorBusinessName}
                    className="h-full w-full rounded-[1.35rem] object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-2 border-white/20 bg-gradient-to-r from-blue-500 to-purple-500 text-xl font-bold text-white shadow-md">
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
            {[
              ...sidebarLinks,
              { label: 'Support & Help', icon: HelpCircle, href: vendorSupportHref, iconClassName: 'text-cyan-200' },
            ].map((link) => {
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
                  <link.icon size={18} className={`shrink-0 ${link.iconClassName}`} />
                  <span className="flex-1 truncate">{link.label}</span>
                </Link>
              );
            })}

            <div className="mt-4 pt-4 border-t border-white/20">
              <Link
                href="/logout"
                className="reliance-operator-nav-link flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors text-base font-medium"
              >
                <LogOut size={18} className="shrink-0 text-rose-200" />
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
      <main className="reliance-operator-main min-w-0 flex-1 flex flex-col overflow-auto">
        <div className="flex-1 overflow-x-hidden">
          <div className="w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 sm:pt-10 md:pb-6">
            {availableRoles.length > 1 ? (
              <div className="mb-6 rounded-[28px] border border-white/10 bg-white/6 px-5 py-4 shadow-[0_18px_60px_rgba(4,9,20,0.18)] backdrop-blur-xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/78">
                      Linked account access
                    </p>
                    <p className="text-sm font-medium text-white">
                      {hasCustomerVendorLinkedAccess
                        ? 'This sign-in is connected to both your customer and vendor views.'
                        : 'This sign-in can switch between multiple Reliance roles.'}
                    </p>
                    <p className="text-sm leading-6 text-white/68">
                      {hasCustomerVendorLinkedAccess
                        ? 'Move between requesting service as a customer and managing your business as a vendor without signing out.'
                        : 'Use the toggle to move between the areas this account can access.'}
                    </p>
                  </div>
                  <ProfileToggle
                    currentProfile="vendor"
                    availableProfiles={availableRoles}
                    userId={userId}
                    className="shrink-0"
                  />
                </div>
              </div>
            ) : null}
            {content}
          </div>
        </div>
      </main>
      <nav
        aria-label="Vendor mobile navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#050a13]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-18px_45px_rgba(2,6,14,0.42)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {mobileVendorLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold leading-tight transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-[0_10px_28px_rgba(36,107,255,0.32)]'
                    : 'text-blue-100/72 hover:bg-white/8 hover:text-white'
                }`}
              >
                <link.icon size={18} className={`shrink-0 ${isActive ? 'text-white' : link.iconClassName}`} />
                <span className="max-w-full truncate">
                  {link.label.replace('Service Video ', 'Videos ').replace('Profile & Settings', 'Profile')}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
