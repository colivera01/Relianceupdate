'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleDollarSign, Copy, ExternalLink, RefreshCw, Search, ShieldCheck, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TutorialEntryPoint } from '@/components/guidance/TutorialEntryPoint';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getAdminRequestHeaders } from '@/lib/admin-client';
import { tutorialGuides } from '@/lib/user-guidance';

type PromotionCampaignRow = {
  id: string;
  name: string;
  packageKey: string;
  package?: {
    packageKey: string;
    name: string;
    publicSummary: string;
    adminDescription: string;
    bestFor: string;
    placementExplanation: string;
    audience: string;
    placementType: string;
    durationDays: number;
    defaultRadiusMiles: number;
    maxRadiusMiles: number;
    allowCategoryTargeting: boolean;
    maxConcurrentInZone: number;
    defaultPriceCents: number;
    isActive: boolean;
    isFoundingRate: boolean;
    pricingLabel: string;
  };
  packageSnapshot?: {
    name: string;
    priceCents: number;
    durationDays: number;
    targetRadiusMiles: number;
    placementType: string;
    isFoundingRate: boolean;
    pricingLabel: string;
    bestFor: string;
  };
  packageSnapshotAt: string | null;
  placementType: string;
  status: string;
  paymentStatus: string;
  startAt: string | null;
  endAt: string | null;
  targetCategory: string | null;
  targetCity: string | null;
  targetState: string | null;
  targetZip: string | null;
  targetRadiusMiles: number;
  rankPriority: number;
  adminNotes: string | null;
  amountDueCents: number;
  stripePaymentLinkUrl: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  paymentNotes: string | null;
  vendor: {
    id: string;
    name: string;
    accountStatus: string;
    isPubliclyListed: boolean;
    category: string | null;
    city: string | null;
    state: string | null;
  } | null;
  service: {
    id: string;
    name: string;
    isPublished: boolean;
    price: number;
  } | null;
  eligibility: {
    vendorEligible: boolean;
    serviceEligible: boolean;
    paymentEligible: boolean;
    renderable: boolean;
    note: string;
  };
  aiRecommendation?: {
    aiRunId: string;
    promptVersion: string;
    model: string;
    suggestion: {
      summary: string;
      decision:
        | 'ready_to_activate'
        | 'needs_payment'
        | 'needs_visibility_work'
        | 'hold_for_admin_review';
      confidence: 'low' | 'medium' | 'high';
      blockingIssues: string[];
      recommendedActions: string[];
      impactNotes: string[];
    };
  } | null;
};

type CampaignForm = {
  vendorId: string;
  serviceId: string;
  name: string;
  packageKey: string;
  placementType: string;
  status: string;
  paymentStatus: string;
  startAt: string;
  endAt: string;
  targetCategory: string;
  targetCity: string;
  targetState: string;
  targetZip: string;
  targetRadiusMiles: string;
  rankPriority: string;
  adminNotes: string;
  amountDueCents: string;
  stripePaymentLinkUrl: string;
  paymentReference: string;
  paymentNotes: string;
};

type ZoneOccupancyRow = {
  placementType: string;
  current: number;
  reserved: number;
  maxReservableSlots: number;
  maxRenderableDesktop: number;
  maxRenderableMobile: number;
};

type BrowsePromotionReadiness = {
  organicBrowseCount: number;
  desktopMinimumOrganicCount: number;
  categoryMinimumOrganicCount: number;
  desktopBrowseEligible: boolean;
  categoriesMeetingMinimum: number;
  totalCategoriesWithListings: number;
};

type PromotionTracking = {
  totalRevenueCents: number;
  pendingPaymentCount: number;
  pendingPaymentAmountCents: number;
  paymentLinkReadyCount: number;
  paidCampaignCount: number;
  activeCampaignCount: number;
  packagePerformance: Array<{
    packageKey: string;
    name: string;
    count: number;
    revenueCents: number;
  }>;
  recentPaymentEvents: Array<{
    id: string;
    name: string;
    packageName: string;
    paymentStatus: string;
    amountDueCents: number;
    paidAt: string | null;
    paymentReference: string | null;
    stripePaymentLinkUrl: string | null;
    vendorName: string | null;
    updatedAt: string | null;
  }>;
};

type CampaignPaymentEdit = {
  amountDueCents: string;
  stripePaymentLinkUrl: string;
  paymentReference: string;
  paymentNotes: string;
};

type PromotionPackageOption = NonNullable<PromotionCampaignRow['package']>;
type PackageEdit = {
  name: string;
  publicSummary: string;
  adminDescription: string;
  bestFor: string;
  placementExplanation: string;
  audience: string;
  placementType: string;
  durationDays: string;
  defaultRadiusMiles: string;
  maxRadiusMiles: string;
  allowCategoryTargeting: boolean;
  maxConcurrentInZone: string;
  defaultPriceCents: string;
  isActive: boolean;
  isFoundingRate: boolean;
  pricingLabel: string;
};

type PendingCampaignConfirmation =
  | {
      kind: 'payment';
      campaign: PromotionCampaignRow;
      nextValue: string;
      paymentEdit: CampaignPaymentEdit;
    }
  | {
      kind: 'status';
      campaign: PromotionCampaignRow;
      nextValue: string;
    }
  | null;

const statuses = ['draft', 'scheduled', 'active', 'paused', 'ended', 'rejected', 'expired', 'cancelled'];
const paymentStatuses = ['not_started', 'pending_payment', 'paid', 'waived', 'refunded'];
const placementTypes = ['BROWSE_FEATURED', 'HOME_FEATURED'];
const fallbackPackageOptions: PromotionPackageOption[] = [
  {
    packageKey: 'browse-local-7-day',
    name: '7-day local spotlight',
    publicSummary: 'Entry-level browse feature for one local service area.',
    adminDescription: 'Best for a quick launch push, testing promoted browse demand, or giving a qualified vendor short-term visibility.',
    bestFor: 'Entry-level local visibility and launch-week experiments.',
    placementExplanation: 'Appears in the Featured local providers section on browse.',
    audience: 'Local vendors who want a low-commitment featured browse placement.',
    placementType: 'BROWSE_FEATURED',
    durationDays: 7,
    defaultRadiusMiles: 10,
    maxRadiusMiles: 10,
    allowCategoryTargeting: true,
    maxConcurrentInZone: 2,
    defaultPriceCents: 2900,
    isActive: true,
    isFoundingRate: true,
    pricingLabel: 'Founding / intro rate',
  },
  {
    packageKey: 'browse-local-30-day',
    name: '30-day local spotlight',
    publicSummary: 'Month-long browse feature for broader local coverage.',
    adminDescription: 'Best for vendors ready for a longer local campaign while Reliance is still proving early marketplace volume.',
    bestFor: 'Sustained local visibility and stronger package-popularity signal.',
    placementExplanation: 'Appears in browse with up to 30 miles of radius targeting.',
    audience: 'Established local vendors who want a longer promoted listing run.',
    placementType: 'BROWSE_FEATURED',
    durationDays: 30,
    defaultRadiusMiles: 20,
    maxRadiusMiles: 30,
    allowCategoryTargeting: true,
    maxConcurrentInZone: 2,
    defaultPriceCents: 8900,
    isActive: true,
    isFoundingRate: true,
    pricingLabel: 'Founding / intro rate',
  },
  {
    packageKey: 'home-spotlight-7-day',
    name: '7-day homepage spotlight',
    publicSummary: 'Premium homepage spotlight reservation for top visibility.',
    adminDescription: 'Premium inventory foundation for later homepage rendering; sell carefully until the public home placement is live.',
    bestFor: 'Premium brand visibility and limited homepage inventory.',
    placementExplanation: 'Reserved for HOME_FEATURED inventory; public homepage rendering is still deferred.',
    audience: 'High-priority vendors suited for premium placement.',
    placementType: 'HOME_FEATURED',
    durationDays: 7,
    defaultRadiusMiles: 20,
    maxRadiusMiles: 30,
    allowCategoryTargeting: false,
    maxConcurrentInZone: 1,
    defaultPriceCents: 9900,
    isActive: false,
    isFoundingRate: true,
    pricingLabel: 'Founding / intro rate',
  },
];
const radiusOptionsMiles = [10, 20, 30];

