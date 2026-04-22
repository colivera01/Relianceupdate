export type VendorJobMediaLifecycleState =
  | 'idle'
  | 'creating_session'
  | 'uploading'
  | 'completing'
  | 'completed'
  | 'failed';

export type VendorJobMediaPurpose = 'progress' | 'completion';

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
  mediaPurpose: VendorJobMediaPurpose;
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
    mediaPurpose: VendorJobMediaPurpose;
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

const responseErrorMessage = (res: RequestResult, fallback: string) =>
  (res.parsed && (res.parsed.error || res.parsed.message || res.parsed.details)) ||
  res.rawText ||
  res.statusText ||
  fallback;

export async function runVendorJobMediaUpload({
  vendorId,
  selectedJob,
  title,
  description,
  file,
  getHeaders,
  onLifecycleState,
  mediaPurpose,
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
      sessionType: mediaPurpose === 'completion' ? 'COMPLETION_MEDIA' : 'PROGRESS_MEDIA',
      title,
      description,
    };

    const sessionRes = await requestJson(`/api/vendors/${vendorId}/media/sessions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(sessionPayload),
    });
    if (!sessionRes.ok) {
      throw new Error(
        `Upload failed at: media session create - ${sessionRes.status} - ${responseErrorMessage(
          sessionRes,
          'Could not create media session'
        )}`
      );
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
      throw new Error(
        `Upload failed at: session PATCH to UPLOADING - ${patchUploadingRes.status} - ${responseErrorMessage(
          patchUploadingRes,
          'Could not mark session uploading'
        )}`
      );
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
      throw new Error(
        `Upload failed at: upload init - ${initRes.status} - ${responseErrorMessage(
          initRes,
          'Upload init failed'
        )}`
      );
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
        throw new Error(
          `Upload failed at: blob PUT upload - ${blobRes.status} - ${responseErrorMessage(
            blobRes,
            'Blob upload failed'
          )}`
        );
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
      throw new Error(
        `Upload failed at: upload complete - ${completeRes.status} - ${responseErrorMessage(
          completeRes,
          'Upload complete failed'
        )}`
      );
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
      throw new Error(
        `Upload failed at: final session PATCH to COMPLETED - ${patchCompletedRes.status} - ${responseErrorMessage(
          patchCompletedRes,
          'Could not mark session completed'
        )}`
      );
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
        mediaPurpose,
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
