'use client';
import React, { useState, useEffect } from 'react';
import { Star, TrendingUp, Zap, Calendar, Search, Bookmark, ClipboardList, MapPin, Image as ImageIcon, CheckCircle2, Camera, MessageSquare } from 'lucide-react';
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

export default function UserDashboardPage() {
  const { user: authUser, isLoading: authLoading, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [servicesLoading, setServicesLoading] = useState(true);
  const [services, setServices] = useState<DashboardService[]>([]);
  const [dashboardCounts, setDashboardCounts] = useState({
    activeBookings: 0,
    savedFavorites: 0,
    reviewsSubmitted: 0,
    vendorsFollowed: 0,
  });
  const userType = String(userData?.userType || '').toLowerCase();
  const hasBothProfiles = userType === 'both';

  // Fetch user profile data on component mount
  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!isAuthenticated || !authUser?.id) {
      setError('Please sign in to view your dashboard.');
      setLoading(false);
      return;
    }

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
          setUserData(data.profile);

        } else {
          const payload = await response.json().catch(() => ({}));
          setError(String(payload?.error || 'Failed to fetch user data'));
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Failed to fetch user data');
      } finally {
        setLoading(false);
      }
    };

    void fetchUserData();
  }, [authLoading, isAuthenticated, authUser?.id]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !authUser?.id) {
      return;
    }

    let cancelled = false;
    const headers = {
      'Content-Type': 'application/json',
      ...getClientSessionHeaders(authUser.id),
    };

    const loadCounts = async () => {
      try {
        const [bookingsRes, favoritesRes, reviewsRes] = await Promise.all([
          fetch('/api/bookings?limit=100&page=1', { headers, cache: 'no-store' }),
          fetch('/api/users/favorites?limit=100&page=1', { headers, cache: 'no-store' }),
          fetch('/api/reviews/me', { headers, cache: 'no-store' }),
        ]);

        let activeBookings = 0;
        let savedFavorites = 0;
        let reviewsSubmitted = 0;
        let vendorsFollowed = 0;

        if (bookingsRes.ok) {
          const bookingsPayload = await bookingsRes.json().catch(() => ({}));
          const bookings = Array.isArray(bookingsPayload?.bookings) ? bookingsPayload.bookings : [];
          activeBookings = bookings.filter((booking: any) => {
            const status = String(booking?.status || '').trim().toLowerCase();
            return status !== 'completed' && status !== 'canceled' && status !== 'cancelled';
          }).length;
        }

        if (favoritesRes.ok) {
          const favoritesPayload = await favoritesRes.json().catch(() => ({}));
          const favorites = Array.isArray(favoritesPayload?.favorites) ? favoritesPayload.favorites : [];
          savedFavorites = favorites.length;
          const uniqueVendors = new Set(
            favorites
              .map((favorite: any) => String(favorite?.vendorId || '').trim())
              .filter(Boolean)
          );
          vendorsFollowed = uniqueVendors.size;
        }

        if (reviewsRes.ok) {
          const reviewsPayload = await reviewsRes.json().catch(() => ({}));
          const submitted = Array.isArray(reviewsPayload?.submitted) ? reviewsPayload.submitted : [];
          reviewsSubmitted = submitted.length;
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
        const response = await fetch('/api/services?limit=100&sortBy=created_at&sortOrder=desc', {
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
      <div className="rounded-2xl border border-white/50 bg-white/70 p-6 shadow-sm">
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="text-center py-2">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Display user registration data at the top
  const renderUserInfo = () => {
    if (!userData) return null;

    return (
      <div className="mb-8">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {userData.firstName?.charAt(0)}{userData.lastName?.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Welcome back, {userData.firstName} {userData.lastName}!
              </h2>
              <p className="text-gray-600">Ready to discover amazing services?</p>
              <p className="text-sm text-gray-500 mt-1">Business profile options are available from Profile & Settings.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <h4 className="font-semibold text-gray-700">Contact Information</h4>
              <p className="text-sm text-gray-600">Email: {userData.email}</p>
              <p className="text-sm text-gray-600">Phone: {userData.phone}</p>
              <p className="text-sm text-gray-600">Location: {userData.city}, {userData.state}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700">Account Details</h4>
              <p className="text-sm text-gray-600">Member since: {userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : '—'}</p>
              <p className="text-sm text-gray-600">Status: {userData.isActive ? 'Active' : 'Inactive'}</p>
            </div>
            {userData.bio && (
              <div>
                <h4 className="font-semibold text-gray-700">About You</h4>
                <p className="text-sm text-gray-600">{userData.bio}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const quickStats = [
    { label: 'Active Bookings', value: String(dashboardCounts.activeBookings), icon: Calendar, color: 'blue' },
    { label: 'Saved Favorites', value: String(dashboardCounts.savedFavorites), icon: Bookmark, color: 'pink' },
    { label: 'Reviews Submitted', value: String(dashboardCounts.reviewsSubmitted), icon: Star, color: 'yellow' },
    { label: 'Vendors Followed', value: String(dashboardCounts.vendorsFollowed), icon: TrendingUp, color: 'green' },
  ];

  const quickActions = [
    {
      title: 'Find Services',
      description: 'Browse available services and discover new vendors.',
      href: '/discover',
      icon: Search,
      buttonLabel: 'Open Discover',
    },
    {
      title: 'View My Bookings',
      description: 'Track active and completed jobs in one place.',
      href: '/my-bookings',
      icon: ClipboardList,
      buttonLabel: 'Open My Bookings',
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
  ];

  const trendingServices = services.slice(0, 4);
  const nearYouServices = services
    .filter((service) => String(service?.vendor?.location || '').trim())
    .slice(0, 4);
  const showNearYouWithLocation = nearYouServices.length > 0;
  const nearYouTitle = showNearYouWithLocation ? '📍 Available Near You' : '📍 Available Services';

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

  return (
    <div className="space-y-10">
      {!hasBothProfiles ? (
        <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm mb-10">
          <h1 className="text-2xl font-semibold text-gray-900">Home</h1>
        </div>
      ) : null}

      <div className="space-y-8">
        {renderUserInfo()}
        
        {/* Vendor Profile Already Exists Message */}
        {(userData?.userType === 'both' || userData?.userType === 'vendor') && (
          <div className="mb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm">✓</span>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {quickStats.map((stat, index) => (
            <div key={index} className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full bg-${stat.color}-100`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
            <span className="text-sm text-gray-500">• Connected to your account routes</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <div key={action.title} className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-white/50 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 rounded-full bg-purple-100">
                    <action.icon className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900">{action.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                  </div>
                </div>
                <Link
                  href={action.href}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
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
            <h2 className="text-xl font-bold text-gray-900">🔥 Trending Now</h2>
            <span className="text-sm text-gray-500">• Real published services</span>
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
                          className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700"
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
            <span className="text-sm text-gray-500">• Real vendor-linked services</span>
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
                      href={`/service/${service.id}`}
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
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/50">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-bold text-gray-900">How Reliance Works</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                <Search className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Book a Service</h3>
              <p className="text-sm text-gray-600 mb-3">Find and request a trusted vendor.</p>
              <Link
                href="/discover"
                className="inline-flex w-full items-center justify-center rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
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
              <h3 className="font-semibold text-gray-900 mb-1">View Proof</h3>
              <p className="text-sm text-gray-600 mb-3">See approved proof after the vendor completes the job.</p>
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