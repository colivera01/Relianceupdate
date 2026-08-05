import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireVendorMembership } from "@/lib/membership-auth";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { uploadBlobBuffer } from "@/lib/azure-blob-storage";

const hoisted = vi.hoisted(() => ({
  bookingFindFirst: vi.fn(),
  consentRecordFindFirst: vi.fn(),
  mediaUploadAttemptFindFirst: vi.fn(),
  setUploadAttemptState: vi.fn(),
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
  uploadBlobBuffer: vi.fn(),
}));

vi.mock("@/lib/service-video-evidence", () => ({
  setUploadAttemptState: hoisted.setUploadAttemptState,
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
    hoisted.bookingFindFirst.mockReset();
    hoisted.consentRecordFindFirst.mockReset();
    hoisted.mediaUploadAttemptFindFirst.mockReset();
    hoisted.mediaUploadAttemptFindFirst.mockResolvedValue({ id: "attempt-1", state: "UPLOADING" });
    hoisted.setUploadAttemptState.mockReset();
    hoisted.setUploadAttemptState.mockResolvedValue({ count: 1 });

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
    hoisted.consentRecordFindFirst.mockResolvedValue({
      id: "consent-1",
      status: "declined",
      lifecycleStatus: "DECLINED",
      isCurrent: true,
      scopeJson: JSON.stringify({ recordingLocation: "residence" }),
      decisionEvidenceId: "evidence-1",
      decisionEvidence: { id: "evidence-1", decision: "declined" },
    });

    const res = await POST(buildRequest(), context as any);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({ code: "VERIFIED_PERMISSION_REQUIRED" });
    expect(uploadBlobBuffer).not.toHaveBeenCalled();
  });
});
