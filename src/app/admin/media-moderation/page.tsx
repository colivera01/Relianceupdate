'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Video, ShieldAlert } from 'lucide-react';

type QueueAsset = {
  assetId: string;
  title: string;
  vendorId: string;
  vendorName: string | null;
  mediaSessionId: string | null;
  bookingId: string | null;
  jobTitle: string | null;
  clientName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  uploadedByMembershipId: string | null;
  employeeName: string | null;
  moderationStatus: string;
  visibilityStatus: string;
  archiveStatus: string;
  moderationReason: string | null;
  moderatedAt: string | null;
  createdAt: string;
  mimeType: string;
  bytes: string;
  previewRef: string | null;
  downloadRef: string | null;
};

type ModerationAction =
  | 'approve_public'
  | 'approve_customer_only'
  | 'approve_vendor_archive_only'
  | 'approve_private'
  | 'set_visibility_public'
  | 'set_visibility_customer_only'
  | 'set_visibility_vendor_archive_only'
  | 'set_visibility_private'
  | 'reject'
  | 'flag';

/** Visibility tier when approving or updating an already-approved asset (maps to API enums). */
type VisibilityLevel = 'public' | 'customer_only' | 'vendor_archive_only' | 'private';

const APPROVE_BY_VISIBILITY: Record<VisibilityLevel, ModerationAction> = {
  public: 'approve_public',
  customer_only: 'approve_customer_only',
  vendor_archive_only: 'approve_vendor_archive_only',
  private: 'approve_private',
};

const SET_VISIBILITY_BY_LEVEL: Record<VisibilityLevel, ModerationAction> = {
  public: 'set_visibility_public',
  customer_only: 'set_visibility_customer_only',
  vendor_archive_only: 'set_visibility_vendor_archive_only',
  private: 'set_visibility_private',
};

const VISIBILITY_OPTIONS: { value: VisibilityLevel; label: string; shortHint: string }[] = [
  {
    value: 'public',
    label: 'Public',
    shortHint: 'Public + customer + vendor (discovery & booking-safe media APIs)',
  },
  {
    value: 'customer_only',
    label: 'Customer only',
    shortHint: 'Customer + vendor only — not on public discovery',
  },
  {
    value: 'vendor_archive_only',
    label: 'Vendor archive only',
    shortHint: 'Vendor only (archive)',
  },
  {
    value: 'private',
    label: 'Private / internal',
    shortHint: 'Internal only — not public or customer-facing',
  },
];

function visibilityLevelFromAsset(status: string): VisibilityLevel {
  const n = String(status || '').trim().toLowerCase();
  if (n === 'public') return 'public';
  if (n === 'customer_only') return 'customer_only';
  if (n === 'vendor_archive_only') return 'vendor_archive_only';
  return 'private';
}

/** Approve/re-approve uses approve_*; already-approved assets use set_visibility_* to change tier only. */
function actionForApproveOrUpdateVisibility(asset: QueueAsset, level: VisibilityLevel): ModerationAction {
  if (asset.moderationStatus === 'approved') {
    return SET_VISIBILITY_BY_LEVEL[level];
  }
  return APPROVE_BY_VISIBILITY[level];
}

function bytesToReadable(bytesText: string): string {
  const value = Number(bytesText || '0');
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function AssetModerationControls({
  asset,
  actionBusy,
  applyModerationAction,
  openRejectModal,
}: {
  asset: QueueAsset;
  actionBusy: boolean;
  applyModerationAction: (asset: QueueAsset, action: ModerationAction, moderationReason?: string) => Promise<void>;
  openRejectModal: (asset: QueueAsset) => void;
}) {
  const [visibility, setVisibility] = useState<VisibilityLevel>(() => visibilityLevelFromAsset(asset.visibilityStatus));

  useEffect(() => {
    setVisibility(visibilityLevelFromAsset(asset.visibilityStatus));
  }, [asset.assetId, asset.visibilityStatus]);

  const selectedHint = VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.shortHint ?? '';
  const primaryLabel = asset.moderationStatus === 'approved' ? 'Update visibility' : 'Approve';

  return (
    <div className="flex flex-col gap-2">
      <div className="space-y-1">
        <Label htmlFor={`visibility-${asset.assetId}`} className="text-xs text-gray-600">
          Visibility level
        </Label>
        <select
          id={`visibility-${asset.assetId}`}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as VisibilityLevel)}
          disabled={actionBusy}
          className="h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          {VISIBILITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-gray-500 leading-snug">{selectedHint}</p>
      </div>
      <Button
        size="sm"
        disabled={actionBusy}
        onClick={() => applyModerationAction(asset, actionForApproveOrUpdateVisibility(asset, visibility))}
      >
        {primaryLabel}
      </Button>
      <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => openRejectModal(asset)}>
        Reject
      </Button>
      <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => applyModerationAction(asset, 'flag')}>
        <ShieldAlert className="w-4 h-4 mr-1" />
        Flag
      </Button>
    </div>
  );
}

