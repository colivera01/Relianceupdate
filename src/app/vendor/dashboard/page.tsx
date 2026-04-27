"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Calendar, DollarSign, Users, Star, TrendingUp, Smartphone } from 'lucide-react';
import { useVendorDashboard } from '@/hooks/useVendorDashboard';

export default function VendorDashboard() {
  const { data, loading, error, refetch, approvalPending } = useVendorDashboard();
  const router = useRouter();
  const [showAvailability, setShowAvailability] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const pageShellClass = "";
  const pageContentClass = "space-y-8";

  // Formatting utilities
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (approvalPending) {
    return (
      <div className={pageShellClass}>
        <div className={pageContentClass}>
          <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-amber-700 font-semibold">Vendor account pending approval</p>
            <p className="text-xs text-gray-600">You can access dashboard features after admin approval.</p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className={pageShellClass}>
        <div className={pageContentClass}>
          <div className="w-full rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={pageShellClass}>
        <div className={pageContentClass}>
          <div className="w-full rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="text-red-500 font-medium">Failed to fetch vendor dashboard</p>
            <p className="text-xs text-gray-500">{error}</p>
            <button
              onClick={refetch}
              className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Should be rare now
  if (!data) {
    return (
      <div className={pageShellClass}>
        <div className={pageContentClass}>
          <div className="w-full rounded-xl border border-gray-200 bg-white p-6">
            <p className="font-medium text-gray-700">No dashboard data</p>
            <p className="text-xs text-gray-500">We couldn&apos;t load your vendor information.</p>
          </div>
        </div>
      </div>
    );
  }

  const { profile, stats: dashboardStats, recentJobs, recentReviews, insights, notifications } = data;
  const topPerformer = (Array.isArray(data.employeePerformance) ? data.employeePerformance : [])
    .filter((row) => Number(row?.reviewCount || 0) >= 1)
    .sort((a, b) => Number(b.averageRating || 0) - Number(a.averageRating || 0))[0];

  // Display vendor registration data at the top
  const renderVendorInfo = () => {
    if (!profile) return null;

    return (
      <div className="mb-8">
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Welcome, {profile.firstName} {profile.lastName}!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold text-gray-700">Business Information</h4>
                <p className="text-sm text-gray-600">Business: {profile.businessName}</p>
                <p className="text-sm text-gray-600">Type: {profile.businessType}</p>
                <p className="text-sm text-gray-600">Category: {profile.category}</p>
                <p className="text-sm text-gray-600">Founded: {profile.foundedYear}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700">Contact Information</h4>
                <p className="text-sm text-gray-600">Email: {profile.email}</p>
                <p className="text-sm text-gray-600">Phone: {profile.phone}</p>
                <p className="text-sm text-gray-600">Location: {profile.city}, {profile.state}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700">Services</h4>
                <p className="text-sm text-gray-600">
                  Service Types: {Array.isArray(profile.serviceTypes) ? profile.serviceTypes.join(', ') : profile.serviceTypes}
                </p>
                <p className="text-sm text-gray-600">
                  Specializations: {Array.isArray(profile.specializations) ? profile.specializations.join(', ') : profile.specializations}
                </p>
                <p className="text-sm text-gray-600">
                  Service Areas: {Array.isArray(profile.serviceAreas) ? profile.serviceAreas.join(', ') : profile.serviceAreas}
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

  const now = new Date();
  const jobsToday = recentJobs.filter((job) => {
    const d = new Date(job.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }).length;
  const jobsInProgress = recentJobs.filter((job) => job.status === 'in progress').length;
  const jobsCompleted = recentJobs.filter((job) => job.status === 'completed').length;
  const awaitingReview = Math.max(jobsCompleted - recentReviews.length, 0);
  const ratingCount = Number(dashboardStats.ratingCount || recentReviews.length || 0);
  const pendingModerationProofs = Number(data.pendingModerationProofs || 0);
  const approvedProofs = Number(data.approvedProofs || 0);
  const storageUsedBytes = BigInt(String(data.storageUsedBytes || '0'));
  const storageLimitBytesRaw = BigInt(String(data.storageLimitBytes || '0'));
  const storageLimitBytes = storageLimitBytesRaw > BigInt(0) ? storageLimitBytesRaw : BigInt(1);
  const storageUsedGb = Number(storageUsedBytes) / (1024 * 1024 * 1024);
  const storageQuotaGb = Number(storageLimitBytes) / (1024 * 1024 * 1024);
  const storageUsagePct = Math.max(
    0,
    Math.min(100, Number.isFinite(Number(data.storagePercentUsed)) ? Number(data.storagePercentUsed) : (Number(storageUsedBytes * BigInt(100)) / Number(storageLimitBytes)))
  );

  const actionCards = [
    { label: 'Jobs Today', value: jobsToday.toString(), icon: Calendar, color: 'blue' as keyof typeof colorMap, route: '/vendor/jobs?filter=today' },
    { label: 'In Progress', value: jobsInProgress.toString(), icon: TrendingUp, color: 'green' as keyof typeof colorMap, route: '/vendor/jobs?filter=in-progress' },
    { label: 'Awaiting Review', value: awaitingReview.toString(), icon: Star, color: 'yellow' as keyof typeof colorMap, route: '/vendor/jobs?filter=awaiting-review' },
    { label: 'Completed', value: jobsCompleted.toString(), icon: CheckCircle, color: 'purple' as keyof typeof colorMap, route: '/vendor/jobs?filter=completed' },
  ];

  const requestPairingCode = async () => {
    setPairingLoading(true);
    setPairingError(null);
    try {
      const res = await fetch('/api/device/pairing/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error || 'Failed to generate pairing code'));
      }
      setPairingCode(String(json?.code || ''));
      setPairingExpiresAt(String(json?.expiresAt || ''));
    } catch (e) {
      setPairingError(e instanceof Error ? e.message : 'Failed to generate pairing code');
      setPairingCode(null);
      setPairingExpiresAt(null);
    } finally {
      setPairingLoading(false);
    }
  };

  return (
    <div className={pageShellClass}>
      <div className={pageContentClass}>
        {renderVendorInfo()}
        
        {/* Actionable Job Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {actionCards.map((stat) => {
            const colors = colorMap[stat.color];
            return (
              <Card
                key={stat.label}
                className="bg-white cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push(stat.route)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(stat.route);
                  }
                }}
              >
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

        {/* Proof, Reviews, and Storage */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card
            className="bg-white cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => router.push('/vendor/media')}
            role="button"
            tabIndex={0}
          >
            <CardHeader>
              <CardTitle>Proof</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Pending moderation</span>
                <span className="font-semibold text-gray-900">{pendingModerationProofs}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Approved proofs</span>
                <span className="font-semibold text-gray-900">{approvedProofs}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Archived</span>
                <span>{Number(data.archivedProofs || 0)}</span>
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-white cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => router.push('/vendor/reviews')}
            role="button"
            tabIndex={0}
          >
            <CardHeader>
              <CardTitle>Reviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold text-gray-900">
                {Number(dashboardStats.rating || 0).toFixed(1)}
              </div>
              <p className="text-sm text-gray-600">{ratingCount} review{ratingCount === 1 ? '' : 's'}</p>
              <p className="text-xs text-gray-500">Open reviews and employee attribution details.</p>
            </CardContent>
          </Card>

          <Card
            className="bg-white cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => router.push('/vendor/storage')}
            role="button"
            tabIndex={0}
          >
            <CardHeader>
              <CardTitle>Storage Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Used</span>
                <span className="font-semibold text-gray-900">
                  {storageUsedGb.toFixed(1)} GB / {storageQuotaGb} GB
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${storageUsagePct}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{storageUsagePct.toFixed(0)}% of quota used.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Top Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPerformer ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-gray-900">{topPerformer.displayName}</span>
                <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-200">
                  ⭐ {Number(topPerformer.averageRating || 0).toFixed(1)}
                </Badge>
                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                  {Number(topPerformer.reviewCount || 0)} review{Number(topPerformer.reviewCount || 0) === 1 ? "" : "s"}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No employee reviews yet</p>
            )}
          </CardContent>
        </Card>

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
              {recentJobs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">You don't have any jobs yet.</p>
                  <p className="text-xs mt-1">Jobs will appear here once clients book your services.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900">{job.title}</h4>
                        <p className="text-sm text-gray-600">{job.client}</p>
                        <p className="text-xs text-gray-500">{formatDate(job.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(job.amount)}</p>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          job.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          job.status === 'in progress' ? 'bg-blue-100 text-blue-800' :
                          job.status === 'canceled' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
              {recentReviews.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">You don't have any reviews yet.</p>
                  <p className="text-xs mt-1">Ask your clients to leave one after you complete a job.</p>
                </div>
              ) : (
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
                      <p className="text-xs text-gray-500">{formatDate(review.date)}</p>
                    </div>
                  ))}
                </div>
              )}
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
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No notifications at this time.</p>
                <p className="text-xs mt-1">You'll see updates about jobs, reviews, and payments here.</p>
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <Button
                onClick={requestPairingCode}
                className="w-full h-20 text-lg"
                variant="outline"
                disabled={pairingLoading}
              >
                <Smartphone className="h-6 w-6 mr-2" />
                {pairingLoading ? 'Generating...' : 'Pair Device'}
              </Button>
            </div>
            {pairingError ? (
              <p className="mt-3 text-sm text-red-600">{pairingError}</p>
            ) : null}
            {pairingCode ? (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">Pairing code</p>
                <p className="mt-1 text-3xl font-bold tracking-widest text-blue-900">{pairingCode}</p>
                <p className="mt-2 text-xs text-blue-700">
                  Open <span className="font-semibold">/device/pair</span> on your mobile device and enter this code.
                </p>
                {pairingExpiresAt ? (
                  <p className="text-xs text-blue-700">Expires: {new Date(pairingExpiresAt).toLocaleString()}</p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 