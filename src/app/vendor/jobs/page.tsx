// @ts-nocheck — large vendor jobs surface; strict implicit-any cleanup tracked separately
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Search, Filter, Download, Trash2, Info, Video, Upload, X, MapPin, Shield, AlertTriangle, Edit, MessageSquare, Users, Clock, CheckCircle, Calendar, ChevronDown, ChevronLeft, ChevronRight, Eye, HardDrive } from 'lucide-react';
import Link from 'next/link';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import { runVendorJobMediaUpload, type VendorJobMediaLifecycleState } from '@/lib/vendor-job-media';

// BACKEND DEVELOPER NOTES:
// - Fetch jobs for this vendor from GET /api/vendor/jobs
// - When creating a job, POST to /api/vendor/jobs with job title, client name, phone, email, etc.
// - When uploading media, POST to /api/vendor/jobs/:jobId/media
// - Consent requests should trigger notifications to client (email/SMS) via backend
// - Job status, audit trail, and assigned employees should be persisted in the backend
// - All actions (create, update, upload, approve, reject) should be logged for audit
// - Use vendor authentication/authorization for all API calls
// - NEW: When vendor selects 'At business address', POST geo-coordinates to /api/vendor/validate-location with jobId and expected address. Log all attempts (success/failure, coordinates, IP, timestamp).
// - NEW: Store legal consent text and metadata for each service video creation attempt.
// - NEW: Job status updates should POST to /api/vendor/jobs/:jobId/status
// - NEW: Employee assignments should POST to /api/vendor/jobs/:jobId/assignments
// - NEW: Job notes should POST to /api/vendor/jobs/:jobId/notes

// Mock data
const mockJobs = [
  {
    id: 1,
    title: 'Water Heater Repair',
    client: 'John Smith',
    phone: '(555) 123-4567',
    email: 'john@example.com',
    status: 'in-progress',
    assignedEmployees: ['Mike Johnson'],
    createdAt: '2024-01-15',
    estimatedCompletion: '2024-01-20',
    notes: [
      { id: 1, text: 'Customer requested morning appointment', author: 'Mike Johnson', date: '2024-01-15' },
      { id: 2, text: 'Parts ordered - arriving tomorrow', author: 'Mike Johnson', date: '2024-01-15' }
    ],
    audit: ['Job created on 2024-01-15', 'Assigned to Mike Johnson on 2024-01-15'],
    videos: [
      { id: 3, title: 'Water Heater Diagnosis', url: '/videos/water-heater-diagnosis.mp4', uploadedAt: '2024-01-15', status: 'pending-approval', uploadedBy: 'Mike Johnson' }
    ]
  },
  {
    id: 2,
    title: 'HVAC Maintenance',
    client: 'Sarah Wilson',
    phone: '(555) 987-6543',
    email: 'sarah@example.com',
    status: 'completed',
    assignedEmployees: ['Lisa Chen'],
    createdAt: '2024-01-10',
    completedAt: '2024-01-12',
    notes: [
      { id: 1, text: 'Annual maintenance completed', author: 'Lisa Chen', date: '2024-01-12' },
      { id: 2, text: 'Customer satisfied with service', author: 'Lisa Chen', date: '2024-01-12' }
    ],
    audit: ['Job created on 2024-01-10', 'Completed on 2024-01-12'],
    videos: [
      { id: 1, title: 'Initial Assessment', url: '/videos/hvac-assessment.mp4', uploadedAt: '2024-01-10', status: 'approved', reviewedAt: '2024-01-10T10:30:00Z', reviewedBy: 'Manager', archivedDate: '2024-01-10', approvalMethod: 'manual' },
      { id: 2, title: 'Final Inspection', url: '/videos/hvac-final.mp4', uploadedAt: '2024-01-12', status: 'approved', reviewedAt: '2024-01-12T15:45:00Z', reviewedBy: 'Manager', archivedDate: '2024-01-12', approvalMethod: 'manual' }
    ],
    customerApprovalStatus: 'completed',
    customerApprovalRequestedAt: '2024-01-10T10:30:00Z',
    customerApprovalCompletedAt: '2024-01-10T11:15:00Z',
    customerApprovalWorkflow: {
      status: 'completed',
      initiatedAt: '2024-01-10T10:30:00Z',
      completedAt: '2024-01-10T11:15:00Z',
      videoId: 1,
      approvalMethod: 'manual',
      managerNotes: 'Service completed successfully'
    }
  }
];

const mockEmployees = [
  { id: 1, name: "Mike Johnson", photo: "https://randomuser.me/api/portraits/men/32.jpg" },
  { id: 2, name: "Lisa Chen", photo: "https://randomuser.me/api/portraits/women/44.jpg" },
  { id: 3, name: "David Wilson", photo: "https://randomuser.me/api/portraits/men/45.jpg" },
  { id: 4, name: "Maria Garcia", photo: "https://randomuser.me/api/portraits/women/46.jpg" }
];

const BUSINESS_ADDRESS = { lat: 28.5383, lng: -81.3792 }; // Example: Orlando, FL
const LOCATION_RADIUS_METERS = 100;

// Helper function to calculate distance between two points
const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

const FALLBACK_SERVICE_TYPES = [
  { id: 'fallback-cleaning', name: 'General Cleaning' },
  { id: 'fallback-maintenance', name: 'General Maintenance' },
  { id: 'fallback-installation', name: 'Installation Service' },
  { id: 'fallback-repair', name: 'Repair Service' },
];

const getPhoneDigits = (value: string) => value.replace(/\D/g, '').slice(0, 10);

