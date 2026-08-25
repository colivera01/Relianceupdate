import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireVendorMembership } from "@/lib/membership-auth";
import { downloadBlobToBuffer, getBlobProperties } from "@/lib/azure-blob-storage";
import { calculateStorageUsage, checkAndCreateStorageAlerts } from "@/lib/storage-helpers";

const hoisted = vi.hoisted(() => {
  const mediaSessionFindFirst = vi.fn();
  const mediaSessionFindMany = vi.fn();
  const mediaAssetCreate = vi.fn();
  const bookingFindFirst = vi.fn();
  const bookingUpdate = vi.fn();
  const consentRecordFindFirst = vi.fn();
  const mediaUploadAttemptFindFirst = vi.fn();
  const saveVerifiedServiceVideoStage = vi.fn();
  const setUploadAttemptState = vi.fn();
  const loadRecordingPermissionGate = vi.fn();

  const prisma = {
    mediaSession: {
      findFirst: mediaSessionFindFirst,
      findMany: mediaSessionFindMany,
    },
    mediaAsset: {
      create: mediaAssetCreate,
    },
    booking: {
      findFirst: bookingFindFirst,
      update: bookingUpdate,
    },
    consentRecord: {
      findFirst: consentRecordFindFirst,
    },
    mediaUploadAttempt: { findFirst: mediaUploadAttemptFindFirst },
  };

  return {
    prisma,
    mediaSessionFindFirst,
    mediaSessionFindMany,
    mediaAssetCreate,
    bookingFindFirst,
    bookingUpdate,
    consentRecordFindFirst,
    mediaUploadAttemptFindFirst,
    saveVerifiedServiceVideoStage,
    setUploadAttemptState,
    loadRecordingPermissionGate,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorMembership: vi.fn(),
}));

vi.mock("@/lib/azure-blob-storage", () => ({
  getBlobProperties: vi.fn(),
  downloadBlobToBuffer: vi.fn(),
}));

vi.mock("@/lib/storage-helpers", () => ({
  calculateStorageUsage: vi.fn(),
  checkAndCreateStorageAlerts: vi.fn(),
}));

vi.mock("@/lib/service-video-evidence", () => ({
  REQUIRED_SERVICE_VIDEO_STAGES: ["INTRO", "IN_PROGRESS", "COMPLETED"],
  saveVerifiedServiceVideoStage: hoisted.saveVerifiedServiceVideoStage,
  setUploadAttemptState: hoisted.setUploadAttemptState,
}));

vi.mock("@/lib/consent/recording-gate", () => ({
  loadRecordingPermissionGate: hoisted.loadRecordingPermissionGate,
  recordingGateErrorBody: (gate: any) => ({
    error: gate.blockMessage,
    code: gate.blockCode,
    why: gate.block?.why,
    responsibleParticipant: gate.block?.responsibleParticipant,
    resolution: gate.block?.resolution,
  }),
}));

const VENDOR_ID = "vendor-1";

