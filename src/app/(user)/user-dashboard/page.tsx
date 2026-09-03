'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  HelpCircle,
  MessageSquare,
  Search,
  Star,
  Store,
  Zap,
  Bookmark,
} from 'lucide-react';
import Link from 'next/link';

import { InfoPopover } from '@/components/guidance/InfoPopover';
import { useAuth } from '@/contexts/AuthContext';
import { getClientSessionHeaders } from '@/lib/client-session';
import { CustomerLoadError } from '@/components/customer/CustomerLoadError';
import { customerSummarySchemas, readCustomerResponse } from '@/lib/customer-load-contract';

type CustomerProfile = {
  id?: string;
  userType?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  geocodedAt?: string | null;
  locationPreferenceEnabled?: boolean;
  createdAt?: string;
  isActive?: boolean;
  bio?: string;
  avatar?: string | null;
  profilePhoto?: string | null;
};

const quickActionIconStyles = [
  'bg-cyan-500/16 text-cyan-200 ring-1 ring-cyan-300/20',
  'bg-blue-500/16 text-blue-200 ring-1 ring-blue-300/20',
  'bg-rose-500/16 text-rose-200 ring-1 ring-rose-300/20',
  'bg-amber-500/18 text-amber-200 ring-1 ring-amber-300/24',
  'bg-violet-500/16 text-violet-200 ring-1 ring-violet-300/20',
];

function splitDisplayName(name: string | undefined) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  };
}

function buildCustomerProfileShell(authUser: NonNullable<ReturnType<typeof useAuth>['user']>): CustomerProfile {
  const { firstName, lastName } = splitDisplayName(authUser.name);
  return {
    id: authUser.id,
    userType: authUser.userType,
    firstName,
    lastName,
    email: authUser.email,
    phone: authUser.phone,
    avatar: authUser.avatar || null,
    isActive: true,
  };
}

