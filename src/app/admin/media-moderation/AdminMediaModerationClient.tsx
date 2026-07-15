'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GuidanceCallout } from '@/components/guidance/GuidanceCallout';
import { TutorialEntryPoint } from '@/components/guidance/TutorialEntryPoint';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getAdminRequestHeaders } from '@/lib/admin-client';
import { RefreshCw, Video, ShieldAlert, Sparkles } from 'lucide-react';
import { tutorialGuides } from '@/lib/user-guidance';
import { VENDOR_JOB_VIDEO_STAGE_LABELS } from '@/lib/vendor-job-video-stages';

type StageKey = 'INTRO' | 'IN_PROGRESS' | 'COMPLETED';

const STAGE_ORDER: StageKey[] = ['INTRO', 'IN_PROGRESS', 'COMPLETED'];
const STAGE_LABELS: Record<StageKey, string> = {
  INTRO: VENDOR_JOB_VIDEO_STAGE_LABELS.INTRO,
  IN_PROGRESS: VENDOR_JOB_VIDEO_STAGE_LABELS.IN_PROGRESS,
  COMPLETED: VENDOR_JOB_VIDEO_STAGE_LABELS.COMPLETED,
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
  moderatedAt: string | Date | null;
  createdAt: string | Date | null;
  mimeType: string;
  bytes: string;
  previewRef: string | null;
  downloadRef: string | null;
  adminDownloadRef: string | null;
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
  createdAt: string | Date | null;
  uploadedByMembershipIds: string[];
  moderationStatuses: string[];
  visibilityStatuses: string[];
  packageReadiness: string;
  videosByStage: Record<StageKey, QueueVideo | null>;
};

type AiModerationSuggestion = {
  summary: string;
  decision: 'approve' | 'flag' | 'reject' | 'needs_human_review';
  confidence: 'low' | 'medium' | 'high';
  policyAreas: string[];
  findings: Array<{
    label: string;
    detail: string;
    evidence: string[];
  }>;
  recommendedActions: string[];
};

type AiSuggestionState = {
  aiRunId: string;
  analysisScope: 'metadata_only';
  promptVersion: string;
  model: string;
  requestId: string | null;
  responseId: string;
  usage: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
  } | null;
  suggestion: AiModerationSuggestion;
  feedback:
    | {
        outcome: 'accepted' | 'overrode' | 'ignored';
        mode: 'automatic' | 'manual';
      }
    | null;
};

type AiFeedbackOutcome = 'accepted' | 'overrode' | 'ignored';

function buildInitialPackageVisibilityById(packages: QueuePackage[]) {
  const next: Record<string, VisibilityLevel> = {};
  for (const pack of packages) {
    const packageVisibility = displayPackageState(pack.visibilityStatuses);
    const existingLevel = packageVisibility === 'Mixed' ? 'private' : visibilityLevelFromAsset(packageVisibility);
    const packageReadiness = String(pack.packageReadiness || '').trim().toUpperCase();
    next[pack.packageId] =
      packageReadiness === 'READY_FOR_ADMIN_REVIEW' && existingLevel === 'private'
        ? 'customer_only'
        : existingLevel;
  }
  return next;
}

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

function formatModerationTimestamp(value: string | Date | null | undefined): string {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
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
    adminDownloadRef: row.adminDownloadRef != null ? String(row.adminDownloadRef) : null,
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
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'pending_review') return 'Pending Review';
  if (normalized === 'approved') return 'Approved';
  if (normalized === 'rejected') return 'Rejected';
  if (normalized === 'flagged') return 'Flagged';
  return normalized
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function feedbackOutcomeLabel(outcome: AiFeedbackOutcome): string {
  if (outcome === 'accepted') return 'Followed';
  if (outcome === 'overrode') return 'Overrode';
  return 'Ignored';
}

function moderationDecisionToActionFamily(
  decision: AiModerationSuggestion['decision']
): 'approve' | 'reject' | 'flag' | 'needs_human_review' {
  if (decision === 'approve') return 'approve';
  if (decision === 'reject') return 'reject';
  if (decision === 'flag') return 'flag';
  return 'needs_human_review';
}

function moderationActionToActionFamily(
  action: ModerationAction | PackageModerationAction
): 'approve' | 'reject' | 'flag' {
  if (action === 'reject') return 'reject';
  if (action === 'flag') return 'flag';
  return 'approve';
}