const paymentStatusGuidance = [
  ['not_started', 'No payment work has started yet. Use only before a Stripe Payment Link has been sent.'],
  ['pending_payment', 'Payment Link has been prepared or sent. This can reserve inventory, but cannot go live.'],
  ['paid', 'Admin has confirmed payment outside Reliance and recorded the Stripe reference. Eligible for activation.'],
  ['waived', 'Admin-approved no-charge campaign. Eligible for activation, but excluded from recorded revenue.'],
  ['refunded', 'Payment was reversed. Activation is blocked and active campaigns should be paused or ended.'],
];

const paymentActionLabels: Record<string, string> = {
  not_started: 'Reset to not started',
  pending_payment: 'Set pending payment',
  paid: 'Record paid payment',
  waived: 'Waive payment',
  refunded: 'Mark refunded',
};

const paymentActionHelp: Record<string, string> = {
  not_started: 'Use before sending a Stripe Payment Link.',
  pending_payment: 'Use after preparing or sending the Stripe Payment Link.',
  paid: 'Requires a Stripe payment reference because Reliance does not verify Stripe automatically.',
  waived: 'Use only for owner-approved no-charge promotions.',
  refunded: 'Use when a recorded payment has been reversed.',
};

const campaignStatusGuidance = [
  ['draft', 'Internal setup only; does not reserve live placement.'],
  ['scheduled', 'Reserved for the selected window if package, vendor, service, and inventory rules pass.'],
  ['active', 'Can render publicly only when paid or waived, in-window, and vendor/service remain eligible.'],
  ['paused', 'Temporarily stopped by admin.'],
  ['ended / expired / cancelled / rejected', 'Terminal or non-live states.'],
];

const placementGuidance = [
  ['BROWSE_FEATURED', 'Featured local providers section on browse. Phase 2 inventory caps: 2 desktop slots, 1 mobile slot.'],
  ['HOME_FEATURED', 'Homepage spotlight placement reserved for the home-page rollout once that inventory is enabled.'],
];

function inputDateTime(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function defaultForm(packages: PromotionPackageOption[] = fallbackPackageOptions): CampaignForm {
  const start = new Date();
  const packageOptions = packages.length ? packages : fallbackPackageOptions;
  const selectedPackage = packageOptions.find((option) => option.isActive) || packageOptions[0];
  const end = new Date(start.getTime() + selectedPackage.durationDays * 24 * 60 * 60 * 1000);
  return {
    vendorId: '',
    serviceId: '',
    name: '',
    packageKey: selectedPackage.packageKey,
    placementType: selectedPackage.placementType,
    status: 'scheduled',
    paymentStatus: 'pending_payment',
    startAt: inputDateTime(start),
    endAt: inputDateTime(end),
    targetCategory: '',
    targetCity: '',
    targetState: '',
    targetZip: '',
    targetRadiusMiles: String(selectedPackage.defaultRadiusMiles),
    rankPriority: '100',
    adminNotes: '',
    amountDueCents: String(selectedPackage.defaultPriceCents),
    stripePaymentLinkUrl: '',
    paymentReference: '',
    paymentNotes: '',
  };
}

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase();
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString();
}

function formatPrice(cents: number | undefined): string {
  if (!Number.isFinite(cents)) return 'Internal price not set';
  return `$${((cents || 0) / 100).toFixed(0)}`;
}

function formatCurrency(cents: number | undefined): string {
  if (!Number.isFinite(cents)) return '$0.00';
  return `$${((cents || 0) / 100).toFixed(2)}`;
}

function editFromPackage(option: PromotionPackageOption): PackageEdit {
  return {
    name: option.name,
    publicSummary: option.publicSummary,
    adminDescription: option.adminDescription,
    bestFor: option.bestFor,
    placementExplanation: option.placementExplanation,
    audience: option.audience,
    placementType: option.placementType,
    durationDays: String(option.durationDays),
    defaultRadiusMiles: String(option.defaultRadiusMiles),
    maxRadiusMiles: String(option.maxRadiusMiles),
    allowCategoryTargeting: option.allowCategoryTargeting,
    maxConcurrentInZone: String(option.maxConcurrentInZone),
    defaultPriceCents: String(option.defaultPriceCents),
    isActive: option.isActive,
    isFoundingRate: option.isFoundingRate,
    pricingLabel: option.pricingLabel,
  };
}

function isPackageEditDirty(option: PromotionPackageOption, edit: PackageEdit): boolean {
  const baseline = editFromPackage(option);
  return JSON.stringify(baseline) !== JSON.stringify(edit);
}

function statusClass(status: string): string {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'scheduled') return 'bg-blue-100 text-blue-800';
  if (status === 'paused') return 'bg-yellow-100 text-yellow-800';
  if (status === 'ended' || status === 'expired' || status === 'cancelled') return 'bg-gray-100 text-gray-700';
  if (status === 'rejected') return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-700';
}

function paymentStatusClass(status: string): string {
  if (status === 'paid' || status === 'waived') return 'bg-green-100 text-green-800';
  if (status === 'pending_payment') return 'bg-yellow-100 text-yellow-800';
  if (status === 'refunded') return 'bg-gray-100 text-gray-700';
  return 'bg-slate-100 text-slate-700';
}

function isPaymentEligibleForActivation(status: string): boolean {
  return status === 'paid' || status === 'waived';
}

