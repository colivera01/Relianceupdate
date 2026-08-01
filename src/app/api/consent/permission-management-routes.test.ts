import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as markWrongRecipient } from "./[token]/wrong-recipient/route";
import { PATCH as correctRecipient } from "./requests/[requestId]/recipient/route";
import { POST as resendPermission } from "./requests/[requestId]/resend/route";

const hoisted = vi.hoisted(() => {
  const recordFindUnique = vi.fn();
  const linkUpdateMany = vi.fn();
  const recordUpdate = vi.fn();
  const eventCreate = vi.fn();
  const authorize = vi.fn();
  const rotate = vi.fn();
  const create = vi.fn();
  const deliver = vi.fn();
  const lookup = vi.fn();
  const prisma: any = {
    consentRecord: { findUnique: recordFindUnique, update: recordUpdate },
    consentRequestLink: { updateMany: linkUpdateMany },
    consentEvent: { create: eventCreate },
  };
  prisma.$transaction = vi.fn(async (operations: unknown[]) => Promise.all(operations));
  return { prisma, recordFindUnique, linkUpdateMany, recordUpdate, eventCreate, authorize, rotate, create, deliver, lookup };
});

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));
vi.mock("@/lib/consent/authorization", () => ({
  requirePermissionManagerForBooking: hoisted.authorize,
  permissionAuthorizationStatus: (error: unknown) => String(error).includes("Forbidden") ? 403 : 500,
}));
vi.mock("@/lib/consent/request-service", () => ({
  rotateVerifiedPermissionLink: hoisted.rotate,
  createVerifiedPermissionRequest: hoisted.create,
}));
vi.mock("@/lib/consent/delivery-service", () => ({ deliverVerifiedPermissionRequest: hoisted.deliver }));
vi.mock("@/lib/consent/lookup", () => ({
  findPermissionByActionSecret: hoisted.lookup,
  actionLinkAvailability: (link: any) => ({ active: Boolean(link), reason: link ? null : "not_found" }),
}));

function request(method = "POST", body?: Record<string, unknown>) {
  return new Request("http://localhost/api/consent/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("permission request management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.recordFindUnique.mockResolvedValue({ bookingId: "booking-1", mediaSessionId: "session-1", decisionEvidence: null });
    hoisted.authorize.mockResolvedValue({ manager: { userId: "manager-1" } });
    hoisted.rotate.mockResolvedValue({
      consentRecordId: "permission-1",
      notificationId: "notification-2",
      actionPath: "/consent/new-secret",
      recipient: { emailMasked: "c***@example.com", phoneMasked: null },
      booking: { id: "booking-1" },
      generation: 2,
    });
    hoisted.create.mockResolvedValue({
      consentRecordId: "permission-2",
      notificationId: "notification-3",
      actionPath: "/consent/corrected-secret",
      state: "pending",
      recipient: { name: "Correct Customer", emailMasked: "n***@example.com", phoneMasked: null },
      booking: { id: "booking-1" },
    });
    hoisted.deliver.mockResolvedValue({ status: "SENT", attemptCount: 1, channels: [], lastError: null });
    hoisted.lookup.mockResolvedValue({ id: "link-1", consentRecordId: "permission-1", generation: 1 });
    hoisted.linkUpdateMany.mockResolvedValue({ count: 1 });
    hoisted.recordUpdate.mockResolvedValue({ id: "permission-1" });
    hoisted.eventCreate.mockResolvedValue({ id: "event-1" });
  });

  it("rotates and delivers a new link without returning the secret", async () => {
    const response = await resendPermission(request() as any, { params: Promise.resolve({ requestId: "permission-1" }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(hoisted.rotate).toHaveBeenCalledWith({ consentRecordId: "permission-1", actorUserId: "manager-1" });
    expect(json.permission).toMatchObject({ id: "permission-1", generation: 2, state: "delivered" });
    expect(JSON.stringify(json)).not.toContain("new-secret");
  });

  it("requires a manager for resend and recipient correction", async () => {
    hoisted.authorize.mockRejectedValue(new Error("Forbidden"));
    const resend = await resendPermission(request() as any, { params: Promise.resolve({ requestId: "permission-1" }) });
    const correction = await correctRecipient(
      request("PATCH", { email: "new@example.com" }) as any,
      { params: Promise.resolve({ requestId: "permission-1" }) }
    );
    expect(resend.status).toBe(403);
    expect(correction.status).toBe(403);
    expect(hoisted.rotate).not.toHaveBeenCalled();
    expect(hoisted.create).not.toHaveBeenCalled();
  });

  it("supersedes the old request through the canonical correction service", async () => {
    const response = await correctRecipient(
      request("PATCH", { name: "Correct Customer", email: "new@example.com" }) as any,
      { params: Promise.resolve({ requestId: "permission-1" }) }
    );
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(hoisted.create).toHaveBeenCalledWith({
      bookingId: "booking-1",
      actorUserId: "manager-1",
      mediaSessionId: "session-1",
      reason: "recipient_correction",
      recipientOverride: { name: "Correct Customer", email: "new@example.com", phone: null },
    });
    expect(JSON.stringify(json)).not.toContain("corrected-secret");
  });

  it("records wrong recipient separately from a recording decline", async () => {
    const response = await markWrongRecipient(request() as any, { params: Promise.resolve({ token: "action-secret" }) });
    expect(response.status).toBe(200);
    expect(hoisted.recordUpdate).toHaveBeenCalledWith({
      where: { id: "permission-1" },
      data: expect.objectContaining({ lifecycleStatus: "WRONG_RECIPIENT", status: "wrong_recipient" }),
    });
    expect(hoisted.eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: "wrong_recipient" }),
    });
    expect(hoisted.eventCreate).not.toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: "declined" }) });
  });
});
