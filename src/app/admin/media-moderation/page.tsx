'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Video, ShieldAlert } from 'lucide-react';

type StageKey = 'INTRO' | 'IN_PROGRESS' | 'COMPLETED';

const STAGE_ORDER: StageKey[] = ['INTRO', 'IN_PROGRESS', 'COMPLETED'];
const STAGE_LABELS: Record<StageKey, string> = {
  INTRO: 'Intro',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

type QueueVideo = {
  assetId: string;
  title: string;
  vendorId: string;
  vendorName: string | null;
  mediaSessionId: string | null;
  bookingId: string | null;
  jobTitle: string | null;
  /** Booking row status (e.g. PENDING, CONFIRMED, COMPLETED). */
  bookingStatus: string | null;
  clientName: string | null;
  vendorJobVideoStageKey: string;
  vendorJobVideoStageLabel: string;
  isPrimaryProofStageVideo: boolean;
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

type QueuePackage = {
  packageId: string;
  bookingId: string;
  jobTitle: string;
  bookingStatus: string | null;
  vendorId: string;
  vendorName: string | null;
  clientName: string | null;
  serviceName: string | null;
  createdAt: string;
  uploadedByMembershipIds: string[];
  moderationStatuses: string[];
  visibilityStatuses: string[];
  packageReadiness: string;
  videosByStage: Record<StageKey, QueueVideo | null>;
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

type PackageModerationAction = 'approve' | 'reject' | 'flag';

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
function actionForApproveOrUpdateVisibility(asset: QueueVideo, level: VisibilityLevel): ModerationAction {
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

function formatJobBookingStatus(status: string | null | undefined): string {
  if (!status) return '—';
  return String(status)
    .trim()
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function normalizeQueueVideo(row: Record<string, unknown>): QueueVideo {
  const stageKey = String(row.vendorJobVideoStageKey ?? 'LEGACY_OTHER');
  const stageLabel = String(row.vendorJobVideoStageLabel ?? 'Legacy / unspecified');
  const primary = Boolean(row.isPrimaryProofStageVideo);
  return {
    assetId: String(row.assetId ?? ''),
    title: String(row.title ?? ''),
    vendorId: String(row.vendorId ?? ''),
    vendorName: row.vendorName != null ? String(row.vendorName) : null,
    mediaSessionId: row.mediaSessionId != null ? String(row.mediaSessionId) : null,
    bookingId: row.bookingId != null ? String(row.bookingId) : null,
    jobTitle: row.jobTitle != null ? String(row.jobTitle) : null,
    bookingStatus: row.bookingStatus != null ? String(row.bookingStatus) : null,
    clientName: row.clientName != null ? String(row.clientName) : null,
    vendorJobVideoStageKey: stageKey,
    vendorJobVideoStageLabel: stageLabel,
    isPrimaryProofStageVideo: primary,
    serviceId: row.serviceId != null ? String(row.serviceId) : null,
    serviceName: row.serviceName != null ? String(row.serviceName) : null,
    uploadedByMembershipId: row.uploadedByMembershipId != null ? String(row.uploadedByMembershipId) : null,
    employeeName: row.employeeName != null ? String(row.employeeName) : null,
    moderationStatus: String(row.moderationStatus ?? ''),
    visibilityStatus: String(row.visibilityStatus ?? ''),
    archiveStatus: String(row.archiveStatus ?? ''),
    moderationReason: row.moderationReason != null ? String(row.moderationReason) : null,
    moderatedAt: row.moderatedAt != null ? String(row.moderatedAt) : null,
    createdAt: String(row.createdAt ?? ''),
    mimeType: String(row.mimeType ?? ''),
    bytes: String(row.bytes ?? '0'),
    previewRef: row.previewRef != null ? String(row.previewRef) : null,
    downloadRef: row.downloadRef != null ? String(row.downloadRef) : null,
  };
}

function normalizeQueuePackage(row: Record<string, unknown>): QueuePackage {
  const rawVideosByStage =
    row.videosByStage && typeof row.videosByStage === 'object'
      ? (row.videosByStage as Record<string, Record<string, unknown> | null>)
      : {};

  const toStageVideo = (key: StageKey): QueueVideo | null => {
    const raw = rawVideosByStage[key];
    if (!raw || typeof raw !== 'object') return null;
    return normalizeQueueVideo(raw);
  };

  return {
    packageId: String(row.packageId ?? ''),
    bookingId: String(row.bookingId ?? ''),
    jobTitle: String(row.jobTitle ?? ''),
    bookingStatus: row.bookingStatus != null ? String(row.bookingStatus) : null,
    vendorId: String(row.vendorId ?? ''),
    vendorName: row.vendorName != null ? String(row.vendorName) : null,
    clientName: row.clientName != null ? String(row.clientName) : null,
    serviceName: row.serviceName != null ? String(row.serviceName) : null,
    createdAt: String(row.createdAt ?? ''),
    uploadedByMembershipIds: Array.isArray(row.uploadedByMembershipIds)
      ? row.uploadedByMembershipIds.map((id) => String(id)).filter(Boolean)
      : [],
    moderationStatuses: Array.isArray(row.moderationStatuses)
      ? row.moderationStatuses.map((status) => String(status)).filter(Boolean)
      : [],
    visibilityStatuses: Array.isArray(row.visibilityStatuses)
      ? row.visibilityStatuses.map((status) => String(status)).filter(Boolean)
      : [],
    packageReadiness: String(row.packageReadiness ?? ''),
    videosByStage: {
      INTRO: toStageVideo('INTRO'),
      IN_PROGRESS: toStageVideo('IN_PROGRESS'),
      COMPLETED: toStageVideo('COMPLETED'),
    },
  };
}

function displayPackageState(states: string[]): string {
  const unique = Array.from(new Set(states.map((state) => String(state || '').trim().toLowerCase()).filter(Boolean)));
  if (unique.length === 0) return 'Unknown';
  if (unique.length > 1) return 'Mixed';
  return unique[0];
}

function prettyStatus(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function visibilityLabel(level: VisibilityLevel): string {
  return VISIBILITY_OPTIONS.find((opt) => opt.value === level)?.label || prettyStatus(level);
}

function AssetModerationControls({
  asset,
  actionBusy,
  applyModerationAction,
  openRejectModal,
}: {
  asset: QueueVideo;
  actionBusy: boolean;
  applyModerationAction: (asset: QueueVideo, action: ModerationAction, moderationReason?: string) => Promise<void>;
  openRejectModal: (asset: QueueVideo) => void;
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
  const [packages, setPackages] = useState<QueuePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<{
    stage: StageKey;
    video: QueueVideo;
    pack: QueuePackage;
  } | null>(null);
  const [assetActionLoadingId, setAssetActionLoadingId] = useState<string | null>(null);
  const [packageActionLoadingId, setPackageActionLoadingId] = useState<string | null>(null);
  const [packageVisibilityById, setPackageVisibilityById] = useState<Record<string, VisibilityLevel>>({});
  const [advancedOpenById, setAdvancedOpenById] = useState<Record<string, boolean>>({});
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<QueueVideo | null>(null);
  const [rejectPackageTarget, setRejectPackageTarget] = useState<QueuePackage | null>(null);

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
      if (!res.ok) {
        const msg =
          (typeof json?.message === 'string' && json.message.trim()) ||
          (typeof json?.error === 'string' && json.error.trim()) ||
          (json?.code ? String(json.code) : '') ||
          `Could not load queue (HTTP ${res.status})`;
        throw new Error(msg);
      }
      const rawPackages = Array.isArray(json.packages) ? json.packages : [];
      const normalizedPackages = rawPackages.map((row: Record<string, unknown>) => normalizeQueuePackage(row));
      setPackages(normalizedPackages);
      setPackageVisibilityById((prev) => {
        const next = { ...prev };
        for (const pack of normalizedPackages) {
          if (next[pack.packageId]) continue;
          const packageVisibility = displayPackageState(pack.visibilityStatuses);
          const fallback = packageVisibility === 'Mixed' ? 'private' : visibilityLevelFromAsset(packageVisibility);
          next[pack.packageId] = fallback;
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load moderation queue');
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyModerationAction = async (
    asset: QueueVideo,
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
      if (!res.ok) {
        const msg =
          (typeof json?.message === 'string' && json.message.trim()) ||
          (typeof json?.error === 'string' && json.error.trim()) ||
          (json?.code ? String(json.code) : '') ||
          `Action failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      setSelectedAsset((prev) => (prev && prev.video.assetId === asset.assetId ? null : prev));
      await fetchQueue();

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

  const applyPackageAction = async (
    pack: QueuePackage,
    action: PackageModerationAction,
    moderationReason?: string
  ) => {
    setPackageActionLoadingId(`${pack.packageId}:${action}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/media/packages/${pack.bookingId}/moderate`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: JSON.stringify({
          action,
          visibility: packageVisibilityById[pack.packageId],
          moderationReason: moderationReason || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          (typeof json?.message === 'string' && json.message.trim()) ||
          (typeof json?.error === 'string' && json.error.trim()) ||
          (json?.code ? String(json.code) : '') ||
          `Package action failed (HTTP ${res.status})`;
        throw new Error(msg);
      }
      const selectedVisibility = packageVisibilityById[pack.packageId] || 'private';
      if (action === 'approve') {
        setPackages((prev) =>
          prev.map((candidate) => {
            if (candidate.packageId !== pack.packageId) return candidate;
            const nextVideosByStage = { ...candidate.videosByStage };
            for (const stage of STAGE_ORDER) {
              const stageVideo = nextVideosByStage[stage];
              if (!stageVideo) continue;
              nextVideosByStage[stage] = {
                ...stageVideo,
                moderationStatus: 'approved',
                visibilityStatus: selectedVisibility,
              };
            }
            return {
              ...candidate,
              moderationStatuses: ['approved'],
              visibilityStatuses: [selectedVisibility],
              videosByStage: nextVideosByStage,
            };
          })
        );
      }
      await fetchQueue();
      setFeedback({
        type: 'success',
        message:
          action === 'approve'
            ? `Package approved. All stages are now ${visibilityLabel(selectedVisibility)}.`
            : json?.message || 'Package action applied successfully',
      });
    } catch (e) {
      setFeedback({
        type: 'error',
        message: e instanceof Error ? e.message : 'Failed to apply package action',
      });
    } finally {
      setPackageActionLoadingId(null);
    }
  };

  const vendors = useMemo(
    () => Array.from(new Set(packages.map((p) => `${p.vendorId}::${p.vendorName || p.vendorId}`))),
    [packages]
  );
  const uploaders = useMemo(
    () =>
      Array.from(
        new Set(packages.flatMap((pack) => (pack.uploadedByMembershipIds.length ? pack.uploadedByMembershipIds : ['unassigned'])))
      ),
    [packages]
  );

  const openRejectModal = (asset: QueueVideo) => {
    setRejectTarget(asset);
    setRejectPackageTarget(null);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const openPackageRejectModal = (pack: QueuePackage) => {
    setRejectPackageTarget(pack);
    setRejectTarget(null);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) return;
    if (rejectPackageTarget) {
      await applyPackageAction(rejectPackageTarget, 'reject', rejectReason.trim());
    } else if (rejectTarget) {
      await applyModerationAction(rejectTarget, 'reject', rejectReason.trim());
    } else {
      return;
    }
    setRejectModalOpen(false);
    setRejectTarget(null);
    setRejectPackageTarget(null);
    setRejectReason('');
  };

  const queueEmpty = !loading && !error && packages.length === 0;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Media Moderation</h1>
          <p className="text-gray-600 mt-1">
            Only complete 3-stage job packages appear here. Review Intro, In Progress, and Completed videos together.
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
            placeholder="Search by job, client, vendor, booking status, or stage title"
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
          <CardContent className="py-12 text-center text-gray-500">
            No complete 3-stage job packages matched the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {packages.map((pack) => {
            const moderationLabel = displayPackageState(pack.moderationStatuses);
            const visibilityLabel = displayPackageState(pack.visibilityStatuses);
            const hasAllRequiredStages = STAGE_ORDER.every((stage) => Boolean(pack.videosByStage[stage]));
            const allRequiredStagesApproved = STAGE_ORDER.every((stage) => {
              const stageVideo = pack.videosByStage[stage];
              return stageVideo && String(stageVideo.moderationStatus || '').trim().toLowerCase() === 'approved';
            });
            const showReadyForAdminReview = hasAllRequiredStages && !allRequiredStagesApproved;
            const showPackageApproved = hasAllRequiredStages && allRequiredStagesApproved;
            const packageStageSummary = STAGE_ORDER.map((stage) => {
              const stageVideo = pack.videosByStage[stage];
              const moderation = String(stageVideo?.moderationStatus || '').trim().toLowerCase();
              const isApproved = moderation === 'approved';
              return {
                stage,
                label: STAGE_LABELS[stage],
                statusText: stageVideo ? (isApproved ? 'Approved' : 'Needs admin action') : 'Missing',
                statusClass: stageVideo
                  ? isApproved
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                  : 'text-red-700',
              };
            });
            const overallPackageStatus = allRequiredStagesApproved ? 'Approved' : 'Admin Review Required';
            const packageActionBusy = Boolean(packageActionLoadingId?.startsWith(`${pack.packageId}:`));
            const selectedPackageVisibility = packageVisibilityById[pack.packageId] || 'private';
            const hasMixedState = moderationLabel === 'Mixed' || visibilityLabel === 'Mixed';
            return (
              <Card key={pack.packageId} className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/70 to-white">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-base">{pack.jobTitle || 'Untitled Job'}</div>
                        <div className="text-sm text-gray-700">Vendor: {pack.vendorName || pack.vendorId}</div>
                        <div className="text-sm text-gray-700">Client: {pack.clientName || '-'}</div>
                        <div className="text-sm text-gray-700">Job status: {formatJobBookingStatus(pack.bookingStatus)}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {showReadyForAdminReview ? (
                          <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">
                            Ready for Admin Review
                          </Badge>
                        ) : null}
                        {showPackageApproved ? (
                          <Badge className="bg-green-700 text-white hover:bg-green-700">Package Approved</Badge>
                        ) : null}
                        <Badge variant="outline">Package moderation: {prettyStatus(moderationLabel)}</Badge>
                        <Badge variant="outline">Package visibility: {prettyStatus(visibilityLabel)}</Badge>
                      </div>
                    </div>
                    {hasMixedState ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        Some stages have different moderation or visibility states.
                      </div>
                    ) : null}
                    <div className="rounded-md border border-emerald-200 bg-white/80 p-3 text-sm">
                      <div className="font-medium text-gray-900">Package Status</div>
                      <div className="mt-2 space-y-1 text-sm">
                        {packageStageSummary.map((row) => (
                          <div key={`${pack.packageId}:${row.stage}`} className="flex items-center justify-between gap-3">
                            <span className="text-gray-800">{row.label}</span>
                            <span className={row.statusClass}>{row.statusText}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 border-t pt-2 flex items-center justify-between">
                        <span className="font-medium text-gray-900">Overall</span>
                        <span className={allRequiredStagesApproved ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                          {overallPackageStatus}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-md border bg-white p-3 space-y-3">
                      <div className="text-sm font-medium text-gray-900">Package review actions</div>
                      <p className="text-xs text-gray-600">
                        Normal workflow: choose package visibility, then approve, reject, or flag the full Intro + In Progress + Completed package.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                        <div className="space-y-1 md:col-span-2">
                          <Label htmlFor={`package-visibility-${pack.packageId}`} className="text-xs text-gray-600">
                            Package visibility
                          </Label>
                          <select
                            id={`package-visibility-${pack.packageId}`}
                            value={selectedPackageVisibility}
                            onChange={(e) =>
                              setPackageVisibilityById((prev) => ({
                                ...prev,
                                [pack.packageId]: e.target.value as VisibilityLevel,
                              }))
                            }
                            disabled={packageActionBusy}
                            className="h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                          >
                            {VISIBILITY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button size="sm" disabled={packageActionBusy} onClick={() => applyPackageAction(pack, 'approve')}>
                          Approve Package
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={packageActionBusy} onClick={() => openPackageRejectModal(pack)}>
                          Reject Package
                        </Button>
                        <Button size="sm" variant="outline" disabled={packageActionBusy} onClick={() => applyPackageAction(pack, 'flag')}>
                          <ShieldAlert className="w-4 h-4 mr-1" />
                          Flag Package
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-md border bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-gray-900">Advanced stage controls</div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setAdvancedOpenById((prev) => ({
                              ...prev,
                              [pack.packageId]: !prev[pack.packageId],
                            }))
                          }
                        >
                          {advancedOpenById[pack.packageId] ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">
                        Use only when you need stage-specific overrides after a package-level decision.
                      </p>
                    </div>
                    {advancedOpenById[pack.packageId] ? (
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                      {STAGE_ORDER.map((stage) => {
                        const stageVideo = pack.videosByStage[stage];
                        if (!stageVideo) {
                          return (
                            <div key={`${pack.packageId}:${stage}`} className="rounded border border-dashed border-gray-300 p-3 text-sm text-gray-500">
                              {STAGE_LABELS[stage]} video missing.
                            </div>
                          );
                        }
                        const actionBusy = Boolean(assetActionLoadingId?.startsWith(`${stageVideo.assetId}:`));
                        return (
                          <div
                            key={stageVideo.assetId}
                            className={`rounded border p-3 space-y-2 ${
                              stage === 'COMPLETED' ? 'border-emerald-400 bg-emerald-50/70' : 'bg-white'
                            }`}
                          >
                            <div className="h-24 rounded border bg-gray-50 flex items-center justify-center overflow-hidden">
                              {stageVideo.previewRef && stageVideo.mimeType.startsWith('image/') ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={stageVideo.previewRef} alt={stageVideo.title} className="h-full w-full object-cover" />
                              ) : (
                                <Video className="w-6 h-6 text-gray-400" />
                              )}
                            </div>
                            <div className="font-medium text-sm flex flex-wrap items-center gap-2">
                              {STAGE_LABELS[stage]}
                              {stage === 'COMPLETED' ? (
                                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Primary proof</Badge>
                              ) : null}
                            </div>
                            <div className="text-sm text-gray-900">{stageVideo.title}</div>
                            <div className="text-xs text-gray-600">
                              Uploaded: {new Date(stageVideo.createdAt).toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-600">
                              Uploader: {stageVideo.employeeName || stageVideo.uploadedByMembershipId || '-'}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">Moderation: {stageVideo.moderationStatus}</Badge>
                              <Badge variant="outline">
                                Visibility:{' '}
                                {VISIBILITY_OPTIONS.find((o) => o.value === visibilityLevelFromAsset(stageVideo.visibilityStatus))
                                  ?.label || stageVideo.visibilityStatus}
                              </Badge>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedAsset({ stage, video: stageVideo, pack })}
                              >
                                Details
                              </Button>
                              <AssetModerationControls
                                asset={stageVideo}
                                actionBusy={actionBusy}
                                applyModerationAction={applyModerationAction}
                                openRejectModal={openRejectModal}
                              />
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    ) : null}
                    <div className="text-xs text-gray-600">
                      Package updated: {new Date(pack.createdAt).toLocaleString()}
                      {pack.serviceName ? ` • Service: ${pack.serviceName}` : ''}
                      {pack.uploadedByMembershipIds.length ? ` • Uploaders: ${pack.uploadedByMembershipIds.join(', ')}` : ''}
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
            <DialogTitle>
              {selectedAsset ? `${STAGE_LABELS[selectedAsset.stage]} video — ${selectedAsset.pack.jobTitle || 'Job package'}` : 'Media Asset'}
            </DialogTitle>
            <DialogDescription>Stage-level moderation details within a complete job package.</DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-3 text-sm">
              {selectedAsset.video.previewRef && selectedAsset.video.mimeType.startsWith('video/') && (
                <video className="w-full rounded border bg-black" controls src={selectedAsset.video.previewRef}>
                  Your browser does not support video playback.
                </video>
              )}
              {selectedAsset.video.previewRef && selectedAsset.video.mimeType.startsWith('image/') && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedAsset.video.previewRef} alt={selectedAsset.video.title} className="w-full rounded border object-cover max-h-96" />
              )}
              {selectedAsset.video.downloadRef && (
                <a className="text-blue-600 underline" href={selectedAsset.video.downloadRef} target="_blank" rel="noreferrer">
                  Open download-safe link
                </a>
              )}
              {selectedAsset.stage === 'COMPLETED' ? (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <strong>Completed-stage video</strong> — this is the primary proof clip for the job package.
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>Asset ID: {selectedAsset.video.assetId}</div>
                <div>Session ID: {selectedAsset.video.mediaSessionId || '-'}</div>
                <div>Vendor: {selectedAsset.pack.vendorName || selectedAsset.pack.vendorId}</div>
                <div>Uploader: {selectedAsset.video.employeeName || selectedAsset.video.uploadedByMembershipId || '-'}</div>
                <div>Job: {selectedAsset.pack.jobTitle || '-'}</div>
                <div>Job status: {formatJobBookingStatus(selectedAsset.pack.bookingStatus)}</div>
                <div>Video stage: {STAGE_LABELS[selectedAsset.stage]}</div>
                <div>Client: {selectedAsset.pack.clientName || '-'}</div>
                <div>Service: {selectedAsset.pack.serviceName || '-'}</div>
                <div>Created: {new Date(selectedAsset.video.createdAt).toLocaleString()}</div>
                <div>Moderation: {selectedAsset.video.moderationStatus}</div>
                <div>Visibility: {selectedAsset.video.visibilityStatus}</div>
                <div>Archive: {selectedAsset.video.archiveStatus}</div>
                <div>Size: {bytesToReadable(selectedAsset.video.bytes)}</div>
              </div>
              <div className="rounded border p-3 space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Approve / visibility / reject / flag</div>
                <p className="text-[11px] text-gray-500">
                  Moderation stays per stage, but this stage is reviewed within the single grouped job package card.
                </p>
                <AssetModerationControls
                  asset={selectedAsset.video}
                  actionBusy={Boolean(assetActionLoadingId?.startsWith(`${selectedAsset.video.assetId}:`))}
                  applyModerationAction={applyModerationAction}
                  openRejectModal={openRejectModal}
                />
              </div>
              {selectedAsset.video.moderationReason && (
                <div className="p-2 rounded bg-amber-50 border border-amber-200">
                  Moderation reason: {selectedAsset.video.moderationReason}
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

      <Dialog
        open={rejectModalOpen}
        onOpenChange={(open) => {
          setRejectModalOpen(open);
          if (!open) {
            setRejectTarget(null);
            setRejectPackageTarget(null);
            setRejectReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rejectPackageTarget ? 'Reject Package' : 'Reject Stage'}</DialogTitle>
            <DialogDescription>
              {rejectPackageTarget
                ? 'Provide one rejection reason for this full package. It will be applied to all stages.'
                : 'Provide a stage-specific moderation reason for rejection.'}
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={rejectPackageTarget ? 'Enter package rejection reason...' : 'Enter stage rejection reason...'}
            className="w-full min-h-[120px] rounded border border-input px-3 py-2 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReject} disabled={!rejectReason.trim() || Boolean(assetActionLoadingId) || Boolean(packageActionLoadingId)}>
              Submit Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