const formatPhoneNumber = (value: string) => {
  const digits = getPhoneDigits(value);
  const len = digits.length;

  if (len <= 3) return digits;
  if (len <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export default function VendorJobs() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const { data: vendorProfile, loading: vendorProfileLoading } = useVendorProfile();
  // Keep jobs page aligned with active vendor view context used by vendor layout/profile header.
  // This is the same seeded vendor ID passed in vendor layout userData.
  const activeVendorId = 'cmipm4d6v0000sosgqvb8tp63';
  const vendorId = vendorProfile?.id || activeVendorId;
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsLoadError, setJobsLoadError] = useState('');
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [showSelectJobModal, setShowSelectJobModal] = useState(false);
  const [selectedJobForVideoId, setSelectedJobForVideoId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [newJob, setNewJob] = useState({ title: '', client: '', phone: '', email: '', serviceId: '' });
  const [createJobError, setCreateJobError] = useState('');
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [jobFieldErrors, setJobFieldErrors] = useState({
    title: '',
    client: '',
    phone: '',
    email: '',
    serviceId: '',
  });
  const [serviceOptions, setServiceOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesLoadError, setServicesLoadError] = useState('');
  const [usingFallbackServices, setUsingFallbackServices] = useState(false);
  const jobTitleInputRef = useRef<HTMLInputElement | null>(null);
  const clientNameInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const serviceTypeSelectRef = useRef<HTMLSelectElement | null>(null);
  const [newVideo, setNewVideo] = useState<{
    title: string;
    description: string;
    file: File | null;
  }>({ title: "", description: "", file: null });
  const [videoFieldErrors, setVideoFieldErrors] = useState({
    title: '',
    description: '',
    file: '',
  });
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState('');
  const activeUploadKeyRef = useRef<string | null>(null);
  const [uploadLifecycleState, setUploadLifecycleState] = useState<VendorJobMediaLifecycleState>('idle');
  const [search, setSearch] = useState('');
  const [isEmployeeView, setIsEmployeeView] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Bulk selection state
  const [selectedJobIds, setSelectedJobIds] = useState<(string | number)[]>([]);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [showBulkAssignmentModal, setShowBulkAssignmentModal] = useState(false);
  
  // Auto-approval system state
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [showAutoApproveWarning, setShowAutoApproveWarning] = useState(false);
  const [autoApproveSettings, setAutoApproveSettings] = useState({
    enabled: false,
    employeeWhitelist: [] as string[], // Specific employees who can auto-approve
    maxDuration: 300, // Max video duration in seconds (5 minutes)
    requireLocation: true, // Must have valid location
    requireConsent: true, // Must have customer consent
    notifyManager: true, // Send notification to manager after auto-approval
    auditTrail: true // Log all auto-approvals
  });
  
  // Legal compliance state
  const [location, setLocation] = useState('');
  const [showConsent, setShowConsent] = useState(false);
  const [consentStatus, setConsentStatus] = useState('');
  const [customerConsentStatus, setCustomerConsentStatus] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [geoInfo, setGeoInfo] = useState('');
  const [locationVerified, setLocationVerified] = useState(false);
  const [customerConsentRequested, setCustomerConsentRequested] = useState(false);
  const [customerConsentReceived, setCustomerConsentReceived] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  
  // Fraud prevention state
  const [attemptCount, setAttemptCount] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  
  const resetComplianceState = () => {
    setShowConsent(false);
    setConsentStatus('');
    setCustomerConsentStatus('');
    setCustomerConsentRequested(false);
    setCustomerConsentReceived(false);
    setLocationVerified(false);
    setGeoLoading(false);
    setGeoError('');
    setGeoInfo('');
  };

  const getCanContinueCompliance = () => {
    if (location === 'business') return locationVerified;
    if (location === 'residence') return customerConsentRequested && customerConsentReceived;
    if (location === 'customer-business') {
      return customerConsentRequested && customerConsentReceived && locationVerified;
    }
    return false;
  };

  // Enhancement 1: Job Status Management
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  
  // Enhancement 2: Employee Assignment Management
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  
  // Enhancement 3: Job Notes/Comments System
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Video approval system state
  const [showVideoApprovalModal, setShowVideoApprovalModal] = useState(false);
  const [selectedVideoForApproval, setSelectedVideoForApproval] = useState(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [showVideoArchive, setShowVideoArchive] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState('all'); // all, pending, approved, rejected, flagged, archived
  const [archiveDateFilter, setArchiveDateFilter] = useState('');
  const [archiveEmployeeFilter, setArchiveEmployeeFilter] = useState('all');
  const [archiveJobFilter, setArchiveJobFilter] = useState('all');
  const [archiveServiceTypeFilter, setArchiveServiceTypeFilter] = useState('all');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveMediaItems, setArchiveMediaItems] = useState<any[]>([]);
  const [archiveMediaLoading, setArchiveMediaLoading] = useState(false);
  const [archiveMediaError, setArchiveMediaError] = useState('');
  const [archiveActionLoadingId, setArchiveActionLoadingId] = useState<string | null>(null);
  
  // Job archiving system
  const [archivedJobs, setArchivedJobs] = useState([]);
  const [showArchivedJobs, setShowArchivedJobs] = useState(false);
  const [jobArchiveFilter, setJobArchiveFilter] = useState('all'); // all, archived, completed, cancelled
  const [selectedArchiveDate, setSelectedArchiveDate] = useState('');
  const [activeJobActionMenuId, setActiveJobActionMenuId] = useState<string | null>(null);
  const [showJobActionConfirmModal, setShowJobActionConfirmModal] = useState(false);
  const [pendingJobAction, setPendingJobAction] = useState<
    "ARCHIVE_JOB" | "MOVE_CONTENT_TO_ARCHIVE" | "DELETE_PERMANENTLY" | null
  >(null);
  const [jobActionTarget, setJobActionTarget] = useState<any>(null);
  const [jobActionFeedback, setJobActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [jobActionLoading, setJobActionLoading] = useState(false);
  const [deleteImpactPreview, setDeleteImpactPreview] = useState<{
    loading: boolean;
    canVendorDelete: boolean;
    status: string;
    linkedSessionCount: number;
    linkedAssetCount: number;
    message: string;
  } | null>(null);
  const [showCustomerApprovalWorkflow, setShowCustomerApprovalWorkflow] = useState(false);
  const [customerApprovalJob, setCustomerApprovalJob] = useState(null);
  
  // Video details modal state
  const [showVideoDetailsModal, setShowVideoDetailsModal] = useState(false);
  const [selectedVideoForDetails, setSelectedVideoForDetails] = useState(null);
  const [showVideoPlayerModal, setShowVideoPlayerModal] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [playbackTitle, setPlaybackTitle] = useState('');
  const [playbackError, setPlaybackError] = useState('');
  const [resolvingPlaybackId, setResolvingPlaybackId] = useState<string | null>(null);
  
  // Job details modal state
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<any>(null);
  
  // Calendar date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState('');
  const trimmedJobTitle = newJob.title.trim();
  const trimmedClientName = newJob.client.trim();
  const phoneDigits = getPhoneDigits(newJob.phone);
  const trimmedEmail = newJob.email.trim();
  const selectedServiceId = newJob.serviceId.trim();
  const isCreateJobEmailValid = trimmedEmail.includes('@') && trimmedEmail.includes('.');
  const canCreateJob = Boolean(
    trimmedJobTitle &&
    trimmedClientName &&
    phoneDigits.length === 10 &&
    isCreateJobEmailValid &&
    selectedServiceId &&
    serviceOptions.length > 0 &&
    vendorId &&
    !isCreatingJob &&
    !servicesLoading
  );
  const hasSelectedJob = Boolean(selectedJob);
  const trimmedVideoTitle = newVideo.title.trim();
  const trimmedVideoDescription = newVideo.description.trim();
  const hasVideoTitle = Boolean(trimmedVideoTitle);
  const hasVideoDescription = Boolean(trimmedVideoDescription);
  const hasVideoFile = Boolean(newVideo.file);
  const canUploadVideo = Boolean(
    hasSelectedJob &&
    hasVideoTitle &&
    hasVideoDescription &&
    hasVideoFile &&
    vendorId &&
    !isUploadingVideo
  );

  useEffect(() => {
    const loadServiceOptions = async () => {
      if (!vendorId) {
        setServiceOptions([]);
        setUsingFallbackServices(false);
        return;
      }

      setServicesLoading(true);
      setServicesLoadError('');
      try {
        const res = await fetch(`/api/services?vendorId=${encodeURIComponent(String(vendorId))}`, {
          cache: 'no-store',
        });
        const payload = await res.json().catch(() => ({}));
        const services = Array.isArray(payload?.services) ? payload.services : [];
        const normalized = services
          .map((service: any) => ({
            id: String(service?.id ?? ''),
            name: String(service?.name ?? '').trim(),
            vendorId: String(service?.vendor_id ?? service?.vendorId ?? service?.vendor?.id ?? ''),
          }))
          .filter((service: any) => service.id && service.name);

        const vendorScoped = normalized.filter((service: any) => service.vendorId === String(vendorId));
        if (vendorScoped.length > 0) {
          setServiceOptions(vendorScoped.map(({ id, name }: any) => ({ id, name })));
          setUsingFallbackServices(false);
          return;
        }

        // Temporary fallback until vendor-scoped services endpoint is fully wired.
        setServiceOptions(FALLBACK_SERVICE_TYPES);
        setUsingFallbackServices(true);
      } catch (error) {
        // Temporary fallback until vendor-scoped services endpoint is fully wired.
        setServiceOptions(FALLBACK_SERVICE_TYPES);
        setUsingFallbackServices(true);
        setServicesLoadError('Could not load vendor services. Showing fallback service types.');
      } finally {
        setServicesLoading(false);
      }
    };

    loadServiceOptions().catch(() => {
      setServicesLoading(false);
      setServiceOptions(FALLBACK_SERVICE_TYPES);
      setUsingFallbackServices(true);
      setServicesLoadError('Could not load vendor services. Showing fallback service types.');
    });
  }, [vendorId]);

  const getDevAuthHeaders = () => {
    const headers = { 'Content-Type': 'application/json' } as Record<string, string>;
    if (process.env.NODE_ENV === 'development') {
      // Keep dev-safe auth context for protected vendor media routes.
      headers['x-user-id'] = 'D43B6BB3-1A72-45EC-A362-A6E1E0580EA0';
      if (vendorId) headers['x-vendor-id'] = String(vendorId);
    }
    return headers;
  };

  const parseResponsePayload = (rawText: string) => {
    if (!rawText || !rawText.trim()) return null;
    try {
      return JSON.parse(rawText);
    } catch {
      return null;
    }
  };

  const isLikelyPersistedMediaAssetId = (id: unknown) => {
    if (typeof id !== 'string') return false;
    const normalized = id.trim();
    if (!normalized) return false;
    if (normalized.startsWith('blob:') || normalized.startsWith('data:')) return false;
    if (normalized.includes('/')) return false;
    // Support current asset ids (32-char hex), cuid/cuid2, uuid and numeric ids.
    const isHexAssetId = /^[a-f0-9]{32}$/i.test(normalized);
    const isCuidLike = /^c[a-z0-9]{20,}$/i.test(normalized);
    const isUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(normalized);
    const isNumeric = /^\d+$/.test(normalized);
    return isHexAssetId || isCuidLike || isUuid || isNumeric;
  };

  const parseUrlSafely = (value: string) => {
    try {
      if (value.startsWith('blob:') || value.startsWith('data:')) {
        return { protocol: value.split(':')[0] + ':', hostname: '', isSpecial: true };
      }
      const base =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'http://localhost:3000';
      const parsed = new URL(value, base);
      return { protocol: parsed.protocol, hostname: parsed.hostname, isSpecial: false };
    } catch {
      return null;
    }
  };

  const isRealAzureBlobHostUrl = (value: string) => {
    const parsed = parseUrlSafely(value);
    if (!parsed || parsed.isSpecial) return false;
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return parsed.hostname.endsWith('.blob.core.windows.net');
  };

  const isPlayableLocalOrObjectUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return true;
    if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) return true;
    const parsed = parseUrlSafely(trimmed);
    if (!parsed || parsed.isSpecial) return false;
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (parsed.hostname === 'storage.example.com') return false;
    if (isRealAzureBlobHostUrl(trimmed)) return true;
    if (typeof window !== 'undefined' && parsed.hostname === window.location.hostname) return true;
    return false;
  };

  const resolvePlaybackUrl = async (video: any) => {
    const fallbackUrl = typeof video?.url === 'string' && video.url.trim() ? video.url : '';
    const assetId = video?.id ? String(video.id) : '';
    const shouldTrySecureDownload = Boolean(vendorId && assetId && isLikelyPersistedMediaAssetId(assetId));
    let secureDownloadReturnedUrl = false;
    console.info('[Video Playback] resolvePlaybackUrl start', {
      video,
      videoId: assetId,
      videoUrl: fallbackUrl || null,
      persistedAssetClassified: shouldTrySecureDownload,
      attemptedDownloadRoute: false,
    });

    if (shouldTrySecureDownload) {
      try {
        console.info('[Video Playback] resolvePlaybackUrl download attempt', {
          attemptedDownloadRoute: true,
          assetId,
          vendorId,
        });
        const res = await fetch(
          `/api/vendors/${vendorId}/media/${assetId}/download`,
          {
            method: 'GET',
            headers: getDevAuthHeaders(),
          }
        );
        const rawText = await res.text().catch(() => '');
        const parsed = parseResponsePayload(rawText);
        console.info('[Video Playback] resolvePlaybackUrl download response', {
          status: res.status,
          body: rawText || null,
        });
        const secureUrlCandidate = res.ok
          ? (parsed?.downloadUrl ?? parsed?.url ?? '')
          : '';
        const secureUrl = secureUrlCandidate ? String(secureUrlCandidate) : '';
        secureDownloadReturnedUrl = Boolean(secureUrl);

        if (secureUrl && isRealAzureBlobHostUrl(secureUrl)) {
          console.info('[Video Playback] resolvePlaybackUrl', {
            attemptedDownloadRoute: true,
            downloadReturnedUrl: true,
            branch: 'download-route',
          });
          return secureUrl;
        }
      } catch (error) {
        console.error('[Video Playback] secure URL fetch failed', error);
      }
    }

    if (fallbackUrl && isPlayableLocalOrObjectUrl(fallbackUrl)) {
      console.info('[Video Playback] resolvePlaybackUrl', {
        attemptedDownloadRoute: shouldTrySecureDownload,
        downloadReturnedUrl: secureDownloadReturnedUrl,
        branch: 'video-url-fallback',
      });
      return fallbackUrl;
    }

    console.info('[Video Playback] resolvePlaybackUrl', {
      attemptedDownloadRoute: shouldTrySecureDownload,
      downloadReturnedUrl: secureDownloadReturnedUrl,
      branch: 'dev-error',
    });
    throw new Error('Video file is not available for playback in development mode because cloud storage is not configured.');
  };

  const handleWatchVideo = async (video: any) => {
    try {
      const videoId = video?.id ? String(video.id) : 'unknown';
      if (resolvingPlaybackId && resolvingPlaybackId === videoId) {
        return;
      }
      setResolvingPlaybackId(videoId);
      setPlaybackError('');
      const resolvedUrl = await resolvePlaybackUrl(video);
      setPlaybackUrl(resolvedUrl);
      setPlaybackTitle(video?.title || 'Service Video');
      setShowVideoPlayerModal(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open this video.';
      setPlaybackError(message);
      console.error('[Video Playback] watch failed', error);
    } finally {
      setResolvingPlaybackId(null);
    }
  };

  const mapDashboardStatusToJobStatus = (status: string | null | undefined) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'in progress' || normalized === 'in-progress') return 'in-progress';
    if (normalized === 'completed') return 'completed';
    if (normalized === 'canceled' || normalized === 'cancelled') return 'cancelled';
    if (normalized === 'archived') return 'archived';
    if (normalized === 'scheduled' || normalized === 'pending') return 'pending';
    return 'pending';
  };

  const adaptRecentJobToUiJob = (job: any) => {
    const status = mapDashboardStatusToJobStatus(job?.status);
    const isoDate =
      job?.date && !Number.isNaN(new Date(job.date).getTime())
        ? new Date(job.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

    return {
      id: String(job?.id ?? ''),
      bookingId: String(job?.id ?? ''),
      serviceId: job?.serviceId ? String(job.serviceId) : '',
      serviceName: job?.serviceName || '',
      vendorId: String(vendorId || ''),
      title: job?.title || 'Untitled Job',
      client: job?.client || 'Unknown Client',
      clientName: job?.client || 'Unknown Client',
      status,
      createdAt: isoDate,
      estimatedCompletion: null,
      completedAt: status === 'completed' ? isoDate : null,
      phone: '',
      email: '',
      assignedEmployees: [],
      videos: [],
      notes: [],
      audit: [],
      customerApprovalStatus: null,
      customerApprovalRequestedAt: null,
      customerApprovalCompletedAt: null,
      customerApprovalWorkflow: null,
      archivedAt: status === 'archived' ? (job?.date || new Date().toISOString()) : null,
      archiveReason: status === 'archived' ? 'Archived job' : '',
    };
  };
  
  // Memory tracking state
  const [currentMemoryUsage, setCurrentMemoryUsage] = useState(0);
  const [memoryLimit, setMemoryLimit] = useState(1024); // MB
  const [memoryTier, setMemoryTier] = useState('basic'); // basic, pro, enterprise

  // Update memory usage when component mounts or videos change
  useEffect(() => {
    updateMemoryUsage();
  }, [archiveMediaItems]); // Recalculate when archive media changes

  useEffect(() => {
    if (showVideoArchive) {
      fetchArchiveMediaItems().catch(() => {
        setArchiveMediaError("Failed to load media archive");
      });
    }
  }, [showVideoArchive, vendorId, jobs]);

  // Keep selected job detail modal in sync when jobs state updates.
  useEffect(() => {
    if (!selectedJobForDetails) return;
    const refreshed = jobs.find((job) => String(job.id) === String(selectedJobForDetails.id));
    if (refreshed) {
      setSelectedJobForDetails(refreshed);
    }
  }, [jobs, selectedJobForDetails]);

  const hydratePersistedVideos = async (sourceJobs: any[]) => {
    if (!vendorId || !Array.isArray(sourceJobs) || sourceJobs.length === 0) return;

    const mergedJobs = await Promise.all(
      sourceJobs.map(async (job) => {
        const bookingId = String(job.bookingId || job.id);
        try {
          const sessionsRes = await fetch(
            `/api/vendors/${vendorId}/media/sessions?bookingId=${encodeURIComponent(bookingId)}`,
            {
              method: 'GET',
              headers: getDevAuthHeaders(),
            }
          );
          if (!sessionsRes.ok) return job;

          const sessionsJson = await sessionsRes.json().catch(() => ({}));
          const sessions = Array.isArray(sessionsJson?.sessions) ? sessionsJson.sessions : [];
          if (sessions.length === 0) return job;

          const detailResults = await Promise.all(
            sessions.map(async (session: any) => {
              if (!session?.id) return null;
              const detailRes = await fetch(
                `/api/vendors/${vendorId}/media/sessions/${session.id}`,
                {
                  method: 'GET',
                  headers: getDevAuthHeaders(),
                }
              );
              if (!detailRes.ok) return null;
              const detailJson = await detailRes.json().catch(() => ({}));
              return detailJson?.session || null;
            })
          );

          const persistedVideos = detailResults
            .filter(Boolean)
            .flatMap((session: any) => {
              const mediaAssets = Array.isArray(session.mediaAssets) ? session.mediaAssets : [];
              return mediaAssets.map((asset: any) => {
                const moderationStatus = String(asset?.moderationStatus || '').toLowerCase();
                const derivedStatus = ['approved', 'rejected', 'flagged'].includes(moderationStatus)
                  ? moderationStatus
                  : (session.status === 'COMPLETED' ? 'uploaded' : String(session.status || 'uploaded').toLowerCase());
                return ({
                id: asset.id,
                title: session.title || 'Service Video',
                description: session.description || '',
                url: asset.blobUrl || null,
                uploadedAt: asset.createdAt
                  ? new Date(asset.createdAt).toISOString().split('T')[0]
                  : new Date().toISOString().split('T')[0],
                status: derivedStatus,
                visibilityStatus: asset?.visibilityStatus ? String(asset.visibilityStatus) : '',
                moderationStatus: asset?.moderationStatus ? String(asset.moderationStatus) : '',
                moderationReason: asset?.moderationReason ? String(asset.moderationReason) : '',
                moderatedAt: asset?.moderatedAt || null,
                mediaSessionId: session.id,
                mimeType: asset.mimeType || '',
                persisted: true,
              });
              });
            });

          if (persistedVideos.length === 0) return job;

          const existingVideos = Array.isArray(job.videos) ? job.videos : [];
          const byId = new Map<string, any>();
          [...existingVideos, ...persistedVideos].forEach((video: any) => {
            const key = String(video.id);
            byId.set(key, { ...byId.get(key), ...video });
          });

          return {
            ...job,
            videos: Array.from(byId.values()),
          };
        } catch (error) {
          console.error('Failed to hydrate persisted media sessions', error);
          return job;
        }
      })
    );

    setJobs(mergedJobs);
  };

  useEffect(() => {
    const bootstrapJobsFromBackend = async () => {
      if (!vendorId) {
        setJobsLoading(true);
        setJobsLoadError('');
        return;
      }

      setJobsLoading(true);
      setJobsLoadError('');
      try {
        const fetchDashboardOnce = async () => {
          const res = await fetch(`/api/vendors/${vendorId}/dashboard`, {
            method: 'GET',
            headers: getDevAuthHeaders(),
            cache: 'no-store',
          });
          const rawText = await res.text().catch(() => '');
          const parsed = parseResponsePayload(rawText);
          return { res, rawText, parsed };
        };

        let dashboardAttempt = await fetchDashboardOnce();
        if (!dashboardAttempt.res.ok) {
          // One retry for transient backend/database connectivity blips.
          await new Promise((resolve) => setTimeout(resolve, 500));
          dashboardAttempt = await fetchDashboardOnce();
        }

        if (!dashboardAttempt.res.ok) {
          const msg =
            (dashboardAttempt.parsed &&
              (dashboardAttempt.parsed.error ||
                dashboardAttempt.parsed.message ||
                dashboardAttempt.parsed.details)) ||
            dashboardAttempt.rawText ||
            `Failed to load jobs (${dashboardAttempt.res.status})`;
          throw new Error(String(msg));
        }

        const recentJobs = Array.isArray(dashboardAttempt.parsed?.recentJobs)
          ? dashboardAttempt.parsed.recentJobs
          : [];
        const archivedFromApi = Array.isArray(dashboardAttempt.parsed?.archivedJobs)
          ? dashboardAttempt.parsed.archivedJobs
          : [];
        const adaptedJobs = recentJobs.map(adaptRecentJobToUiJob);
        const adaptedArchivedJobs = archivedFromApi.map(adaptRecentJobToUiJob);
        setJobs(adaptedJobs);
        setArchivedJobs(adaptedArchivedJobs);
        await hydratePersistedVideos(adaptedJobs);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load jobs';
        setJobs([]);
        setJobsLoadError(message);
      } finally {
        setJobsLoading(false);
      }
    };

    bootstrapJobsFromBackend().catch(() => {
      setJobsLoading(false);
      setJobsLoadError('Failed to load jobs');
    });
  }, [vendorId]);

  // Filter jobs based on view mode and search
  const filteredJobs = jobs.filter(job => {
    if (String(job.status).toLowerCase() === 'archived') {
      return false;
    }
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesSearch = job.title.toLowerCase().includes(search.toLowerCase()) || 
                         job.client.toLowerCase().includes(search.toLowerCase());
    
    // In employee view, only show jobs assigned to current employee
    if (isEmployeeView) {
      const isAssignedToMe = job.assignedEmployees.includes('Mike Johnson'); // Mock current employee
      return matchesStatus && matchesSearch && isAssignedToMe;
    }
    
    return matchesStatus && matchesSearch;
  });
  const selectedJobForVideo = filteredJobs.find((job) => String(job.id) === selectedJobForVideoId) || null;

  const handleCreateJob = async () => {
    if (isCreatingJob) {
      return;
    }

    const title = newJob.title.trim();
    const client = newJob.client.trim();
    const normalizedPhoneDigits = getPhoneDigits(newJob.phone);
    const formattedPhone = formatPhoneNumber(normalizedPhoneDigits);
    const email = newJob.email.trim();
    const serviceId = newJob.serviceId.trim();
    const selectedService = serviceOptions.find((service) => service.id === serviceId);
    const isValidEmail = email.includes('@') && email.includes('.');
    const nextJobErrors = {
      title: title ? '' : 'Job title is required',
      client: client ? '' : 'Client name is required',
      phone: normalizedPhoneDigits.length === 10 ? '' : 'Valid phone number is required',
      email: isValidEmail ? '' : 'Valid email is required',
      serviceId: serviceId ? '' : 'Service type is required',
    };
    setJobFieldErrors(nextJobErrors);

    if (
      nextJobErrors.title ||
      nextJobErrors.client ||
      nextJobErrors.phone ||
      nextJobErrors.email ||
      nextJobErrors.serviceId
    ) {
      if (nextJobErrors.title) {
        jobTitleInputRef.current?.focus();
      } else if (nextJobErrors.client) {
        clientNameInputRef.current?.focus();
      } else if (nextJobErrors.phone) {
        phoneInputRef.current?.focus();
      } else if (nextJobErrors.email) {
        emailInputRef.current?.focus();
      } else if (nextJobErrors.serviceId) {
        serviceTypeSelectRef.current?.focus();
      }
      return;
    }

    if (!vendorId) {
      setCreateJobError('Vendor context is not ready. Please try again.');
      return;
    }
    setCreateJobError('');
    setIsCreatingJob(true);
    const now = new Date();
    const payload = {
      vendor_id: vendorId,
      user_id: process.env.NODE_ENV === 'development' ? 'D43B6BB3-1A72-45EC-A362-A6E1E0580EA0' : undefined,
      service_id: serviceId,
      title: selectedService?.name ? `${selectedService.name} - ${title}` : title,
      client_name: client,
      client_phone: normalizedPhoneDigits || undefined,
      client_email: email || undefined,
      booking_date: now.toISOString().split('T')[0],
      booking_time: now.toTimeString().split(' ')[0],
      amount: 0,
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: getDevAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const rawText = await res.text().catch(() => '');
      const parsed = parseResponsePayload(rawText);
      if (!res.ok) {
        const message =
          (parsed && (parsed.error || parsed.message || parsed.details)) ||
          rawText ||
          'Failed to create job';
        throw new Error(String(message));
      }

      const booking = parsed?.booking || {};
      const job = {
        id: String(booking.id || Date.now()),
        bookingId: String(booking.id || Date.now()),
        serviceId: String(booking.service_id || serviceId || ''),
        serviceName: selectedService?.name || '',
        vendorId: String(vendorId),
        title: title || booking.title || 'Untitled Job',
        client: client || booking.client_name || 'Unknown Client',
        clientName: client || booking.client_name || 'Unknown Client',
        phone: formattedPhone || '',
        email: email || '',
        status: 'pending',
        assignedEmployees: [],
        createdAt: now.toISOString().split('T')[0],
        notes: [],
        audit: [`Job created on ${new Date().toLocaleDateString()}`],
        videos: []
      };
      setJobs([...jobs, job]);
      setJobsLoadError('');
      setNewJob({ title: '', client: '', phone: '', email: '', serviceId: '' });
      setJobFieldErrors({ title: '', client: '', phone: '', email: '', serviceId: '' });
      setShowCreateJob(false);
    } catch (error) {
      setCreateJobError(error instanceof Error ? error.message : 'Failed to create job');
    } finally {
      setIsCreatingJob(false);
    }
  };

  const handleVideoUpload = async () => {
    if (isUploadingVideo) {
      return;
    }

    const title = newVideo.title.trim();
    const description = newVideo.description.trim();
    const file = newVideo.file;
    const selectedJobSnapshot: any = selectedJob;
    const selectedJobId = selectedJobSnapshot?.id ? String(selectedJobSnapshot.id) : '';
    const uploadKey = `${selectedJobId}:${title}:${file?.name || ''}:${file?.size || 0}`;

    const nextErrors = {
      title: title ? '' : 'Video title is required',
      description: description ? '' : 'Description is required',
      file: file ? '' : 'Video file is required',
    };
    setVideoFieldErrors(nextErrors);

    if (!selectedJob || nextErrors.title || nextErrors.description || nextErrors.file) {
      setVideoUploadError('Please fix the required fields before uploading.');
      return;
    }
    if (activeUploadKeyRef.current === uploadKey) {
      setVideoUploadError('This upload is already in progress for the selected job.');
      return;
    }
    if (!vendorId) {
      // Guard only; UI disables upload until vendor profile is ready.
      return;
    }
    if (!file) {
      return;
    }

    activeUploadKeyRef.current = uploadKey;
    setIsUploadingVideo(true);
    setVideoUploadError('');
    setUploadLifecycleState('idle');

    try {
      const uploadResult = await runVendorJobMediaUpload({
        vendorId: String(vendorId),
        selectedJob: selectedJobSnapshot,
        title,
        description,
        file,
        getHeaders: getDevAuthHeaders,
        onLifecycleState: setUploadLifecycleState,
      });
      const video = uploadResult.video;

      let nextJobsSnapshot: any[] = [];
      setJobs((prev) => {
        const next = prev.map((job) =>
          String(job.id) === selectedJobId
            ? { ...job, videos: [...(job.videos || []), video] }
            : job
        );
        nextJobsSnapshot = next;
        return next;
      });
      await hydratePersistedVideos(nextJobsSnapshot);

      setNewVideo({ title: '', description: '', file: null });
      setVideoFieldErrors({ title: '', description: '', file: '' });
      setShowModal(false);
      setSelectedJob(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Create Service Video] Upload failed', { error: errorMessage });
      console.error('[Create Service Video] Upload failed raw error', error);
      const message = errorMessage || 'Upload failed';
      setVideoUploadError(message);
    } finally {
      setIsUploadingVideo(false);
      setUploadLifecycleState('idle');
      activeUploadKeyRef.current = null;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setNewVideo({ ...newVideo, file });
      setVideoFieldErrors((prev) => ({ ...prev, file: '' }));
      return;
    }
    setNewVideo({ ...newVideo, file: null });
  };

  // Enhancement 1: Job Status Management Functions
  const handleStatusUpdate = (job: any, newStatus: string, reason = "") => {
    const updatedJob = {
      ...job,
      status: newStatus,
      audit: [...job.audit, `Status changed to ${newStatus} on ${new Date().toLocaleDateString()}${reason ? ` - Reason: ${reason}` : ''}`]
    };
    
    if (newStatus === 'completed') {
      updatedJob.completedAt = new Date().toISOString().split('T')[0];
    }
    
    setJobs(jobs.map(j => j.id === job.id ? updatedJob : j));
    setShowStatusModal(false);
    setEditingJob(null);
    setNewStatus('');
    setStatusReason('');
  };

  const openStatusModal = (job: any) => {
    setEditingJob(job);
    setNewStatus(job.status);
    setShowStatusModal(true);
  };

  // Enhancement 2: Employee Assignment Management Functions
  const handleAssignmentUpdate = (job: any, selectedEmployees: string[]) => {
    const updatedJob = {
      ...job,
      assignedEmployees: selectedEmployees,
      audit: [...job.audit, `Employees updated to: ${selectedEmployees.join(', ')} on ${new Date().toLocaleDateString()}`]
    };
    
    setJobs(jobs.map(j => j.id === job.id ? updatedJob : j));
    setShowAssignmentModal(false);
    setSelectedJob(null);
    setSelectedEmployees([]);
  };

  const openAssignmentModal = (job: any) => {
    setSelectedJob(job);
    setSelectedEmployees(job.assignedEmployees || []);
    setShowAssignmentModal(true);
  };

  // Enhancement 3: Job Notes/Comments System Functions
  const handleAddNote = (job: any) => {
    if (newNote.trim()) {
      const note = {
        id: Date.now(),
        text: newNote,
        author: 'You', // TODO: Replace with actual user
        date: new Date().toLocaleDateString()
      };
      
      const updatedJob = {
        ...job,
        notes: [...job.notes, note],
        audit: [...job.audit, `Note added on ${new Date().toLocaleDateString()}`]
      };
      
      setJobs(jobs.map(j => j.id === job.id ? updatedJob : j));
      setNewNote('');
    }
  };

  const handleEditNote = (job: any, noteId: number) => {
    const note = job.notes.find((n: { id: number }) => n.id === noteId);
    setEditingNote(note);
    setEditingNoteText(note.text);
  };

  const handleSaveNoteEdit = (job: any, noteId: number) => {
    const updatedJob = {
      ...job,
      notes: job.notes.map((note: any) => 
        note.id === noteId 
          ? { ...note, text: editingNoteText, date: `${new Date().toLocaleDateString()} (edited)` }
          : note
      ),
      audit: [...job.audit, `Note edited on ${new Date().toLocaleDateString()}`]
    };
    
    setJobs(jobs.map(j => j.id === job.id ? updatedJob : j));
    setEditingNote(null);
    setEditingNoteText('');
  };

  const handleDeleteNote = (job: any, noteId: number) => {
    const updatedJob = {
      ...job,
      notes: job.notes.filter((note: { id: number }) => note.id !== noteId),
      audit: [...job.audit, `Note deleted on ${new Date().toLocaleDateString()}`]
    };
    
    setJobs(jobs.map(j => j.id === job.id ? updatedJob : j));
  };

  const openNotesModal = (job: any) => {
    setSelectedJob(job);
    setShowNotesModal(true);
  };

  // Bulk selection functions
  const toggleBulkMode = () => {
    console.log('Toggle bulk mode clicked, current state:', isBulkMode);
    setIsBulkMode(!isBulkMode);
    if (isBulkMode) {
      setSelectedJobIds([]);
    }
    // Show feedback
    alert(isBulkMode ? 'Exited bulk mode' : 'Entered bulk mode - select jobs to assign');
  };

  const toggleJobSelection = (jobId: string | number) => {
    setSelectedJobIds(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const selectAllJobs = () => {
    setSelectedJobIds(filteredJobs.map(job => job.id));
  };

  const clearSelection = () => {
    setSelectedJobIds([]);
  };

  const handleBulkAssignment = (selectedEmployees: string[]) => {
    setJobs(jobs.map(job => 
      selectedJobIds.includes(job.id)
        ? { 
            ...job, 
            assignedEmployees: selectedEmployees,
            audit: [...job.audit, `Bulk assigned to ${selectedEmployees.join(', ')} on ${new Date().toLocaleDateString()}`]
          }
        : job
    ));
    setSelectedJobIds([]);
    setIsBulkMode(false);
    setShowBulkAssignmentModal(false);
  };

  // Auto-approval functions
  const toggleAutoApprove = () => {
    console.log('Toggle auto-approve clicked, current state:', autoApproveSettings.enabled);
    if (!autoApproveSettings.enabled) {
      setShowAutoApproveWarning(true);
    } else {
      setAutoApproveSettings(prev => ({ ...prev, enabled: false }));
      alert('Auto-approve disabled');
    }
  };

  const confirmAutoApprove = () => {
    setAutoApproveSettings(prev => ({ ...prev, enabled: true }));
    setShowAutoApproveWarning(false);
    
    // Log the auto-approval activation
    console.log('Auto-approval enabled with settings:', autoApproveSettings);
    alert('Auto-approve enabled! Videos will be automatically approved when criteria are met.');
  };

  const handleAutoApproveVideo = (job: any, video: any, employee: string) => {
    // Check if auto-approval conditions are met
    const conditions = {
      employeeWhitelisted: autoApproveSettings.employeeWhitelist.includes(employee) || autoApproveSettings.employeeWhitelist.length === 0,
      durationValid: video.duration <= autoApproveSettings.maxDuration,
      locationValid: autoApproveSettings.requireLocation ? job.locationVerified : true,
      consentValid: autoApproveSettings.requireConsent ? job.customerConsent : true
    };

    const allConditionsMet = Object.values(conditions).every(Boolean);

    if (allConditionsMet) {
      // Auto-approve the video
      const updatedVideo = {
        ...video,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: 'Auto-Approval System',
        autoApproved: true
      };

      setJobs(jobs.map(j => 
        j.id === job.id 
          ? { 
              ...j, 
              videos: j.videos.map((v: any) => v.id === video.id ? updatedVideo : v),
              audit: [...j.audit, `Video "${video.title}" auto-approved for ${employee} on ${new Date().toLocaleDateString()}`]
            }
          : j
      ));

      // Notify manager if enabled
      if (autoApproveSettings.notifyManager) {
        console.log(`Notification sent to manager: Video "${video.title}" auto-approved for ${employee}`);
      }

      return { success: true, video: updatedVideo };
    } else {
      // Log failed auto-approval attempt
      console.log('Auto-approval failed - conditions not met:', conditions);
      return { success: false, conditions };
    }
  };

  const getPendingVideosCount = () => {
    return jobs.reduce((count, job) => {
      return count + job.videos.filter(video => video.status === 'pending-approval').length;
    }, 0);
  };

  // Video approval functions
  const openVideoApproval = (video, job) => {
    setSelectedVideoForApproval({ video, job });
    setShowVideoApprovalModal(true);
    setApprovalReason('');
  };

  const handleVideoApproval = (approved) => {
    if (!selectedVideoForApproval) return;

    const { video, job } = selectedVideoForApproval;
    const updatedVideo = {
      ...video,
      status: approved ? 'approved' : 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Manager', // In real app, get from auth context
      reviewReason: approvalReason,
      archivedDate: new Date().toISOString().split('T')[0], // Archive by date
      approvalMethod: autoApproveSettings.enabled ? 'auto' : 'manual'
    };

    const updatedJob = {
      ...job,
      videos: job.videos.map(v => v.id === video.id ? updatedVideo : v),
      audit: [...job.audit, `Video "${video.title}" ${approved ? 'approved' : 'rejected'} on ${new Date().toLocaleDateString()}`]
    };

    // If approved, trigger customer approval workflow
    if (approved) {
      updatedJob.customerApprovalStatus = 'pending';
      updatedJob.customerApprovalRequestedAt = new Date().toISOString();
      updatedJob.customerApprovalDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72 hours
      updatedJob.customerApprovalWorkflow = {
        status: 'initiated',
        initiatedAt: new Date().toISOString(),
        videoId: video.id,
        approvalMethod: autoApproveSettings.enabled ? 'auto' : 'manual',
        managerNotes: approvalReason
      };
    }

    setJobs(jobs.map(j => j.id === job.id ? updatedJob : j));

    setShowVideoApprovalModal(false);
    setSelectedVideoForApproval(null);
    setApprovalReason('');

    // If approved, show customer approval workflow
    if (approved) {
      setCustomerApprovalJob(updatedJob);
      setShowCustomerApprovalWorkflow(true);
    }
  };

  const normalizeArchiveStatus = (item: any) => {
    const moderationStatus = String(item?.moderationStatus || "").toLowerCase();
    if (moderationStatus === "approved") return "approved";
    if (moderationStatus === "rejected") return "rejected";
    if (moderationStatus === "flagged") return "flagged";

    const sessionStatus = String(item?.sessionStatus || "").toLowerCase();
    if (item?.isArchived || item?.deletedAt) return "archived";
    if (sessionStatus === "approved") return "approved";
    if (sessionStatus === "rejected" || sessionStatus === "failed" || sessionStatus === "cancelled") {
      return "rejected";
    }
    if (sessionStatus === "archived") return "archived";
    return "pending";
  };

  const getFilteredArchiveVideos = () => {
    let videos = [...archiveMediaItems];

    if (archiveFilter !== "all") {
      videos = videos.filter((video) => video.status === archiveFilter);
    }

    if (archiveDateFilter) {
      videos = videos.filter((video) => video.uploadDate === archiveDateFilter);
    }

    if (archiveEmployeeFilter !== "all") {
      videos = videos.filter((video) => String(video.employee || "Unassigned") === archiveEmployeeFilter);
    }

    if (archiveJobFilter !== "all") {
      videos = videos.filter((video) => String(video.jobName) === archiveJobFilter);
    }

    if (archiveServiceTypeFilter !== "all") {
      videos = videos.filter((video) => String(video.serviceType) === archiveServiceTypeFilter);
    }

    if (archiveSearch.trim()) {
      const query = archiveSearch.trim().toLowerCase();
      videos = videos.filter((video) =>
        String(video.title || "").toLowerCase().includes(query) ||
        String(video.jobName || "").toLowerCase().includes(query) ||
        String(video.clientName || "").toLowerCase().includes(query)
      );
    }

    return videos.sort(
      (a, b) =>
        new Date(String(b.createdAt || b.uploadDate || 0)).getTime() -
        new Date(String(a.createdAt || a.uploadDate || 0)).getTime()
    );
  };

  const getArchiveEmployees = () =>
    Array.from(new Set(archiveMediaItems.map((video) => String(video.employee || "Unassigned")))).sort();

  const getArchiveJobNames = () =>
    Array.from(new Set(archiveMediaItems.map((video) => String(video.jobName || "Unknown Job")))).sort();

  const getArchiveServiceTypes = () =>
    Array.from(new Set(archiveMediaItems.map((video) => String(video.serviceType || "General Service")))).sort();

  const getArchiveDates = () =>
    Array.from(new Set(archiveMediaItems.map((video) => String(video.uploadDate || "")).filter(Boolean))).sort().reverse();

  // Video details functions
  const openVideoDetails = (video) => {
    setSelectedVideoForDetails(video);
    setShowVideoDetailsModal(true);
  };

  const openJobDetails = (job) => {
    setSelectedJobForDetails(job);
    setShowJobDetails(true);
    if (!vendorId || !job) return;

    (async () => {
      try {
        const bookingId = String(job.bookingId || job.id);
        const sessionsRes = await fetch(
          `/api/vendors/${vendorId}/media/sessions?bookingId=${encodeURIComponent(bookingId)}`,
          { method: 'GET', headers: getDevAuthHeaders(), cache: 'no-store' }
        );
        if (!sessionsRes.ok) return;
        const sessionsJson = await sessionsRes.json().catch(() => ({}));
        const sessions = Array.isArray(sessionsJson?.sessions) ? sessionsJson.sessions : [];
        if (sessions.length === 0) return;

        const detailResults = await Promise.all(
          sessions.map(async (session: any) => {
            if (!session?.id) return null;
            const detailRes = await fetch(`/api/vendors/${vendorId}/media/sessions/${session.id}`, {
              method: 'GET',
              headers: getDevAuthHeaders(),
              cache: 'no-store',
            });
            if (!detailRes.ok) return null;
            const detailJson = await detailRes.json().catch(() => ({}));
            return detailJson?.session || null;
          })
        );

        const persistedVideos = detailResults
          .filter(Boolean)
          .flatMap((session: any) => {
            const mediaAssets = Array.isArray(session.mediaAssets) ? session.mediaAssets : [];
            return mediaAssets.map((asset: any) => {
              const moderationStatus = String(asset?.moderationStatus || '').toLowerCase();
              const derivedStatus = ['approved', 'rejected', 'flagged'].includes(moderationStatus)
                ? moderationStatus
                : (session.status === 'COMPLETED' ? 'uploaded' : String(session.status || 'uploaded').toLowerCase());
              return {
                id: asset.id,
                title: session.title || 'Service Video',
                description: session.description || '',
                url: asset.blobUrl || null,
                uploadedAt: asset.createdAt
                  ? new Date(asset.createdAt).toISOString().split('T')[0]
                  : new Date().toISOString().split('T')[0],
                status: derivedStatus,
                visibilityStatus: asset?.visibilityStatus ? String(asset.visibilityStatus) : '',
                moderationStatus: asset?.moderationStatus ? String(asset.moderationStatus) : '',
                moderationReason: asset?.moderationReason ? String(asset.moderationReason) : '',
                moderatedAt: asset?.moderatedAt || null,
                mediaSessionId: session.id,
                mimeType: asset.mimeType || '',
                persisted: true,
              };
            });
          });

        if (persistedVideos.length === 0) return;
        const existingVideos = Array.isArray(job.videos) ? job.videos : [];
        const byId = new Map<string, any>();
        [...existingVideos, ...persistedVideos].forEach((video: any) => {
          const key = String(video.id);
          byId.set(key, { ...byId.get(key), ...video });
        });

        const updatedJob = {
          ...job,
          videos: Array.from(byId.values()),
        };
        setJobs((prev) => prev.map((j) => (String(j.id) === String(job.id) ? updatedJob : j)));
        setSelectedJobForDetails(updatedJob);
      } catch (error) {
        console.error('Failed to refresh job details media', error);
      }
    })();
  };

  // Memory tracking functions
  const calculateVideoMemoryUsage = (video) => {
    // Mock calculation - in real app, this would be actual file size
    return Math.floor(Math.random() * 50) + 10; // 10-60 MB per video
  };

  const updateMemoryUsage = () => {
    const totalUsage = archiveMediaItems.reduce((total, video) => {
      const bytes = Number(video?.bytes || 0);
      if (Number.isFinite(bytes) && bytes > 0) {
        return total + bytes / (1024 * 1024);
      }
      return total + calculateVideoMemoryUsage(video);
    }, 0);
    setCurrentMemoryUsage(Math.round(totalUsage));
  };

  // Calendar functions
  const generateCalendarDays = (year, month) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const getVideosForDate = (date) => {
    const dateString = date.toISOString().split('T')[0];
    return archiveMediaItems.filter(video => video.uploadDate === dateString);
  };

  // Legal compliance functions
  const handleGeoLocationCheck = () => {
    setGeoError('');
    setGeoInfo('');
    setGeoLoading(true);
    setLocationVerified(false);
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      setGeoLoading(false);
      return;
    }
    
    // Enhanced fraud prevention
    const startTime = Date.now();
    const userAgent = navigator.userAgent;
    const screenResolution = `${screen.width}x${screen.height}`;
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const accuracy = pos.coords.accuracy;
        const timestamp = pos.timestamp;
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Mock backend validation with enhanced security
        const dist = getDistanceMeters(latitude, longitude, BUSINESS_ADDRESS.lat, BUSINESS_ADDRESS.lng);
        
        // Enhanced validation checks
        const isValidLocation = dist <= LOCATION_RADIUS_METERS;
        const isGoodAccuracy = accuracy <= 50;
        const isAcceptableAccuracy = accuracy <= 150;
        const isValidResponseTime = responseTime > 100 && responseTime < 10000; // Prevent spoofing
        const isDevBypass = isDevelopment;
        
        if ((isValidLocation && isValidResponseTime && isAcceptableAccuracy) || isDevBypass) {
          setGeoError('');
          if (isDevBypass) {
            setGeoInfo('Development mode: location accepted without strict validation');
          } else if (!isGoodAccuracy) {
            setGeoInfo('Location verified. GPS accuracy is weaker than ideal, but acceptable for this step.');
          }
          setGeoLoading(false);
          setLocationVerified(true);
          
          // Log successful verification with full metadata
          const verificationData = {
            jobId: selectedJob?.id,
            vendorId: 'current-vendor-id', // From auth context
            latitude,
            longitude,
            accuracy,
            distance: dist,
            timestamp,
            responseTime,
            userAgent,
            screenResolution,
            ipAddress: 'logged-server-side',
            deviceId: 'logged-server-side',
            verificationMethod: 'gps',
            success: true,
            developmentBypass: isDevBypass
          };
          
          // POST to backend for logging
          console.log('Location verification successful:', verificationData);
          
          setShowConsent(true);
          setConsentStatus('granted');
        } else {
          let errorMessage = 'Location verification failed. ';
          if (!isValidLocation) errorMessage += 'You are not at the registered business address. ';
          if (!isAcceptableAccuracy) errorMessage += 'GPS accuracy is too weak; move to an open area and try again. ';
          if (!isValidResponseTime) errorMessage += 'Response time indicates potential spoofing. ';
          errorMessage += 'Please try again at the correct location or contact support.';
          
          setGeoError(errorMessage);
          setGeoLoading(false);
          
          // Log failed attempt
          const failedAttempt = {
            jobId: selectedJob?.id,
            vendorId: 'current-vendor-id',
            latitude,
            longitude,
            accuracy,
            distance: dist,
            timestamp,
            responseTime,
            userAgent,
            screenResolution,
            ipAddress: 'logged-server-side',
            deviceId: 'logged-server-side',
            verificationMethod: 'gps',
            success: false,
            failureReason: {
              invalidLocation: !isValidLocation,
              invalidAccuracy: !isAcceptableAccuracy,
              invalidResponseTime: !isValidResponseTime
            }
          };
          
          console.log('Location verification failed:', failedAttempt);
        }
      },
      (err) => {
        const errorMessage = `Unable to retrieve your location (Error: ${err.code}). Please enable location services and try again.`;
        setGeoError(errorMessage);
        setGeoLoading(false);
        
        // Log geolocation error
        const errorData = {
          jobId: selectedJob?.id,
          vendorId: 'current-vendor-id',
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          screenResolution: `${screen.width}x${screen.height}`,
          ipAddress: 'logged-server-side',
          deviceId: 'logged-server-side',
          verificationMethod: 'gps',
          success: false,
          errorCode: err.code,
          errorMessage: err.message
        };
        
        console.log('Geolocation error:', errorData);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleRequestCustomerConsent = () => {
    setCustomerConsentRequested(true);
    setCustomerConsentReceived(false);
    setCustomerConsentStatus('pending');
    
    // Enhanced consent request with fraud prevention
    const consentRequestData = {
      jobId: selectedJob?.id,
      vendorId: 'current-vendor-id',
      customerEmail: selectedJob?.email,
      customerPhone: selectedJob?.phone,
      requestType: location === 'residence' ? 'residential_recording' : 'business_recording',
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      ipAddress: 'logged-server-side',
      deviceId: 'logged-server-side',
      consentToken: `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    // Mock backend consent request with enhanced security
    setTimeout(() => {
      setCustomerConsentStatus('granted');
      setCustomerConsentReceived(true);
      
      // Log successful consent
      const consentData = {
        ...consentRequestData,
        consentGranted: true,
        consentTimestamp: Date.now(),
        consentMethod: 'email_link', // or 'sms', 'in_person'
        legalTextVersion: 'v1.2.3', // Version of legal text shown
        customerIpAddress: 'logged-server-side',
        customerDeviceInfo: 'logged-server-side'
      };
      
      console.log('Customer consent granted:', consentData);
    }, 2000);
  };

  const handleContinue = () => {
    // Enhanced validation before proceeding
    if (!selectedJob) {
      console.error('No job selected for video creation');
      return;
    }
    
    if (!location) {
      console.error('No location type selected');
      return;
    }

    if (!getCanContinueCompliance()) {
      if (location === 'business') {
        setGeoError('Please verify your location before continuing.');
      } else if (location === 'residence') {
        setGeoError('Customer consent must be requested and received before continuing.');
      } else if (location === 'customer-business') {
        setGeoError('Customer consent and location verification are both required before continuing.');
      }
      return;
    }
    
    // Enhanced fraud prevention checks
    const now = Date.now();
    const timeSinceLastAttempt = now - lastAttemptTime;
    
    // Rate limiting: Max 3 attempts per minute
    if (timeSinceLastAttempt < 60000 && attemptCount >= 3) {
      setIsBlocked(true);
      setBlockReason('Too many attempts. Please wait 1 minute before trying again.');
      console.warn('Rate limit exceeded for vendor compliance checks');
      return;
    }
    
    // Reset attempt count if more than 1 minute has passed
    if (timeSinceLastAttempt > 60000) {
      setAttemptCount(0);
    }
    
    // Increment attempt count
    setAttemptCount(prev => prev + 1);
    setLastAttemptTime(now);
    
    // Log the compliance flow initiation with enhanced security
    const complianceFlowData = {
      jobId: selectedJob.id,
      vendorId: 'current-vendor-id',
      locationType: location,
      timestamp: now,
      userAgent: navigator.userAgent,
      ipAddress: 'logged-server-side',
      deviceId: 'logged-server-side',
      sessionId: 'logged-server-side',
      attemptCount: attemptCount + 1,
      timeSinceLastAttempt,
      isBlocked: false,
      securityChecks: {
        hasValidSession: true, // From auth context
        isAuthenticated: true, // From auth context
        hasValidPermissions: true, // From auth context
        deviceTrusted: true, // From device fingerprinting
        ipTrusted: true, // From IP reputation check
        noSuspiciousActivity: true // From behavioral analysis
      }
    };
    
    console.log('Compliance flow initiated:', complianceFlowData);
    
    // Additional security validation
    if (complianceFlowData.securityChecks.noSuspiciousActivity === false) {
      setIsBlocked(true);
      setBlockReason('Suspicious activity detected. Your account has been temporarily blocked for security review.');
      console.error('Suspicious activity detected in compliance flow');
      return;
    }
    
    // Close compliance modal and open video upload modal
    setShowComplianceModal(false);
    if (!selectedJob) {
      setGeoError('Please select a job before continuing to video upload.');
      return;
    }
    setShowModal(true);
    
    // Log successful compliance completion
    console.log('Compliance completed successfully, opening video upload modal');
    alert('Compliance completed! Opening video upload modal.');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'flagged': return 'bg-purple-100 text-purple-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'archived': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatJobStatusLabel = (status: string | null | undefined) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized) return 'Job: Pending';
    const pretty = normalized
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `Job: ${pretty}`;
  };

  const getVideoModerationState = (video: any): 'rejected' | 'flagged' | 'pending_review' | 'approved' | null => {
    const moderationStatus = String(video?.moderationStatus || '').trim().toLowerCase();
    const fallbackStatus = String(video?.status || '').trim().toLowerCase();
    const status = moderationStatus || fallbackStatus;
    if (status === 'rejected') return 'rejected';
    if (status === 'flagged') return 'flagged';
    if (status === 'approved') return 'approved';
    if (
      status === 'pending_review' ||
      status === 'pending' ||
      status === 'uploaded' ||
      status === 'uploading' ||
      status === 'completed'
    ) {
      return 'pending_review';
    }
    return null;
  };

  const getJobMediaModerationSummary = (job: any) => {
    const videos = Array.isArray(job?.videos) ? job.videos : [];
    if (videos.length === 0) return null;
    const states = videos
      .map((video: any) => getVideoModerationState(video))
      .filter(Boolean) as Array<'rejected' | 'flagged' | 'pending_review' | 'approved'>;
    if (states.length === 0) return null;
    const priority: Array<'rejected' | 'flagged' | 'pending_review' | 'approved'> = [
      'rejected',
      'flagged',
      'pending_review',
      'approved',
    ];
    const top = priority.find((state) => states.includes(state)) || 'pending_review';
    const labelMap: Record<string, string> = {
      rejected: 'Media: Rejected',
      flagged: 'Media: Flagged',
      pending_review: 'Media: Pending Review',
      approved: 'Media: Approved',
    };
    const colorMap: Record<string, string> = {
      rejected: 'bg-red-100 text-red-800',
      flagged: 'bg-purple-100 text-purple-800',
      pending_review: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
    };
    return {
      status: top,
      label: labelMap[top],
      className: colorMap[top],
    };
  };

  const moderationUpdateCount = jobs.reduce((count, job: any) => {
    const videos = Array.isArray(job?.videos) ? job.videos : [];
    return (
      count +
      videos.filter((video: any) => {
        const state = getVideoModerationState(video);
        return state === 'approved' || state === 'rejected' || state === 'flagged';
      }).length
    );
  }, 0);

  const handleOpenSelectJobModal = () => {
    setSelectedJobForVideoId('');
    setShowSelectJobModal(true);
  };

  const handleContinueWithSelectedJob = () => {
    if (!selectedJobForVideo) {
      return;
    }
    setSelectedJob(selectedJobForVideo);
    setShowSelectJobModal(false);
    setShowComplianceModal(true);
  };

  const fetchArchiveMediaItems = async () => {
    if (!vendorId) return;
    setArchiveMediaLoading(true);
    setArchiveMediaError("");
    try {
      const [assetsRes, sessionsRes] = await Promise.all([
        fetch(`/api/vendors/${vendorId}/media?includeDeleted=true`, {
          method: "GET",
          headers: getDevAuthHeaders(),
          cache: "no-store",
        }),
        fetch(`/api/vendors/${vendorId}/media/sessions`, {
          method: "GET",
          headers: getDevAuthHeaders(),
          cache: "no-store",
        }),
      ]);

      const assetsJson = await assetsRes.json().catch(() => ({}));
      const sessionsJson = await sessionsRes.json().catch(() => ({}));
      if (!assetsRes.ok) {
        throw new Error(assetsJson?.error || assetsJson?.message || "Failed to load media assets");
      }
      if (!sessionsRes.ok) {
        throw new Error(sessionsJson?.error || sessionsJson?.message || "Failed to load media sessions");
      }

      const assets = Array.isArray(assetsJson?.assets) ? assetsJson.assets : [];
      const sessions = Array.isArray(sessionsJson?.sessions) ? sessionsJson.sessions : [];
      const sessionsById = new Map(sessions.map((session: any) => [String(session.id), session]));
      const jobsByBookingId = new Map(
        jobs.map((job: any) => [String(job.bookingId || job.id), job])
      );

      const items = assets.map((asset: any) => {
        const sessionId = asset?.mediaSessionId ? String(asset.mediaSessionId) : "";
        const session = sessionId ? sessionsById.get(sessionId) : null;
        const bookingId = session?.bookingId ? String(session.bookingId) : "";
        const relatedJob = bookingId ? jobsByBookingId.get(bookingId) : null;

        const item = {
          id: String(asset.id),
          title: session?.title || "Service Video",
          description: session?.description || "",
          jobName: relatedJob?.title || "Unknown Job",
          clientName: relatedJob?.client || "Unknown Client",
          employee:
            relatedJob?.assignedEmployees?.[0] ||
            (session?.employeeId ? `Employee ${String(session.employeeId).slice(0, 6)}` : "Unassigned"),
          uploadDate: asset?.createdAt
            ? new Date(asset.createdAt).toISOString().split("T")[0]
            : "",
          status: "pending",
          createdAt: asset?.createdAt,
          bytes: asset?.bytes || "0",
          mimeType: asset?.mimeType || "",
          blobKey: asset?.blobKey || "",
          blobUrl: asset?.blobUrl || null,
          moderationStatus: String(asset?.moderationStatus || ""),
          visibilityStatus: String(asset?.visibilityStatus || ""),
          archiveStatus: String(asset?.archiveStatus || ""),
          moderationReason: asset?.moderationReason ? String(asset.moderationReason) : "",
          moderatedAt: asset?.moderatedAt || null,
          sessionId,
          sessionStatus: String(session?.status || "CREATED").toUpperCase(),
          bookingId,
          serviceId: session?.serviceId ? String(session.serviceId) : "",
          serviceType: relatedJob?.serviceName || "General Service",
          isArchived: Boolean(asset?.deletedAt) || String(session?.status || "").toUpperCase() === "ARCHIVED",
          deletedAt: asset?.deletedAt || null,
        };
        return { ...item, status: normalizeArchiveStatus(item) };
      });

      setArchiveMediaItems(items);
    } catch (error) {
      setArchiveMediaError(error instanceof Error ? error.message : "Failed to load media archive");
      setArchiveMediaItems([]);
    } finally {
      setArchiveMediaLoading(false);
    }
  };

  const updateMediaItemSessionStatus = async (item: any, nextStatus: "APPROVED" | "REJECTED" | "ARCHIVED") => {
    if (!vendorId || !item?.sessionId) {
      throw new Error("Media session is required for this action.");
    }
    const res = await fetch(`/api/vendors/${vendorId}/media/sessions/${item.sessionId}`, {
      method: "PATCH",
      headers: getDevAuthHeaders(),
      body: JSON.stringify({ status: nextStatus }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || payload?.message || `Failed to update media status (${res.status})`);
    }
    return payload;
  };

  const handleArchiveMediaItemAction = async (
    item: any,
    action: "approve" | "reject" | "archive" | "restore" | "delete"
  ) => {
    if (!vendorId) return;
    setArchiveActionLoadingId(`${action}:${item.id}`);
    setArchiveMediaError("");
    try {
      if (action === "approve") {
        await updateMediaItemSessionStatus(item, "APPROVED");
      } else if (action === "reject") {
        await updateMediaItemSessionStatus(item, "REJECTED");
      } else if (action === "archive") {
        if (item.sessionId) {
          await updateMediaItemSessionStatus(item, "ARCHIVED");
        }
        await fetch(`/api/vendors/${vendorId}/media/${item.id}`, {
          method: "DELETE",
          headers: getDevAuthHeaders(),
        });
      } else if (action === "restore") {
        await fetch(`/api/vendors/${vendorId}/media/${item.id}`, {
          method: "PATCH",
          headers: getDevAuthHeaders(),
          body: JSON.stringify({ action: "RESTORE" }),
        });
        if (item.sessionId) {
          await updateMediaItemSessionStatus(item, "COMPLETED");
        }
      } else if (action === "delete") {
        const deleteRes = await fetch(`/api/vendors/${vendorId}/media/${item.id}`, {
          method: "DELETE",
          headers: getDevAuthHeaders(),
        });
        if (!deleteRes.ok) {
          const payload = await deleteRes.json().catch(() => ({}));
          throw new Error(payload?.error || payload?.message || "Failed to delete media asset");
        }
      }

      await fetchArchiveMediaItems();
    } catch (error) {
      setArchiveMediaError(error instanceof Error ? error.message : "Failed to update media item");
    } finally {
      setArchiveActionLoadingId(null);
    }
  };

  // Get available employees (those without assigned jobs)
  const getAvailableEmployees = () => {
    const assignedEmployees = new Set();
    jobs.forEach(job => {
      if (job.assignedEmployees) {
        job.assignedEmployees.forEach(emp => assignedEmployees.add(emp));
      }
    });
    
    return mockEmployees.filter(emp => !assignedEmployees.has(emp.name));
  };

  // Persisted job action functions
  const runPersistedJobAction = async (
    job: any,
    action: "ARCHIVE_JOB" | "MOVE_CONTENT_TO_ARCHIVE" | "UNARCHIVE_JOB"
  ) => {
    if (!vendorId) {
      throw new Error("Vendor context is not ready");
    }

    const res = await fetch(`/api/vendors/${vendorId}/jobs/${encodeURIComponent(String(job.id))}/actions`, {
      method: "PATCH",
      headers: getDevAuthHeaders(),
      body: JSON.stringify({ action }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || payload?.message || `Job action failed (${res.status})`);
    }
    return payload;
  };

  const archiveJob = async (job: any) => {
    const payload = await runPersistedJobAction(job, "ARCHIVE_JOB");
    const archivedJob = {
      ...job,
      status: "archived",
      archivedAt: new Date().toISOString(),
      archiveReason: "Manually archived",
    };
    setArchivedJobs((prev) => [archivedJob, ...prev.filter((j) => String(j.id) !== String(job.id))]);
    setJobs((prev) => prev.filter((j) => String(j.id) !== String(job.id)));
    return payload;
  };

  const moveContentToArchive = async (job: any) => {
    const payload = await runPersistedJobAction(job, "MOVE_CONTENT_TO_ARCHIVE");
    setJobs((prev) =>
      prev.map((j) =>
        String(j.id) === String(job.id)
          ? {
              ...j,
              videos: Array.isArray(j.videos)
                ? j.videos.map((video: any) => ({ ...video, archived: true }))
                : [],
              audit: [...(j.audit || []), `Job content moved to archive on ${new Date().toLocaleDateString()}`],
            }
          : j
      )
    );
    return payload;
  };

  const unarchiveJob = async (archivedJob: any) => {
    await runPersistedJobAction(archivedJob, "UNARCHIVE_JOB");
    const restoredJob = {
      ...archivedJob,
      status: "pending",
      archivedAt: undefined,
      archiveReason: undefined,
    };

    setJobs((prev) => [restoredJob, ...prev.filter((j) => String(j.id) !== String(restoredJob.id))]);
    setArchivedJobs((prev) => prev.filter((j) => String(j.id) !== String(archivedJob.id)));
  };

  const deleteJobPermanently = async (job: any) => {
    if (!vendorId) {
      throw new Error("Vendor context is not ready");
    }
    const res = await fetch(`/api/vendors/${vendorId}/jobs/${encodeURIComponent(String(job.id))}/actions`, {
      method: "DELETE",
      headers: getDevAuthHeaders(),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || payload?.message || `Delete failed (${res.status})`);
    }
    setJobs((prev) => prev.filter((j) => String(j.id) !== String(job.id)));
    setArchivedJobs((prev) => prev.filter((j) => String(j.id) !== String(job.id)));
    return payload;
  };

  const getFilteredArchivedJobs = () => {
    let filtered = archivedJobs;
    
    if (jobArchiveFilter !== 'all') {
      filtered = filtered.filter(job => job.status === jobArchiveFilter);
    }
    
    return filtered.sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
  };

  // Enhanced job approval with archiving
  const handleJobApproval = (job, approved, reason = '') => {
    const updatedJob = {
      ...job,
      status: approved ? 'completed' : 'cancelled',
      approvedAt: new Date().toISOString(),
      approvalReason: reason,
      audit: [...job.audit, `Job ${approved ? 'approved' : 'rejected'} on ${new Date().toLocaleDateString()}${reason ? ` - Reason: ${reason}` : ''}`]
    };

    setJobs(jobs.map(j => j.id === job.id ? updatedJob : j));

    // Auto-archive completed jobs after approval
    if (approved) {
      setTimeout(() => {
        archiveJob(updatedJob).catch((error) => {
          console.error('Auto-archive failed after approval', error);
          setJobActionFeedback({
            type: 'error',
            message: error instanceof Error ? error.message : 'Failed to archive approved job',
          });
        });
      }, 2000); // Archive after 2 seconds to show completion
    }
  };

  const openJobActionConfirm = (
    job: any,
    action: "ARCHIVE_JOB" | "MOVE_CONTENT_TO_ARCHIVE" | "DELETE_PERMANENTLY"
  ) => {
    setJobActionTarget(job);
    setPendingJobAction(action);
    setShowJobActionConfirmModal(true);
    setActiveJobActionMenuId(null);
    if (action === "DELETE_PERMANENTLY" && vendorId) {
      setDeleteImpactPreview({
        loading: true,
        canVendorDelete: false,
        status: String(job?.status || "").toUpperCase(),
        linkedSessionCount: 0,
        linkedAssetCount: 0,
        message: "Checking linked content...",
      });
      fetch(`/api/vendors/${vendorId}/jobs/${encodeURIComponent(String(job.id))}/actions`, {
        method: "GET",
        headers: getDevAuthHeaders(),
      })
        .then(async (res) => {
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(payload?.error || payload?.message || "Failed to check delete safety");
          }
          setDeleteImpactPreview({
            loading: false,
            canVendorDelete: Boolean(payload?.canVendorDelete),
            status: String(payload?.status || ""),
            linkedSessionCount: Number(payload?.linkedSessionCount || 0),
            linkedAssetCount: Number(payload?.linkedAssetCount || 0),
            message: String(payload?.message || ""),
          });
        })
        .catch((error) => {
          setDeleteImpactPreview({
            loading: false,
            canVendorDelete: false,
            status: String(job?.status || "").toUpperCase(),
            linkedSessionCount: 0,
            linkedAssetCount: 0,
            message: error instanceof Error ? error.message : "Failed to check linked content",
          });
        });
    } else {
      setDeleteImpactPreview(null);
    }
  };

  const executeConfirmedJobAction = async () => {
    if (!jobActionTarget || !pendingJobAction || jobActionLoading) return;
    setJobActionLoading(true);
    setJobActionFeedback(null);
    try {
      if (pendingJobAction === "ARCHIVE_JOB") {
        const payload = await archiveJob(jobActionTarget);
        setJobActionFeedback({ type: "success", message: payload?.message || "Job archived successfully." });
      } else if (pendingJobAction === "MOVE_CONTENT_TO_ARCHIVE") {
        const payload = await moveContentToArchive(jobActionTarget);
        setJobActionFeedback({
          type: "success",
          message: payload?.message || "Job content moved to archive successfully.",
        });
      } else if (pendingJobAction === "DELETE_PERMANENTLY") {
        const payload = await deleteJobPermanently(jobActionTarget);
        setJobActionFeedback({ type: "success", message: payload?.message || "Job permanently deleted." });
      }
      setShowJobActionConfirmModal(false);
      setPendingJobAction(null);
      setJobActionTarget(null);
      setDeleteImpactPreview(null);
    } catch (error) {
      setJobActionFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to execute job action",
      });
    } finally {
      setJobActionLoading(false);
    }
  };

  const pendingJobActionTitle =
    pendingJobAction === "ARCHIVE_JOB"
      ? "Archive Job"
      : pendingJobAction === "MOVE_CONTENT_TO_ARCHIVE"
      ? "Move Content to Archive"
      : pendingJobAction === "DELETE_PERMANENTLY"
      ? "Delete Permanently"
      : "Confirm Action";

  const pendingJobActionDescription = (() => {
    if (pendingJobAction === "ARCHIVE_JOB") {
      return "This will move the job out of active jobs and keep it in Archived Jobs.";
    }
    if (pendingJobAction === "MOVE_CONTENT_TO_ARCHIVE") {
      return "This will archive media/content tied to this job and keep the job itself.";
    }
    if (pendingJobAction === "DELETE_PERMANENTLY") {
      if (deleteImpactPreview?.loading) {
        return "Checking whether this job can be deleted safely...";
      }
      if (deleteImpactPreview?.status === "COMPLETED") {
        return "Completed jobs cannot be deleted by vendors. Please contact an admin if further action is needed.";
      }
      if ((deleteImpactPreview?.linkedSessionCount || 0) > 0) {
        return "This job has linked media. Deleting this job will also archive related media/session records so nothing is orphaned.";
      }
      return "Are you sure you want to permanently delete this job?";
    }
    return "Please confirm this job action.";
  })();

  return (
    <div className="px-4 md:px-8 py-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      {/* Enhanced Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-full">
            <Info className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">Welcome to Job Management</h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              Manage all your jobs efficiently. Click <strong>Create Job</strong> to add a new job, or use <strong>Create Service Video</strong> to upload progress. 
              Hover over any <Info className="inline w-4 h-4 align-text-bottom" /> for detailed help.
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/vendor">
            <Button variant="outline" size="lg" className="bg-white hover:bg-gray-50 shadow-md">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold text-gray-800">
              {isEmployeeView ? 'My Assigned Jobs' : 'Manage Jobs'}
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {isEmployeeView ? 'View and manage your assigned service jobs' : 'Create, track, and manage all your service jobs'}
            </p>
          </div>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">View Mode:</span>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setIsEmployeeView(false)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                !isEmployeeView 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Manager
            </button>
            <button
              onClick={() => setIsEmployeeView(true)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                isEmployeeView 
                  ? 'bg-white text-green-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Employee
            </button>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 min-w-0 search-input-container">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder={isEmployeeView ? "Search my jobs..." : "Search jobs by title or client..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 border-2 border-gray-200 rounded-lg w-full min-w-0"
              style={{ minWidth: '280px' }}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none px-4 py-2 pr-10 border-2 border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
            >
              <option value="all">{isEmployeeView ? 'All My Jobs' : 'All Status'}</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          
          {!isEmployeeView && (
            <>
              <Button 
                onClick={() => {
                  if (isBulkMode && selectedJobIds.length > 0) {
                    setShowBulkAssignmentModal(true);
                  } else {
                    toggleBulkMode();
                  }
                }} 
                className={`action-button ${isBulkMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              >
                <Users className="w-5 h-5 mr-2" />
                {isBulkMode ? (selectedJobIds.length > 0 ? `Assign ${selectedJobIds.length}` : 'Exit Bulk Mode') : 'Bulk Assign'}
              </Button>
              <Button 
                onClick={() => {
                  console.log('Create Job button clicked');
                  setShowCreateJob(true);
                  alert('Opening Create Job modal...');
                }} 
                className="action-button bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Job
              </Button>
              <Button 
                onClick={() => {
                  handleOpenSelectJobModal();
                }} 
                className="action-button bg-green-600 hover:bg-green-700"
              >
                <Video className="w-5 h-5 mr-2" />
                Create Service Video
              </Button>
              <Button 
                onClick={toggleAutoApprove}
                className={`action-button ${autoApproveSettings.enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                {autoApproveSettings.enabled ? 'Disable Auto-Approve' : 'Auto-Approve'}
              </Button>
              <Button 
                onClick={() => setShowVideoArchive(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Video className="w-5 h-5 mr-2" />
                Content Archive
              </Button>
              <Button 
                onClick={() => setShowArchivedJobs(!showArchivedJobs)}
                className={`${showArchivedJobs ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              >
                <HardDrive className="w-5 h-5 mr-2" />
                {showArchivedJobs ? 'Hide Archived' : `Archived Jobs (${archivedJobs.length})`}
              </Button>
            </>
          )}
        </div>
      </div>

      {!isEmployeeView && moderationUpdateCount > 0 && (
        <div className="mb-6 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-indigo-900">
            You have {moderationUpdateCount} media moderation update{moderationUpdateCount === 1 ? '' : 's'}.
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-indigo-300 text-indigo-700 hover:bg-indigo-100"
            onClick={() => setShowVideoArchive(true)}
          >
            Review in Content Archive
          </Button>
        </div>
      )}

      {/* Content Archive Modal */}
      <Dialog open={showVideoArchive} onOpenChange={setShowVideoArchive}>
        <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Content Archive
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {/* Archive Filters */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 video-archive-filters">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <Input
                  placeholder="Search by video title, job, or client"
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
                <select
                  value={archiveFilter}
                  onChange={(e) => setArchiveFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg appearance-none bg-white video-archive-dropdown"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="flagged">Flagged</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Filter</label>
                <div className="relative">
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="w-full p-2 pr-10 border border-gray-300 rounded-lg appearance-none bg-white text-left flex items-center justify-between"
                  >
                    <span className={archiveDateFilter ? 'text-gray-900' : 'text-gray-500'}>
                      {archiveDateFilter ? new Date(archiveDateFilter).toLocaleDateString() : 'Select Date'}
                    </span>
                    <Calendar className="w-4 h-4 text-gray-400" />
                  </button>
                  
                  {showDatePicker && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-4" style={{ minWidth: '450px', width: 'max-content' }}>
                      <div className="flex items-center justify-between mb-3" style={{ minWidth: '350px', width: '100%' }}>
                        <button
                          onClick={() => {
                            const currentDate = new Date(selectedCalendarDate || Date.now());
                            const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
                            setSelectedCalendarDate(prevMonth.toISOString().split('T')[0]);
                          }}
                          className="p-2 hover:bg-gray-100 rounded flex items-center justify-center bg-white border"
                          style={{ minWidth: '45px', height: '35px' }}
                        >
                          <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <span className="font-medium text-center flex-1 px-4">
                          {new Date(selectedCalendarDate || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => {
                            const currentDate = new Date(selectedCalendarDate || Date.now());
                            const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
                            setSelectedCalendarDate(nextMonth.toISOString().split('T')[0]);
                          }}
                          className="p-2 hover:bg-gray-100 rounded flex items-center justify-center bg-white border"
                          style={{ minWidth: '45px', height: '35px' }}
                        >
                          <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-7 gap-3 text-xs mb-2 video-archive-calendar">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} className="text-center text-gray-500 font-medium p-1">
                            {day}
                          </div>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-7 gap-3 video-archive-calendar">
                        {generateCalendarDays(
                          new Date(selectedCalendarDate || Date.now()).getFullYear(),
                          new Date(selectedCalendarDate || Date.now()).getMonth()
                        ).map((day, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              if (day) {
                                const dateString = day.toISOString().split('T')[0];
                                setArchiveDateFilter(dateString);
                                setShowDatePicker(false);
                              }
                            }}
                            className={`p-2 text-xs rounded hover:bg-blue-50 ${
                              day ? 'cursor-pointer' : 'cursor-default'
                            } ${
                              day && archiveDateFilter === day.toISOString().split('T')[0]
                                ? 'bg-blue-500 text-white'
                                : day
                                ? 'text-gray-700'
                                : 'text-gray-300'
                            } ${
                              day && getVideosForDate(day).length > 0
                                ? 'font-bold'
                                : ''
                            }`}
                            disabled={!day}
                          >
                            {day ? day.getDate() : ''}
                          </button>
                        ))}
                      </div>
                      
                      <div className="mt-3 pt-3 border-t">
                        <button
                          onClick={() => {
                            setArchiveDateFilter('');
                            setShowDatePicker(false);
                          }}
                          className="w-full p-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                        >
                          Clear Filter
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee Filter</label>
                <select
                  value={archiveEmployeeFilter}
                  onChange={(e) => setArchiveEmployeeFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg appearance-none bg-white video-archive-dropdown"
                >
                  <option value="all">All Employees</option>
                  {getArchiveEmployees().map(employee => (
                    <option key={employee} value={employee}>
                      {employee}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Filter</label>
                <select
                  value={archiveJobFilter}
                  onChange={(e) => setArchiveJobFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg appearance-none bg-white video-archive-dropdown"
                >
                  <option value="all">All Jobs</option>
                  {getArchiveJobNames().map((jobName) => (
                    <option key={jobName} value={jobName}>
                      {jobName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                <select
                  value={archiveServiceTypeFilter}
                  onChange={(e) => setArchiveServiceTypeFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg appearance-none bg-white video-archive-dropdown"
                >
                  <option value="all">All Services</option>
                  {getArchiveServiceTypes().map((serviceType) => (
                    <option key={serviceType} value={serviceType}>
                      {serviceType}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Archive Stats */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{archiveMediaItems.filter(v => v.status === 'approved').length}</p>
                  <p className="text-sm text-gray-600">Approved</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{archiveMediaItems.filter(v => v.status === 'rejected').length}</p>
                  <p className="text-sm text-gray-600">Rejected</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-600">{archiveMediaItems.length}</p>
                  <p className="text-sm text-gray-600">Total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{currentMemoryUsage}</p>
                  <p className="text-sm text-gray-600">MB Used</p>
                </div>
              </div>
            </div>

            {/* Video List */}
            <div className="space-y-3">
              {archiveMediaLoading ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  Loading media archive...
                </div>
              ) : archiveMediaError ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {archiveMediaError}
                </div>
              ) : getFilteredArchiveVideos().length === 0 ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  No media items match the current filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getFilteredArchiveVideos().map((video) => (
                    <div key={video.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-24 h-16 rounded bg-gray-100 border flex items-center justify-center overflow-hidden">
                          {video.mimeType?.startsWith("image/") && video.blobUrl ? (
                            <img src={video.blobUrl} alt={video.title} className="w-full h-full object-cover" />
                          ) : video.mimeType?.startsWith("video/") && video.blobUrl ? (
                            <video
                              src={video.blobUrl}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <Video className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{video.title}</h4>
                          <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                            <p>Job: {video.jobName}</p>
                            <p>Client: {video.clientName}</p>
                            <p>Employee: {video.employee}</p>
                            <p>Uploaded: {video.uploadDate || "Unknown"}</p>
                            <p>Service: {video.serviceType || "General Service"}</p>
                            {video.moderationReason ? <p>Reason: {video.moderationReason}</p> : null}
                            {video.moderatedAt ? <p>Moderated: {new Date(video.moderatedAt).toLocaleString()}</p> : null}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(video.status)}>
                            {video.status}
                          </Badge>
                          {video.visibilityStatus ? (
                            <Badge className="bg-slate-100 text-slate-700">
                              {String(video.visibilityStatus).replace(/_/g, " ")}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleWatchVideo(video)}
                            disabled={archiveActionLoadingId === `view:${video.id}` || resolvingPlaybackId === String(video.id)}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleArchiveMediaItemAction(video, "approve")}
                            disabled={video.status === "approved" || video.status === "archived" || Boolean(archiveActionLoadingId)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleArchiveMediaItemAction(video, "reject")}
                            disabled={video.status === "rejected" || video.status === "archived" || Boolean(archiveActionLoadingId)}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleArchiveMediaItemAction(video, "archive")}
                            disabled={video.status === "archived" || Boolean(archiveActionLoadingId)}
                          >
                            Move to Archive
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleArchiveMediaItemAction(video, "restore")}
                            disabled={video.status !== "archived" || Boolean(archiveActionLoadingId)}
                          >
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-700 border-red-200 hover:bg-red-50"
                            onClick={() => handleArchiveMediaItemAction(video, "delete")}
                            disabled={video.status === "archived" || Boolean(archiveActionLoadingId)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 pt-4">
            <Button 
              onClick={() => setShowVideoArchive(false)} 
              className="w-full"
            >
              Close Archive
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Job Details Modal */}
      <Dialog open={showJobDetails} onOpenChange={setShowJobDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Info className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Job Details</DialogTitle>
                  <p className="text-sm text-gray-600">Comprehensive job information</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowJobDetails(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          {selectedJobForDetails && (
            <div className="flex-1 overflow-y-auto space-y-6">
              {/* Job Header */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedJobForDetails.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">Job ID: {selectedJobForDetails.id}</p>
                  </div>
                  <Badge className={getStatusColor(selectedJobForDetails.status)}>
                    {formatJobStatusLabel(selectedJobForDetails.status)}
                  </Badge>
                </div>
              </div>

              {/* Client Information */}
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Client Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Client Name</p>
                    <p className="font-medium">{selectedJobForDetails.client}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium">{selectedJobForDetails.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{selectedJobForDetails.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Created Date</p>
                    <p className="font-medium">{selectedJobForDetails.createdAt}</p>
                  </div>
                </div>
              </div>

              {/* Assignment Information */}
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Assignment Information</h4>
                {selectedJobForDetails.assignedEmployees && selectedJobForDetails.assignedEmployees.length > 0 ? (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Assigned Employees</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedJobForDetails.assignedEmployees.map((employee, index) => (
                        <Badge key={index} className="bg-green-100 text-green-800">
                          {employee}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">No employees assigned to this job</p>
                )}
              </div>

              {/* Videos */}
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Service Videos</h4>
                {playbackError && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {playbackError}
                  </div>
                )}
                {selectedJobForDetails.videos && selectedJobForDetails.videos.length > 0 ? (
                  <div className="space-y-3">
                    {selectedJobForDetails.videos.map((video, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{video.title}</p>
                            <p className="text-sm text-gray-600">{video.description}</p>
                            <p className="text-xs text-gray-500">Uploaded: {video.uploadedAt}</p>
                          </div>
                          <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(video.status)}>
                            {`Media Moderation: ${String(video.status || 'pending').replace(/_/g, ' ')}`}
                            </Badge>
                            {video.visibilityStatus ? (
                              <Badge className="bg-slate-100 text-slate-700">
                              {`Media Visibility: ${String(video.visibilityStatus).replace(/_/g, ' ')}`}
                              </Badge>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleWatchVideo(video)}
                              disabled={resolvingPlaybackId === String(video.id)}
                            >
                              {resolvingPlaybackId === String(video.id) ? 'Opening...' : 'Watch'}
                            </Button>
                          </div>
                        </div>
                        {(video.moderationReason || video.moderatedAt) ? (
                          <div className="mt-2 text-xs text-gray-600">
                            {video.moderationReason ? <p>Reason: {video.moderationReason}</p> : null}
                            {video.moderatedAt ? <p>Moderated: {new Date(video.moderatedAt).toLocaleString()}</p> : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No videos uploaded for this job</p>
                )}
              </div>

              {/* Notes */}
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Notes & Comments</h4>
                {selectedJobForDetails.notes && selectedJobForDetails.notes.length > 0 ? (
                  <div className="space-y-3">
                    {selectedJobForDetails.notes.map((note, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm">{note.text}</p>
                        <p className="text-xs text-gray-500 mt-1">Added: {note.date}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No notes added to this job</p>
                )}
              </div>

              {/* Audit Trail */}
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Audit Trail</h4>
                {selectedJobForDetails.audit && selectedJobForDetails.audit.length > 0 ? (
                  <div className="space-y-2">
                    {selectedJobForDetails.audit.map((entry, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm text-gray-700">{entry}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No audit trail available</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJobDetails(false)}>
              Close
            </Button>
            <Button 
              onClick={() => {
                setShowJobDetails(false);
                openAssignmentModal(selectedJobForDetails);
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <Users className="w-4 h-4 mr-2" />
              {selectedJobForDetails?.assignedEmployees?.length > 0 ? 'Reassign' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Player Modal */}
      <Dialog
        open={showVideoPlayerModal}
        onOpenChange={(open) => {
          setShowVideoPlayerModal(open);
          if (!open) {
            setPlaybackUrl('');
            setPlaybackTitle('');
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{playbackTitle || 'Watch Service Video'}</DialogTitle>
            <DialogDescription>
              Playback for the selected service video.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {playbackUrl ? (
              <video
                className="w-full rounded border bg-black"
                controls
                autoPlay
                src={playbackUrl}
              >
                Your browser does not support HTML5 video playback.
              </video>
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                Video file is not available for playback in development mode because cloud storage is not configured.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVideoPlayerModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Details Modal */}
      <Dialog open={showVideoDetailsModal} onOpenChange={setShowVideoDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Video className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Video Details</DialogTitle>
                  <p className="text-sm text-gray-600">Comprehensive video information</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowVideoDetailsModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          {selectedVideoForDetails && (
            <div className="flex-1 overflow-y-auto space-y-6">
              {/* Video Header */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedVideoForDetails.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">Video ID: {selectedVideoForDetails.id}</p>
                  </div>
                  <Badge className={selectedVideoForDetails.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {selectedVideoForDetails.status}
                  </Badge>
                </div>
              </div>

              {/* Video Preview Section */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Video Preview</h4>
                <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Video className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Video preview would be displayed here</p>
                    <p className="text-xs text-gray-500 mt-1">Duration: ~3:45 | Quality: HD</p>
                  </div>
                </div>
              </div>

              {/* Video Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Video Metadata */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Video Metadata</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">File Size:</span>
                      <span className="text-sm font-medium">24.5 MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Duration:</span>
                      <span className="text-sm font-medium">3 minutes 45 seconds</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Resolution:</span>
                      <span className="text-sm font-medium">1920x1080 (HD)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Format:</span>
                      <span className="text-sm font-medium">MP4</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Upload Date:</span>
                      <span className="text-sm font-medium">{new Date(selectedVideoForDetails.reviewedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Upload Time:</span>
                      <span className="text-sm font-medium">{new Date(selectedVideoForDetails.reviewedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                {/* Job Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Job Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Job Title:</span>
                      <span className="text-sm font-medium">{selectedVideoForDetails.jobTitle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Client:</span>
                      <span className="text-sm font-medium">{selectedVideoForDetails.client}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Job Status:</span>
                      <span className="text-sm font-medium">In Progress</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Job ID:</span>
                      <span className="text-sm font-medium">JOB-{selectedVideoForDetails.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Location:</span>
                      <span className="text-sm font-medium">123 Main St, City, State</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Priority:</span>
                      <span className="text-sm font-medium">Medium</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Review Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Review Information</h4>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Reviewed By</p>
                      <p className="font-medium">{selectedVideoForDetails.reviewedBy}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Review Date</p>
                      <p className="font-medium">{new Date(selectedVideoForDetails.reviewedAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Review Time</p>
                      <p className="font-medium">{new Date(selectedVideoForDetails.reviewedAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Review Notes</p>
                    <p className="text-sm bg-gray-50 p-3 rounded border">
                      {selectedVideoForDetails.status === 'approved' 
                        ? "Video quality is excellent. All safety protocols followed correctly. Work completed according to specifications."
                        : "Video quality needs improvement. Some safety protocols not clearly visible. Please re-record with better lighting."
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Audit Trail */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Audit Trail</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-600">{new Date(selectedVideoForDetails.reviewedAt).toLocaleDateString()} {new Date(selectedVideoForDetails.reviewedAt).toLocaleTimeString()}</span>
                    <span className="font-medium">Video {selectedVideoForDetails.status} by {selectedVideoForDetails.reviewedBy}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600">{new Date(Date.now() - 86400000).toLocaleDateString()} 14:30:22</span>
                    <span className="font-medium">Video uploaded by John Smith</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-gray-600">{new Date(Date.now() - 172800000).toLocaleDateString()} 09:15:45</span>
                    <span className="font-medium">Job assigned to John Smith</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex-shrink-0 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  Download Video
                </Button>
                <Button variant="outline" size="sm">
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Share
                </Button>
              </div>
              <Button onClick={() => setShowVideoDetailsModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Job Modal */}
      <Dialog open={showCreateJob} onOpenChange={setShowCreateJob}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Job</DialogTitle>
            <DialogDescription>
              Create a new service job with client details and requirements.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title <span aria-hidden="true">*</span>
              </label>
              <Input
                ref={jobTitleInputRef}
                placeholder="Enter job title"
                value={newJob.title}
                required
                aria-invalid={Boolean(jobFieldErrors.title)}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewJob({ ...newJob, title: value });
                  if (value.trim()) {
                    setJobFieldErrors((prev) => ({ ...prev, title: '' }));
                  }
                }}
              />
              {jobFieldErrors.title && (
                <p className="mt-1 text-sm text-red-600">{jobFieldErrors.title}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Name <span aria-hidden="true">*</span>
              </label>
              <Input
                ref={clientNameInputRef}
                placeholder="Enter client name"
                value={newJob.client}
                required
                aria-invalid={Boolean(jobFieldErrors.client)}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewJob({ ...newJob, client: value });
                  if (value.trim()) {
                    setJobFieldErrors((prev) => ({ ...prev, client: '' }));
                  }
                }}
              />
              {jobFieldErrors.client && (
                <p className="mt-1 text-sm text-red-600">{jobFieldErrors.client}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number <span aria-hidden="true">*</span>
              </label>
              <Input
                ref={phoneInputRef}
                placeholder="Enter phone number"
                value={newJob.phone}
                required
                aria-invalid={Boolean(jobFieldErrors.phone)}
                onChange={(e) => {
                  const formattedPhone = formatPhoneNumber(e.target.value);
                  const digits = getPhoneDigits(formattedPhone);
                  setNewJob({ ...newJob, phone: formattedPhone });
                  if (digits.length === 10) {
                    setJobFieldErrors((prev) => ({ ...prev, phone: '' }));
                  }
                }}
                inputMode="numeric"
              />
              {jobFieldErrors.phone && (
                <p className="mt-1 text-sm text-red-600">{jobFieldErrors.phone}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span aria-hidden="true">*</span>
              </label>
              <Input
                ref={emailInputRef}
                placeholder="Enter email address"
                value={newJob.email}
                required
                aria-invalid={Boolean(jobFieldErrors.email)}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewJob({ ...newJob, email: value });
                  if (value.trim().includes('@') && value.trim().includes('.')) {
                    setJobFieldErrors((prev) => ({ ...prev, email: '' }));
                  }
                }}
              />
              {jobFieldErrors.email && (
                <p className="mt-1 text-sm text-red-600">{jobFieldErrors.email}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Type <span aria-hidden="true">*</span>
              </label>
              <select
                ref={serviceTypeSelectRef}
                value={newJob.serviceId}
                required
                aria-invalid={Boolean(jobFieldErrors.serviceId)}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewJob({ ...newJob, serviceId: value });
                  if (value) {
                    setJobFieldErrors((prev) => ({ ...prev, serviceId: '' }));
                  }
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                disabled={servicesLoading || serviceOptions.length === 0}
              >
                <option value="">
                  {servicesLoading ? 'Loading services...' : 'Select service type'}
                </option>
                {serviceOptions.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              {jobFieldErrors.serviceId && (
                <p className="mt-1 text-sm text-red-600">{jobFieldErrors.serviceId}</p>
              )}
              {!servicesLoading && serviceOptions.length === 0 && (
                <p className="mt-1 text-sm text-amber-700">No services available. Add a service first.</p>
              )}
              {usingFallbackServices && (
                <p className="mt-1 text-xs text-amber-700">
                  Using fallback service types until vendor-filtered services are fully connected.
                </p>
              )}
              {servicesLoadError && (
                <p className="mt-1 text-xs text-amber-700">{servicesLoadError}</p>
              )}
            </div>
            {createJobError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {createJobError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateJob(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateJob} disabled={!canCreateJob}>
              {isCreatingJob ? 'Creating...' : 'Create Job'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select Job Modal */}
      <Dialog open={showSelectJobModal} onOpenChange={setShowSelectJobModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Job</DialogTitle>
            <DialogDescription>
              Select the job this service video belongs to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {jobsLoading ? (
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                Loading jobs...
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                No jobs available. Create a job first, then create a service video.
              </div>
            ) : (
              filteredJobs.map((job) => (
                <label
                  key={job.id}
                  className={`block p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedJobForVideoId === String(job.id)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="selected-job-for-video"
                      className="mt-1"
                      checked={selectedJobForVideoId === String(job.id)}
                      onChange={() => setSelectedJobForVideoId(String(job.id))}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{job.title}</div>
                      <div className="text-sm text-gray-600">Client: {job.client}</div>
                      <div className="text-sm text-gray-600">Status: {job.status}</div>
                      {getJobMediaModerationSummary(job) && (
                        <div className="text-sm text-gray-600">
                          {getJobMediaModerationSummary(job)?.label}
                        </div>
                      )}
                      <div className="text-sm text-gray-600">
                        Assigned: {job.assignedEmployees?.length ? job.assignedEmployees[0] : "Unassigned"}
                      </div>
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSelectJobModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleContinueWithSelectedJob} disabled={!selectedJobForVideo}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Upload Modal */}
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          if (open && !selectedJob) {
            return;
          }
          setShowModal(open);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Service Video</DialogTitle>
            <DialogDescription>
              Upload a video for the selected job: {selectedJob?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Video Title <span aria-hidden="true">*</span>
              </label>
              <Input
                placeholder="Enter video title"
                value={newVideo.title}
                required
                aria-invalid={Boolean(videoFieldErrors.title)}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewVideo({ ...newVideo, title: value });
                  if (value.trim()) {
                    setVideoFieldErrors((prev) => ({ ...prev, title: '' }));
                  }
                }}
              />
              {videoFieldErrors.title && (
                <p className="mt-1 text-sm text-red-600">{videoFieldErrors.title}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span aria-hidden="true">*</span>
              </label>
              <textarea
                placeholder="Enter video description"
                value={newVideo.description}
                required
                aria-invalid={Boolean(videoFieldErrors.description)}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewVideo({ ...newVideo, description: value });
                  if (value.trim()) {
                    setVideoFieldErrors((prev) => ({ ...prev, description: '' }));
                  }
                }}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {videoFieldErrors.description && (
                <p className="mt-1 text-sm text-red-600">{videoFieldErrors.description}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Video File <span aria-hidden="true">*</span>
              </label>
              <Input
                type="file"
                accept="video/*"
                required
                aria-invalid={Boolean(videoFieldErrors.file)}
                onChange={handleFileChange}
              />
              {videoFieldErrors.file && (
                <p className="mt-1 text-sm text-red-600">{videoFieldErrors.file}</p>
              )}
            </div>
            {videoUploadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {videoUploadError}
              </div>
            )}
            {isUploadingVideo && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700 capitalize">
                Upload lifecycle: {uploadLifecycleState.replace('_', ' ')}
              </div>
            )}
            {!vendorProfile?.id && vendorProfileLoading && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                Loading vendor profile...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleVideoUpload} disabled={!canUploadVideo}>
              {isUploadingVideo ? 'Uploading...' : 'Upload Video'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assignment Modal */}
      <Dialog open={showBulkAssignmentModal} onOpenChange={setShowBulkAssignmentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Assign Jobs</DialogTitle>
            <DialogDescription>
              Assign {selectedJobIds.length} selected jobs to employees.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Employees</label>
              <div className="space-y-2">
                {['John Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown'].map(employee => (
                  <label key={employee} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(employee)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmployees([...selectedEmployees, employee]);
                        } else {
                          setSelectedEmployees(selectedEmployees.filter(emp => emp !== employee));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{employee}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkAssignmentModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleBulkAssignment(selectedEmployees)}>
              Assign Jobs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Individual Job Assignment Modal */}
      <Dialog open={showAssignmentModal} onOpenChange={setShowAssignmentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedJob?.assignedEmployees?.length > 0 ? 'Reassign Job' : 'Assign Job'}
            </DialogTitle>
            <DialogDescription>
              {selectedJob?.assignedEmployees?.length > 0 
                ? `Currently assigned to: ${selectedJob.assignedEmployees.join(', ')}`
                : 'Select employees to assign to this job.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Employees</label>
              <div className="space-y-2">
                {['John Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown'].map(employee => (
                  <label key={employee} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(employee)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmployees([...selectedEmployees, employee]);
                        } else {
                          setSelectedEmployees(selectedEmployees.filter(emp => emp !== employee));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{employee}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleAssignmentUpdate(selectedJob, selectedEmployees)}>
              {selectedJob?.assignedEmployees?.length > 0 ? 'Reassign' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-Approve Warning Modal */}
      <Dialog open={showAutoApproveWarning} onOpenChange={setShowAutoApproveWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enable Auto-Approve?</DialogTitle>
            <DialogDescription>
              This will automatically approve videos that meet the criteria. Are you sure you want to enable this feature?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoApproveWarning(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAutoApprove}>
              Enable Auto-Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compliance Modal - Legal Security Flow */}
      <Dialog
        open={showComplianceModal}
        onOpenChange={(open) => {
          if (open && !selectedJob) {
            return;
          }
          setShowComplianceModal(open);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Legal Compliance & Security Verification
            </DialogTitle>
            <DialogDescription>
              Complete the required legal compliance steps before creating a service video.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Step 1: Location Selection */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3">Step 1: Select Recording Location</h3>
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input 
                    type="radio" 
                    name="location" 
                    value="business" 
                    checked={location === 'business'} 
                    onChange={() => {
                      setLocation('business');
                      resetComplianceState();
                    }} 
                  />
                  <span>At Business Address (Location verification required)</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input 
                    type="radio" 
                    name="location" 
                    value="residence" 
                    checked={location === 'residence'} 
                    onChange={() => {
                      setLocation('residence');
                      resetComplianceState();
                    }} 
                  />
                  <span>At Customer Residence (Customer consent required)</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input 
                    type="radio" 
                    name="location" 
                    value="customer-business" 
                    checked={location === 'customer-business'} 
                    onChange={() => {
                      setLocation('customer-business');
                      resetComplianceState();
                    }} 
                  />
                  <span>At Customer Business (Customer consent + Location verification)</span>
                </label>
              </div>
            </div>

            {/* Step 2: Location-specific Requirements */}
            {location && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3">Step 2: Complete Requirements</h3>
                
                {/* Business Address Flow */}
                {location === 'business' && (
                  <div>
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">Location Verification Required</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            You must be at the registered business address to proceed. Your location will be verified.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-900">Legal Notice</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            By proceeding, you confirm you are present at the business address. Falsifying your location may result in account suspension and legal action. Your location and device info will be logged for compliance and security.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleGeoLocationCheck} disabled={geoLoading} className="w-full">
                      {geoLoading ? 'Verifying Location...' : 'Verify My Location'}
                    </Button>
                    
                    {geoError && (
                      <div className="mt-2 p-2 bg-red-50 text-red-700 rounded text-sm">
                        {geoError}
                      </div>
                    )}
                    {geoInfo && (
                      <div className="mt-2 p-2 bg-amber-50 text-amber-700 rounded text-sm">
                        {geoInfo}
                      </div>
                    )}
                  </div>
                )}

                {/* Customer Residence Flow */}
                {location === 'residence' && (
                  <div>
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">Customer Consent Required</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Recording at a customer's residence requires explicit consent. The customer will receive a secure notification to review and agree to the terms.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-900">Legal Notice</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            By proceeding, you confirm you have informed the customer and will only record after receiving their consent. All actions will be logged for compliance and security.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={handleRequestCustomerConsent} 
                      disabled={customerConsentStatus === 'pending' || customerConsentStatus === 'granted'}
                      className="w-full"
                    >
                      Request Customer Consent
                    </Button>
                    
                    {customerConsentStatus === 'pending' && (
                      <div className="mt-2 text-sm text-blue-600">Waiting for customer consent…</div>
                    )}
                    {customerConsentStatus === 'granted' && (
                      <div className="mt-2 text-sm text-green-600">Consent received. You may proceed.</div>
                    )}
                  </div>
                )}

                {/* Customer Business Flow */}
                {location === 'customer-business' && (
                  <div>
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">Customer Consent & Location Verification</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Recording at a customer's business address requires both customer consent and location verification. The customer will receive a secure link to review and agree to the terms before you can proceed. You may also be asked to verify your location.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-900">Legal Notice</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            By proceeding, you confirm you have informed the customer and will only record after receiving their consent. Your location and device info may be logged for compliance and security.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={handleRequestCustomerConsent} 
                      disabled={customerConsentStatus === 'pending' || customerConsentStatus === 'granted'}
                      className="w-full"
                    >
                      Request Customer Consent
                    </Button>

                    <Button
                      onClick={handleGeoLocationCheck}
                      disabled={geoLoading}
                      className="w-full mt-3"
                      variant="outline"
                    >
                      {geoLoading ? 'Verifying Location...' : 'Verify My Location'}
                    </Button>
                    
                    {customerConsentStatus === 'pending' && (
                      <div className="mt-2 text-sm text-blue-600">Waiting for customer consent…</div>
                    )}
                    {customerConsentStatus === 'granted' && (
                      <div className="mt-2 text-sm text-green-600">Consent received. You may proceed.</div>
                    )}
                    {locationVerified && (
                      <div className="mt-2 text-sm text-green-600">Location verified for customer business scenario.</div>
                    )}
                    {geoError && (
                      <div className="mt-2 p-2 bg-red-50 text-red-700 rounded text-sm">
                        {geoError}
                      </div>
                    )}
                    {geoInfo && (
                      <div className="mt-2 p-2 bg-amber-50 text-amber-700 rounded text-sm">
                        {geoInfo}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Proceed to Video Creation */}
            {location && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3">Step 3: Proceed to Video Creation</h3>
                
                {/* Business Address - Show after location verification */}
                {location === 'business' && locationVerified && (
                  <div>
                    <div className="mb-4 p-3 bg-green-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-900">Location Verified</h4>
                          <p className="text-sm text-green-700 mt-1">
                            Your location has been verified. You may proceed to create the service video.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={handleContinue}
                      disabled={!getCanContinueCompliance()}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      Continue to Video Creation
                    </Button>
                  </div>
                )}

                {/* Customer Residence - Show after consent */}
                {location === 'residence' && customerConsentRequested && customerConsentReceived && (
                  <div>
                    <div className="mb-4 p-3 bg-green-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-900">Customer Consent Received</h4>
                          <p className="text-sm text-green-700 mt-1">
                            Customer consent has been received. You may proceed to create the service video.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={handleContinue}
                      disabled={!getCanContinueCompliance()}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      Continue to Video Creation
                    </Button>
                  </div>
                )}

                {/* Customer Business - Show after consent */}
                {location === 'customer-business' && customerConsentRequested && customerConsentReceived && locationVerified && (
                  <div>
                    <div className="mb-4 p-3 bg-green-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-900">Customer Consent Received</h4>
                          <p className="text-sm text-green-700 mt-1">
                            Customer consent has been received. You may proceed to create the service video.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={handleContinue}
                      disabled={!getCanContinueCompliance()}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      Continue to Video Creation
                    </Button>
                  </div>
                )}

                {/* Show waiting states */}
                {(location === 'residence' || location === 'customer-business') && customerConsentStatus === 'pending' && (
                  <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-900">Waiting for Customer Consent</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          Waiting for customer consent...
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show declined states */}
                {(location === 'residence' || location === 'customer-business') && customerConsentStatus === 'declined' && (
                  <div className="mb-4 p-3 bg-red-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <X className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-red-900">Customer Consent Declined</h4>
                        <p className="text-sm text-red-700 mt-1">
                          Customer has declined consent. You cannot proceed with video creation.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fraud Prevention Warning */}
            {isBlocked && (
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900">Access Temporarily Blocked</h4>
                    <p className="text-sm text-red-700 mt-1">{blockReason}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplianceModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Available Employees Section */}
      <div className="mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Available Employees
            </h3>
            <Badge className="bg-green-100 text-green-800">
              {getAvailableEmployees().length} available
            </Badge>
          </div>
          
          {getAvailableEmployees().length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {getAvailableEmployees().map(employee => (
                <div key={employee.id} className="bg-white border border-green-200 rounded-lg p-3 flex items-center gap-3">
                  <img 
                    src={employee.photo} 
                    alt={employee.name} 
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{employee.name}</p>
                    <p className="text-sm text-green-600">Available for assignment</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-600">All employees are currently assigned to jobs</p>
            </div>
          )}
        </div>
      </div>

      {/* Archived Jobs Section */}
      {showArchivedJobs && (
        <div className="mb-6">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-orange-800 flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                Archived Jobs
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={jobArchiveFilter}
                  onChange={(e) => setJobArchiveFilter(e.target.value)}
                  className="px-3 py-1 text-sm border border-orange-300 rounded bg-white"
                >
                  <option value="all">All Archived</option>
                  <option value="archived">Archived</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <Badge className="bg-orange-100 text-orange-800">
                  {getFilteredArchivedJobs().length} archived
                </Badge>
              </div>
            </div>
            
            {getFilteredArchivedJobs().length > 0 ? (
              <div className="space-y-3">
                {getFilteredArchivedJobs().map(job => (
                  <div key={job.id} className="bg-white border border-orange-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{job.title}</h4>
                        <div className="text-sm text-gray-600 mt-1">
                          <p>Client: {job.client}</p>
                          <p>Archived: {new Date(job.archivedAt).toLocaleDateString()}</p>
                          <p className="text-orange-600">Reason: {job.archiveReason}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(job.status)}>
                          {formatJobStatusLabel(job.status)}
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            unarchiveJob(job).catch((error) => {
                              setJobActionFeedback({
                                type: 'error',
                                message: error instanceof Error ? error.message : 'Failed to restore archived job',
                              });
                            });
                          }}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          <ArrowLeft className="w-4 h-4 mr-1" />
                          Restore
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600">No archived jobs found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Jobs List */}
      <div className="space-y-4">
        {jobActionFeedback && (
          <div
            className={`p-3 rounded-lg border text-sm ${
              jobActionFeedback.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {jobActionFeedback.message}
          </div>
        )}
        {selectedJobIds.length > 0 && (
          <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedJobIds.length} job{selectedJobIds.length > 1 ? 's' : ''} selected
              </span>
              <Button size="sm" variant="outline" onClick={selectAllJobs}>
                Select All
              </Button>
              <Button size="sm" variant="outline" onClick={clearSelection}>
                Clear Selection
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                onClick={() => setShowBulkAssignmentModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Users className="w-4 h-4 mr-1" />
                Assign to Employees
              </Button>
            </div>
          </div>
        )}
        
        {jobsLoading ? (
          <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
            Loading jobs...
          </div>
        ) : jobsLoadError && filteredJobs.length === 0 ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {jobsLoadError}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
            No jobs found for this vendor yet.
          </div>
        ) : (
          <>
            {jobsLoadError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                {jobsLoadError}
              </div>
            )}
            {filteredJobs.map(job => (
          <Card key={job.id} className={`hover:shadow-md transition-shadow ${selectedJobIds.includes(job.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedJobIds.includes(job.id)}
                    onChange={() => toggleJobSelection(job.id)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div>
                    <CardTitle className="text-xl">{job.title}</CardTitle>
                    <p className="text-gray-600">Client: {job.client}</p>
                    <p className="text-gray-600">Phone: {job.phone}</p>
                    <p className="text-gray-600">Created: {job.createdAt}</p>
                    {job.assignedEmployees && job.assignedEmployees.length > 0 && (
                      <p className="text-sm text-blue-600 mt-1">
                        Assigned: {job.assignedEmployees.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(job.status)}>
                    {formatJobStatusLabel(job.status)}
                  </Badge>
                  {getJobMediaModerationSummary(job) && (
                    <Badge className={getJobMediaModerationSummary(job)?.className}>
                      {getJobMediaModerationSummary(job)?.label}
                    </Badge>
                  )}
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setActiveJobActionMenuId((prev) => (prev === String(job.id) ? null : String(job.id)))
                      }
                    >
                      Actions
                      <ChevronDown className="w-4 h-4 ml-1" />
                    </Button>
                    {activeJobActionMenuId === String(job.id) && (
                      <div className="absolute right-0 mt-2 w-56 rounded-md border bg-white shadow-lg z-20">
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            openJobDetails(job);
                            setActiveJobActionMenuId(null);
                          }}
                        >
                          View
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            openEditModal(job);
                            setActiveJobActionMenuId(null);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            openAssignmentModal(job);
                            setActiveJobActionMenuId(null);
                          }}
                        >
                          Assign
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            setSelectedJob(job);
                            setShowComplianceModal(true);
                            setActiveJobActionMenuId(null);
                          }}
                        >
                          Create Service Video
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => openJobActionConfirm(job, "ARCHIVE_JOB")}
                        >
                          Archive Job
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => openJobActionConfirm(job, "MOVE_CONTENT_TO_ARCHIVE")}
                        >
                          Move Content to Archive
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                          onClick={() => openJobActionConfirm(job, "DELETE_PERMANENTLY")}
                        >
                          Delete Permanently
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>
            ))}
          </>
        )}
      </div>

      <Dialog open={showJobActionConfirmModal} onOpenChange={setShowJobActionConfirmModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingJobActionTitle}</DialogTitle>
            <DialogDescription>
              {pendingJobActionDescription}
              {jobActionTarget ? ` Job: ${jobActionTarget.title}` : ''}
            </DialogDescription>
          </DialogHeader>
          {pendingJobAction === "DELETE_PERMANENTLY" && (
            <div className="space-y-2">
              {deleteImpactPreview?.loading ? (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                  Checking linked content and delete eligibility...
                </div>
              ) : (
                <>
                  {deleteImpactPreview?.message && (
                    <div
                      className={`p-2 border rounded text-sm ${
                        deleteImpactPreview.canVendorDelete
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}
                    >
                      {deleteImpactPreview.message}
                    </div>
                  )}
                  {deleteImpactPreview && deleteImpactPreview.linkedSessionCount > 0 && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                      Warning: {deleteImpactPreview.linkedSessionCount} linked media session(s) and{" "}
                      {deleteImpactPreview.linkedAssetCount} linked asset(s) will be archived/detached as part of deletion.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowJobActionConfirmModal(false);
                setDeleteImpactPreview(null);
              }}
              disabled={jobActionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={executeConfirmedJobAction}
              disabled={
                jobActionLoading ||
                (pendingJobAction === "DELETE_PERMANENTLY" &&
                  (deleteImpactPreview?.loading || deleteImpactPreview?.canVendorDelete === false))
              }
              className={pendingJobAction === "DELETE_PERMANENTLY" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {jobActionLoading ? "Processing..." : pendingJobActionTitle}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 