import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const hoisted = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    privateProofAccessEvent: { create: hoisted.create },
  },
}));

import {
  recordPrivateProofAccess,
  recordPrivateProofAccessBestEffort,
  type PrivateProofAccessEventInput,
} from "@/lib/service-video-evidence";

const accessInput = {
  accessGrantId: "grant-1",
  packageId: "package-1",
  bookingId: "booking-1",
  mediaAssetId: "asset-1",
  actorUserId: "customer-1",
  eventType: "DOWNLOAD",
  ipAddress: "203.0.113.1",
  userAgent: "test-agent",
} satisfies PrivateProofAccessEventInput;

describe("Private Proof access-event persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.create.mockResolvedValue({ id: "access-event-1", ...accessInput });
  });

  it("uses the current generated Prisma accessGrantId contract", async () => {
    const model = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === "PrivateProofAccessEvent");
    const fieldNames = model?.fields.map((field) => field.name) || [];

    expect(fieldNames).toContain("accessGrantId");
    expect(fieldNames).not.toContain("grantId");

    await recordPrivateProofAccess(accessInput);

    expect(hoisted.create).toHaveBeenCalledOnce();
    expect(hoisted.create).toHaveBeenCalledWith({ data: accessInput });
    expect(hoisted.create.mock.calls[0]?.[0]?.data).not.toHaveProperty("grantId");
  });

  it("records successful best-effort access without a correlation id", async () => {
    await expect(recordPrivateProofAccessBestEffort(accessInput)).resolves.toEqual({
      recorded: true,
      correlationId: null,
    });
  });

  it("logs a correlated internal diagnostic without denying authorized playback", async () => {
    const persistenceError = new Error("database write failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    hoisted.create.mockRejectedValue(persistenceError);

    const result = await recordPrivateProofAccessBestEffort(accessInput);

    expect(result.recorded).toBe(false);
    expect(result.correlationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(consoleError).toHaveBeenCalledWith(
      "[private-proof-access-audit] persistence failed",
      expect.objectContaining({
        correlationId: result.correlationId,
        accessAuthorized: true,
        auditRecorded: false,
        accessGrantId: "grant-1",
        eventType: "DOWNLOAD",
        error: persistenceError,
      }),
    );
    consoleError.mockRestore();
  });
});