function inferModerationFeedbackOutcome(
  decision: AiModerationSuggestion['decision'],
  action: ModerationAction | PackageModerationAction
): AiFeedbackOutcome {
  const actualAction = moderationActionToActionFamily(action);
  const recommendedAction = moderationDecisionToActionFamily(decision);

  if (recommendedAction === 'needs_human_review') {
    return actualAction === 'approve' ? 'overrode' : 'accepted';
  }

  return recommendedAction === actualAction ? 'accepted' : 'overrode';
}

function visibilityLabel(level: VisibilityLevel): string {
  return VISIBILITY_OPTIONS.find((opt) => opt.value === level)?.label || prettyStatus(level);
}

function AssetModerationControls({
  asset,
  actionBusy,
  applyModerationAction,
  openModerationReasonModal,
}: {
  asset: QueueVideo;
  actionBusy: boolean;
  applyModerationAction: (
    asset: QueueVideo,
    action: ModerationAction,
    moderationReason?: string
  ) => Promise<void>;
  openModerationReasonModal: (asset: QueueVideo, action: 'reject' | 'flag') => void;
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
        <Label htmlFor={`visibility-${asset.assetId}`} className="text-xs text-slate-300">
          Visibility level
        </Label>
        <select
          id={`visibility-${asset.assetId}`}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as VisibilityLevel)}
          disabled={actionBusy}
          className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-50"
        >
          {VISIBILITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-slate-400 leading-snug">{selectedHint}</p>
      </div>
      <Button
        size="sm"
        disabled={actionBusy}
        onClick={() => applyModerationAction(asset, actionForApproveOrUpdateVisibility(asset, visibility))}
      >
        {primaryLabel}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-800 hover:text-white"
        disabled={actionBusy}
        onClick={() => openModerationReasonModal(asset, 'reject')}
      >
        Reject
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-800 hover:text-white"
        disabled={actionBusy}
        onClick={() => openModerationReasonModal(asset, 'flag')}
      >
        <ShieldAlert className="w-4 h-4 mr-1" />
        Flag
      </Button>
    </div>
  );
}

type AdminMediaModerationClientProps = {
  initialPackages?: QueuePackage[] | null;
  initialError?: string;
  initialAiModerationEnabled?: boolean;
};

