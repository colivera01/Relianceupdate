'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  User,
  Home,
  Heart,
  LogOut,
  LayoutDashboard,
  Star,
  Calendar,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { RelianceLogo } from '@/components/public/RelianceLogo';
import { initialsFromDisplayName, sanitizeCustomerFacingAvatar } from '@/lib/avatar-display';

// TODO Future mobile: convert this sidebar into a bottom nav or slide-out
// drawer for an app-like experience on small screens. For now the sidebar
// is hidden on `< md` so primary content takes the full viewport, and a
// future commit should introduce a responsive trigger + drawer.

type SidebarUser = { name: string; email: string; avatar: string | null };

const defaultUser: SidebarUser = {
  name: 'Guest',
  email: '',
  avatar: null,
};

function buildCustomerHelpHref(pathname: string, search: string): string {
  const fullPath = `${pathname || '/user-dashboard'}${search}`;
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const nestedReturnTo = String(searchParams.get('returnTo') || '').trim();
  const returnTo =
    pathname.startsWith('/service/') || pathname.startsWith('/my-bookings/')
      ? fullPath
      : pathname || '/user-dashboard';
  const returnLabel = pathname.startsWith('/profile-settings')
    ? 'Back to Profile & Settings'
    : pathname.startsWith('/customer/secure-account')
      ? 'Back to Secure Account'
      : pathname.startsWith('/my-bookings/')
        ? nestedReturnTo === '/reviews'
          ? 'Back to review detail'
          : 'Back to Service Detail'
        : pathname.startsWith('/my-bookings')
          ? 'Back to My Service Records'
        : pathname.startsWith('/reviews')
          ? 'Back to My Reviews'
        : pathname.startsWith('/favorites')
          ? 'Back to My Favorites'
        : pathname.startsWith('/discover')
          ? 'Back to Explore Proof'
        : pathname.startsWith('/service/')
          ? 'Back to Service Detail'
          : 'Back to Customer Dashboard';

  return `/help?role=customer&returnTo=${encodeURIComponent(returnTo)}&returnLabel=${encodeURIComponent(returnLabel)}`;
}

const navLinks = [
  { label: 'Home', icon: Home, href: '/user-dashboard' },
  { label: 'Explore Proof', icon: LayoutDashboard, href: '/discover' },
  { label: 'My Service Records', icon: Calendar, href: '/my-bookings' },
  { label: 'Favorites', icon: Heart, href: '/favorites' },
  { label: 'Reviews', icon: Star, href: '/reviews' },
  { label: 'Profile & Settings', icon: User, href: '/profile-settings' },
  { label: 'Secure Account', icon: Shield, href: '/customer/secure-account' },
];

function displayNameFromStoredUser(parsed: Record<string, unknown>): string {
  if (typeof parsed.name === 'string' && parsed.name.trim()) return parsed.name.trim();
  const fn = typeof parsed.firstName === 'string' ? parsed.firstName : '';
  const ln = typeof parsed.lastName === 'string' ? parsed.lastName : '';
  const combined = `${fn} ${ln}`.trim();
  if (combined) return combined;
  if (typeof parsed.email === 'string' && parsed.email) return parsed.email;
  return defaultUser.name;
}