export default function AdminMediaModerationPage() {
  const [assets, setAssets] = useState<QueueAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<QueueAsset | null>(null);
  const [assetActionLoadingId, setAssetActionLoadingId] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<QueueAsset | null>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [uploaderFilter, setUploaderFilter] = useState('all');
  const [search, setSearch] = useState('');

  const adminHeaders = () => {
    const user = (() => {
      try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();
    const userId = user?.id || 'D43B6BB3-1A72-45EC-A362-A6E1E0580EA0';
    return {
      'Content-Type': 'application/json',
      'x-user-id': String(userId),
      'x-user-role': 'admin',
      'x-admin': 'true',
    };
  };

  const fetchQueue = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('moderationStatus', statusFilter);
      if (dateFilter) params.set('date', dateFilter);
      if (vendorFilter !== 'all') params.set('vendorId', vendorFilter);
      if (uploaderFilter !== 'all') params.set('uploadedByMembershipId', uploaderFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/admin/media/moderation-queue?${params.toString()}`, {
        method: 'GET',
        headers: adminHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || `Status ${res.status}`);
      setAssets(Array.isArray(json.assets) ? json.assets : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load moderation queue');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyModerationAction = async (
    asset: QueueAsset,
    action: ModerationAction,
    moderationReason?: string
  ) => {
    setAssetActionLoadingId(`${asset.assetId}:${action}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/media/${asset.assetId}/moderate`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: JSON.stringify({
          action,
          moderationReason: moderationReason || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || `Status ${res.status}`);

      const updated = json.asset as Partial<QueueAsset> | undefined;
      if (updated) {
        setAssets((prev) =>
          prev.map((row) =>
            row.assetId === asset.assetId
              ? {
                  ...row,
                  moderationStatus: String(updated.moderationStatus || row.moderationStatus),
                  visibilityStatus: String(updated.visibilityStatus || row.visibilityStatus),
                  archiveStatus: String(updated.archiveStatus || row.archiveStatus),
                  moderationReason:
                    updated.moderationReason !== undefined ? (updated.moderationReason as string | null) : row.moderationReason,
                  moderatedAt: (updated.moderatedAt as string | null) ?? row.moderatedAt,
                }
              : row
          )
        );
        setSelectedAsset((prev) =>
          prev && prev.assetId === asset.assetId
            ? {
                ...prev,
                moderationStatus: String(updated.moderationStatus || prev.moderationStatus),
                visibilityStatus: String(updated.visibilityStatus || prev.visibilityStatus),
                archiveStatus: String(updated.archiveStatus || prev.archiveStatus),
                moderationReason:
                  updated.moderationReason !== undefined ? (updated.moderationReason as string | null) : prev.moderationReason,
                moderatedAt: (updated.moderatedAt as string | null) ?? prev.moderatedAt,
              }
            : prev
        );
      }

      setFeedback({
        type: 'success',
        message: json?.message || 'Moderation action applied successfully',
      });
    } catch (e) {
      setFeedback({
        type: 'error',
        message: e instanceof Error ? e.message : 'Failed to apply moderation action',
      });
    } finally {
      setAssetActionLoadingId(null);
    }
  };

  const vendors = useMemo(
    () => Array.from(new Set(assets.map((a) => `${a.vendorId}::${a.vendorName || a.vendorId}`))),
    [assets]
  );
  const uploaders = useMemo(
    () => Array.from(new Set(assets.map((a) => a.uploadedByMembershipId || 'unassigned'))),
    [assets]
  );

  const openRejectModal = (asset: QueueAsset) => {
    setRejectTarget(asset);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const submitReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    await applyModerationAction(rejectTarget, 'reject', rejectReason.trim());
    setRejectModalOpen(false);
    setRejectTarget(null);
    setRejectReason('');
  };

  const queueEmpty = !loading && !error && assets.length === 0;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Media Moderation</h1>
          <p className="text-gray-600 mt-1">
            Approve or reject each asset, and set a single visibility level. Reject hides the asset from customers and public listings.
          </p>
        </div>
        <Button variant="outline" onClick={fetchQueue} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded border text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input
            placeholder="Search by title, job, or client"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All moderation statuses</option>
            <option value="pending_review">pending_review</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="flagged">flagged</option>
          </select>
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All vendors</option>
            {vendors.map((v) => {
              const [id, name] = v.split('::');
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              );
            })}
          </select>
          <select
            value={uploaderFilter}
            onChange={(e) => setUploaderFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All uploaders</option>
            {uploaders.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </CardContent>
        <CardContent className="pt-0">
          <Button size="sm" onClick={fetchQueue} disabled={loading}>
            Apply Filters
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">Loading moderation queue...</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-red-600">{error}</CardContent>
        </Card>
      ) : queueEmpty ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">No media items matched the current filters.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assets.map((asset) => {
            const actionBusy = Boolean(assetActionLoadingId?.startsWith(`${asset.assetId}:`));
            return (
              <Card key={asset.assetId}>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    <div className="lg:col-span-2">
                      <div className="h-24 rounded border bg-gray-50 flex items-center justify-center overflow-hidden">
                        {asset.previewRef && asset.mimeType.startsWith('image/') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={asset.previewRef} alt={asset.title} className="h-full w-full object-cover" />
                        ) : (
                          <Video className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                    </div>
                    <div className="lg:col-span-6 space-y-1 text-sm">
                      <div className="font-semibold text-base">{asset.title}</div>
                      <div>Vendor: {asset.vendorName || asset.vendorId}</div>
                      <div>Uploader: {asset.employeeName || asset.uploadedByMembershipId || 'Unknown'}</div>
                      <div>Job: {asset.jobTitle || '-'}</div>
                      <div>Client: {asset.clientName || '-'}</div>
                      <div>Service: {asset.serviceName || '-'}</div>
                      <div>
                        Uploaded: {new Date(asset.createdAt).toLocaleString()} • {asset.mimeType} • {bytesToReadable(asset.bytes)}
                      </div>
                    </div>
                    <div className="lg:col-span-2 space-y-2">
                      <Badge className="block w-fit">Moderation: {asset.moderationStatus}</Badge>
                      <Badge variant="outline" className="block w-fit">
                        Visibility:{' '}
                        {VISIBILITY_OPTIONS.find((o) => o.value === visibilityLevelFromAsset(asset.visibilityStatus))?.label ||
                          asset.visibilityStatus}
                      </Badge>
                      <Badge variant="outline" className="block w-fit">
                        Archive: {asset.archiveStatus}
                      </Badge>
                    </div>
                    <div className="lg:col-span-2 flex flex-col gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedAsset(asset)}>
                        Details
                      </Button>
                      <AssetModerationControls
                        asset={asset}
                        actionBusy={actionBusy}
                        applyModerationAction={applyModerationAction}
                        openRejectModal={openRejectModal}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(selectedAsset)} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedAsset?.title || 'Media Asset'}</DialogTitle>
            <DialogDescription>Moderation details and linked context.</DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-3 text-sm">
              {selectedAsset.previewRef && selectedAsset.mimeType.startsWith('video/') && (
                <video className="w-full rounded border bg-black" controls src={selectedAsset.previewRef}>
                  Your browser does not support video playback.
                </video>
              )}
              {selectedAsset.previewRef && selectedAsset.mimeType.startsWith('image/') && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedAsset.previewRef} alt={selectedAsset.title} className="w-full rounded border object-cover max-h-96" />
              )}
              {selectedAsset.downloadRef && (
                <a className="text-blue-600 underline" href={selectedAsset.downloadRef} target="_blank" rel="noreferrer">
                  Open download-safe link
                </a>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>Asset ID: {selectedAsset.assetId}</div>
                <div>Session ID: {selectedAsset.mediaSessionId || '-'}</div>
                <div>Vendor: {selectedAsset.vendorName || selectedAsset.vendorId}</div>
                <div>Uploader: {selectedAsset.employeeName || selectedAsset.uploadedByMembershipId || '-'}</div>
                <div>Job: {selectedAsset.jobTitle || '-'}</div>
                <div>Client: {selectedAsset.clientName || '-'}</div>
                <div>Service: {selectedAsset.serviceName || '-'}</div>
                <div>Created: {new Date(selectedAsset.createdAt).toLocaleString()}</div>
                <div>Moderation: {selectedAsset.moderationStatus}</div>
                <div>Visibility: {selectedAsset.visibilityStatus}</div>
                <div>Archive: {selectedAsset.archiveStatus}</div>
                <div>Size: {bytesToReadable(selectedAsset.bytes)}</div>
              </div>
              <div className="rounded border p-3 space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Approve / visibility / reject / flag</div>
                <p className="text-[11px] text-gray-500">
                  Choose one visibility, then <strong>Approve</strong> (or <strong>Update visibility</strong> if already approved).{' '}
                  <strong>Public</strong> includes everyone: discovery, customers with bookings, and vendor tools.
                </p>
                <AssetModerationControls
                  asset={selectedAsset}
                  actionBusy={Boolean(assetActionLoadingId?.startsWith(`${selectedAsset.assetId}:`))}
                  applyModerationAction={applyModerationAction}
                  openRejectModal={openRejectModal}
                />
              </div>
              {selectedAsset.moderationReason && (
                <div className="p-2 rounded bg-amber-50 border border-amber-200">
                  Moderation reason: {selectedAsset.moderationReason}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAsset(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Media</DialogTitle>
            <DialogDescription>Provide moderation reason to reject this asset.</DialogDescription>
          </DialogHeader>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason..."
            className="w-full min-h-[120px] rounded border border-input px-3 py-2 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReject} disabled={!rejectReason.trim() || Boolean(assetActionLoadingId)}>
              Submit Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