export default function UserDashboardPage() {
  const { user: authUser, isLoading: authLoading, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [countsLoading, setCountsLoading] = useState(true);
  const [countsError, setCountsError] = useState(false);
  const [countsRetry, setCountsRetry] = useState(0);
  const [error, setError] = useState('');
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [dashboardCounts, setDashboardCounts] = useState<{ activeBookings: number; savedFavorites: number; reviewsSubmitted: number; vendorsFollowed: number } | null>(null);

  const userType = String(userData?.userType || authUser?.userType || '').toLowerCase();

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!isAuthenticated || !authUser?.id) {
      setError('Please sign in to view your dashboard.');
      setLoading(false);
      setProfileLoading(false);
      setUserData(null);
      return;
    }

    setUserData((current) => {
      if (current?.id === authUser.id) return current;
      return buildCustomerProfileShell(authUser);
    });
    setLoading(false);
    setProfileLoading(true);

    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/customer/profile', {
          headers: {
            'Content-Type': 'application/json',
            ...getClientSessionHeaders(authUser.id),
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUserData((current) => ({
            ...(current || buildCustomerProfileShell(authUser)),
            ...(data.profile || {}),
          }));
        } else {
          console.warn('Customer profile detail load failed for dashboard shell.');
        }
      } catch (profileError) {
        console.error('Error fetching user data:', profileError);
      } finally {
        setProfileLoading(false);
      }
    };

    void fetchUserData();
  }, [authLoading, isAuthenticated, authUser?.id]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !authUser?.id) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setCountsLoading(true);
    setCountsError(false);
    setDashboardCounts(null);
    const headers = {
      'Content-Type': 'application/json',
      ...getClientSessionHeaders(authUser.id),
    };

    const loadCounts = async () => {
      try {
        const [bookingsRes, favoritesRes, reviewsRes] = await Promise.all([
          fetch('/api/bookings?summaryOnly=1', { headers, cache: 'no-store', signal: controller.signal }),
          fetch('/api/users/favorites?countsOnly=1', { headers, cache: 'no-store', signal: controller.signal }),
          fetch('/api/reviews/me?summaryOnly=1', { headers, cache: 'no-store', signal: controller.signal }),
        ]);

        const [bookings, favorites, reviews] = await Promise.all([
          readCustomerResponse(bookingsRes, customerSummarySchemas.bookings, 'Unable to load dashboard totals.'),
          readCustomerResponse(favoritesRes, customerSummarySchemas.favorites, 'Unable to load dashboard totals.'),
          readCustomerResponse(reviewsRes, customerSummarySchemas.reviews, 'Unable to load dashboard totals.'),
        ]);

        if (!cancelled) {
          setDashboardCounts({
            activeBookings: bookings.summary.activeTotal,
            savedFavorites: favorites.summary.total,
            reviewsSubmitted: reviews.summary.submittedTotal,
            vendorsFollowed: favorites.summary.uniqueVendorCount,
          });
        }
      } catch {
        if (!cancelled) {
          setDashboardCounts(null);
          setCountsError(true);
        }
      } finally {
        if (!cancelled) {
          setCountsLoading(false);
        }
      }
    };

    void loadCounts();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authLoading, authUser?.id, isAuthenticated, countsRetry]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_45px_rgba(7,16,38,0.08)]">
          <div className="mb-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 opacity-80" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">Loading your account</h2>
              <div className="h-4 w-64 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
          <p className="text-sm text-gray-500">Loading your dashboard...</p>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(7,16,38,0.06)]"
            >
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-8 w-14 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="py-2 text-center">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-red-500" />
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-[var(--reliance-blue)] px-4 py-2 text-white hover:bg-[#1a58db]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const renderUserInfo = () => {
    const profile = userData || (authUser ? buildCustomerProfileShell(authUser) : null);
    if (!profile) return null;

    const locationLabel =
      profile.city || profile.state
        ? `${profile.city || ''}${profile.city && profile.state ? ', ' : ''}${profile.state || ''}`
        : 'Not added yet';

    const summaryChips = [
      profile.email ? `Email: ${profile.email}` : null,
      locationLabel !== 'Not added yet' ? `Saved area: ${locationLabel}` : 'Saved area not added yet',
      profile.createdAt ? `Member since ${new Date(profile.createdAt).toLocaleDateString()}` : null,
    ].filter(Boolean);
    const profileAvatar = profile.profilePhoto || profile.avatar || authUser?.avatar || null;
    const initials = `${profile.firstName?.charAt(0) || ''}${profile.lastName?.charAt(0) || ''}` || 'R';

    return (
      <div className="mb-8">
        <div className="reliance-dark-shell overflow-hidden rounded-[28px] p-6 text-white shadow-[0_30px_80px_rgba(7,16,38,0.18)]">
          <div className="mb-4 flex items-center gap-4">
            {profileAvatar ? (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[1.15rem] border border-white/20 bg-white p-1.5 shadow-md">
                <img
                  src={profileAvatar}
                  alt={`${profile.firstName || 'Customer'} profile`}
                  className="h-full w-full rounded-[0.85rem] object-contain"
                />
              </div>
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.15rem] bg-gradient-to-r from-blue-500 to-cyan-400 text-lg font-bold text-white">
                {initials}
              </div>
            )}
            <div>
              <h2 className="font-display text-2xl font-semibold text-white">
                Welcome, {profile.firstName} {profile.lastName}!
              </h2>
              <p className="text-white/72">
              Explore completed work, track Service Records, and check review progress from one place.
              </p>
              <p className="mt-1 text-sm text-white/58">
                Profile &amp; Settings keeps your contact details, saved address, and account preferences together.
              </p>
              {profileLoading ? (
                <p className="mt-2 text-xs text-blue-200">Updating your saved profile details...</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {summaryChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/78"
              >
                {chip}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowAccountDetails((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/12"
            >
              {showAccountDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showAccountDetails ? 'Hide account details' : 'View account details'}
            </button>
            <Link
              href="/profile-settings"
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-slate-100"
            >
              Open Profile &amp; Settings
            </Link>
          </div>

          {showAccountDetails ? (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <h4 className="font-semibold text-white">Contact information</h4>
                <p className="text-sm text-white/70">Email: {profile.email || 'Not added yet'}</p>
                <p className="text-sm text-white/70">Phone: {profile.phone || 'Not added yet'}</p>
                <p className="text-sm text-white/70">Location: {locationLabel}</p>
              </div>
              <div>
                <h4 className="font-semibold text-white">Account details</h4>
                <p className="text-sm text-white/70">
                  Member since: {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
                </p>
                <p className="text-sm text-white/70">Status: {profile.isActive ? 'Active' : 'Inactive'}</p>
              </div>
              {profile.bio ? (
                <div>
                  <h4 className="font-semibold text-white">About you</h4>
                  <p className="text-sm text-white/70">{profile.bio}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const quickStats = [
    {
      label: 'Active Service Records',
      value: dashboardCounts ? String(dashboardCounts.activeBookings) : 'Unavailable',
      icon: Calendar,
      badgeClassName: 'bg-blue-100 text-blue-700',
      helpTitle: 'Active Service Records',
      helpBody: 'Services you requested that are still open, scheduled, in progress, or waiting for follow-up.',
    },
    {
      label: 'Saved Favorites',
      value: dashboardCounts ? String(dashboardCounts.savedFavorites) : 'Unavailable',
      icon: Bookmark,
      badgeClassName: 'bg-rose-100 text-rose-700',
      helpTitle: 'Saved Favorites',
      helpBody: 'Vendor services or providers you saved so you can compare them or come back later.',
    },
    {
      label: 'Reviews Submitted',
      value: dashboardCounts ? String(dashboardCounts.reviewsSubmitted) : 'Unavailable',
      icon: Star,
      badgeClassName: 'bg-amber-100 text-amber-700',
      helpTitle: 'Reviews Submitted',
      helpBody: 'Customer reviews you already sent through Reliance.',
    },
    {
      label: 'Saved Vendors',
      value: dashboardCounts ? String(dashboardCounts.vendorsFollowed) : 'Unavailable',
      icon: Store,
      badgeClassName: 'bg-emerald-100 text-emerald-700',
      helpTitle: 'Saved Vendors',
      helpBody: 'Unique vendors connected to the items you saved.',
    },
  ];

  const quickActions = [
    {
      title: 'Explore Proof',
      description: 'Compare vendor services, service videos, reviews, and provider details before choosing who to contact.',
      href: '/discover',
      icon: Search,
      buttonLabel: 'Explore Proof',
      iconClassName: quickActionIconStyles[0],
    },
    {
      title: 'View Service Records',
      description: 'Track upcoming, completed, and follow-up service records in one place.',
      href: '/my-bookings',
      icon: ClipboardList,
      buttonLabel: 'Open Service Records',
      iconClassName: quickActionIconStyles[1],
    },
    {
      title: 'Saved Favorites',
      description: 'Review the vendors and services you saved.',
      href: '/favorites',
      icon: Bookmark,
      buttonLabel: 'Open Favorites',
      iconClassName: quickActionIconStyles[2],
    },
    {
      title: 'My Reviews',
      description: 'See which completed services are ready for a review.',
      href: '/reviews',
      icon: Star,
      buttonLabel: 'Open Reviews',
      iconClassName: quickActionIconStyles[3],
    },
    {
      title: 'Support & Help',
      description: 'Open customer help guidance and the published support path.',
      href: '/customer/support?returnTo=%2Fuser-dashboard&returnLabel=Back%20to%20Customer%20Dashboard',
      icon: HelpCircle,
      buttonLabel: 'Open Help Center',
      iconClassName: quickActionIconStyles[4],
    },
  ];

  const shouldShowCountsSkeleton = countsLoading;

  return (
    <div className="space-y-10">
      <section className="reliance-operator-hero rounded-[28px] px-5 py-6 sm:rounded-[32px] sm:px-6 sm:py-7">
        <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
          Customer dashboard
        </div>
        <h1 className="mt-5 font-display text-4xl font-semibold text-white sm:text-5xl">
          Manage your service records in one place
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 sm:text-base">
          Track service records, open approved service videos, manage saved services, and see when
          completed work is ready for a review.
        </p>
      </section>

      <div className="space-y-8">
        {renderUserInfo()}

        {(userType === 'both' || userType === 'vendor') && (
          <div className="mb-8">
            <div className="max-w-md rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-green-800">Vendor Profile Active</h3>
                  <p className="text-sm text-green-600">
                    You can switch to your vendor dashboard using the profile toggle above.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {countsError ? <CustomerLoadError message="Unable to load dashboard totals." onRetry={() => { setCountsLoading(true); setCountsError(false); setCountsRetry((value) => value + 1); }} /> : null}
        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {quickStats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(7,16,38,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_55px_rgba(7,16,38,0.1)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-2 ${stat.badgeClassName}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    {shouldShowCountsSkeleton ? (
                      <div className="h-8 w-10 animate-pulse rounded bg-gray-200" />
                    ) : (
                      <div className={`${dashboardCounts ? 'text-2xl' : 'text-sm'} font-bold text-gray-900`}>{stat.value}</div>
                    )}
                    <div className="text-sm text-gray-600">{stat.label}</div>
                  </div>
                </div>
                <InfoPopover title={stat.helpTitle} body={stat.helpBody} />
              </div>
            </div>
          ))}
        </div>

        <div className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-[var(--reliance-blue)]" />
            <h2 className="font-display text-2xl font-semibold text-slate-950">Quick Actions</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {quickActions.map((action) => (
              <div
                key={action.title}
                className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(7,16,38,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_55px_rgba(7,16,38,0.1)]"
              >
                <div className="mb-4 flex flex-1 items-start gap-3">
                  <div className={`rounded-full p-2.5 ${action.iconClassName}`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900">{action.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">{action.description}</p>
                  </div>
                </div>
                <Link
                  href={action.href}
                  className="mt-auto inline-flex w-full items-center justify-center rounded-full bg-[var(--reliance-blue)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a58db]"
                >
                  {action.buttonLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(7,16,38,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-[var(--reliance-blue)]" />
            <h2 className="font-display text-2xl font-semibold text-slate-950">Need help getting started?</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Search className="h-5 w-5 text-blue-700" />
              </div>
              <h3 className="mb-1 font-semibold text-gray-900">Request a Service</h3>
              <p className="mb-3 flex-1 text-sm text-gray-600">Review completed work and trust signals before choosing a provider.</p>
              <Link
                href="/discover"
                className="mt-auto inline-flex w-full items-center justify-center rounded-full bg-[var(--reliance-blue)] px-3 py-2 text-sm font-medium text-white hover:bg-[#1a58db]"
              >
                  Explore Proof
              </Link>
            </div>

            <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="mb-1 font-semibold text-gray-900">Track the Service</h3>
              <p className="mb-3 flex-1 text-sm text-gray-600">Follow the service from request to completion.</p>
              <Link
                href="/my-bookings"
                className="mt-auto inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                My Service Records
              </Link>
            </div>

            <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <Camera className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="mb-1 font-semibold text-gray-900">Watch Service Videos</h3>
              <p className="mb-3 flex-1 text-sm text-gray-600">
                Open approved service videos or images after the vendor completes the job.
              </p>
              <Link
                href="/my-bookings"
                className="mt-auto inline-flex w-full items-center justify-center rounded-full bg-[var(--reliance-blue)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a58db]"
              >
                My Service Records
              </Link>
            </div>

            <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <MessageSquare className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="mb-1 font-semibold text-gray-900">Leave a Review</h3>
              <p className="mb-3 flex-1 text-sm text-gray-600">Reviews open after a completed service has an approved Private Proof package.</p>
              <Link
                href="/reviews"
                className="mt-auto inline-flex w-full items-center justify-center rounded-full bg-[var(--reliance-blue)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a58db]"
              >
                My Reviews
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
