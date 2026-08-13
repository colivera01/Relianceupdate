import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireVendorMembership } from "@/lib/membership-auth";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { deleteBlob, uploadBlobBuffer } from "@/lib/azure-blob-storage";

const hoisted = vi.hoisted(() => ({
  bookingFindFirst: vi.fn(),
  consentRecordFindFirst: vi.fn(),
  mediaUploadAttemptFindFirst: vi.fn(),
  setUploadAttemptState: vi.fn(),
  loadRecordingPermissionGate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    booking: { findFirst: hoisted.bookingFindFirst },
    consentRecord: { findFirst: hoisted.consentRecordFindFirst },
    mediaUploadAttempt: { findFirst: hoisted.mediaUploadAttemptFindFirst },
  },
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorMembership: vi.fn(),
}));

vi.mock("@/lib/employee-capture-token", () => ({
  resolveEmployeeCaptureAccess: vi.fn(),
}));

vi.mock("@/lib/azure-blob-storage", () => ({
  deleteBlob: vi.fn(),
  uploadBlobBuffer: vi.fn(),
}));

vi.mock("@/lib/service-video-evidence", () => ({
  setUploadAttemptState: hoisted.setUploadAttemptState,
}));

vi.mock("@/lib/consent/recording-gate", () => ({
  loadRecordingPermissionGate: hoisted.loadRecordingPermissionGate,
  recordingGateErrorBody: (gate: any) => ({
    error: gate.blockMessage,
    code: gate.blockCode,
    blocked: gate.block,
  }),
}));

const VENDOR_ID = "vendor-1";
const ASSET_ID = "asset-1";
const VALID_BLOB_KEY = `vendor/${VENDOR_ID}/media/${ASSET_ID}.mp4`;

function buildRequest(input: {
  blobKey?: string;
  body?: BodyInit;
  contentType?: string;
  bookingId?: string;
} = {}) {
  return new Request(`http://localhost/api/vendors/${VENDOR_ID}/media/upload/proxy`, {
    method: "POST",
    headers: {
      "Content-Type": input.contentType ?? "video/mp4",
      "x-reliance-asset-id": ASSET_ID,
      "x-reliance-blob-key": input.blobKey ?? VALID_BLOB_KEY,
      "x-reliance-booking-id": input.bookingId ?? "booking-1",
    },
    body: input.body ?? new Uint8Array([1, 2, 3]),
  });
}

const context = { params: Promise.resolve({ vendorId: VENDOR_ID }) };

