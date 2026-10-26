"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TutorialEntryPoint } from '@/components/guidance/TutorialEntryPoint';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle, Calendar, Star, TrendingUp, Activity, Megaphone, MessageSquare, ShieldCheck, Bell, RefreshCw } from 'lucide-react';
import { useVendorDashboard } from '@/hooks/useVendorDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { getClientSessionHeaders } from '@/lib/client-session';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import VendorOnboardingStatusPanel from '@/components/vendor/VendorOnboardingStatusPanel';
import { tutorialGuides } from '@/lib/user-guidance';
import VendorBusinessVisibilitySection from '@/components/vendor/VendorBusinessVisibilitySection';
import { buildVendorGrowthSummary } from '@/lib/vendor-growth-summary';
import { navigateAfterNotificationRead } from '@/lib/vendor-notification-navigation';
import {
  deriveVendorAnalyticsMetrics,
  formatStoragePercent,
  formatStorageSize,
  selectMostRecentPublicReview,
  selectTopRatedTeamMember,
} from '@/lib/vendor-analytics';

type PromotionPackageOption = {
  packageKey: string;
  name: string;
  publicSummary: string;
  bestFor: string;
  durationDays: number;
  defaultRadiusMiles: number;
  maxRadiusMiles: number;
  defaultPriceCents: number;
  isFoundingRate: boolean;
  pricingLabel: string;
};

type PromotionServiceOption = {
  id: string;
  name: string;
  isPublished: boolean;
};

type PromotionRecentRequest = {
  id: string;
  name: string;
  status: string;
  paymentStatus: string;
  packageKey: string;
  createdAt: string | null;
};

type PromotionBrowseReadiness = {
  organicBrowseCount: number;
  desktopMinimumOrganicCount: number;
  categoryMinimumOrganicCount: number;
  desktopBrowseEligible: boolean;
  categoriesMeetingMinimum: number;
  totalCategoriesWithListings: number;
};

const DEFAULT_PROMOTION_LAUNCH_AVAILABILITY_NOTE =
  'Only currently live promoted placements are requestable here. Homepage spotlight inventory will appear after the public homepage rollout is launched.';
const PROMOTION_REQUEST_OPTIONS_TIMEOUT_MS = 30000;
const PROMOTIONS_ENABLED = false;