function UserSidebarContent() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : '';
  const customerHelpHref = React.useMemo(() => buildCustomerHelpHref(pathname, search), [pathname, search]);
  const [currentUser, setCurrentUser] = React.useState<SidebarUser>(defaultUser);
  const isSignedIn = Boolean(user);
  const signedInUser: SidebarUser | null = React.useMemo(() => {
    if (!user) return null;
    return {
      name: user.name || user.email || defaultUser.name,
      email: user.email || defaultUser.email,
      avatar: sanitizeCustomerFacingAvatar(user.avatar) || null,
    };
  }, [user]);
  const visibleUser = signedInUser || currentUser;
  const isResolvingIdentity =
    isLoading && !signedInUser && visibleUser.name === defaultUser.name && visibleUser.email === defaultUser.email;

  React.useEffect(() => {
    if (signedInUser) {
      setCurrentUser(signedInUser);
      return;
    }
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const parsed = JSON.parse(userData) as Record<string, unknown>;
        setCurrentUser({
          name: displayNameFromStoredUser(parsed),
          email: typeof parsed.email === 'string' ? parsed.email : defaultUser.email,
          avatar:
            sanitizeCustomerFacingAvatar(parsed.avatar) ||
            sanitizeCustomerFacingAvatar(parsed.profilePhoto) ||
            null,
        });
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    } else if (!isLoading) {
      setCurrentUser(defaultUser);
    }
  }, [user, isLoading]);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      window.location.href = '/logout';
    }
  };

  const initials = initialsFromDisplayName(visibleUser.name);
  const navigationLinks = React.useMemo(
    () => [...navLinks, { label: 'Support & Help', icon: HelpCircle, href: customerHelpHref }],
    [customerHelpHref]
  );

  return (
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
      <div className="flex flex-1 flex-col px-4 py-8 text-white">
        {/* Identity block */}
        <div className="flex flex-col items-center mb-8 px-2">
          <div className="relative mb-4">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-16 h-16 rounded-full border-2 border-white/20 shadow-md object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-white/20 shadow-md bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                {initials}
              </div>
            )}
            {isSignedIn ? (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full" />
              </div>
            ) : null}
          </div>
          <div className="text-center min-w-0 w-full">
            <div className="font-semibold text-lg mb-1 truncate">
              {isResolvingIdentity ? 'Loading account...' : visibleUser.name}
            </div>
            {!isResolvingIdentity && visibleUser.email && !/@reliance\.test$/i.test(visibleUser.email) ? (
              <div className="text-blue-100 text-sm break-all">{visibleUser.email}</div>
            ) : null}
            <div className="mt-2">
              <span className="px-2 py-1 bg-white/20 text-white text-xs rounded-full">
                {isResolvingIdentity ? 'Loading' : isSignedIn ? 'Customer' : 'Guest'}
              </span>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1">
          <div className="text-xs font-semibold text-blue-200 uppercase tracking-wider mb-4 px-3">
            Navigation
          </div>
          {navigationLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== '/' && pathname.startsWith(`${link.href}/`));
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`reliance-operator-nav-link flex items-center gap-3 rounded-2xl px-3 py-2.5 text-base font-medium transition-colors ${
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
            {isResolvingIdentity ? (
              <div className="px-3 py-2 text-sm text-blue-100">Loading account actions...</div>
            ) : isSignedIn ? (
              <button
                onClick={handleLogout}
                className="reliance-operator-nav-link flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-base font-medium transition-colors"
              >
                <LogOut size={18} />
                Log Out
              </button>
            ) : (
              <Link
                href="/auth/login"
                className="reliance-operator-nav-link flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-base font-medium transition-colors"
              >
                <User size={18} />
                Sign In
              </Link>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-white/20 text-center">
          <div className="text-xs text-blue-200">Reliance</div>
          <div className="text-xs text-blue-300">(c) 2026 All rights reserved</div>
        </div>
      </div>
    </aside>
  );
}

export default function UserSidebar() {
  return (
    <React.Suspense
      fallback={
        <aside className="reliance-operator-sidebar hidden w-72 flex-col min-h-screen md:flex">
          <div className="reliance-operator-sidebar-header flex items-center justify-center px-6 py-7">
            <RelianceLogo
              tone="light"
              blend
              compact
              className="justify-center"
              frameClassName="h-16 w-16"
            />
          </div>
          <div className="reliance-operator-sidebar flex-1 text-white flex flex-col py-8 px-4">
            <div className="px-3 py-2 text-sm text-blue-100">Loading navigation...</div>
          </div>
        </aside>
      }
    >
      <UserSidebarContent />
    </React.Suspense>
  );
}
