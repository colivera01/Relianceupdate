'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
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
import { getAdminRequestHeaders } from '@/lib/admin-client';
import { AdminTrustScorePanel } from '@/components/admin/AdminTrustScorePanel';
import { PRODUCTION_LIKE_VENDOR_IDS, SPARKLE_CLEAN_VENDOR_ID } from '@/lib/internal-identities';

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
  isPubliclyListed: boolean | null;
  createdAt: string | null;
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

const accountActions = [
  { action: 'suspend', label: 'Suspend' },
  { action: 'ban', label: 'Ban' },
  { action: 'deactivate', label: 'Deactivate' },
  { action: 'reactivate', label: 'Reactivate' },
];

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
];

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function formatRoleLabel(value: string | null): string {
  if (!value) return '';
  const normalized = formatLabel(value).trim();
  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function statusClass(status: string): string {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'suspended') return 'bg-orange-100 text-orange-800';
  if (status === 'banned') return 'bg-red-100 text-red-800';
  if (status === 'deactivated' || status === 'archived_inactive') {
    return 'bg-gray-100 text-gray-700';
  }
  return 'bg-blue-100 text-blue-800';
}

function formatLocation(account: AccountResult): string | null {
  const cityState = [account.city, account.state].map((value) => String(value || '').trim()).filter(Boolean).join(', ');
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

function formatResultsContextLabel(source: 'browse' | 'search', browseStatus: string, browseSort: string, query: string): string {
  if (source === 'search') {
    return query.trim() ? `Search results for "${query.trim()}"` : 'Search results';
  }
  const browseStatusLabel =
    browseStatus === 'active'
      ? 'Active vendors'
      : browseStatus === 'inactive'
        ? 'Inactive vendors'
        : browseStatus === 'all'
          ? 'All vendors'
          : `${formatLabel(browseStatus)} vendors`;
  const sortLabel =
    browseSort === 'alpha_desc'
      ? 'Z-A'
      : browseSort === 'newest'
        ? 'newest first'
        : browseSort === 'oldest'
          ? 'oldest first'
          : 'A-Z';
  return `${browseStatusLabel} sorted ${sortLabel}`;
}

function isInternalTestVendorResult(account: AccountResult): boolean {
  if (account.targetType !== 'vendor') return false;
  if (account.id === SPARKLE_CLEAN_VENDOR_ID) return true;
  if (PRODUCTION_LIKE_VENDOR_IDS.includes(account.id as (typeof PRODUCTION_LIKE_VENDOR_IDS)[number])) {
    return false;
  }

  const fingerprint = [
    account.displayName,
    account.ownerName,
    account.businessName,
    account.email,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');

  if (!fingerprint) return false;
  if (fingerprint.includes('@example.com')) return true;
  return /(^|\s)(fallback|template|test barber|sparkle clean pro)(\s|$)/i.test(fingerprint);
}

export default function VendorsPage() {
  const [query, setQuery] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'user' | 'vendor'>('all');
  const [resultsSource, setResultsSource] = useState<'browse' | 'search'>('browse');
  const [browseStatusFilter, setBrowseStatusFilter] = useState<'active' | 'inactive' | 'all' | 'suspended' | 'banned' | 'deactivated'>('active');
  const [browseSort, setBrowseSort] = useState<'alpha_asc' | 'alpha_desc' | 'newest' | 'oldest'>('alpha_asc');
  const [showInternalRecords, setShowInternalRecords] = useState(false);
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

  const syncResultsAndSelection = (nextResults: AccountResult[]) => {
    setResults(nextResults);
    setSelected((current) =>
      current && nextResults.some((item) => item.id === current.id && item.targetType === current.targetType) ? current : null
    );
  };
  const visibleResults = showInternalRecords ? results : results.filter((account) => !isInternalTestVendorResult(account));

  useEffect(() => {
    if (!selected) return;
    if (showInternalRecords) return;
    if (visibleResults.some((account) => account.id === selected.id && account.targetType === selected.targetType)) {
      return;
    }
    setSelected(null);
  }, [selected, showInternalRecords, visibleResults]);

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

  const loadBrowseVendors = async (status = browseStatusFilter, sort = browseSort) => {
    setLoading(true);
    setError('');
    setMessage('');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      const params = new URLSearchParams({
        mode: 'browse',
        targetType: 'vendor',
        accountStatus: status,
        sort,
        limit: '25',
      });
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
          ? 'Vendor browse timed out. Reliance could not finish loading the vendor list. Please try again.'
          : err instanceof Error
            ? err.message
            : 'Failed to load vendor list'
      );
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBrowseVendors('active', 'alpha_asc');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchAccounts = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      const params = new URLSearchParams({
        q: query,
        targetType,
        limit: '10',
      });
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
        accountStatusReason: reasonCategory,
        isPubliclyListed:
          typeof json?.account?.isPubliclyListed === 'boolean'
            ? json.account.isPubliclyListed
            : selected.isPubliclyListed,
      };
      setSelected(updated);
      setResults((current) => current.map((item) => (item.id === updated.id ? updated : item)));
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

  const pendingActionLabel = accountActions.find((item) => item.action === pendingAction)?.label || 'Apply action';
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

  return (
    <div className="w-full max-w-5xl p-4 space-y-6">
      <header className="reliance-operator-hero rounded-[32px] px-6 py-7">
        <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
          Vendor governance
        </div>
        <h1 className="mt-5 font-display text-4xl font-semibold text-white sm:text-5xl">
          Vendor Management
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 sm:text-base">
          Stable entry point for vendor governance, trust score visibility, account controls,
          and launch-ready safety actions inside the same premium product language as the homepage.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Available Management Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/admin/publish-management">Publish Management</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/promoted-listings">Promoted Listings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/vendors/approval-queue">Approval Queue</Link>
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#204080]" />
            Account Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-gray-600">
            Search a user or vendor by name, business name, email, phone, or ID, then apply the account
            status actions backed by the admin account-actions API.
          </p>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900">Browse vendors</h2>
              <p className="mt-1 text-sm text-gray-600">
                Load a real vendor list even when you do not remember the exact business name. Use activity state,
                alphabetical sorting, and location details to distinguish similar vendors quickly.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_180px_auto]">
              <div className="space-y-1">
                <Label htmlFor="browse-status">Vendor list</Label>
                <select
                  id="browse-status"
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  value={browseStatusFilter}
                  onChange={(event) =>
                    setBrowseStatusFilter(
                      event.target.value as 'active' | 'inactive' | 'all' | 'suspended' | 'banned' | 'deactivated'
                    )
                  }
                >
                  <option value="active">Active vendors</option>
                  <option value="inactive">Inactive vendors</option>
                  <option value="all">All vendors</option>
                  <option value="suspended">Suspended vendors</option>
                  <option value="banned">Banned vendors</option>
                  <option value="deactivated">Deactivated vendors</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="browse-sort">Sort order</Label>
                <select
                  id="browse-sort"
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  value={browseSort}
                  onChange={(event) => setBrowseSort(event.target.value as 'alpha_asc' | 'alpha_desc' | 'newest' | 'oldest')}
                >
                  <option value="alpha_asc">Alphabetical A-Z</option>
                  <option value="alpha_desc">Alphabetical Z-A</option>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={() => void loadBrowseVendors()} disabled={loading}>
                  {loading && resultsSource === 'browse' ? 'Loading list...' : 'Load Vendors'}
                </Button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showInternalRecords}
                onChange={(event) => setShowInternalRecords(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Show internal/test records
            </label>
            <p className="text-xs text-gray-500">
              Internal demo shells, template vendors, and audit-only records stay hidden by default so the live vendor list is easier to scan.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr_auto]">
            <div className="space-y-1">
              <Label htmlFor="account-type">Account type</Label>
              <select
                id="account-type"
                className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                value={targetType}
                onChange={(event) => setTargetType(event.target.value as 'all' | 'user' | 'vendor')}
              >
                <option value="all">Users and vendors</option>
                <option value="vendor">Vendors</option>
                <option value="user">Users</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="account-query">Lookup</Label>
              <Input
                id="account-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void searchAccounts();
                }}
                placeholder="Search by name, email, phone, or ID"
              />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={searchAccounts} disabled={loading || query.trim().length < 2}>
                <Search className="mr-2 h-4 w-4" />
                {loading ? 'Searching...' : 'Search'}
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
              Browse or search for a vendor, then select the result card to reveal the live Trust Score explanation panel and remembered MFA device controls below.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
            <div className="space-y-3">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {formatResultsContextLabel(resultsSource, browseStatusFilter, browseSort, query)}
                {showInternalRecords ? ` · ${visibleResults.length} total shown` : ` · ${visibleResults.length} shown of ${results.length} total`}
              </div>
              {loading && visibleResults.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  {resultsSource === 'browse'
                    ? 'Loading vendor list, location details, and activity states...'
                    : 'Searching accounts and live vendor records...'}
                </div>
              ) : visibleResults.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  {error
                    ? 'Vendor lookup could not be completed. Review the error above and try again.'
                    : !showInternalRecords && results.length > 0
                      ? 'Only internal or test records matched the current filters. Turn on "Show internal/test records" if you need them.'
                    : resultsSource === 'search' && query.trim().length >= 2
                      ? 'No matching accounts found. Try a different name, email, phone, or ID.'
                      : resultsSource === 'browse'
                        ? 'No vendors matched the current browse filters. Try a different activity state or sort order.'
                        : 'No vendors loaded yet. Use the browse controls or search above to review account status and apply controls.'}
                </div>
              ) : (
                visibleResults.map((account) => (
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
                      <Badge variant="outline">{account.targetType}</Badge>
                      <Badge className={statusClass(account.accountStatus)}>
                        {formatLabel(account.accountStatus)}
                      </Badge>
                      {account.targetType === 'vendor' && (
                        <Badge variant="outline">
                          {account.isPubliclyListed ? 'publicly listed' : 'not publicly listed'}
                        </Badge>
                      )}
                    </div>
                    {account.targetType === 'vendor' ? (
                      <div className="mt-2 space-y-1 text-sm text-gray-700">
                        {account.ownerName && account.ownerName !== account.displayName ? (
                          <div>Owner: {account.ownerName}</div>
                        ) : null}
                        {formatLocation(account) ? <div>Location: {formatLocation(account)}</div> : null}
                        {formatServiceAreas(account.serviceAreas) ? (
                          <div>Service areas: {formatServiceAreas(account.serviceAreas)}</div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-2 text-xs text-gray-500">
                      ID: <span className="font-mono">{account.id}</span>
                      {account.email ? ` | ${account.email}` : ''}
                      {account.phone ? ` | ${account.phone}` : ''}
                    </div>
                  </button>
                ))
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
                    Vendor suspend, ban, deactivate, and archive-style restricted states remove the public listing
                    and unpublish services through the backend action route.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">
                  Select a search result to see current account status and apply suspend, ban, deactivate, or
                  reactivate.
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
              Review remembered MFA devices for the selected {selected.targetType}. Revoke a device to force MFA on the next sign-in.
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
                No active remembered devices for this {selected.targetType}.
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
