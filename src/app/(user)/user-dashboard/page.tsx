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
  TrendingUp,
  Zap,
  Bookmark,
} from 'lucide-react';
import Link from 'next/link';

import { InfoPopover } from '@/components/guidance/InfoPopover';
import { useAuth } from '@/contexts/AuthContext';
import { getClientSessionHeaders } from '@/lib/client-session';

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
};

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
    isActive: true,
  };
}

export default function UserDashboardPage() {
  const { user: authUser, isLoading: authLoading, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [countsLoading, setCountsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [dashboardCounts, setDashboardCounts] = useState({
    activeBookings: 0,
    savedFavorites: 0,
    reviewsSubmitted: 0,
    vendorsFollowed: 0,
  });

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
    setCountsLoading(true);
    const headers = {
      'Content-Type': 'application/json',
      ...getClientSessionHeaders(authUser.id),
    };

    const loadCounts = async () => {
      try {
        const [bookingsRes, favoritesRes, reviewsRes] = await Promise.all([
          fetch('/api/bookings?summaryOnly=1', { headers, cache: 'no-store' }),
          fetch('/api/users/favorites?countsOnly=1', { headers, cache: 'no-store' }),
          fetch('/api/reviews/me?summaryOnly=1', { headers, cache: 'no-store' }),
        ]);

        let activeBookings = 0;
        let savedFavorites = 0;
        let reviewsSubmitted = 0;
        let vendorsFollowed = 0;

        if (bookingsRes.ok) {
          const bookingsPayload = await bookingsRes.json().catch(() => ({}));
          activeBookings = Number(bookingsPayload?.summary?.activeTotal || 0);
        }

        if (favoritesRes.ok) {
          const favoritesPayload = await favoritesRes.json().catch(() => ({}));
          savedFavorites = Number(favoritesPayload?.summary?.total || 0);
          vendorsFollowed = Number(favoritesPayload?.summary?.uniqueVendorCount || 0);
        }

        if (reviewsRes.ok) {
          const reviewsPayload = await reviewsRes.json().catch(() => ({}));
          reviewsSubmitted = Number(reviewsPayload?.summary?.submittedTotal || 0);
        }

        if (!cancelled) {
          setDashboardCounts({
            activeBookings,
            savedFavorites,
            reviewsSubmitted,
            vendorsFollowed,
          });
        }
      } catch {
        if (!cancelled) {
          setDashboardCounts({
            activeBookings: 0,
            savedFavorites: 0,
            reviewsSubmitted: 0,
            vendorsFollowed: 0,
          });
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
    };
  }, [authLoading, authUser?.id, isAuthenticated]);

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

    return (
      <div className="mb-8">
        <div className="reliance-dark-shell overflow-hidden rounded-[28px] p-6 text-white shadow-[0_30px_80px_rgba(7,16,38,0.18)]">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 text-lg font-bold text-white">
              {profile.firstName?.charAt(0)}
              {profile.lastName?.charAt(0)}
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold text-white">
                Welcome, {profile.firstName} {profile.lastName}!
              </h2>
              <p className="text-white/72">
                Browse services, track bookings, and check review progress from one place.
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
      label: 'Active Services',
      value: String(dashboardCounts.activeBookings),
      icon: Calendar,
      badgeClassName: 'bg-blue-100 text-blue-700',
      helpTitle: 'Active Services',
      helpBody: 'Services you booked that are still scheduled, in progress, or waiting for follow-up.',
    },
    {
      label: 'Saved Items',
      value: String(dashboardCounts.savedFavorites),
      icon: Bookmark,
      badgeClassName: 'bg-rose-100 text-rose-700',
      helpTitle: 'Saved Items',
      helpBody: 'Services or vendors you bookmarked so you can come back later.',
    },
    {
      label: 'Reviews Submitted',
      value: String(dashboardCounts.reviewsSubmitted),
      icon: Star,
      badgeClassName: 'bg-amber-100 text-amber-700',
      helpTitle: 'Reviews Submitted',
      helpBody: 'Customer reviews you already sent through Reliance.',
    },
    {
      label: 'Saved Vendors',
      value: String(dashboardCounts.vendorsFollowed),
      icon: TrendingUp,
      badgeClassName: 'bg-emerald-100 text-emerald-700',
      helpTitle: 'Saved Vendors',
      helpBody: 'Unique vendors connected to the items you saved.',
    },
  ];

  const quickActions = [
    {
      title: 'Find Services',
      description: 'Browse services and compare providers before you book.',
      href: '/discover',
      icon: Search,
      buttonLabel: 'Open Discover',
    },
    {
      title: 'View My Services',
      description: 'Track upcoming, completed, and follow-up services in one place.',
      href: '/my-bookings',
      icon: ClipboardList,
      buttonLabel: 'Open My Services',
    },
    {
      title: 'Saved Favorites',
      description: 'Review the vendors and services you saved.',
      href: '/favorites',
      icon: Bookmark,
      buttonLabel: 'Open Favorites',
    },
    {
      title: 'My Reviews',
      description: 'See which completed services are ready for a review.',
      href: '/reviews',
      icon: Star,
      buttonLabel: 'Open Reviews',
    },
    {
      title: 'Support & Help',
      description: 'Open customer help guidance and the published support path.',
      href: '/help?role=customer&returnTo=%2Fuser-dashboard&returnLabel=Back%20to%20Customer%20Dashboard',
      icon: HelpCircle,
      buttonLabel: 'Open Help Center',
    },
  ];

  const shouldShowCountsSkeleton = countsLoading;

  return (
    <div className="space-y-10">
      <section className="reliance-operator-hero rounded-[32px] px-6 py-7">
        <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
          Customer dashboard
        </div>
        <h1 className="mt-5 font-display text-4xl font-semibold text-white sm:text-5xl">
          Manage your services in one place
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 sm:text-base">
          Track bookings, open approved service videos, manage saved items, and see when completed
          services are ready for a review.
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

        <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
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
                      <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
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
                className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(7,16,38,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_55px_rgba(7,16,38,0.1)]"
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="rounded-full bg-blue-100 p-2">
                    <action.icon className="h-5 w-5 text-blue-700" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900">{action.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">{action.description}</p>
                  </div>
                </div>
                <Link
                  href={action.href}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[var(--reliance-blue)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a58db]"
                >
                  {action.buttonLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(7,16,38,0.06)]">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-[var(--reliance-blue)]" />
            <h2 className="font-display text-2xl font-semibold text-slate-950">Need help getting started?</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Search className="h-5 w-5 text-blue-700" />
              </div>
              <h3 className="mb-1 font-semibold text-gray-900">Book a Service</h3>
              <p className="mb-3 text-sm text-gray-600">Browse services and choose a provider that fits your needs.</p>
              <Link
                href="/discover"
                className="inline-flex w-full items-center justify-center rounded-full bg-[var(--reliance-blue)] px-3 py-2 text-sm font-medium text-white hover:bg-[#1a58db]"
              >
                Explore Services
              </Link>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="mb-1 font-semibold text-gray-900">Track the Service</h3>
              <p className="mb-3 text-sm text-gray-600">Follow the service from request to completion.</p>
              <Link
                href="/my-bookings"
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                My Bookings
              </Link>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <Camera className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="mb-1 font-semibold text-gray-900">Watch Service Videos</h3>
              <p className="mb-3 text-sm text-gray-600">
                Open approved service videos or images after the vendor completes the job.
              </p>
              <Link
                href="/my-bookings"
                className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                My Bookings
              </Link>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <MessageSquare className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="mb-1 font-semibold text-gray-900">Leave a Review</h3>
              <p className="mb-3 text-sm text-gray-600">Reviews open after an approved final-result video is available for your booking.</p>
              <Link
                href="/reviews"
                className="inline-flex w-full items-center justify-center rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
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
