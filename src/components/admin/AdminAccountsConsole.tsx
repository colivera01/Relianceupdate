'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Building2, MailCheck, Search, ShieldCheck, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAdminRequestHeaders } from '@/lib/admin-client';
import { AdminTrustScorePanel } from '@/components/admin/AdminTrustScorePanel';

type AccountTab = 'customers' | 'vendors' | 'restricted';

type AccountResult = {
  targetType: 'user' | 'vendor';
  id: string;
  displayName: string;
  ownerName?: string | null;
  businessName?: string | null;
  email: string | null;
  phone: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  serviceAreas?: string | null;
  accountStatus: string;
  accountStatusUpdatedAt: string | null;
  accountStatusReason: string | null;
  accountStatusAdminNotes?: string | null;
  isPubliclyListed: boolean | null;
  createdAt: string | null;
  emailVerifiedAt?: string | null;
};

type TrustedDeviceRow = {
  id: string;
  userId: string;
  email: string;
  userName: string;
  label: string | null;
  role: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type AdminAccountsSummary = {
  customers: number;
  vendors: number;
  restricted: number;
  pendingVerification: number;
  pendingVendorApproval: number;
};

type AdminAccountsConsoleProps = {
  summary: AdminAccountsSummary;
};

type TabConfig = {
  value: AccountTab;
  label: string;
  helper: string;
  targetType: 'user' | 'vendor' | 'all';
  defaultStatus: string;
  loadLabel: string;
  loadDescription: string;
  emptyBrowse: string;
  searchPlaceholder: string;
};

const accountActions = [
  { action: 'suspend', label: 'Suspend' },
  { action: 'ban', label: 'Ban' },
  { action: 'deactivate', label: 'Deactivate' },
  { action: 'reactivate', label: 'Reactivate' },
] as const;

const reasonOptions = [
  'harassment',
  'fraud',
  'unsafe_conduct',
  'repeated_inappropriate_content',
  'spam',
  'impersonation',
  'policy_violation',
  'inactivity_cleanup',
  'requested_closure',
  'duplicate_account',
  'other',
] as const;

const TAB_ORDER: readonly AccountTab[] = ['customers', 'vendors', 'restricted'] as const;
const SORT_OPTIONS = ['alpha_asc', 'alpha_desc', 'newest', 'oldest'] as const;

const STATUS_OPTIONS: Record<AccountTab, ReadonlyArray<{ value: string; label: string }>> = {
  customers: [
    { value: 'all', label: 'All customers' },
    { value: 'active', label: 'Active customers' },
    { value: 'pending_verification', label: 'Pending email verification' },
    { value: 'restricted', label: 'Restricted customers' },
    { value: 'suspended', label: 'Suspended customers' },
    { value: 'banned', label: 'Banned customers' },
    { value: 'inactive', label: 'Inactive customers' },
    { value: 'deactivated', label: 'Deactivated customers' },
    { value: 'archived_inactive', label: 'Archived inactive customers' },
  ],
  vendors: [
    { value: 'all', label: 'All vendors' },
    { value: 'active', label: 'Active vendors' },
    { value: 'pending_approval', label: 'Awaiting approval' },
    { value: 'restricted', label: 'Restricted vendors' },
    { value: 'suspended', label: 'Suspended vendors' },
    { value: 'banned', label: 'Banned vendors' },
    { value: 'inactive', label: 'Inactive vendors' },
    { value: 'deactivated', label: 'Deactivated vendors' },
    { value: 'archived_inactive', label: 'Archived inactive vendors' },
  ],
  restricted: [
    { value: 'restricted', label: 'All restricted accounts' },
    { value: 'suspended', label: 'Suspended accounts' },
    { value: 'banned', label: 'Banned accounts' },
    { value: 'deactivated', label: 'Deactivated accounts' },
    { value: 'archived_inactive', label: 'Archived inactive accounts' },
    { value: 'pending_approval', label: 'Vendor approval holds' },
  ],
};

const TAB_CONFIG: Record<AccountTab, TabConfig> = {
  customers: {
    value: 'customers',
    label: 'Customers',
    helper: 'Who is registered, verified, or waiting on email confirmation.',
    targetType: 'user',
    defaultStatus: 'all',
    loadLabel: 'Load customers',
    loadDescription:
      'Open the customer roster to see who is registered, which accounts are still waiting on verification, and which customers are restricted.',
    emptyBrowse: 'No customers matched the current filters.',
    searchPlaceholder: 'Search customers by name, email, phone, location, or ID',
  },
  vendors: {
    value: 'vendors',
    label: 'Vendors',
    helper: 'Who is registered, public, awaiting approval, or needs admin action.',
    targetType: 'vendor',
    defaultStatus: 'all',
    loadLabel: 'Load vendors',
    loadDescription:
      'Open the vendor roster to see live businesses, approval-hold accounts, and public visibility state without leaving the admin console.',
    emptyBrowse: 'No vendors matched the current filters.',
    searchPlaceholder: 'Search vendors by business, owner, email, phone, location, or ID',
  },
  restricted: {
    value: 'restricted',
    label: 'Suspended / Restricted',
    helper: 'One place for suspended, banned, deactivated, archived, and vendor approval-hold accounts.',
    targetType: 'all',
    defaultStatus: 'restricted',
    loadLabel: 'Load restricted accounts',
    loadDescription:
      'Review accounts that are suspended, banned, deactivated, archived inactive, or still blocked behind vendor approval before they affect customers.',
    emptyBrowse: 'No restricted accounts matched the current filters.',
    searchPlaceholder: 'Search restricted customers or vendors by name, email, phone, or ID',
  },
};

function isAccountTab(value: string): value is AccountTab {
  return TAB_ORDER.includes(value as AccountTab);
}

function isSortOption(value: string): value is (typeof SORT_OPTIONS)[number] {
  return SORT_OPTIONS.includes(value as (typeof SORT_OPTIONS)[number]);
}

function normalizeTabFromParams(params: URLSearchParams): AccountTab {
  const tabValue = String(params.get('tab') || '').trim().toLowerCase();
  if (isAccountTab(tabValue)) return tabValue;

  const legacyType = String(params.get('targetType') || '').trim().toLowerCase();
  if (legacyType === 'user') return 'customers';
  if (legacyType === 'vendor') return 'vendors';

  const status = String(params.get('status') || params.get('accountStatus') || '')
    .trim()
    .toLowerCase();
  if (status === 'restricted' || status === 'suspended' || status === 'banned' || status === 'deactivated' || status === 'archived_inactive') {
    return 'restricted';
  }

  return 'vendors';
}

function normalizeStatusForTab(tab: AccountTab, value: string | null | undefined): string {
  const normalized = String(value || '').trim().toLowerCase();
  const allowed = STATUS_OPTIONS[tab].find((option) => option.value === normalized);
  return allowed?.value || TAB_CONFIG[tab].defaultStatus;
}

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function formatRoleLabel(value: string | null): string {
  if (!value) return '';
  const normalized = formatLabel(value).trim();
  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function statusClass(status: string): string {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'pending_approval') return 'bg-amber-100 text-amber-900';
  if (status === 'suspended') return 'bg-orange-100 text-orange-800';
  if (status === 'banned') return 'bg-red-100 text-red-800';
  if (status === 'deactivated' || status === 'archived_inactive') {
    return 'bg-gray-100 text-gray-700';
  }
  return 'bg-blue-100 text-blue-800';
}

function formatLocation(account: AccountResult): string | null {
  const cityState = [account.city, account.state]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
  const zip = String(account.zipCode || '').trim();
  if (cityState && zip) return `${cityState} ${zip}`;
  if (cityState) return cityState;
  if (zip) return zip;
  return null;
}

function formatServiceAreas(value: string | null | undefined): string | null {
  const parts = String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length <= 2) return parts.join(', ');
  return `${parts.slice(0, 2).join(', ')} +${parts.length - 2} more`;
}