export default function VendorDashboard() {
  const { data, loading, error, refetch, approvalPending } = useVendorDashboard();
  const { data: vendorProfile, loading: vendorProfileLoading, refetch: refetchVendorProfile } = useVendorProfile();
  const { user } = useAuth();
  const router = useRouter();
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [promotionPackages, setPromotionPackages] = useState<PromotionPackageOption[]>([]);
  const [promotionServices, setPromotionServices] = useState<PromotionServiceOption[]>([]);
  const [promotionRecentRequests, setPromotionRecentRequests] = useState<PromotionRecentRequest[]>([]);
  const [promotionLaunchAvailabilityNote, setPromotionLaunchAvailabilityNote] = useState<string | null>(null);
  const [promotionBrowseReadiness, setPromotionBrowseReadiness] = useState<PromotionBrowseReadiness | null>(null);
  const [promotionRequestOptionsReloadKey, setPromotionRequestOptionsReloadKey] = useState(0);
  const [promotionPackageKey, setPromotionPackageKey] = useState('');
  const [promotionServiceId, setPromotionServiceId] = useState('');
  const [promotionGoal, setPromotionGoal] = useState('');
  const [promotionCategory, setPromotionCategory] = useState('');
  const [promotionStartDate, setPromotionStartDate] = useState('');
  const [promotionNote, setPromotionNote] = useState('');
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promotionSubmitting, setPromotionSubmitting] = useState(false);
  const [promotionMessage, setPromotionMessage] = useState<string | null>(null);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pageShellClass = '';
  const pageContentClass = 'space-y-8';

  const vendorIdForPromotion = data?.profile?.id || null;

  const viewAuditNotification = async (notification: NonNullable<typeof data>["notifications"][number]) => {
    const vendorId = data?.profile?.id;
    if (!vendorId || !notification.href) return;
    await navigateAfterNotificationRead({
      href: notification.href,
      markRead: async () => {
        if (notification.read || notification.historical) return;
        const response = await fetch(
          `/api/vendors/${encodeURIComponent(vendorId)}/notifications/${encodeURIComponent(notification.id)}/read`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getClientSessionHeaders(user?.id) },
            body: JSON.stringify({ transition: 'VIEW_DETAILS' }),
          },
        );
        if (!response.ok) throw new Error('Unable to persist notification read state.');
      },
      navigate: (href) => router.push(href),
      onReadError: (readError) => console.warn('[vendor/notifications] read state unavailable', {
        notificationId: notification.id,
        error: readError instanceof Error ? readError.message : 'unknown',
      }),
    });
  };

  useEffect(() => {
    if (!PROMOTIONS_ENABLED || !vendorIdForPromotion) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeoutHandle = window.setTimeout(() => controller.abort(), PROMOTION_REQUEST_OPTIONS_TIMEOUT_MS);

    setPromotionLoading(true);
    setPromotionError(null);
    fetch(`/api/vendor/promotion-requests?vendorId=${encodeURIComponent(vendorIdForPromotion)}`, {
      headers: getClientSessionHeaders(user?.id),
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(String(payload?.error || 'Failed to load promotion packages'));
        }
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        const nextPackages = Array.isArray(payload?.packages) ? payload.packages : [];
        const nextServices = Array.isArray(payload?.services) ? payload.services : [];
        const nextRequests = Array.isArray(payload?.recentRequests) ? payload.recentRequests : [];
        setPromotionPackages(nextPackages);
        setPromotionServices(nextServices);
        setPromotionRecentRequests(nextRequests);
        setPromotionLaunchAvailabilityNote(
          typeof payload?.launchAvailabilityNote === 'string' && payload.launchAvailabilityNote.trim()
            ? payload.launchAvailabilityNote
            : null
        );
        setPromotionBrowseReadiness(payload?.browseReadiness || null);
        setPromotionPackageKey((current) =>
          current && nextPackages.some((pkg: PromotionPackageOption) => pkg.packageKey === current)
            ? current
            : String(nextPackages[0]?.packageKey || '')
        );
        setPromotionServiceId((current) =>
          current && nextServices.some((service: PromotionServiceOption) => service.id === current)
            ? current
            : String(
                nextServices.find((service: PromotionServiceOption) => service.isPublished)?.id ||
                  nextServices[0]?.id ||
                  ''
              )
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setPromotionBrowseReadiness(null);
        if (err instanceof Error && err.name === 'AbortError') {
          setPromotionError('Promotion options took too long to load. Please retry.');
          return;
        }
        setPromotionError(err instanceof Error ? err.message : 'Failed to load promotion request options');
      })
      .finally(() => {
        window.clearTimeout(timeoutHandle);
        if (!cancelled) setPromotionLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutHandle);
      controller.abort();
    };
  }, [promotionRequestOptionsReloadKey, user?.id, vendorIdForPromotion]);

  const formatDate = (dateString: string) => {
    const value = new Date(dateString);
    if (Number.isNaN(value.getTime())) return 'Date unavailable';
    return value.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPromotionStatus = (request: PromotionRecentRequest) => {
    const status = String(request.status || '').replace(/_/g, ' ');
    if (request.status === 'draft') return 'Awaiting admin review';
    if (request.status === 'scheduled') return 'Admin approved / scheduled';
    if (request.status === 'active') return 'Active';
    if (request.status === 'cancelled') return 'Cancelled';
    if (request.status === 'rejected') return 'Rejected';
    return status || 'Request submitted';
  };

  const formatPaymentStatus = (paymentStatus: string) =>
    String(paymentStatus || 'not_started').replace(/_/g, ' ');

  const formatVendorJobStatus = (status: string) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'awaiting_review') return 'awaiting review';
    return normalized || 'scheduled';
  };

  const refreshDashboard = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchVendorProfile()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (approvalPending) {
    return (
      <div className={pageShellClass}>
        <div className={pageContentClass}>
          <div className="flex justify-end">
            <TutorialEntryPoint guide={tutorialGuides.vendorDashboard} surface="light" />
          </div>
          {vendorProfile ? <VendorOnboardingStatusPanel profile={vendorProfile} showActions compact /> : null}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>What happens next</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>
                Reliance has saved this vendor account for admin review. You can keep refining profile details and
                saved services while the approval decision is pending.
              </p>
              <ul className="space-y-2 text-gray-600">
                <li>Profile details help admin confirm business identity and service area.</li>
                <li>Service menu items stay internal until admin publishes them later.</li>
                <li>Your business will not appear publicly until admin approval, vendor listing, and service publishing are all complete.</li>
              </ul>
            </CardContent>
          </Card>
          {vendorProfileLoading && !vendorProfile ? (
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
              Loading your saved vendor setup…
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className={pageShellClass}>
        <div className={pageContentClass}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="bg-white">
                <CardContent className="p-6 space-y-3">
                  <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
                  <div className="h-7 w-16 rounded bg-gray-200 animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Service Video Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">Loading dashboard...</p>
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-lg border border-gray-200 p-3 space-y-2">
                      <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
                      <div className="h-6 w-10 rounded bg-gray-200 animate-pulse" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Trust signals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">
                  Loading reviews, service videos, and public visibility.
                </p>
                <div className="h-9 w-40 rounded bg-gray-200 animate-pulse" />
              </CardContent>
            </Card>
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
            <p className="text-red-700 font-medium">We couldn't load your dashboard.</p>
            <p className="text-xs text-red-700/80">Please try again.</p>
            <Button
              onClick={() => void refreshDashboard()}
              className="mt-3"
              size="sm"
            >
              Retry
            </Button>
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
            <p className="font-medium text-gray-700">No dashboard data yet.</p>
            <p className="text-xs text-gray-500">Once jobs start coming in, your summary will appear here.</p>
          </div>
        </div>
      </div>
    );
  }

  const { stats: dashboardStats, recentJobs, recentReviews } = data;
  const dashboardMetrics = deriveVendorAnalyticsMetrics(data);
  const topRatedTeamMember = selectTopRatedTeamMember(data.employeePerformance);
  const latestPublicReview = selectMostRecentPublicReview(recentReviews);

  // Color map for Tailwind classes - prevents class purging
  const colorMap = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
  } as const;

  const now = new Date();
  const todaysJobs = recentJobs.filter((job) => {
    const d = new Date(job.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  });
  const jobsToday = todaysJobs.length;
  const jobsInProgress = dashboardMetrics.inProgressJobs;
  const jobsCompleted = dashboardMetrics.completedJobs;
  const awaitingReview = dashboardMetrics.awaitingReviewJobs;
  const ratingCount = dashboardMetrics.ratingCount;
  const publicWrittenReviewCount = Math.max(0, Math.floor(Number(dashboardStats.publicWrittenReviewCount || 0)));
  const completionEligibleBookings = Number(
    dashboardStats.completionEligibleBookingCount ??
      jobsCompleted + jobsInProgress + awaitingReview +
        Number(data.lifecycleCounts?.scheduled || 0)
  );
  const completionRate = dashboardMetrics.completionRate;
  const approvedServiceOrders = dashboardMetrics.approvedServiceOrders;
  const publicServiceOrders = dashboardMetrics.publicServiceOrders;
  const trustScoreSource =
    (dashboardStats as any)?.trustScore ??
      (data as any)?.trustScore ??
      (data as any)?.trustScoreSummary?.totalScorePct ??
      (data?.profile as any)?.trustScore ??
      (vendorProfile as any)?.trustScore;
  const trustScoreRaw = Number(trustScoreSource);
  const trustScoreValue =
    trustScoreSource !== null && trustScoreSource !== undefined && Number.isFinite(trustScoreRaw)
      ? Math.round(trustScoreRaw)
      : null;
  const storageUsagePct = dashboardMetrics.storagePercent;

  const selectedPromotionPackage = promotionPackages.find((pkg) => pkg.packageKey === promotionPackageKey);
  const selectedPromotionService = promotionServices.find((service) => service.id === promotionServiceId);
  const effectivePromotionLaunchAvailabilityNote =
    promotionLaunchAvailabilityNote || DEFAULT_PROMOTION_LAUNCH_AVAILABILITY_NOTE;
  const browseReadinessMessage = promotionBrowseReadiness
    ? promotionBrowseReadiness.desktopBrowseEligible
      ? `Public browse currently meets the organic floor for featured placements (${promotionBrowseReadiness.organicBrowseCount}/${promotionBrowseReadiness.desktopMinimumOrganicCount} desktop listings).`
      : `Public browse is currently below the organic floor for featured placements (${promotionBrowseReadiness.organicBrowseCount}/${promotionBrowseReadiness.desktopMinimumOrganicCount} desktop listings), so approved campaigns may still stay hidden until browse inventory grows.`
    : null;
  const canSubmitPromotionRequest = Boolean(
    vendorIdForPromotion &&
      promotionPackageKey &&
      promotionServiceId &&
      selectedPromotionService?.isPublished &&
      !promotionSubmitting
  );
  const growthSummary = buildVendorGrowthSummary({
    vendorId: data?.profile?.id || vendorProfile?.id || null,
    businessName: data?.profile?.businessName || vendorProfile?.businessName || null,
    onboarding: vendorProfile?.onboarding || null,
    verifiedRatingCount: ratingCount,
    approvedServiceVideoCount: approvedServiceOrders,
    publicServiceOrderCount: publicServiceOrders,
    promotionsEnabled: PROMOTIONS_ENABLED,
    promotionBrowseReadiness: PROMOTIONS_ENABLED ? promotionBrowseReadiness : null,
    promotionServices: PROMOTIONS_ENABLED ? promotionServices : [],
    promotionRecentRequests: PROMOTIONS_ENABLED ? promotionRecentRequests : [],
  });
  const heroMetricCards = [
    {
      label: 'Jobs today',
      value: jobsToday.toString(),
      detail: 'Jobs currently scheduled for today.',
      icon: Calendar,
      color: 'blue' as keyof typeof colorMap,
    },
    {
      label: 'Work in progress',
      value: jobsInProgress.toString(),
      detail: 'Jobs your team is actively working.',
      icon: TrendingUp,
      color: 'green' as keyof typeof colorMap,
    },
    {
      label: 'Awaiting review',
      value: awaitingReview.toString(),
      detail: 'Finished jobs waiting for manager or Reliance review.',
      icon: Star,
      color: 'yellow' as keyof typeof colorMap,
    },
    {
      label: 'Completed',
      value: jobsCompleted.toString(),
      detail: 'Jobs already closed out in Reliance.',
      icon: CheckCircle,
      color: 'purple' as keyof typeof colorMap,
    },
    {
      label: 'Verified ratings',
      value: ratingCount.toString(),
      detail: 'Verified star ratings; written comments are tracked separately.',
      icon: Star,
      color: 'yellow' as keyof typeof colorMap,
    },
    {
      label: 'Public written reviews',
      value: publicWrittenReviewCount.toString(),
      detail: 'Approved written comments currently visible to customers.',
      icon: MessageSquare,
      color: 'blue' as keyof typeof colorMap,
    },
    {
      label: 'Trust Score',
      value: trustScoreValue === null ? 'Building' : `${trustScoreValue}/100`,
      detail: 'Finalized workflow, Service Video, and dispute evidence. Customer ratings stay separate.',
      icon: ShieldCheck,
      color: 'blue' as keyof typeof colorMap,
    },
    {
      label: 'Approved service orders',
      value: approvedServiceOrders.toString(),
      detail: `${publicServiceOrders} currently Public after the customer's sharing choice.`,
      icon: Activity,
      color: 'green' as keyof typeof colorMap,
    },
  ];

  const heroMetricGroups = [
    {
      label: 'Active work',
      detail: 'Current workload and follow-through',
      cards: heroMetricCards.slice(0, 4),
    },
    {
      label: 'Trust and public proof',
      detail: 'Customer-facing confidence signals',
      cards: heroMetricCards.slice(4),
    },
  ];

  const submitPromotionRequest = async () => {
    if (!vendorIdForPromotion) return;
    setPromotionSubmitting(true);
    setPromotionError(null);
    setPromotionMessage(null);
    try {
      const res = await fetch('/api/vendor/promotion-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getClientSessionHeaders(user?.id),
        },
        body: JSON.stringify({
          vendorId: vendorIdForPromotion,
          serviceId: promotionServiceId,
          packageKey: promotionPackageKey,
          campaignGoal: promotionGoal,
          preferredCategory: promotionCategory,
          preferredStartDate: promotionStartDate,
          targetRadiusMiles: selectedPromotionPackage?.defaultRadiusMiles,
          note: promotionNote,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error || 'Failed to submit promotion request'));
      }
      setPromotionMessage(
        String(json?.message || 'Promotion request submitted. Reliance admin will review it before payment or activation.')
      );
      setPromotionGoal('');
      setPromotionCategory('');
      setPromotionStartDate('');
      setPromotionNote('');
      setPromotionOpen(false);
      setPromotionRecentRequests((current) => [
        {
          id: String(json?.campaign?.id || `submitted-${Date.now()}`),
          name: 'Promotion request',
          status: String(json?.campaign?.status || 'draft'),
          paymentStatus: String(json?.campaign?.paymentStatus || 'not_started'),
          packageKey: String(json?.campaign?.packageKey || promotionPackageKey),
          createdAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 3));
    } catch (err) {
      setPromotionError(err instanceof Error ? err.message : 'Failed to submit promotion request');
    } finally {
      setPromotionSubmitting(false);
    }
  };

  return (
    <div className={pageShellClass}>
      <div className={pageContentClass}>
        {vendorProfile?.onboarding ? (
          <VendorOnboardingStatusPanel profile={vendorProfile} showActions compact />
        ) : null}
        <section
          className="reliance-operator-hero mb-8 rounded-[28px] px-5 py-5 sm:px-6 sm:py-6"
          data-testid="dashboard-metric-overview"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-normal text-blue-100/78">
                Vendor dashboard
              </p>
              <h1 className="mt-2 font-display text-3xl font-semibold text-white sm:text-4xl">
                See what is helping your business grow
              </h1>
              <p className="mt-2 text-sm leading-6 text-white/72 sm:text-base">
                Public trust, active work, and approved proof in one glance.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 self-start xl:self-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refreshDashboard()}
                disabled={refreshing}
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                />
                {refreshing ? 'Refreshing' : 'Refresh dashboard'}
              </Button>
              <TutorialEntryPoint
                guide={tutorialGuides.vendorDashboard}
                surface="dark"
              />
            </div>
          </div>

          <div className="mt-5 space-y-5 border-t border-white/10 pt-5">
            {heroMetricGroups.map((group) => (
              <section
                key={group.label}
                aria-labelledby={`dashboard-${group.label.toLowerCase().replaceAll(' ', '-')}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2
                    id={`dashboard-${group.label.toLowerCase().replaceAll(' ', '-')}`}
                    className="text-sm font-semibold text-white"
                  >
                    {group.label}
                  </h2>
                  <p className="text-xs text-white/54">{group.detail}</p>
                </div>
                <div
                  className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                  data-testid="dashboard-metric-grid"
                >
                  {group.cards.map((card) => {
                    const colors = colorMap[card.color];
                    const isAwaitingReview =
                      card.label === 'Awaiting review' && awaitingReview > 0;
                    return (
                      <article
                        key={card.label}
                        data-testid="dashboard-metric-card"
                        className={`min-h-[148px] rounded-lg border p-4 text-left ${
                          isAwaitingReview
                            ? 'border-amber-300/40 bg-amber-500/10'
                            : 'border-white/10 bg-white/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-normal text-white/54">
                              {card.label}
                            </p>
                            <p
                              className={`mt-2 text-3xl font-semibold ${isAwaitingReview ? 'text-amber-200' : 'text-white'}`}
                            >
                              {card.value}
                            </p>
                          </div>
                          <div
                            className={`rounded-full p-2.5 ${colors.bg} ${colors.text}`}
                          >
                            <card.icon aria-hidden="true" className="h-4 w-4" />
                          </div>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-white/68">
                          {card.detail}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>

        {data.notifications?.length ? (
          <section aria-labelledby="reliance-audit-updates" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-300" />
                <h2 id="reliance-audit-updates" className="text-lg font-semibold text-white">Reliance Audit updates</h2>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => router.push('/vendor/notifications')}>
                View notification history
              </Button>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {data.notifications.filter((notification) => notification.type === 'audit').map((notification) => (
                <Card key={notification.id} className={notification.priority === 'high' ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}>
                  <CardContent className="flex items-start justify-between gap-4 p-4">
                    <div>
                      <p className="flex items-center gap-2 font-semibold text-slate-950">
                        <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="Unread" />
                        {notification.title}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">{notification.message}</p>
                      <p className="mt-2 text-xs text-gray-500">{new Date(notification.time).toLocaleString()}</p>
                    </div>
                    {notification.href ? (
                      <Button size="sm" variant="outline" onClick={() => void viewAuditNotification(notification)}>
                        View details
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <VendorBusinessVisibilitySection summary={growthSummary} />

        {PROMOTIONS_ENABLED ? (
        <Card className="mb-8 border-blue-100 bg-blue-50">
          <CardContent className="space-y-5 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <Megaphone className="mt-0.5 h-5 w-5 text-blue-700" />
                <div>
                  <h2 className="font-semibold text-blue-950">Grow visibility with promotions</h2>
                  <p className="text-sm text-blue-900">
                    Promotions help more customers discover you after your profile, published services offered,
                    and trust signals already give them a reason to contact you.
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => setPromotionOpen((open) => !open)}>
                {promotionOpen ? 'Close request form' : 'Request promotion'}
              </Button>
            </div>

            {promotionOpen ? (
              <div className="rounded-xl border border-blue-200 bg-white p-4">
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                    <p className="font-semibold">1. Pick a package</p>
                    <p className="mt-1 text-xs text-blue-800">Choose the placement and published service offered you want Reliance to review for extra visibility.</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-semibold">2. Wait for admin review</p>
                    <p className="mt-1 text-xs text-amber-800">Reliance checks public readiness, package fit, and timing before payment is requested.</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <p className="font-semibold">3. Go live after payment</p>
                    <p className="mt-1 text-xs text-emerald-800">Approved campaigns can increase visibility in browse after payment is recorded or waived by admin.</p>
                  </div>
                </div>

                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {effectivePromotionLaunchAvailabilityNote}
                </div>
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  Browse promotions can put your business in front of more customers, but they only render when Reliance
                    still has enough organic proof results to keep discovery trustworthy. Desktop Explore Proof currently needs
                  at least 4 organic listings, and category-filtered browse needs at least 3, before featured paid
                  placements can appear.
                </div>
                {browseReadinessMessage ? (
                  <div
                    className={`mb-4 rounded-lg border p-3 text-sm ${
                      promotionBrowseReadiness?.desktopBrowseEligible
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <p>{browseReadinessMessage}</p>
                    <p className="mt-1 text-xs">
                      Category-filtered browse is currently ready in{' '}
                      {promotionBrowseReadiness?.categoriesMeetingMinimum || 0}/
                      {promotionBrowseReadiness?.totalCategoriesWithListings || 0} listing groups.
                    </p>
                  </div>
                ) : null}

                {promotionLoading ? (
                  <p className="text-sm text-gray-600">Loading promotion packages...</p>
                ) : promotionError ? (
                  <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <p>{promotionError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPromotionRequestOptionsReloadKey((current) => current + 1)}
                    >
                      Retry loading options
                    </Button>
                  </div>
                ) : promotionPackages.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    Promotion packages are not available right now. Reliance admin can enable packages before vendors submit requests.
                  </p>
                ) : promotionServices.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    Add and publish a service before requesting promoted placement.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Package</span>
                        <select
                          value={promotionPackageKey}
                          onChange={(event) => setPromotionPackageKey(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        >
                          {promotionPackages.map((pkg) => (
                            <option key={pkg.packageKey} value={pkg.packageKey}>
                              {pkg.name} - ${(pkg.defaultPriceCents / 100).toFixed(0)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Service to promote</span>
                        <select
                          value={promotionServiceId}
                          onChange={(event) => setPromotionServiceId(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        >
                          {promotionServices.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.name}{service.isPublished ? '' : ' (publish before requesting)'}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {selectedPromotionPackage ? (
                      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                        <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{selectedPromotionPackage.publicSummary}</p>
                          {selectedPromotionPackage.isFoundingRate ? (
                            <Badge variant="outline" className="border-blue-200 bg-white text-blue-800">
                              {selectedPromotionPackage.pricingLabel}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-blue-800">
                          <span className="rounded-full bg-white px-3 py-1">{selectedPromotionPackage.durationDays} days</span>
                          <span className="rounded-full bg-white px-3 py-1">Up to {selectedPromotionPackage.maxRadiusMiles} miles</span>
                          <span className="rounded-full bg-white px-3 py-1">${(selectedPromotionPackage.defaultPriceCents / 100).toFixed(0)}</span>
                        </div>
                        <p className="mt-2">{selectedPromotionPackage.bestFor}</p>
                        <p className="mt-2 text-xs text-blue-800">
                          Use promotions after your profile already gives customers a strong reason to click, trust, and contact you.
                        </p>
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Campaign goal</span>
                        <input
                          value={promotionGoal}
                          onChange={(event) => setPromotionGoal(event.target.value)}
                          placeholder="More local leads"
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Preferred category</span>
                        <input
                          value={promotionCategory}
                          onChange={(event) => setPromotionCategory(event.target.value)}
                          placeholder="Admin can confirm"
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Preferred start date</span>
                        <input
                          type="date"
                          value={promotionStartDate}
                          onChange={(event) => setPromotionStartDate(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">Optional note for Reliance admin</span>
                      <textarea
                        value={promotionNote}
                        onChange={(event) => setPromotionNote(event.target.value)}
                        rows={3}
                        placeholder="Tell admin what you want to promote or any timing constraints."
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </label>

                    {selectedPromotionService && !selectedPromotionService.isPublished ? (
                      <p className="text-sm font-medium text-amber-700">
                        Publish this service before requesting promoted placement.
                      </p>
                    ) : null}
                    {promotionMessage ? <p className="text-sm font-medium text-emerald-700">{promotionMessage}</p> : null}

                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <p className="text-xs text-gray-600">
                        This form creates a request only. Payment and activation still happen later through Reliance admin,
                        and live browse placement still depends on available inventory, public readiness, and the organic-results minimums above.
                      </p>
                      <Button
                        type="button"
                        onClick={submitPromotionRequest}
                        disabled={!canSubmitPromotionRequest}
                        className="bg-blue-600 text-white hover:bg-blue-700"
                      >
                        {promotionSubmitting ? 'Submitting...' : 'Submit request'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {promotionRecentRequests.length > 0 ? (
              <div className="rounded-xl border border-blue-100 bg-white p-4">
                <p className="text-sm font-semibold text-blue-950">Recent promotion requests</p>
                <div className="mt-3 space-y-2">
                  {promotionRecentRequests.map((request) => (
                    <div key={request.id} className="flex flex-col gap-1 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{request.name || 'Promotion request'}</p>
                        <p className="text-xs text-gray-600">
                          {request.packageKey} {request.createdAt ? `- submitted ${formatDate(request.createdAt)}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                          {formatPromotionStatus(request)}
                        </Badge>
                        <Badge variant="outline" className="border-gray-200 bg-white text-gray-700">
                          {formatPaymentStatus(request.paymentStatus)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-gray-600">
                  Admin still confirms eligibility, package details, payment reference, and activation before any featured proof placement appears.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
        ) : null}

        {/* 3) Performance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white md:col-span-3">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base">Customer confidence snapshot</CardTitle>
              <p className="text-sm text-gray-600">
                See verified customer ratings separately from written feedback published to customers.
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {ratingCount > 0 ? Number(dashboardStats.rating || 0).toFixed(1) : 'Not yet rated'}
              </p>
              <p className="text-sm text-gray-600">
                {ratingCount > 0
                  ? `${ratingCount} verified customer rating${ratingCount === 1 ? '' : 's'}`
                  : 'The first verified customer star rating will establish this average.'}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Completion rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{completionRate}%</p>
              <p className="text-sm text-gray-600">
                {jobsCompleted} completed of {completionEligibleBookings} eligible Work Records. Canceled, rejected, and archived records are excluded.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Employee rating highlight</CardTitle>
            </CardHeader>
            <CardContent>
              {topRatedTeamMember ? (
                <>
                  <p className="text-sm font-semibold text-gray-900">{topRatedTeamMember.displayName}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-200">
                      {Number(topRatedTeamMember.averageRating || 0).toFixed(1)} out of 5
                    </Badge>
                    <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                      {Number(topRatedTeamMember.reviewCount || 0)} verified employee rating{Number(topRatedTeamMember.reviewCount || 0) === 1 ? '' : 's'}
                    </Badge>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">No verified employee ratings yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 4) Active Work Area */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-8">
          <Card className="bg-white lg:col-span-7">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Today&apos;s work
              </CardTitle>
              <p className="text-sm text-gray-600">
                The quickest read on what is active, finished, or still waiting on follow-through.
              </p>
            </CardHeader>
            <CardContent>
              {todaysJobs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No work is scheduled for today.</p>
                  <p className="text-xs mt-1">This card only shows work dated for the current day.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todaysJobs.map((job) => (
                    <div key={job.id} className="flex justify-between items-center gap-3 p-4 bg-gray-50 rounded-lg">
                      <div className="min-w-0">
                        <h4 className="font-medium truncate text-gray-900">{job.title}</h4>
                        <p className="text-sm text-gray-500">{job.client}</p>
                        <p className="text-xs text-gray-500">{formatDate(job.date)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          job.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          job.status === 'in progress' ? 'bg-blue-100 text-blue-800' :
                          job.status === 'canceled' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {formatVendorJobStatus(job.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/vendor/jobs">Open Manage Jobs</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white lg:col-span-3">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-600" />
                Most recent public review
              </CardTitle>
              <p className="text-sm text-gray-600">
                This card always shows one newest verified, published written review.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!latestPublicReview ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No public reviews yet.</p>
                  <p className="text-xs mt-1">Published customer feedback will appear here as completed jobs move through the review process.</p>
                </div>
              ) : (
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-medium text-gray-900">{latestPublicReview.client}</h4>
                    <div
                      className="flex items-center gap-1"
                      aria-label={`${Number(latestPublicReview.rating || 0).toFixed(1)} out of 5 stars`}
                    >
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          aria-hidden="true"
                          className={`h-4 w-4 ${
                            i < Math.max(0, Math.min(5, Number(latestPublicReview.rating || 0)))
                              ? 'fill-current text-yellow-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="mb-2 line-clamp-6 text-sm text-gray-600">{latestPublicReview.comment}</p>
                  <p className="text-xs text-gray-500">{formatDate(latestPublicReview.date)}</p>
                </div>
              )}
              {publicWrittenReviewCount > 1 ? (
                <p className="text-xs text-gray-500">
                  Showing the newest of {publicWrittenReviewCount} public reviews.
                </p>
              ) : null}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/vendor/reviews">
                  {publicWrittenReviewCount > 0
                    ? `View all public reviews (${publicWrittenReviewCount})`
                    : 'Open Reviews'}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Storage Snapshot */}
        <Card className="bg-white mb-8">
          <CardHeader className="space-y-1">
            <CardTitle>Storage</CardTitle>
            <p className="text-sm text-gray-600">
              Internal storage used for service-video capture and supporting job files.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Used</span>
              <span className="font-semibold text-gray-900">
                {formatStorageSize(dashboardMetrics.storageUsedBytes)} / {formatStorageSize(dashboardMetrics.storageLimitBytes)}
              </span>
            </div>
            <div
              className="h-2 w-full rounded-full bg-gray-200"
              role="progressbar"
              aria-label="Storage quota used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Number(storageUsagePct.toFixed(2))}
            >
              <div
                className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${storageUsagePct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">{formatStoragePercent(storageUsagePct)} of quota used.</p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
} 
