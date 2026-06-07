'use client';
import React, { useState, useEffect } from 'react';
import { Star, TrendingUp, Zap, Calendar, Search, Bookmark, ClipboardList, MapPin, Image as ImageIcon, CheckCircle2, Camera, MessageSquare, AlertTriangle, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getClientSessionHeaders } from '@/lib/client-session';

type CustomerProfile = {
  id?: string;
  userType?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  createdAt?: string;
  isActive?: boolean;
  bio?: string;
};

type DashboardService = {
  id: string;
  name: string;
  description: string;
  price: number;
  isPublished?: boolean;
  vendor?: {
    id?: string;
    name?: string;
    businessName?: string | null;
    category?: string | null;
    businessType?: string | null;
    location?: string | null;
    isPubliclyListed?: boolean;
  } | null;
};

function splitDisplayName(name: string | undefined) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
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
  const [servicesLoading, setServicesLoading] = useState(true);
  const [services, setServices] = useState<DashboardService[]>([]);
  const [dashboardCounts, setDashboardCounts] = useState({
    activeBookings: 0,
    savedFavorites: 0,
    reviewsSubmitted: 0,
    vendorsFollowed: 0,
  });
  const userType = String(userData?.userType || authUser?.userType || '').toLowerCase();
  const hasBothProfiles = userType === 'both';

  // Fetch user profile data on component mount
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
      if (current?.id === authUser.id) {
        return current;
      }
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
      } catch (error) {
        console.error('Error fetching user data:', error);
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

  useEffect(() => {
    let cancelled = false;
    const fetchServices = async () => {
      try {
        setServicesLoading(true);
        // Pull a broader window so published/public services are not dropped by recency pagination.
        const response = await fetch('/api/services?limit=16&sortBy=created_at&sortOrder=desc', {
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });
        if (!response.ok) {
          if (!cancelled) setServices([]);
          return;
        }
        const payload = await response.json().catch(() => ({}));
        const rows = Array.isArray(payload?.services) ? payload.services : [];
        if (!cancelled) {
          setServices(
            rows.filter((service: DashboardService) => {
              const published = Boolean(service?.isPublished);
              const publicVendor = Boolean(service?.vendor?.isPubliclyListed);
              return published && publicVendor;
            })
          );
        }
      } catch {
        if (!cancelled) setServices([]);
      } finally {
        if (!cancelled) setServicesLoading(false);
      }
    };

    void fetchServices();
    return () => {
      cancelled = true;
    };
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-8">
        <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_45px_rgba(7,16,38,0.08)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 opacity-80" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">Welcome back</h2>
              <div className="h-4 w-64 rounded bg-gray-200 animate-pulse" />
            </div>
          </div>
          <p className="text-sm text-gray-500">Loading your dashboard...</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(7,16,38,0.06)]">
              <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
              <div className="h-8 w-14 rounded bg-gray-200 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="text-center py-2">
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

  // Display user registration data at the top
  const renderUserInfo = () => {
    const profile = userData || (authUser ? buildCustomerProfileShell(authUser) : null);
    if (!profile) return null;

    const locationLabel =
      profile.city || profile.state
        ? `${profile.city || ''}${profile.city && profile.state ? ', ' : ''}${profile.state || ''}`
        : 'Not added yet';

    return (
      <div className="mb-8">
        <div className="reliance-dark-shell overflow-hidden rounded-[28px] p-6 text-white shadow-[0_30px_80px_rgba(7,16,38,0.18)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 text-lg font-bold text-white">
              {profile.firstName?.charAt(0)}{profile.lastName?.charAt(0)}
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold text-white">
                Welcome back, {profile.firstName} {profile.lastName}!
              </h2>
              <p className="text-white/72">Ready to discover amazing services?</p>
              <p className="mt-1 text-sm text-white/58">You can update your contact details anytime from Profile &amp; Settings.</p>
              {profileLoading ? (
                <p className="mt-2 text-xs text-blue-200">Updating your saved profile details...</p>
              ) : null}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <h4 className="font-semibold text-white">Contact Information</h4>
              <p className="text-sm text-white/70">Email: {profile.email || 'Loading...'}</p>
              <p className="text-sm text-white/70">Phone: {profile.phone || 'Not added yet'}</p>
              <p className="text-sm text-white/70">Location: {locationLabel}</p>
            </div>
            <div>
              <h4 className="font-semibold text-white">Account Details</h4>
              <p className="text-sm text-white/70">Member since: {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}</p>
              <p className="text-sm text-white/70">Status: {profile.isActive ? 'Active' : 'Inactive'}</p>
            </div>
            {profile.bio ? (
              <div>
                <h4 className="font-semibold text-white">About You</h4>
                <p className="text-sm text-white/70">{profile.bio}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const quickStats = [
    {
      label: 'Active Bookings',
      value: String(dashboardCounts.activeBookings),
      icon: Calendar,
      badgeClassName: 'bg-blue-100 text-blue-700',
    },
    {
      label: 'Saved Favorites',
      value: String(dashboardCounts.savedFavorites),
      icon: Bookmark,
      badgeClassName: 'bg-rose-100 text-rose-700',
    },
    {
      label: 'Reviews Submitted',
      value: String(dashboardCounts.reviewsSubmitted),
      icon: Star,
      badgeClassName: 'bg-amber-100 text-amber-700',
    },
    {
      label: 'Vendors Followed',
      value: String(dashboardCounts.vendorsFollowed),
      icon: TrendingUp,
      badgeClassName: 'bg-emerald-100 text-emerald-700',
    },
  ];

  const shouldShowCountsSkeleton = countsLoading;

  const quickActions = [
    {
      title: 'Find Services',
      description: 'Browse available services and discover new vendors.',
      href: '/discover',
      icon: Search,
      buttonLabel: 'Open Discover',
    },
    {
      title: 'View My Services',
      description: 'Track active and completed jobs in one place.',
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
      description: 'See pending and submitted review activity.',
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

  const trendingServices = services.slice(0, 4);
  const nearYouServices = services
    .filter((service) => String(service?.vendor?.location || '').trim())
    .slice(0, 4);
  const showNearYouWithLocation = nearYouServices.length > 0;
  const nearYouTitle = showNearYouWithLocation ? 'Available Near You' : 'Available Services';

  const renderMarketplaceEmptyState = () => (
    <div className="text-center py-10 bg-white rounded-2xl border border-gray-200">
      <p className="text-gray-700 font-medium">No services available yet.</p>
      <Link
        href="/discover"
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Explore Services
      </Link>
    </div>
  );
  const dashboardReturnHref = '/user-dashboard';
  const dashboardReturnLabel = 'Back to Customer Dashboard';

  return (
    <div className="space-y-10">
      <section className="reliance-operator-hero rounded-[32px] px-6 py-7">
        <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
          Customer dashboard
        </div>
        <h1 className="mt-5 font-display text-4xl font-semibold text-white sm:text-5xl">
          Your trusted service dashboard
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 sm:text-base">
          Follow bookings, review approved service videos, manage favorites, and keep every customer step
          in one clear Reliance experience.
        </p>
      </section>

      <div className="space-y-8">
        {renderUserInfo()}
        
        {/* Vendor Profile Already Exists Message */}
        {(userData?.userType === 'both' || userData?.userType === 'vendor') && (
          <div className="mb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
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
        
        {/* Quick Stats - Instagram Story Style */}
        <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {quickStats.map((stat, index) => (
            <div key={index} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(7,16,38,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_55px_rgba(7,16,38,0.1)]">
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-2 ${stat.badgeClassName}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  {shouldShowCountsSkeleton ? (
                    <div className="h-8 w-10 rounded bg-gray-200 animate-pulse" />
                  ) : (
                    <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  )}
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-[var(--reliance-blue)]" />
            <h2 className="font-display text-2xl font-semibold text-slate-950">Quick Actions</h2>
            <span className="text-sm text-gray-500">Connected to your account routes</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {quickActions.map((action) => (
              <div key={action.title} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(7,16,38,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_55px_rgba(7,16,38,0.1)]">
                <div className="flex items-start gap-3 mb-3">
                  <div className="rounded-full bg-blue-100 p-2">
                    <action.icon className="h-5 w-5 text-blue-700" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900">{action.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{action.description}</p>
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

        {/* Trending Now (Real Data) */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-red-500" />
            <h2 className="text-xl font-bold text-gray-900">Trending Now</h2>
            <span className="text-sm text-gray-500">Real published services</span>
          </div>

          {servicesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="rounded-2xl border border-gray-200 bg-white p-4 animate-pulse">
                  <div className="h-36 w-full rounded-lg bg-gray-200 mb-3" />
                  <div className="h-4 w-3/4 rounded bg-gray-200 mb-2" />
                  <div className="h-3 w-1/2 rounded bg-gray-200 mb-3" />
                  <div className="h-8 w-full rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : trendingServices.length === 0 ? (
            renderMarketplaceEmptyState()
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {trendingServices.map((service) => {
                const vendorName = service.vendor?.businessName || service.vendor?.name || 'Vendor';
                return (
                  <div key={service.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
                    <div className="h-40 w-full bg-gray-100 flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <ImageIcon className="h-6 w-6 mx-auto mb-1" />
                        <span className="text-xs">No media preview</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 line-clamp-1">{service.name}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-1">{vendorName}</p>
                      {service.vendor?.location ? (
                        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="w-3 h-3" />
                          <span className="line-clamp-1">{service.vendor.location}</span>
                        </div>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">${Number(service.price || 0).toFixed(2)}</span>
                        <Link
                          href={`/booking/${service.id}`}
                          className="inline-flex items-center justify-center rounded-full bg-[var(--reliance-blue)] px-3 py-2 text-xs font-medium text-white hover:bg-[#1a58db]"
                        >
                          Book Now
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Near You / Available Services (Real Data) */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900">{nearYouTitle}</h2>
            <span className="text-sm text-gray-500">Real vendor-linked services</span>
          </div>

          {servicesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="rounded-2xl border border-gray-200 bg-white p-4 animate-pulse">
                  <div className="h-4 w-2/3 rounded bg-gray-200 mb-2" />
                  <div className="h-3 w-1/2 rounded bg-gray-200 mb-2" />
                  <div className="h-3 w-3/4 rounded bg-gray-200 mb-3" />
                  <div className="h-8 w-full rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : services.length === 0 ? (
            renderMarketplaceEmptyState()
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(showNearYouWithLocation ? nearYouServices : services.slice(0, 4)).map((service) => {
                const vendorName = service.vendor?.businessName || service.vendor?.name || 'Vendor';
                const serviceType = service.vendor?.category || service.vendor?.businessType || 'Service';
                return (
                  <div key={`near-${service.id}`} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all duration-200">
                    <h3 className="font-semibold text-gray-900 line-clamp-1">{vendorName}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-1">{serviceType}</p>
                    {service.vendor?.location ? (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <MapPin className="w-3 h-3" />
                        <span className="line-clamp-1">{service.vendor.location}</span>
                      </div>
                    ) : null}
                    <div className="mt-3 text-sm text-gray-700 line-clamp-1">{service.name}</div>
                    <Link
                      href={`/service/${service.id}?returnTo=${encodeURIComponent(dashboardReturnHref)}&returnLabel=${encodeURIComponent(dashboardReturnLabel)}`}
                      className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      View Details
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* How Reliance Works */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(7,16,38,0.06)]">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-[var(--reliance-blue)]" />
            <h2 className="font-display text-2xl font-semibold text-slate-950">How Reliance Works</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Search className="w-5 h-5 text-blue-700" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Book a Service</h3>
              <p className="text-sm text-gray-600 mb-3">Find and request a trusted vendor.</p>
              <Link
                href="/discover"
                className="inline-flex w-full items-center justify-center rounded-full bg-[var(--reliance-blue)] px-3 py-2 text-sm font-medium text-white hover:bg-[#1a58db]"
              >
                Explore Services
              </Link>
            </div>
            
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Track the Job</h3>
              <p className="text-sm text-gray-600 mb-3">Follow your booking status from request to completion.</p>
              <Link
                href="/my-bookings"
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                My Bookings
              </Link>
            </div>
            
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <Camera className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Watch Service Videos</h3>
              <p className="text-sm text-gray-600 mb-3">Open approved service videos or images after the vendor completes the job.</p>
              <Link
                href="/my-bookings"
                className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                My Bookings
              </Link>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <MessageSquare className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Leave a Review</h3>
              <p className="text-sm text-gray-600 mb-3">Rate your completed service based on the work performed.</p>
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

