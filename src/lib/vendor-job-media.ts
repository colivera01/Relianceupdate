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
  locationContext,
  consentAccepted,
  consentToken,
}: UploadParams): Promise<UploadOutcome> {
  let mediaSessionId: string | null = null;

  try {
    onLifecycleState('creating_session');
    const selectedJobBookingId = selectedJob?.bookingId
      ? String(selectedJob.bookingId)
      : String(selectedJob?.id || '');
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

    const sessionRes = await requestJson(`/api/vendors/${vendorId}/media/sessions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(sessionPayload),
    });
    if (!sessionRes.ok) {
      const apiMsg = responseErrorMessage(sessionRes);
      if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
        console.error('[runVendorJobMediaUpload] session create failed', {
          status: sessionRes.status,
          code: sessionRes.parsed?.code,
          parsed: sessionRes.parsed,
        });
      }
      throw new Error(apiMsg);
    }

    mediaSessionId = sessionRes.parsed?.session?.id || null;
    if (!mediaSessionId) {
      throw new Error('Media session created without ID');
    }

    onLifecycleState('uploading');
    const patchUploadingRes = await requestJson(
      `/api/vendors/${vendorId}/media/sessions/${mediaSessionId}`,
      {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: 'UPLOADING' }),
      }
    );
    if (!patchUploadingRes.ok) {
      throw new Error(responseErrorMessage(patchUploadingRes));
    }

    const initRes = await requestJson(`/api/vendors/${vendorId}/media/upload/init`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        fileName: file.name,
        expectedBytes: file.size,
        fileSize: file.size,
        mimeType: file.type,
      }),
    });
    if (!initRes.ok) {
      throw new Error(responseErrorMessage(initRes));
    }

    const initJson = initRes.parsed || {};
    const uploadUrl = initJson.sasUrl || initJson.uploadUrl;
    if (!initJson.assetId || !initJson.blobKey) {
      throw new Error('Upload init response is missing required fields');
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
      const blobRes = await requestJson(String(uploadUrl), {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'x-ms-blob-type': 'BlockBlob',
        },
        body: file,
      });
      if (!blobRes.ok) {
        throw new Error(responseErrorMessage(blobRes));
      }
    }

    onLifecycleState('completing');
    const completeRes = await requestJson(`/api/vendors/${vendorId}/media/upload/complete`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        assetId: initJson.assetId,
        blobKey: initJson.blobKey,
        blobUrl: null,
        bytes: file.size,
        mimeType: file.type,
        mediaSessionId,
      }),
    });
    if (!completeRes.ok) {
      throw new Error(responseErrorMessage(completeRes));
    }

    const patchCompletedRes = await requestJson(
      `/api/vendors/${vendorId}/media/sessions/${mediaSessionId}`,
      {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          status: 'COMPLETED',
          endedAt: new Date().toISOString(),
        }),
      }
    );
    if (!patchCompletedRes.ok) {
      throw new Error(responseErrorMessage(patchCompletedRes));
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
    throw error;
  }
}
