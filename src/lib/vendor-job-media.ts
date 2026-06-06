import type { VendorJobVideoStage } from '@/lib/vendor-job-video-stages';
import { getVendorMediaApiUserMessage } from '@/lib/media-upload-user-messages';

export type VendorJobMediaLifecycleState =
  | 'idle'
  | 'creating_session'
  | 'uploading'
  | 'completing'
  | 'completed'
  | 'failed';

type RequestResult = {
  ok: boolean;
  status: number;
  statusText: string;
  rawText: string;
  parsed: any;
};

type UploadParams = {
  vendorId: string;
  selectedJob: any;
  title: string;
  description: string;
  file: File;
  getHeaders: () => Record<string, string>;
  onLifecycleState: (state: VendorJobMediaLifecycleState) => void;
  /** Required for vendor job service videos (Intro / In Progress / Completed). */
  videoStage: VendorJobVideoStage;
  /** When true, an existing session+assets for the same stage are archived before creating the new session. */
  replaceExisting?: boolean;
  durationSeconds: number;
  locationContext?: string;
  consentAccepted?: boolean;
  consentToken?: string;
};

type UploadOutcome = {
  mediaSessionId: string;
  asset: any;
  video: {
    id: string;
    title: string;
    description: string;
    url: string;
    uploadedAt: string;
    status: string;
    mediaSessionId: string;
    vendorJobVideoStage: VendorJobVideoStage;
  };
};

export type VendorJobMediaUploadDiagnostics = {
  stage: VendorJobMediaLifecycleState | 'session_create' | 'upload_init' | 'blob_put' | 'upload_complete' | 'session_complete';
  vendorId: string;
  bookingId: string | null;
  jobId: string | null;
  mediaSessionId: string | null;
  videoStage: VendorJobVideoStage;
  sessionCreateResponse?: RequestResult;
  uploadInitResponse?: RequestResult;
  blobUploadResponse?: RequestResult;
  uploadCompleteResponse?: RequestResult;
  failedRequest?: {
    step: string;
    method: string;
    urlType: string;
    payloadSummary?: Record<string, unknown>;
    errorName?: string;
    errorMessage?: string;
    hint?: string;
  };
  sasInfo?: {
    host: string;
    path: string;
    hasSig: boolean;
    permissions: string;
    resource: string;
    expiresAt: string;
    isLikelyFresh: boolean;
  };
};

export class VendorJobMediaUploadError extends Error {
  diagnostics: VendorJobMediaUploadDiagnostics;
  constructor(message: string, diagnostics: VendorJobMediaUploadDiagnostics) {
    super(message);
    this.name = 'VendorJobMediaUploadError';
    this.diagnostics = diagnostics;
  }
}

const parseResponsePayload = (rawText: string) => {
  if (!rawText || !rawText.trim()) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
};

const requestJson = async (url: string, init: RequestInit): Promise<RequestResult> => {
  const res = await fetch(url, init);
  const rawText = await res.text().catch(() => '');
  const parsed = parseResponsePayload(rawText);
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    rawText,
    parsed,
  };
};

const responseErrorMessage = (res: RequestResult) =>
  getVendorMediaApiUserMessage(res.parsed, res.status) ||
  res.rawText?.trim() ||
  res.statusText ||
  'Request failed';

const summarizeUrlType = (url: string): string => {
  try {
    if (url.startsWith('/')) return `relative:${url.split('?')[0]}`;
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('blob.core.windows.net')) {
      return `azure_blob:${parsed.origin}${parsed.pathname}`;
    }
    return `absolute:${parsed.origin}${parsed.pathname}`;
  } catch {
    return `raw:${String(url || '').split('?')[0]}`;
  }
};

const parseSasInfo = (uploadUrl: string) => {
  try {
    const parsed = new URL(uploadUrl);
    const params = parsed.searchParams;
    const permissions = String(params.get('sp') || '');
    const resource = String(params.get('sr') || '');
    const expiresAt = String(params.get('se') || '');
    const hasSig = Boolean(params.get('sig'));
    const isLikelyFresh =
      !!expiresAt && !Number.isNaN(Date.parse(expiresAt)) && Date.parse(expiresAt) > Date.now();
    return {
      host: parsed.hostname,
      path: parsed.pathname,
      hasSig,
      permissions,
      resource,
      expiresAt,
      isLikelyFresh,
    };
  } catch {
    return null;
  }
};