function buildRequest(
  durationSeconds: number,
  options: {
    blobKey?: string;
    mimeType?: string;
  } = {}
) {
  const blobKey =
    options.blobKey || "vendor/vendor-1/media/asset-1.mp4";
  const mimeType = options.mimeType || "video/mp4";
  return new Request(`http://localhost/api/vendors/${VENDOR_ID}/media/upload/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assetId: "asset-1",
      blobKey,
      bytes: 1024,
      mimeType,
      mediaSessionId: "session-1",
      durationSeconds,
    }),
  });
}

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

function mp4WithDurationSeconds(durationSeconds: number): Buffer {
  const ftyp = box("ftyp", Buffer.from("isom\x00\x00\x02\x00isomiso2mp41", "binary"));
  const mvhdBody = Buffer.alloc(20);
  mvhdBody.writeUInt8(0, 0);
  mvhdBody.writeUInt32BE(1_000, 12);
  mvhdBody.writeUInt32BE(durationSeconds * 1_000, 16);
  return Buffer.concat([ftyp, box("moov", box("mvhd", mvhdBody))]);
}

function mp4WithDurationAndAudio(durationSeconds: number): Buffer {
  const ftyp = box("ftyp", Buffer.from("isom\x00\x00\x02\x00isomiso2mp41", "binary"));
  const mvhdBody = Buffer.alloc(20);
  mvhdBody.writeUInt8(0, 0);
  mvhdBody.writeUInt32BE(1_000, 12);
  mvhdBody.writeUInt32BE(durationSeconds * 1_000, 16);
  const handlerBody = Buffer.alloc(12);
  handlerBody.write("soun", 8, 4, "ascii");
  const audioTrack = box("trak", box("mdia", box("hdlr", handlerBody)));
  return Buffer.concat([ftyp, box("moov", Buffer.concat([box("mvhd", mvhdBody), audioTrack]))]);
}

function box(type: string, body: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(body.length + 8, 0);
  header.write(type, 4, 4, "ascii");
  return Buffer.concat([header, body]);
}

function ebmlElement(id: number[], data: Buffer): Buffer {
  if (data.length >= 127) throw new Error("Test element is too large.");
  return Buffer.concat([Buffer.from(id), Buffer.from([0x80 | data.length]), data]);
}

function unknownSizeElement(id: number[], data: Buffer): Buffer {
  return Buffer.concat([Buffer.from(id), Buffer.from([0xff]), data]);
}

function mediaRecorderWebmWithoutInfoDuration(
  clusterTimestamp: number,
  relativeTimestamp: number
): Buffer {
  const block = Buffer.alloc(5);
  block[0] = 0x81;
  block.writeInt16BE(relativeTimestamp, 1);
  block[3] = 0x80;

  const timestamp = Buffer.alloc(2);
  timestamp.writeUInt16BE(clusterTimestamp);

  const info = ebmlElement(
    [0x15, 0x49, 0xa9, 0x66],
    ebmlElement([0x2a, 0xd7, 0xb1], Buffer.from([0x0f, 0x42, 0x40]))
  );
  const cluster = unknownSizeElement(
    [0x1f, 0x43, 0xb6, 0x75],
    Buffer.concat([
      ebmlElement([0xe7], timestamp),
      ebmlElement([0xa3], block),
    ])
  );

  return Buffer.concat([
    ebmlElement([0x1a, 0x45, 0xdf, 0xa3], Buffer.alloc(0)),
    unknownSizeElement(
      [0x18, 0x53, 0x80, 0x67],
      Buffer.concat([info, cluster])
    ),
  ]);
}

describe("POST /api/vendors/[vendorId]/media/upload/complete stage video duration", () => {
  beforeEach(() => {
    vi.mocked(requireVendorMembership).mockReset();
    vi.mocked(requireVendorMembership).mockResolvedValue({
      userId: "user-1",
      membershipId: "membership-1",
      role: "owner",
    } as any);

    vi.mocked(getBlobProperties).mockReset();
    vi.mocked(getBlobProperties).mockResolvedValue({
      exists: true,
      contentLength: 1024,
      contentType: "video/mp4",
    });

    vi.mocked(downloadBlobToBuffer).mockReset();
    vi.mocked(calculateStorageUsage).mockReset();
    vi.mocked(calculateStorageUsage).mockResolvedValue({
      usedBytes: BigInt(0),
      limitBytes: BigInt(10_000_000),
      percentUsed: 0,
      isOverLimit: false,
    } as any);
    vi.mocked(checkAndCreateStorageAlerts).mockReset();
    vi.mocked(checkAndCreateStorageAlerts).mockResolvedValue(undefined as any);

    hoisted.mediaSessionFindFirst.mockReset();
    hoisted.mediaSessionFindFirst.mockResolvedValue({
      id: "session-1",
      vendorJobVideoStage: "INTRO",
      sessionType: "JOB_SERVICE_VIDEO",
      bookingId: "booking-1",
      recordingGateDecisionId: "gate-1",
      capturedByMembershipId: "membership-1",
      audioExpected: false,
      audioContractVersion: 2,
    });
    hoisted.mediaSessionFindMany.mockReset();
    hoisted.mediaSessionFindMany.mockResolvedValue([]);
    hoisted.mediaAssetCreate.mockReset();
    hoisted.mediaAssetCreate.mockResolvedValue({
      id: "asset-1",
      vendorId: VENDOR_ID,
      mediaSessionId: "session-1",
      blobKey: "vendor/vendor-1/media/asset-1.mp4",
      blobUrl: null,
      bytes: BigInt(1024),
      mimeType: "video/mp4",
      moderationStatus: "pending_review",
      visibilityStatus: "private",
      archiveStatus: "active",
      createdAt: new Date("2026-05-27T00:00:00.000Z"),
    });
    hoisted.bookingFindFirst.mockReset();
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "booking-1",
      status: "PENDING",
      customerMetadata: JSON.stringify({ vendor_job_recording_location: "business" }),
    });
    hoisted.bookingUpdate.mockReset();
    hoisted.consentRecordFindFirst.mockReset();
    hoisted.consentRecordFindFirst.mockResolvedValue(null);
    hoisted.mediaUploadAttemptFindFirst.mockReset();
    hoisted.mediaUploadAttemptFindFirst.mockResolvedValue({
      id: "attempt-1",
      state: "UPLOADING",
      captureProvenance: "LIVE_BROWSER_CAPTURE",
    });
    hoisted.setUploadAttemptState.mockReset();
    hoisted.setUploadAttemptState.mockResolvedValue({ count: 1 });
    hoisted.loadRecordingPermissionGate.mockReset();
    hoisted.loadRecordingPermissionGate.mockResolvedValue({ blockCode: null, recordingUnlocked: true, audioAllowed: false });
    hoisted.saveVerifiedServiceVideoStage.mockReset();
    hoisted.saveVerifiedServiceVideoStage.mockResolvedValue({
      asset: {
        id: "asset-1",
        mediaSessionId: "session-1",
        bytes: BigInt(1024),
        mimeType: "video/mp4",
        uploadState: "SAVED",
        contentHash: "hash-1",
        captureProvenance: "LIVE_BROWSER_CAPTURE",
        stageVersion: 1,
      },
    });
  });

  it("rejects upload finalization while manager review is pending without saving another candidate", async () => {
    hoisted.loadRecordingPermissionGate.mockResolvedValue({
      blockCode: "MANAGER_REVIEW_IN_PROGRESS",
      blockMessage: "The completed Service Videos were submitted for manager review.",
      block: {
        why: "The completed Service Videos were submitted for manager review.",
        responsibleParticipant: "VENDOR_MANAGER",
        resolution: "Wait for manager review.",
      },
    });

    const response = await POST(buildRequest(12), {
      params: Promise.resolve({ vendorId: VENDOR_ID }),
    });
    const json = await readJson(response);

    expect(response.status).toBe(409);
    expect(json).toMatchObject({
      code: "MANAGER_REVIEW_IN_PROGRESS",
      responsibleParticipant: "VENDOR_MANAGER",
      resolution: "Wait for manager review.",
    });
    expect(hoisted.loadRecordingPermissionGate).toHaveBeenCalledWith(
      expect.objectContaining({ recordingStage: "INTRO" }),
    );
    expect(hoisted.saveVerifiedServiceVideoStage).not.toHaveBeenCalled();
    expect(hoisted.mediaAssetCreate).not.toHaveBeenCalled();
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("rejects a pre-authorized finalization when the durable transaction observes manager review", async () => {
    vi.mocked(downloadBlobToBuffer).mockResolvedValue(mp4WithDurationSeconds(12));
    const error = Object.assign(new Error("MANAGER_REVIEW_IN_PROGRESS"), {
      name: "ServiceVideoMutationBlockedError",
      code: "MANAGER_REVIEW_IN_PROGRESS",
    });
    hoisted.saveVerifiedServiceVideoStage.mockRejectedValue(error);

    const response = await POST(buildRequest(12), {
      params: Promise.resolve({ vendorId: VENDOR_ID }),
    });
    const json = await readJson(response);

    expect(response.status).toBe(409);
    expect(json).toMatchObject({
      code: "MANAGER_REVIEW_IN_PROGRESS",
      responsibleParticipant: "VENDOR_MANAGER",
      resolution: "Wait for manager review.",
    });
    expect(hoisted.mediaAssetCreate).not.toHaveBeenCalled();
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("allows a staged video when the uploaded media probes under the 30-second limit", async () => {
    vi.mocked(downloadBlobToBuffer).mockResolvedValue(mp4WithDurationSeconds(12));

    const res = await POST(buildRequest(12), {
      params: Promise.resolve({ vendorId: VENDOR_ID }),
    });
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(downloadBlobToBuffer).toHaveBeenCalledWith("vendor/vendor-1/media/asset-1.mp4");
    expect(hoisted.saveVerifiedServiceVideoStage).toHaveBeenCalledTimes(1);
    expect(json.uploadState).toBe("SAVED");
    expect(hoisted.saveVerifiedServiceVideoStage).toHaveBeenCalledWith(expect.objectContaining({
      audioExpected: false,
      audioPresence: "ABSENT",
      audioTrackCount: 0,
      audioEvidenceVersion: 2,
    }));
  });

  it("rejects unauthorized audio in a Video-only package before durable stage save", async () => {
    vi.mocked(downloadBlobToBuffer).mockResolvedValue(mp4WithDurationAndAudio(12));

    const response = await POST(buildRequest(12), {
      params: Promise.resolve({ vendorId: VENDOR_ID }),
    });
    const json = await readJson(response);

    expect(response.status).toBe(422);
    expect(json).toMatchObject({
      error: "SERVICE_VIDEO_UNAUTHORIZED_AUDIO",
      uploadState: "REJECTED",
    });
    expect(hoisted.setUploadAttemptState).toHaveBeenCalledWith(expect.objectContaining({
      state: "REJECTED",
      failureCode: "SERVICE_VIDEO_UNAUTHORIZED_AUDIO",
    }));
    expect(hoisted.saveVerifiedServiceVideoStage).not.toHaveBeenCalled();
  });

  it("accepts authorized audio and binds actual audio presence into stage evidence", async () => {
    hoisted.mediaSessionFindFirst.mockResolvedValue({
      id: "session-1",
      vendorJobVideoStage: "INTRO",
      sessionType: "JOB_SERVICE_VIDEO",
      bookingId: "booking-1",
      recordingGateDecisionId: "gate-1",
      capturedByMembershipId: "membership-1",
      audioExpected: true,
      audioContractVersion: 2,
    });
    hoisted.loadRecordingPermissionGate.mockResolvedValue({
      blockCode: null,
      recordingUnlocked: true,
      audioAllowed: true,
    });
    vi.mocked(downloadBlobToBuffer).mockResolvedValue(mp4WithDurationAndAudio(12));

    const response = await POST(buildRequest(12), {
      params: Promise.resolve({ vendorId: VENDOR_ID }),
    });

    expect(response.status).toBe(200);
    expect(hoisted.saveVerifiedServiceVideoStage).toHaveBeenCalledWith(expect.objectContaining({
      audioExpected: true,
      audioPresence: "PRESENT",
      audioTrackCount: 1,
      audioEvidenceVersion: 2,
    }));
  });

  it("rejects missing audio when the complete package scope requires it", async () => {
    hoisted.mediaSessionFindFirst.mockResolvedValue({
      id: "session-1",
      vendorJobVideoStage: "INTRO",
      sessionType: "JOB_SERVICE_VIDEO",
      bookingId: "booking-1",
      recordingGateDecisionId: "gate-1",
      capturedByMembershipId: "membership-1",
      audioExpected: true,
      audioContractVersion: 2,
    });
    hoisted.loadRecordingPermissionGate.mockResolvedValue({
      blockCode: null,
      recordingUnlocked: true,
      audioAllowed: true,
    });
    vi.mocked(downloadBlobToBuffer).mockResolvedValue(mp4WithDurationSeconds(12));

    const response = await POST(buildRequest(12), {
      params: Promise.resolve({ vendorId: VENDOR_ID }),
    });
    const json = await readJson(response);

    expect(response.status).toBe(422);
    expect(json).toMatchObject({
      error: "SERVICE_VIDEO_REQUIRED_AUDIO_MISSING",
      uploadState: "REJECTED",
    });
    expect(hoisted.saveVerifiedServiceVideoStage).not.toHaveBeenCalled();
  });

  it("rejects a stale media session whose package audio scope changed", async () => {
    hoisted.mediaSessionFindFirst.mockResolvedValue({
      id: "session-1",
      vendorJobVideoStage: "INTRO",
      sessionType: "JOB_SERVICE_VIDEO",
      bookingId: "booking-1",
      recordingGateDecisionId: "gate-1",
      capturedByMembershipId: "membership-1",
      audioExpected: false,
      audioContractVersion: 2,
    });
    hoisted.loadRecordingPermissionGate.mockResolvedValue({
      blockCode: null,
      recordingUnlocked: true,
      audioAllowed: true,
    });

    const response = await POST(buildRequest(12), {
      params: Promise.resolve({ vendorId: VENDOR_ID }),
    });
    const json = await readJson(response);

    expect(response.status).toBe(409);
    expect(json).toMatchObject({
      error: "AUDIO_SCOPE_SESSION_MISMATCH",
      uploadState: "REJECTED",
    });
    expect(downloadBlobToBuffer).not.toHaveBeenCalled();
    expect(hoisted.saveVerifiedServiceVideoStage).not.toHaveBeenCalled();
  });

  it("allows a Chrome MediaRecorder WebM without Info.Duration", async () => {
    vi.mocked(downloadBlobToBuffer).mockResolvedValue(
      mediaRecorderWebmWithoutInfoDuration(8_000, 512)
    );

    const blobKey = "vendor/vendor-1/media/asset-1.webm";
    const mimeType = "video/webm;codecs=vp9";
    const res = await POST(buildRequest(8.512, { blobKey, mimeType }), {
      params: Promise.resolve({ vendorId: VENDOR_ID }),
    });
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(downloadBlobToBuffer).toHaveBeenCalledWith(blobKey);
    expect(hoisted.saveVerifiedServiceVideoStage).toHaveBeenCalledTimes(1);
  });

  it("rejects a staged video when the uploaded media probes over the 30-second limit", async () => {
    vi.mocked(downloadBlobToBuffer).mockResolvedValue(mp4WithDurationSeconds(31));

    const res = await POST(buildRequest(12), {
      params: Promise.resolve({ vendorId: VENDOR_ID }),
    });
    const json = await readJson(res);

    expect(res.status).toBe(413);
    expect(json).toMatchObject({
      error: "STAGE_VIDEO_TOO_LONG",
      maxDurationSeconds: 30,
      verifiedByServer: true,
    });
    expect(json.durationSeconds).toBe(31);
    expect(hoisted.mediaAssetCreate).not.toHaveBeenCalled();
  });

  it("keeps booking-linked uploads in progress until the employee submits the package", async () => {
    vi.mocked(downloadBlobToBuffer).mockResolvedValue(mp4WithDurationSeconds(12));
    hoisted.mediaSessionFindFirst
      .mockResolvedValueOnce({
        id: "session-1",
        bookingId: "booking-1",
        vendorJobVideoStage: "COMPLETED",
        sessionType: "JOB_SERVICE_VIDEO",
        recordingGateDecisionId: "gate-1",
        capturedByMembershipId: "membership-1",
      })
      .mockResolvedValueOnce({
        bookingId: "booking-1",
      });
    hoisted.mediaSessionFindMany.mockResolvedValue([
      {
        id: "session-intro",
        vendorJobVideoStage: "INTRO",
        sessionType: "JOB_SERVICE_VIDEO",
        mediaAssets: [{ id: "asset-intro", moderationStatus: "pending_review", createdAt: new Date("2026-06-06T13:20:00.000Z") }],
      },
      {
        id: "session-progress",
        vendorJobVideoStage: "IN_PROGRESS",
        sessionType: "JOB_SERVICE_VIDEO",
        mediaAssets: [{ id: "asset-progress", moderationStatus: "pending_review", createdAt: new Date("2026-06-06T13:21:00.000Z") }],
      },
      {
        id: "session-completed",
        vendorJobVideoStage: "COMPLETED",
        sessionType: "JOB_SERVICE_VIDEO",
        mediaAssets: [{ id: "asset-completed", moderationStatus: "pending_review", createdAt: new Date("2026-06-06T13:22:00.000Z") }],
      },
    ]);
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "booking-1",
      status: "PENDING",
      customerMetadata: JSON.stringify({ vendor_job_recording_location: "business" }),
    });
    hoisted.bookingUpdate.mockResolvedValue({
      id: "booking-1",
      status: "AWAITING_REVIEW",
      customerMetadata: JSON.stringify({ reliance_ops: { operational_phase: "AWAITING_ADMIN_REVIEW" } }),
    });

    const res = await POST(buildRequest(12), {
      params: Promise.resolve({ vendorId: VENDOR_ID }),
    });

    expect(res.status).toBe(200);
    expect(hoisted.saveVerifiedServiceVideoStage).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-1",
        bookingMetadataAfterSave: JSON.stringify({
          vendor_job_recording_location: "business",
          reliance_ops: { operational_phase: "IN_PROGRESS" },
        }),
      }),
    );
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("does not complete a staged upload after residence permission is declined", async () => {
    vi.mocked(downloadBlobToBuffer).mockResolvedValue(mp4WithDurationSeconds(12));
    hoisted.consentRecordFindFirst.mockResolvedValue({
      id: "consent-1",
      status: "declined",
      lifecycleStatus: "DECLINED",
      isCurrent: true,
      scopeJson: JSON.stringify({ recordingLocation: "residence" }),
      decisionEvidenceId: "evidence-1",
      decisionEvidence: { id: "evidence-1", decision: "declined" },
    });
    hoisted.loadRecordingPermissionGate.mockResolvedValue({
      blockCode: "VERIFIED_PERMISSION_REQUIRED",
      blockMessage: "Verified customer permission is required.",
      block: {
        why: "The customer declined recording.",
        responsibleParticipant: "CUSTOMER",
        resolution: "The service may continue without recording.",
      },
    });

    const res = await POST(buildRequest(12), {
      params: Promise.resolve({ vendorId: VENDOR_ID }),
    });
    const json = await readJson(res);

    expect(res.status).toBe(409);
    expect(json).toMatchObject({ error: expect.any(String), code: "VERIFIED_PERMISSION_REQUIRED" });
    expect(hoisted.mediaAssetCreate).not.toHaveBeenCalled();
  });
});