export default function AdminPromotedListingsPage() {
  const [campaigns, setCampaigns] = useState<PromotionCampaignRow[]>([]);
  const [packageOptions, setPackageOptions] = useState<PromotionPackageOption[]>(fallbackPackageOptions);
  const [occupancy, setOccupancy] = useState<ZoneOccupancyRow[]>([]);
  const [tracking, setTracking] = useState<PromotionTracking | null>(null);
  const [browseReadiness, setBrowseReadiness] = useState<BrowsePromotionReadiness | null>(null);
  const [paymentEdits, setPaymentEdits] = useState<Record<string, CampaignPaymentEdit>>({});
  const [packageEdits, setPackageEdits] = useState<Record<string, PackageEdit>>({});
  const [form, setForm] = useState<CampaignForm>(() => defaultForm());
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [aiLoadingCampaignId, setAiLoadingCampaignId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingCampaignConfirmation, setPendingCampaignConfirmation] =
    useState<PendingCampaignConfirmation>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (statusFilter) params.set('status', statusFilter);
    params.set('limit', '75');
    return params.toString();
  }, [q, statusFilter]);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError('');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`/api/admin/promoted-listings?${queryString}`, {
        headers: getAdminRequestHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      setCampaigns(Array.isArray(json?.campaigns) ? json.campaigns : []);
      const packages = Array.isArray(json?.meta?.packages) && json.meta.packages.length ? json.meta.packages : fallbackPackageOptions;
      setPackageOptions(packages);
      setPackageEdits((current) => {
        const next = { ...current };
        for (const option of packages) {
          if (!next[option.packageKey]) next[option.packageKey] = editFromPackage(option);
        }
        return next;
      });
      setOccupancy(Array.isArray(json?.meta?.occupancy) ? json.meta.occupancy : []);
      setTracking(json?.meta?.tracking || null);
      setBrowseReadiness(json?.meta?.browseReadiness || null);
    } catch (err) {
      setCampaigns([]);
      setPackageOptions(fallbackPackageOptions);
      setOccupancy([]);
      setTracking(null);
      setBrowseReadiness(null);
      setError(
        err instanceof Error
          ? err.name === 'AbortError'
            ? 'Promoted listing inventory timed out while loading. Retry once the admin route settles.'
            : err.message
          : 'Failed to load promoted listings'
      );
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const requestAiPromotionReview = async (campaign: PromotionCampaignRow) => {
    setAiLoadingCampaignId(campaign.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/admin/promoted-listings/${campaign.id}/assist`, {
        method: 'POST',
        headers: getAdminRequestHeaders(),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      await fetchCampaigns();
      setMessage(json?.message || 'AI promotion readiness recommendation generated.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate AI promotion readiness recommendation'
      );
    } finally {
      setAiLoadingCampaignId(null);
    }
  };

  useEffect(() => {
    void fetchCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  useEffect(() => {
    const activePackages = packageOptions.filter((option) => option.isActive);
    const nextPackages = activePackages.length ? activePackages : packageOptions;
    if (!nextPackages.length) return;
    if (nextPackages.some((option) => option.packageKey === form.packageKey)) return;
    const nextPackage = nextPackages[0];
    setForm((current) => ({
      ...current,
      packageKey: nextPackage.packageKey,
      placementType: nextPackage.placementType,
      targetRadiusMiles: String(nextPackage.defaultRadiusMiles),
      amountDueCents: String(nextPackage.defaultPriceCents),
      targetCategory: nextPackage.allowCategoryTargeting ? current.targetCategory : '',
      endAt: inputDateTime(
        new Date(
          new Date(current.startAt || new Date()).getTime() +
            nextPackage.durationDays * 24 * 60 * 60 * 1000
        )
      ),
    }));
  }, [form.packageKey, packageOptions]);

  const updateForm = (key: keyof CampaignForm, value: string) => {
    if (key === 'packageKey') {
      const activePackages = packageOptions.filter((option) => option.isActive);
      const nextPackages = activePackages.length ? activePackages : packageOptions;
      const selectedPackage =
        nextPackages.find((option) => option.packageKey === value) || nextPackages[0];
      setForm((current) => ({
        ...current,
        packageKey: selectedPackage.packageKey,
        placementType: selectedPackage.placementType,
        targetRadiusMiles: String(selectedPackage.defaultRadiusMiles),
        amountDueCents: String(selectedPackage.defaultPriceCents),
        targetCategory: selectedPackage.allowCategoryTargeting ? current.targetCategory : '',
        endAt: inputDateTime(
          new Date(new Date(current.startAt || new Date()).getTime() + selectedPackage.durationDays * 24 * 60 * 60 * 1000)
        ),
      }));
      return;
    }
    if (key === 'paymentStatus') {
      setForm((current) => ({
        ...current,
        paymentStatus: value,
        status:
          current.status === 'active' && !isPaymentEligibleForActivation(value)
            ? 'scheduled'
            : current.status,
      }));
      return;
    }
    if (key === 'status' && value === 'active' && !isPaymentEligibleForActivation(form.paymentStatus)) {
      setForm((current) => ({ ...current, status: 'scheduled' }));
      return;
    }
    setForm((current) => ({ ...current, [key]: value }));
  };

  const getCampaignPaymentEdit = (campaign: PromotionCampaignRow): CampaignPaymentEdit => (
    paymentEdits[campaign.id] || {
      amountDueCents: String(campaign.amountDueCents || campaign.package?.defaultPriceCents || 0),
      stripePaymentLinkUrl: campaign.stripePaymentLinkUrl || '',
      paymentReference: campaign.paymentReference || '',
      paymentNotes: campaign.paymentNotes || '',
    }
  );

  const updatePaymentEdit = (campaign: PromotionCampaignRow, key: keyof CampaignPaymentEdit, value: string) => {
    setPaymentEdits((current) => ({
      ...current,
      [campaign.id]: {
        ...getCampaignPaymentEdit(campaign),
        [key]: value,
      },
    }));
  };

  const updatePackageEdit = (packageKey: string, key: keyof PackageEdit, value: string | boolean) => {
    const source = packageOptions.find((option) => option.packageKey === packageKey) || fallbackPackageOptions[0];
    setPackageEdits((current) => ({
      ...current,
      [packageKey]: {
        ...(current[packageKey] || editFromPackage(source)),
        [key]: value,
      },
    }));
  };

  const savePackage = async (option: PromotionPackageOption) => {
    const edit = packageEdits[option.packageKey] || editFromPackage(option);
    setSavingId(option.packageKey);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/promoted-listings', {
        method: 'PATCH',
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          entityType: 'promotion_package',
          packageKey: option.packageKey,
          ...edit,
          durationDays: Number(edit.durationDays),
          defaultRadiusMiles: Number(edit.defaultRadiusMiles),
          maxRadiusMiles: Number(edit.maxRadiusMiles),
          maxConcurrentInZone: Number(edit.maxConcurrentInZone),
          defaultPriceCents: Number(edit.defaultPriceCents),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      const packages = Array.isArray(json?.packages) && json.packages.length ? json.packages : packageOptions;
      setPackageOptions(packages);
      setPackageEdits(Object.fromEntries(packages.map((packageOption: PromotionPackageOption) => [packageOption.packageKey, editFromPackage(packageOption)])));
      setMessage(`${edit.name || option.name} package saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save package');
    } finally {
      setSavingId(null);
    }
  };

  const createCampaign = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/promoted-listings', {
        method: 'POST',
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          ...form,
          rankPriority: Number(form.rankPriority),
          targetRadiusMiles: Number(form.targetRadiusMiles),
          amountDueCents: Number(form.amountDueCents),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      setMessage('Promoted listing campaign created.');
      setForm(defaultForm(packageOptions));
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create promoted listing');
    } finally {
      setSaving(false);
    }
  };

  const updateCampaignStatus = async (campaign: PromotionCampaignRow, status: string) => {
    setSavingId(campaign.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/promoted-listings', {
        method: 'PATCH',
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          campaignId: campaign.id,
          status,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      setMessage(`${campaign.name} moved to ${formatLabel(status)}.`);
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update campaign');
    } finally {
      setSavingId(null);
    }
  };

  const updateCampaignPaymentStatus = async (
    campaign: PromotionCampaignRow,
    paymentStatus: string,
    paymentEdit: CampaignPaymentEdit = getCampaignPaymentEdit(campaign)
  ) => {
    setSavingId(campaign.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/promoted-listings', {
        method: 'PATCH',
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          campaignId: campaign.id,
          paymentStatus,
          amountDueCents: Number(paymentEdit.amountDueCents),
          stripePaymentLinkUrl: paymentEdit.stripePaymentLinkUrl,
          paymentReference: paymentEdit.paymentReference,
          paymentNotes: paymentEdit.paymentNotes,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      setMessage(`${campaign.name} payment moved to ${formatLabel(paymentStatus)}.`);
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment status');
    } finally {
      setSavingId(null);
    }
  };

  const updateCampaignPaymentDetails = async (campaign: PromotionCampaignRow, paymentEdit: CampaignPaymentEdit) => {
    setSavingId(campaign.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/promoted-listings', {
        method: 'PATCH',
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          campaignId: campaign.id,
          amountDueCents: Number(paymentEdit.amountDueCents),
          stripePaymentLinkUrl: paymentEdit.stripePaymentLinkUrl,
          paymentReference: paymentEdit.paymentReference,
          paymentNotes: paymentEdit.paymentNotes,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      setMessage(`${campaign.name} payment details saved.`);
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment details');
    } finally {
      setSavingId(null);
    }
  };

  const openCampaignPaymentConfirmation = (
    campaign: PromotionCampaignRow,
    paymentStatus: string,
    paymentEdit: CampaignPaymentEdit
  ) => {
    setPendingCampaignConfirmation({
      kind: 'payment',
      campaign,
      nextValue: paymentStatus,
      paymentEdit,
    });
  };

  const openCampaignStatusConfirmation = (campaign: PromotionCampaignRow, status: string) => {
    setPendingCampaignConfirmation({
      kind: 'status',
      campaign,
      nextValue: status,
    });
  };

  const closeCampaignConfirmation = () => {
    if (savingId) return;
    setPendingCampaignConfirmation(null);
  };

  const confirmPendingCampaignAction = async () => {
    const pending = pendingCampaignConfirmation;
    if (!pending) return;
    setPendingCampaignConfirmation(null);
    if (pending.kind === 'payment') {
      await updateCampaignPaymentStatus(pending.campaign, pending.nextValue, pending.paymentEdit);
      return;
    }
    await updateCampaignStatus(pending.campaign, pending.nextValue);
  };

  const copyPaymentLink = async (url: string) => {
    const paymentLink = url.trim();
    if (!paymentLink) {
      setError('Add a Stripe Payment Link before copying.');
      return;
    }
    try {
      await navigator.clipboard.writeText(paymentLink);
      setError('');
      setMessage('Stripe Payment Link copied.');
    } catch {
      setError('Unable to copy the Stripe Payment Link from this browser.');
    }
  };

  const openPaymentLink = (url: string) => {
    const paymentLink = url.trim();
    if (!paymentLink) {
      setError('Add a Stripe Payment Link before opening.');
      return;
    }
    window.open(paymentLink, '_blank', 'noopener,noreferrer');
  };

  const activeCount = campaigns.filter((campaign) => campaign.status === 'active').length;
  const renderableCount = campaigns.filter((campaign) => campaign.eligibility.renderable).length;
  const blockedCount = campaigns.filter((campaign) => !campaign.eligibility.serviceEligible || !campaign.eligibility.paymentEligible).length;
  const creatablePackageOptions = packageOptions.filter((option) => option.isActive);
  const createFormPackageOptions = creatablePackageOptions.length ? creatablePackageOptions : packageOptions;
  const hasDeferredHomepageInventory = packageOptions.some(
    (option) => option.placementType === 'HOME_FEATURED'
  );
  const selectedPackage =
    createFormPackageOptions.find((option) => option.packageKey === form.packageKey) ||
    createFormPackageOptions[0];
  const createCampaignRequirements = [
    !form.name.trim() ? 'Campaign name' : null,
    !form.vendorId.trim() ? 'Vendor ID' : null,
    !form.serviceId.trim() ? 'Published service ID' : null,
  ].filter(Boolean) as string[];
  const canCreateCampaign = !saving && createCampaignRequirements.length === 0;
  const packageGuidance = packageOptions.map((option) => ({
    title: option.name,
    description: `${option.durationDays} days, ${option.placementType}, up to ${option.maxRadiusMiles} miles, ${
      option.allowCategoryTargeting ? 'category targeting allowed' : 'no category targeting'
    }, ${formatPrice(option.defaultPriceCents)} editable price. ${option.isFoundingRate ? option.pricingLabel || 'Founding / intro rate' : 'Standard rate'}. ${option.bestFor}`,
  }));
  const trackingSummary = tracking || {
    totalRevenueCents: campaigns.filter((campaign) => campaign.paymentStatus === 'paid').reduce((sum, campaign) => sum + (campaign.amountDueCents || 0), 0),
    pendingPaymentCount: campaigns.filter((campaign) => campaign.paymentStatus === 'pending_payment').length,
    pendingPaymentAmountCents: campaigns.filter((campaign) => campaign.paymentStatus === 'pending_payment').reduce((sum, campaign) => sum + (campaign.amountDueCents || 0), 0),
    paymentLinkReadyCount: campaigns.filter((campaign) => Boolean(campaign.stripePaymentLinkUrl)).length,
    paidCampaignCount: campaigns.filter((campaign) => campaign.paymentStatus === 'paid').length,
    activeCampaignCount: activeCount,
    packagePerformance: [],
    recentPaymentEvents: [],
  };
  const isInitialInventoryLoad = loading && !tracking && !browseReadiness && campaigns.length === 0;
  const isInventoryUnavailable =
    !loading && Boolean(error) && !tracking && !browseReadiness && campaigns.length === 0;
  const topLineMetrics = [
    {
      label: 'Active now',
      value: isInitialInventoryLoad ? 'Loading...' : isInventoryUnavailable ? 'Unavailable' : String(activeCount),
      helper: isInitialInventoryLoad
        ? 'Loading live promotion metrics.'
        : isInventoryUnavailable
          ? 'Live campaign metrics are temporarily unavailable.'
          : 'Campaigns currently marked active.',
      valueClass: isInitialInventoryLoad || isInventoryUnavailable ? 'text-slate-500 text-lg' : 'text-[#204080]',
    },
    {
      label: 'Ready to render',
      value: isInitialInventoryLoad ? 'Loading...' : isInventoryUnavailable ? 'Unavailable' : String(renderableCount),
      helper: isInitialInventoryLoad
        ? 'Checking timing, payment, vendor, and service rules.'
        : isInventoryUnavailable
          ? 'Renderable campaign checks are temporarily unavailable.'
          : 'Meets timing, payment, vendor, and service rules.',
      valueClass: isInitialInventoryLoad || isInventoryUnavailable ? 'text-slate-500 text-lg' : 'text-green-700',
    },
    {
      label: 'Pending payment',
      value: isInitialInventoryLoad ? 'Loading...' : isInventoryUnavailable ? 'Unavailable' : String(trackingSummary.pendingPaymentCount),
      helper: isInitialInventoryLoad
        ? 'Loading Stripe-link and payment review counts.'
        : isInventoryUnavailable
          ? 'Pending payment totals are temporarily unavailable.'
          : `${formatCurrency(trackingSummary.pendingPaymentAmountCents)} still waiting on payment confirmation.`,
      valueClass: isInitialInventoryLoad || isInventoryUnavailable ? 'text-slate-500 text-lg' : 'text-amber-700',
    },
    {
      label: 'Recorded revenue',
      value: isInitialInventoryLoad ? 'Loading...' : isInventoryUnavailable ? 'Unavailable' : formatCurrency(trackingSummary.totalRevenueCents),
      helper: isInitialInventoryLoad
        ? 'Loading recorded promotion revenue.'
        : isInventoryUnavailable
          ? 'Recorded revenue is temporarily unavailable.'
          : 'Paid campaigns recorded by admin.',
      valueClass: isInitialInventoryLoad || isInventoryUnavailable ? 'text-slate-500 text-lg' : 'text-emerald-700',
    },
  ];
  const browseReadinessSummary = browseReadiness;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#204080]">Promoted Listings</h1>
            <p className="text-sm text-gray-600">
              Admin-controlled promoted placement for eligible public vendors. Use this page to manage packages, reserve inventory, track payment, and activate campaigns after payment is confirmed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TutorialEntryPoint guide={tutorialGuides.adminPromotedListings} surface="light" />
            <Button variant="outline" onClick={fetchCampaigns} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Promoted listing top line metrics">
        {topLineMetrics.map((metric) => (
          <Card key={metric.label} className="border-blue-100 bg-white">
            <CardContent className="space-y-2 pt-6">
              <p className="text-sm font-medium text-gray-600">{metric.label}</p>
              <p className={`text-3xl font-bold ${metric.valueClass}`}>{metric.value}</p>
              <p className="text-xs text-gray-500">{metric.helper}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-slate-200 bg-slate-50">
        <CardHeader>
          <CardTitle>Browse Render Readiness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          {isInitialInventoryLoad ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
              Loading live browse-floor readiness so the dashboard can show the current organic inventory instead of a placeholder count.
            </div>
          ) : isInventoryUnavailable || !browseReadinessSummary ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              Browse render readiness is temporarily unavailable. Retry once the promoted-listing inventory endpoint finishes responding.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current organic browse listings</div>
                <div className="mt-2 text-3xl font-bold text-slate-900">{browseReadinessSummary.organicBrowseCount}</div>
                <div className="mt-1 text-xs text-slate-600">
                  Need at least {browseReadinessSummary.desktopMinimumOrganicCount} for desktop browse promotions.
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Desktop browse status</div>
                <div className={`mt-2 text-2xl font-bold ${browseReadinessSummary.desktopBrowseEligible ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {browseReadinessSummary.desktopBrowseEligible ? 'Ready' : 'Suppressed'}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  Paid browse cards stay hidden when the organic floor is not met.
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category views meeting floor</div>
                <div className="mt-2 text-3xl font-bold text-slate-900">
                  {browseReadinessSummary.categoriesMeetingMinimum}/{browseReadinessSummary.totalCategoriesWithListings}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  Category-filtered browse needs at least {browseReadinessSummary.categoryMinimumOrganicCount} organic listings.
                </div>
              </div>
            </div>
          )}
          <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
            This is the public browse floor check, separate from payment, approval, and reserved-slot inventory. A campaign can be valid and still stay off the public browse page until these organic-result minimums are met.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <a
            href="#create-featured-campaign"
            className="inline-flex items-center justify-center rounded-md bg-[#204080] px-4 py-2 text-sm font-medium text-white hover:bg-[#16315f]"
          >
            Jump to Create Campaign
          </a>
          <a
            href="#campaign-inventory"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            Jump to Campaign Inventory
          </a>
          <a
            href="#editable-package-catalog"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            Jump to Package Catalog
          </a>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Promoted listings admin guidance">
        <Card>
          <CardHeader>
            <CardTitle>Operator Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-700">
            <div className="grid gap-3 md:grid-cols-2">
              {[
                'Choose a package and confirm vendor, service, timing, and radius.',
                'Keep the campaign non-live while admin prepares or shares the Stripe Payment Link.',
                'Record the Stripe payment reference after payment is confirmed outside Reliance.',
                'Activate only after payment is marked paid or waived.',
              ].map((step, index) => (
                <div key={step} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#204080]">
                    {index + 1}
                  </div>
                  <p>{step}</p>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
              Paid or waived payment status is required before activation. Pending payment campaigns can reserve inventory, but cannot go live.
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {placementGuidance.map(([label, description]) => (
                <div key={label} className="rounded-xl border border-gray-200 p-3">
                  <div className="font-semibold text-gray-900">{label}</div>
                  <div className="text-xs text-gray-600">{description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Package And Status Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-700">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
              New campaigns snapshot package pricing and terms at the time of sale, so later package edits do not rewrite historical campaigns.
            </div>
            <div className="space-y-2">
              {packageGuidance.map((item) => (
                <div key={item.title} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-gray-900">{item.title}</div>
                    <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-800">
                      Package
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600">{item.description}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment states</div>
                <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
                  {paymentStatusGuidance.map(([label, description]) => (
                    <div key={label} className="text-xs">
                      <span className="font-semibold text-gray-900">{formatLabel(label)}:</span> {description}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Campaign states</div>
                <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
                  {campaignStatusGuidance.map(([label, description]) => (
                    <div key={label} className="text-xs">
                      <span className="font-semibold text-gray-900">{formatLabel(label)}:</span> {description}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card id="editable-package-catalog">
        <CardHeader>
          <CardTitle>Editable Package Catalog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Package keys stay stable for reporting, while price, offer copy, targeting, and founding-rate labels can be edited here. New campaigns snapshot the package terms at creation so later edits do not rewrite prior sales.
          </p>
          <div className="grid grid-cols-1 gap-4">
            {packageOptions.map((option) => {
              const edit = packageEdits[option.packageKey] || editFromPackage(option);
              const isDirty = isPackageEditDirty(option, edit);
              return (
                <div key={option.packageKey} className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{option.packageKey}</div>
                      <div className="text-xs text-gray-600">
                        {option.isFoundingRate ? option.pricingLabel || 'Founding / intro rate' : 'Standard rate'} · {option.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => savePackage(option)}
                      disabled={savingId === option.packageKey || !isDirty}
                    >
                      {savingId === option.packageKey ? 'Saving...' : 'Save package'}
                    </Button>
                  </div>
                  <div className={`mb-3 text-xs ${isDirty ? 'text-amber-700' : 'text-gray-500'}`}>
                    {isDirty ? 'Unsaved package changes.' : 'No package changes to save yet.'}
                  </div>
                  {option.placementType === 'HOME_FEATURED' ? (
                    <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      Homepage spotlight sales stay disabled until the public homepage promotion surface is launched.
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div className="space-y-1">
                      <Label htmlFor={`pkg-name-${option.packageKey}`}>Package name</Label>
                      <Input id={`pkg-name-${option.packageKey}`} value={edit.name} onChange={(event) => updatePackageEdit(option.packageKey, 'name', event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pkg-price-${option.packageKey}`}>Price (cents)</Label>
                      <Input id={`pkg-price-${option.packageKey}`} type="number" min="0" value={edit.defaultPriceCents} onChange={(event) => updatePackageEdit(option.packageKey, 'defaultPriceCents', event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pkg-placement-${option.packageKey}`}>Placement</Label>
                      <select id={`pkg-placement-${option.packageKey}`} className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={edit.placementType} onChange={(event) => updatePackageEdit(option.packageKey, 'placementType', event.target.value)}>
                        {placementTypes.map((placementType) => (
                          <option key={placementType} value={placementType}>{placementType}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pkg-duration-${option.packageKey}`}>Duration days</Label>
                      <Input id={`pkg-duration-${option.packageKey}`} type="number" min="1" value={edit.durationDays} onChange={(event) => updatePackageEdit(option.packageKey, 'durationDays', event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pkg-default-radius-${option.packageKey}`}>Default radius</Label>
                      <select id={`pkg-default-radius-${option.packageKey}`} className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={edit.defaultRadiusMiles} onChange={(event) => updatePackageEdit(option.packageKey, 'defaultRadiusMiles', event.target.value)}>
                        {radiusOptionsMiles.map((radius) => (
                          <option key={radius} value={radius}>{radius} miles</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pkg-max-radius-${option.packageKey}`}>Max radius</Label>
                      <select id={`pkg-max-radius-${option.packageKey}`} className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={edit.maxRadiusMiles} onChange={(event) => updatePackageEdit(option.packageKey, 'maxRadiusMiles', event.target.value)}>
                        {radiusOptionsMiles.map((radius) => (
                          <option key={radius} value={radius}>{radius} miles</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pkg-slots-${option.packageKey}`}>Max concurrent slots</Label>
                      <Input id={`pkg-slots-${option.packageKey}`} type="number" min="1" value={edit.maxConcurrentInZone} onChange={(event) => updatePackageEdit(option.packageKey, 'maxConcurrentInZone', event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pkg-pricing-label-${option.packageKey}`}>Pricing label</Label>
                      <Input id={`pkg-pricing-label-${option.packageKey}`} value={edit.pricingLabel} onChange={(event) => updatePackageEdit(option.packageKey, 'pricingLabel', event.target.value)} placeholder="Founding / intro rate" />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={edit.allowCategoryTargeting} onChange={(event) => updatePackageEdit(option.packageKey, 'allowCategoryTargeting', event.target.checked)} />
                      Category targeting included
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={edit.isFoundingRate} onChange={(event) => updatePackageEdit(option.packageKey, 'isFoundingRate', event.target.checked)} />
                      Mark as founding / intro pricing
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={edit.isActive}
                        disabled={option.placementType === 'HOME_FEATURED'}
                        onChange={(event) => updatePackageEdit(option.packageKey, 'isActive', event.target.checked)}
                      />
                      Active for new campaigns
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`pkg-summary-${option.packageKey}`}>Public/vendor summary</Label>
                      <Textarea id={`pkg-summary-${option.packageKey}`} value={edit.publicSummary} onChange={(event) => updatePackageEdit(option.packageKey, 'publicSummary', event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pkg-admin-${option.packageKey}`}>Internal admin notes</Label>
                      <Textarea id={`pkg-admin-${option.packageKey}`} value={edit.adminDescription} onChange={(event) => updatePackageEdit(option.packageKey, 'adminDescription', event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pkg-best-for-${option.packageKey}`}>Best for</Label>
                      <Textarea id={`pkg-best-for-${option.packageKey}`} value={edit.bestFor} onChange={(event) => updatePackageEdit(option.packageKey, 'bestFor', event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pkg-placement-note-${option.packageKey}`}>Where it appears</Label>
                      <Textarea id={`pkg-placement-note-${option.packageKey}`} value={edit.placementExplanation} onChange={(event) => updatePackageEdit(option.packageKey, 'placementExplanation', event.target.value)} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor={`pkg-audience-${option.packageKey}`}>Who it is best suited for</Label>
                      <Textarea id={`pkg-audience-${option.packageKey}`} value={edit.audience} onChange={(event) => updatePackageEdit(option.packageKey, 'audience', event.target.value)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Promoted listings summary">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-[#204080]">{activeCount}</div>
            <div className="text-sm text-gray-600">Active campaigns</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-700">{renderableCount}</div>
            <div className="text-sm text-gray-600">Currently renderable</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-700">{blockedCount}</div>
            <div className="text-sm text-gray-600">Blocked by eligibility</div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Promotion revenue and operations tracking">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-green-700" />
              Revenue Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-2xl font-bold text-green-700">{formatCurrency(trackingSummary.totalRevenueCents)}</div>
              <div className="text-sm text-gray-600">Recorded paid promotion revenue</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-gray-200 p-3">
                <div className="font-semibold text-gray-900">{trackingSummary.paidCampaignCount}</div>
                <div className="text-xs text-gray-600">Paid campaigns</div>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <div className="font-semibold text-orange-700">{trackingSummary.pendingPaymentCount}</div>
                <div className="text-xs text-gray-600">Pending payment</div>
              </div>
            </div>
            <p className="text-xs text-gray-500">Pending amount due: {formatCurrency(trackingSummary.pendingPaymentAmountCents)}</p>
            <p className="text-xs text-gray-500">Campaigns with Stripe links ready/sent: {trackingSummary.paymentLinkReadyCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Packages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trackingSummary.packagePerformance.length === 0 ? (
              <p className="text-sm text-gray-500">No package data recorded yet.</p>
            ) : (
              trackingSummary.packagePerformance.slice(0, 4).map((item) => (
                <div key={item.packageKey} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-600">{item.count} campaign{item.count === 1 ? '' : 's'}</div>
                  </div>
                  <div className="text-sm font-semibold text-green-700">{formatCurrency(item.revenueCents)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Payment Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trackingSummary.recentPaymentEvents.length === 0 ? (
              <p className="text-sm text-gray-500">No payment events recorded yet.</p>
            ) : (
              trackingSummary.recentPaymentEvents.slice(0, 5).map((event) => (
                <div key={`${event.id}-${event.updatedAt || event.paidAt || event.paymentStatus}`} className="rounded-md border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-900">{event.name}</div>
                    <Badge className={paymentStatusClass(event.paymentStatus)}>{formatLabel(event.paymentStatus)}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {event.vendorName || 'Unknown vendor'} · {event.packageName} · {formatCurrency(event.amountDueCents)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Ref: {event.paymentReference || 'not recorded'} · Paid: {formatDate(event.paidAt)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Promotion zone occupancy">
        {occupancy.map((zone) => (
          <Card key={zone.placementType}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{zone.placementType}</div>
                  <div className="text-xs text-gray-600">
                    Current renderable: {zone.current}/{zone.maxRenderableDesktop} desktop slots
                  </div>
                </div>
                <Badge variant="outline">
                  Reserved {zone.reserved}/{zone.maxReservableSlots}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Activation and scheduled reservations are blocked once this zone is full for an overlapping window.
              </p>
              {zone.placementType === 'BROWSE_FEATURED' ? (
                <p className="mt-2 text-xs text-gray-500">
                  Public browse rendering also stays suppressed until the page has enough organic inventory:
                  at least 4 desktop organic listings, or 3 when category-filtered.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </section>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}

      <Card id="create-featured-campaign">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Create Featured Campaign
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            Create campaigns only for vendors that are active, publicly listed, and tied to a published service. If a vendor is later suspended, unlisted, or the service is unpublished, public rendering stops automatically.
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
            Payment Link workflow: paste the Stripe Payment Link when ready, leave payment status pending until the payment is confirmed outside Reliance, then record the transaction reference and mark paid. The app does not verify Stripe automatically yet.
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Browse featured campaigns can still stay off the public page even after approval and payment when the current browse surface is too thin.
            Reliance currently requires at least 4 organic desktop listings, or 3 on category-filtered browse, before paid featured placements render.
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="text-sm font-semibold text-[#204080]">Selected package snapshot</div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-gray-700">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Package</div>
                <div>{selectedPackage.name}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Placement</div>
                <div>{selectedPackage.placementType}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Duration</div>
                <div>{selectedPackage.durationDays} days</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Default price</div>
                <div>{formatCurrency(selectedPackage.defaultPriceCents)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Radius</div>
                <div>
                  {selectedPackage.defaultRadiusMiles} default · up to {selectedPackage.maxRadiusMiles} miles
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Category targeting</div>
                <div>{selectedPackage.allowCategoryTargeting ? 'Included' : 'Not included'}</div>
              </div>
              <div className="md:col-span-2 xl:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Best for</div>
                <div>{selectedPackage.bestFor}</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="campaign-name">Campaign name</Label>
              <Input id="campaign-name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="Spring browse feature" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="package-key">Package</Label>
              <select id="package-key" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={form.packageKey} onChange={(event) => updateForm('packageKey', event.target.value)}>
                {createFormPackageOptions.map((option) => (
                  <option key={option.packageKey} value={option.packageKey}>
                    {option.name}
                  </option>
                ))}
              </select>
              {hasDeferredHomepageInventory ? (
                <p className="text-xs text-amber-700">
                  Homepage spotlight inventory is intentionally excluded here until the public homepage promotion surface is launched.
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="vendor-id">Vendor ID</Label>
              <Input id="vendor-id" value={form.vendorId} onChange={(event) => updateForm('vendorId', event.target.value)} placeholder="vendor cuid" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="service-id">Published service ID</Label>
              <Input id="service-id" value={form.serviceId} onChange={(event) => updateForm('serviceId', event.target.value)} placeholder="service cuid" />
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <div className="font-medium text-gray-900">Need vendor or service IDs?</div>
            <p className="mt-1">
              Use All Accounts to confirm the vendor identity and use Publish Management to find the published service you want to promote.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                href="/admin/accounts?tab=vendors"
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100"
              >
                Open Vendor Accounts
              </a>
              <a
                href="/admin/publish-management"
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100"
              >
                Open Publish Management
              </a>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="placement-type">Placement</Label>
              <select id="placement-type" className="h-10 w-full rounded-md border border-gray-300 bg-gray-50 px-3 text-sm text-gray-700" value={form.placementType} disabled>
                {placementTypes.map((placementType) => (
                  <option key={placementType} value={placementType}>{placementType}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500">Placement is locked to the selected package.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="campaign-status">Initial status</Label>
              <select id="campaign-status" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                {statuses.map((status) => (
                  <option
                    key={status}
                    value={status}
                    disabled={status === 'active' && !isPaymentEligibleForActivation(form.paymentStatus)}
                  >
                    {formatLabel(status)}
                  </option>
                ))}
              </select>
              {!isPaymentEligibleForActivation(form.paymentStatus) ? (
                <p className="text-xs text-amber-700">Active is unlocked only after payment is marked paid or waived.</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment-status">Payment status</Label>
              <select id="payment-status" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={form.paymentStatus} onChange={(event) => updateForm('paymentStatus', event.target.value)}>
                {paymentStatuses.map((status) => (
                  <option key={status} value={status}>{formatLabel(status)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="start-at">Start</Label>
              <Input id="start-at" type="datetime-local" value={form.startAt} onChange={(event) => updateForm('startAt', event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end-at">End</Label>
              <Input id="end-at" type="datetime-local" value={form.endAt} onChange={(event) => updateForm('endAt', event.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="target-category">Category</Label>
              <Input id="target-category" value={form.targetCategory} onChange={(event) => updateForm('targetCategory', event.target.value)} placeholder={selectedPackage.allowCategoryTargeting ? 'Optional' : 'Not included'} disabled={!selectedPackage.allowCategoryTargeting} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="target-city">City</Label>
              <Input id="target-city" value={form.targetCity} onChange={(event) => updateForm('targetCity', event.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="target-state">State</Label>
              <Input id="target-state" value={form.targetState} onChange={(event) => updateForm('targetState', event.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="target-zip">ZIP</Label>
              <Input id="target-zip" value={form.targetZip} onChange={(event) => updateForm('targetZip', event.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="target-radius">Target radius</Label>
              <select id="target-radius" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={form.targetRadiusMiles} onChange={(event) => updateForm('targetRadiusMiles', event.target.value)}>
                {radiusOptionsMiles.filter((radius) => radius <= selectedPackage.maxRadiusMiles).map((radius) => (
                  <option key={radius} value={radius}>{radius} miles</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rank-priority">Rank priority</Label>
              <Input id="rank-priority" type="number" value={form.rankPriority} onChange={(event) => updateForm('rankPriority', event.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="amount-due">Amount due (cents)</Label>
              <Input id="amount-due" type="number" min="0" value={form.amountDueCents} onChange={(event) => updateForm('amountDueCents', event.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="stripe-payment-link-url">Stripe Payment Link URL</Label>
              <Input id="stripe-payment-link-url" value={form.stripePaymentLinkUrl} onChange={(event) => updateForm('stripePaymentLinkUrl', event.target.value)} placeholder="https://buy.stripe.com/..." />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment-reference">Payment reference</Label>
              <Input id="payment-reference" value={form.paymentReference} onChange={(event) => updateForm('paymentReference', event.target.value)} placeholder="Stripe session/payment ref" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="admin-notes">Admin notes</Label>
            <Textarea id="admin-notes" value={form.adminNotes} onChange={(event) => updateForm('adminNotes', event.target.value)} placeholder="Internal approval or placement context" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="payment-notes">Payment notes</Label>
            <Textarea id="payment-notes" value={form.paymentNotes} onChange={(event) => updateForm('paymentNotes', event.target.value)} placeholder="Internal billing/payment-link context" />
          </div>
          <Button type="button" onClick={createCampaign} disabled={!canCreateCampaign}>
            {saving ? 'Creating...' : 'Create Campaign'}
          </Button>
          {!canCreateCampaign ? (
            <p className="text-xs text-amber-700">
              {saving
                ? 'Creating the campaign now.'
                : `Complete these required fields before creating the campaign: ${createCampaignRequirements.join(', ')}.`}
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Vendor, service, and campaign name are set. Review payment and timing details before creating the campaign.
            </p>
          )}
        </CardContent>
      </Card>

      <Card id="campaign-inventory">
        <CardHeader>
          <CardTitle>Campaign Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_auto]">
            <div className="space-y-1">
              <Label htmlFor="campaign-search">Search campaigns</Label>
              <Input id="campaign-search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Campaign, vendor, service, or ID" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status-filter">Status</Label>
              <select id="status-filter" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{formatLabel(status)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={fetchCampaigns} disabled={loading}>
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Loading promoted listing inventory...</div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              <div>No promoted listing campaigns found.</div>
              <div className="mt-2 text-xs text-gray-500">
                Start by creating a featured campaign, or review package pricing before launching the first placement.
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="#create-featured-campaign"
                  className="inline-flex items-center justify-center rounded-md bg-[#204080] px-4 py-2 text-sm font-medium text-white hover:bg-[#16315f]"
                >
                  Create First Campaign
                </a>
                <a
                  href="#editable-package-catalog"
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                >
                  Review Package Catalog
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => {
                const paymentEdit = getCampaignPaymentEdit(campaign);
                const activationBlocked = !isPaymentEligibleForActivation(campaign.paymentStatus);
                const hasPaymentLink = Boolean(paymentEdit.stripePaymentLinkUrl.trim());
                const canRecordPaid = Boolean(paymentEdit.paymentReference.trim());
                return (
                <div key={campaign.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                        <Badge className={statusClass(campaign.status)}>{formatLabel(campaign.status)}</Badge>
                        <Badge className={paymentStatusClass(campaign.paymentStatus)}>{formatLabel(campaign.paymentStatus)}</Badge>
                        <Badge variant="outline">{campaign.placementType}</Badge>
                        <Badge variant="outline">{campaign.package?.name || campaign.packageKey}</Badge>
                        {campaign.eligibility.renderable ? (
                          <Badge className="bg-green-100 text-green-800">Renderable</Badge>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-800">Not rendering</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-700">
                        <div>Vendor: {campaign.vendor?.name || campaign.vendor?.id || 'Unknown vendor'}</div>
                        <div>Service: {campaign.service?.name || campaign.service?.id || 'No service selected'}</div>
                        <div>Window: {formatDate(campaign.startAt)} to {formatDate(campaign.endAt)}</div>
                        <div>Target: {[campaign.targetCategory, campaign.targetCity, campaign.targetState, campaign.targetZip].filter(Boolean).join(' / ') || 'No specific target'} within {campaign.targetRadiusMiles} miles when browse location is available</div>
                        <div>
                          Package sold: {campaign.packageSnapshot?.name || campaign.package?.name || campaign.packageKey} ({campaign.packageSnapshot?.durationDays || campaign.package?.durationDays || '?'} days, {formatPrice(campaign.packageSnapshot?.priceCents || campaign.amountDueCents || campaign.package?.defaultPriceCents)})
                          {campaign.packageSnapshot?.isFoundingRate || campaign.package?.isFoundingRate ? ` · ${campaign.packageSnapshot?.pricingLabel || campaign.package?.pricingLabel || 'Founding / intro rate'}` : ''}
                        </div>
                        <div className="text-xs text-gray-500">Snapshot: {campaign.packageSnapshotAt ? `captured ${formatDate(campaign.packageSnapshotAt)}` : 'legacy campaign uses current package fallback'}</div>
                        <div>Amount due: {formatCurrency(campaign.amountDueCents)} · Payment ref: {campaign.paymentReference || 'not recorded'} · Paid at: {formatDate(campaign.paidAt)}</div>
                        <div>Stripe link: {campaign.stripePaymentLinkUrl ? <a className="text-blue-700 underline" href={campaign.stripePaymentLinkUrl} target="_blank" rel="noreferrer">open recorded link</a> : 'not recorded'}</div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Vendor eligible: {campaign.eligibility.vendorEligible ? 'yes' : 'no'}
                        </span>
                        <span>Service eligible: {campaign.eligibility.serviceEligible ? 'yes' : 'no'}</span>
                        <span>Payment eligible: {campaign.eligibility.paymentEligible ? 'yes' : 'no'}</span>
                        <span>Priority: {campaign.rankPriority}</span>
                        <span>ID: {campaign.id}</span>
                      </div>
                      <p
                        className={`text-sm ${
                          campaign.eligibility.renderable ? 'text-emerald-700' : 'text-amber-800'
                        }`}
                      >
                        Render note: {campaign.eligibility.note}
                      </p>
                      {campaign.adminNotes ? <p className="text-sm text-gray-600">Notes: {campaign.adminNotes}</p> : null}
                      {campaign.paymentNotes ? <p className="text-sm text-gray-600">Payment notes: {campaign.paymentNotes}</p> : null}
                      {activationBlocked ? (
                        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          Activation blocked: mark payment paid or waived before moving this campaign active.
                        </p>
                      ) : null}
                      <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                              AI Promotion Readiness
                            </div>
                            <p className="mt-1 text-xs text-blue-800">
                              Recommendation only. Campaign activation and payment decisions stay manual.
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={aiLoadingCampaignId === campaign.id}
                            onClick={() => void requestAiPromotionReview(campaign)}
                          >
                            {aiLoadingCampaignId === campaign.id
                              ? 'Checking...'
                              : campaign.aiRecommendation
                                ? 'Refresh AI Review'
                                : 'Run AI Review'}
                          </Button>
                        </div>
                        {campaign.aiRecommendation ? (
                          <div className="rounded-md border border-blue-200 bg-white p-3 text-sm">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">
                                {String(campaign.aiRecommendation.suggestion.decision || '')
                                  .replace(/_/g, ' ')
                                  .replace(/\b\w/g, (char) => char.toUpperCase())}
                              </Badge>
                              <Badge variant="outline">
                                {campaign.aiRecommendation.suggestion.confidence} confidence
                              </Badge>
                            </div>
                            <p className="mt-3 text-slate-800">
                              {campaign.aiRecommendation.suggestion.summary}
                            </p>
                            {campaign.aiRecommendation.suggestion.blockingIssues?.length ? (
                              <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                                <div className="font-semibold uppercase tracking-wide text-amber-700">
                                  Open blockers
                                </div>
                                <ul className="mt-2 space-y-1">
                                  {campaign.aiRecommendation.suggestion.blockingIssues
                                    .slice(0, 3)
                                    .map((item) => (
                                      <li key={item}>- {item}</li>
                                    ))}
                                </ul>
                              </div>
                            ) : null}
                            {campaign.aiRecommendation.suggestion.recommendedActions?.length ? (
                              <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                                <div className="font-semibold uppercase tracking-wide text-slate-700">
                                  Suggested next actions
                                </div>
                                <ul className="mt-2 space-y-1">
                                  {campaign.aiRecommendation.suggestion.recommendedActions
                                    .slice(0, 3)
                                    .map((item) => (
                                      <li key={item}>- {item}</li>
                                    ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 gap-3 rounded-md border border-gray-100 bg-gray-50 p-3 md:grid-cols-4">
                        <div className="md:col-span-4">
                          <div className="text-sm font-semibold text-gray-900">Manual Stripe Payment Link workflow</div>
                          <p className="text-xs text-gray-600">
                            Save the link, set pending payment when it is sent, record the Stripe reference after payment is confirmed outside Reliance, then use Record paid payment before activating.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`amount-${campaign.id}`}>Amount due (cents)</Label>
                          <Input id={`amount-${campaign.id}`} type="number" min="0" value={paymentEdit.amountDueCents} onChange={(event) => updatePaymentEdit(campaign, 'amountDueCents', event.target.value)} />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <Label htmlFor={`stripe-link-${campaign.id}`}>Stripe Payment Link</Label>
                          <Input id={`stripe-link-${campaign.id}`} value={paymentEdit.stripePaymentLinkUrl} onChange={(event) => updatePaymentEdit(campaign, 'stripePaymentLinkUrl', event.target.value)} placeholder="https://buy.stripe.com/..." />
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" disabled={!hasPaymentLink} onClick={() => copyPaymentLink(paymentEdit.stripePaymentLinkUrl)}>
                              <Copy className="mr-2 h-3.5 w-3.5" />
                              Copy link
                            </Button>
                            <Button type="button" size="sm" variant="outline" disabled={!hasPaymentLink} onClick={() => openPaymentLink(paymentEdit.stripePaymentLinkUrl)}>
                              <ExternalLink className="mr-2 h-3.5 w-3.5" />
                              Open link
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`payment-ref-${campaign.id}`}>Payment reference</Label>
                          <Input id={`payment-ref-${campaign.id}`} value={paymentEdit.paymentReference} onChange={(event) => updatePaymentEdit(campaign, 'paymentReference', event.target.value)} placeholder="Stripe ref" />
                          <p className="text-xs text-gray-500">Required before recording paid.</p>
                        </div>
                        <div className="space-y-1 md:col-span-4">
                          <Label htmlFor={`payment-notes-${campaign.id}`}>Payment notes</Label>
                          <Textarea id={`payment-notes-${campaign.id}`} value={paymentEdit.paymentNotes} onChange={(event) => updatePaymentEdit(campaign, 'paymentNotes', event.target.value)} placeholder="Internal payment notes" />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={savingId === campaign.id}
                        onClick={() => updateCampaignPaymentDetails(campaign, paymentEdit)}
                      >
                        {savingId === campaign.id ? 'Saving...' : 'Save payment details'}
                      </Button>
                      {paymentStatuses.map((paymentStatus) => {
                        const paidWithoutReference = paymentStatus === 'paid' && !canRecordPaid;
                        return (
                          <Button
                            key={paymentStatus}
                            type="button"
                            size="sm"
                            variant={campaign.paymentStatus === paymentStatus ? 'default' : 'outline'}
                            disabled={savingId === campaign.id || campaign.paymentStatus === paymentStatus || paidWithoutReference}
                            title={paidWithoutReference ? 'Enter a Stripe payment reference before recording paid.' : paymentActionHelp[paymentStatus]}
                            onClick={() =>
                              openCampaignPaymentConfirmation(campaign, paymentStatus, paymentEdit)
                            }
                          >
                            {savingId === campaign.id ? 'Saving...' : paymentActionLabels[paymentStatus] || formatLabel(paymentStatus)}
                          </Button>
                        );
                      })}
                      {['active', 'paused', 'ended', 'rejected'].map((status) => (
                        <Button
                          key={status}
                          type="button"
                          size="sm"
                          variant={status === 'active' ? 'default' : 'outline'}
                          disabled={savingId === campaign.id || campaign.status === status || (status === 'active' && activationBlocked)}
                          title={status === 'active' && activationBlocked ? 'Paid or waived required before activation' : undefined}
                          onClick={() => openCampaignStatusConfirmation(campaign, status)}
                        >
                          {savingId === campaign.id ? 'Saving...' : formatLabel(status)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(pendingCampaignConfirmation)} onOpenChange={(open) => !open && closeCampaignConfirmation()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingCampaignConfirmation?.kind === 'payment'
                ? paymentActionLabels[pendingCampaignConfirmation.nextValue] ||
                  formatLabel(pendingCampaignConfirmation.nextValue)
                : pendingCampaignConfirmation
                  ? `Move campaign to ${formatLabel(pendingCampaignConfirmation.nextValue)}`
                  : 'Confirm campaign action'}
            </DialogTitle>
            <DialogDescription>
              {pendingCampaignConfirmation?.kind === 'payment'
                ? `Confirm the payment state change for ${pendingCampaignConfirmation.campaign.name}. This updates campaign revenue tracking and launch eligibility.`
                : pendingCampaignConfirmation
                  ? `Confirm that ${pendingCampaignConfirmation.campaign.name} should move to ${formatLabel(
                      pendingCampaignConfirmation.nextValue
                    )}.`
                  : 'Review the action before continuing.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <div>
              <span className="font-medium text-gray-900">Campaign:</span>{' '}
              {pendingCampaignConfirmation?.campaign.name || 'Unknown campaign'}
            </div>
            <div>
              <span className="font-medium text-gray-900">Current state:</span>{' '}
              {pendingCampaignConfirmation?.kind === 'payment'
                ? formatLabel(pendingCampaignConfirmation.campaign.paymentStatus)
                : pendingCampaignConfirmation
                  ? formatLabel(pendingCampaignConfirmation.campaign.status)
                  : 'Unknown'}
            </div>
            <div>
              <span className="font-medium text-gray-900">New state:</span>{' '}
              {pendingCampaignConfirmation
                ? formatLabel(pendingCampaignConfirmation.nextValue)
                : 'Unknown'}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCampaignConfirmation} disabled={Boolean(savingId)}>
              Cancel
            </Button>
            <Button onClick={confirmPendingCampaignAction} disabled={Boolean(savingId)}>
              {pendingCampaignConfirmation?.kind === 'payment'
                ? paymentActionLabels[pendingCampaignConfirmation.nextValue] ||
                  formatLabel(pendingCampaignConfirmation.nextValue)
                : pendingCampaignConfirmation
                  ? `Confirm ${formatLabel(pendingCampaignConfirmation.nextValue)}`
                  : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