export default function AdminMediaModerationClient({
  initialPackages = null,
  initialError = '',
  initialAiModerationEnabled = false,
}: AdminMediaModerationClientProps) {
  const [packages, setPackages] = useState<QueuePackage[]>(initialPackages ?? []);
  const [loading, setLoading] = useState(initialPackages == null && !initialError);
  const [error, setError] = useState(initialError);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<{
    stage: StageKey;
    video: QueueVideo;
    pack: QueuePackage;
  } | null>(null);
  const [assetActionLoadingId, setAssetActionLoadingId] = useState<string | null>(null);
  const [packageActionLoadingId, setPackageActionLoadingId] = useState<string | null>(null);
  const [packageVisibilityById, setPackageVisibilityById] = useState<Record<string, VisibilityLevel>>(
    buildInitialPackageVisibilityById(initialPackages ?? [])
  );
  const [advancedOpenById, setAdvancedOpenById] = useState<Record<string, boolean>>({});
  const [moderationReasonModalOpen, setModerationReasonModalOpen] = useState(false);
  const [moderationReason, setModerationReason] = useState('');
  const [moderationTargetAction, setModerationTargetAction] = useState<'reject' | 'flag' | null>(null);
  const [moderationTarget, setModerationTarget] = useState<QueueVideo | null>(null);
  const [moderationPackageTarget, setModerationPackageTarget] = useState<QueuePackage | null>(null);
  const [assetPlaybackUrl, setAssetPlaybackUrl] = useState('');
  const [assetPlaybackLoading, setAssetPlaybackLoading] = useState(false);
  const [assetPlaybackError, setAssetPlaybackError] = useState('');
  const [aiSuggestionByPackageId, setAiSuggestionByPackageId] = useState<Record<string, AiSuggestionState>>({});
  const [aiSuggestionLoadingId, setAiSuggestionLoadingId] = useState<string | null>(null);
  const [aiFeedbackSavingId, setAiFeedbackSavingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [uploaderFilter, setUploaderFilter] = useState('all');
  const [search, setSearch] = useState('');

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
      params.set('limit', '30');

      const res = await fetch(`/api/admin/media/moderation-queue?${params.toString()}`, {
        method: 'GET',
        headers: getAdminRequestHeaders(),
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
    if (initialPackages != null || initialError) {
      return;
    }
    fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPackages, initialError]);

  const applyModerationAction = async (
    asset: QueueVideo,
    action: ModerationAction,
    moderationReason?: string,
    pack?: QueuePackage
  ) => {
    setAssetActionLoadingId(`${asset.assetId}:${action}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/media/${asset.assetId}/moderate`, {
        method: 'PATCH',
        headers: getAdminRequestHeaders(),
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
      const feedbackResult = pack
        ? await recordAiFeedbackForPackage(
            pack,
            inferModerationFeedbackOutcome(
              aiSuggestionByPackageId[pack.packageId]?.suggestion.decision || 'needs_human_review',
              action
            ),
            'automatic',
            moderationActionToActionFamily(action)
          )
        : 'skipped';
      await fetchQueue();

      setFeedback({
        type: 'success',
        message: `${json?.message || 'Moderation action applied successfully'}${
          feedbackResult === 'recorded'
            ? ' AI feedback recorded.'
            : feedbackResult === 'failed'
              ? ' The moderation action succeeded, but AI feedback could not be recorded.'
              : ''
        }`,
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
        headers: getAdminRequestHeaders(),
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
      const feedbackResult = await recordAiFeedbackForPackage(
        pack,
        inferModerationFeedbackOutcome(
          aiSuggestionByPackageId[pack.packageId]?.suggestion.decision || 'needs_human_review',
          action
        ),
        'automatic',
        moderationActionToActionFamily(action)
      );
      await fetchQueue();
      setFeedback({
        type: 'success',
        message: `${
          action === 'approve'
            ? `Package approved. All stages are now ${visibilityLabel(selectedVisibility)}.`
            : json?.message || 'Package action applied successfully'
        }${
          feedbackResult === 'recorded'
            ? ' AI feedback recorded.'
            : feedbackResult === 'failed'
              ? ' The package action succeeded, but AI feedback could not be recorded.'
              : ''
        }`,
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

  const requestAiSuggestion = async (pack: QueuePackage) => {
    setAiSuggestionLoadingId(pack.packageId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/media/packages/${pack.bookingId}/assist`, {
        method: 'POST',
        headers: getAdminRequestHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          (typeof json?.message === 'string' && json.message.trim()) ||
          (typeof json?.error === 'string' && json.error.trim()) ||
          (json?.code ? String(json.code) : '') ||
          `AI review assist failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      setAiSuggestionByPackageId((prev) => ({
        ...prev,
        [pack.packageId]: {
          aiRunId: String(json?.aiRunId || json?.responseId || ''),
          analysisScope: 'metadata_only',
          promptVersion: String(json?.promptVersion || ''),
          model: String(json?.model || ''),
          requestId: json?.requestId != null ? String(json.requestId) : null,
          responseId: String(json?.responseId || ''),
          usage:
            json?.usage && typeof json.usage === 'object'
              ? {
                  inputTokens:
                    json.usage.inputTokens != null ? Number(json.usage.inputTokens) : null,
                  outputTokens:
                    json.usage.outputTokens != null ? Number(json.usage.outputTokens) : null,
                  totalTokens:
                    json.usage.totalTokens != null ? Number(json.usage.totalTokens) : null,
                }
              : null,
          suggestion: json.suggestion as AiModerationSuggestion,
          feedback: null,
        },
      }));
      setFeedback({
        type: 'success',
        message: 'AI moderation recommendation generated.',
      });
    } catch (e) {
      setFeedback({
        type: 'error',
        message: e instanceof Error ? e.message : 'Failed to generate AI moderation recommendation',
      });
    } finally {
      setAiSuggestionLoadingId(null);
    }
  };

  const recordAiFeedbackForPackage = async (
    pack: QueuePackage,
    outcome: AiFeedbackOutcome,
    mode: 'automatic' | 'manual',
    actualAction?: string
  ): Promise<'recorded' | 'skipped' | 'failed'> => {
    const aiSuggestion = aiSuggestionByPackageId[pack.packageId];
    if (!aiSuggestion?.aiRunId || aiSuggestion.feedback) {
      return 'skipped';
    }

    setAiFeedbackSavingId(pack.packageId);
    try {
      const response = await fetch('/api/admin/ai/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminRequestHeaders(),
        },
        body: JSON.stringify({
          aiRunId: aiSuggestion.aiRunId,
          feature: 'moderation_assistant',
          operation: 'review_media_package',
          relatedEntityType: 'booking',
          relatedEntityId: pack.bookingId,
          outcome,
          source: 'admin_media_moderation',
          promptVersion: aiSuggestion.promptVersion,
          model: aiSuggestion.model,
          recommendedAction: moderationDecisionToActionFamily(aiSuggestion.suggestion.decision),
          actualAction: actualAction || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setAiSuggestionByPackageId((current) => {
        const existing = current[pack.packageId];
        if (!existing) return current;
        return {
          ...current,
          [pack.packageId]: {
            ...existing,
            feedback: {
              outcome,
              mode,
            },
          },
        };
      });
      return 'recorded';
    } catch (error) {
      console.warn('[admin/media-moderation] failed to record AI feedback', {
        packageId: pack.packageId,
        bookingId: pack.bookingId,
        outcome,
        mode,
        error: error instanceof Error ? error.message : String(error),
      });
      return 'failed';
    } finally {
      setAiFeedbackSavingId(null);
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

  const packageSummary = useMemo(() => {
    const readyForReview = packages.filter((pack) =>
      STAGE_ORDER.every((stage) => Boolean(pack.videosByStage[stage])) &&
      !STAGE_ORDER.every((stage) => {
        const stageVideo = pack.videosByStage[stage];
        return stageVideo && String(stageVideo.moderationStatus || '').trim().toLowerCase() === 'approved';
      })
    ).length;
    const approved = packages.filter((pack) =>
      STAGE_ORDER.every((stage) => {
        const stageVideo = pack.videosByStage[stage];
        return stageVideo && String(stageVideo.moderationStatus || '').trim().toLowerCase() === 'approved';
      })
    ).length;
    const customerOnly = packages.filter((pack) => displayPackageState(pack.visibilityStatuses) === 'customer_only').length;
    const mixed = packages.filter((pack) => {
      const moderation = displayPackageState(pack.moderationStatuses);
      const visibility = displayPackageState(pack.visibilityStatuses);
      return moderation === 'Mixed' || visibility === 'Mixed';
    }).length;
    return { readyForReview, approved, customerOnly, mixed };
  }, [packages]);

  const resetModerationReasonModal = () => {
    setModerationReasonModalOpen(false);
    setModerationTargetAction(null);
    setModerationTarget(null);
    setModerationPackageTarget(null);
    setModerationReason('');
  };

  const openModerationReasonModal = (asset: QueueVideo, action: 'reject' | 'flag') => {
    setModerationTarget(asset);
    setModerationPackageTarget(null);
    setModerationTargetAction(action);
    setModerationReason('');
    setModerationReasonModalOpen(true);
  };

  const openPackageModerationReasonModal = (pack: QueuePackage, action: 'reject' | 'flag') => {
    setModerationPackageTarget(pack);
    setModerationTarget(null);
    setModerationTargetAction(action);
    setModerationReason('');
    setModerationReasonModalOpen(true);
  };

  const submitModerationReason = async () => {
    if (!moderationReason.trim() || !moderationTargetAction) return;
    if (moderationPackageTarget) {
      await applyPackageAction(moderationPackageTarget, moderationTargetAction, moderationReason.trim());
    } else if (moderationTarget) {
      await applyModerationAction(moderationTarget, moderationTargetAction, moderationReason.trim());
    } else {
      return;
    }
    resetModerationReasonModal();
  };

  const moderationIsFlag = moderationTargetAction === 'flag';
  const moderationTargetLabel = moderationPackageTarget ? 'Package' : 'Stage';
  const moderationDialogTitle = `${moderationIsFlag ? 'Flag' : 'Reject'} ${moderationTargetLabel}`;
  const moderationDialogDescription = moderationPackageTarget
    ? moderationIsFlag
      ? 'Provide one moderation reason for flagging this full package. It will be applied to all stages.'
      : 'Provide one rejection reason for this full package. It will be applied to all stages.'
    : moderationIsFlag
      ? 'Provide a stage-specific moderation reason for follow-up review.'
      : 'Provide a stage-specific moderation reason for rejection.';
  const moderationDialogPlaceholder = moderationPackageTarget
    ? moderationIsFlag
      ? 'Enter package flag reason...'
      : 'Enter package rejection reason...'
    : moderationIsFlag
      ? 'Enter stage flag reason...'
      : 'Enter stage rejection reason...';
  const moderationSubmitLabel = moderationIsFlag ? 'Submit Flag' : 'Submit Rejection';

  const queueEmpty = !loading && !error && packages.length === 0;

  useEffect(() => {
    const resolveAssetPlayback = async () => {
      if (!selectedAsset) {
        setAssetPlaybackUrl('');
        setAssetPlaybackError('');
        setAssetPlaybackLoading(false);
        return;
      }
      const candidateRef = selectedAsset.video.adminDownloadRef || selectedAsset.video.downloadRef;
      if (!candidateRef) {
        setAssetPlaybackUrl(selectedAsset.video.previewRef || '');
        setAssetPlaybackError('');
        setAssetPlaybackLoading(false);
        return;
      }

      setAssetPlaybackLoading(true);
      setAssetPlaybackError('');
      try {
        const res = await fetch(candidateRef, {
          method: 'GET',
          headers: getAdminRequestHeaders(),
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(String(json?.message || json?.error || `Could not fetch secure media URL (${res.status})`));
        }
        const secureUrl = String(json?.downloadUrl || json?.url || '').trim();
        if (!secureUrl) {
          throw new Error('Secure media URL was empty.');
        }
        setAssetPlaybackUrl(secureUrl);
      } catch (e) {
        setAssetPlaybackUrl(selectedAsset.video.previewRef || '');
        setAssetPlaybackError(e instanceof Error ? e.message : 'Unable to resolve secure media URL');
      } finally {
        setAssetPlaybackLoading(false);
      }
    };
    void resolveAssetPlayback();
  }, [selectedAsset]);

  return (
    <div className="w-full max-w-7xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Media Moderation</h1>
          <p className="text-gray-600 mt-1">
            Only complete 3-stage job packages appear here. Review Starting Condition, Work in Progress, and Final Result videos together.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TutorialEntryPoint guide={tutorialGuides.adminMediaModeration} surface="light" />
          <Button variant="outline" onClick={fetchQueue} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <GuidanceCallout
        title="What an approval changes"
        description="Approving a package confirms the moderation decision and the visibility tier you chose. It does not mean every approved package becomes public."
        bullets={[
          'Use customer-only when the service video should stay off public discovery but remain available to the booking customer.',
          'Use private or vendor archive states when the package should not be customer-visible.',
          'AI Review Assist is metadata-only in this version and should support, not replace, the admin decision.',
        ]}
        tone="blue"
      />

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Ready For Review</div>
              <div className="mt-2 text-2xl font-bold text-amber-900">{packageSummary.readyForReview}</div>
              <p className="mt-1 text-sm text-amber-800">Full 3-stage packages still needing an admin decision.</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Approved Packages</div>
              <div className="mt-2 text-2xl font-bold text-emerald-900">{packageSummary.approved}</div>
              <p className="mt-1 text-sm text-emerald-800">All required stages approved and visible at the chosen tier.</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Customer Only</div>
              <div className="mt-2 text-2xl font-bold text-blue-900">{packageSummary.customerOnly}</div>
              <p className="mt-1 text-sm text-blue-800">Approved packages kept out of public discovery.</p>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Mixed State</div>
              <div className="mt-2 text-2xl font-bold text-rose-900">{packageSummary.mixed}</div>
              <p className="mt-1 text-sm text-rose-800">Packages with stage-by-stage moderation or visibility differences.</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Operator flow</div>
            <div className="mt-2 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
              <p>1. Confirm the Starting Condition, Work in Progress, and Final Result videos belong to the same finished job.</p>
              <p>2. Choose the package visibility before approving the full package.</p>
              <p>3. Use advanced stage controls only when a single stage needs different handling.</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
          <CardTitle>Queue Filters</CardTitle>
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
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="flagged">Flagged</option>
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
          <CardContent className="py-12 text-center text-gray-500">Loading service video moderation queue...</CardContent>
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
                    ? 'text-emerald-300'
                    : 'text-amber-200'
                  : 'text-red-300',
              };
            });
            const overallPackageStatus = allRequiredStagesApproved ? 'Approved' : 'Admin Review Required';
            const packageActionBusy = Boolean(packageActionLoadingId?.startsWith(`${pack.packageId}:`));
            const aiActionBusy = aiSuggestionLoadingId === pack.packageId;
            const aiFeedbackBusy = aiFeedbackSavingId === pack.packageId;
            const selectedPackageVisibility = packageVisibilityById[pack.packageId] || 'private';
            const hasMixedState = moderationLabel === 'Mixed' || visibilityLabel === 'Mixed';
            const aiSuggestion = aiSuggestionByPackageId[pack.packageId];
            return (
              <Card
                key={pack.packageId}
                className="border border-slate-700 bg-slate-900/95 text-slate-100 shadow-2xl shadow-black/25"
              >
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-base text-white">{pack.jobTitle || 'Untitled Job'}</div>
                        <div className="text-sm text-slate-300">Vendor: {pack.vendorName || pack.vendorId}</div>
                        <div className="text-sm text-slate-300">Client: {pack.clientName || '-'}</div>
                        <div className="text-sm text-slate-300">Job status: {formatJobBookingStatus(pack.bookingStatus)}</div>
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
                        <Badge variant="outline" className="border-slate-600 bg-slate-950/80 text-slate-100">
                          Package moderation: {prettyStatus(moderationLabel)}
                        </Badge>
                        <Badge variant="outline" className="border-slate-600 bg-slate-950/80 text-slate-100">
                          Package visibility: {prettyStatus(visibilityLabel)}
                        </Badge>
                      </div>
                    </div>
                    {hasMixedState ? (
                      <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                        Some stages have different moderation or visibility states.
                      </div>
                    ) : null}
                    <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm">
                      <div className="font-medium text-white">Package Status</div>
                      <div className="mt-2 space-y-1 text-sm">
                        {packageStageSummary.map((row) => (
                          <div key={`${pack.packageId}:${row.stage}`} className="flex items-center justify-between gap-3">
                            <span className="text-slate-200">{row.label}</span>
                            <span className={row.statusClass}>{row.statusText}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 border-t border-slate-700 pt-2 flex items-center justify-between">
                        <span className="font-medium text-white">Overall</span>
                        <span className={allRequiredStagesApproved ? 'font-semibold text-emerald-300' : 'font-semibold text-amber-200'}>
                          {overallPackageStatus}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3 space-y-3">
                      <div className="text-sm font-medium text-white">Package review actions</div>
                      <p className="text-xs text-slate-300">
                        Normal workflow: approve, reject, or flag the full Before + During + Completed service package.
                        Visibility follows the customer/vendor consent path already saved on the work order.
                      </p>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
                        <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">
                          Saved visibility: {VISIBILITY_OPTIONS.find((opt) => opt.value === selectedPackageVisibility)?.label || selectedPackageVisibility}
                        </div>
                        <Button size="sm" disabled={packageActionBusy} onClick={() => applyPackageAction(pack, 'approve')}>
                          Approve Package
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-800 hover:text-white"
                          disabled={packageActionBusy}
                          onClick={() => openPackageModerationReasonModal(pack, 'reject')}
                        >
                          Reject Package
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-800 hover:text-white"
                          disabled={packageActionBusy}
                          onClick={() => openPackageModerationReasonModal(pack, 'flag')}
                        >
                          <ShieldAlert className="w-4 h-4 mr-1" />
                          Flag Package
                        </Button>
                      </div>
                    </div>
                    {initialAiModerationEnabled ? (
                      <div className="rounded-lg border border-sky-400/30 bg-sky-500/10 p-3 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium text-white">AI Review Assist</div>
                            <p className="text-xs text-slate-300">
                              Metadata-only recommendation. The AI does not watch the actual video content in this version.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-sky-300/40 bg-slate-950/80 text-sky-50 hover:bg-sky-950 hover:text-white"
                            disabled={aiActionBusy}
                            onClick={() => requestAiSuggestion(pack)}
                          >
                            <Sparkles className="w-4 h-4 mr-1" />
                            {aiActionBusy ? 'Analyzing...' : 'Generate AI Recommendation'}
                          </Button>
                        </div>
                        {aiSuggestion ? (
                          <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="bg-sky-700 text-white hover:bg-sky-700">
                                AI decision: {prettyStatus(aiSuggestion.suggestion.decision)}
                              </Badge>
                              <Badge variant="outline" className="border-slate-600 bg-slate-900 text-slate-100">
                                Confidence: {prettyStatus(aiSuggestion.suggestion.confidence)}
                              </Badge>
                              <Badge variant="outline" className="border-slate-600 bg-slate-900 text-slate-100">Scope: metadata only</Badge>
                            </div>
                            <div className="text-sm text-slate-100">{aiSuggestion.suggestion.summary}</div>
                            {aiSuggestion.suggestion.policyAreas.length ? (
                              <div className="flex flex-wrap gap-2">
                                {aiSuggestion.suggestion.policyAreas.map((area) => (
                                  <Badge key={`${pack.packageId}:${area}`} variant="outline" className="border-slate-600 bg-slate-900 text-slate-100">
                                    {prettyStatus(area)}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                            {aiSuggestion.suggestion.findings.length ? (
                              <div className="space-y-2">
                                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                  Findings
                                </div>
                                {aiSuggestion.suggestion.findings.map((finding, index) => (
                                  <div key={`${pack.packageId}:finding:${index}`} className="rounded border border-slate-700 bg-slate-900 p-2">
                                    <div className="font-medium text-sm text-slate-100">{finding.label}</div>
                                    <div className="text-sm text-slate-300">{finding.detail}</div>
                                    {finding.evidence.length ? (
                                      <ul className="mt-1 list-disc pl-5 text-xs text-slate-400">
                                        {finding.evidence.map((evidence, evidenceIndex) => (
                                          <li key={`${pack.packageId}:finding:${index}:evidence:${evidenceIndex}`}>
                                            {evidence}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {aiSuggestion.suggestion.recommendedActions.length ? (
                              <div className="space-y-2">
                                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                  Recommended next actions
                                </div>
                                <ul className="list-disc pl-5 text-sm text-slate-300">
                                  {aiSuggestion.suggestion.recommendedActions.map((action, index) => (
                                    <li key={`${pack.packageId}:action:${index}`}>{action}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            <div className="rounded border border-dashed border-sky-400/30 bg-slate-900/70 p-3 space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                  Operator feedback
                                </div>
                                {aiSuggestion.feedback ? (
                                  <Badge variant="outline" className="border-slate-600 bg-slate-950 text-slate-100">
                                    {feedbackOutcomeLabel(aiSuggestion.feedback.outcome)}
                                    {aiSuggestion.feedback.mode === 'automatic' ? ' (auto)' : ''}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-slate-400">
                                    Package and stage moderation actions auto-record followed or overrode when the recommendation clearly maps to the action taken.
                                  </span>
                                )}
                              </div>
                              {!aiSuggestion.feedback ? (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-800 hover:text-white"
                                    disabled={aiFeedbackBusy}
                                    onClick={async () => {
                                      const result = await recordAiFeedbackForPackage(pack, 'accepted', 'manual');
                                      if (result === 'recorded') {
                                        setFeedback({
                                          type: 'success',
                                          message: 'AI feedback recorded as followed.',
                                        });
                                      }
                                    }}
                                  >
                                    Mark Followed
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-800 hover:text-white"
                                    disabled={aiFeedbackBusy}
                                    onClick={async () => {
                                      const result = await recordAiFeedbackForPackage(pack, 'overrode', 'manual');
                                      if (result === 'recorded') {
                                        setFeedback({
                                          type: 'success',
                                          message: 'AI feedback recorded as overrode.',
                                        });
                                      }
                                    }}
                                  >
                                    Mark Overrode
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-800 hover:text-white"
                                    disabled={aiFeedbackBusy}
                                    onClick={async () => {
                                      const result = await recordAiFeedbackForPackage(pack, 'ignored', 'manual');
                                      if (result === 'recorded') {
                                        setFeedback({
                                          type: 'success',
                                          message: 'AI feedback recorded as ignored.',
                                        });
                                      }
                                    }}
                                  >
                                    Mark Ignored
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Model: {aiSuggestion.model || 'Unknown'}
                              {aiSuggestion.usage?.totalTokens ? ` • Tokens: ${aiSuggestion.usage.totalTokens}` : ''}
                              {aiSuggestion.promptVersion ? ` • Prompt: ${aiSuggestion.promptVersion}` : ''}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-white">Advanced stage controls</div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-800 hover:text-white"
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
                      <p className="mt-1 text-xs text-slate-300">
                        Use only when you need stage-specific overrides after a package-level decision.
                      </p>
                    </div>
                    {advancedOpenById[pack.packageId] ? (
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                      {STAGE_ORDER.map((stage) => {
                        const stageVideo = pack.videosByStage[stage];
                        if (!stageVideo) {
                          return (
                            <div key={`${pack.packageId}:${stage}`} className="rounded-lg border border-dashed border-slate-600 bg-slate-950/60 p-3 text-sm text-slate-400">
                              {STAGE_LABELS[stage]} video missing.
                            </div>
                          );
                        }
                        const actionBusy = Boolean(assetActionLoadingId?.startsWith(`${stageVideo.assetId}:`));
                        return (
                          <div
                            key={stageVideo.assetId}
                            className={`rounded-lg border bg-slate-950/70 p-3 space-y-2 ${
                              stage === 'COMPLETED' ? 'border-emerald-400/70 ring-1 ring-emerald-400/20' : 'border-slate-700'
                            }`}
                          >
                            <div className="h-24 rounded border border-slate-700 bg-slate-900 flex items-center justify-center overflow-hidden">
                              {stageVideo.previewRef && stageVideo.mimeType.startsWith('image/') ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={stageVideo.previewRef} alt={stageVideo.title} className="h-full w-full object-cover" />
                              ) : (
                                <Video className="w-6 h-6 text-slate-400" />
                              )}
                            </div>
                            <div className="font-medium text-sm text-white flex flex-wrap items-center gap-2">
                              {STAGE_LABELS[stage]}
                              {stage === 'COMPLETED' ? (
                                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Primary video</Badge>
                              ) : null}
                            </div>
                            <div className="text-sm text-slate-100">{stageVideo.title}</div>
                            <div className="text-xs text-slate-400">
                              Uploaded: {formatModerationTimestamp(stageVideo.createdAt)}
                            </div>
                            <div className="text-xs text-slate-400">
                              Uploader: {stageVideo.employeeName || stageVideo.uploadedByMembershipId || '-'}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="border-slate-600 bg-slate-900 text-slate-100">
                                Moderation: {prettyStatus(stageVideo.moderationStatus)}
                              </Badge>
                              <Badge variant="outline" className="border-slate-600 bg-slate-900 text-slate-100">
                                Visibility:{' '}
                                {VISIBILITY_OPTIONS.find((o) => o.value === visibilityLevelFromAsset(stageVideo.visibilityStatus))
                                  ?.label || stageVideo.visibilityStatus}
                              </Badge>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-800 hover:text-white"
                                onClick={() => setSelectedAsset({ stage, video: stageVideo, pack })}
                              >
                                Details
                              </Button>
                              <AssetModerationControls
                                asset={stageVideo}
                                actionBusy={actionBusy}
                                applyModerationAction={(asset, action, moderationReason) =>
                                  applyModerationAction(asset, action, moderationReason, pack)
                                }
                                openModerationReasonModal={openModerationReasonModal}
                              />
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    ) : null}
                    <div className="text-xs text-slate-400">
                      Package updated: {formatModerationTimestamp(pack.createdAt)}
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
              {assetPlaybackLoading ? (
                <div className="p-3 rounded border bg-gray-50 text-gray-600">Resolving secure media URL...</div>
              ) : null}
              {assetPlaybackError ? (
                <div className="p-3 rounded border border-amber-200 bg-amber-50 text-amber-900">{assetPlaybackError}</div>
              ) : null}
              {assetPlaybackUrl && selectedAsset.video.mimeType.startsWith('video/') && (
                <video className="w-full rounded border bg-black" controls src={assetPlaybackUrl}>
                  Your browser does not support video playback.
                </video>
              )}
              {assetPlaybackUrl && selectedAsset.video.mimeType.startsWith('image/') && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assetPlaybackUrl} alt={selectedAsset.video.title} className="w-full rounded border object-cover max-h-96" />
              )}
              {(selectedAsset.video.adminDownloadRef || selectedAsset.video.downloadRef) && (
                <a
                  className="text-blue-600 underline"
                  href={selectedAsset.video.adminDownloadRef || selectedAsset.video.downloadRef || '#'}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open download-safe link
                </a>
              )}
              {selectedAsset.stage === 'COMPLETED' ? (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <strong>Completed-stage video</strong> — this is the primary service video for the job package.
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
                <div>Created: {formatModerationTimestamp(selectedAsset.video.createdAt)}</div>
                <div>Moderation: {prettyStatus(selectedAsset.video.moderationStatus)}</div>
                <div>Visibility: {prettyStatus(selectedAsset.video.visibilityStatus)}</div>
                <div>Archive: {prettyStatus(selectedAsset.video.archiveStatus)}</div>
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
                  applyModerationAction={(asset, action, moderationReason) =>
                    applyModerationAction(asset, action, moderationReason, selectedAsset.pack)
                  }
                  openModerationReasonModal={openModerationReasonModal}
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
        open={moderationReasonModalOpen}
        onOpenChange={(open) => {
          if (!open) resetModerationReasonModal();
          else setModerationReasonModalOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moderationDialogTitle}</DialogTitle>
            <DialogDescription>{moderationDialogDescription}</DialogDescription>
          </DialogHeader>
          <textarea
            value={moderationReason}
            onChange={(e) => setModerationReason(e.target.value)}
            placeholder={moderationDialogPlaceholder}
            className="w-full min-h-[120px] rounded border border-input px-3 py-2 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={resetModerationReasonModal}>
              Cancel
            </Button>
            <Button
              onClick={submitModerationReason}
              disabled={!moderationReason.trim() || Boolean(assetActionLoadingId) || Boolean(packageActionLoadingId)}
            >
              {moderationSubmitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