function formatSortLabel(value: string): string {
  switch (value) {
    case 'alpha_desc':
      return 'Z-A';
    case 'newest':
      return 'newest first';
    case 'oldest':
      return 'oldest first';
    default:
      return 'A-Z';
  }
}

function formatResultsContextLabel(
  tab: AccountTab,
  source: 'browse' | 'search',
  status: string,
  sort: string,
  query: string
): string {
  if (source === 'search') {
    return query.trim() ? `Search results for "${query.trim()}"` : 'Search results';
  }
  const statusLabel =
    STATUS_OPTIONS[tab].find((option) => option.value === status)?.label ||
    STATUS_OPTIONS[tab][0]?.label ||
    'Accounts';
  return `${statusLabel} sorted ${formatSortLabel(sort)}`;
}

function countFormatter(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function AdminAccountsConsole({ summary }: AdminAccountsConsoleProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AccountTab>('vendors');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(TAB_CONFIG.vendors.defaultStatus);
  const [sortOrder, setSortOrder] = useState<(typeof SORT_OPTIONS)[number]>('alpha_asc');
  const [showInternalRecords, setShowInternalRecords] = useState(false);
  const [resultsSource, setResultsSource] = useState<'browse' | 'search'>('browse');
  const [results, setResults] = useState<AccountResult[]>([]);
  const [selected, setSelected] = useState<AccountResult | null>(null);
  const [reasonCategory, setReasonCategory] = useState('policy_violation');
  const [adminNotes, setAdminNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingAction, setSavingAction] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [trustedDevices, setTrustedDevices] = useState<TrustedDeviceRow[]>([]);
  const [trustedDevicesLoading, setTrustedDevicesLoading] = useState(false);
  const [trustedDevicesError, setTrustedDevicesError] = useState('');
  const [revokingDeviceId, setRevokingDeviceId] = useState('');

  const currentTabConfig = TAB_CONFIG[activeTab];

  const syncResultsAndSelection = (nextResults: AccountResult[]) => {
    setResults(nextResults);
    setSelected((current) =>
      current && nextResults.some((item) => item.id === current.id && item.targetType === current.targetType)
        ? current
        : null
    );
  };

  useEffect(() => {
    const loadTrustedDevices = async () => {
      if (!selected) {
        setTrustedDevices([]);
        setTrustedDevicesError('');
        return;
      }
      setTrustedDevicesLoading(true);
      setTrustedDevicesError('');
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 15000);
      try {
        const params = new URLSearchParams({
          targetType: selected.targetType,
          targetId: selected.id,
        });
        const response = await fetch(`/api/admin/mfa/trusted-devices?${params.toString()}`, {
          headers: getAdminRequestHeaders(),
          cache: 'no-store',
          signal: controller.signal,
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json?.error || json?.message || `Status ${response.status}`);
        }
        setTrustedDevices(Array.isArray(json?.devices) ? json.devices : []);
      } catch (err) {
        setTrustedDevices([]);
        setTrustedDevicesError(
          err instanceof DOMException && err.name === 'AbortError'
            ? 'Trusted MFA devices are temporarily unavailable. Please try again.'
            : err instanceof Error
              ? err.message
              : 'Failed to load MFA devices'
        );
      } finally {
        window.clearTimeout(timeoutId);
        setTrustedDevicesLoading(false);
      }
    };

    void loadTrustedDevices();
  }, [selected]);

  const loadBrowseAccounts = async (
    nextTab = activeTab,
    nextStatus = statusFilter,
    nextSort = sortOrder,
    nextShowInternal = showInternalRecords
  ) => {
    setLoading(true);
    setError('');
    setMessage('');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      const tabConfig = TAB_CONFIG[nextTab];
      const params = new URLSearchParams({
        mode: 'browse',
        targetType: tabConfig.targetType,
        accountStatus: nextStatus,
        sort: nextSort,
        limit: '50',
      });
      if (nextShowInternal) params.set('includeInternal', '1');
      const response = await fetch(`/api/admin/account-lookup?${params.toString()}`, {
        headers: getAdminRequestHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      syncResultsAndSelection(Array.isArray(json?.results) ? json.results : []);
      setResultsSource('browse');
    } catch (err) {
      syncResultsAndSelection([]);
      setError(
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Account roster loading timed out. Reliance could not finish loading the account list. Please try again.'
          : err instanceof Error
            ? err.message
            : 'Failed to load account list'
      );
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const searchAccounts = async (overrides?: {
    tab?: AccountTab;
    query?: string;
    statusFilter?: string;
    sortOrder?: (typeof SORT_OPTIONS)[number];
    showInternalRecords?: boolean;
  }) => {
    const nextTab = overrides?.tab ?? activeTab;
    const lookupQuery = (overrides?.query ?? query).trim();
    const nextStatus = overrides?.statusFilter ?? statusFilter;
    const nextSort = overrides?.sortOrder ?? sortOrder;
    const nextShowInternal = overrides?.showInternalRecords ?? showInternalRecords;

    if (lookupQuery.length < 2) {
      syncResultsAndSelection([]);
      setResultsSource('search');
      setError('Search query must be at least 2 characters.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      const tabConfig = TAB_CONFIG[nextTab];
      const params = new URLSearchParams({
        q: lookupQuery,
        targetType: tabConfig.targetType,
        accountStatus: nextStatus,
        sort: nextSort,
        limit: '25',
      });
      if (nextShowInternal) params.set('includeInternal', '1');
      const response = await fetch(`/api/admin/account-lookup?${params.toString()}`, {
        headers: getAdminRequestHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      syncResultsAndSelection(Array.isArray(json?.results) ? json.results : []);
      setResultsSource('search');
    } catch (err) {
      syncResultsAndSelection([]);
      setError(
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Account lookup timed out. Reliance could not finish loading the results. Please try again.'
          : err instanceof Error
            ? err.message
            : 'Failed to search accounts'
      );
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = searchParams ?? new URLSearchParams();
    const nextTab = normalizeTabFromParams(params);
    const nextQuery = (params.get('q') || '').trim();
    const nextMode = (params.get('mode') || '').trim().toLowerCase();
    const nextStatusRaw = params.get('status') || params.get('accountStatus');
    const nextSortRaw = (params.get('sort') || '').trim().toLowerCase();
    const nextShowInternal = params.get('showInternal') === '1' || params.get('includeInternal') === '1';
    const nextStatus = normalizeStatusForTab(nextTab, nextStatusRaw);
    const nextSort = isSortOption(nextSortRaw) ? nextSortRaw : 'alpha_asc';
    const shouldAutoSearch = nextMode === 'search' && nextQuery.length >= 2;

    setActiveTab(nextTab);
    setQuery(nextQuery);
    setStatusFilter(nextStatus);
    setSortOrder(nextSort);
    setShowInternalRecords(nextShowInternal);

    if (shouldAutoSearch) {
      void searchAccounts({
        tab: nextTab,
        query: nextQuery,
        statusFilter: nextStatus,
        sortOrder: nextSort,
        showInternalRecords: nextShowInternal,
      });
      return;
    }

    void loadBrowseAccounts(nextTab, nextStatus, nextSort, nextShowInternal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const applyAccountAction = async (action: string) => {
    if (!selected) return;
    setSavingAction(action);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/account-actions', {
        method: 'POST',
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          targetType: selected.targetType,
          targetId: selected.id,
          action,
          reasonCategory,
          adminNotes,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      const updatedStatus = json?.account?.accountStatus || selected.accountStatus;
      const updated = {
        ...selected,
        accountStatus: updatedStatus,
        accountStatusUpdatedAt: json?.account?.accountStatusUpdatedAt || new Date().toISOString(),
        accountStatusReason: json?.account?.accountStatusReason || reasonCategory,
        accountStatusAdminNotes: json?.account?.accountStatusAdminNotes || adminNotes,
        isPubliclyListed:
          typeof json?.account?.isPubliclyListed === 'boolean'
            ? json.account.isPubliclyListed
            : selected.isPubliclyListed,
      };
      setSelected(updated);
      setResults((current) =>
        current.map((item) =>
          item.id === updated.id && item.targetType === updated.targetType ? updated : item
        )
      );
      setMessage(`${selected.displayName} was updated to ${formatLabel(updatedStatus)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account');
    } finally {
      setSavingAction('');
    }
  };

  const openActionConfirmation = (action: string) => {
    setPendingAction(action);
  };

  const closeActionConfirmation = () => {
    setPendingAction('');
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    await applyAccountAction(pendingAction);
    setPendingAction('');
  };

  const pendingActionLabel =
    accountActions.find((item) => item.action === pendingAction)?.label || 'Apply action';
  const pendingActionDescription =
    selected && pendingAction
      ? `${pendingActionLabel} will change ${selected.displayName} to a new account state. Please confirm before continuing.`
      : '';

  const revokeTrustedDevice = async (deviceId: string) => {
    if (!selected) return;
    setRevokingDeviceId(deviceId);
    setTrustedDevicesError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/mfa/trusted-devices', {
        method: 'POST',
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          targetType: selected.targetType,
          targetId: selected.id,
          deviceId,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      setTrustedDevices((current) => current.filter((device) => device.id !== deviceId));
      setMessage('Trusted device revoked.');
    } catch (err) {
      setTrustedDevicesError(err instanceof Error ? err.message : 'Failed to revoke trusted device');
    } finally {
      setRevokingDeviceId('');
    }
  };

  const handleTabChange = (nextTabValue: string) => {
    if (!isAccountTab(nextTabValue)) return;
    const nextStatus = TAB_CONFIG[nextTabValue].defaultStatus;
    setActiveTab(nextTabValue);
    setStatusFilter(nextStatus);
    setQuery('');
    setError('');
    setMessage('');
    setSelected(null);
    syncResultsAndSelection([]);
    void loadBrowseAccounts(nextTabValue, nextStatus, sortOrder, showInternalRecords);
  };

  const handleStatusChange = (nextStatus: string) => {
    setStatusFilter(nextStatus);
    if (resultsSource === 'search' && query.trim().length >= 2) {
      void searchAccounts({ statusFilter: nextStatus });
      return;
    }
    void loadBrowseAccounts(activeTab, nextStatus, sortOrder, showInternalRecords);
  };

  const handleSortChange = (nextSort: (typeof SORT_OPTIONS)[number]) => {
    setSortOrder(nextSort);
    if (resultsSource === 'search' && query.trim().length >= 2) {
      void searchAccounts({ sortOrder: nextSort });
      return;
    }
    void loadBrowseAccounts(activeTab, statusFilter, nextSort, showInternalRecords);
  };

  const handleInternalToggle = (nextShowInternal: boolean) => {
    setShowInternalRecords(nextShowInternal);
    if (resultsSource === 'search' && query.trim().length >= 2) {
      void searchAccounts({ showInternalRecords: nextShowInternal });
      return;
    }
    void loadBrowseAccounts(activeTab, statusFilter, sortOrder, nextShowInternal);
  };

  return (
    <div className="space-y-6 py-2">
      <header className="reliance-operator-hero rounded-[32px] px-6 py-7">
        <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
          Account command
        </div>
        <h1 className="mt-5 font-display text-4xl font-semibold text-white sm:text-5xl">
          All Accounts
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 sm:text-base">
          One admin surface for customers, vendors, and restricted accounts. Browse who is registered,
          search faster, and apply account actions without jumping between separate admin pages.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border-white/10 bg-white/[0.04] text-white shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-white/72">
              <Users className="h-4 w-4 text-[var(--reliance-blue-soft)]" />
              Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-white">{countFormatter(summary.customers)}</div>
            <p className="mt-2 text-xs text-white/58">Launch-facing customer accounts</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.04] text-white shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-white/72">
              <Building2 className="h-4 w-4 text-[var(--reliance-emerald)]" />
              Vendors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-white">{countFormatter(summary.vendors)}</div>
            <p className="mt-2 text-xs text-white/58">Launch-facing vendor businesses</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.04] text-white shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-white/72">
              <AlertTriangle className="h-4 w-4 text-[var(--reliance-amber)]" />
              Suspended / Restricted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-white">{countFormatter(summary.restricted)}</div>
            <p className="mt-2 text-xs text-white/58">Accounts needing follow-up or blocked visibility</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.04] text-white shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-white/72">
              <MailCheck className="h-4 w-4 text-[var(--reliance-cyan)]" />
              Pending Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-white">{countFormatter(summary.pendingVerification)}</div>
            <p className="mt-2 text-xs text-white/58">Customers still waiting to verify email</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.04] text-white shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-white/72">
              <ShieldCheck className="h-4 w-4 text-[var(--reliance-blue-soft)]" />
              Vendor Approval Holds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-white">{countFormatter(summary.pendingVendorApproval)}</div>
            <p className="mt-2 text-xs text-white/58">Registered vendors waiting on manual approval</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account management shortcuts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/admin/vendors/approval-queue">Vendor Approval Queue</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/publish-management">Publish Management</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/audit-logs">Audit Logs</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/reported-content">Reported Content</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/dashboard">Admin Dashboard</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#204080]" />
              Unified account console
            </CardTitle>
            <p className="text-sm text-gray-600">
              Launch-facing accounts stay visible by default so the roster matches the real platform story.
              Turn on internal/test records only when you need audit identities, owner accounts, or demo shells.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="h-auto flex-wrap gap-2 rounded-2xl bg-slate-100 p-2">
              {TAB_ORDER.map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="rounded-xl px-4 py-2.5 text-sm data-[state=active]:bg-white"
                >
                  <span className="font-medium">{TAB_CONFIG[tab].label}</span>
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 data-[state=active]:bg-slate-100">
                    {countFormatter(summary[tab === 'customers' ? 'customers' : tab === 'vendors' ? 'vendors' : 'restricted'])}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-medium text-slate-900">{currentTabConfig.label}</p>
            <p className="mt-1">{currentTabConfig.helper}</p>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900">{currentTabConfig.loadLabel}</h2>
              <p className="mt-1 text-sm text-gray-600">{currentTabConfig.loadDescription}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_180px_auto]">
              <div className="space-y-1">
                <Label htmlFor="browse-status">Account state</Label>
                <select
                  id="browse-status"
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  value={statusFilter}
                  onChange={(event) => handleStatusChange(event.target.value)}
                >
                  {STATUS_OPTIONS[activeTab].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="browse-sort">Sort order</Label>
                <select
                  id="browse-sort"
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  value={sortOrder}
                  onChange={(event) =>
                    handleSortChange(isSortOption(event.target.value) ? event.target.value : 'alpha_asc')
                  }
                >
                  <option value="alpha_asc">Alphabetical A-Z</option>
                  <option value="alpha_desc">Alphabetical Z-A</option>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadBrowseAccounts()}
                  disabled={loading}
                >
                  {loading && resultsSource === 'browse' ? 'Loading list...' : currentTabConfig.loadLabel}
                </Button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showInternalRecords}
                onChange={(event) => handleInternalToggle(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Show internal/test records
            </label>
            <p className="text-xs text-gray-500">
              This reveals owner/admin identities, demo shells, and audit records that are hidden from launch-facing counts by default.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <Label htmlFor="account-query">Search this tab</Label>
              <Input
                id="account-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void searchAccounts();
                }}
                placeholder={currentTabConfig.searchPlaceholder}
              />
            </div>
            <div className="flex items-end gap-3">
              <Button
                type="button"
                onClick={() => {
                  void searchAccounts();
                }}
                disabled={loading || query.trim().length < 2}
              >
                <Search className="mr-2 h-4 w-4" />
                {loading && resultsSource === 'search' ? 'Searching...' : 'Search'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQuery('');
                  void loadBrowseAccounts();
                }}
              >
                Clear search
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {message}
            </div>
          )}

          {!selected ? (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Select an account to review status details, apply suspend or reactivation actions, and inspect remembered MFA devices.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
            <div className="space-y-3">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {formatResultsContextLabel(activeTab, resultsSource, statusFilter, sortOrder, query)} · {results.length} shown
              </div>
              {loading && results.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  {resultsSource === 'browse'
                    ? 'Loading account list, contact details, and status information...'
                    : 'Searching matching accounts...'}
                </div>
              ) : results.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  {error
                    ? 'The account roster could not be loaded. Review the error above and try again.'
                    : resultsSource === 'search' && query.trim().length >= 2
                      ? 'No matching accounts found. Try a different name, email, phone, location, or ID.'
                      : currentTabConfig.emptyBrowse}
                </div>
              ) : (
                results.map((account) => {
                  const joinedAt = formatDateTime(account.createdAt);
                  const statusUpdatedAt = formatDateTime(account.accountStatusUpdatedAt);
                  return (
                    <button
                      key={`${account.targetType}-${account.id}`}
                      type="button"
                      className={`w-full rounded-lg border p-4 text-left transition-colors ${
                        selected?.id === account.id && selected?.targetType === account.targetType
                          ? 'border-[#204080] bg-[#f5f8fc]'
                          : 'border-gray-200 bg-white hover:border-[#204080]'
                      }`}
                      onClick={() => setSelected(account)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900">{account.displayName}</span>
                        <Badge variant="outline">
                          {account.targetType === 'vendor' ? 'vendor' : 'customer'}
                        </Badge>
                        <Badge className={statusClass(account.accountStatus)}>
                          {formatLabel(account.accountStatus)}
                        </Badge>
                        {account.targetType === 'vendor' ? (
                          <Badge variant="outline">
                            {account.isPubliclyListed ? 'publicly listed' : 'not publicly listed'}
                          </Badge>
                        ) : (
                          <Badge variant={account.emailVerifiedAt ? 'success' : 'secondary'}>
                            {account.emailVerifiedAt ? 'email verified' : 'verification pending'}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2 space-y-1 text-sm text-gray-700">
                        {account.targetType === 'vendor' ? (
                          <>
                            {account.ownerName && account.ownerName !== account.displayName ? (
                              <div>Owner: {account.ownerName}</div>
                            ) : null}
                            {formatLocation(account) ? <div>Location: {formatLocation(account)}</div> : null}
                            {formatServiceAreas(account.serviceAreas) ? (
                              <div>Service areas: {formatServiceAreas(account.serviceAreas)}</div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            {account.email ? <div>Email: {account.email}</div> : null}
                            {account.phone ? <div>Phone: {account.phone}</div> : null}
                            {formatLocation(account) ? <div>Location: {formatLocation(account)}</div> : null}
                          </>
                        )}
                        {account.accountStatusReason ? (
                          <div>Reason: {formatLabel(account.accountStatusReason)}</div>
                        ) : null}
                        {statusUpdatedAt ? <div>Status updated: {statusUpdatedAt}</div> : null}
                        {joinedAt ? <div>Joined: {joinedAt}</div> : null}
                      </div>

                      <div className="mt-2 text-xs text-gray-500">
                        ID: <span className="font-mono">{account.id}</span>
                        {account.email ? ` | ${account.email}` : ''}
                        {account.phone ? ` | ${account.phone}` : ''}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h2 className="font-semibold text-gray-900">Apply account action</h2>
              {selected ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{selected.displayName}</div>
                    <div className="mt-1 text-xs text-gray-500">{selected.id}</div>
                    <Badge className={`mt-2 ${statusClass(selected.accountStatus)}`}>
                      Current: {formatLabel(selected.accountStatus)}
                    </Badge>
                    {selected.targetType === 'vendor' && (
                      <div className="mt-2 text-xs text-gray-500">
                        {selected.isPubliclyListed
                          ? 'This vendor is currently public unless moderation or publish rules say otherwise.'
                          : 'This vendor is not currently public to customers.'}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="reason">Reason category</Label>
                    <select
                      id="reason"
                      className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                      value={reasonCategory}
                      onChange={(event) => setReasonCategory(event.target.value)}
                    >
                      {reasonOptions.map((reason) => (
                        <option key={reason} value={reason}>
                          {formatLabel(reason)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="notes">Admin notes</Label>
                    <Textarea
                      id="notes"
                      value={adminNotes}
                      onChange={(event) => setAdminNotes(event.target.value)}
                      placeholder="Required. Briefly explain the status change."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {accountActions.map((item) => (
                      <Button
                        key={item.action}
                        type="button"
                        variant={item.action === 'ban' ? 'destructive' : 'outline'}
                        disabled={!adminNotes.trim() || Boolean(savingAction)}
                        onClick={() => openActionConfirmation(item.action)}
                      >
                        {savingAction === item.action ? 'Saving...' : item.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    Suspend, ban, deactivate, and reactivate still flow through the existing admin action API.
                    Vendor restrictions continue to hide public listings and unpublished services through backend rules.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">
                  Select an account to suspend, ban, deactivate, or reactivate it.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {selected?.targetType === 'vendor' && (
        <AdminTrustScorePanel vendorId={selected.id} vendorName={selected.displayName} />
      )}

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Trusted MFA Devices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Review remembered MFA devices for the selected {selected.targetType === 'vendor' ? 'vendor owner account' : 'customer account'}. Revoke a device to force MFA on the next sign-in.
            </p>
            {trustedDevicesError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {trustedDevicesError}
              </div>
            )}
            {trustedDevicesLoading ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                Loading MFA devices...
              </div>
            ) : trustedDevices.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                No active remembered devices for this {selected.targetType === 'vendor' ? 'vendor owner' : 'customer'}.
              </div>
            ) : (
              <div className="space-y-3">
                {trustedDevices.map((device) => (
                  <div key={device.id} className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {device.userName}
                          {device.role ? (
                            <span className="ml-2 text-sm font-normal text-gray-500">
                              {formatRoleLabel(device.role)} account
                            </span>
                          ) : null}
                        </div>
                        <div className="text-sm text-gray-600">{device.email}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {device.label || 'Remembered device'}
                          {device.lastUsedAt ? ` | Last used ${new Date(device.lastUsedAt).toLocaleString()}` : ''}
                          {device.expiresAt ? ` | Expires ${new Date(device.expiresAt).toLocaleString()}` : ''}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={revokingDeviceId === device.id}
                        onClick={() => revokeTrustedDevice(device.id)}
                      >
                        {revokingDeviceId === device.id ? 'Revoking...' : 'Revoke'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && closeActionConfirmation()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingActionLabel}</DialogTitle>
            <DialogDescription>{pendingActionDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeActionConfirmation}>
              Cancel
            </Button>
            <Button
              variant={pendingAction === 'ban' ? 'destructive' : 'default'}
              onClick={confirmPendingAction}
              disabled={Boolean(savingAction)}
            >
              {pendingAction === 'ban' ? 'Confirm Ban' : `Confirm ${pendingActionLabel}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