const isReusableSessionStatus = (status: unknown): boolean => {
  const upper = String(status || '').trim().toUpperCase();
  return upper !== 'FAILED' && upper !== 'CANCELLED' && upper !== 'ARCHIVED';
};

const findExistingStageSession = async ({
  vendorId,
  bookingId,
  stage,
  getHeaders,
}: {
  vendorId: string;
  bookingId: string;
  stage: VendorJobVideoStage;
  getHeaders: () => Record<string, string>;
}): Promise<string | null> => {
  if (!bookingId) return null;
  const sessionsRes = await requestJson(
    `/api/vendors/${vendorId}/media/sessions?bookingId=${encodeURIComponent(bookingId)}`,
    { method: 'GET', headers: getHeaders() }
  );
  if (!sessionsRes.ok) return null;
  const sessions = Array.isArray(sessionsRes.parsed?.sessions) ? sessionsRes.parsed.sessions : [];
  const existing = sessions.find((s: any) => {
    const sStage = String(s?.vendorJobVideoStage || '').trim().toUpperCase();
    return sStage === String(stage).toUpperCase() && isReusableSessionStatus(s?.status);
  });
  return existing?.id ? String(existing.id) : null;
};

export async function runVendorJobMediaUpload({
  vendorId,
  selectedJob,
  title,
  description,
  file,
  getHeaders,
  onLifecycleState,
  videoStage,
  replaceExisting,
  durationSeconds,
  locationContext,
  consentAccepted,
  consentToken,
}: UploadParams): Promise<UploadOutcome> {
  let mediaSessionId: string | null = null;
  const selectedJobBookingId = selectedJob?.bookingId
    ? String(selectedJob.bookingId)
    : String(selectedJob?.id || '');
  const diagnostics: VendorJobMediaUploadDiagnostics = {
    stage: 'idle',
    vendorId: String(vendorId),
    bookingId: selectedJobBookingId || null,
    jobId: selectedJob?.id ? String(selectedJob.id) : null,
    mediaSessionId: null,
    videoStage,
  };
  const requestWithDiagnostics = async (
    step: VendorJobMediaUploadDiagnostics['stage'],
    url: string,
    init: RequestInit,
    payloadSummary?: Record<string, unknown>
  ): Promise<RequestResult> => {
    diagnostics.stage = step;
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.info('[runVendorJobMediaUpload] trace:request', {
        step,
        method: String(init.method || 'GET').toUpperCase(),
        urlType: summarizeUrlType(url),
        payloadSummary: payloadSummary || null,
      });
    }
    try {
      return await requestJson(url, init);
    } catch (error: any) {
      diagnostics.failedRequest = {
        step: String(step),
        method: String(init.method || 'GET').toUpperCase(),
        urlType: summarizeUrlType(url),
        payloadSummary,
        errorName: String(error?.name || ''),
        errorMessage: String(error?.message || error),
        hint:
          String(step) === 'blob_put'
            ? 'Azure upload failed. Check Blob Storage CORS or SAS URL.'
            : 'Network/CORS/SAS URL issue before HTTP response',
      };
      if (String(step) === 'blob_put') {
        throw new VendorJobMediaUploadError(
          'Azure upload failed. Check Blob Storage CORS or SAS URL.',
          diagnostics
        );
      }
      throw new VendorJobMediaUploadError(
        `Network request failed during ${step}: ${String(error?.message || error)}`,
        diagnostics
      );
    }
  };

  try {
    onLifecycleState('creating_session');
    diagnostics.stage = 'session_create';
    const selectedJobServiceId = selectedJob?.serviceId ? String(selectedJob.serviceId) : undefined;
    const selectedJobDeviceId = selectedJob?.deviceId ? String(selectedJob.deviceId) : undefined;
    const selectedJobDeviceType = selectedJob?.deviceType ? String(selectedJob.deviceType) : undefined;
    const sessionPayload = {
      bookingId: selectedJobBookingId || undefined,
      serviceId: selectedJobServiceId,
      vendorId: String(vendorId),
      deviceId: selectedJobDeviceId,
      deviceType: selectedJobDeviceType,
      sessionType: 'JOB_SERVICE_VIDEO',
      vendorJobVideoStage: videoStage,
      replaceExisting: Boolean(replaceExisting),
      locationContext: locationContext || undefined,
      consentAccepted: Boolean(consentAccepted),
      consentToken: consentToken || undefined,
      title,
      description,
    };

    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      const hdrs = getHeaders();
      console.info('[runVendorJobMediaUpload] trace:session_create_request', {
        vendorId: String(vendorId),
        jobId: selectedJob?.id ?? null,
        bookingId: sessionPayload.bookingId ?? null,
        serviceId: sessionPayload.serviceId ?? null,
        vendorJobVideoStage: sessionPayload.vendorJobVideoStage,
        sessionType: sessionPayload.sessionType,
        replaceExisting: sessionPayload.replaceExisting,
        title,
        descriptionLength: description.length,
        fileName: file?.name ?? null,
        fileSize: file?.size ?? null,
        headerKeys: Object.keys(hdrs || {}),
      });
    }

    if (!replaceExisting && selectedJobBookingId) {
      const existingSessionId = await findExistingStageSession({
        vendorId: String(vendorId),
        bookingId: selectedJobBookingId,
        stage: videoStage,
        getHeaders,
      });
      if (existingSessionId) {
        mediaSessionId = existingSessionId;
        diagnostics.mediaSessionId = existingSessionId;
      }
    }

    if (!mediaSessionId) {
      const sessionRes = await requestWithDiagnostics(
        'session_create',
        `/api/vendors/${vendorId}/media/sessions`,
        {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(sessionPayload),
        },
        {
          bookingId: selectedJobBookingId || null,
          vendorId: String(vendorId),
          stage: videoStage,
          replaceExisting: Boolean(replaceExisting),
        }
      );
      diagnostics.sessionCreateResponse = sessionRes;
      if (!sessionRes.ok) {
        const conflictSessionId =
          sessionRes.status === 409
            ? String(sessionRes.parsed?.existingSessionId || '').trim()
            : '';
        if (!replaceExisting && conflictSessionId) {
          mediaSessionId = conflictSessionId;
          diagnostics.mediaSessionId = conflictSessionId;
        } else if (!replaceExisting && selectedJobBookingId) {
          const fallbackExistingSessionId = await findExistingStageSession({
            vendorId: String(vendorId),
            bookingId: selectedJobBookingId,
            stage: videoStage,
            getHeaders,
          });
          if (fallbackExistingSessionId) {
            mediaSessionId = fallbackExistingSessionId;
            diagnostics.mediaSessionId = fallbackExistingSessionId;
          } else {
            const apiMsg = responseErrorMessage(sessionRes);
            throw new VendorJobMediaUploadError(apiMsg, diagnostics);
          }
        } else {
          const apiMsg = responseErrorMessage(sessionRes);
          if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
            console.error('[runVendorJobMediaUpload] session create failed', {
              status: sessionRes.status,
              code: sessionRes.parsed?.code,
              parsed: sessionRes.parsed,
            });
          }
          throw new VendorJobMediaUploadError(apiMsg, diagnostics);
        }
      } else {
        mediaSessionId = sessionRes.parsed?.session?.id || null;
      }
    }

    diagnostics.mediaSessionId = mediaSessionId;
    if (!mediaSessionId) {
      throw new VendorJobMediaUploadError('Media session created without ID', diagnostics);
    }

    onLifecycleState('uploading');
    const patchUploadingRes = await requestWithDiagnostics(
      'uploading',
      `/api/vendors/${vendorId}/media/sessions/${mediaSessionId}`,
      {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: 'UPLOADING' }),
      },
      { mediaSessionId, status: 'UPLOADING' }
    );
    if (!patchUploadingRes.ok) {
      throw new VendorJobMediaUploadError(responseErrorMessage(patchUploadingRes), diagnostics);
    }

    diagnostics.stage = 'upload_init';
    const initRes = await requestWithDiagnostics(
      'upload_init',
      `/api/vendors/${vendorId}/media/upload/init`,
      {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        fileName: file.name,
        expectedBytes: file.size,
        fileSize: file.size,
        mimeType: file.type,
      }),
      },
      {
        fileName: file.name,
        expectedBytes: file.size,
        mimeType: file.type,
      }
    );
    diagnostics.uploadInitResponse = initRes;
    if (!initRes.ok) {
      throw new VendorJobMediaUploadError(responseErrorMessage(initRes), diagnostics);
    }

    const initJson = initRes.parsed || {};
    const uploadUrl = initJson.sasUrl || initJson.uploadUrl;
    const sasInfo = uploadUrl ? parseSasInfo(String(uploadUrl)) : null;
    diagnostics.sasInfo = sasInfo || undefined;
    if (!initJson.assetId || !initJson.blobKey) {
      throw new VendorJobMediaUploadError('Upload init response is missing required fields', diagnostics);
    }

    let isRealAzureBlobHost = false;
    if (uploadUrl) {
      try {
        const hostname = new URL(uploadUrl).hostname;
        isRealAzureBlobHost = hostname.endsWith('.blob.core.windows.net');
      } catch {
        isRealAzureBlobHost = false;
      }
    }
    const shouldSkipBlobPut = !uploadUrl || !isRealAzureBlobHost;
    if (!shouldSkipBlobPut) {
      if (!sasInfo || !sasInfo.hasSig || !sasInfo.permissions.includes('w') || sasInfo.resource !== 'b') {
        throw new VendorJobMediaUploadError(
          'Azure upload URL is invalid or missing required SAS permissions.',
          diagnostics
        );
      }
      diagnostics.stage = 'blob_put';
      const blobRes = await requestWithDiagnostics(
        'blob_put',
        String(uploadUrl),
        {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'x-ms-blob-type': 'BlockBlob',
        },
        body: file,
        },
        {
          mimeType: file.type,
          bytes: file.size,
          hasSasQuery: String(uploadUrl).includes('?'),
          sasHost: sasInfo.host,
          sasPath: sasInfo.path,
          sasPermissions: sasInfo.permissions,
          sasResource: sasInfo.resource,
          sasExpiresAt: sasInfo.expiresAt,
        }
      );
      diagnostics.blobUploadResponse = blobRes;
      if (!blobRes.ok) {
        throw new VendorJobMediaUploadError(responseErrorMessage(blobRes), diagnostics);
      }
    }

    onLifecycleState('completing');
    diagnostics.stage = 'upload_complete';
    const completeRes = await requestWithDiagnostics(
      'upload_complete',
      `/api/vendors/${vendorId}/media/upload/complete`,
      {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        assetId: initJson.assetId,
        blobKey: initJson.blobKey,
        blobUrl: null,
        bytes: file.size,
        mimeType: file.type,
        mediaSessionId,
        durationSeconds,
      }),
      },
      {
        assetId: initJson.assetId,
        blobKey: initJson.blobKey,
        mediaSessionId,
      }
    );
    diagnostics.uploadCompleteResponse = completeRes;
    if (!completeRes.ok) {
      throw new VendorJobMediaUploadError(responseErrorMessage(completeRes), diagnostics);
    }

    diagnostics.stage = 'session_complete';
    const patchCompletedRes = await requestWithDiagnostics(
      'session_complete',
      `/api/vendors/${vendorId}/media/sessions/${mediaSessionId}`,
      {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          status: 'COMPLETED',
          endedAt: new Date().toISOString(),
        }),
      },
      { mediaSessionId, status: 'COMPLETED' }
    );
    if (!patchCompletedRes.ok) {
      throw new VendorJobMediaUploadError(responseErrorMessage(patchCompletedRes), diagnostics);
    }

    onLifecycleState('completed');
    const asset = completeRes.parsed?.asset || null;
    return {
      mediaSessionId,
      asset,
      video: {
        id: String(asset?.id || Date.now()),
        title,
        description,
        url: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString().split('T')[0],
        status: 'uploaded',
        mediaSessionId,
        vendorJobVideoStage: videoStage,
      },
    };
  } catch (error) {
    onLifecycleState('failed');
    if (mediaSessionId) {
      fetch(`/api/vendors/${vendorId}/media/sessions/${mediaSessionId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          status: 'FAILED',
          endedAt: new Date().toISOString(),
        }),
      }).catch(() => {});
    }
    if (error instanceof VendorJobMediaUploadError) throw error;
    throw new VendorJobMediaUploadError(
      error instanceof Error ? error.message : String(error),
      diagnostics
    );
  }
}