describe("employee media upload proxy", () => {
  beforeEach(() => {
    vi.mocked(requireVendorMembership).mockReset();
    vi.mocked(resolveEmployeeCaptureAccess).mockReset();
    vi.mocked(uploadBlobBuffer).mockReset();
    vi.mocked(deleteBlob).mockReset();
    vi.mocked(deleteBlob).mockResolvedValue(true);
    hoisted.bookingFindFirst.mockReset();
    hoisted.consentRecordFindFirst.mockReset();
    hoisted.mediaUploadAttemptFindFirst.mockReset();
    hoisted.mediaUploadAttemptFindFirst.mockResolvedValue({ id: "attempt-1", state: "UPLOADING" });
    hoisted.setUploadAttemptState.mockReset();
    hoisted.setUploadAttemptState.mockResolvedValue({ count: 1 });
    hoisted.loadRecordingPermissionGate.mockReset();
    hoisted.loadRecordingPermissionGate.mockResolvedValue({
      recordingUnlocked: true,
      blockCode: null,
      blockMessage: null,
      block: null,
    });

    hoisted.bookingFindFirst.mockResolvedValue({
      id: "booking-1",
      customerMetadata: JSON.stringify({ vendor_job_recording_location: "business" }),
    });
    hoisted.consentRecordFindFirst.mockResolvedValue(null);

    vi.mocked(resolveEmployeeCaptureAccess).mockResolvedValue({
      vendorId: VENDOR_ID,
      bookingId: "booking-1",
      membershipId: "membership-1",
      userId: "user-1",
      role: "EMPLOYEE",
      status: "ACTIVE",
      employeeName: "Employee",
      token: {} as any,
    });
    vi.mocked(uploadBlobBuffer).mockResolvedValue({ url: "https://storage.example/blob.mp4" });
  });

  it("uploads a staged video through the server fallback for capture-token users", async () => {
    const res = await POST(buildRequest(), context as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.uploadPath).toBe("proxy");
    expect(requireVendorMembership).not.toHaveBeenCalled();
    expect(uploadBlobBuffer).toHaveBeenCalledWith(
      VALID_BLOB_KEY,
      expect.any(Buffer),
      expect.objectContaining({ contentType: "video/mp4" })
    );
  });

  it("does not let a capture token omit booking context to use the generic proxy", async () => {
    const request = buildRequest();
    request.headers.delete("x-reliance-booking-id");
    const res = await POST(request, context as any);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe("EMPLOYEE_SERVICE_VIDEO_CONTEXT_REQUIRED");
    expect(uploadBlobBuffer).not.toHaveBeenCalled();
  });

  it("blocks blob keys outside the vendor media prefix", async () => {
    const res = await POST(buildRequest({ blobKey: "vendor/other/media/asset-1.mp4" }), context as any);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe("Invalid blobKey for this vendor upload");
    expect(uploadBlobBuffer).not.toHaveBeenCalled();
  });

  it("rejects non-video fallback uploads", async () => {
    const res = await POST(
      buildRequest({
        body: "hello",
        contentType: "text/plain",
      }),
      context as any
    );
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe("Stage uploads must be video files.");
    expect(uploadBlobBuffer).not.toHaveBeenCalled();
  });

  it("blocks a declined residence work record even when mutable metadata says business", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "booking-1",
      customerMetadata: JSON.stringify({ vendor_job_recording_location: "business" }),
    });
    hoisted.loadRecordingPermissionGate.mockResolvedValue({
      recordingUnlocked: false,
      blockCode: "VERIFIED_PERMISSION_REQUIRED",
      blockMessage: "Required customer recording permission is not active.",
      block: {
        why: "Required customer recording permission is not active.",
        responsibleParticipant: "CUSTOMER",
        resolution: "The customer must use the secure request to allow recording.",
      },
    });

    const res = await POST(buildRequest(), context as any);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({ code: "VERIFIED_PERMISSION_REQUIRED" });
    expect(uploadBlobBuffer).not.toHaveBeenCalled();
  });

  it("rejects a retry after submission before any bytes reach Blob Storage", async () => {
    hoisted.mediaUploadAttemptFindFirst.mockResolvedValue({
      id: "attempt-1",
      state: "RETRY_REQUIRED",
      stage: "INTRO",
    });
    hoisted.loadRecordingPermissionGate.mockResolvedValue({
      recordingUnlocked: false,
      blockCode: "MANAGER_REVIEW_IN_PROGRESS",
      blockMessage: "The completed Service Videos were submitted for manager review. Wait for manager review.",
      block: {
        why: "The completed Service Videos were submitted for manager review.",
        responsibleParticipant: "VENDOR_MANAGER",
        resolution: "Wait for manager review.",
      },
    });

    const res = await POST(buildRequest(), context as any);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      code: "MANAGER_REVIEW_IN_PROGRESS",
      blocked: {
        responsibleParticipant: "VENDOR_MANAGER",
        resolution: "Wait for manager review.",
      },
    });
    expect(hoisted.loadRecordingPermissionGate).toHaveBeenCalledWith(
      expect.objectContaining({ recordingStage: "INTRO", capability: "record" }),
    );
    expect(uploadBlobBuffer).not.toHaveBeenCalled();
    expect(hoisted.setUploadAttemptState).not.toHaveBeenCalled();
  });

  it("fails closed when submission becomes authoritative while request bytes are being read", async () => {
    hoisted.loadRecordingPermissionGate
      .mockResolvedValueOnce({ recordingUnlocked: true, blockCode: null })
      .mockResolvedValueOnce({
        recordingUnlocked: false,
        blockCode: "MANAGER_REVIEW_IN_PROGRESS",
        blockMessage: "The completed Service Videos were submitted for manager review.",
        block: { responsibleParticipant: "VENDOR_MANAGER", resolution: "Wait for manager review." },
      });

    const res = await POST(buildRequest(), context as any);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe("MANAGER_REVIEW_IN_PROGRESS");
    expect(uploadBlobBuffer).not.toHaveBeenCalled();
    expect(hoisted.setUploadAttemptState).not.toHaveBeenCalled();
  });

  it("removes an unaccepted candidate when manager review begins during Blob upload", async () => {
    hoisted.loadRecordingPermissionGate
      .mockResolvedValueOnce({ recordingUnlocked: true, blockCode: null })
      .mockResolvedValueOnce({ recordingUnlocked: true, blockCode: null })
      .mockResolvedValueOnce({
        recordingUnlocked: false,
        blockCode: "MANAGER_REVIEW_IN_PROGRESS",
        blockMessage: "The completed Service Videos were submitted for manager review.",
        block: { responsibleParticipant: "VENDOR_MANAGER", resolution: "Wait for manager review." },
      });

    const res = await POST(buildRequest(), context as any);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe("MANAGER_REVIEW_IN_PROGRESS");
    expect(uploadBlobBuffer).toHaveBeenCalledTimes(1);
    expect(deleteBlob).toHaveBeenCalledWith(VALID_BLOB_KEY);
    expect(hoisted.setUploadAttemptState).not.toHaveBeenCalled();
  });
});
