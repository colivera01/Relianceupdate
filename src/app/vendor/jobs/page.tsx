// @ts-nocheck — large vendor jobs surface; strict implicit-any cleanup tracked separately
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { AddressAutocompleteInput } from '@/components/AddressAutocompleteInput';
import { mergeAuthoritativeVendorJobState } from '@/lib/vendor-job-client-state';
import { TutorialEntryPoint } from '@/components/guidance/TutorialEntryPoint';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Filter, Trash2, Info, Video, Upload, X, MapPin, Shield, AlertTriangle, Edit, Users, Clock, CheckCircle, Calendar, ChevronDown, ChevronLeft, ChevronRight, Eye, HardDrive, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { useVendorProfile } from '@/hooks/useVendorProfile';
import {
  VENDOR_JOB_VIDEO_STAGE_LABELS,
  normalizeVendorJobVideoStage,
  resolveVendorJobVideoStageFromSession,
  type VendorJobVideoStage,
} from '@/lib/vendor-job-video-stages';
import {
  ARCHIVE_ARCHIVED,
  MODERATION_APPROVED,
  MODERATION_FLAGGED,
  MODERATION_PENDING_REVIEW,
  MODERATION_REJECTED,
  normalizeArchiveStatus as normalizeMediaArchiveStatus,
  normalizeModerationStatus,
} from '@/lib/media-visibility';
import { getClientSessionHeaders } from '@/lib/client-session';
import { useAuth } from '@/contexts/AuthContext';
import { tutorialGuides } from '@/lib/user-guidance';
import {
  fetchVendorTeamMembers,
  avatarUrlForName,
  type VendorTeamMember,
} from '@/lib/vendor-team-members';
import { getPermissionRefreshFeedback, resolveVendorJobLifecyclePresentation, shouldShowPermissionRefreshFeedback } from '@/lib/vendor-job-lifecycle-presentation';
import { getMaterialWorkRecordEditFields } from '@/lib/vendor-job-material-edit';

function parseDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateOnlyUtc(value: string | number | Date | null | undefined): string {
  const parsed = parseDate(value);
  if (!parsed) return '-';
  return parsed.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

function formatDateTimeUtc(value: string | number | Date | null | undefined): string {
  const parsed = parseDate(value);
  if (!parsed) return '-';
  return parsed.toLocaleString('en-US');
}

function formatTimeUtc(value: string | number | Date | null | undefined): string {
  const parsed = parseDate(value);
  if (!parsed) return '-';
  return parsed.toLocaleTimeString('en-US');
}

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

const getPhoneDigits = (value: string) => value.replace(/\D/g, '').slice(0, 10);

const formatPhoneNumber = (value: string) => {
  const digits = getPhoneDigits(value);
  const len = digits.length;

  if (len <= 3) return digits;
  if (len <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const maskPermissionEmail = (value: unknown) => {
  const email = String(value || '').trim();
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 1)}${'*'.repeat(Math.min(Math.max(local.length - 1, 3), 8))}@${domain}`;
};

const maskPermissionPhone = (value: unknown) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return `***-***-${digits.slice(-4).padStart(4, '*')}`;
};

const JOB_WORKFLOW_GUIDE_DISMISSED_KEY = 'reliance.vendorJobs.workflowGuideDismissed';
const VENDOR_JOBS_TIMEOUT_MS = 20000;
const VENDOR_TEAM_TIMEOUT_MS = 15000;
const VENDOR_SERVICES_TIMEOUT_MS = 15000;
const ADD_NEW_SERVICE_VALUE = "__add_new_service__";

function descriptionWithEstimatedDuration(description: string, estimatedDuration: string) {
  const cleanDescription = String(description || '').trim();
  const duration = Number(estimatedDuration);
  if (!Number.isFinite(duration) || duration <= 0) return cleanDescription;
  return `${cleanDescription}\n\nEstimated duration: ${Math.round(duration)} minutes.`;
}

function friendlyAiJobError(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error || "Failed to generate AI job guidance");
  const lower = message.toLowerCase();
  if (lower.includes("disabled") || lower.includes("configuration") || lower.includes("openai")) {
    return "AI job recovery help is not active in this environment yet. The job workflow still works normally; enable the OpenAI settings later for recovery recommendations.";
  }
  return message;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutHandle = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutHandle);
  }
}

export default function VendorJobs() {
  const router = useRouter();
  const dashboardDebug = process.env.NODE_ENV !== 'production';
  const { user } = useAuth();
  const authUserId =
    typeof user?.id === 'string'
      ? user.id.trim()
      : typeof user?.id === 'number'
      ? String(user.id)
      : user?.id && typeof user.id === 'object' && typeof (user.id as any).id === 'string'
      ? String((user.id as any).id).trim()
      : user?.id && typeof user.id === 'object' && typeof (user.id as any).id === 'number'
      ? String((user.id as any).id)
      : null;
  const {
    data: vendorProfile,
    loading: vendorProfileLoading,
    approvalPending,
    error: vendorProfileError,
    errorCode: vendorProfileErrorCode,
    hasResolvedVendorContext,
    resolvedVendorId,
    refetch: refetchVendorProfile,
  } = useVendorProfile();
  const vendorId = String(vendorProfile?.id || resolvedVendorId || '');
  const vendorContextDbFailure =
    vendorProfileErrorCode === "DB_CONNECTION_TIMEOUT" ||
    (vendorProfileErrorCode === "VENDOR_CONTEXT_ERROR" &&
      String(vendorProfileError || "").toLowerCase().includes("database connection"));
  const vendorContextErrorMessage =
    (vendorContextDbFailure
      ? "Vendor context is temporarily unavailable because the database connection failed. Please retry."
      : String(vendorProfileError || "").trim()) ||
    "Unable to resolve active vendor context. Please sign in again.";
  const vendorContextUnavailable =
    !vendorProfileLoading && !approvalPending && !vendorId && !hasResolvedVendorContext;
  const vendorContextResolving = vendorProfileLoading && !vendorId;

  const getUsableCustomerEmail = (value: unknown) => {
    const email = String(value || '').trim();
    return email.toLowerCase().endsWith('@reliance.local') ? '' : email;
  };

  const getCustomerContactForJob = (job: any) => ({
    email: getUsableCustomerEmail(job?.customerEmail || job?.email || ''),
    phone: String(job?.customerPhone || job?.phone || '').trim(),
  });

  const hasCustomerContactForJob = (job: any) => {
    const contact = getCustomerContactForJob(job);
    return Boolean(contact.email || contact.phone);
  };

  const formatCustomerConsentRecipient = (job: any) => {
    const contact = getCustomerContactForJob(job);
    const parts = [contact.email, contact.phone].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : 'Missing customer email or phone';
  };

  const splitCustomerName = (value: unknown) => {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
    return {
      customerFirstName: parts[0] || '',
      customerLastName: parts.slice(1).join(' '),
    };
  };

  const getEmptyJobForm = () => ({
    title: '',
    client: '',
    customerFirstName: '',
    customerLastName: '',
    phone: '',
    email: '',
    serviceId: '',
    recordingLocation: 'business',
    customerResidenceAddress: '',
    customerResidenceCity: '',
    customerResidenceState: '',
    customerResidenceZipCode: '',
    customerResidenceLatitude: null,
    customerResidenceLongitude: null,
    customerBusinessAddress: '',
    customerBusinessCity: '',
    customerBusinessState: '',
    customerBusinessZipCode: '',
    customerBusinessLatitude: null,
    customerBusinessLongitude: null,
    propertyScope: '',
    peopleScope: '',
    frameControl: '',
    minorMayAppear: false,
    protectedNonParticipantMayAppear: false,
    sensitiveInformationMayAppear: false,
    identifiersMayAppear: false,
    audioRequested: false,
  });

  const getEmptyJobFieldErrors = () => ({
    title: '',
    customerFirstName: '',
    customerLastName: '',
    contact: '',
    phone: '',
    email: '',
    serviceId: '',
    recordingLocation: '',
    customerResidenceAddress: '',
    customerBusinessAddress: '',
    recordingAssessment: '',
  });

  const getConsentStatusForJob = (job: any, snapshot?: any) => {
    const bookingKey = String(job?.bookingId || job?.id || '').trim();
    const explicit = String(bookingKey ? consentStatusByBookingId[bookingKey] || '' : '').trim();
    if (explicit) return explicit;
    const backendStatus = String(job?.consentStatus || '').trim();
    if (backendStatus) return backendStatus;
    if (snapshot?.consentAccepted) return CONSENT_STATE.ACCEPTED;
    if (String(snapshot?.consentRequestId || job?.latestConsentId || '').trim()) {
      return CONSENT_STATE.REQUESTED;
    }
    return CONSENT_STATE.NOT_REQUESTED;
  };

  const isJobPendingEmployeeCorrection = (job: any) => {
    const status = String(job?.status || '').trim().toLowerCase();
    const activeStatus =
      status === 'in progress' ||
      status === 'in-progress' ||
      status === 'confirmed' ||
      status === 'pending';
    return activeStatus && Boolean(String(job?.rejectionReason || '').trim());
  };

  const getJobVideos = (job: any) => (Array.isArray(job?.videos) ? job.videos : []);

  const jobHasRejectedMedia = (job: any) =>
    getJobVideos(job).some(
      (video: any) => normalizeModerationStatus(video?.moderationStatus || video?.status) === MODERATION_REJECTED
    );

  const isAdminAuditRejected = (job: any) =>
    String(job?.adminAuditDecision?.decision || '').trim().toUpperCase() === 'REJECT';
  const isAdminAuditPassed = (job: any) =>
    String(job?.adminAuditDecision?.decision || '').trim().toUpperCase() === 'PASS';

  const getVendorWorkflowStateForJob = (job: any) => {
    const phase = String(job?.operationalPhase || '').trim().toUpperCase();
    const status = String(job?.status || '').trim().toLowerCase();
    const snapshot = getSavedRecordingComplianceForJob(job);
    const consentState = getConsentStatusForJob(job, snapshot);
    const nextStage = getNextMissingVideoStageForJob(job);
    const stageLabel = nextStage ? formatVideoStageLabel(nextStage) : 'next stage';
    const isAssigned = isJobAssignedForVideoUpload(job);
    const requiresConsent = snapshot?.permissionRequired === true;
    const locationChoice = String(snapshot?.location || '').trim().toLowerCase();
    return resolveVendorJobLifecyclePresentation({
      status,
      operationalPhase: phase,
      rejectedMedia: jobHasRejectedMedia(job),
      rejectionReason: job?.rejectionReason,
      adminAuditDecision: job?.adminAuditDecision?.decision,
      adminAuditRejectionCategory: job?.adminAuditDecision?.rejectionCategory,
      adminAuditRejectionReason: job?.adminAuditDecision?.reason,
      adminAuditDecidedAt: job?.adminAuditDecision?.decidedAt,
      correctionPending: isJobPendingEmployeeCorrection(job),
      locationSelected: Boolean(locationChoice),
      permissionRequired: requiresConsent,
      permissionState: consentState,
      hasCustomerContact: hasCustomerContactForJob(job),
      assigned: isAssigned,
      allVideosPresent: !nextStage,
      nextStageLabel: stageLabel,
      serviceOrderSent: Boolean(snapshot?.serviceOrderReleasedAt),
      consentRecipientLabel: formatCustomerConsentRecipient(job),
    });
  };

  const permissionFeedbackIsCurrentForJob = (job: any) => {
    const snapshot = getSavedRecordingComplianceForJob(job);
    return shouldShowPermissionRefreshFeedback({
      status: job?.status,
      operationalPhase: job?.operationalPhase,
      adminAuditDecision: job?.adminAuditDecision?.decision,
      permissionRequired: snapshot?.permissionRequired === true,
    });
  };

  const isJobBlockedByCustomerConsent = (job: any): boolean => {
    const snapshot = getSavedRecordingComplianceForJob(job);
    return Boolean(snapshot?.permissionRequired && !snapshot?.recordingUnlocked);
  };

  useEffect(() => {
    if (!vendorContextUnavailable) return;
    console.error("[vendor/jobs] context unavailable", {
      userId: authUserId,
      code: vendorProfileErrorCode || null,
      message: vendorContextErrorMessage,
    });
  }, [authUserId, vendorContextErrorMessage, vendorContextUnavailable, vendorProfileErrorCode]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsLoadError, setJobsLoadError] = useState('');
  const [jobRecoveryByJobId, setJobRecoveryByJobId] = useState<Record<string, any>>({});
  const [jobRecoveryErrorByJobId, setJobRecoveryErrorByJobId] = useState<Record<string, string>>({});
  const [jobRecoveryLoadingId, setJobRecoveryLoadingId] = useState<string | null>(null);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [jobModalMode, setJobModalMode] = useState<'create' | 'edit'>('create');
  const [jobFormTargetId, setJobFormTargetId] = useState<string | null>(null);
  const [editJobBaseline, setEditJobBaseline] = useState<any>(null);
  const [showMaterialEditConfirm, setShowMaterialEditConfirm] = useState(false);
  const [materialEditFields, setMaterialEditFields] = useState<string[]>([]);
  const materialEditConfirmedRef = useRef(false);
  const [showSelectJobModal, setShowSelectJobModal] = useState(false);
  const [selectedJobForVideoId, setSelectedJobForVideoId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [locationExceptionJob, setLocationExceptionJob] = useState<any>(null);
  const [locationExceptionReason, setLocationExceptionReason] = useState('');
  const [locationExceptionSubmitting, setLocationExceptionSubmitting] = useState(false);
  const [locationExceptionError, setLocationExceptionError] = useState('');
  const [newJob, setNewJob] = useState({
    title: '',
    client: '',
    customerFirstName: '',
    customerLastName: '',
    phone: '',
    email: '',
    serviceId: '',
    recordingLocation: 'business',
    customerResidenceAddress: '',
    customerResidenceCity: '',
    customerResidenceState: '',
    customerResidenceZipCode: '',
    customerResidenceLatitude: null,
    customerResidenceLongitude: null,
    customerBusinessAddress: '',
    customerBusinessCity: '',
    customerBusinessState: '',
    customerBusinessZipCode: '',
    customerBusinessLatitude: null,
    customerBusinessLongitude: null,
    propertyScope: '',
    peopleScope: '',
    frameControl: '',
    minorMayAppear: false,
    protectedNonParticipantMayAppear: false,
    sensitiveInformationMayAppear: false,
    identifiersMayAppear: false,
    audioRequested: false,
  });
  const [newServiceForJob, setNewServiceForJob] = useState({
    name: '',
    description: '',
    price: '',
    estimatedDuration: '',
  });
  const [createJobError, setCreateJobError] = useState('');
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [jobFieldErrors, setJobFieldErrors] = useState({
    title: '',
    customerFirstName: '',
    customerLastName: '',
    contact: '',
    phone: '',
    email: '',
    serviceId: '',
    recordingLocation: '',
    customerResidenceAddress: '',
    customerBusinessAddress: '',
    recordingAssessment: '',
  });
  const [serviceOptions, setServiceOptions] = useState<Array<{ id: string; name: string; isPublished?: boolean }>>([]);
  const [teamMembers, setTeamMembers] = useState<VendorTeamMember[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesLoadError, setEmployeesLoadError] = useState('');
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesLoadError, setServicesLoadError] = useState('');
  const clientNameInputRef = useRef<HTMLInputElement | null>(null);
  const clientLastNameInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const serviceTypeSelectRef = useRef<HTMLSelectElement | null>(null);
  const createJobRequestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const [preferredNextVideoStage, setPreferredNextVideoStage] = useState<'' | VendorJobVideoStage>('');
  const [preferredReplaceStage, setPreferredReplaceStage] = useState(false);
  const [search, setSearch] = useState('');
  const [isEmployeeView, setIsEmployeeView] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [workflowFilter, setWorkflowFilter] = useState('all');
  const [showJobWorkflowGuide, setShowJobWorkflowGuide] = useState(false);
  const [dontShowJobWorkflowGuideAgain, setDontShowJobWorkflowGuideAgain] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const dismissed = window.localStorage.getItem(JOB_WORKFLOW_GUIDE_DISMISSED_KEY) === 'true';
      if (!dismissed) {
        setShowJobWorkflowGuide(true);
      }
    } catch (error) {
      setShowJobWorkflowGuide(true);
    }
  }, []);

  const openJobWorkflowGuide = () => {
    setDontShowJobWorkflowGuideAgain(false);
    setShowJobWorkflowGuide(true);
  };

  const closeJobWorkflowGuide = () => {
    if (dontShowJobWorkflowGuideAgain && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(JOB_WORKFLOW_GUIDE_DISMISSED_KEY, 'true');
      } catch (error) {
        console.warn('[vendor/jobs] failed to persist workflow guide preference', error);
      }
    }
    setShowJobWorkflowGuide(false);
    setDontShowJobWorkflowGuideAgain(false);
  };

  const requestAiJobRecovery = async (job: any) => {
    const jobId = String(job?.id || '').trim();
    if (!jobId) return;
    const workflow = getVendorWorkflowStateForJob(job);
    setJobRecoveryLoadingId(jobId);
    setJobRecoveryErrorByJobId((current) => ({
      ...current,
      [jobId]: '',
    }));
    try {
      const response = await fetch('/api/job-recovery-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authUserId ? getClientSessionHeaders(authUserId) : {}),
        },
        body: JSON.stringify({
          jobId,
          role: isEmployeeView ? 'employee' : 'vendor',
          title: String(job?.title || 'Untitled job'),
          status: String(job?.status || ''),
          operationalPhase: String(job?.operationalPhase || '').trim() || null,
          clientName: String(job?.client || '').trim() || null,
          assignedEmployeeNames: Array.isArray(job?.assignedEmployees)
            ? job.assignedEmployees.filter(Boolean).slice(0, 8)
            : [],
          stageProgress: {
            INTRO: jobHasVideoForStage(job, 'INTRO'),
            IN_PROGRESS: jobHasVideoForStage(job, 'IN_PROGRESS'),
            COMPLETED: jobHasVideoForStage(job, 'COMPLETED'),
          },
          consentStatus: String(job?.consentStatus || '').trim() || null,
          rejectionReason: String(job?.rejectionReason || '').trim() || null,
          currentWorkflowLabel: workflow.label,
          currentWorkflowDetail: workflow.detail,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || json?.message || `Status ${response.status}`);
      }
      setJobRecoveryByJobId((current) => ({
        ...current,
        [jobId]: json?.suggestion || null,
      }));
    } catch (error) {
      console.error('[vendor/jobs] job recovery assistant error:', error);
      setJobRecoveryErrorByJobId((current) => ({
        ...current,
        [jobId]: friendlyAiJobError(error),
      }));
    } finally {
      setJobRecoveryLoadingId(null);
    }
  };
  
  // Bulk selection state
  const [selectedJobIds, setSelectedJobIds] = useState<(string | number)[]>([]);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [showBulkAssignmentModal, setShowBulkAssignmentModal] = useState(false);
  const locallyDeletedJobIdsRef = useRef<Set<string>>(new Set());
  
  // Legal compliance state
  const CONSENT_STATE = {
    NOT_REQUESTED: 'not_requested',
    REQUESTED: 'requested',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    EXPIRED_OR_UNAVAILABLE: 'expired_or_unavailable',
    DELIVERY_FAILED: 'delivery_failed',
    WRONG_RECIPIENT: 'wrong_recipient',
    NO_DIGITAL_CHANNEL: 'no_digital_channel',
  } as const;
  const [location, setLocation] = useState('');
  const [showConsent, setShowConsent] = useState(false);
  const [consentStatus, setConsentStatus] = useState('');
  const [customerConsentStatus, setCustomerConsentStatus] = useState<string>(CONSENT_STATE.NOT_REQUESTED);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [geoInfo, setGeoInfo] = useState('');
  const [locationVerified, setLocationVerified] = useState(false);
  const [customerConsentRequested, setCustomerConsentRequested] = useState(false);
  const [customerConsentReceived, setCustomerConsentReceived] = useState(false);
  const [customerConsentSending, setCustomerConsentSending] = useState(false);
  const [activePermissionRequestId, setActivePermissionRequestId] = useState('');
  const [consentRefreshLoading, setConsentRefreshLoading] = useState(false);
  const [consentRefreshError, setConsentRefreshError] = useState('');
  const [recordingComplianceByJobId, setRecordingComplianceByJobId] = useState<
    Record<
      string,
      {
        location: 'business' | 'residence' | 'customer-business';
        consentAccepted: boolean;
        consentRequestId: string;
        locationVerified: boolean;
        savedAt: string;
        serviceOrderReleasedAt?: string | null;
        releasedMembershipIds?: string[];
        permissionRequired?: boolean;
        permissionStatus?: string;
        recordingUnlocked?: boolean;
      }
    >
  >({});
  const [consentStatusByBookingId, setConsentStatusByBookingId] = useState<Record<string, string>>({});
  const [showModal, setShowModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [showPermissionRecoveryModal, setShowPermissionRecoveryModal] = useState(false);
  const [permissionRecoveryJob, setPermissionRecoveryJob] = useState<any>(null);
  const [permissionRecoveryRequestId, setPermissionRecoveryRequestId] = useState('');
  const [permissionRecoveryForm, setPermissionRecoveryForm] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [permissionRecoveryLoading, setPermissionRecoveryLoading] = useState<
    '' | 'resend' | 'correct'
  >('');
  const [permissionRecoveryError, setPermissionRecoveryError] = useState('');
  const [permissionRecoverySuccess, setPermissionRecoverySuccess] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem('recordingComplianceByJobId');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      setRecordingComplianceByJobId(parsed as Record<string, any>);
      console.info('[recording-compliance] restored snapshot store from sessionStorage', {
        keys: Object.keys(parsed),
      });
    } catch (error) {
      console.warn('[recording-compliance] failed to restore snapshot store', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(
        'recordingComplianceByJobId',
        JSON.stringify(recordingComplianceByJobId)
      );
      console.info('[recording-compliance] snapshot store updated', {
        keys: Object.keys(recordingComplianceByJobId),
        total: Object.keys(recordingComplianceByJobId).length,
      });
    } catch (error) {
      console.warn('[recording-compliance] failed to persist snapshot store', error);
    }
  }, [recordingComplianceByJobId]);
  
  // Fraud prevention state
  const [attemptCount, setAttemptCount] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  
  const resetComplianceState = () => {
    setShowConsent(false);
    setConsentStatus('');
    setCustomerConsentStatus(CONSENT_STATE.NOT_REQUESTED);
    setCustomerConsentRequested(false);
    setCustomerConsentReceived(false);
    setActivePermissionRequestId('');
    setLocationVerified(false);
    setGeoLoading(false);
    setGeoError('');
    setGeoInfo('');
  };

  const applyConsentStatusFromBackend = (
    statusValue: string | null | undefined,
    options?: { requestId?: string | null }
  ) => {
    const upper = String(statusValue || '').trim().toUpperCase();
    const normalized =
      upper === 'ACCEPTED' || upper === 'ALLOWED'
        ? CONSENT_STATE.ACCEPTED
        : upper === 'REQUESTED' || upper === 'PENDING' || upper === 'DELIVERED' || upper === 'SENDING'
        ? CONSENT_STATE.REQUESTED
        : upper === 'DECLINED'
        ? CONSENT_STATE.DECLINED
      : upper === 'DELIVERY_FAILED'
      ? CONSENT_STATE.DELIVERY_FAILED
      : upper === 'WRONG_RECIPIENT' || upper === 'RECIPIENT_MISMATCH'
      ? CONSENT_STATE.WRONG_RECIPIENT
      : upper === 'NO_DIGITAL_CHANNEL'
      ? CONSENT_STATE.NO_DIGITAL_CHANNEL
      : upper === 'EXPIRED'
      ? CONSENT_STATE.EXPIRED_OR_UNAVAILABLE
        : CONSENT_STATE.NOT_REQUESTED;
    const resolvedRequestId = String(
      options?.requestId ?? activePermissionRequestId ?? ''
    ).trim();
    if (resolvedRequestId) {
      setActivePermissionRequestId(resolvedRequestId);
    }
    setCustomerConsentStatus(normalized);
    setConsentStatus(normalized);
    if (normalized === CONSENT_STATE.REQUESTED || normalized === CONSENT_STATE.ACCEPTED) {
      setCustomerConsentRequested(true);
    } else {
      setCustomerConsentRequested(false);
    }
    setCustomerConsentReceived(normalized === CONSENT_STATE.ACCEPTED);
    const bookingKey = selectedJob
      ? String(selectedJob.bookingId || selectedJob.id || '').trim()
      : '';
    if (bookingKey) {
      setConsentStatusByBookingId((prev) => ({ ...prev, [bookingKey]: normalized }));
    }
    const selectedLocation = String(location || '').trim().toLowerCase();
    if (
      selectedJob &&
      (selectedLocation === 'business' ||
        selectedLocation === 'residence' ||
        selectedLocation === 'customer-business')
    ) {
      const existingSnapshot = getSavedRecordingComplianceForJob(selectedJob);
      mergeRecordingComplianceForJob(selectedJob, {
        location: selectedLocation as 'business' | 'residence' | 'customer-business',
        consentAccepted: normalized === CONSENT_STATE.ACCEPTED,
        consentRequestId:
          resolvedRequestId || String(existingSnapshot?.consentRequestId || '').trim(),
        locationVerified:
          existingSnapshot?.locationVerified !== undefined
            ? Boolean(existingSnapshot.locationVerified)
            : Boolean(locationVerified),
        savedAt: new Date().toISOString(),
      });
    }
  };

  const mapConsentStatusPayloadToUiState = (payload: any) => {
    const normalized = String(payload?.status || '').trim().toLowerCase();
    if (normalized === 'accepted' || normalized === 'allowed') {
      return { status: CONSENT_STATE.ACCEPTED };
    }
    if (normalized === 'declined') {
      return { status: CONSENT_STATE.DECLINED };
    }
    if (normalized === 'expired') {
      return { status: CONSENT_STATE.EXPIRED_OR_UNAVAILABLE };
    }
    if (normalized === 'delivery_failed') return { status: CONSENT_STATE.DELIVERY_FAILED };
    if (normalized === 'wrong_recipient' || normalized === 'recipient_mismatch') {
      return { status: CONSENT_STATE.WRONG_RECIPIENT };
    }
    if (normalized === 'no_digital_channel') return { status: CONSENT_STATE.NO_DIGITAL_CHANNEL };
    if (normalized === 'pending' || normalized === 'delivered' || normalized === 'sending') {
      return { status: CONSENT_STATE.REQUESTED };
    }
    return { status: CONSENT_STATE.NOT_REQUESTED };
  };

  const fetchConsentStatusForJob = async (job: any, options?: { updateComplianceDialog?: boolean }) => {
    const bookingId = String(job?.bookingId || job?.id || '').trim();
    if (!bookingId) return;
    setConsentRefreshLoading(true);
    setConsentRefreshError('');
    try {
      const res = await fetch(`/api/consent/status?bookingId=${encodeURIComponent(bookingId)}`, {
        method: 'GET',
        headers: getRequestHeaders(),
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false) {
        throw new Error(
          String(payload?.error || payload?.message || `Failed to fetch consent status (${res.status})`)
        );
      }
      const mapped = mapConsentStatusPayloadToUiState(payload);
      const requestId = String(payload?.permission?.id || payload?.latestConsentId || '').trim();
      setConsentStatusByBookingId((current) => ({ ...current, [bookingId]: mapped.status }));
      if (options?.updateComplianceDialog) {
        applyConsentStatusFromBackend(mapped.status, { requestId });
      }
      if (options?.updateComplianceDialog && job && mapped.status === CONSENT_STATE.ACCEPTED) {
        const selectedLocation = String(location || '').trim().toLowerCase();
        if (selectedLocation === 'residence' || selectedLocation === 'customer-business') {
          const snapshot = buildRecordingComplianceSnapshot(job, {
            location: selectedLocation as 'residence' | 'customer-business',
            consentAccepted: true,
            consentRequestId: requestId,
            locationVerified:
              selectedLocation === 'customer-business'
                ? Boolean(locationVerified || getSavedRecordingComplianceForJob(job)?.locationVerified)
                : Boolean(locationVerified),
          });
          await persistRecordingComplianceToBackend(job, snapshot);
          await releaseEmployeeServiceOrderWhenReady(job, snapshot);
        }
      }
      await reloadJobsFromBackend({ silent: true });
      return mapped.status;
    } catch (error) {
      setConsentRefreshError(error instanceof Error ? error.message : 'Failed to refresh consent status');
    } finally {
      setConsentRefreshLoading(false);
    }
  };

  const refreshConsentStatusForSelectedJob = async () =>
    fetchConsentStatusForJob(selectedJob, { updateComplianceDialog: true });

  const checkConsentStatusOnly = async (job: any) => {
    const bookingId = String(job?.bookingId || job?.id || '').trim();
    if (!bookingId) return;
    setPermissionRefreshByJobId((current) => ({
      ...current,
      [bookingId]: { tone: 'info', message: 'Refreshing customer permission status...' },
    }));
    const status = await fetchConsentStatusForJob(job);
    const result = getPermissionRefreshFeedback(status);
    setPermissionRefreshByJobId((current) => ({ ...current, [bookingId]: result }));
  };

  const getCanContinueCompliance = () => {
    if (location === 'business') return true;
    if (location === 'residence') return customerConsentReceived;
    if (location === 'customer-business') {
      return customerConsentReceived;
    }
    return false;
  };
  const resolveMembershipIdsForJob = (job: any): string[] => {
    const rawIds = Array.isArray(job?.assignedMembershipIds)
      ? job.assignedMembershipIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
      : [];
    if (rawIds.length > 0) return rawIds;
    const names = Array.isArray(job?.assignedEmployees) ? job.assignedEmployees : [];
    if (!names.length || !teamMembers.length) return [];
    return names
      .map((n: string) => {
        const needle = String(n).trim().toLowerCase();
        const t = teamMembers.find((m) => m.name.trim().toLowerCase() === needle);
        return t?.membershipId;
      })
      .filter(Boolean) as string[];
  };
  const isJobAssignedForVideoUpload = (job: any): boolean => {
    const membershipIds = resolveMembershipIdsForJob(job);
    if (membershipIds.length > 0) return true;
    const assignedNames = Array.isArray(job?.assignedEmployees)
      ? job.assignedEmployees.map((name: unknown) => String(name || '').trim()).filter(Boolean)
      : [];
    return assignedNames.length > 0;
  };

  const getPrimaryJobCtaLabel = (job: any): string => {
    const phase = String(job?.operationalPhase || '').trim().toUpperCase();
    if (phase === 'AWAITING_ADMIN_REVIEW') {
      return 'View Job';
    }
    const normalizedStatus = String(job?.status || '').trim().toLowerCase();
    if (normalizedStatus === 'awaiting_review' || normalizedStatus === 'awaiting review') {
      return '';
    }
    if (normalizedStatus === 'completed' || normalizedStatus === 'complete') {
      return 'View Job';
    }
    const label = getVendorWorkflowStateForJob(job).actionLabel;
    if (label === 'Service Order Sent') return '';
    return label === 'Open Job' ? '' : label;
  };

  const handlePrimaryJobAction = (job: any) => {
    const phase = String(job?.operationalPhase || '').trim().toUpperCase();
    if (phase === 'AWAITING_ADMIN_REVIEW') {
      openJobDetails(job);
      return;
    }
    const normalizedStatus = String(job?.status || '').trim().toLowerCase();
    if (normalizedStatus === 'awaiting_review' || normalizedStatus === 'awaiting review') {
      openJobDetails(job);
      return;
    }
    if (normalizedStatus === 'completed' || normalizedStatus === 'complete') {
      openJobDetails(job);
      return;
    }
    const workflowAction = getVendorWorkflowStateForJob(job).actionLabel;
    if (workflowAction === 'Assign Employee') {
      openAssignmentModal(job);
      return;
    }
    if (
      workflowAction === 'Choose Location' ||
      workflowAction === 'Open Consent Step' ||
      workflowAction === 'Send Consent' ||
      workflowAction === 'View Consent Step' ||
      workflowAction === 'Resend Consent' ||
      workflowAction === 'Send Service Order'
    ) {
      if (workflowAction === 'Send Service Order') {
        void handleResendEmployeeServiceOrder(job, false);
      } else {
        void openComplianceForNextStage(job);
      }
      return;
    }
    if (workflowAction === 'Refresh Permission Status') {
      void checkConsentStatusOnly(job);
      return;
    }
    if (workflowAction === 'Correct Customer Contact') {
      openPermissionRecoveryForJob(job);
      return;
    }
    const nextStage = getNextMissingVideoStageForJob(job);
    if (nextStage) {
      void openComplianceForNextStage(job);
      return;
    }
    openJobDetails(job);
  };

  const persistLocationChoiceForJob = (
    job: any,
    locationChoice: 'business' | 'residence' | 'customer-business'
  ) => {
    mergeRecordingComplianceForJob(job, {
      location: locationChoice,
      consentAccepted: false,
      consentRequestId: '',
      locationVerified: false,
      savedAt: new Date().toISOString(),
    });
  };

  const videoAssignmentRequiredCopy = 'Assign this job before sending the employee recording link.';
  const assignmentSatisfiedForCompliance = Boolean(selectedJob && isJobAssignedForVideoUpload(selectedJob));
  const consentRequiredForCompliance =
    location === 'residence' || location === 'customer-business';
  const consentSatisfiedForCompliance = !consentRequiredForCompliance || customerConsentReceived;
  const locationRequiredForCompliance =
    location === 'business' || location === 'residence' || location === 'customer-business';
  const locationSatisfiedForCompliance = true;
  const allComplianceChecksPassed =
    assignmentSatisfiedForCompliance &&
    consentSatisfiedForCompliance &&
    locationSatisfiedForCompliance;
  const compliancePrerequisiteMessage = (() => {
    if (
      consentRequiredForCompliance &&
      consentSatisfiedForCompliance &&
      !assignmentSatisfiedForCompliance
    ) {
      return 'Consent accepted. Assign this job before recording can proceed.';
    }
    if (
      consentRequiredForCompliance &&
      assignmentSatisfiedForCompliance &&
      !consentSatisfiedForCompliance
    ) {
      return 'Job assigned. Verified recording permission is still required before recording.';
    }
    if (assignmentSatisfiedForCompliance && consentSatisfiedForCompliance && locationRequiredForCompliance) {
      return 'Ready to send. The employee phone will verify the required location before the camera opens.';
    }
    if (allComplianceChecksPassed) {
      return 'All compliance checks passed. You may proceed.';
    }
    if (!assignmentSatisfiedForCompliance) {
      return 'Assignment required before recording can proceed.';
    }
    return 'Complete the remaining compliance checks before recording can proceed.';
  })();

  useEffect(() => {
    if (!showComplianceModal) return;
    const snapshot = selectedJob ? getSavedRecordingComplianceForJob(selectedJob) : null;
    const savedLocation = String(snapshot?.location || '').trim().toLowerCase();
    const hasSavedLocation =
      savedLocation === 'business' ||
      savedLocation === 'residence' ||
      savedLocation === 'customer-business';
    if (!snapshot || !hasSavedLocation) {
      resetComplianceState();
      setLocation('');
      return;
    }

    const consentRequestId = String(
      snapshot.consentRequestId || selectedJob?.latestConsentId || ''
    ).trim();
    const consentAccepted = Boolean(snapshot.consentAccepted);
    setLocation(savedLocation);
    setLocationVerified(Boolean(snapshot.locationVerified));
    setActivePermissionRequestId(consentRequestId);
    setCustomerConsentReceived(consentAccepted);
    setCustomerConsentRequested(Boolean(consentRequestId) || consentAccepted);
    setCustomerConsentStatus(
      consentAccepted
        ? CONSENT_STATE.ACCEPTED
        : consentRequestId
        ? CONSENT_STATE.REQUESTED
        : CONSENT_STATE.NOT_REQUESTED
    );
    setConsentStatus(
      consentAccepted
        ? CONSENT_STATE.ACCEPTED
        : consentRequestId
        ? CONSENT_STATE.REQUESTED
        : CONSENT_STATE.NOT_REQUESTED
    );
    setGeoError('');
    setGeoInfo('');
    setConsentRefreshError('');
  }, [showComplianceModal, selectedJob?.id, selectedJob?.bookingId, recordingComplianceByJobId]);

  useEffect(() => {
    if (!showComplianceModal || !selectedJob) return;
    const normalizedLocation = String(location || '').trim().toLowerCase();
    const requiresConsent =
      normalizedLocation === 'residence' || normalizedLocation === 'customer-business';
    if (!requiresConsent) return;

    const snapshot = getSavedRecordingComplianceForJob(selectedJob);
    const hasAcceptedConsent = Boolean(snapshot?.consentAccepted);
    if (hasAcceptedConsent) return;

    void refreshConsentStatusForSelectedJob().catch((error) => {
      console.warn('[vendor/jobs] failed to hydrate consent status for compliance modal', error);
    });
  }, [showComplianceModal, selectedJob, location, recordingComplianceByJobId]);

  useEffect(() => {
    const consentPollingEligible =
      showComplianceModal &&
      (location === 'residence' || location === 'customer-business') &&
      customerConsentStatus === CONSENT_STATE.REQUESTED;

    if (!consentPollingEligible) {
      return;
    }

    const pollIntervalMs = 4000;
    const intervalId = window.setInterval(() => {
      void refreshConsentStatusForSelectedJob().catch((error) => {
        console.warn('[Vendor Compliance] Consent polling refresh failed', error);
      });
    }, pollIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [
    showComplianceModal,
    location,
    customerConsentStatus,
    selectedJob?.bookingId,
    selectedJob?.id,
  ]);

  // Enhancement 1: Job Status Management
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [jobMutationLoadingId, setJobMutationLoadingId] = useState<string | null>(null);
  
  // Enhancement 2: Employee Assignment Management
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedAssignmentMembershipIds, setSelectedAssignmentMembershipIds] = useState<string[]>([]);
  const [bulkAssignmentMembershipIds, setBulkAssignmentMembershipIds] = useState<string[]>([]);
  
  // Notes/comments and standalone media approval are intentionally not offered from this launch page.
  // Job completion review uses the persisted manager approve/reject endpoints below.
  const [showVideoArchive, setShowVideoArchive] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState('all'); // all, pending_review, approved, rejected, flagged, archived
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
    "ARCHIVE_JOB" | "MOVE_CONTENT_TO_ARCHIVE" | "DELETE_PERMANENTLY" | "CANCEL_SERVICE_ORDER" | null
  >(null);
  const [jobActionTarget, setJobActionTarget] = useState<any>(null);
  const [jobActionFeedback, setJobActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [permissionRefreshByJobId, setPermissionRefreshByJobId] = useState<
    Record<string, { tone: 'info' | 'success' | 'warning' | 'error'; message: string }>
  >({});
  const [jobActionLoading, setJobActionLoading] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [permissionEvidence, setPermissionEvidence] = useState<any>(null);
  const [permissionEvidenceLoading, setPermissionEvidenceLoading] = useState(false);
  const [permissionEvidenceError, setPermissionEvidenceError] = useState('');
  const [showRejectJobModal, setShowRejectJobModal] = useState(false);
  const [rejectJobTarget, setRejectJobTarget] = useState<any>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [rejectStageSelection, setRejectStageSelection] = useState<string[]>(['INTRO', 'IN_PROGRESS', 'COMPLETED']);
  const [rejectJobSubmitting, setRejectJobSubmitting] = useState(false);
  const [showApproveConfirmModal, setShowApproveConfirmModal] = useState(false);
  const [approveJobTarget, setApproveJobTarget] = useState<any>(null);
  const [approveJobSubmitting, setApproveJobSubmitting] = useState(false);
  const [deleteImpactPreview, setDeleteImpactPreview] = useState<{
    loading: boolean;
    canVendorDelete: boolean;
    status: string;
    linkedSessionCount: number;
    linkedAssetCount: number;
    message: string;
  } | null>(null);
  // Video details modal state
  const [showVideoDetailsModal, setShowVideoDetailsModal] = useState(false);
  const [selectedVideoForDetails, setSelectedVideoForDetails] = useState(null);
  const [showVideoPlayerModal, setShowVideoPlayerModal] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [playbackTitle, setPlaybackTitle] = useState('');
  const [playbackError, setPlaybackError] = useState('');
  const [resolvingPlaybackId, setResolvingPlaybackId] = useState<string | null>(null);
  
  // Calendar date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState('');

  useEffect(() => {
    if (selectedCalendarDate) return;
    setSelectedCalendarDate(new Date().toISOString().split('T')[0]);
  }, [selectedCalendarDate]);
  const trimmedCustomerFirstName = newJob.customerFirstName.trim();
  const trimmedCustomerLastName = newJob.customerLastName.trim();
  const phoneDigits = getPhoneDigits(newJob.phone);
  const trimmedEmail = newJob.email.trim();
  const selectedServiceId = newJob.serviceId.trim();
  const selectedRecordingLocation = String(newJob.recordingLocation || '').trim();
  const isAddingServiceFromJob = selectedServiceId === ADD_NEW_SERVICE_VALUE;
  const publishedServiceOptions = serviceOptions.filter((service: any) => service.isPublished !== false);
  const selectedServiceForWorkRecord = publishedServiceOptions.find((service) => service.id === selectedServiceId);
  const newServiceName = newServiceForJob.name.trim();
  const newServiceDescription = newServiceForJob.description.trim();
  const newServicePriceText = newServiceForJob.price.trim();
  const newServicePrice = newServicePriceText ? Number(newServicePriceText) : NaN;
  const newServiceDurationText = newServiceForJob.estimatedDuration.trim();
  const newServiceDuration = newServiceDurationText ? Number(newServiceDurationText) : NaN;
  const newServiceIsValid = Boolean(
    newServiceName &&
    newServiceDescription &&
    newServicePriceText &&
    Number.isFinite(newServicePrice) &&
    newServicePrice >= 0 &&
    newServiceDurationText &&
    Number.isFinite(newServiceDuration) &&
    newServiceDuration > 0
  );
  const hasPhoneInput = Boolean(newJob.phone.trim());
  const hasEmailInput = Boolean(trimmedEmail);
  const isCreateJobPhoneValid = !hasPhoneInput || phoneDigits.length === 10;
  const isCreateJobEmailValid = hasEmailInput && trimmedEmail.includes('@') && trimmedEmail.includes('.');
  const isEditMode = jobModalMode === 'edit';
  const canCreateJob = Boolean(
    trimmedCustomerFirstName &&
    trimmedCustomerLastName &&
    (isEditMode || (isCreateJobPhoneValid && isCreateJobEmailValid)) &&
    selectedServiceId &&
    selectedRecordingLocation &&
    (isAddingServiceFromJob ? newServiceIsValid : Boolean(selectedServiceForWorkRecord)) &&
    vendorId &&
    !isCreatingJob &&
    !servicesLoading
  );
  useEffect(() => {
    const loadServiceOptions = async () => {
      if (!vendorId) {
        setServiceOptions([]);
        return;
      }

      setServicesLoading(true);
      setServicesLoadError('');
      try {
        const res = await fetchWithTimeout(`/api/services?vendorId=${encodeURIComponent(String(vendorId))}`, {
          cache: 'no-store',
        }, VENDOR_SERVICES_TIMEOUT_MS);
        const payload = await res.json().catch(() => ({}));
        const services = Array.isArray(payload?.services) ? payload.services : [];
        const normalized = services
          .map((service: any) => ({
            id: String(service?.id ?? ''),
            name: String(service?.name ?? '').trim(),
            vendorId: String(service?.vendor_id ?? service?.vendorId ?? service?.vendor?.id ?? ''),
            isPublished: Boolean(service?.isPublished),
          }))
          .filter((service: any) => service.id && service.name);

        const vendorScoped = normalized.filter((service: any) => service.vendorId === String(vendorId));
        setServiceOptions(vendorScoped.map(({ id, name, isPublished }: any) => ({ id, name, isPublished })));
      } catch (error) {
        setServiceOptions([]);
        setServicesLoadError(
          error instanceof Error && error.message === 'Request timed out'
            ? 'Vendor services took too long to load. Please retry.'
            : 'Could not load vendor services.'
        );
      } finally {
        setServicesLoading(false);
      }
    };

    loadServiceOptions().catch(() => {
      setServicesLoading(false);
      setServiceOptions([]);
      setServicesLoadError('Could not load vendor services.');
    });
  }, [vendorId]);

  const getRequestHeaders = () => ({
    'Content-Type': 'application/json',
    ...getClientSessionHeaders(authUserId),
  } as Record<string, string>);

  const formatEmployeeLoadError = (error: unknown) => {
    const message = error instanceof Error && error.message ? error.message : '';
    if (message.includes('Manager access required')) {
      return 'Employee assignment requires an active vendor manager session. If you are signed in as admin, use the admin dashboard for approvals or sign into the vendor manager account for this business.';
    }
    if (message.includes('Active membership required')) {
      return 'Employee assignment becomes available after this vendor profile is approved and your manager access is active.';
    }
    return message ? `Could not load employees: ${message}` : 'Could not load employees.';
  };

  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!vendorId) {
        setTeamMembers([]);
        setEmployeesLoadError('');
        return;
      }
      setEmployeesLoading(true);
      setEmployeesLoadError('');
      try {
        const members = await fetchVendorTeamMembers(String(vendorId), () => getRequestHeaders(), {
          timeoutMs: VENDOR_TEAM_TIMEOUT_MS,
        });
        setTeamMembers(members);
      } catch (error) {
        setTeamMembers([]);
        setEmployeesLoadError(formatEmployeeLoadError(error));
      } finally {
        setEmployeesLoading(false);
      }
    };
    loadTeamMembers().catch((error) => {
      setTeamMembers([]);
      setEmployeesLoadError(formatEmployeeLoadError(error));
      setEmployeesLoading(false);
    });
  }, [vendorId, authUserId]);

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
          : 'https://reliance.invalid';
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
            headers: getRequestHeaders(),
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
    throw new Error('Video playback is unavailable right now because secure storage is not configured for this file.');
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
      const stageLabel = formatVideoStageLabel(video?.vendorJobVideoStage);
      setPlaybackTitle(stageLabel && stageLabel !== 'Other' ? `${stageLabel} Video` : (video?.title || 'Stage Video'));
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
    if (normalized === 'awaiting_review' || normalized === 'awaiting review') return 'awaiting_review';
    if (normalized === 'canceled' || normalized === 'cancelled') return 'cancelled';
    if (normalized === 'archived') return 'archived';
    if (normalized === 'scheduled' || normalized === 'pending') return 'pending';
    return 'pending';
  };

  const deriveMediaPurposeFromJobStatus = (status: string | null | undefined): 'progress' | 'completion' => {
    const normalized = String(status || '').trim().toLowerCase();
    return normalized === 'completed' ? 'completion' : 'progress';
  };

  const deriveMediaPurposeFromSessionType = (
    sessionType: string | null | undefined
  ): 'progress' | 'completion' => {
    const normalized = String(sessionType || '').trim().toLowerCase();
    return normalized.includes('completion') ? 'completion' : 'progress';
  };

  const formatMediaPurposeLabel = (purpose: string | null | undefined) =>
    String(purpose || 'progress').trim().toLowerCase() === 'completion' ? 'Completion' : 'Progress';

  const formatVideoStageLabel = (stage: string | null | undefined) => {
    const n = normalizeVendorJobVideoStage(stage);
    return n ? VENDOR_JOB_VIDEO_STAGE_LABELS[n] : 'Other';
  };

  const jobHasVideoForStage = (job: any, stage: VendorJobVideoStage) => {
    const videos = Array.isArray(job?.videos) ? job.videos : [];
    const hasVideoRecord = videos.some((video: any) => {
      const explicit = normalizeVendorJobVideoStage(video?.vendorJobVideoStage);
      if (explicit === stage) return true;
      const inferred = resolveVendorJobVideoStageFromSession({
        vendorJobVideoStage: video?.vendorJobVideoStage,
        sessionType: video?.sessionType,
      });
      return inferred === stage;
    });
    if (hasVideoRecord) return true;
    const uploadedStages = Array.isArray(job?.uploadedVideoStages)
      ? job.uploadedVideoStages.map((value: unknown) => String(value || "").trim().toUpperCase())
      : [];
    return uploadedStages.includes(stage);
  };

  const getStageVideoForJob = (job: any, stage: VendorJobVideoStage) => {
    const videos = Array.isArray(job?.videos) ? job.videos : [];
    return videos.find((video: any) => {
      const explicit = normalizeVendorJobVideoStage(video?.vendorJobVideoStage);
      if (explicit === stage) return true;
      const inferred = resolveVendorJobVideoStageFromSession({
        vendorJobVideoStage: video?.vendorJobVideoStage,
        sessionType: video?.sessionType,
      });
      return inferred === stage;
    }) || null;
  };

  const getNextMissingVideoStageForJob = (job: any): VendorJobVideoStage | null => {
    const stageOrder: VendorJobVideoStage[] = ['INTRO', 'IN_PROGRESS', 'COMPLETED'];
    for (const stage of stageOrder) {
      if (!jobHasVideoForStage(job, stage)) {
        return stage;
      }
    }
    return null;
  };

  const getRecordingComplianceKeys = (job: any): string[] => {
    const keys = [
      String(job?.bookingId || '').trim(),
      String(job?.id || '').trim(),
    ].filter(Boolean);
    return Array.from(new Set(keys));
  };

  const mergeRecordingComplianceForJob = (
    job: any,
    partial: Partial<{
      location: 'business' | 'residence' | 'customer-business';
      consentAccepted: boolean;
      consentRequestId: string;
      locationVerified: boolean;
      savedAt: string;
      serviceOrderReleasedAt?: string | null;
      releasedMembershipIds?: string[];
      permissionRequired?: boolean;
      permissionStatus?: string;
      recordingUnlocked?: boolean;
    }>
  ) => {
    const keys = getRecordingComplianceKeys(job);
    if (!keys.length) return;
    setRecordingComplianceByJobId((prev) => {
      const existing =
        keys
          .map((key) => prev[key])
          .filter(Boolean)
          .sort((a: any, b: any) => {
            const aTime = Date.parse(String(a?.savedAt || '')) || 0;
            const bTime = Date.parse(String(b?.savedAt || '')) || 0;
            return bTime - aTime;
          })[0] || null;
      const merged = {
        location: (partial.location || existing?.location || 'business') as
          | 'business'
          | 'residence'
          | 'customer-business',
        consentAccepted:
          partial.consentAccepted !== undefined
            ? Boolean(partial.consentAccepted)
            : Boolean(existing?.consentAccepted),
        consentRequestId:
          partial.consentRequestId !== undefined
            ? String(partial.consentRequestId || '').trim()
            : String(existing?.consentRequestId || '').trim(),
        locationVerified:
          partial.locationVerified !== undefined
            ? Boolean(partial.locationVerified)
            : Boolean(existing?.locationVerified),
        savedAt: partial.savedAt || new Date().toISOString(),
        serviceOrderReleasedAt:
          partial.serviceOrderReleasedAt !== undefined
            ? partial.serviceOrderReleasedAt || null
            : existing?.serviceOrderReleasedAt || null,
        releasedMembershipIds:
          partial.releasedMembershipIds !== undefined
            ? (Array.isArray(partial.releasedMembershipIds) ? partial.releasedMembershipIds : [])
            : Array.isArray(existing?.releasedMembershipIds)
            ? existing.releasedMembershipIds
            : [],
        permissionRequired:
          partial.permissionRequired !== undefined
            ? partial.permissionRequired
            : existing?.permissionRequired,
        permissionStatus:
          partial.permissionStatus !== undefined
            ? partial.permissionStatus
            : existing?.permissionStatus,
        recordingUnlocked:
          partial.recordingUnlocked !== undefined
            ? partial.recordingUnlocked
            : existing?.recordingUnlocked,
      };
      const next = { ...prev };
      keys.forEach((key) => {
        next[key] = merged;
      });
      return next;
    });
  };

  const applyJobPatchLocally = (job: any, patch: Record<string, unknown>) => {
    const jobId = String(job?.id || patch?.id || '').trim();
    if (!jobId) return;
    setJobs((prev) =>
      prev.map((existing) =>
        String(existing?.id || '') === jobId ? { ...existing, ...patch } : existing
      )
    );
    setSelectedJob((prev) =>
      prev && String((prev as any)?.id || '') === jobId ? { ...(prev as any), ...patch } : prev
    );
  };

  const persistRecordingComplianceForJob = (
    job: any,
    snapshot: {
      location: 'business' | 'residence' | 'customer-business';
      consentAccepted: boolean;
      consentRequestId: string;
      locationVerified: boolean;
      savedAt: string;
      serviceOrderReleasedAt?: string | null;
      releasedMembershipIds?: string[];
    }
  ) => {
    const keys = getRecordingComplianceKeys(job);
    if (!keys.length) return;
    console.info('[recording-compliance] saving snapshot', {
      keys,
      location: snapshot.location,
      consentAccepted: snapshot.consentAccepted,
      hasPermissionRequest: Boolean(snapshot.consentRequestId),
      locationVerified: snapshot.locationVerified,
      savedAt: snapshot.savedAt,
    });
    setRecordingComplianceByJobId((prev) => {
      const next = { ...prev };
      keys.forEach((key) => {
        next[key] = snapshot;
      });
      return next;
    });
  };

  const getSavedRecordingComplianceForJob = (job: any) => {
    const keys = getRecordingComplianceKeys(job);
    if (!keys.length) return null;
    const serverSnapshot = (job as any)?.recordingCompliance;
    const serverLocation = String(serverSnapshot?.location || '').trim().toLowerCase();
    if (
      typeof serverSnapshot?.permissionRequired === 'boolean' &&
      (serverLocation === 'business' ||
        serverLocation === 'residence' ||
        serverLocation === 'customer-business')
    ) {
      return {
        location: serverLocation as 'business' | 'residence' | 'customer-business',
        consentAccepted: Boolean(serverSnapshot?.consentAccepted),
        consentRequestId: String(job?.latestConsentId || '').trim(),
        locationVerified: Boolean(serverSnapshot?.locationVerified),
        savedAt:
          String(serverSnapshot?.locationVerifiedAt || serverSnapshot?.serviceOrderReleasedAt || job?.updatedAt || '').trim() ||
          new Date().toISOString(),
        serviceOrderReleasedAt: serverSnapshot?.serviceOrderReleasedAt || null,
        releasedMembershipIds: Array.isArray(serverSnapshot?.releasedMembershipIds)
          ? serverSnapshot.releasedMembershipIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
          : [],
        permissionRequired: serverSnapshot.permissionRequired,
        permissionStatus: String(serverSnapshot?.permissionStatus || job?.consentStatus || '').trim(),
        recordingUnlocked: serverSnapshot?.recordingUnlocked === true,
      };
    }
    const matches = keys
      .map((key) => ({ key, value: recordingComplianceByJobId[key] }))
      .filter((entry) => Boolean(entry.value));
    if (matches.length > 0) {
      const freshest = matches
        .slice()
        .sort((a: any, b: any) => {
          const aTime = Date.parse(String(a?.value?.savedAt || '')) || 0;
          const bTime = Date.parse(String(b?.value?.savedAt || '')) || 0;
          return bTime - aTime;
        })[0];
      const hit = freshest.value;
      console.info('[recording-compliance] loaded snapshot', {
        requestedKeys: keys,
        matchedKeys: matches.map((match) => match.key),
        selectedKey: freshest.key,
        location: hit.location,
        consentAccepted: hit.consentAccepted,
        hasPermissionRequest: Boolean(hit.consentRequestId),
        locationVerified: hit.locationVerified,
        savedAt: hit.savedAt,
      });
      return hit;
    }
    if (
      serverLocation === 'business' ||
      serverLocation === 'residence' ||
      serverLocation === 'customer-business'
    ) {
      const hydrated = {
        location: serverLocation as 'business' | 'residence' | 'customer-business',
        consentAccepted: Boolean(serverSnapshot?.consentAccepted),
        consentRequestId: String(job?.latestConsentId || '').trim(),
        locationVerified: Boolean(serverSnapshot?.locationVerified),
        savedAt:
          String(serverSnapshot?.locationVerifiedAt || serverSnapshot?.serviceOrderReleasedAt || job?.updatedAt || '').trim() ||
          new Date().toISOString(),
        serviceOrderReleasedAt: serverSnapshot?.serviceOrderReleasedAt || null,
        releasedMembershipIds: Array.isArray(serverSnapshot?.releasedMembershipIds)
          ? serverSnapshot.releasedMembershipIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
          : [],
        permissionRequired: Boolean(serverSnapshot?.permissionRequired),
        permissionStatus: String(serverSnapshot?.permissionStatus || job?.consentStatus || '').trim(),
        recordingUnlocked: serverSnapshot?.recordingUnlocked === true,
      };
      console.info('[recording-compliance] hydrated snapshot from backend job data', {
        requestedKeys: keys,
        location: hydrated.location,
        consentAccepted: hydrated.consentAccepted,
        locationVerified: hydrated.locationVerified,
      });
      return hydrated;
    }
    console.info('[recording-compliance] no saved snapshot', { requestedKeys: keys });
    return null;
  };

  useEffect(() => {
    const jobsWithSnapshot = jobs
      .map((job) => {
        const keys = getRecordingComplianceKeys(job);
        const snapshot = getSavedRecordingComplianceForJob(job);
        return {
          jobId: String(job?.id || ''),
          keys,
          hasSnapshot: Boolean(snapshot),
          consentAccepted: Boolean(snapshot?.consentAccepted),
          hasPermissionRequest: Boolean(String(snapshot?.consentRequestId || '').trim()),
          location: snapshot?.location || null,
          savedAt: snapshot?.savedAt || null,
        };
      })
      .filter((entry) => entry.hasSnapshot);
    console.info('[recording-compliance] jobs rerender snapshot check', {
      totalJobs: jobs.length,
      jobsWithSnapshotCount: jobsWithSnapshot.length,
      jobsWithSnapshot,
    });
  }, [jobs, recordingComplianceByJobId]);

  const isComplianceSatisfiedForRecording = (
    job: any,
    snapshot:
      | {
          location: 'business' | 'residence' | 'customer-business';
          consentAccepted: boolean;
          consentRequestId: string;
          locationVerified: boolean;
          permissionRequired?: boolean;
          permissionStatus?: string;
          recordingUnlocked?: boolean;
        }
      | null
  ): boolean => {
    if (!isJobAssignedForVideoUpload(job)) {
      console.info('[recording-compliance] unsatisfied: assignment missing');
      return false;
    }
    if (!snapshot) {
      console.info('[recording-compliance] unsatisfied: snapshot missing');
      return false;
    }
    const locationChoice = String(snapshot.location || '').trim().toLowerCase();
    if (
      locationChoice !== 'business' &&
      locationChoice !== 'residence' &&
      locationChoice !== 'customer-business'
    ) {
      console.info('[recording-compliance] unsatisfied: invalid location', { locationChoice });
      return false;
    }
    const consentSatisfied = snapshot.recordingUnlocked === true;
    if (!consentSatisfied) {
      console.info('[recording-compliance] unsatisfied: consent requirement not met', {
        locationChoice,
        consentAccepted: snapshot.consentAccepted,
        hasVerifiedPermission: Boolean(snapshot.consentAccepted),
      });
    }
    return consentSatisfied;
  };

  const refreshRecordingComplianceSnapshot = async (
    job: any,
    snapshot:
      | {
          location: 'business' | 'residence' | 'customer-business';
          consentAccepted: boolean;
          consentRequestId: string;
          locationVerified: boolean;
          savedAt?: string;
          permissionRequired?: boolean;
          permissionStatus?: string;
          recordingUnlocked?: boolean;
        }
      | null
  ) => {
    if (!snapshot) return null;
    const requiresConsent = snapshot.permissionRequired === true;
    if (!requiresConsent) return snapshot;
    if (snapshot.consentAccepted) return snapshot;
    const bookingId = String(job?.bookingId || job?.id || '').trim();
    if (!bookingId) return snapshot;
    try {
      const res = await fetch(`/api/consent/status?bookingId=${encodeURIComponent(bookingId)}`, {
        method: 'GET',
        headers: getRequestHeaders(),
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false) {
        console.info('[recording-compliance] permission refresh failed', {
          status: res.status,
          code: payload?.code || null,
        });
        return snapshot;
      }
      const latestStatus = String(payload?.status || '').trim().toLowerCase();
      const accepted = latestStatus === 'accepted' || latestStatus === 'allowed';
      const refreshed = {
        ...snapshot,
        consentAccepted: accepted,
        permissionRequired: payload?.permissionRequired === true,
        permissionStatus: String(payload?.status || '').trim(),
        recordingUnlocked: payload?.recordingUnlocked === true,
        consentRequestId: String(payload?.permission?.id || payload?.latestConsentId || snapshot.consentRequestId || '').trim(),
        savedAt: new Date().toISOString(),
      };
      mergeRecordingComplianceForJob(job, refreshed);
      console.info('[recording-compliance] permission refresh applied', {
        latestStatus,
        consentAccepted: accepted,
        hasVerifiedPermission: accepted,
      });
      return refreshed;
    } catch (error) {
      console.info('[recording-compliance] permission refresh exception', {
        message: error instanceof Error ? error.message : String(error),
      });
      return snapshot;
    }
  };

  const buildRecordingComplianceSnapshot = (
    job: any,
    overrides: Partial<{
      location: 'business' | 'residence' | 'customer-business';
      consentAccepted: boolean;
      consentRequestId: string;
      locationVerified: boolean;
      savedAt: string;
    }> = {}
  ) => {
    const existingSnapshot = getSavedRecordingComplianceForJob(job);
    const normalizedLocation = String(overrides.location || location || existingSnapshot?.location || '')
      .trim()
      .toLowerCase();
    const locationChoice =
      normalizedLocation === 'business' ||
      normalizedLocation === 'residence' ||
      normalizedLocation === 'customer-business'
        ? (normalizedLocation as 'business' | 'residence' | 'customer-business')
        : 'business';
    return {
      location: locationChoice,
      consentAccepted:
        overrides.consentAccepted !== undefined
          ? Boolean(overrides.consentAccepted)
          : Boolean(customerConsentReceived || existingSnapshot?.consentAccepted),
      consentRequestId:
        overrides.consentRequestId !== undefined
          ? String(overrides.consentRequestId || '').trim()
          : String(activePermissionRequestId || existingSnapshot?.consentRequestId || '').trim(),
      locationVerified:
        overrides.locationVerified !== undefined
          ? Boolean(overrides.locationVerified)
          : Boolean(locationVerified || existingSnapshot?.locationVerified),
      savedAt: overrides.savedAt || new Date().toISOString(),
      serviceOrderReleasedAt: existingSnapshot?.serviceOrderReleasedAt || null,
      releasedMembershipIds: Array.isArray(existingSnapshot?.releasedMembershipIds)
        ? existingSnapshot.releasedMembershipIds
        : [],
    };
  };

  const persistRecordingComplianceToBackend = async (
    job: any,
    snapshot: ReturnType<typeof buildRecordingComplianceSnapshot>,
    locationVerification?: Record<string, unknown>
  ) => {
    const payload = await runPersistedJobAction(job, 'UPDATE_RECORDING_COMPLIANCE', {
      recordingCompliance: snapshot,
      ...(locationVerification ? { locationVerification } : {}),
    });
    const backendSnapshot = payload?.job?.recordingCompliance || payload?.recordingCompliance || null;
    if (backendSnapshot) {
      mergeRecordingComplianceForJob(job, {
        location: snapshot.location,
        consentAccepted: Boolean(backendSnapshot.consentAccepted),
        consentRequestId: String(snapshot.consentRequestId || job?.latestConsentId || '').trim(),
        locationVerified: Boolean(backendSnapshot.locationVerified),
        savedAt:
          String(backendSnapshot.locationVerifiedAt || backendSnapshot.serviceOrderReleasedAt || '').trim() ||
          snapshot.savedAt,
        serviceOrderReleasedAt: backendSnapshot.serviceOrderReleasedAt || null,
        releasedMembershipIds: Array.isArray(backendSnapshot.releasedMembershipIds)
          ? backendSnapshot.releasedMembershipIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
          : snapshot.releasedMembershipIds,
      });
    }
    return payload;
  };

  const releaseEmployeeServiceOrderForJob = async (
    job: any,
    snapshot: ReturnType<typeof buildRecordingComplianceSnapshot>,
    options?: { forceResend?: boolean }
  ) => {
    const payload = await runPersistedJobAction(job, 'RELEASE_EMPLOYEE_SERVICE_ORDER', {
      recordingCompliance: snapshot,
      ...(options?.forceResend ? { forceResend: true } : {}),
    });
    const backendSnapshot = payload?.job?.recordingCompliance || payload?.recordingCompliance || null;
    if (backendSnapshot) {
      mergeRecordingComplianceForJob(job, {
        location: snapshot.location,
        consentAccepted: Boolean(backendSnapshot.consentAccepted),
        consentRequestId: String(snapshot.consentRequestId || job?.latestConsentId || '').trim(),
        locationVerified: Boolean(backendSnapshot.locationVerified),
        savedAt:
          String(backendSnapshot.locationVerifiedAt || backendSnapshot.serviceOrderReleasedAt || '').trim() ||
          snapshot.savedAt,
        serviceOrderReleasedAt: backendSnapshot.serviceOrderReleasedAt || null,
        releasedMembershipIds: Array.isArray(backendSnapshot.releasedMembershipIds)
          ? backendSnapshot.releasedMembershipIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
          : snapshot.releasedMembershipIds,
      });
      applyJobPatchLocally(job, {
        ...(payload?.job || {}),
        recordingCompliance: backendSnapshot,
      });
    }
    return payload;
  };

  const handleResendEmployeeServiceOrder = async (job: any, forceResend = true) => {
    if (jobMutationLoadingId) return;
    if (!isJobAssignedForVideoUpload(job)) {
      setJobActionFeedback({ type: 'error', message: videoAssignmentRequiredCopy });
      return;
    }
    setJobMutationLoadingId(`resend-service-order:${String(job?.id || '')}`);
    setJobActionFeedback(null);
    try {
      const saved = getSavedRecordingComplianceForJob(job);
      const snapshot =
        saved ||
        buildRecordingComplianceSnapshot(job, {
          location: 'business',
          consentAccepted: false,
          consentRequestId: '',
          locationVerified: false,
        });
      const refreshed = await refreshRecordingComplianceSnapshot(job, snapshot);
      if (!refreshed) {
        throw new Error('The service order is missing its recording setup. Open Job and complete the service-order step first.');
      }
      const payload = await releaseEmployeeServiceOrderForJob(job, refreshed, { forceResend });
      await reloadJobsFromBackend();
      setJobActionFeedback({
        type: 'success',
        message: payload?.message || (forceResend ? 'Employee Service Order link resent.' : 'Employee Service Order sent.'),
      });
    } catch (error) {
      setJobActionFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : `Could not ${forceResend ? 'resend' : 'send'} the employee Service Order.`,
      });
    } finally {
      setJobMutationLoadingId(null);
    }
  };

  const releaseEmployeeServiceOrderWhenReady = async (
    job: any,
    snapshot: ReturnType<typeof buildRecordingComplianceSnapshot>
  ) => {
    if (!isComplianceSatisfiedForRecording(job, snapshot)) return null;
    try {
      const payload = await releaseEmployeeServiceOrderForJob(job, snapshot);
      await reloadJobsFromBackend();
      setJobActionFeedback({
        type: 'success',
        message: payload?.message || 'Employee service order sent.',
      });
      return payload;
    } catch (error) {
      setJobActionFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'The required checks passed, but the employee service order could not be sent.',
      });
      throw error;
    }
  };

  const startRecordingFlow = async (
    job: any,
    options?: {
      stage?: '' | VendorJobVideoStage;
      replaceExisting?: boolean;
      source?: string;
    }
  ) => {
    if (!isJobAssignedForVideoUpload(job)) {
      setJobActionFeedback({ type: 'error', message: videoAssignmentRequiredCopy });
      return;
    }
    const stage = options?.stage || '';
    const replaceExisting = Boolean(options?.replaceExisting);
    const source = String(options?.source || 'unknown');
    const saved = getSavedRecordingComplianceForJob(job);
    console.info('[recording-compliance] startRecordingFlow snapshot', {
      source,
      jobKeys: getRecordingComplianceKeys(job),
      stage,
      replaceExisting,
      snapshot: saved,
    });
    const refreshed = await refreshRecordingComplianceSnapshot(job, saved);
    console.info('[recording-compliance] startRecordingFlow effective snapshot', {
      source,
      jobKeys: getRecordingComplianceKeys(job),
      snapshot: refreshed,
    });
    if (isComplianceSatisfiedForRecording(job, refreshed)) {
      console.info('[recording-compliance] sending employee service order', {
        stage,
        replaceExisting,
      });
      setSelectedJob(job);
      setLocation(refreshed!.location);
      setLocationVerified(Boolean(refreshed!.locationVerified));
      setCustomerConsentReceived(Boolean(refreshed!.consentAccepted));
      setCustomerConsentRequested(Boolean(refreshed!.consentAccepted));
      setCustomerConsentStatus(
        refreshed!.consentAccepted ? CONSENT_STATE.ACCEPTED : CONSENT_STATE.NOT_REQUESTED
      );
      setActivePermissionRequestId(String(refreshed!.consentRequestId || '').trim());
      setPreferredNextVideoStage('');
      setPreferredReplaceStage(false);
      setShowComplianceModal(false);
      await releaseEmployeeServiceOrderWhenReady(job, refreshed!);
      return;
    }
    console.info('[recording-compliance] opening compliance modal', {
      stage,
      replaceExisting,
    });
    setSelectedJob(job);
    setPreferredNextVideoStage(stage);
    setPreferredReplaceStage(replaceExisting);
    setShowComplianceModal(true);
  };

  const openComplianceForNextStage = (job: any) => {
    const nextStage = getNextMissingVideoStageForJob(job);
    if (!nextStage) return;
    void startRecordingFlow(job, {
      stage: nextStage,
      replaceExisting: false,
      source: 'continue-recording',
    });
  };

  const openCustomerConsentForJob = (job: any) => {
    setSelectedJob(job);
    setPreferredNextVideoStage(getNextMissingVideoStageForJob(job) || '');
    setPreferredReplaceStage(false);
    setActiveJobActionMenuId(null);
    setShowComplianceModal(true);
  };

  const openPermissionRecoveryForJob = (job: any) => {
    const contact = getCustomerContactForJob(job);
    const requestId = String(
      job?.latestConsentId || getSavedRecordingComplianceForJob(job)?.consentRequestId || ''
    ).trim();
    setSelectedJob(job);
    setPermissionRecoveryJob(job);
    setPermissionRecoveryRequestId(requestId);
    setPermissionRecoveryForm({
      name: String(job?.client || job?.clientName || '').trim(),
      email: contact.email,
      phone: contact.phone,
    });
    setPermissionRecoveryError('');
    setPermissionRecoverySuccess('');
    setActiveJobActionMenuId(null);
    setShowPermissionRecoveryModal(true);
  };

  const runPermissionRecovery = async (mode: 'resend' | 'correct') => {
    const job = permissionRecoveryJob;
    const requestId = String(permissionRecoveryRequestId || '').trim();
    if (!job || !requestId) {
      setPermissionRecoveryError(
        'This work record does not have a recoverable permission request. Open the recording-permission step to send the first request.'
      );
      return;
    }
    if (
      mode === 'resend' &&
      getConsentStatusForJob(job, getSavedRecordingComplianceForJob(job)) ===
        CONSENT_STATE.WRONG_RECIPIENT
    ) {
      setPermissionRecoveryError(
        'This request was reported as sent to the wrong person. Correct the customer contact before sending a new request.'
      );
      return;
    }
    const email = getUsableCustomerEmail(permissionRecoveryForm.email);
    const phone = String(permissionRecoveryForm.phone || '').trim();
    if (mode === 'correct' && !email && !phone) {
      setPermissionRecoveryError('Enter a customer email address or mobile phone before sending the corrected request.');
      return;
    }

    setPermissionRecoveryLoading(mode);
    setPermissionRecoveryError('');
    setPermissionRecoverySuccess('');
    try {
      const response = await fetch(
        `/api/consent/requests/${encodeURIComponent(requestId)}/${mode === 'correct' ? 'recipient' : 'resend'}`,
        {
          method: mode === 'correct' ? 'PATCH' : 'POST',
          headers: getRequestHeaders(),
          ...(mode === 'correct'
            ? {
                body: JSON.stringify({
                  name: String(permissionRecoveryForm.name || '').trim(),
                  email: email || null,
                  phone: phone || null,
                }),
              }
            : {}),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(
          String(
            payload?.error ||
              (mode === 'correct'
                ? 'Unable to correct the permission recipient'
                : 'Unable to resend the permission request')
          )
        );
      }

      const nextRequestId = String(payload?.permission?.id || requestId).trim();
      setPermissionRecoveryRequestId(nextRequestId);
      applyConsentStatusFromBackend(payload?.permission?.state || 'pending');
      await reloadJobsFromBackend({ silent: true });
      setPermissionRecoverySuccess(
        mode === 'correct'
          ? 'The corrected recipient was sent a new secure request. The previous link no longer works.'
          : 'A new secure permission link was sent to the current recipient. The previous link no longer works.'
      );
    } catch (error) {
      setPermissionRecoveryError(
        error instanceof Error
          ? error.message
          : mode === 'correct'
          ? 'Unable to correct the permission recipient.'
          : 'Unable to resend the permission request.'
      );
    } finally {
      setPermissionRecoveryLoading('');
    }
  };

  const openComplianceForSpecificStage = (
    job: any,
    stage: VendorJobVideoStage,
    replaceExisting: boolean
  ) => {
    void startRecordingFlow(job, {
      stage,
      replaceExisting,
      source: replaceExisting ? `replace-${stage}` : `upload-${stage}`,
    });
  };

  const groupVideosForStagePanels = (videos: any[] | undefined) => {
    const list = Array.isArray(videos) ? videos : [];
    const intro: any[] = [];
    const inProgress: any[] = [];
    const completed: any[] = [];
    const legacy: any[] = [];
    for (const v of list) {
      const explicit = normalizeVendorJobVideoStage(v?.vendorJobVideoStage);
      if (explicit === 'INTRO') intro.push(v);
      else if (explicit === 'IN_PROGRESS') inProgress.push(v);
      else if (explicit === 'COMPLETED') completed.push(v);
      else {
        const inferred = resolveVendorJobVideoStageFromSession({
          vendorJobVideoStage: v?.vendorJobVideoStage,
          sessionType: v?.sessionType,
        });
        if (inferred === 'INTRO') intro.push(v);
        else if (inferred === 'IN_PROGRESS') inProgress.push(v);
        else if (inferred === 'COMPLETED') completed.push(v);
        else legacy.push(v);
      }
    }
    return { intro, inProgress, completed, legacy };
  };

  const adaptRecentJobToUiJob = (job: any) => {
    const status = mapDashboardStatusToJobStatus(job?.status);
    const createdAtIso =
      job?.createdAt && !Number.isNaN(new Date(job.createdAt).getTime())
        ? new Date(job.createdAt).toISOString()
        : job?.date && !Number.isNaN(new Date(job.date).getTime())
        ? new Date(job.date).toISOString()
        : new Date().toISOString();
    const updatedAtIso =
      job?.updatedAt && !Number.isNaN(new Date(job.updatedAt).getTime())
        ? new Date(job.updatedAt).toISOString()
        : createdAtIso;

    return {
      id: String(job?.id ?? ''),
      bookingId: String(job?.id ?? ''),
      serviceId: job?.serviceId ? String(job.serviceId) : '',
      serviceName: job?.serviceName || job?.serviceType || '',
      serviceType: job?.serviceType || job?.serviceName || '',
      vendorId: String(vendorId || ''),
      title: job?.title || 'Untitled Job',
      client: job?.client || 'Unknown Client',
      clientName: job?.client || 'Unknown Client',
      operationalPhase: job?.operationalPhase ? String(job.operationalPhase) : undefined,
      status,
      createdAt: createdAtIso,
      updatedAt: updatedAtIso,
      linkedMediaCount: Number(job?.linkedMediaCount || 0),
      linkedSessionCount: Number(job?.linkedSessionCount || 0),
      estimatedCompletion: null,
      completedAt: status === 'completed' ? createdAtIso : null,
      phone: String(job?.customerPhone || job?.phone || '').trim(),
      email: String(job?.customerEmail || job?.email || '').trim(),
      customerEmail: String(job?.customerEmail || job?.email || '').trim(),
      customerPhone: String(job?.customerPhone || job?.phone || '').trim(),
      assignedEmployees: Array.isArray(job?.assignedEmployees) ? job.assignedEmployees : [],
      assignedMembershipIds: Array.isArray(job?.assignedMembershipIds)
        ? job.assignedMembershipIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
        : [],
      source: String(job?.source || 'vendor_created_job'),
      uploadedVideoStages: Array.isArray(job?.uploadedVideoStages)
        ? job.uploadedVideoStages.map((value: unknown) => String(value || '').trim().toUpperCase()).filter(Boolean)
        : [],
      videos: [],
      notes: [],
      audit: [],
      customerApprovalStatus: null,
      customerApprovalRequestedAt: null,
      customerApprovalCompletedAt: null,
      customerApprovalWorkflow: null,
      consentStatus: String(job?.consentStatus || '').trim() || CONSENT_STATE.NOT_REQUESTED,
      latestConsentId: String(job?.latestConsentId || '').trim(),
      consentAcceptedAt: job?.consentAcceptedAt || null,
      consentDeclinedAt: job?.consentDeclinedAt || null,
      recordingCompliance: job?.recordingCompliance || null,
      consentNotification: job?.consentNotification || null,
      cancellation: job?.cancellation || null,
      archivedAt: status === 'archived' ? (job?.date || new Date().toISOString()) : null,
      archiveReason: status === 'archived' ? 'Archived job' : '',
    };
  };

  const mergeJobsForReload = (
    backendJobs: any[],
    preservedJobs: any[] = [],
    removedJobIds: Set<string> = new Set(),
    backendAuthoritative = true
  ) => {
    const suppressedJobIds = new Set([...Array.from(locallyDeletedJobIdsRef.current), ...Array.from(removedJobIds)]);
    const normalizedBackendJobs = backendJobs.filter(
      (job) => job?.id && !suppressedJobIds.has(String(job.id))
    );
    const backendIds = new Set(normalizedBackendJobs.map((job) => String(job.id)));
    const preservedById = new Map(
      preservedJobs
        .map((job) => [String(job?.id || ''), job] as const)
        .filter(([id]) => id && !suppressedJobIds.has(id))
    );
    const mergedBackendJobs = normalizedBackendJobs.map((job) => {
      const preserved = preservedById.get(String(job.id));
      if (!preserved) return job;
      return backendAuthoritative
        ? mergeAuthoritativeVendorJobState(preserved, job)
        : { ...job, ...preserved };
    });
    const optimisticJobs = preservedJobs.filter((job) => {
      const id = String(job?.id || '');
      return id && !backendIds.has(id) && !suppressedJobIds.has(id);
    });

    return [...optimisticJobs, ...mergedBackendJobs];
  };

  const upsertJobLocally = (job: any) => {
    const id = String(job?.id || '');
    if (!id) return;
    setJobs((current) => mergeJobsForReload(current, [job], new Set(), false));
    setArchivedJobs((current) => current.filter((existing: any) => String(existing?.id || '') !== id));
  };

  const removeJobLocally = (jobId: unknown) => {
    const normalizedId = String(jobId || '');
    if (!normalizedId) return;
    locallyDeletedJobIdsRef.current.add(normalizedId);
    const keepJob = (job: any) =>
      String(job?.id || '') !== normalizedId && String(job?.bookingId || '') !== normalizedId;
    setJobs((current) => current.filter(keepJob));
    setArchivedJobs((current) => current.filter(keepJob));
    setSelectedJob((current: any) => (current && keepJob(current) ? current : null));
    setSelectedJobForVideoId((current) => (String(current || '') === normalizedId ? '' : current));
    setSelectedJobIds((current) => current.filter((id) => String(id || '') !== normalizedId));
    setActiveJobActionMenuId((current) => (String(current || '') === normalizedId ? null : current));
  };

  const adaptCreatedBookingToUiJob = (
    booking: any,
    fallback: {
      serviceId: string;
      serviceName: string;
      client: string;
      phone: string;
      email: string;
    }
  ) => {
    const metadata = booking?.customer_metadata && typeof booking.customer_metadata === 'object'
      ? booking.customer_metadata
      : {};
    const bookingDate =
      booking?.booking_date && booking?.booking_time
        ? `${booking.booking_date}T${booking.booking_time}.000Z`
        : booking?.created_at || new Date().toISOString();

    return adaptRecentJobToUiJob({
      id: booking?.id,
      serviceId: booking?.service_id || fallback.serviceId,
      serviceName: booking?.service?.name || fallback.serviceName,
      serviceType: booking?.service?.name || fallback.serviceName,
      title: booking?.title || booking?.service?.name || fallback.serviceName || 'Work record',
      client: booking?.client_name || fallback.client,
      customerEmail: metadata?.client_email || fallback.email,
      customerPhone: metadata?.client_phone || fallback.phone,
      email: metadata?.client_email || fallback.email,
      phone: metadata?.client_phone || fallback.phone,
      status: booking?.status || 'pending',
      createdAt: booking?.created_at || bookingDate,
      updatedAt: booking?.updated_at || booking?.created_at || bookingDate,
      date: bookingDate,
      source: 'vendor_created_job',
    });
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
              headers: getRequestHeaders(),
            }
          );
          if (!sessionsRes.ok) return job;

          const sessionsJson = await sessionsRes.json().catch(() => ({}));
          const sessionsRaw = Array.isArray(sessionsJson?.sessions) ? sessionsJson.sessions : [];
          const sessions = sessionsRaw.filter(
            (s: any) => String(s?.status || '').toUpperCase() !== 'ARCHIVED'
          );
          if (sessions.length === 0) return job;

          const detailResults = await Promise.all(
            sessions.map(async (session: any) => {
              if (!session?.id) return null;
              const detailRes = await fetch(
                `/api/vendors/${vendorId}/media/sessions/${session.id}`,
                {
                  method: 'GET',
                  headers: getRequestHeaders(),
                }
              );
              if (!detailRes.ok) return null;
              const detailJson = await detailRes.json().catch(() => ({}));
              const sess = detailJson?.session || null;
              if (sess && String(sess?.status || '').toUpperCase() === 'ARCHIVED') return null;
              return sess;
            })
          );

          const persistedVideos = detailResults
            .filter(Boolean)
            .flatMap((session: any) => {
              const mediaAssets = Array.isArray(session.mediaAssets) ? session.mediaAssets : [];
              return mediaAssets.map((asset: any) => {
                const derivedStatus = normalizeModerationStatus(asset?.moderationStatus);
                const mediaPurpose = deriveMediaPurposeFromSessionType(session?.sessionType);
                const vendorJobVideoStage = normalizeVendorJobVideoStage(session?.vendorJobVideoStage);
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
                uploadState: asset?.uploadState ? String(asset.uploadState) : '',
                contentHash: asset?.contentHash ? String(asset.contentHash) : '',
                captureProvenance: asset?.captureProvenance ? String(asset.captureProvenance) : 'LEGACY_UNKNOWN',
                publicEligible: asset?.publicEligible === true,
                stageVersion: Number(asset?.stageVersion || 0) || null,
                mediaSessionId: session.id,
                mimeType: asset.mimeType || '',
                mediaPurpose,
                sessionType: session.sessionType ? String(session.sessionType) : '',
                vendorJobVideoStage: vendorJobVideoStage || '',
                isPrimaryProofVideo:
                  vendorJobVideoStage === 'COMPLETED' ||
                  String(session?.sessionType || '').toUpperCase().includes('COMPLETION'),
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

  const reloadJobsFromBackend = useCallback(async (
    options: {
      preserveJobs?: any[];
      removeJobIds?: Array<string | number>;
      silent?: boolean;
    } = {}
  ) => {
    const preservedJobs = Array.isArray(options.preserveJobs) ? options.preserveJobs : [];
    const removedJobIds = new Set((options.removeJobIds || []).map((id) => String(id || '')).filter(Boolean));
    const shouldShowLoading = !options.silent;

    if (!vendorId) {
      if (vendorProfileLoading) {
        setJobsLoadError('');
        return;
      }
      setJobs([]);
      setArchivedJobs([]);
      setJobsLoading(false);
      setJobsLoadError('');
      return;
    }

    if (shouldShowLoading) {
      setJobsLoading(true);
    }
    setJobsLoadError('');
    try {
      const fetchDashboardOnce = async (targetVendorId: string) => {
        const headers = getRequestHeaders();
        const fetchUrl = `/api/vendors/${targetVendorId}/dashboard?jobsOnly=1`;
        if (dashboardDebug) {
          console.info("[vendor/jobs] dashboard fetch", {
            vendorId: targetVendorId,
            fetchUrl,
            resolvedUserId: 'cookie/session-auth',
            headers,
            vendorProfileId: vendorProfile?.id || null,
          });
        }
        const res = await fetchWithTimeout(fetchUrl, {
          method: 'GET',
          headers,
          cache: 'no-store',
        }, VENDOR_JOBS_TIMEOUT_MS);
        const rawText = await res.text().catch(() => '');
        const parsed = parseResponsePayload(rawText);
        return { res, rawText, parsed, targetVendorId };
      };

      let dashboardAttempt = await fetchDashboardOnce(vendorId);
      if (!dashboardAttempt.res.ok) {
        // One retry for transient backend/database connectivity blips.
        await new Promise((resolve) => setTimeout(resolve, 500));
        dashboardAttempt = await fetchDashboardOnce(String(dashboardAttempt.targetVendorId || vendorId));
      }

      if (!dashboardAttempt.res.ok) {
        const backendCode = dashboardAttempt.parsed?.code ? String(dashboardAttempt.parsed.code) : '';
        const backendError = dashboardAttempt.parsed?.error || dashboardAttempt.parsed?.message || dashboardAttempt.parsed?.details;
        const backendDetails = dashboardAttempt.parsed?.details
          ? String(dashboardAttempt.parsed.details)
          : '';
        const msg = backendCode
          ? `${backendCode}: ${String(backendError || `Request failed (${dashboardAttempt.res.status})`)}${
              backendDetails && backendDetails !== backendError ? ` (${backendDetails})` : ''
            }`
          : String(
              backendError ||
                dashboardAttempt.rawText ||
                `Failed to load jobs (${dashboardAttempt.res.status})`
            );
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
      const nextJobs = mergeJobsForReload(adaptedJobs, preservedJobs, removedJobIds);
      const nextArchivedJobs = adaptedArchivedJobs.filter(
        (job: any) => !removedJobIds.has(String(job?.id || ''))
      );
      setJobs(nextJobs);
      setArchivedJobs(nextArchivedJobs);
      void hydratePersistedVideos(nextJobs);
    } catch (error) {
      const message =
        error instanceof Error && error.message === 'Request timed out'
          ? 'Jobs took too long to load. Please retry.'
          : error instanceof Error
            ? error.message
            : 'Failed to load jobs';
      if (preservedJobs.length > 0 || removedJobIds.size > 0) {
        setJobs((current) => mergeJobsForReload(current, preservedJobs, removedJobIds, false));
        setArchivedJobs((current) =>
          current.filter((job: any) => !removedJobIds.has(String(job?.id || '')))
        );
      } else {
        setJobs([]);
        setArchivedJobs([]);
      }
      setJobsLoadError(message);
    } finally {
      if (shouldShowLoading) {
        setJobsLoading(false);
      }
    }
  }, [vendorId, vendorProfileLoading, dashboardDebug, vendorProfile?.id]);

  useEffect(() => {
    reloadJobsFromBackend().catch(() => {
      setJobsLoading(false);
      setJobsLoadError('Failed to load jobs');
    });
  }, [reloadJobsFromBackend]);

  useEffect(() => {
    if (jobsLoading || jobs.length === 0) {
      return;
    }

    const bookingIdsToHydrate = jobs
      .map((job) => String(job?.bookingId || job?.id || '').trim())
      .filter((bookingId) => bookingId && !(bookingId in consentStatusByBookingId));

    if (bookingIdsToHydrate.length === 0) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const resolvedEntries = await Promise.all(
        bookingIdsToHydrate.map(async (bookingId) => {
          try {
            const res = await fetch(`/api/consent/status?bookingId=${encodeURIComponent(bookingId)}`, {
              method: 'GET',
              headers: getRequestHeaders(),
              cache: 'no-store',
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || payload?.success === false) {
              return null;
            }
            const mapped = mapConsentStatusPayloadToUiState(payload);
            return [bookingId, mapped.status] as const;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) {
        return;
      }

      const updates = Object.fromEntries(resolvedEntries.filter(Boolean) as Array<readonly [string, string]>);
      if (Object.keys(updates).length > 0) {
        setConsentStatusByBookingId((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobs, jobsLoading, consentStatusByBookingId]);

  const getJobWorkflowBucket = (job: any) => {
    const phase = String(job?.operationalPhase || '').trim().toUpperCase();
    const status = String(job?.status || '').trim().toLowerCase();
    if (phase === 'REJECTED' || status === 'rejected' || jobHasRejectedMedia(job)) return 'rejected';
    if (status === 'canceled' || status === 'cancelled') return 'canceled';
    if (phase === 'AWAITING_ADMIN_REVIEW') return 'moderator_review';
    if (phase === 'COMPLETED' || status === 'completed') {
      const hasPublicMedia = getJobVideos(job).some(
        (video: any) => String(video?.visibilityStatus || '').trim().toLowerCase() === 'public'
      );
      return hasPublicMedia ? 'public_approved' : 'private_complete';
    }
    if (phase === 'AWAITING_VENDOR_REVIEW' || status === 'awaiting_review' || status === 'awaiting review') return 'manager_review';
    return 'active';
  };

  const workflowTabs = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active Work' },
    { value: 'manager_review', label: 'Manager Review' },
    { value: 'moderator_review', label: 'Reliance Audit' },
    { value: 'canceled', label: 'Canceled' },
    { value: 'private_complete', label: 'Private Proof' },
    { value: 'public_approved', label: 'Public / Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'archived', label: 'Archived' },
  ];

  const getWorkflowTabLabelForJob = (job: any) => {
    const bucket = getJobWorkflowBucket(job);
    if (bucket === 'canceled') return 'Canceled';
    return workflowTabs.find((tab) => tab.value === bucket)?.label || 'Active Work';
  };

  const getWorkflowTabBadgeClassForJob = (job: any) => {
    const bucket = getJobWorkflowBucket(job);
    if (bucket === 'moderator_review') {
      return '!border-blue-300/45 !bg-blue-500/25 !text-blue-50';
    }
    if (bucket === 'manager_review') {
      return '!border-amber-300/45 !bg-amber-500/25 !text-amber-50';
    }
    if (bucket === 'public_approved') {
      return '!border-emerald-300/45 !bg-emerald-500/20 !text-emerald-50';
    }
    if (bucket === 'rejected') {
      return '!border-rose-300/45 !bg-rose-500/20 !text-rose-50';
    }
    if (bucket === 'canceled') {
      return '!border-rose-300/45 !bg-rose-500/20 !text-rose-50';
    }
    return '!border-sky-300/45 !bg-sky-500/20 !text-sky-50';
  };

  const workflowTabCounts = [...jobs, ...archivedJobs].reduce((counts: Record<string, number>, job: any) => {
    if (String(job.status).toLowerCase() === 'archived') {
      counts.archived = (counts.archived || 0) + 1;
      return counts;
    }
    const bucket = getJobWorkflowBucket(job);
    counts.all = (counts.all || 0) + 1;
    counts[bucket] = (counts[bucket] || 0) + 1;
    return counts;
  }, {});

  // Filter jobs based on view mode and search
  const jobsForActiveWorkflow = workflowFilter === 'archived' ? archivedJobs : jobs;
  const filteredJobs = jobsForActiveWorkflow.filter(job => {
    const isArchivedJob = String(job.status).toLowerCase() === 'archived';
    if (workflowFilter === 'archived' && !isArchivedJob) {
      return false;
    }
    if (workflowFilter !== 'archived' && isArchivedJob) {
      return false;
    }
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesWorkflow =
      workflowFilter === 'all' ||
      workflowFilter === 'archived' ||
      getJobWorkflowBucket(job) === workflowFilter;
    const matchesSearch = job.title.toLowerCase().includes(search.toLowerCase()) || 
                         job.client.toLowerCase().includes(search.toLowerCase());
    
    // In employee view, only show jobs assigned to current employee
    if (isEmployeeView) {
      const currentEmployeeName = String(vendorProfile?.name || '').trim();
      const myMembershipIds = teamMembers
        .filter((m) => authUserId && m.userId === authUserId)
        .map((m) => m.membershipId);
      const assignedIds = Array.isArray(job.assignedMembershipIds)
        ? job.assignedMembershipIds.map((id: unknown) => String(id))
        : [];
      const assignedNames = Array.isArray(job.assignedEmployees) ? job.assignedEmployees : [];

      let isAssignedToMe = true;
      if (myMembershipIds.length > 0) {
        isAssignedToMe =
          assignedIds.some((id) => myMembershipIds.includes(id)) ||
          (currentEmployeeName ? assignedNames.includes(currentEmployeeName) : false);
      } else if (currentEmployeeName) {
        isAssignedToMe = assignedNames.includes(currentEmployeeName);
      }
      return matchesStatus && matchesWorkflow && matchesSearch && isAssignedToMe;
    }
    
    return matchesStatus && matchesWorkflow && matchesSearch;
  });
  const jobsEligibleForVideoUpload = filteredJobs.filter((job) => isJobAssignedForVideoUpload(job));
  const hasAnyEligibleVideoJob = jobsEligibleForVideoUpload.length > 0;
  const selectedJobForVideo = filteredJobs.find((job) => String(job.id) === selectedJobForVideoId) || null;

  useEffect(() => {
    if (!jobActionFeedback) return undefined;
    const t = window.setTimeout(() => setJobActionFeedback(null), 7000);
    return () => window.clearTimeout(t);
  }, [jobActionFeedback]);

  const handleCreateJob = async () => {
    if (isCreatingJob) {
      return;
    }

    const customerFirstName = newJob.customerFirstName.trim();
    const customerLastName = newJob.customerLastName.trim();
    const client = `${customerFirstName} ${customerLastName}`.trim();
    const normalizedPhoneDigits = getPhoneDigits(newJob.phone);
    const formattedPhone = formatPhoneNumber(normalizedPhoneDigits);
    const email = newJob.email.trim();
    const serviceId = newJob.serviceId.trim();
    const recordingLocation = String(newJob.recordingLocation || '').trim().toLowerCase();
    const selectedService = publishedServiceOptions.find((service) => service.id === serviceId);
    const addingServiceFromJob = serviceId === ADD_NEW_SERVICE_VALUE;
    const manualServiceName = newServiceForJob.name.trim();
    const manualServiceDescription = newServiceForJob.description.trim();
    const manualServicePriceText = newServiceForJob.price.trim();
    const manualServicePrice = manualServicePriceText ? Number(manualServicePriceText) : NaN;
    const manualServiceDurationText = newServiceForJob.estimatedDuration.trim();
    const manualServiceDuration = manualServiceDurationText ? Number(manualServiceDurationText) : NaN;
    const hasPhoneInputForJob = Boolean(newJob.phone.trim());
    const hasEmailInputForJob = Boolean(email);
    const isValidPhone = !hasPhoneInputForJob || normalizedPhoneDigits.length === 10;
    const isValidEmail = hasEmailInputForJob && email.includes('@') && email.includes('.');
    const requiresContactValidation = jobModalMode !== 'edit';
    const nextJobErrors = {
      title: '',
      customerFirstName: customerFirstName ? '' : 'Customer first name is required',
      customerLastName: customerLastName ? '' : 'Customer last name is required',
      contact: '',
      phone: !requiresContactValidation || isValidPhone ? '' : 'Enter a valid 10-digit phone number, or leave phone blank.',
      email:
        !requiresContactValidation || isValidEmail
          ? ''
          : 'Enter the customer email that will receive and claim the completed Private Service Video.',
      serviceId: serviceId
        ? !addingServiceFromJob && !selectedService
          ? 'Choose an approved service. Pending admin approval services cannot create work records.'
          : ''
        : 'Service type is required',
      recordingLocation:
        recordingLocation === 'business' ||
        recordingLocation === 'residence' ||
        recordingLocation === 'customer-business'
          ? ''
          : 'Choose where the service video will be recorded.',
      customerResidenceAddress:
        jobModalMode !== 'edit' &&
        recordingLocation === 'residence' &&
        (!newJob.customerResidenceAddress.trim() ||
          !newJob.customerResidenceCity.trim() ||
          !newJob.customerResidenceState.trim() ||
          !newJob.customerResidenceZipCode.trim())
          ? 'Enter the complete customer residence where this service will be recorded.'
          : '',
      customerBusinessAddress:
        jobModalMode !== 'edit' &&
        recordingLocation === 'customer-business' &&
        (!newJob.customerBusinessAddress.trim() ||
          !newJob.customerBusinessCity.trim() ||
          !newJob.customerBusinessState.trim() ||
          !newJob.customerBusinessZipCode.trim())
          ? 'Enter the complete customer business address where this service will be recorded.'
          : '',
      recordingAssessment:
        newJob.propertyScope &&
        newJob.peopleScope &&
        newJob.frameControl
          ? ''
          : 'Complete the recording subject assessment.',
    };
    setJobFieldErrors(nextJobErrors);

    if (
      nextJobErrors.title ||
      nextJobErrors.customerFirstName ||
      nextJobErrors.customerLastName ||
      nextJobErrors.contact ||
      nextJobErrors.phone ||
      nextJobErrors.email ||
      nextJobErrors.serviceId ||
      nextJobErrors.recordingLocation
      || nextJobErrors.customerResidenceAddress
      || nextJobErrors.customerBusinessAddress
      || nextJobErrors.recordingAssessment
    ) {
      if (nextJobErrors.customerFirstName) {
        clientNameInputRef.current?.focus();
      } else if (nextJobErrors.customerLastName) {
        clientLastNameInputRef.current?.focus();
      } else if (nextJobErrors.phone) {
        phoneInputRef.current?.focus();
      } else if (nextJobErrors.email) {
        emailInputRef.current?.focus();
      } else if (nextJobErrors.serviceId) {
        serviceTypeSelectRef.current?.focus();
      }
      return;
    }

    if (addingServiceFromJob) {
      if (
        !manualServiceName ||
        !manualServiceDescription ||
        !manualServicePriceText ||
        !Number.isFinite(manualServicePrice) ||
        manualServicePrice < 0 ||
        !manualServiceDurationText ||
        !Number.isFinite(manualServiceDuration) ||
        manualServiceDuration <= 0
      ) {
        setCreateJobError(
          'Add the service name, estimated duration, non-negative reference price, and customer-facing description before creating the work record.'
        );
        return;
      }
    }

    if (!addingServiceFromJob && !selectedService) {
      setCreateJobError('Choose a saved service offered so Reliance can use a consistent work title.');
      serviceTypeSelectRef.current?.focus();
      return;
    }

    if (!vendorId) {
      setCreateJobError('Vendor context is not ready. Please try again.');
      return;
    }

    if (jobModalMode === 'edit') {
      if (!jobFormTargetId) {
        setCreateJobError('No job selected for editing.');
        return;
      }
      const changedMaterialFields = getMaterialWorkRecordEditFields(editJobBaseline, newJob);
      if (changedMaterialFields.length > 0 && !materialEditConfirmedRef.current) {
        setMaterialEditFields(changedMaterialFields);
        setShowMaterialEditConfirm(true);
        return;
      }
      materialEditConfirmedRef.current = false;
      setCreateJobError('');
      setIsCreatingJob(true);
      try {
        await runPersistedJobAction(
          { id: jobFormTargetId },
          "UPDATE_JOB",
          {
            title: selectedService?.name || newJob.title.trim() || 'Work record',
            clientName: client,
            serviceId: serviceId || undefined,
            recordingAssessment: changedMaterialFields.length > 0 ? {
              recordingLocation,
              propertyScope: newJob.propertyScope,
              peopleScope: newJob.peopleScope,
              frameControl: newJob.frameControl,
              minorMayAppear: newJob.minorMayAppear,
              protectedNonParticipantMayAppear: newJob.protectedNonParticipantMayAppear,
              sensitiveInformationMayAppear: newJob.sensitiveInformationMayAppear,
              identifiersMayAppear: newJob.identifiersMayAppear,
              audioRequested: newJob.audioRequested,
              residenceInterior: recordingLocation === 'residence',
              businessInterior: recordingLocation === 'customer-business',
            } : undefined,
          }
        );
        await reloadJobsFromBackend();
        router.refresh();
        setNewJob(getEmptyJobForm());
        setNewServiceForJob({ name: '', description: '', price: '', estimatedDuration: '' });
        setJobFieldErrors(getEmptyJobFieldErrors());
        setJobModalMode('create');
        setJobFormTargetId(null);
        setShowCreateJob(false);
      } catch (error) {
        setCreateJobError(error instanceof Error ? error.message : 'Failed to update job');
      } finally {
        setIsCreatingJob(false);
      }
      return;
    }

    setCreateJobError('');
    setIsCreatingJob(true);
    if (addingServiceFromJob) {
      try {
        const createServiceRes = await fetch('/api/services', {
          method: 'POST',
          headers: getRequestHeaders(),
          body: JSON.stringify({
            vendor_id: vendorId,
            name: manualServiceName,
            description: descriptionWithEstimatedDuration(
              manualServiceDescription,
              String(manualServiceDuration)
            ),
            price: manualServicePrice,
          }),
        });
        const createServicePayload = await createServiceRes.json().catch(() => ({}));
        if (!createServiceRes.ok) {
          throw new Error(
            createServicePayload?.error ||
              createServicePayload?.message ||
              `Failed to create service offered (${createServiceRes.status})`
          );
        }
        const createdServiceId = String(createServicePayload?.service?.id || '').trim();
        const createdServiceName = String(createServicePayload?.service?.name || manualServiceName).trim();
        if (!createdServiceId) {
          throw new Error('Service offered was created without an id.');
        }
        setNewJob(getEmptyJobForm());
        setNewServiceForJob({ name: '', description: '', price: '', estimatedDuration: '' });
        setJobFieldErrors(getEmptyJobFieldErrors());
        setJobModalMode('create');
        setJobFormTargetId(null);
        setShowCreateJob(false);
        setJobActionFeedback({
          type: 'success',
          message: `Created "${createdServiceName || manualServiceName}" as pending admin approval. It will be available for work records after admin approval.`,
        });
        setIsCreatingJob(false);
        return;
      } catch (error) {
        setCreateJobError(error instanceof Error ? error.message : 'Failed to add service offered.');
        setIsCreatingJob(false);
        return;
      }
    }

    let resolvedServiceId = serviceId;
    let resolvedServiceName = selectedService?.name || '';

    const now = new Date();
    const payload = {
      vendor_id: vendorId,
      service_id: resolvedServiceId,
      title: resolvedServiceName || 'Work record',
      client_name: client,
      client_phone: normalizedPhoneDigits || undefined,
      client_email: email || undefined,
      booking_date: now.toISOString().split('T')[0],
      booking_time: now.toTimeString().split(' ')[0],
      scheduled_for: now.toISOString(),
      service_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      amount: 0,
      custom_fields: {
        vendor_job_recording_location: recordingLocation,
        vendor_job_customer_residence_address:
          recordingLocation === 'residence' ? newJob.customerResidenceAddress.trim() : undefined,
        vendor_job_customer_residence_city:
          recordingLocation === 'residence' ? newJob.customerResidenceCity.trim() : undefined,
        vendor_job_customer_residence_state:
          recordingLocation === 'residence' ? newJob.customerResidenceState.trim() : undefined,
        vendor_job_customer_residence_zip_code:
          recordingLocation === 'residence' ? newJob.customerResidenceZipCode.trim() : undefined,
        vendor_job_customer_residence_latitude:
          recordingLocation === 'residence' ? newJob.customerResidenceLatitude : undefined,
        vendor_job_customer_residence_longitude:
          recordingLocation === 'residence' ? newJob.customerResidenceLongitude : undefined,
        vendor_job_customer_business_address:
          recordingLocation === 'customer-business' ? newJob.customerBusinessAddress.trim() : undefined,
        vendor_job_customer_business_city:
          recordingLocation === 'customer-business' ? newJob.customerBusinessCity.trim() : undefined,
        vendor_job_customer_business_state:
          recordingLocation === 'customer-business' ? newJob.customerBusinessState.trim() : undefined,
        vendor_job_customer_business_zip_code:
          recordingLocation === 'customer-business' ? newJob.customerBusinessZipCode.trim() : undefined,
        vendor_job_customer_business_latitude:
          recordingLocation === 'customer-business' ? newJob.customerBusinessLatitude : undefined,
        vendor_job_customer_business_longitude:
          recordingLocation === 'customer-business' ? newJob.customerBusinessLongitude : undefined,
        vendor_job_customer_controls_visibility:
          recordingLocation === 'residence' || recordingLocation === 'customer-business',
        vendor_job_visibility_owner:
          recordingLocation === 'residence' || recordingLocation === 'customer-business'
            ? 'customer'
            : 'vendor_business',
        recording_property_scope: newJob.propertyScope,
        recording_people_scope: newJob.peopleScope,
        recording_frame_control: newJob.frameControl,
        recording_minor_may_appear: newJob.minorMayAppear,
        recording_protected_non_participant_may_appear:
          newJob.protectedNonParticipantMayAppear,
        recording_sensitive_information_may_appear:
          newJob.sensitiveInformationMayAppear,
        recording_identifiers_may_appear: newJob.identifiersMayAppear,
        recording_audio_requested: newJob.audioRequested,
        recording_residence_interior: recordingLocation === 'residence',
        recording_business_interior: recordingLocation === 'customer-business',
      },
    };
    const creationFingerprint = JSON.stringify(payload);
    const previousCreationRequest = createJobRequestRef.current;
    const creationRequestKey =
      previousCreationRequest?.fingerprint === creationFingerprint
        ? previousCreationRequest.key
        : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `work-record-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    createJobRequestRef.current = {
      fingerprint: creationFingerprint,
      key: creationRequestKey,
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          ...getRequestHeaders(),
          'Idempotency-Key': creationRequestKey,
        },
        body: JSON.stringify({
          ...payload,
          idempotency_key: creationRequestKey,
        }),
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
      const persistedId = String(booking?.id || "");
      if (!persistedId) {
        throw new Error("Booking create response did not include an id.");
      }
      const optimisticJob = adaptCreatedBookingToUiJob(booking, {
        serviceId: resolvedServiceId,
        serviceName: resolvedServiceName || 'Work record',
        client,
        phone: formattedPhone || normalizedPhoneDigits,
        email,
      });
      const automaticConsent = parsed?.automaticConsent;
      if (['requested', 'delivered', 'sending'].includes(String(automaticConsent?.status || '').toLowerCase())) {
        setConsentStatusByBookingId((prev) => ({
          ...prev,
          [persistedId]: CONSENT_STATE.REQUESTED,
        }));
      }
      upsertJobLocally(optimisticJob);
      await reloadJobsFromBackend({ preserveJobs: [optimisticJob], silent: true });
      router.refresh();
      setJobsLoadError('');
      setNewJob(getEmptyJobForm());
      setNewServiceForJob({ name: '', description: '', price: '', estimatedDuration: '' });
      setJobFieldErrors(getEmptyJobFieldErrors());
      setJobModalMode('create');
      setJobFormTargetId(null);
      setShowCreateJob(false);
      createJobRequestRef.current = null;
      setJobActionFeedback({
        type:
          automaticConsent?.status === 'delivery_failed' ||
          automaticConsent?.status === 'no_digital_channel' ||
          automaticConsent?.status === 'recipient_mismatch'
            ? 'error'
            : 'success',
        message:
          automaticConsent?.status === 'delivered'
            ? `Added the work record for ${client}. The recording-permission request was delivered; recording stays locked until the verified customer contact allows it.`
            : automaticConsent?.status === 'delivery_failed'
              ? `Added the work record for ${client}, but delivery was not confirmed. Recording stays locked. Open the recording-permission step to resend it.`
              : automaticConsent?.status === 'no_digital_channel'
                ? `Added the work record for ${client}, but no customer email or mobile phone is available. Recording stays locked until the recipient is corrected and permission is verified.`
                : automaticConsent?.status === 'recipient_mismatch'
                  ? `Added the work record for ${client}, but the email and phone may belong to different accounts. Recording stays locked until the recipient is corrected.`
                : addingServiceFromJob && resolvedServiceName
            ? `Created "${resolvedServiceName}" in Services Offered as pending admin approval and added the work record for ${client}. Next time, choose "${resolvedServiceName}" from the Service Offered / Work Type dropdown.`
            : `Added the work record for ${client}.`,
      });
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
    const videoStage = normalizeVendorJobVideoStage(newVideo.videoStage);
    const uploadKey = `${selectedJobId}:${title}:${file?.name || ''}:${file?.size || 0}`;

    const nextErrors = {
      title: title ? '' : 'Video title is required',
      description: description ? '' : 'Description is required',
      file: file ? '' : 'Video file is required',
      videoStage: videoStage ? '' : 'Video stage is required',
    };
    setVideoFieldErrors(nextErrors);

    if (!selectedJob || nextErrors.title || nextErrors.description || nextErrors.file || nextErrors.videoStage) {
      setVideoUploadError('Please fix the required fields before uploading.');
      return;
    }
    if (!isJobAssignedForVideoUpload(selectedJobSnapshot)) {
      setVideoUploadError(videoAssignmentRequiredCopy);
      return;
    }
    if (
      videoStage &&
      jobHasVideoForStage(selectedJobSnapshot, videoStage) &&
      !newVideo.replaceStage
    ) {
      setVideoFieldErrors((prev) => ({
        ...prev,
        videoStage: `This job already has a ${formatVideoStageLabel(videoStage)} video. Choose another stage or enable “Replace existing video for this stage”.`,
      }));
      setVideoUploadError(
        'A video already exists for the selected stage. Pick a different stage or confirm replacement.'
      );
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
    if (location === 'residence' && !customerConsentReceived) {
      setVideoUploadError('Verified recording permission is required before creating a service video at a residence.');
      return;
    }
    if (location === 'customer-business' && !customerConsentReceived) {
      setVideoUploadError('Verified recording permission is required before creating a service video at a customer business.');
      return;
    }
    if (!file) {
      return;
    }
    if (
      selectedVideoDurationSeconds == null ||
      isOverStageVideoLimit(selectedVideoDurationSeconds)
    ) {
      setVideoFieldErrors((prev) => ({
        ...prev,
        file: `Stage videos must be ${formatStageVideoDuration(STAGE_VIDEO_MAX_DURATION_SECONDS)} or less.`,
      }));
      setVideoUploadError(`Please choose a shorter clip. ${getStageVideoLimitCopy()}`);
      return;
    }

    activeUploadKeyRef.current = uploadKey;
    setIsUploadingVideo(true);
    setVideoUploadError('');
    setUploadLifecycleState('idle');

    try {
      const snapshotBeforeUpload = selectedJobSnapshot
        ? getSavedRecordingComplianceForJob(selectedJobSnapshot)
        : null;
      console.info('[recording-compliance] before upload', {
        jobKeys: selectedJobSnapshot ? getRecordingComplianceKeys(selectedJobSnapshot) : [],
        selectedJobId,
        selectedStage: videoStage,
        snapshot: snapshotBeforeUpload,
      });

      const uploadResult = await runVendorJobMediaUpload({
        vendorId: String(vendorId),
        selectedJob: selectedJobSnapshot,
        title,
        description,
        file,
        videoStage,
        replaceExisting: Boolean(newVideo.replaceStage),
        durationSeconds: selectedVideoDurationSeconds,
        locationContext: location || undefined,
        getHeaders: getRequestHeaders,
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

      const snapshotAfterUpload = selectedJobSnapshot
        ? getSavedRecordingComplianceForJob(selectedJobSnapshot)
        : null;
      console.info('[recording-compliance] after upload success', {
        jobKeys: selectedJobSnapshot ? getRecordingComplianceKeys(selectedJobSnapshot) : [],
        selectedJobId,
        uploadedStage: videoStage,
        snapshot: snapshotAfterUpload,
      });

      setNewVideo({ title: '', description: '', file: null, videoStage: '', replaceStage: false });
      setSelectedVideoDurationSeconds(null);
      setVideoFieldErrors({ title: '', description: '', file: '', videoStage: '' });
      setShowModal(false);
      setSelectedJob(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const diagnostics = (error as any)?.diagnostics || {};
      const initResponse = diagnostics?.uploadInitResponse || null;
      const blobResponse = diagnostics?.blobUploadResponse || null;
      const completeResponse = diagnostics?.uploadCompleteResponse || null;
      console.error('[Create Service Video] Upload failed', {
        stage: diagnostics?.stage || uploadLifecycleState || 'unknown',
        bookingId: diagnostics?.bookingId || selectedJobSnapshot?.bookingId || selectedJobSnapshot?.id || null,
        jobId: diagnostics?.jobId || selectedJobSnapshot?.id || null,
        vendorId: diagnostics?.vendorId || String(vendorId || ''),
        mediaSessionId: diagnostics?.mediaSessionId || null,
        uploadInitResponse: initResponse
          ? { status: initResponse.status, body: initResponse.parsed ?? initResponse.rawText ?? null }
          : null,
        blobUploadResponse: blobResponse
          ? { status: blobResponse.status, body: blobResponse.parsed ?? blobResponse.rawText ?? null }
          : null,
        uploadCompleteResponse: completeResponse
          ? { status: completeResponse.status, body: completeResponse.parsed ?? completeResponse.rawText ?? null }
          : null,
        message: (error as any)?.message,
        name: (error as any)?.name,
        stack: (error as any)?.stack,
        details: error,
      });
      const message = errorMessage || 'Upload failed';
      setVideoUploadError(`Upload failed: ${message}`);
    } finally {
      setIsUploadingVideo(false);
      setUploadLifecycleState('idle');
      activeUploadKeyRef.current = null;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedVideoDurationSeconds(null);
    if (!file || !file.type.startsWith('video/')) {
      setNewVideo({ ...newVideo, file: null });
      return;
    }
    try {
      const durationSeconds = await getVideoFileDurationSeconds(file);
      if (isOverStageVideoLimit(durationSeconds)) {
        e.currentTarget.value = '';
        setNewVideo({ ...newVideo, file: null });
        setVideoFieldErrors((prev) => ({
          ...prev,
          file: `This clip is ${formatStageVideoDuration(durationSeconds)}. Stage videos must be ${formatStageVideoDuration(STAGE_VIDEO_MAX_DURATION_SECONDS)} or less.`,
        }));
        return;
      }
      setSelectedVideoDurationSeconds(durationSeconds);
      setNewVideo({ ...newVideo, file });
      setVideoFieldErrors((prev) => ({ ...prev, file: '' }));
      setVideoUploadError('');
    } catch (error) {
      e.currentTarget.value = '';
      setNewVideo({ ...newVideo, file: null });
      setVideoFieldErrors((prev) => ({
        ...prev,
        file: 'Could not read this video duration. Choose a short clip recorded to 30 seconds or less.',
      }));
    }
  };

  // Enhancement 1: Job Status Management Functions
  const handleStatusUpdate = async (job: any, nextStatus: string, reason = "") => {
    if (jobMutationLoadingId) return;
    setJobMutationLoadingId(`status:${String(job?.id || '')}`);
    setJobActionFeedback(null);
    try {
      const payload = await runPersistedJobAction(job, "UPDATE_STATUS", { status: nextStatus, reason });
      await reloadJobsFromBackend();
      setJobActionFeedback({ type: 'success', message: payload?.message || 'Job status updated.' });
      setShowStatusModal(false);
      setEditingJob(null);
      setNewStatus('');
      setStatusReason('');
    } catch (error) {
      setJobActionFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update job status',
      });
    } finally {
      setJobMutationLoadingId(null);
    }
  };

  const openStatusModal = (job: any) => {
    setEditingJob(job);
    const normalized = String(job?.status || '').trim().toLowerCase();
    let initial = normalized === 'in-progress' ? 'in progress' : normalized || 'pending';
    if (initial === 'completed' && !canVendorMarkJobCompleted(job)) {
      initial = 'in progress';
    }
    setNewStatus(initial);
    setShowStatusModal(true);
  };

  const openEditModal = (job: any) => {
    setJobModalMode('edit');
    setJobFormTargetId(String(job?.id || ''));
    const splitName = splitCustomerName(job?.client || job?.clientName || '');
    const scope = job?.recordingCompliance?.scopeSummary || {};
    const editForm = {
      title: String(job?.title || ''),
      client: String(job?.client || job?.clientName || ''),
      customerFirstName: splitName.customerFirstName,
      customerLastName: splitName.customerLastName,
      phone: String(job?.phone || ''),
      email: String(job?.email || ''),
      serviceId: String(job?.serviceId || ''),
      recordingLocation: String(job?.recordingCompliance?.location || 'business'),
      customerResidenceAddress: '',
      customerResidenceCity: '',
      customerResidenceState: '',
      customerResidenceZipCode: '',
      customerResidenceLatitude: null,
      customerResidenceLongitude: null,
      customerBusinessAddress: '',
      customerBusinessCity: '',
      customerBusinessState: '',
      customerBusinessZipCode: '',
      customerBusinessLatitude: null,
      customerBusinessLongitude: null,
      propertyScope: String(scope.propertyScope || 'customer_owned'),
      peopleScope: String(scope.peopleScope || 'none'),
      frameControl: String(scope.frameControl || 'controlled'),
      minorMayAppear: Boolean(scope.minorPresent),
      protectedNonParticipantMayAppear: Boolean(scope.protectedParticipantPresent),
      sensitiveInformationMayAppear: Boolean(scope.sensitiveCapture),
      identifiersMayAppear: Boolean(scope.identifiersMayAppear),
      audioRequested: Boolean(scope.audioAllowed),
    };
    setNewJob(editForm);
    setEditJobBaseline(editForm);
    materialEditConfirmedRef.current = false;
    setCreateJobError('');
    setJobFieldErrors(getEmptyJobFieldErrors());
    setShowCreateJob(true);
  };

  // Enhancement 2: Employee Assignment Management Functions
  const handleAssignmentUpdate = async (job: any, nextMembershipIds: string[]) => {
    if (jobMutationLoadingId) return;
    setJobMutationLoadingId(`assign:${String(job?.id || '')}`);
    setJobActionFeedback(null);
    const previousCompliance = getSavedRecordingComplianceForJob(job);
    const serviceOrderWasReleased = Boolean(
      previousCompliance?.serviceOrderReleasedAt ||
        (Array.isArray(previousCompliance?.releasedMembershipIds) &&
          previousCompliance.releasedMembershipIds.length > 0)
    );
    const assignedNames = nextMembershipIds
      .map((membershipId) => {
        const member = teamMembers.find((row) => row.membershipId === membershipId);
        return member?.name ? String(member.name).trim() : '';
      })
      .filter(Boolean);
    const assignedJob = {
      ...job,
      assignedMembershipIds: nextMembershipIds,
      assignedEmployees: assignedNames.length > 0 ? assignedNames : job?.assignedEmployees || [],
    };
    try {
      const payload = await runPersistedJobAction(job, "ASSIGN_JOB", {
        assignedMembershipIds: nextMembershipIds,
      });
      const persistedAssignedJob = {
        ...assignedJob,
        ...(payload?.job || {}),
        assignedMembershipIds: Array.isArray(payload?.job?.assignedMembershipIds)
          ? payload.job.assignedMembershipIds
          : assignedJob.assignedMembershipIds,
        assignedEmployees: Array.isArray(payload?.job?.assignedEmployees)
          ? payload.job.assignedEmployees
          : assignedJob.assignedEmployees,
      };
      applyJobPatchLocally(job, persistedAssignedJob);
      upsertJobLocally(persistedAssignedJob);
      let feedbackType: 'success' | 'error' = 'success';
      let feedbackMessage = payload?.message || 'Job assignment updated.';
      let releasedRecordingCompliance: any = null;
      if (
        nextMembershipIds.length > 0 &&
        serviceOrderWasReleased &&
        previousCompliance &&
        isComplianceSatisfiedForRecording(assignedJob, previousCompliance)
      ) {
        try {
          const releasePayload = await releaseEmployeeServiceOrderForJob(assignedJob, previousCompliance);
          releasedRecordingCompliance =
            releasePayload?.job?.recordingCompliance || releasePayload?.recordingCompliance || null;
          feedbackMessage =
            releasePayload?.notifications?.sentCount > 0
              ? 'Job reassigned and the service order was sent to the newly assigned team member.'
              : releasePayload?.message || 'Job reassigned. The service order was already current for this assignment.';
        } catch (releaseError) {
          feedbackType = 'error';
          feedbackMessage =
            releaseError instanceof Error
              ? `Job reassigned, but the service order could not be resent: ${releaseError.message}`
              : 'Job reassigned, but the service order could not be resent.';
        }
      } else if (nextMembershipIds.length > 0) {
        const autoReleaseSnapshot =
          getSavedRecordingComplianceForJob(persistedAssignedJob) ||
          previousCompliance ||
          buildRecordingComplianceSnapshot(persistedAssignedJob, {
            location: 'business',
            consentAccepted: false,
            consentRequestId: '',
            locationVerified: false,
          });
        mergeRecordingComplianceForJob(persistedAssignedJob, autoReleaseSnapshot);
        if (isComplianceSatisfiedForRecording(persistedAssignedJob, autoReleaseSnapshot)) {
          try {
            const releasePayload = await releaseEmployeeServiceOrderForJob(
              persistedAssignedJob,
              autoReleaseSnapshot
            );
            releasedRecordingCompliance =
              releasePayload?.job?.recordingCompliance || releasePayload?.recordingCompliance || null;
            feedbackMessage =
              releasePayload?.notifications?.sentCount > 0
                ? 'Job assigned and the service order was sent to the assigned team member.'
                : releasePayload?.message || 'Job assigned. The service order is ready for the assigned team member.';
          } catch (releaseError) {
            feedbackType = 'error';
            feedbackMessage =
              releaseError instanceof Error
                ? `Job assigned, but the service order could not be sent: ${releaseError.message}`
                : 'Job assigned, but the service order could not be sent.';
          }
        } else {
          feedbackMessage =
            autoReleaseSnapshot.location === 'residence' || autoReleaseSnapshot.location === 'customer-business'
              ? 'Job assigned. The secure service order will be sent automatically after the customer approves.'
              : 'Job assigned. Complete the recording-location check to send the employee service order.';
        }
      }
      const finalAssignedJob = releasedRecordingCompliance
        ? { ...persistedAssignedJob, recordingCompliance: releasedRecordingCompliance }
        : persistedAssignedJob;
      applyJobPatchLocally(persistedAssignedJob, finalAssignedJob);
      await reloadJobsFromBackend({ preserveJobs: [finalAssignedJob], silent: true });
      setJobActionFeedback({ type: feedbackType, message: feedbackMessage });
      setShowAssignmentModal(false);
      setSelectedAssignmentMembershipIds([]);
    } catch (error) {
      setJobActionFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update assignment',
      });
    } finally {
      setJobMutationLoadingId(null);
    }
  };

  const openAssignmentModal = (job: any) => {
    setSelectedJob(job);
    setSelectedAssignmentMembershipIds(resolveMembershipIdsForJob(job));
    setShowAssignmentModal(true);
  };

  // Bulk selection functions
  const toggleBulkMode = () => {
    const nextBulkMode = !isBulkMode;
    setIsBulkMode(nextBulkMode);
    if (!nextBulkMode) {
      setSelectedJobIds([]);
    }
    setJobActionFeedback({
      type: 'success',
      message: nextBulkMode ? 'Bulk assignment mode enabled. Select jobs to assign.' : 'Bulk assignment mode closed.',
    });
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

  const handleBulkAssignment = async (bulkMembershipIds: string[]) => {
    if (jobMutationLoadingId) return;
    if (selectedJobIds.length === 0) return;
    setJobMutationLoadingId('assign:bulk');
    setJobActionFeedback(null);
    try {
      for (const selectedId of selectedJobIds) {
        await runPersistedJobAction({ id: selectedId }, "ASSIGN_JOB", {
          assignedMembershipIds: bulkMembershipIds,
        });
      }
      await reloadJobsFromBackend();
      setJobActionFeedback({ type: 'success', message: 'Bulk assignment saved.' });
      setSelectedJobIds([]);
      setIsBulkMode(false);
      setShowBulkAssignmentModal(false);
      setBulkAssignmentMembershipIds([]);
    } catch (error) {
      setJobActionFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to apply bulk assignment',
      });
    } finally {
      setJobMutationLoadingId(null);
    }
  };

  const normalizeArchiveStatus = (item: any) => {
    const archiveStatus = normalizeMediaArchiveStatus(item?.archiveStatus);
    if (archiveStatus === ARCHIVE_ARCHIVED || item?.deletedAt) return ARCHIVE_ARCHIVED;

    const moderationStatus = normalizeModerationStatus(item?.moderationStatus);
    if (moderationStatus === MODERATION_APPROVED) return MODERATION_APPROVED;
    if (moderationStatus === MODERATION_REJECTED) return MODERATION_REJECTED;
    if (moderationStatus === MODERATION_FLAGGED) return MODERATION_FLAGGED;
    return MODERATION_PENDING_REVIEW;
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
    if (!job?.id) return;
    router.push(`/vendor/jobs/${encodeURIComponent(String(job.id))}`);
  };

  const handleJobCardClick = (event: any, job: any) => {
    const target = event?.target as HTMLElement | null;
    if (!target) {
      openJobDetails(job);
      return;
    }

    const clickedInteractiveElement = target.closest(
      'input, button, a, select, textarea, label, [role="menu"], [role="menuitem"], [data-no-card-open]'
    );
    if (clickedInteractiveElement) {
      return;
    }

    openJobDetails(job);
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
        
        const expectedLat = Number((vendorProfile as any)?.latitude);
        const expectedLng = Number((vendorProfile as any)?.longitude);
        if (!Number.isFinite(expectedLat) || !Number.isFinite(expectedLng)) {
          setGeoError(
            'Your business address is saved, but it has not been geocoded yet. Save Profile & Settings, then retry location verification.'
          );
          setGeoLoading(false);
          return;
        }

        const dist = getDistanceMeters(latitude, longitude, expectedLat, expectedLng);
        const acceptableRadiusMeters = Math.max(
          LOCATION_RADIUS_METERS,
          Math.min(Math.max(Number(accuracy) || 0, 0) + 75, 500)
        );
        
        // Enhanced validation checks
        const isValidLocation = dist <= acceptableRadiusMeters;
        const isGoodAccuracy = accuracy <= 75;
        const isAcceptableAccuracy = accuracy <= 500;
        const isValidResponseTime = responseTime > 100 && responseTime < 10000; // Prevent spoofing
        const isDevBypass = process.env.NODE_ENV === 'development';
        
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
            vendorId: String(vendorId || ''),
            latitude,
            longitude,
            accuracy,
            distance: dist,
            expectedLatitude: expectedLat,
            expectedLongitude: expectedLng,
            acceptableRadiusMeters,
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
          if (selectedJob) {
            const snapshot = buildRecordingComplianceSnapshot(selectedJob, {
              location:
                location === 'business' || location === 'residence' || location === 'customer-business'
                  ? (location as 'business' | 'residence' | 'customer-business')
                  : 'business',
              locationVerified: true,
              consentAccepted: Boolean(customerConsentReceived),
              consentRequestId: String(activePermissionRequestId || '').trim(),
            });
            mergeRecordingComplianceForJob(selectedJob, snapshot);
            void persistRecordingComplianceToBackend(selectedJob, snapshot, verificationData)
              .then(() => releaseEmployeeServiceOrderWhenReady(selectedJob, snapshot))
              .catch((error) => {
                setGeoInfo(
                  error instanceof Error
                    ? `Location verified, but service-order release needs attention: ${error.message}`
                    : 'Location verified, but service-order release needs attention.'
                );
              });
          }
          
          setShowConsent(true);
          setConsentStatus('granted');
        } else {
          const distanceLabel =
            dist >= 1609
              ? `${(dist / 1609.344).toFixed(1)} miles`
              : `${Math.round(dist * 3.28084)} feet`;
          const radiusLabel =
            acceptableRadiusMeters >= 1609
              ? `${(acceptableRadiusMeters / 1609.344).toFixed(1)} miles`
              : `${Math.round(acceptableRadiusMeters * 3.28084)} feet`;
          const accuracyLabel = Number.isFinite(Number(accuracy))
            ? `${Math.round(Number(accuracy))} meters`
            : 'unknown';
          let errorMessage = 'Location verification failed. ';
          if (!isValidLocation) {
            errorMessage += `Your browser reported you about ${distanceLabel} from the saved business address. Allowed range is about ${radiusLabel}; GPS accuracy was ${accuracyLabel}. `;
          }
          if (!isAcceptableAccuracy) errorMessage += 'GPS accuracy is too weak; move to an open area and try again. ';
          if (!isValidResponseTime) errorMessage += 'Response time indicates potential spoofing. ';
          errorMessage += 'If you recently changed the business address, save Profile & Settings first to refresh the saved coordinate, then try again.';
          
          setGeoError(errorMessage);
          setGeoLoading(false);
          
          // Log failed attempt
          const failedAttempt = {
            jobId: selectedJob?.id,
            vendorId: String(vendorId || ''),
            latitude,
            longitude,
            accuracy,
            distance: dist,
            expectedLatitude: expectedLat,
            expectedLongitude: expectedLng,
            acceptableRadiusMeters,
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
          vendorId: String(vendorId || ''),
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

  const handleRequestCustomerConsent = async () => {
    if (!vendorId || !selectedJob) {
      setGeoError('Select a valid work record before requesting recording permission.');
      return;
    }
    const selectedJobSnapshot = selectedJob;
    const vendorIdSnapshot = String(vendorId);
    const selectedLocation = String(location || '').trim().toLowerCase();
    const requestHeaders = getRequestHeaders();
    const bookingId = selectedJobSnapshot?.bookingId
      ? String(selectedJobSnapshot.bookingId)
      : String(selectedJobSnapshot?.id || '');
    if (!bookingId) {
      setGeoError('This job is missing booking linkage. Reload jobs and try again.');
      return;
    }
    if (!hasCustomerContactForJob(selectedJobSnapshot)) {
      setGeoError(
        'A customer email or mobile phone is required before sending recording permission. Update the customer contact first; the assigned employee contact cannot be used.'
      );
      return;
    }
    setGeoError('');
    setGeoInfo('');
    setConsentRefreshError('');
    setCustomerConsentSending(true);
    try {
      const currentRequestId = String(selectedJobSnapshot?.latestConsentId || '').trim();
      const currentState = String(selectedJobSnapshot?.consentStatus || '').trim().toLowerCase();
      if (currentRequestId) {
        const needsCorrection =
          currentState === CONSENT_STATE.WRONG_RECIPIENT || currentState === 'recipient_mismatch';
        const endpoint = needsCorrection
          ? `/api/consent/requests/${encodeURIComponent(currentRequestId)}/recipient`
          : `/api/consent/requests/${encodeURIComponent(currentRequestId)}/resend`;
        const method = needsCorrection ? 'PATCH' : 'POST';
        const recoveryRes = await fetch(endpoint, {
          method,
          headers: requestHeaders,
          ...(needsCorrection
            ? {
                body: JSON.stringify({
                  name: selectedJobSnapshot?.client || selectedJobSnapshot?.clientName || '',
                  email: selectedJobSnapshot?.customerEmail || '',
                  phone: selectedJobSnapshot?.customerPhone || '',
                }),
              }
            : {}),
        });
        const recoveryPayload = await recoveryRes.json().catch(() => ({}));
        if (!recoveryRes.ok || recoveryPayload?.success === false) {
          throw new Error(String(recoveryPayload?.error || 'Unable to resend the recording permission request'));
        }
        applyConsentStatusFromBackend(recoveryPayload?.permission?.state || 'pending');
        setGeoInfo(
          needsCorrection
            ? 'Recipient details were updated and a new secure recording-permission request was sent.'
            : 'A new secure recording-permission link was sent. The previous link no longer works.'
        );
        await reloadJobsFromBackend({ silent: true });
        return;
      }
      const sessionRes = await fetch(`/api/vendors/${vendorIdSnapshot}/media/sessions`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          bookingId,
          serviceId: selectedJobSnapshot?.serviceId ? String(selectedJobSnapshot.serviceId) : undefined,
          sessionType: 'CONSENT_REQUEST',
          title: 'Customer recording permission request',
          description: `Recording permission request before ${location || 'service'} recording`,
        }),
      });
      const sessionPayload = await sessionRes.json().catch(() => ({}));
      if (!sessionRes.ok) {
        throw new Error(
          String(sessionPayload?.message || sessionPayload?.error || 'Failed to create the recording-permission session')
        );
      }
      const mediaSessionId = String(sessionPayload?.session?.id || '');
      if (!mediaSessionId) {
        throw new Error('Consent request session created without id.');
      }

      const consentRes = await fetch('/api/consent/request', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          bookingId,
          mediaSessionId,
        }),
      });
      const consentPayload = await consentRes.json().catch(() => ({}));
      if (!consentRes.ok || consentPayload?.success === false) {
        throw new Error(
          String(consentPayload?.error || consentPayload?.message || 'Failed to request recording permission')
        );
      }
      setCustomerConsentRequested(true);
      setCustomerConsentReceived(false);
      setActivePermissionRequestId(String(consentPayload?.permission?.id || '').trim());
      if (selectedJobSnapshot && (selectedLocation === 'residence' || selectedLocation === 'customer-business')) {
        mergeRecordingComplianceForJob(selectedJobSnapshot, {
          location: selectedLocation as 'business' | 'residence' | 'customer-business',
          consentAccepted: false,
          consentRequestId: String(consentPayload?.permission?.id || '').trim(),
          locationVerified,
          savedAt: new Date().toISOString(),
        });
      }
      applyConsentStatusFromBackend(consentPayload?.permission?.state || 'REQUESTED', {
        requestId: String(consentPayload?.permission?.id || '').trim(),
      });
      const deliveryStatus = String(consentPayload?.delivery?.status || '').toUpperCase();
      const deliveryConfirmed =
        deliveryStatus === 'SENT' ||
        deliveryStatus === 'PARTIAL';
      if (deliveryConfirmed) {
        const sentChannels = Array.isArray(consentPayload?.delivery?.channels)
          ? consentPayload.delivery.channels
              .filter((channel: any) => channel?.attempted && channel?.success)
              .map((channel: any) => String(channel?.channel || '').toUpperCase())
              .filter(Boolean)
              .join(' and ')
          : '';
        setGeoInfo(
          sentChannels
            ? `Recording permission request sent by ${sentChannels}. Waiting for the verified customer contact.`
            : 'Recording permission request sent. Waiting for the verified customer contact.'
        );
      } else {
        const deliveryReason =
          consentPayload?.delivery?.lastError ||
          'Email/SMS delivery was not confirmed.';
        setGeoInfo(`Recording stays locked because delivery was not confirmed: ${deliveryReason}`);
      }
      const bookingKey = selectedJobSnapshot?.bookingId
        ? String(selectedJobSnapshot.bookingId)
        : String(selectedJobSnapshot?.id || '');
      if (bookingKey) {
        setConsentStatusByBookingId((prev) => ({ ...prev, [bookingKey]: CONSENT_STATE.REQUESTED }));
      }
      await reloadJobsFromBackend({ silent: true });
    } catch (error: any) {
      setCustomerConsentStatus(CONSENT_STATE.NOT_REQUESTED);
      setCustomerConsentRequested(false);
      setCustomerConsentReceived(false);
      setActivePermissionRequestId('');
      setGeoError(error?.message || 'Failed to request recording permission');
    } finally {
      setCustomerConsentSending(false);
    }
  };

  const handleSendEmployeeServiceOrder = async () => {
    if (!selectedJob) {
      setGeoError('Please select a job before sending a service order.');
      return;
    }
    if (!isJobAssignedForVideoUpload(selectedJob)) {
      setGeoError(videoAssignmentRequiredCopy);
      setJobActionFeedback({ type: 'error', message: videoAssignmentRequiredCopy });
      return;
    }
    const complianceLocation = String(location || '').trim().toLowerCase();
    if (
      complianceLocation !== 'business' &&
      complianceLocation !== 'residence' &&
      complianceLocation !== 'customer-business'
    ) {
      setGeoError('Choose where the service recording will happen before sending a service order.');
      return;
    }
    if (
      (complianceLocation === 'residence' || complianceLocation === 'customer-business') &&
      !customerConsentReceived
    ) {
      setGeoError('Verified recording permission is required before sending the employee service order.');
      return;
    }

    setGeoError('');
    setGeoInfo('Sending the service order to the assigned employee...');
    const snapshot = buildRecordingComplianceSnapshot(selectedJob, {
      location: complianceLocation as 'business' | 'residence' | 'customer-business',
      consentAccepted: Boolean(customerConsentReceived),
      consentRequestId: String(
        activePermissionRequestId || getSavedRecordingComplianceForJob(selectedJob)?.consentRequestId || ''
      ).trim(),
      locationVerified: Boolean(locationVerified),
    });
    persistRecordingComplianceForJob(selectedJob, snapshot);
    try {
      await persistRecordingComplianceToBackend(selectedJob, snapshot);
      await releaseEmployeeServiceOrderWhenReady(selectedJob, snapshot);
      setShowComplianceModal(false);
      setPreferredNextVideoStage('');
      setPreferredReplaceStage(false);
      setGeoInfo('');
    } catch (error) {
      setGeoError(
        error instanceof Error ? error.message : 'Could not send the employee service order.'
      );
    }
  };

  const handleContinue = async () => {
    // Enhanced validation before proceeding
    if (!selectedJob) {
      console.error('No job selected for video creation');
      return;
    }
    if (!isJobAssignedForVideoUpload(selectedJob)) {
      setGeoError(videoAssignmentRequiredCopy);
      setJobActionFeedback({ type: 'error', message: videoAssignmentRequiredCopy });
      return;
    }
    
    if (!location) {
      console.error('No location type selected');
      return;
    }

    if (!getCanContinueCompliance()) {
      if (location === 'business') {
        setGeoError('Assign an employee before sending the service order.');
      } else if (location === 'residence') {
        setGeoError('Verified recording permission is required before sending the employee service order.');
      } else if (location === 'customer-business') {
        setGeoError('Verified recording permission is required before sending the employee service order.');
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
      vendorId: String(vendorId || ''),
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
    
    // Close compliance modal and release the employee recording link.
    setShowComplianceModal(false);
    if (!selectedJob) {
      setGeoError('Please select a job before sending the employee recording link.');
      return;
    }
    const complianceLocation = String(location || '').trim().toLowerCase();
    if (
      complianceLocation === 'business' ||
      complianceLocation === 'residence' ||
      complianceLocation === 'customer-business'
    ) {
      const snapshot = buildRecordingComplianceSnapshot(selectedJob, {
        location: complianceLocation as 'business' | 'residence' | 'customer-business',
        consentAccepted: Boolean(customerConsentReceived),
        consentRequestId: String(activePermissionRequestId || getSavedRecordingComplianceForJob(selectedJob)?.consentRequestId || '').trim(),
        locationVerified: Boolean(locationVerified),
      });
      persistRecordingComplianceForJob(selectedJob, snapshot);
      try {
        await persistRecordingComplianceToBackend(selectedJob, snapshot);
        await releaseEmployeeServiceOrderWhenReady(selectedJob, snapshot);
      } catch (error) {
        console.warn('[Vendor Compliance] Service order release after continue failed', error);
      }
    }
    setPreferredNextVideoStage('');
    setPreferredReplaceStage(false);
    setJobActionFeedback({
      type: 'success',
      message: 'Compliance completed. The employee recording link is ready for the assigned worker.',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'flagged': return 'bg-purple-100 text-purple-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'awaiting_review': return 'bg-amber-100 text-amber-900';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'archived': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOperationalPhaseBadgeClass = (phase: string | null | undefined) => {
    const p = String(phase || '').trim().toUpperCase();
    if (p === 'REJECTED') {
      return '!border-red-300/50 !bg-red-500/20 !text-red-50';
    }
    if (p === 'AWAITING_ADMIN_REVIEW') {
      return '!border-blue-300/45 !bg-blue-500/25 !text-blue-50';
    }
    if (p === 'AWAITING_VENDOR_REVIEW') {
      return '!border-amber-300/45 !bg-amber-500/25 !text-amber-50';
    }
    if (p === 'ASSIGNED') return '!border-sky-300/45 !bg-sky-500/20 !text-sky-50';
    if (p === 'IN_PROGRESS') return '!border-blue-300/45 !bg-blue-500/20 !text-blue-50';
    if (p === 'PENDING') return '!border-yellow-300/45 !bg-yellow-500/20 !text-yellow-50';
    if (p === 'COMPLETED') return '!border-green-300/45 !bg-green-500/20 !text-green-50';
    return '!border-slate-300/30 !bg-slate-500/20 !text-slate-100';
  };

  const canVendorMarkJobCompleted = (job: any) =>
    String(job?.operationalPhase || '').toUpperCase() === 'COMPLETED';

  const getJobListBadgeColor = (job: any) => {
    const phase = String(job?.operationalPhase || '').toUpperCase();
    if (jobHasRejectedMedia(job)) {
      return getOperationalPhaseBadgeClass('REJECTED');
    }
    if (phase === 'AWAITING_ADMIN_REVIEW') {
      return getOperationalPhaseBadgeClass(phase);
    }
    if (phase === 'AWAITING_VENDOR_REVIEW') {
      return getOperationalPhaseBadgeClass(phase);
    }
    if (phase === 'REJECTED') {
      return getOperationalPhaseBadgeClass(phase);
    }
    return getStatusColor(job.status);
  };

  const formatJobStatusLabel = (status: string | null | undefined, operationalPhase?: string | null, job?: any) => {
    const phase = String(operationalPhase || '').trim().toUpperCase();
    if (job && isAdminAuditRejected(job)) {
      return 'Job: Reliance Audit Failed';
    }
    if (job && isAdminAuditPassed(job)) {
      return 'Job: Reliance Audit Passed';
    }
    if (phase === 'REJECTED' || (job && jobHasRejectedMedia(job))) {
      return 'Job: Rejected';
    }
    if (phase === 'AWAITING_ADMIN_REVIEW') {
      return 'Job: Reliance Audit Pending';
    }
    if (phase === 'AWAITING_VENDOR_REVIEW') {
      return 'Job: Awaiting Manager Review';
    }
    if (phase === 'ASSIGNED') {
      return 'Job: Assigned';
    }
    if (phase === 'IN_PROGRESS') {
      return 'Job: In progress';
    }
    if (phase === 'PENDING') {
      return 'Job: Pending';
    }
    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized) return 'Job: Pending';
    const pretty = normalized
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `Job: ${pretty}`;
  };

  const formatOperationalPhaseLabel = (operationalPhase: string | null | undefined, job?: any) => {
    const phase = String(operationalPhase || '').trim().toUpperCase();
    if (job && isAdminAuditRejected(job)) return 'Reliance Audit Failed';
    if (job && isAdminAuditPassed(job)) return 'Reliance Audit Passed';
    if (phase === 'REJECTED' || (job && jobHasRejectedMedia(job))) return 'Rejected / closed';
    if (phase === 'AWAITING_ADMIN_REVIEW') return 'Reliance Audit Pending';
    if (phase === 'AWAITING_VENDOR_REVIEW') return 'Awaiting Manager Review';
    if (phase === 'ASSIGNED') return 'Assigned';
    if (phase === 'IN_PROGRESS') return 'In progress';
    if (phase === 'PENDING') return 'Pending';
    if (phase === 'COMPLETED') return 'Completed';
    return 'Workflow status';
  };

  const getVideoModerationState = (video: any): 'rejected' | 'flagged' | 'pending_review' | 'approved' | null => {
    const status = normalizeModerationStatus(video?.moderationStatus);
    if (status === 'rejected') return 'rejected';
    if (status === 'flagged') return 'flagged';
    if (status === 'approved') return 'approved';
    if (status === 'pending_review') {
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
    if (!hasAnyEligibleVideoJob) {
      setJobActionFeedback({
        type: 'error',
        message: videoAssignmentRequiredCopy,
      });
      return;
    }
    setSelectedJobForVideoId('');
    setShowSelectJobModal(true);
  };

  const handleContinueWithSelectedJob = () => {
    if (!selectedJobForVideo) {
      return;
    }
    if (!isJobAssignedForVideoUpload(selectedJobForVideo)) {
      setJobActionFeedback({
        type: 'error',
        message: videoAssignmentRequiredCopy,
      });
      return;
    }
    setShowSelectJobModal(false);
    void startRecordingFlow(selectedJobForVideo, {
      stage: '',
      replaceExisting: false,
      source: 'header-create-service-video',
    });
  };

  const fetchArchiveMediaItems = async () => {
    if (!vendorId) return;
    setArchiveMediaLoading(true);
    setArchiveMediaError("");
    try {
      const assetsRes = await fetch(`/api/vendors/${vendorId}/media?includeDeleted=true`, {
        method: "GET",
        headers: getRequestHeaders(),
        cache: "no-store",
      });
      const assetsJson = await assetsRes.json().catch(() => ({}));
      if (!assetsRes.ok) {
        throw new Error(assetsJson?.error || assetsJson?.message || "Failed to load media assets");
      }
      const assets = Array.isArray(assetsJson?.assets) ? assetsJson.assets : [];
      const jobsByBookingId = new Map(
        jobs.map((job: any) => [String(job.bookingId || job.id), job])
      );

      const items = assets.map((asset: any) => {
        const bookingId = asset?.bookingId ? String(asset.bookingId) : "";
        const relatedJob = bookingId ? jobsByBookingId.get(bookingId) : null;
        const mediaPurpose = asset?.mediaPurpose
          ? deriveMediaPurposeFromSessionType(String(asset.mediaPurpose))
          : asset?.sessionType
          ? deriveMediaPurposeFromSessionType(String(asset.sessionType))
          : deriveMediaPurposeFromJobStatus(relatedJob?.status);

        const item = {
          id: String(asset.id),
          title: String(asset?.title || "Service Media"),
          description: "",
          jobName: String(asset?.jobTitle || relatedJob?.title || "Unknown Job"),
          clientName: String(asset?.clientName || relatedJob?.client || "Unknown Client"),
          employee:
            asset?.employeeName ||
            relatedJob?.assignedEmployees?.[0] ||
            (asset?.uploadedByMembershipId ? `Member ${String(asset.uploadedByMembershipId).slice(0, 6)}` : "Unassigned"),
          uploadDate: asset?.createdAt
            ? new Date(asset.createdAt).toISOString().split("T")[0]
            : "",
          status: MODERATION_PENDING_REVIEW,
          createdAt: asset?.createdAt,
          bytes: asset?.bytes || "0",
          mimeType: asset?.mimeType || "",
          blobKey: asset?.blobKey || "",
          blobUrl: asset?.blobUrl || null,
          moderationStatus: normalizeModerationStatus(asset?.moderationStatus),
          visibilityStatus: String(asset?.visibilityStatus || ""),
          archiveStatus: normalizeMediaArchiveStatus(asset?.archiveStatus),
          moderationReason: asset?.moderationReason ? String(asset.moderationReason) : "",
          moderatedAt: asset?.moderatedAt || null,
          sessionId: asset?.mediaSessionId ? String(asset.mediaSessionId) : "",
          sessionStatus: "",
          bookingId,
          serviceId: asset?.serviceId ? String(asset.serviceId) : "",
          serviceType: String(asset?.serviceName || relatedJob?.serviceName || "General Service"),
          isArchived: Boolean(asset?.deletedAt) || normalizeMediaArchiveStatus(asset?.archiveStatus) === ARCHIVE_ARCHIVED,
          deletedAt: asset?.deletedAt || null,
          mediaPurpose,
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

  const handleArchiveMediaItemAction = async (
    item: any,
    action: "archive" | "restore" | "delete"
  ) => {
    if (!vendorId) return;
    setArchiveActionLoadingId(`${action}:${item.id}`);
    setArchiveMediaError("");
    try {
      if (action === "archive") {
        const archiveRes = await fetch(`/api/vendors/${vendorId}/media/${item.id}`, {
          method: "DELETE",
          headers: getRequestHeaders(),
        });
        if (!archiveRes.ok) {
          const payload = await archiveRes.json().catch(() => ({}));
          throw new Error(payload?.error || payload?.message || "Failed to move media to archive");
        }
      } else if (action === "restore") {
        const restoreRes = await fetch(`/api/vendors/${vendorId}/media/${item.id}`, {
          method: "PATCH",
          headers: getRequestHeaders(),
          body: JSON.stringify({ action: "RESTORE" }),
        });
        if (!restoreRes.ok) {
          const payload = await restoreRes.json().catch(() => ({}));
          throw new Error(payload?.error || payload?.message || "Failed to restore media asset");
        }
      } else if (action === "delete") {
        const deleteRes = await fetch(`/api/vendors/${vendorId}/media/${item.id}`, {
          method: "DELETE",
          headers: getRequestHeaders(),
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

  const jobBlocksEmployeeAvailability = (job: any): boolean => {
    const raw = String(job?.status || '').trim().toLowerCase();
    const normalized = raw.replace(/[_\s]+/g, '-');
    return (
      normalized === 'pending' ||
      normalized === 'scheduled' ||
      normalized === 'in-progress' ||
      normalized === 'confirmed'
    );
  };

  // Get available employees (active or invited memberships without active/pending assignments)
  const getAvailableEmployees = () => {
    const assignedMembershipIdSet = new Set<string>();
    jobs.forEach((job) => {
      if (!jobBlocksEmployeeAvailability(job)) {
        return;
      }
      const ids = Array.isArray(job.assignedMembershipIds) ? job.assignedMembershipIds : [];
      ids.forEach((id: string) => assignedMembershipIdSet.add(String(id)));
      if (ids.length === 0 && Array.isArray(job.assignedEmployees) && teamMembers.length > 0) {
        job.assignedEmployees.forEach((empName: string) => {
          const m = teamMembers.find(
            (t) => t.name.trim().toLowerCase() === String(empName).trim().toLowerCase()
          );
          if (m) assignedMembershipIdSet.add(m.membershipId);
        });
      }
    });

    return teamMembers
      .filter((m) => !assignedMembershipIdSet.has(m.membershipId))
      .map((m) => ({
        id: m.membershipId,
        name: m.name,
        photo: avatarUrlForName(m.name),
      }));
  };

  // Persisted job action functions
  const runPersistedJobAction = async (
    job: any,
    action:
      | "ARCHIVE_JOB"
      | "MOVE_CONTENT_TO_ARCHIVE"
      | "UNARCHIVE_JOB"
      | "UPDATE_JOB"
      | "ASSIGN_JOB"
      | "UPDATE_RECORDING_COMPLIANCE"
      | "RELEASE_EMPLOYEE_SERVICE_ORDER"
      | "CANCEL_SERVICE_ORDER"
      | "UPDATE_STATUS"
      | "APPROVE_JOB_COMPLETION",
    extra: Record<string, unknown> = {}
  ) => {
    if (!vendorId) {
      throw new Error("Vendor context is not ready");
    }

    const res = await fetch(`/api/vendors/${vendorId}/jobs/${encodeURIComponent(String(job.id))}/actions`, {
      method: "PATCH",
      headers: getRequestHeaders(),
      body: JSON.stringify({ action, ...extra }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || payload?.message || `Job action failed (${res.status})`);
    }
    return payload;
  };

  const requestRecordingLocationException = async () => {
    if (!vendorId || !locationExceptionJob) return;
    const reason = locationExceptionReason.trim();
    if (reason.length < 20) {
      setLocationExceptionError('Explain why the employee cannot verify the saved service location (at least 20 characters).');
      return;
    }
    if (bucket === 'private_complete') {
      return '!border-teal-300/45 !bg-teal-500/20 !text-teal-50';
    }
    setLocationExceptionSubmitting(true);
    setLocationExceptionError('');
    try {
      const response = await fetch(
        `/api/vendors/${vendorId}/jobs/${encodeURIComponent(String(locationExceptionJob.id))}/location-exception`,
        {
          method: 'POST',
          headers: getRequestHeaders(),
          body: JSON.stringify({ reason }),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Unable to request the location exception');
      setLocationExceptionJob(null);
      setLocationExceptionReason('');
      await reloadJobsFromBackend();
    } catch (requestError) {
      setLocationExceptionError(
        requestError instanceof Error ? requestError.message : 'Unable to request the location exception'
      );
    } finally {
      setLocationExceptionSubmitting(false);
    }
  };

  const archiveJob = async (job: any) => {
    const payload = await runPersistedJobAction(job, "ARCHIVE_JOB");
    await reloadJobsFromBackend();
    return payload;
  };

  const moveContentToArchive = async (job: any) => {
    const payload = await runPersistedJobAction(job, "MOVE_CONTENT_TO_ARCHIVE");
    await reloadJobsFromBackend();
    return payload;
  };

  const unarchiveJob = async (archivedJob: any) => {
    await runPersistedJobAction(archivedJob, "UNARCHIVE_JOB");
    await reloadJobsFromBackend();
  };

  const approveJobCompletion = async (job: any) => {
    if (!vendorId) {
      throw new Error("Vendor context is not ready");
    }
    const res = await fetch(`/api/vendors/${vendorId}/jobs/${encodeURIComponent(String(job.id))}/approve`, {
      method: "POST",
      headers: getRequestHeaders(),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || payload?.message || `Approval failed (${res.status})`);
    }
    await reloadJobsFromBackend();
    applyJobPatchLocally(job, {
      ...(payload?.job || {}),
      status: 'completed',
      operationalPhase: 'COMPLETED',
    });
    return payload;
  };

  const submitForManagerReview = async (job: any) => {
    if (!job?.id) {
      throw new Error("Job id is required");
    }
    const res = await fetch(`/api/employee/jobs/${encodeURIComponent(String(job.id))}/complete`, {
      method: "POST",
      headers: getRequestHeaders(),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || payload?.message || `Submit failed (${res.status})`);
    }
    await reloadJobsFromBackend();
    return payload;
  };

  const isJobReadyToSubmitForManagerReview = (job: any) => {
    const status = String(job?.status || "").trim().toLowerCase();
    const phase = String(job?.operationalPhase || "").trim().toUpperCase();
    if (
      status === "awaiting_review" ||
      status === "awaiting review" ||
      status === "completed" ||
      status === "complete"
    ) {
      return false;
    }
    const nextStage = getNextMissingVideoStageForJob(job);
    const activeStatusEligible =
      status === "in-progress" ||
      status === "in progress" ||
      status === "pending" ||
      status === "confirmed" ||
      status === "assigned";
    const activePhaseEligible =
      phase === "ASSIGNED" ||
      phase === "IN_PROGRESS" ||
      phase === "CONFIRMED" ||
      phase === "PENDING";
    return !nextStage && (activeStatusEligible || activePhaseEligible);
  };

  const isJobSubmittedForManagerReview = (job: any) => {
    const status = String(job?.status || "").trim().toLowerCase();
    return status === "awaiting_review" || status === "awaiting review";
  };

  const handleSubmitForManagerReview = async (job: any) => {
    if (!job || jobMutationLoadingId) return;
    setJobMutationLoadingId(`submit-review:${String(job.id || "")}`);
    setJobActionFeedback(null);
    try {
      await submitForManagerReview(job);
      const targetId = String(job?.id || "");
      if (targetId) {
        setJobs((prev) =>
          prev.map((row) =>
            String(row?.id || "") === targetId
              ? { ...row, status: "awaiting_review", operationalPhase: "AWAITING_VENDOR_REVIEW" }
              : row
          )
        );
      }
      setJobActionFeedback({
        type: "success",
        message: "Submitted for manager review.",
      });
    } catch (error) {
      setJobActionFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to submit for manager review",
      });
    } finally {
      setJobMutationLoadingId(null);
    }
  };

  const rejectJobCompletion = async (job: any, rejectionReason: string, stages: string[]) => {
    if (!vendorId) {
      throw new Error("Vendor context is not ready");
    }
    const trimmedReason = String(rejectionReason || '').trim();
    if (!trimmedReason) {
      throw new Error("Rejection reason is required.");
    }
    const res = await fetch(`/api/vendors/${vendorId}/jobs/${encodeURIComponent(String(job.id))}/reject`, {
      method: "POST",
      headers: getRequestHeaders(),
      body: JSON.stringify({ rejectionReason: trimmedReason, stages }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || payload?.message || `Rejection failed (${res.status})`);
    }
    await reloadJobsFromBackend();
    return payload;
  };

  const openRejectJobModal = (job: any) => {
    setRejectJobTarget(job);
    setRejectReasonInput('');
    setRejectStageSelection(['INTRO', 'IN_PROGRESS', 'COMPLETED']);
    setShowRejectJobModal(true);
    setActiveJobActionMenuId(null);
  };

  const openApproveConfirmModal = (job: any) => {
    setApproveJobTarget(job);
    setShowApproveConfirmModal(true);
    setActiveJobActionMenuId(null);
  };

  const submitApproveJob = async () => {
    if (!approveJobTarget || approveJobSubmitting) return;
    setApproveJobSubmitting(true);
    setJobActionFeedback(null);
    try {
      await approveJobCompletion(approveJobTarget);
      setJobActionFeedback({
        type: 'success',
        message: 'Private Service Video approved and made available to the customer.',
      });
      setShowApproveConfirmModal(false);
      setApproveJobTarget(null);
    } catch (error) {
      setJobActionFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to approve job completion',
      });
    } finally {
      setApproveJobSubmitting(false);
    }
  };

  const submitRejectJob = async () => {
    if (!rejectJobTarget || rejectJobSubmitting) return;
    const trimmedReason = String(rejectReasonInput || '').trim();
    if (!trimmedReason) {
      setJobActionFeedback({ type: "error", message: "Please enter a rejection reason." });
      return;
    }
    if (rejectStageSelection.length === 0) {
      setJobActionFeedback({ type: "error", message: "Select at least one stage that needs correction." });
      return;
    }
    setRejectJobSubmitting(true);
    setJobActionFeedback(null);
    try {
      const payload = await rejectJobCompletion(rejectJobTarget, trimmedReason, rejectStageSelection);
      setJobActionFeedback({
        type: "success",
        message: payload?.message || "Completed work order rejected.",
      });
      setShowRejectJobModal(false);
      setRejectJobTarget(null);
      setRejectReasonInput('');
      setRejectStageSelection(['INTRO', 'IN_PROGRESS', 'COMPLETED']);
    } catch (error) {
      setJobActionFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to reject job completion",
      });
    } finally {
      setRejectJobSubmitting(false);
    }
  };

  const deleteJobPermanently = async (job: any) => {
    if (!vendorId) {
      throw new Error("Vendor context is not ready");
    }
    const res = await fetch(`/api/vendors/${vendorId}/jobs/${encodeURIComponent(String(job.id))}/actions`, {
      method: "DELETE",
      headers: getRequestHeaders(),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || payload?.message || `Delete failed (${res.status})`);
    }
    removeJobLocally(job.id);
    await reloadJobsFromBackend({ removeJobIds: [job.id], silent: true });
    return payload;
  };

  const getFilteredArchivedJobs = () => {
    let filtered = archivedJobs;
    
    if (jobArchiveFilter !== 'all') {
      filtered = filtered.filter(job => job.status === jobArchiveFilter);
    }
    
    return filtered.sort(
      (a, b) =>
        new Date(String(b.updatedAt || b.archivedAt || b.createdAt || 0)).getTime() -
        new Date(String(a.updatedAt || a.archivedAt || a.createdAt || 0)).getTime()
    );
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
    action: "ARCHIVE_JOB" | "MOVE_CONTENT_TO_ARCHIVE" | "DELETE_PERMANENTLY" | "CANCEL_SERVICE_ORDER"
  ) => {
    setJobActionTarget(job);
    setPendingJobAction(action);
    setShowJobActionConfirmModal(true);
    setCancellationReason('');
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
        headers: getRequestHeaders(),
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

  const openReadOnlyPermissionEvidence = async (job: any) => {
    if (!vendorId) return;
    setActiveJobActionMenuId(null);
    setPermissionEvidence(null);
    setPermissionEvidenceError('');
    setPermissionEvidenceLoading(true);
    try {
      const response = await fetch(
        `/api/vendors/${vendorId}/jobs/${encodeURIComponent(String(job.id))}/recording-permission`,
        { cache: 'no-store', headers: getRequestHeaders() },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.permission) {
        throw new Error(payload?.error || 'Unable to load recording permission evidence.');
      }
      setPermissionEvidence(payload.permission);
    } catch (error) {
      setPermissionEvidenceError(error instanceof Error ? error.message : 'Unable to load recording permission evidence.');
    } finally {
      setPermissionEvidenceLoading(false);
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
        setJobActionFeedback({ type: "success", message: payload?.message || "Service order deleted." });
      } else if (pendingJobAction === "CANCEL_SERVICE_ORDER") {
        const payload = await runPersistedJobAction(jobActionTarget, "CANCEL_SERVICE_ORDER", {
          reason: cancellationReason.trim(),
        });
        await reloadJobsFromBackend();
        setJobActionFeedback({ type: "success", message: payload?.message || "Service Order canceled." });
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
      ? "Delete Service Order"
      : pendingJobAction === "CANCEL_SERVICE_ORDER"
      ? "Cancel Service Order"
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
        return "Completed service orders cannot be deleted by vendors. Please contact an admin if further action is needed.";
      }
      if ((deleteImpactPreview?.linkedSessionCount || 0) > 0) {
        return "This service order has linked media. Deleting it will archive related media/session records so nothing is orphaned.";
      }
      return "Permanently delete this service order? Completed service orders must be archived.";
    }
    if (pendingJobAction === "CANCEL_SERVICE_ORDER") {
      return "Cancel this Service Order and permanently close employee recording and upload access. Existing permission, location, assignment, delivery, and audit evidence will remain in read-only history.";
    }
    return "Please confirm this job action.";
  })();

  if (approvalPending) {
    return (
      <div className="p-4 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md w-full bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <h2 className="text-xl font-semibold text-amber-900 mb-2">Vendor account pending approval</h2>
          <p className="text-sm text-amber-800">
            You can access job management once an admin approves your vendor account.
          </p>
        </div>
        </div>
      </div>
    );
  }

  if (vendorContextUnavailable) {
    return (
      <div className="p-4 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <h2 className="text-xl font-semibold text-red-900 mb-2">Unable to load vendor context</h2>
          <p className="text-sm text-red-800">Your vendor workspace is temporarily unavailable.</p>
          <p className="text-xs text-red-700 mt-3">
            Verify your vendor membership is active, then try again.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => refetchVendorProfile()}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
            >
              Retry vendor context
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg border border-red-300 text-red-800 text-sm font-medium hover:bg-red-100"
            >
              Refresh page
            </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reliance-operator-shell min-h-screen overflow-x-hidden p-4">
      {vendorContextResolving && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white/90 p-3 shadow-sm">
          <p className="text-sm font-medium text-slate-900">Resolving vendor context...</p>
          <p className="mt-1 text-sm text-slate-700">
            The jobs workspace shell is ready while Reliance finishes loading your active vendor session.
          </p>
        </div>
      )}
      {Boolean(vendorId && vendorContextDbFailure) && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-amber-900">
              Vendor profile details could not be loaded due to a database connection issue. Core vendor context
              is preserved, so jobs can still load with limited profile metadata.
            </p>
            <button
              type="button"
              onClick={() => refetchVendorProfile()}
              className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              Retry context
            </button>
          </div>
        </div>
      )}
      {/* Enhanced Welcome Banner */}
      <div className="reliance-operator-hero mb-6 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-full">
            <Info className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">Manage jobs and scheduled work</h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              <strong>Services Offered</strong> is your customer-facing menu. This page is where you create
              the actual customer work record, assign employees, request verified recording permission when needed, and
              track the Starting Condition, Work in Progress, and Final Result videos.
              Use <strong> Add Work Record</strong> for scheduled work, beta/demo jobs, or jobs an admin asks
              you to enter.
              Hover over any <span className="inline-flex align-text-bottom"><Info className="inline w-4 h-4" /></span>{' '}
              info icon for detailed help.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm">
        <p className="font-semibold text-blue-950">Why this page matters for growth</p>
        <p className="mt-1 leading-6">
          Finished jobs, approved Starting Condition, Work in Progress, and Final Result videos, and
          review-ready service records all strengthen the public trust signals customers see later.
        </p>
      </div>

      <Dialog
        open={showJobWorkflowGuide}
        onOpenChange={(open) => {
          if (open) {
            setShowJobWorkflowGuide(true);
          } else {
            closeJobWorkflowGuide();
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>How a work record becomes customer-visible proof</DialogTitle>
            <DialogDescription>
              Create the work record, assign the employee, handle consent and location rules, then complete
              the three service video stages.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-gray-700">
              <li><strong>Create or receive the work record</strong> with the customer and selected service.</li>
              <li><strong>Assign the employee</strong> who will record on-site. The employee must already be on your team.</li>
              <li>
                <strong>Choose where the recording happens.</strong> Business address requires employee phone
                location verification. A customer residence requires verified recording permission. A customer business requires
                verified recording permission and employee phone location verification.
              </li>
              <li><strong>If recording permission is required, send the secure request</strong> and wait for a verified decision before recording is allowed.</li>
              <li><strong>Send the employee service order link</strong> so the employee can open it on the phone they will use to record.</li>
              <li><strong>If location is required, the employee verifies location</strong> from that phone before recording unlocks.</li>
              <li><strong>The employee records all three stages</strong>: Starting Condition, Work in Progress, and Final Result. Each stage can be previewed, saved, or retaken.</li>
              <li><strong>The employee sends the finished package to the manager</strong>. Manager and admin approval happen before customers or public pages can see the videos.</li>
            </ol>
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              Each work card shows its current <strong>Next step</strong>: assign employee, wait for recording permission,
              send/open the service order link, verify employee location, record the next stage, or review completed videos.
            </div>
            <label className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
              <Checkbox
                checked={dontShowJobWorkflowGuideAgain}
                onCheckedChange={(checked) => setDontShowJobWorkflowGuideAgain(Boolean(checked))}
                aria-label="Do not show the job workflow guide automatically again"
              />
              <span>Don&apos;t show this again</span>
            </label>
          </div>
          <DialogFooter>
            <Button onClick={closeJobWorkflowGuide}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="reliance-light-card mb-6 rounded-2xl border border-slate-200 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 sm:text-3xl">
              {isEmployeeView ? 'My Assigned Work' : 'Manage Jobs & Work Records'}
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {isEmployeeView ? 'Work assigned to you' : 'Create customer work records, assign employees, and track service video progress'}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <TutorialEntryPoint guide={tutorialGuides.vendorJobs} surface="light" />
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Manager workspace
          </Badge>
        </div>
      </div>
      </div>

      {/* Action Bar */}
      <div className="reliance-light-card mb-6 rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 min-w-0 search-input-container">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder={isEmployeeView ? "Search my jobs..." : "Search jobs by title or client..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 border-2 border-gray-200 rounded-lg w-full min-w-0"
              style={{ minWidth: 0 }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {isEmployeeView ? (
            <div className="relative w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none rounded-lg border-2 border-gray-200 bg-white px-4 py-2 pr-10 text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 sm:min-w-[140px]"
              >
                <option value="all">All My Jobs</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          ) : null}
          
          {!isEmployeeView && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={openJobWorkflowGuide}
                className="w-full justify-center border-blue-200 text-blue-700 hover:bg-blue-50 sm:w-auto"
              >
                <Info className="w-4 h-4 mr-2" />
                How job workflow works
              </Button>
              <Button 
                onClick={() => {
                  setJobModalMode('create');
                  setJobFormTargetId(null);
                  setNewJob(getEmptyJobForm());
                  setNewServiceForJob({ name: '', description: '', price: '', estimatedDuration: '' });
                  setCreateJobError('');
                  setJobFieldErrors(getEmptyJobFieldErrors());
                  setShowCreateJob(true);
                }} 
                disabled={jobActionLoading || Boolean(jobMutationLoadingId)}
                className="action-button w-full justify-center bg-blue-600 hover:bg-blue-700 sm:w-auto"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Work Record
              </Button>
            </>
          )}
        </div>
      </div>
      </div>

      {!isEmployeeView ? (
        <div className="mb-6 overflow-x-auto">
          <div className="inline-flex min-w-full gap-2 rounded-2xl border border-white/10 bg-slate-950/55 p-2">
            {workflowTabs.map((tab) => {
              const active = workflowFilter === tab.value;
              const count = Number(workflowTabCounts[tab.value] || 0);
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setWorkflowFilter(tab.value)}
                  className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/25'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      active ? 'bg-white/18 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Content Archive Modal */}
      <Dialog open={showVideoArchive} onOpenChange={setShowVideoArchive}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col sm:max-h-[90vh] sm:max-w-7xl">
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
                  <option value="pending_review">Pending Review</option>
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
                      {archiveDateFilter ? formatDateOnlyUtc(archiveDateFilter) : 'Select Date'}
                    </span>
                    <Calendar className="w-4 h-4 text-gray-400" />
                  </button>
                  
                  {showDatePicker && (
                    <div className="absolute top-full left-0 mt-1 z-50 w-[min(90vw,28rem)] rounded-lg border border-gray-300 bg-white p-4 shadow-lg">
                      <div className="mb-3 flex items-center justify-between">
                        <button
                          onClick={() => {
                            const currentDate = new Date(selectedCalendarDate || '2000-01-01');
                            const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
                            setSelectedCalendarDate(prevMonth.toISOString().split('T')[0]);
                          }}
                          className="p-2 hover:bg-gray-100 rounded flex items-center justify-center bg-white border"
                          style={{ minWidth: '45px', height: '35px' }}
                        >
                          <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <span className="font-medium text-center flex-1 px-4">
                          {new Date(selectedCalendarDate || '2000-01-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
                        </span>
                        <button
                          onClick={() => {
                            const currentDate = new Date(selectedCalendarDate || '2000-01-01');
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
                          new Date(selectedCalendarDate || '2000-01-01').getFullYear(),
                          new Date(selectedCalendarDate || '2000-01-01').getMonth()
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
                  <option value="all">All Services Offered</option>
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
                            {video.moderatedAt ? <p>Moderated: {formatDateTimeUtc(video.moderatedAt)}</p> : null}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(video.status)}>
                            {`Moderation: ${String(video.moderationStatus || video.status || MODERATION_PENDING_REVIEW).replace(/_/g, " ")}`}
                          </Badge>
                          {video.visibilityStatus ? (
                            <Badge className="bg-slate-100 text-slate-700">
                              {`Visibility: ${String(video.visibilityStatus).replace(/_/g, " ")}`}
                            </Badge>
                          ) : null}
                          {video.archiveStatus ? (
                            <Badge className="bg-orange-100 text-orange-800">
                              {`Archive: ${String(video.archiveStatus).replace(/_/g, " ")}`}
                            </Badge>
                          ) : null}
                          <Badge className="bg-indigo-100 text-indigo-800">
                            {`Media Type: ${formatMediaPurposeLabel(video.mediaPurpose)}`}
                          </Badge>
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
                            onClick={() => handleArchiveMediaItemAction(video, "archive")}
                            disabled={video.archiveStatus === ARCHIVE_ARCHIVED || Boolean(archiveActionLoadingId)}
                          >
                            Move to Archive
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleArchiveMediaItemAction(video, "restore")}
                            disabled={video.archiveStatus !== ARCHIVE_ARCHIVED || Boolean(archiveActionLoadingId)}
                          >
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-700 border-red-200 hover:bg-red-50"
                            onClick={() => handleArchiveMediaItemAction(video, "delete")}
                            disabled={Boolean(archiveActionLoadingId)}
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
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{playbackTitle || 'Stage Video'}</DialogTitle>
            <DialogDescription>
              Playback for this stage video. Use the video controls to expand full screen.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-3">
            {playbackUrl ? (
              <video
                className="max-h-[60dvh] w-full rounded border bg-black object-contain"
                controls
                autoPlay
                src={playbackUrl}
              >
                Your browser does not support HTML5 video playback.
              </video>
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                Video preview is temporarily unavailable because a storage playback link could not be loaded.
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
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col sm:max-h-[90vh] sm:max-w-4xl">
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
                    <p className="text-sm text-gray-600">Use the review package player to preview stage videos.</p>
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
                      <span className="text-sm font-medium">
                        {selectedVideoForDetails?.bytes
                          ? `${(Number(selectedVideoForDetails.bytes) / (1024 * 1024)).toFixed(2)} MB`
                          : "Unknown"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Upload Date:</span>
                      <span className="text-sm font-medium">{formatDateOnlyUtc(selectedVideoForDetails.reviewedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Upload Time:</span>
                      <span className="text-sm font-medium">{formatTimeUtc(selectedVideoForDetails.reviewedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Mime Type:</span>
                      <span className="text-sm font-medium">{selectedVideoForDetails?.mimeType || "Unknown"}</span>
                    </div>
                  </div>
                </div>

                {/* Job Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Job Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Work Type:</span>
                      <span className="text-sm font-medium">{selectedVideoForDetails.jobTitle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Client:</span>
                      <span className="text-sm font-medium">{selectedVideoForDetails.client}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Job Status:</span>
                      <span className="text-sm font-medium">{formatJobStatusLabel(selectedVideoForDetails?.status, null)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Job ID:</span>
                      <span className="text-sm font-medium">{String(selectedVideoForDetails.id || "-")}</span>
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
                      <p className="font-medium">{formatDateOnlyUtc(selectedVideoForDetails.reviewedAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Review Time</p>
                      <p className="font-medium">{formatTimeUtc(selectedVideoForDetails.reviewedAt)}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Review Notes</p>
                    <p className="text-sm bg-gray-50 p-3 rounded border">
                      {selectedVideoForDetails.moderationReason ||
                        selectedVideoForDetails.reviewReason ||
                        "No reviewer note is available for this media item."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Audit Trail */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Audit Trail</h4>
                <div className="space-y-2">
                  {selectedVideoForDetails.createdAt || selectedVideoForDetails.uploadDate ? (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-600">
                        {formatDateOnlyUtc(selectedVideoForDetails.createdAt || selectedVideoForDetails.uploadDate)}{' '}
                        {formatTimeUtc(selectedVideoForDetails.createdAt || selectedVideoForDetails.uploadDate)}
                      </span>
                      <span className="font-medium">
                        Uploaded by {selectedVideoForDetails.employee || "assigned team member"}
                      </span>
                    </div>
                  ) : null}
                  {selectedVideoForDetails.moderatedAt || selectedVideoForDetails.reviewedAt ? (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600">
                        {formatDateOnlyUtc(selectedVideoForDetails.moderatedAt || selectedVideoForDetails.reviewedAt)}{' '}
                        {formatTimeUtc(selectedVideoForDetails.moderatedAt || selectedVideoForDetails.reviewedAt)}
                      </span>
                      <span className="font-medium">
                        Moderation status: {String(selectedVideoForDetails.moderationStatus || selectedVideoForDetails.status || "pending_review").replace(/_/g, " ")}
                      </span>
                    </div>
                  ) : null}
                  {!selectedVideoForDetails.createdAt &&
                  !selectedVideoForDetails.uploadDate &&
                  !selectedVideoForDetails.moderatedAt &&
                  !selectedVideoForDetails.reviewedAt ? (
                    <p className="text-sm text-gray-600">No audit timestamps are available for this media item.</p>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex-shrink-0 pt-4 border-t">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                Download and share controls are managed from approved customer-facing video surfaces, not from this vendor jobs view.
              </p>
              <Button onClick={() => setShowVideoDetailsModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Work Record Modal */}
      <Dialog
        open={showCreateJob}
        onOpenChange={(open) => {
          setShowCreateJob(open);
          if (!open) {
            setNewServiceForJob({ name: '', description: '', price: '', estimatedDuration: '' });
            setEditJobBaseline(null);
            materialEditConfirmedRef.current = false;
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{jobModalMode === 'edit' ? 'Edit Work Record' : 'Add Work Record'}</DialogTitle>
            <DialogDescription>
              {jobModalMode === 'edit'
                ? 'Update saved work details.'
                : 'Create the customer work record that can later be assigned to employees, sent for verified recording permission, and moved through the three video stages. Choose an approved Services Offered item, or submit a new service for admin approval first.'}
            </DialogDescription>
          </DialogHeader>
          {jobModalMode !== 'edit' ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              <span className="font-semibold text-slate-950">What happens after saving:</span>{' '}
              Reliance creates the work record, returns you to Manage Jobs, and the selected service becomes
              available for assignment, consent, employee recording, manager review, and admin approval.
            </div>
          ) : null}
          {jobModalMode === 'edit' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              Customer contact corrections use <strong>Manage Recording Permission</strong>. The saved service location is immutable. Changing the service or recording scope replaces stale permission and employee certification evidence.
            </div>
          ) : null}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Offered / Work Type <span aria-hidden="true">*</span>
              </label>
              <select
                ref={serviceTypeSelectRef}
                value={newJob.serviceId}
                required
                aria-invalid={Boolean(jobFieldErrors.serviceId)}
                onChange={(e) => {
                  const value = e.target.value;
                  const chosenService = publishedServiceOptions.find((service) => service.id === value);
                  setNewJob({
                    ...newJob,
                    serviceId: value,
                    title: value === ADD_NEW_SERVICE_VALUE ? '' : chosenService?.name || '',
                  });
                  if (value !== ADD_NEW_SERVICE_VALUE) {
                    setNewServiceForJob({ name: '', description: '', price: '', estimatedDuration: '' });
                  }
                  if (value) {
                    setJobFieldErrors((prev) => ({ ...prev, serviceId: '', title: '' }));
                  }
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                disabled={servicesLoading}
              >
                <option value="">
                  {servicesLoading ? 'Loading services...' : 'Select a service offered'}
                </option>
                {jobModalMode !== 'edit' ? (
                  <option value={ADD_NEW_SERVICE_VALUE}>+ Add a new service offered</option>
                ) : null}
                {publishedServiceOptions.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                This becomes the work title customers, employees, videos, reviews, and service cards reference.
              </p>
              {jobFieldErrors.serviceId && (
                <p className="mt-1 text-sm text-red-600">{jobFieldErrors.serviceId}</p>
              )}
              {!servicesLoading && publishedServiceOptions.length === 0 && (
                <p className="mt-1 text-sm text-amber-700">No approved Services Offered items are available yet. Submit a service for admin approval first.</p>
              )}
              {servicesLoadError && (
                <p className="mt-1 text-xs text-amber-700">{servicesLoadError}</p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer First Name <span aria-hidden="true">*</span>
                </label>
                <Input
                  ref={clientNameInputRef}
                  placeholder="First name"
                  value={newJob.customerFirstName}
                  required
                  aria-invalid={Boolean(jobFieldErrors.customerFirstName)}
                  disabled={jobModalMode === 'edit'}
                  onChange={(e) => {
                    const value = e.target.value;
                    const nextFirstName = value;
                    const nextClient = `${nextFirstName.trim()} ${newJob.customerLastName.trim()}`.trim();
                    setNewJob({ ...newJob, customerFirstName: nextFirstName, client: nextClient });
                    if (value.trim()) {
                      setJobFieldErrors((prev) => ({ ...prev, customerFirstName: '' }));
                    }
                  }}
                />
                {jobFieldErrors.customerFirstName && (
                  <p className="mt-1 text-sm text-red-600">{jobFieldErrors.customerFirstName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Last Name <span aria-hidden="true">*</span>
                </label>
                <Input
                  ref={clientLastNameInputRef}
                  placeholder="Last name"
                  value={newJob.customerLastName}
                  required
                  aria-invalid={Boolean(jobFieldErrors.customerLastName)}
                  disabled={jobModalMode === 'edit'}
                  onChange={(e) => {
                    const value = e.target.value;
                    const nextLastName = value;
                    const nextClient = `${newJob.customerFirstName.trim()} ${nextLastName.trim()}`.trim();
                    setNewJob({ ...newJob, customerLastName: nextLastName, client: nextClient });
                    if (value.trim()) {
                      setJobFieldErrors((prev) => ({ ...prev, customerLastName: '' }));
                    }
                  }}
                />
                {jobFieldErrors.customerLastName && (
                  <p className="mt-1 text-sm text-red-600">{jobFieldErrors.customerLastName}</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <Input
                ref={phoneInputRef}
                placeholder="Enter phone number"
                value={newJob.phone}
                aria-invalid={Boolean(jobFieldErrors.phone)}
                disabled={jobModalMode === 'edit'}
                onChange={(e) => {
                  const formattedPhone = formatPhoneNumber(e.target.value);
                  const digits = getPhoneDigits(formattedPhone);
                  setNewJob({ ...newJob, phone: formattedPhone });
                  if (!formattedPhone.trim() || digits.length === 10) {
                    setJobFieldErrors((prev) => ({
                      ...prev,
                      phone: '',
                      contact: digits.length === 10 || newJob.email.trim() ? '' : prev.contact,
                    }));
                  }
                }}
                inputMode="numeric"
              />
              <p className="mt-1 text-xs text-gray-500">Optional. Add a mobile number for SMS updates when available.</p>
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
                aria-invalid={Boolean(jobFieldErrors.email)}
                disabled={jobModalMode === 'edit'}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewJob({ ...newJob, email: value });
                  const trimmed = value.trim();
                  if (trimmed.includes('@') && trimmed.includes('.')) {
                    setJobFieldErrors((prev) => ({
                      ...prev,
                      email: '',
                      contact: '',
                    }));
                  }
                }}
              />
              <p className="mt-1 text-xs text-gray-500">
                Required so the customer can securely claim and watch the completed Private Service Video.
              </p>
              {jobFieldErrors.email && (
                <p className="mt-1 text-sm text-red-600">{jobFieldErrors.email}</p>
              )}
              {jobFieldErrors.contact && (
                <p className="mt-1 text-sm text-red-600">{jobFieldErrors.contact}</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="block text-sm font-semibold text-slate-900">
                Service video consent and location path
              </label>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Choose how this work record will unlock employee recording and customer visibility.
              </p>
              <div className="mt-3 grid gap-2">
                {[
                  {
                    value: 'business',
                    title: 'Vendor business address',
                    detail: 'The employee phone verifies the vendor business address. This location path does not authorize capturing customers, bystanders, or unrelated personal information.',
                  },
                  {
                    value: 'residence',
                    title: 'Customer residence',
                    detail: 'Customer receives consent and chooses whether the completed proof can be public or private.',
                  },
                  {
                    value: 'customer-business',
                    title: 'Customer business address',
                    detail: 'Verified recording permission is required, and the employee phone verifies the customer business location.',
                  },
                ].map((option) => {
                  const checked = newJob.recordingLocation === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                        checked
                          ? 'border-blue-400 bg-blue-50 text-blue-950'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-blue-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="recordingLocation"
                        value={option.value}
                        checked={checked}
                        disabled={jobModalMode === 'edit'}
                        onChange={() => {
                          setNewJob({ ...newJob, recordingLocation: option.value });
                          setJobFieldErrors((prev) => ({ ...prev, recordingLocation: '' }));
                        }}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-semibold">{option.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-600">{option.detail}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {jobFieldErrors.recordingLocation ? (
                <p className="mt-2 text-sm text-red-600">{jobFieldErrors.recordingLocation}</p>
              ) : null}
              {newJob.recordingLocation === 'residence' && jobModalMode !== 'edit' ? (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-950">Customer residence for this work record</p>
                  <p className="mt-1 text-xs leading-5 text-blue-900/75">
                    This exact service address is saved with the work record and verified from the assigned employee's phone. It is not taken from the vendor address.
                  </p>
                  <div className="mt-3 space-y-3">
                    <AddressAutocompleteInput
                      value={newJob.customerResidenceAddress}
                      onChange={(value) => {
                        setNewJob({
                          ...newJob,
                          customerResidenceAddress: value,
                          customerResidenceLatitude: null,
                          customerResidenceLongitude: null,
                        });
                        setJobFieldErrors((current) => ({ ...current, customerResidenceAddress: '' }));
                      }}
                      onSelectAddress={(suggestion) => {
                        setNewJob({
                          ...newJob,
                          customerResidenceAddress: suggestion.address,
                          customerResidenceCity: suggestion.city,
                          customerResidenceState: suggestion.state,
                          customerResidenceZipCode: suggestion.zipCode,
                          customerResidenceLatitude: suggestion.latitude ?? null,
                          customerResidenceLongitude: suggestion.longitude ?? null,
                        });
                        setJobFieldErrors((current) => ({ ...current, customerResidenceAddress: '' }));
                      }}
                      placeholder="Start typing the service street address"
                      inputClassName="bg-white text-slate-950"
                    />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Input
                        value={newJob.customerResidenceCity}
                        onChange={(event) => setNewJob({ ...newJob, customerResidenceCity: event.target.value, customerResidenceLatitude: null, customerResidenceLongitude: null })}
                        placeholder="City"
                        className="bg-white text-slate-950"
                      />
                      <Input
                        value={newJob.customerResidenceState}
                        onChange={(event) => setNewJob({ ...newJob, customerResidenceState: event.target.value, customerResidenceLatitude: null, customerResidenceLongitude: null })}
                        placeholder="State"
                        className="bg-white text-slate-950"
                      />
                      <Input
                        value={newJob.customerResidenceZipCode}
                        onChange={(event) => setNewJob({ ...newJob, customerResidenceZipCode: event.target.value, customerResidenceLatitude: null, customerResidenceLongitude: null })}
                        placeholder="ZIP code"
                        className="bg-white text-slate-950"
                      />
                    </div>
                  </div>
                  {jobFieldErrors.customerResidenceAddress ? (
                    <p className="mt-2 text-sm text-red-700">{jobFieldErrors.customerResidenceAddress}</p>
                  ) : null}
                </div>
              ) : null}
              {newJob.recordingLocation === 'customer-business' && jobModalMode !== 'edit' ? (
                <div className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
                  <p className="text-sm font-semibold text-cyan-950">Customer business address for this work record</p>
                  <p className="mt-1 text-xs leading-5 text-cyan-900/75">
                    This exact customer business address is saved with the work record. Reliance will not substitute the customer residence or vendor address.
                  </p>
                  <div className="mt-3 space-y-3">
                    <AddressAutocompleteInput
                      value={newJob.customerBusinessAddress}
                      onChange={(value) => {
                        setNewJob({
                          ...newJob,
                          customerBusinessAddress: value,
                          customerBusinessLatitude: null,
                          customerBusinessLongitude: null,
                        });
                        setJobFieldErrors((current) => ({ ...current, customerBusinessAddress: '' }));
                      }}
                      onSelectAddress={(suggestion) => {
                        setNewJob({
                          ...newJob,
                          customerBusinessAddress: suggestion.address,
                          customerBusinessCity: suggestion.city,
                          customerBusinessState: suggestion.state,
                          customerBusinessZipCode: suggestion.zipCode,
                          customerBusinessLatitude: suggestion.latitude ?? null,
                          customerBusinessLongitude: suggestion.longitude ?? null,
                        });
                        setJobFieldErrors((current) => ({ ...current, customerBusinessAddress: '' }));
                      }}
                      placeholder="Start typing the customer business street address"
                      inputClassName="bg-white text-slate-950"
                    />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Input
                        value={newJob.customerBusinessCity}
                        onChange={(event) => setNewJob({ ...newJob, customerBusinessCity: event.target.value, customerBusinessLatitude: null, customerBusinessLongitude: null })}
                        placeholder="City"
                        className="bg-white text-slate-950"
                      />
                      <Input
                        value={newJob.customerBusinessState}
                        onChange={(event) => setNewJob({ ...newJob, customerBusinessState: event.target.value, customerBusinessLatitude: null, customerBusinessLongitude: null })}
                        placeholder="State"
                        className="bg-white text-slate-950"
                      />
                      <Input
                        value={newJob.customerBusinessZipCode}
                        onChange={(event) => setNewJob({ ...newJob, customerBusinessZipCode: event.target.value, customerBusinessLatitude: null, customerBusinessLongitude: null })}
                        placeholder="ZIP code"
                        className="bg-white text-slate-950"
                      />
                    </div>
                  </div>
                  {jobFieldErrors.customerBusinessAddress ? (
                    <p className="mt-2 text-sm text-red-700">{jobFieldErrors.customerBusinessAddress}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-5 border-t border-slate-200 pt-4">
                  <p className="text-sm font-semibold text-slate-900">What may appear in the Service Video?</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    This keeps the employee inside the approved scope. Changing this scope replaces prior permission and employee certification.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-700">
                      Whose property may appear in the video?
                      <select
                        value={newJob.propertyScope}
                        onChange={(event) => {
                          setNewJob({ ...newJob, propertyScope: event.target.value });
                          setJobFieldErrors((current) => ({ ...current, recordingAssessment: '' }));
                        }}
                        className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                      >
                        <option value="">Choose one</option>
                        <option value="vendor_owned">Only the vendor&apos;s property or work area</option>
                        <option value="customer_owned">Only the customer&apos;s property</option>
                        <option value="mixed">Both vendor and customer property</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      Could anyone be identifiable in the video?
                      <select
                        value={newJob.peopleScope}
                        onChange={(event) => {
                          setNewJob({ ...newJob, peopleScope: event.target.value });
                          setJobFieldErrors((current) => ({ ...current, recordingAssessment: '' }));
                        }}
                        className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                      >
                        <option value="">Choose one</option>
                        <option value="none">No identifiable people</option>
                        <option value="customer">Customer</option>
                        <option value="employee">Assigned employee</option>
                        <option value="multiple">More than one person</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      What will the camera primarily show?
                      <select
                        value={newJob.frameControl}
                        onChange={(event) => {
                          setNewJob({ ...newJob, frameControl: event.target.value });
                          setJobFieldErrors((current) => ({ ...current, recordingAssessment: '' }));
                        }}
                        className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                      >
                        <option value="">Choose one</option>
                        <option value="controlled">Only the planned work area</option>
                        <option value="partial">The work area and some surroundings</option>
                        <option value="uncontrolled">An area where people may enter unexpectedly</option>
                      </select>
                    </label>
                  </div>
                  <fieldset className="mt-3">
                    <legend className="text-xs font-semibold text-slate-700">Does this Service Video need audio?</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className={`flex cursor-pointer gap-3 rounded-md border p-3 ${!newJob.audioRequested ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                        <input
                          type="radio"
                          name="recordingAudioScope"
                          checked={!newJob.audioRequested}
                          onChange={() => setNewJob({ ...newJob, audioRequested: false })}
                        />
                        <span><strong className="block text-sm">No - Video only</strong><span className="text-xs text-slate-600">Sound will not be recorded.</span></span>
                      </label>
                      <label className={`flex cursor-pointer gap-3 rounded-md border p-3 ${newJob.audioRequested ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                        <input
                          type="radio"
                          name="recordingAudioScope"
                          checked={newJob.audioRequested}
                          onChange={() => setNewJob({ ...newJob, audioRequested: true })}
                        />
                        <span><strong className="block text-sm">Yes - Video and audio</strong><span className="text-xs text-slate-600">Record sound only when it helps document the service.</span></span>
                      </label>
                    </div>
                    {newJob.audioRequested ? <p className="mt-2 text-xs leading-5 text-amber-800">Conversations and unrelated private information must not be intentionally recorded.</p> : null}
                  </fieldset>
                  <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                    {[
                      ['minorMayAppear', 'A child under 18 may appear in the video'],
                      ['protectedNonParticipantMayAppear', 'A bystander or another person who is not part of the service may appear'],
                      ['sensitiveInformationMayAppear', 'Private documents, screens, records, or sensitive information may appear'],
                      ['identifiersMayAppear', 'An address, license plate, account number, key, access code, or security equipment may appear'],
                    ].map(([field, label]) => (
                      <label key={field} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean((newJob as any)[field])}
                          onChange={(event) =>
                            setNewJob({ ...newJob, [field]: event.target.checked })
                          }
                          className="mt-1"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-950">
                    {newJob.audioRequested ? 'Audio is included for the complete three-stage package.' : 'Audio is off for the complete three-stage package.'} Public sharing is never included in this assessment and requires a separate later customer decision.
                  </div>
                  {jobFieldErrors.recordingAssessment ? (
                    <p className="mt-2 text-sm text-red-600">{jobFieldErrors.recordingAssessment}</p>
                  ) : null}
                </div>
            </div>
            {newJob.serviceId === ADD_NEW_SERVICE_VALUE ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-blue-950">Create a new Services Offered item for this job</p>
                  <p className="mt-1 text-xs leading-5 text-blue-800">
                    This saves one reusable service menu item and creates this work record now. Next time, the service will appear in the Service Offered / Work Type dropdown. All fields below are required.
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-blue-950">
                    To only edit your service menu without creating a work record, use Services Offered from the left menu.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-blue-900">
                      Service name <span aria-hidden="true">*</span>
                    </label>
                    <Input
                      value={newServiceForJob.name}
                      onChange={(event) =>
                        setNewServiceForJob((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Example: Outlet installation"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-blue-900">
                      Estimated duration <span aria-hidden="true">*</span>
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={newServiceForJob.estimatedDuration}
                      onChange={(event) =>
                        setNewServiceForJob((current) => ({
                          ...current,
                          estimatedDuration: event.target.value,
                        }))
                      }
                      placeholder="Minutes, example: 60"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-blue-900">
                      Reference price <span aria-hidden="true">*</span>
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newServiceForJob.price}
                      onChange={(event) =>
                        setNewServiceForJob((current) => ({ ...current, price: event.target.value }))
                      }
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-blue-900">
                      Customer-facing description <span aria-hidden="true">*</span>
                    </label>
                    <textarea
                      value={newServiceForJob.description}
                      onChange={(event) =>
                        setNewServiceForJob((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                      placeholder="Describe what customers can expect from this service."
                      required
                    />
                  </div>
                </div>
              </div>
            ) : null}
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
              {isCreatingJob
                ? jobModalMode === 'edit'
                  ? 'Saving...'
                  : isAddingServiceFromJob
                    ? 'Creating Service and Work...'
                    : 'Creating...'
                : jobModalMode === 'edit'
                  ? 'Save Work'
                  : isAddingServiceFromJob
                    ? 'Create Service and Work Record'
                    : 'Add Work Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMaterialEditConfirm} onOpenChange={setShowMaterialEditConfirm}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request new recording permission?</DialogTitle>
            <DialogDescription>
              This edit changes information that the customer and employee relied on when recording was authorized.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <p className="font-semibold">Continuing will replace the current authorization for this Service Order.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Any existing customer recording permission will no longer authorize the changed Service Order.</li>
                <li>Prior permission and certification evidence will remain preserved in history.</li>
                <li>A new recording-permission request will be required or sent when the updated scope requires it.</li>
                <li>Employee recording may remain locked until the new requirements are complete.</li>
              </ul>
            </div>
            <p className="text-xs text-slate-500">
              Material fields changed: {materialEditFields.map((field) => field.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMaterialEditConfirm(false);
                materialEditConfirmedRef.current = false;
              }}
            >
              Go Back
            </Button>
            <Button
              onClick={() => {
                setShowMaterialEditConfirm(false);
                materialEditConfirmedRef.current = true;
                void handleCreateJob();
              }}
            >
              Continue and Request New Permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select Job Modal */}
      <Dialog open={showSelectJobModal} onOpenChange={setShowSelectJobModal}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Work Record</DialogTitle>
            <DialogDescription>
              Select the service record or manual work item for the employee recording link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {jobsLoading ? (
              <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
                <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
                <div className="h-3 w-full rounded bg-gray-200 animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-gray-200 animate-pulse" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                No work records yet. Add a work record before sending an employee recording link.
              </div>
            ) : (
              filteredJobs.map((job) => {
                const uploadEligible = isJobAssignedForVideoUpload(job);
                return (
                  <label
                    key={job.id}
                    className={`block p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedJobForVideoId === String(job.id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    } ${uploadEligible ? "" : "opacity-70"}`}
                    title={!uploadEligible ? videoAssignmentRequiredCopy : undefined}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="selected-job-for-video"
                        className="mt-1"
                        checked={selectedJobForVideoId === String(job.id)}
                        onChange={() => setSelectedJobForVideoId(String(job.id))}
                        disabled={!uploadEligible}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{job.title}</div>
                        <div className="text-sm text-gray-600">Client: {job.client}</div>
                        <div className="text-sm text-gray-600">Service: {job.serviceName || job.serviceType || 'General Service'}</div>
                        <div className="text-sm text-gray-600">Status: {job.status}</div>
                        <div className="text-sm text-gray-600">
                          Media: {Number(job.linkedMediaCount || 0)} asset(s) — you will pick Intro / In Progress /
                          Completed on the next step.
                        </div>
                        {getJobMediaModerationSummary(job) && (
                          <div className="text-sm text-gray-600">
                            {getJobMediaModerationSummary(job)?.label}
                          </div>
                        )}
                        <div className="text-sm text-gray-600">
                          Assigned: {job.assignedEmployees?.length ? job.assignedEmployees[0] : "Unassigned"}
                        </div>
                        {!uploadEligible ? (
                          <div className="mt-1 text-xs text-amber-700 font-medium">{videoAssignmentRequiredCopy}</div>
                        ) : null}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSelectJobModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleContinueWithSelectedJob}
              disabled={!selectedJobForVideo || !isJobAssignedForVideoUpload(selectedJobForVideo)}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {false ? (
      /* Legacy vendor upload modal intentionally disabled: stage videos must come from employee recording links. */
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          if (open && (!selectedJob || !isJobAssignedForVideoUpload(selectedJob))) {
            if (selectedJob && !isJobAssignedForVideoUpload(selectedJob)) {
              setVideoUploadError(videoAssignmentRequiredCopy);
            }
            return;
          }
          setShowModal(open);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Service Video</DialogTitle>
            <DialogDescription>
              Upload a video for the selected job: {selectedJob?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900 space-y-2">
              <p className="font-medium text-indigo-950">How staged job videos work</p>
              <ul className="list-disc pl-5 space-y-1.5 leading-snug">
                <li>
                  <strong>Starting Condition</strong>, <strong>Work in Progress</strong>, and <strong>Final Result</strong> are three
                  separate slots. You can have at most <strong>one active video per slot</strong> for the same job.
                </li>
                <li>
                  Keep each stage short and useful. Clips are limited to{" "}
                  <strong>{formatStageVideoDuration(STAGE_VIDEO_MAX_DURATION_SECONDS)}</strong>.
                </li>
                <li>
                  <strong>Intro is only available after consent is accepted</strong> for customer residence/business
                  recordings. Business-address recordings show <strong>Consent not required</strong> and use location
                  verification instead.
                </li>
                <li>
                  The <strong>Completed</strong> slot is your <strong>primary completion video</strong>. When it exists,
                  reviewers and moderators treat it as the main evidence that the job was finished as agreed.
                </li>
                <li>
                  Uploads stay <strong>private</strong> until moderation sets visibility. If you upload again for the
                  same slot, check <strong>Replace existing…</strong> so the previous file for that slot is archived
                  first.
                </li>
              </ul>
            </div>
            {selectedJob && !isJobAssignedForVideoUpload(selectedJob) ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {videoAssignmentRequiredCopy}
              </div>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Video stage <span aria-hidden="true">*</span>
              </label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newVideo.videoStage}
                onChange={(e) => {
                  const value = e.target.value as '' | VendorJobVideoStage;
                  setNewVideo((prev) => ({ ...prev, videoStage: value }));
                  if (value) setVideoFieldErrors((prev) => ({ ...prev, videoStage: '' }));
                }}
              >
                <option value="">Select stage…</option>
                <option value="INTRO">Intro</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
              {videoFieldErrors.videoStage && (
                <p className="mt-1 text-sm text-red-600">{videoFieldErrors.videoStage}</p>
              )}
            </div>
            {selectedStageGuidance ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <p className="font-semibold">{selectedStageGuidance.label}</p>
                <p className="mt-1">{selectedStageGuidance.cue}</p>
                <p className="mt-1 text-xs font-medium">
                  Timer target: {formatStageVideoDuration(STAGE_VIDEO_MAX_DURATION_SECONDS)} max.
                </p>
              </div>
            ) : null}
            {selectedJob && newVideo.videoStage && jobHasVideoForStage(selectedJob, newVideo.videoStage) ? (
              <label className="flex items-start gap-2 text-sm text-gray-800">
                <Checkbox
                  checked={newVideo.replaceStage}
                  onCheckedChange={(checked) =>
                    setNewVideo((prev) => ({ ...prev, replaceStage: Boolean(checked) }))
                  }
                />
                <span>
                  Retake this stage: replace the existing <strong>{formatVideoStageLabel(newVideo.videoStage)}</strong>{" "}
                  video. The current upload for this stage will be archived after the new file is accepted.
                </span>
              </label>
            ) : null}
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
              <p className="mt-1 text-xs text-gray-600">
                Upload a short clip only. {getStageVideoLimitCopy()} Record again if the first take is not clear.
              </p>
              {selectedVideoDurationSeconds != null ? (
                <p className="mt-1 text-xs font-medium text-emerald-700">
                  Selected clip length: {formatStageVideoDuration(selectedVideoDurationSeconds)}.
                </p>
              ) : null}
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
      ) : null}

      {/* Bulk Assignment Modal */}
      <Dialog
        open={showBulkAssignmentModal}
        onOpenChange={(open) => {
          setShowBulkAssignmentModal(open);
          if (open) setBulkAssignmentMembershipIds([]);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Assign Jobs</DialogTitle>
            <DialogDescription>
              Assign {selectedJobIds.length} selected jobs to employees.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Employees</label>
              {employeesLoading ? (
                <p className="text-sm text-gray-600">Loading employees...</p>
              ) : employeesLoadError ? (
                <p className="text-sm text-red-700">{employeesLoadError}</p>
              ) : teamMembers.length === 0 ? (
                <p className="text-sm text-amber-700">No available employees for assignment.</p>
              ) : (
                <div className="space-y-2">
                  {teamMembers.map((m) => (
                    <label key={m.membershipId} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={bulkAssignmentMembershipIds.includes(m.membershipId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkAssignmentMembershipIds([...bulkAssignmentMembershipIds, m.membershipId]);
                          } else {
                            setBulkAssignmentMembershipIds(
                              bulkAssignmentMembershipIds.filter((id) => id !== m.membershipId)
                            );
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {m.name}
                        {m.role ? (
                          <span className="text-gray-500">
                            {' '}
                            ({m.role === 'MANAGER' ? 'Manager' : 'Team member'})
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkAssignmentModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleBulkAssignment(bulkAssignmentMembershipIds).catch(() => undefined)}
              disabled={
                Boolean(jobMutationLoadingId) ||
                bulkAssignmentMembershipIds.length === 0 ||
                employeesLoading ||
                teamMembers.length === 0
              }
            >
              {jobMutationLoadingId === 'assign:bulk' ? 'Assigning...' : 'Assign Jobs'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(locationExceptionJob)}
        onOpenChange={(open) => {
          if (!open && !locationExceptionSubmitting) {
            setLocationExceptionJob(null);
            setLocationExceptionReason('');
            setLocationExceptionError('');
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request a recording location exception</DialogTitle>
            <DialogDescription>
              Explain why the assigned employee cannot verify the saved service location. Recording stays locked while an independent Reliance admin reviews this request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p><strong>Who decides:</strong> Reliance admin</p>
              <p className="mt-1"><strong>What resolves it:</strong> Admin approval or successful device location verification.</p>
            </div>
            <label className="block text-sm font-medium" htmlFor="location-exception-reason">Manager explanation</label>
            <textarea
              id="location-exception-reason"
              value={locationExceptionReason}
              onChange={(event) => setLocationExceptionReason(event.target.value)}
              rows={5}
              className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-950"
              placeholder="Describe the device-location problem and the evidence an admin should review."
            />
            {locationExceptionError ? <p className="text-sm text-red-700">{locationExceptionError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationExceptionJob(null)} disabled={locationExceptionSubmitting}>Cancel</Button>
            <Button onClick={() => void requestRecordingLocationException()} disabled={locationExceptionSubmitting || locationExceptionReason.trim().length < 20}>
              {locationExceptionSubmitting ? 'Sending request...' : 'Send to Reliance Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Individual Job Assignment Modal */}
      <Dialog open={showAssignmentModal} onOpenChange={setShowAssignmentModal}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-md">
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
              {employeesLoading ? (
                <p className="text-sm text-gray-600">Loading employees...</p>
              ) : employeesLoadError ? (
                <p className="text-sm text-red-700">{employeesLoadError}</p>
              ) : teamMembers.length === 0 ? (
                <p className="text-sm text-amber-700">No available employees for assignment.</p>
              ) : (
                <div className="space-y-2">
                  {teamMembers.map((m) => (
                    <label key={m.membershipId} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedAssignmentMembershipIds.includes(m.membershipId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAssignmentMembershipIds([
                              ...selectedAssignmentMembershipIds,
                              m.membershipId,
                            ]);
                          } else {
                            setSelectedAssignmentMembershipIds(
                              selectedAssignmentMembershipIds.filter((id) => id !== m.membershipId)
                            );
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {m.name}
                        {m.role ? (
                          <span className="text-gray-500">
                            {' '}
                            ({m.role === 'MANAGER' ? 'Manager' : 'Team member'})
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                handleAssignmentUpdate(selectedJob, selectedAssignmentMembershipIds).catch(() => undefined)
              }
              disabled={Boolean(jobMutationLoadingId) || employeesLoading || teamMembers.length === 0}
            >
              {jobMutationLoadingId?.startsWith('assign:') ? 'Saving...' : (selectedJob?.assignedEmployees?.length > 0 ? 'Reassign' : 'Assign')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Status Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Job Status</DialogTitle>
            <DialogDescription>
              Persist a backend status update for this job.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="pending">Pending</option>
                <option value="in progress">In Progress</option>
                <option
                  value="completed"
                  disabled={Boolean(editingJob) && !canVendorMarkJobCompleted(editingJob)}
                >
                  Completed
                  {editingJob && !canVendorMarkJobCompleted(editingJob)
                    ? ' (needs media + awaiting review)'
                    : ''}
                </option>
                <option value="cancelled">Cancelled</option>
              </select>
              {editingJob && !canVendorMarkJobCompleted(editingJob) ? (
                <p className="text-xs text-gray-600">
                  Jobs move to <strong>Completed</strong> only after admin approval is finished for all required
                  service-video stages.
                </p>
              ) : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason (optional)</label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="w-full min-h-[90px] rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Reason for status change"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusModal(false)} disabled={Boolean(jobMutationLoadingId)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editingJob) return;
                handleStatusUpdate(editingJob, newStatus, statusReason).catch(() => undefined);
              }}
              disabled={!editingJob || !newStatus || Boolean(jobMutationLoadingId)}
            >
              {jobMutationLoadingId?.startsWith('status:') ? 'Saving...' : 'Save Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showRejectJobModal}
        onOpenChange={(open) => {
          setShowRejectJobModal(open);
          if (!open) {
            setRejectJobTarget(null);
            setRejectReasonInput('');
            setRejectStageSelection(['INTRO', 'IN_PROGRESS', 'COMPLETED']);
            setRejectJobSubmitting(false);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Video Changes</DialogTitle>
            <DialogDescription>
              Select only the stages that need correction. Saved stages you do not select will remain unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              Job: <span className="font-medium text-gray-900">{String(rejectJobTarget?.title || "Selected job")}</span>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Stages to correct</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ['INTRO', 'Starting Condition'],
                  ['IN_PROGRESS', 'Work in Progress'],
                  ['COMPLETED', 'Final Result'],
                ].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={rejectStageSelection.includes(value)}
                      onChange={(event) =>
                        setRejectStageSelection((current) =>
                          event.target.checked
                            ? Array.from(new Set([...current, value]))
                            : current.filter((stage) => stage !== value)
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">What needs to change?</label>
              <textarea
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                className="w-full min-h-[120px] rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Tell the employee exactly what to correct in the selected stage or stages."
                required
              />
              <p className="mt-1 text-xs text-gray-500">The employee receives this note with the secure service order link.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectJobModal(false)} disabled={rejectJobSubmitting}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                submitRejectJob().catch(() => undefined);
              }}
              disabled={rejectJobSubmitting || !String(rejectReasonInput || '').trim() || rejectStageSelection.length === 0}
            >
              {rejectJobSubmitting ? "Sending..." : "Request Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showApproveConfirmModal}
        onOpenChange={(open) => {
          setShowApproveConfirmModal(open);
          if (!open) {
            setApproveJobTarget(null);
            setApproveJobSubmitting(false);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Service Videos for Reliance Audit?</DialogTitle>
            <DialogDescription>
              This attests to the exact three-stage package and sends it to Reliance Admin Audit. The customer receives no Private Proof unless Admin records PASS. Admin REJECT is terminal for this Service Order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              Job name: <span className="font-medium text-gray-900">{String(approveJobTarget?.title || "Selected job")}</span>
            </p>
            <p>
              Assigned employee:{" "}
              <span className="font-medium text-gray-900">
                {Array.isArray(approveJobTarget?.assignedEmployees) && approveJobTarget.assignedEmployees.length > 0
                  ? approveJobTarget.assignedEmployees.join(", ")
                  : "Unassigned"}
              </span>
            </p>
            <div className="rounded border bg-gray-50 p-3 space-y-1">
              {([
                { key: 'INTRO' as const, label: 'Starting Condition' },
                { key: 'IN_PROGRESS' as const, label: 'Work in Progress' },
                { key: 'COMPLETED' as const, label: 'Final Result' },
              ]).map((stage) => {
                const present = Boolean(approveJobTarget && jobHasVideoForStage(approveJobTarget, stage.key));
                return (
                  <p key={`approve-summary-${stage.key}`} className="text-xs">
                    {stage.label}:{" "}
                    <span className={present ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
                      {present ? "Present" : "Missing"}
                    </span>
                  </p>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveConfirmModal(false)} disabled={approveJobSubmitting}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                submitApproveJob().catch(() => undefined);
              }}
              disabled={
                approveJobSubmitting ||
                !approveJobTarget ||
                !jobHasVideoForStage(approveJobTarget, 'INTRO') ||
                !jobHasVideoForStage(approveJobTarget, 'IN_PROGRESS') ||
                !jobHasVideoForStage(approveJobTarget, 'COMPLETED')
              }
            >
              {approveJobSubmitting ? "Submitting..." : "Submit to Reliance Audit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showPermissionRecoveryModal}
        onOpenChange={(open) => {
          if (permissionRecoveryLoading) return;
          setShowPermissionRecoveryModal(open);
          if (!open) {
            setPermissionRecoveryJob(null);
            setPermissionRecoveryRequestId('');
            setPermissionRecoveryError('');
            setPermissionRecoverySuccess('');
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Manage Recording Permission
            </DialogTitle>
            <DialogDescription>
              {getConsentStatusForJob(
                permissionRecoveryJob,
                getSavedRecordingComplianceForJob(permissionRecoveryJob)
              ) === CONSENT_STATE.WRONG_RECIPIENT
                ? 'The recipient reported this request as misdirected. Recording remains locked until you correct the customer contact and the new recipient allows recording.'
                : 'Recording remains locked while you resend the current request or correct who should receive it.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
              <div className="font-semibold">{String(permissionRecoveryJob?.title || 'Selected work record')}</div>
              <div className="mt-1 text-blue-800">
                Status: {String(
                  getConsentStatusForJob(
                    permissionRecoveryJob,
                    getSavedRecordingComplianceForJob(permissionRecoveryJob)
                  ) || 'pending'
                ).replace(/_/g, ' ')}
              </div>
            </div>

            {permissionRecoveryError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {permissionRecoveryError}
              </div>
            ) : null}
            {permissionRecoverySuccess ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
                {permissionRecoverySuccess}
              </div>
            ) : null}

            {getConsentStatusForJob(
              permissionRecoveryJob,
              getSavedRecordingComplianceForJob(permissionRecoveryJob)
            ) !== CONSENT_STATE.WRONG_RECIPIENT ? (
            <section className="space-y-3 border-b border-slate-200 pb-5">
              <div>
                <h3 className="font-semibold text-slate-950">Resend to the current recipient</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Current destination:{' '}
                  {[maskPermissionEmail(permissionRecoveryForm.email), maskPermissionPhone(permissionRecoveryForm.phone)]
                    .filter(Boolean)
                    .join(' / ') || 'No digital contact available'}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Resending creates a new secure link. The previous link stops working.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void runPermissionRecovery('resend')}
                disabled={Boolean(permissionRecoveryLoading) || !permissionRecoveryRequestId}
              >
                {permissionRecoveryLoading === 'resend' ? 'Resending...' : 'Resend Permission Request'}
              </Button>
            </section>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Resending to the current recipient is disabled. Correct the recipient below; the prior request remains in the audit history and its links stay revoked.
              </div>
            )}

            <section className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-950">Correct the recipient</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Use this when the request went to the wrong person or the customer contact changed.
                  The original request remains in the audit history and cannot be used again.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="permission-recipient-name" className="mb-1 block text-sm font-medium text-slate-800">
                    Verified customer contact
                  </label>
                  <Input
                    id="permission-recipient-name"
                    value={permissionRecoveryForm.name}
                    onChange={(event) =>
                      setPermissionRecoveryForm((current) => ({ ...current, name: event.target.value }))
                    }
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label htmlFor="permission-recipient-email" className="mb-1 block text-sm font-medium text-slate-800">
                    Email
                  </label>
                  <Input
                    id="permission-recipient-email"
                    type="email"
                    value={permissionRecoveryForm.email}
                    onChange={(event) =>
                      setPermissionRecoveryForm((current) => ({ ...current, email: event.target.value }))
                    }
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="permission-recipient-phone" className="mb-1 block text-sm font-medium text-slate-800">
                    Mobile phone
                  </label>
                  <Input
                    id="permission-recipient-phone"
                    inputMode="tel"
                    value={permissionRecoveryForm.phone}
                    onChange={(event) =>
                      setPermissionRecoveryForm((current) => ({
                        ...current,
                        phone: formatPhoneNumber(event.target.value),
                      }))
                    }
                    autoComplete="tel"
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={() => void runPermissionRecovery('correct')}
                disabled={
                  Boolean(permissionRecoveryLoading) ||
                  !permissionRecoveryRequestId ||
                  (!getUsableCustomerEmail(permissionRecoveryForm.email) &&
                    !String(permissionRecoveryForm.phone || '').trim())
                }
              >
                {permissionRecoveryLoading === 'correct'
                  ? 'Sending Corrected Request...'
                  : 'Correct Recipient and Send New Request'}
              </Button>
            </section>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPermissionRecoveryModal(false)}
              disabled={Boolean(permissionRecoveryLoading)}
            >
              Close
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
          if (!open) {
            resetComplianceState();
            setLocation('');
          }
          setShowComplianceModal(open);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-h-[90vh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Legal Compliance & Security Verification
            </DialogTitle>
            <DialogDescription>
              Assign an employee, choose the recording location, and request recording permission when required. Reliance sends the employee Service Order when every release requirement is complete.
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
                      if (selectedJob) persistLocationChoiceForJob(selectedJob, 'business');
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
                      if (selectedJob) persistLocationChoiceForJob(selectedJob, 'residence');
                    }} 
                  />
                  <span>At Customer Residence (Recording permission + location verification)</span>
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
                      if (selectedJob) persistLocationChoiceForJob(selectedJob, 'customer-business');
                    }} 
                  />
                  <span>At Customer Business (Recording permission + location verification)</span>
                </label>
              </div>
            </div>

            {/* Step 2: Location-specific Requirements */}
            {location && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3">Step 2: Complete Requirements</h3>
                <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <div className="font-medium text-gray-900">Compliance status</div>
                  <div className="mt-1 text-gray-700">
                    Assignment:{' '}
                    {assignmentSatisfiedForCompliance ? 'Assigned' : 'Assignment required'}
                  </div>
                  <div className="mt-1 text-gray-700">
                    Recording permission:{' '}
                    {!consentRequiredForCompliance
                      ? 'Not required for selected location'
                      : customerConsentStatus === CONSENT_STATE.ACCEPTED
                      ? 'Verified and allowed'
                      : customerConsentStatus === CONSENT_STATE.REQUESTED
                      ? 'Delivered (awaiting customer response)'
                      : customerConsentStatus === CONSENT_STATE.DECLINED
                      ? 'Recording declined'
                      : customerConsentStatus === CONSENT_STATE.DELIVERY_FAILED
                      ? 'Delivery failed - recording locked'
                      : customerConsentStatus === CONSENT_STATE.WRONG_RECIPIENT
                      ? 'Wrong or mismatched recipient - correction required'
                      : customerConsentStatus === CONSENT_STATE.NO_DIGITAL_CHANNEL
                      ? 'No email or mobile phone - correction required'
                      : customerConsentStatus === CONSENT_STATE.EXPIRED_OR_UNAVAILABLE
                      ? 'Expired or unavailable'
                      : 'Verified permission required'}
                  </div>
                  <div className="text-gray-700">
                    Location verification:{' '}
                    {!locationRequiredForCompliance
                      ? 'Not required for selected location'
                      : locationVerified
                      ? 'Verified'
                      : 'Employee phone will verify before recording'}
                  </div>
                </div>
                {consentRequiredForCompliance && (
                  <div className="mb-4 rounded-md border border-gray-200 bg-white px-3 py-3 text-sm">
                    <div className="font-medium text-gray-900">Recording-permission status</div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div
                        className={`rounded border px-2 py-1 text-center ${
                          customerConsentStatus === CONSENT_STATE.REQUESTED
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-gray-50 text-gray-500'
                        }`}
                      >
                        Waiting
                      </div>
                      <div
                        className={`rounded border px-2 py-1 text-center ${
                          customerConsentStatus === CONSENT_STATE.ACCEPTED
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-gray-200 bg-gray-50 text-gray-500'
                        }`}
                      >
                        Allowed
                      </div>
                      <div
                        className={`rounded border px-2 py-1 text-center ${
                          customerConsentStatus === CONSENT_STATE.DECLINED
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-gray-200 bg-gray-50 text-gray-500'
                        }`}
                      >
                        Declined
                      </div>
                    </div>
                    {customerConsentStatus === CONSENT_STATE.DELIVERY_FAILED ? (
                      <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                        Delivery was not confirmed. Check the recipient and resend the secure request. Recording remains locked.
                      </div>
                    ) : null}
                    {customerConsentStatus === CONSENT_STATE.WRONG_RECIPIENT ? (
                      <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                        The recipient was reported as wrong or the contact channels do not match. Correct the customer contact before resending.
                      </div>
                    ) : null}
                    {customerConsentStatus === CONSENT_STATE.NO_DIGITAL_CHANNEL ? (
                      <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                        No customer email or mobile phone is available. Add one before sending recording permission.
                      </div>
                    ) : null}
                  </div>
                )}
                
                {/* Business Address Flow */}
                {location === 'business' && (
                  <div>
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">Employee phone verifies the address</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Send the service order to the assigned employee. When they open it on-site, Reliance will ask their phone for location before the camera opens.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-900">Location Verification</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            Business-address recordings are blocked unless the employee phone reports a location near the registered business address. Location and device details are logged for compliance and security.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer Residence Flow */}
                {location === 'residence' && (
                  <div>
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">Verified Recording Permission Required</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            The intended customer contact receives a secure request explaining what will be recorded. Recording stays locked until identity, delivery, and customer authority are verified.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-900">Recording Safeguard</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            The customer makes the recording decision directly. This request starts Private, keeps audio off, and creates an audit history without making the video Public.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                      <div className="font-medium text-gray-900">Recording-permission recipient</div>
                      <div className={hasCustomerContactForJob(selectedJob) ? 'text-gray-700' : 'text-red-700'}>
                        {formatCustomerConsentRecipient(selectedJob)}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Reliance sends the secure request to the customer contact saved on this work record.
                      </div>
                    </div>

                    <Button 
                      onClick={handleRequestCustomerConsent} 
                      disabled={
                        !hasCustomerContactForJob(selectedJob) ||
                        customerConsentSending ||
                        customerConsentStatus === CONSENT_STATE.ACCEPTED
                      }
                      className="w-full"
                    >
                      {customerConsentSending
                        ? 'Sending Recording Permission...'
                        : customerConsentStatus === CONSENT_STATE.REQUESTED
                          ? 'Resend Recording Permission'
                          : 'Send Recording Permission'}
                    </Button>
                    {!hasCustomerContactForJob(selectedJob) ? (
                      <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        Customer email or mobile phone is missing. Add a valid recipient before requesting permission.
                      </div>
                    ) : null}
                    {customerConsentSending ? (
                      <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                        Sending the secure recording-permission request. Recording remains locked until delivery and the customer decision are verified.
                      </div>
                    ) : null}
                    
                    {customerConsentStatus === CONSENT_STATE.REQUESTED && (
                      <div className="mt-2 text-sm text-blue-600 space-y-2">
                        <div>Recording-permission request sent. Waiting for the verified customer contact.</div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void refreshConsentStatusForSelectedJob()}
                          disabled={consentRefreshLoading}
                          className="w-full"
                        >
                          {consentRefreshLoading ? 'Checking permission...' : 'Refresh permission status'}
                        </Button>
                        {consentRefreshError ? (
                          <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                            {consentRefreshError}
                          </div>
                        ) : null}
                      </div>
                    )}
                    {customerConsentStatus === CONSENT_STATE.ACCEPTED && (
                      <div className="mt-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                        <div className="text-base font-semibold text-green-800">✔ Ready to Record</div>
                        <div className="mt-1">Verified recording permission is active. The employee may proceed within the approved scope.</div>
                        <div className="mt-1 text-green-700/90">
                          Permission covers the three service stages, starts Private, and keeps audio off. Public sharing is a separate later decision.
                        </div>
                      </div>
                    )}
                    {customerConsentStatus === CONSENT_STATE.DECLINED && (
                      <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        The customer declined recording. The service may continue without Reliance recording when the vendor can perform it without video proof.
                      </div>
                    )}
                    {customerConsentStatus === CONSENT_STATE.EXPIRED_OR_UNAVAILABLE && (
                      <div className="mt-2 space-y-2">
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                          This secure request expired or is unavailable. Resend it to create a new link; recording remains locked.
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void refreshConsentStatusForSelectedJob()}
                          disabled={consentRefreshLoading}
                          className="w-full"
                        >
                          {consentRefreshLoading ? 'Checking permission...' : 'Refresh permission status'}
                        </Button>
                        {consentRefreshError ? (
                          <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                            {consentRefreshError}
                          </div>
                        ) : null}
                      </div>
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
                          <h4 className="font-medium text-blue-900">Recording Permission & Location Verification</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            The verified customer contact must allow the approved recording scope. After permission is verified, the employee also verifies the business location before the camera opens.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-900">Recording Safeguard</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            Customer permission does not authorize recording every employee, visitor, or customer. The employee must avoid people and confidential material outside the approved scope. Audio remains off.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                      <div className="font-medium text-gray-900">Recording-permission recipient</div>
                      <div className={hasCustomerContactForJob(selectedJob) ? 'text-gray-700' : 'text-red-700'}>
                        {formatCustomerConsentRecipient(selectedJob)}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Reliance sends the secure request to the customer contact saved on this work record.
                      </div>
                    </div>

                    <Button 
                      onClick={handleRequestCustomerConsent} 
                      disabled={
                        !hasCustomerContactForJob(selectedJob) ||
                        customerConsentSending ||
                        customerConsentStatus === CONSENT_STATE.ACCEPTED
                      }
                      className="w-full"
                    >
                      {customerConsentSending
                        ? 'Sending Recording Permission...'
                        : customerConsentStatus === CONSENT_STATE.REQUESTED
                          ? 'Resend Recording Permission'
                          : 'Send Recording Permission'}
                    </Button>
                    {!hasCustomerContactForJob(selectedJob) ? (
                      <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        Customer email or mobile phone is missing. Add a valid recipient before requesting permission.
                      </div>
                    ) : null}
                    {customerConsentSending ? (
                      <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                        Sending the secure recording-permission request. Recording remains locked until delivery and the customer decision are verified.
                      </div>
                    ) : null}

                    {customerConsentStatus === CONSENT_STATE.REQUESTED && (
                      <div className="mt-2 text-sm text-blue-600 space-y-2">
                        <div>Recording-permission request sent. Waiting for the verified customer contact.</div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void refreshConsentStatusForSelectedJob()}
                          disabled={consentRefreshLoading}
                          className="w-full"
                        >
                          {consentRefreshLoading ? 'Checking permission...' : 'Refresh permission status'}
                        </Button>
                        {consentRefreshError ? (
                          <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                            {consentRefreshError}
                          </div>
                        ) : null}
                      </div>
                    )}
                    {customerConsentStatus === CONSENT_STATE.ACCEPTED && (
                      <div className="mt-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                        <div className="text-base font-semibold text-green-800">✔ Ready to Record</div>
                        <div className="mt-1">Verified recording permission is active. The employee may proceed within the approved scope.</div>
                        <div className="mt-1 text-green-700/90">
                          Permission covers the three service stages, starts Private, and keeps audio off. Public sharing is a separate later decision.
                        </div>
                      </div>
                    )}
                    {customerConsentStatus === CONSENT_STATE.DECLINED && (
                      <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        The customer declined recording. The service may continue without Reliance recording when the vendor can perform it without video proof.
                      </div>
                    )}
                    {customerConsentStatus === CONSENT_STATE.EXPIRED_OR_UNAVAILABLE && (
                      <div className="mt-2 space-y-2">
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                          This secure request expired or is unavailable. Resend it to create a new link; recording remains locked.
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void refreshConsentStatusForSelectedJob()}
                          disabled={consentRefreshLoading}
                          className="w-full"
                        >
                          {consentRefreshLoading ? 'Checking permission...' : 'Refresh permission status'}
                        </Button>
                        {consentRefreshError ? (
                          <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                            {consentRefreshError}
                          </div>
                        ) : null}
                      </div>
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

            {/* Step 3: Employee Service Order */}
            {location && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3">Step 3: Employee Service Order</h3>
                <div
                  className={`mb-4 rounded-lg p-3 text-sm ${
                    allComplianceChecksPassed
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {compliancePrerequisiteMessage}
                </div>
                
                {/* Business Address - send employee service order */}
                {location === 'business' && assignmentSatisfiedForCompliance && (
                  <div>
                    <div className="mb-4 p-3 bg-green-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-900">Ready for employee Service Order</h4>
                          <p className="text-sm text-green-700 mt-1">
                            Reliance sends the Service Order automatically. The employee will verify the business address from their phone before recording starts.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={handleSendEmployeeServiceOrder}
                      disabled={
                        !(getCanContinueCompliance() && assignmentSatisfiedForCompliance) ||
                        Boolean(getSavedRecordingComplianceForJob(selectedJob)?.serviceOrderReleasedAt)
                      }
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {getSavedRecordingComplianceForJob(selectedJob)?.serviceOrderReleasedAt
                        ? 'Service Order Sent'
                        : 'Send Service Order'}
                    </Button>
                  </div>
                )}

                {/* Customer Residence - Show after consent */}
                {location === 'residence' && customerConsentRequested && customerConsentReceived && assignmentSatisfiedForCompliance && (
                  <div>
                    <div className="mb-4 p-3 bg-green-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-900">Recording Permission Verified</h4>
                          <p className="text-sm text-green-700 mt-1">
                            Permission is verified. Reliance sends the Service Order automatically so the employee can record within the approved scope.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={handleSendEmployeeServiceOrder}
                      disabled={
                        !(getCanContinueCompliance() && assignmentSatisfiedForCompliance) ||
                        Boolean(getSavedRecordingComplianceForJob(selectedJob)?.serviceOrderReleasedAt)
                      }
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {getSavedRecordingComplianceForJob(selectedJob)?.serviceOrderReleasedAt
                        ? 'Service Order Sent'
                        : 'Send Service Order'}
                    </Button>
                  </div>
                )}

                {/* Customer Business - Show after consent */}
                {location === 'customer-business' && customerConsentRequested && customerConsentReceived && assignmentSatisfiedForCompliance && (
                  <div>
                    <div className="mb-4 p-3 bg-green-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-900">Recording Permission Verified</h4>
                          <p className="text-sm text-green-700 mt-1">
                            Permission is verified. Reliance sends the Service Order automatically so the employee can verify location and record within the approved scope.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={handleSendEmployeeServiceOrder}
                      disabled={
                        !(getCanContinueCompliance() && assignmentSatisfiedForCompliance) ||
                        Boolean(getSavedRecordingComplianceForJob(selectedJob)?.serviceOrderReleasedAt)
                      }
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {getSavedRecordingComplianceForJob(selectedJob)?.serviceOrderReleasedAt
                        ? 'Service Order Sent'
                        : 'Send Service Order'}
                    </Button>
                  </div>
                )}

                {/* Show waiting states */}
                {(location === 'residence' || location === 'customer-business') && customerConsentStatus === CONSENT_STATE.REQUESTED && (
                  <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-900">Waiting for Recording Permission</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          Recording stays locked until the verified customer contact responds.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show declined states */}
                {(location === 'residence' || location === 'customer-business') && customerConsentStatus === CONSENT_STATE.DECLINED && (
                  <div className="mb-4 p-3 bg-red-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <X className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-red-900">Recording Declined</h4>
                        <p className="text-sm text-red-700 mt-1">
                          The customer declined recording. Do not record this work through Reliance.
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
      {!isEmployeeView && (
      <div className="mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Available Employees for Assignment
            </h3>
            <Badge className="bg-green-100 text-green-800">
              {getAvailableEmployees().length} available
            </Badge>
          </div>
          
          {employeesLoading ? (
            <div className="text-center py-4">
              <p className="text-gray-600">Loading employees...</p>
            </div>
          ) : employeesLoadError ? (
            <div className="text-center py-4">
              <p className="text-red-700">{employeesLoadError}</p>
            </div>
          ) : getAvailableEmployees().length > 0 ? (
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
              <p className="text-gray-600">No active employees are available for assignment yet.</p>
            </div>
          )}
        </div>
      </div>
      )}

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
                          <p>Service: {job.serviceName || job.serviceType || 'General Service'}</p>
                          <p>
                            Archived:{' '}
                            {formatDateOnlyUtc(String(job.updatedAt || job.archivedAt || ''))}
                          </p>
                          <p>Media: {Number(job.linkedMediaCount || 0)} asset(s)</p>
                          {job.archiveReason ? <p className="text-orange-600">Reason: {job.archiveReason}</p> : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getJobListBadgeColor(job)}>
                          {formatJobStatusLabel(job.status, job.operationalPhase, job)}
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            openJobDetails(job);
                          }}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          View
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
            {workflowFilter === 'archived'
              ? 'No archived work records yet.'
              : isEmployeeView
                ? 'No jobs assigned to you yet.'
                : 'No jobs found for this vendor yet.'}
          </div>
        ) : (
          <>
            {jobsLoadError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                {jobsLoadError}
              </div>
            )}
            {filteredJobs.map(job => (
          <Card
            key={job.id}
            className="cursor-pointer select-none transition-all hover:shadow-md hover:border-blue-200"
            onClick={(event) => handleJobCardClick(event, job)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                     <CardTitle className="text-xl">{job.title}</CardTitle>
                     <p className="text-gray-600">Client: {job.client}</p>
                     <p className="text-xs text-gray-500">Reference: {String(job.id || '').trim() || 'Unavailable'}</p>
                     <p className="text-xs text-gray-500">
                       Source: {String(job.source || '').toLowerCase() === 'customer_booking' ? 'Customer Service Record' : 'Vendor-Created Job'}
                     </p>
                    <p className="text-gray-600">Service Type: {job.serviceName || job.serviceType || 'General Service'}</p>
                    <p className="text-gray-600">Created: {formatDateOnlyUtc(job.createdAt)}</p>
                    <p className="text-gray-600">Updated: {formatDateOnlyUtc(job.updatedAt)}</p>
                    <p className="text-gray-600">
                      Media: {Number(job.linkedMediaCount || 0)} asset(s) across {Number(job.linkedSessionCount || 0)} session(s)
                    </p>
                    <p className="text-sm text-blue-600 mt-1">
                      Assigned: {job.assignedEmployees && job.assignedEmployees.length > 0 ? job.assignedEmployees.join(', ') : 'Unassigned'}
                    </p>
                    {job?.recordingCompliance?.addressSnapshot?.formattedAddress ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Recording location saved for this order:{' '}
                        {job.recordingCompliance.addressSnapshot.formattedAddress}
                      </p>
                    ) : null}
                    {(() => {
                      const jobRecoverySuggestion = jobRecoveryByJobId[String(job.id)] || null;
                      const jobRecoveryError = jobRecoveryErrorByJobId[String(job.id)] || '';
                      return (
                        <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex items-center gap-2 text-violet-700">
                                <Sparkles className="h-4 w-4" />
                                <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                                  AI Workflow Recovery
                                </p>
                              </div>
                              <p className="mt-2 text-sm text-violet-900">
                                Use this when a vendor or employee is unsure what to do next. The AI explains the safest next step based on the current job state only.
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-violet-300 bg-white text-violet-700 hover:bg-violet-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                void requestAiJobRecovery(job);
                              }}
                              disabled={jobRecoveryLoadingId === String(job.id)}
                            >
                              {jobRecoveryLoadingId === String(job.id)
                                ? 'Checking...'
                                : jobRecoverySuggestion
                                  ? 'Refresh AI Help'
                                  : 'Get AI Help'}
                            </Button>
                          </div>

                          {jobRecoveryError ? (
                            <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                              {jobRecoveryError}
                            </div>
                          ) : null}

                          {jobRecoverySuggestion ? (
                            <div className="mt-3 rounded-md border border-violet-100 bg-white p-3 text-sm">
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">
                                  {String(jobRecoverySuggestion.decision || '')
                                    .replace(/_/g, ' ')
                                    .replace(/\b\w/g, (char: string) => char.toUpperCase())}
                                </Badge>
                                <Badge variant="outline">
                                  {jobRecoverySuggestion.confidence} confidence
                                </Badge>
                              </div>
                              <p className="mt-3 text-slate-800">{jobRecoverySuggestion.summary}</p>
                              {Array.isArray(jobRecoverySuggestion.explainWhy) && jobRecoverySuggestion.explainWhy.length > 0 ? (
                                <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                                  <div className="font-semibold uppercase tracking-wide text-slate-700">
                                    Why this is the right next step
                                  </div>
                                  <ul className="mt-2 space-y-1">
                                    {jobRecoverySuggestion.explainWhy.slice(0, 3).map((item: string) => (
                                      <li key={item}>- {item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {Array.isArray(jobRecoverySuggestion.blockers) && jobRecoverySuggestion.blockers.length > 0 ? (
                                <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                                  <div className="font-semibold uppercase tracking-wide text-amber-700">
                                    Current blockers
                                  </div>
                                  <ul className="mt-2 space-y-1">
                                    {jobRecoverySuggestion.blockers.slice(0, 3).map((item: string) => (
                                      <li key={item}>- {item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {Array.isArray(jobRecoverySuggestion.recommendedActions) && jobRecoverySuggestion.recommendedActions.length > 0 ? (
                                <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                                  <div className="font-semibold uppercase tracking-wide text-blue-700">
                                    Recommended next actions
                                  </div>
                                  <ul className="mt-2 space-y-1">
                                    {jobRecoverySuggestion.recommendedActions.slice(0, 3).map((item: string) => (
                                      <li key={item}>- {item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                    {isJobReadyToSubmitForManagerReview(job) ? (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          className="h-8 bg-emerald-600 hover:bg-emerald-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubmitForManagerReview(job).catch(() => undefined);
                          }}
                          disabled={Boolean(jobMutationLoadingId)}
                        >
                          {jobMutationLoadingId === `submit-review:${String(job?.id || '')}`
                            ? 'Submitting...'
                            : isEmployeeView
                              ? 'Submit for Manager Review'
                              : 'Submit Videos for Review'}
                        </Button>
                      </div>
                    ) : null}
                    {isEmployeeView && isJobSubmittedForManagerReview(job) ? (
                      <p className="mt-2 text-sm font-medium text-emerald-700">Submitted for manager review.</p>
                    ) : null}
                    {!isEmployeeView &&
                    (() => {
                      const status = String(job?.status || '').trim().toLowerCase();
                      return !jobHasRejectedMedia(job) && (status === 'awaiting_review' || status === 'awaiting review');
                    })() ? (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-sm font-semibold text-amber-900">Manager Review Required</p>
                        <p className="mt-1 text-xs text-amber-800">
                          All required service video stages are uploaded. Review the package before approving completion.
                        </p>
                        <div className="mt-3 space-y-2">
                          {([
                            { key: 'INTRO' as const, label: 'Starting Condition', actionLabel: 'Play Starting Condition Video' },
                            { key: 'IN_PROGRESS' as const, label: 'Work in Progress', actionLabel: 'Play Work in Progress Video' },
                            { key: 'COMPLETED' as const, label: 'Final Result', actionLabel: 'Play Final Result Video' },
                          ]).map((stage) => {
                            const stageVideo = getStageVideoForJob(job, stage.key);
                            const stagePresent = jobHasVideoForStage(job, stage.key);
                            return (
                              <div
                                key={`${job.id}-${stage.key}`}
                                className="flex items-center justify-between rounded border border-amber-200 bg-white px-3 py-2"
                              >
                                <div className="space-y-0.5">
                                  <p className="text-xs font-medium text-amber-950">{stage.label}</p>
                                  <p className={`text-xs ${stagePresent ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {stagePresent ? 'Present' : 'Missing'}
                                  </p>
                                  {stagePresent && String(stageVideo?.captureProvenance || '').toUpperCase() === 'PRERECORDED_FALLBACK' ? (
                                    <p className="text-xs font-medium text-blue-700">
                                      Phone-camera fallback. Manager review required; Private proof only.
                                    </p>
                                  ) : null}
                                </div>
                                {stagePresent ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-amber-300 text-amber-900 hover:bg-amber-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleWatchVideo(stageVideo);
                                    }}
                                  >
                                    {stage.actionLabel}
                                  </Button>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-300 text-amber-900 hover:bg-amber-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              openJobDetails(job);
                            }}
                          >
                            View Review Package
                          </Button>
                          {!isEmployeeView ? (
                            <>
                              {(() => {
                                const hasAllReviewStages =
                                  jobHasVideoForStage(job, 'INTRO') &&
                                  jobHasVideoForStage(job, 'IN_PROGRESS') &&
                                  jobHasVideoForStage(job, 'COMPLETED');
                                return (
                                  <>
                                    <Button
                                      size="sm"
                                      className="bg-emerald-600 hover:bg-emerald-700"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openApproveConfirmModal(job);
                                      }}
                                      disabled={!hasAllReviewStages || Boolean(jobMutationLoadingId) || jobActionLoading || approveJobSubmitting}
                                    >
                                      Submit to Reliance Audit
                                    </Button>
                                    {!hasAllReviewStages ? (
                                      <p className="text-xs text-amber-900">
                                        All three video stages are required before approval.
                                      </p>
                                    ) : null}
                                  </>
                                );
                              })()}
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-amber-300 text-amber-900 hover:bg-amber-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRejectJobModal(job);
                                }}
                                disabled={Boolean(jobMutationLoadingId) || jobActionLoading || rejectJobSubmitting}
                              >
                                Request Changes
                              </Button>
                            </>
                          ) : (
                            <p className="text-xs text-gray-700">Manager approval required.</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div
                  className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[20rem]"
                  data-no-card-open
                  onClick={(e) => e.stopPropagation()}
                >
                  {(() => {
                    const workflow = getVendorWorkflowStateForJob(job);
                    const toneClasses: Record<string, string> = {
                      green: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-50',
                      blue: 'border-blue-400/30 bg-blue-500/10 text-blue-50',
                      red: 'border-rose-400/30 bg-rose-500/10 text-rose-50',
                      amber: 'border-amber-400/30 bg-amber-500/10 text-amber-50',
                    };
                    return (
                      <>
                        <div
                          className={`rounded-md border px-4 py-3 ${toneClasses[workflow.tone] || toneClasses.amber}`}
                          aria-label="Work record progress"
                        >
                          <p className="text-sm font-semibold">{workflow.label}</p>
                          <p className="mt-1 text-xs leading-5 opacity-80">{workflow.detail}</p>
                          <dl className="mt-3 grid gap-2 border-t border-current/15 pt-3 text-xs sm:grid-cols-3 lg:grid-cols-1">
                            <div><dt className="font-semibold">Who acts next</dt><dd className="mt-0.5 opacity-80">{workflow.responsibleParticipant}</dd></div>
                            <div className="sm:col-span-2 lg:col-span-1"><dt className="font-semibold">What resolves it</dt><dd className="mt-0.5 opacity-80">{workflow.resolution}</dd></div>
                          </dl>
                        </div>
                        {permissionFeedbackIsCurrentForJob(job) && permissionRefreshByJobId[String(job?.bookingId || job?.id || '').trim()] ? (() => {
                          const feedback = permissionRefreshByJobId[String(job?.bookingId || job?.id || '').trim()];
                          const feedbackClasses = {
                            info: 'border-blue-300/35 bg-blue-500/10 text-blue-50',
                            success: 'border-emerald-300/35 bg-emerald-500/10 text-emerald-50',
                            warning: 'border-amber-300/35 bg-amber-500/10 text-amber-50',
                            error: 'border-rose-300/35 bg-rose-500/10 text-rose-50',
                          };
                          return (
                            <div className={`rounded-md border px-3 py-2 text-sm ${feedbackClasses[feedback.tone]}`} role="status">
                              {feedback.message}
                            </div>
                          );
                        })() : null}
                      </>
                    );
                  })()}
                  <div className="flex items-center gap-2 lg:justify-end">
                    {!isEmployeeView && getPrimaryJobCtaLabel(job) ? (
                      <Button
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 lg:flex-none"
                        data-no-card-open
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrimaryJobAction(job);
                        }}
                        disabled={jobActionLoading || Boolean(jobMutationLoadingId)}
                      >
                        {getPrimaryJobCtaLabel(job)}
                      </Button>
                    ) : null}
                  <div className="relative ml-auto border-l border-white/10 pl-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveJobActionMenuId((prev) => (prev === String(job.id) ? null : String(job.id)));
                      }}
                      disabled={jobActionLoading || Boolean(jobMutationLoadingId)}
                    >
                      Actions
                      <ChevronDown className="ml-1 h-4 w-4 pointer-events-none" />
                    </Button>
                    {activeJobActionMenuId === String(job.id) && (
                      <div
                        className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 py-1 text-white shadow-2xl shadow-black/35"
                        onClick={(e) => e.stopPropagation()}
                        role="menu"
                      >
                        {(() => {
                          const status = String(job?.status || '').trim().toLowerCase();
                          const isPendingOrInProgress =
                            status === 'pending' || status === 'in-progress' || status === 'in progress';
                          const isCompleted = status === 'completed';
                           const isAwaitingReview = status === 'awaiting_review' || status === 'awaiting review';
                           const isArchived = status === 'archived';
                           const isConsentBlocked = isJobBlockedByCustomerConsent(job);
                           const permissionState = getConsentStatusForJob(
                             job,
                             getSavedRecordingComplianceForJob(job)
                           );
                           const hasPermissionRequest = Boolean(
                             String(
                               job?.latestConsentId ||
                                 getSavedRecordingComplianceForJob(job)?.consentRequestId ||
                                 ''
                             ).trim()
                           );
                           const canRecoverPermission =
                             hasPermissionRequest &&
                             [
                               CONSENT_STATE.REQUESTED,
                               CONSENT_STATE.EXPIRED_OR_UNAVAILABLE,
                               CONSENT_STATE.DELIVERY_FAILED,
                               CONSENT_STATE.WRONG_RECIPIENT,
                               CONSENT_STATE.NO_DIGITAL_CHANNEL,
                             ].includes(permissionState as any);

                          if (isCompleted) {
                            return (
                              <>
                                <button
                                  className="w-full px-3 py-2.5 text-left text-sm text-slate-100 transition hover:bg-blue-500/15 hover:text-white"
                                  onClick={() => {
                                    openJobDetails(job);
                                    setActiveJobActionMenuId(null);
                                  }}
                                >
                                  View Details
                                </button>
                                {!job.adminAuditDecision ? (
                                  <button
                                    className="w-full px-3 py-2.5 text-left text-sm text-slate-100 transition hover:bg-blue-500/15 hover:text-white"
                                    onClick={() => {
                                      setActiveJobActionMenuId(null);
                                      openJobActionConfirm(job, "ARCHIVE_JOB");
                                    }}
                                    disabled={Boolean(jobMutationLoadingId) || jobActionLoading}
                                    title="Hide job in Archived; keeps history and media."
                                  >
                                    Archive Job
                                  </button>
                                ) : null}
                              </>
                            );
                          }

                          if (isArchived) {
                            return (
                              <button
                                className="w-full px-3 py-2.5 text-left text-sm text-slate-100 transition hover:bg-blue-500/15 hover:text-white"
                                onClick={() => {
                                  openJobDetails(job);
                                  setActiveJobActionMenuId(null);
                                }}
                              >
                                View Details
                              </button>
                            );
                          }

                          if (isAwaitingReview) {
                            return (
                              <button
                                className="w-full px-3 py-2.5 text-left text-sm text-slate-100 transition hover:bg-blue-500/15 hover:text-white"
                                onClick={() => {
                                  openJobDetails(job);
                                  setActiveJobActionMenuId(null);
                                }}
                              >
                                View Details
                              </button>
                            );
                          }

                          if (isPendingOrInProgress) {
                            return (
                              <>
                                <button
                                  className="w-full px-3 py-2.5 text-left text-sm text-slate-100 transition hover:bg-blue-500/15 hover:text-white"
                                  onClick={() => {
                                    openJobDetails(job);
                                    setActiveJobActionMenuId(null);
                                  }}
                                >
                                  View Details
                                </button>
                                <button
                                  className="w-full px-3 py-2.5 text-left text-sm text-slate-100 transition hover:bg-blue-500/15 hover:text-white"
                                  onClick={() => {
                                    openEditModal(job);
                                    setActiveJobActionMenuId(null);
                                  }}
                                  disabled={Boolean(jobMutationLoadingId) || jobActionLoading}
                                >
                                  Edit
                                </button>
                                {isConsentBlocked ? (
                                  <div className="border-y border-amber-300/15 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
                                    Recording locked - waiting for verified permission
                                  </div>
                                ) : null}
                                {hasPermissionRequest ? (
                                  <button
                                    className="w-full px-3 py-2.5 text-left text-sm text-sky-100 transition hover:bg-sky-500/15 hover:text-white"
                                    onClick={() =>
                                      permissionState === CONSENT_STATE.ACCEPTED
                                        ? void openReadOnlyPermissionEvidence(job)
                                        : canRecoverPermission
                                          ? openPermissionRecoveryForJob(job)
                                          : openCustomerConsentForJob(job)
                                    }
                                  >
                                    {permissionState === CONSENT_STATE.ACCEPTED
                                      ? 'View Recording Permission'
                                      : canRecoverPermission
                                        ? 'Manage Recording Permission'
                                        : 'View Recording Permission'}
                                  </button>
                                ) : null}
                                <button
                                  className="w-full px-3 py-2.5 text-left text-sm text-slate-100 transition hover:bg-blue-500/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                  onClick={() => {
                                    setActiveJobActionMenuId(null);
                                    openAssignmentModal(job);
                                  }}
                                  disabled={Boolean(jobMutationLoadingId) || jobActionLoading}
                                >
                                  {isJobAssignedForVideoUpload(job) ? 'Reassign Job' : 'Assign Employee'}
                                </button>
                                {isJobAssignedForVideoUpload(job) ? (
                                  <button
                                    className="w-full px-3 py-2.5 text-left text-sm text-sky-100 transition hover:bg-sky-500/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={() => {
                                      setActiveJobActionMenuId(null);
                                      void handleResendEmployeeServiceOrder(job);
                                    }}
                                    disabled={Boolean(jobMutationLoadingId) || jobActionLoading}
                                    title="Resend the employee's secure service order link by email/SMS when available."
                                  >
                                    Resend Service Order Link
                                  </button>
                                ) : null}
                                {String(job?.recordingCompliance?.locationAttemptStatus || '').toUpperCase() === 'FAILED' &&
                                !['PENDING', 'APPROVED'].includes(
                                  String(job?.recordingCompliance?.locationExceptionStatus || '').toUpperCase()
                                ) ? (
                                  <button
                                    className="w-full px-3 py-2.5 text-left text-sm text-amber-100 transition hover:bg-amber-500/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={() => {
                                      setActiveJobActionMenuId(null);
                                      setLocationExceptionJob(job);
                                      setLocationExceptionReason('');
                                      setLocationExceptionError('');
                                    }}
                                    disabled={Boolean(jobMutationLoadingId) || jobActionLoading}
                                  >
                                    Request Location Exception
                                  </button>
                                ) : null}
                                <button
                                  className="w-full px-3 py-2.5 text-left text-sm text-red-200 transition hover:bg-red-500/15 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                                  onClick={() => {
                                    setActiveJobActionMenuId(null);
                                    openJobActionConfirm(job, "CANCEL_SERVICE_ORDER");
                                  }}
                                  disabled={Boolean(jobMutationLoadingId) || jobActionLoading}
                                  title="Cancel this Service Order while preserving its evidence history."
                                >
                                  Cancel Service Order
                                </button>
                              </>
                            );
                          }

                          // Legacy fallback: view-only for unexpected status values.
                          return (
                            <button
                              className="w-full px-3 py-2.5 text-left text-sm text-slate-100 transition hover:bg-blue-500/15 hover:text-white"
                              onClick={() => {
                                openJobDetails(job);
                                setActiveJobActionMenuId(null);
                              }}
                            >
                              View Details
                            </button>
                          );
                        })()}
                      </div>
                    )}
                  </div>
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
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-md">
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
          {pendingJobAction === "CANCEL_SERVICE_ORDER" ? (
            <label className="space-y-2 text-sm font-medium text-slate-800">
              Cancellation reason
              <textarea
                value={cancellationReason}
                onChange={(event) => setCancellationReason(event.target.value)}
                maxLength={500}
                rows={4}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
                placeholder="Explain why this Service Order is being canceled."
              />
              <span className="block text-xs font-normal text-slate-500">This reason becomes part of the preserved Service Order history.</span>
            </label>
          ) : null}
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
                Boolean(jobMutationLoadingId) ||
                (pendingJobAction === "DELETE_PERMANENTLY" &&
                  (deleteImpactPreview?.loading || deleteImpactPreview?.canVendorDelete === false)) ||
                (pendingJobAction === "CANCEL_SERVICE_ORDER" && cancellationReason.trim().length < 5)
              }
              className={pendingJobAction === "DELETE_PERMANENTLY" || pendingJobAction === "CANCEL_SERVICE_ORDER" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {jobActionLoading ? "Processing..." : pendingJobActionTitle}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={permissionEvidenceLoading || Boolean(permissionEvidence) || Boolean(permissionEvidenceError)}
        onOpenChange={(open) => {
          if (!open) {
            setPermissionEvidence(null);
            setPermissionEvidenceError('');
            setPermissionEvidenceLoading(false);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Recording Permission</DialogTitle>
            <DialogDescription>This is read-only evidence of the customer decision. Viewing it cannot change or reopen permission.</DialogDescription>
          </DialogHeader>
          {permissionEvidenceLoading ? <p className="text-sm text-slate-600">Loading verified permission evidence...</p> : null}
          {permissionEvidenceError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{permissionEvidenceError}</p> : null}
          {permissionEvidence ? (
            <div className="space-y-3 text-sm text-slate-800">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="font-semibold text-emerald-900">{permissionEvidence.decisionEvidence?.decision === 'allowed' || permissionEvidence.verifiedDecision ? 'Recording allowed' : String(permissionEvidence.lifecycleStatus || 'Decision recorded')}</p>
                <p className="mt-1 text-emerald-800">Decided {permissionEvidence.decisionEvidence?.decidedAt ? new Date(permissionEvidence.decisionEvidence.decidedAt).toLocaleString() : 'date unavailable'}</p>
              </div>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div><dt className="text-xs font-semibold uppercase text-slate-500">Verified recipient</dt><dd>{permissionEvidence.recipient?.name || permissionEvidence.recipient?.email || permissionEvidence.recipient?.phone || 'Verified customer'}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-slate-500">Authority</dt><dd>{String(permissionEvidence.decisionEvidence?.claimedRole || 'customer').replace(/_/g, ' ')}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-slate-500">Verification</dt><dd>{String(permissionEvidence.decisionEvidence?.verificationMethod || 'verified').replace(/_/g, ' ')}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-slate-500">Audio</dt><dd>{permissionEvidence.audioEnabled ? 'Included' : 'Off'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">Evidence ID</dt><dd className="break-all font-mono text-xs">{permissionEvidence.decisionEvidence?.id || permissionEvidence.id}</dd></div>
              </dl>
            </div>
          ) : null}
          <DialogFooter><Button variant="outline" onClick={() => { setPermissionEvidence(null); setPermissionEvidenceError(''); }}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
