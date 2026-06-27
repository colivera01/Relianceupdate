import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./[token]/route";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";

const hoisted = vi.hoisted(() => {
  const vendorInviteFindFirst = vi.fn();
  const vendorInviteUpdate = vi.fn();
  const vendorFindUnique = vi.fn();
  const userFindUnique = vi.fn();
  const userFindFirst = vi.fn();
  const userCreate = vi.fn();
  const userUpdate = vi.fn();
  const vendorMembershipFindUnique = vi.fn();
  const vendorMembershipUpsert = vi.fn();
  const prisma = {
    vendorInvite: {
      findFirst: vendorInviteFindFirst,
      update: vendorInviteUpdate,
    },
    vendor: {
      findUnique: vendorFindUnique,
    },
    user: {
      findUnique: userFindUnique,
      findFirst: userFindFirst,
      create: userCreate,
      update: userUpdate,
    },
    vendorMembership: {
      findUnique: vendorMembershipFindUnique,
      upsert: vendorMembershipUpsert,
    },
  };

  return {
    prisma,
    vendorInviteFindFirst,
    vendorInviteUpdate,
    vendorFindUnique,
    userFindUnique,
    userFindFirst,
    userCreate,
    userUpdate,
    vendorMembershipFindUnique,
    vendorMembershipUpsert,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/lifecycle-audit", () => ({
  recordLifecycleAudit: vi.fn(),
}));

const INVITE_TOKEN = "e2e-vendor-invite-token";
const EXPIRES_AT = new Date("2026-12-01T12:00:00.000Z");

function buildInviteFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "invite-1",
    vendorId: "vendor-1",
    token: INVITE_TOKEN,
    code: "E2E123",
    expiresAt: EXPIRES_AT,
    maxUses: 1,
    usesCount: 0,
    isActive: true,
    ...overrides,
  };
}

function buildVendorFixture() {
  return {
    id: "vendor-1",
    name: "E2E Invite Vendor",
    businessName: "E2E Invite Vendor LLC",
    email: "vendor-invite@reliance.test",
    phone: "555-0100",
  };
}

function postInviteRequest(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/vendor/invite/${INVITE_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

describe("vendor invite token routes", () => {
  beforeEach(() => {
    hoisted.vendorInviteFindFirst.mockReset();
    hoisted.vendorInviteUpdate.mockReset();
    hoisted.vendorFindUnique.mockReset();
    hoisted.userFindUnique.mockReset();
    hoisted.userFindFirst.mockReset();
    hoisted.userCreate.mockReset();
    hoisted.userUpdate.mockReset();
    hoisted.vendorMembershipFindUnique.mockReset();
    hoisted.vendorMembershipUpsert.mockReset();
    vi.mocked(recordLifecycleAudit).mockReset();
  });

  it("loads a valid active vendor invite", async () => {
    hoisted.vendorInviteFindFirst.mockResolvedValue(buildInviteFixture());
    hoisted.vendorFindUnique.mockResolvedValue(buildVendorFixture());

    const res = await GET(new Request(`http://localhost/api/vendor/invite/${INVITE_TOKEN}`), {
      params: Promise.resolve({ token: INVITE_TOKEN }),
    });
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.invite).toMatchObject({
      token: INVITE_TOKEN,
      code: "E2E123",
      vendor: {
        id: "vendor-1",
        name: "E2E Invite Vendor LLC",
      },
    });
  });

  it("returns a clear inactive/already-used failure state for an inactive invite", async () => {
    hoisted.vendorInviteFindFirst.mockResolvedValue(
      buildInviteFixture({
        isActive: false,
        usesCount: 1,
      })
    );
    hoisted.vendorFindUnique.mockResolvedValue(buildVendorFixture());

    const res = await GET(new Request(`http://localhost/api/vendor/invite/${INVITE_TOKEN}`), {
      params: Promise.resolve({ token: INVITE_TOKEN }),
    });
    const json = await readJson(res);

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      success: false,
      code: "ALREADY_ACCEPTED",
      error: "Invite has already been accepted.",
    });
    expect(json.diagnostics).toMatchObject({
      tokenReceived: INVITE_TOKEN,
      inviteFound: true,
      status: "ALREADY_ACCEPTED",
      vendorId: "vendor-1",
    });
  });

  it("accepts a valid invite and activates employee membership", async () => {
    hoisted.vendorInviteFindFirst.mockResolvedValue(buildInviteFixture());
    hoisted.vendorFindUnique.mockResolvedValue(buildVendorFixture());
    hoisted.userFindUnique.mockResolvedValue(null);
    hoisted.userFindFirst.mockResolvedValue(null);
    hoisted.userCreate.mockResolvedValue({
      id: "employee-user-1",
      name: "E2E Employee",
      email: "e2e-employee@reliance.test",
      phone: "555-0198",
    });
    hoisted.vendorMembershipFindUnique.mockResolvedValue(null);
    hoisted.vendorMembershipUpsert.mockResolvedValue({
      id: "membership-1",
      vendorId: "vendor-1",
      userId: "employee-user-1",
      role: "EMPLOYEE",
      status: "ACTIVE",
    });
    hoisted.vendorInviteUpdate.mockResolvedValue({
      ...buildInviteFixture(),
      usesCount: 1,
      isActive: false,
    });
    vi.mocked(recordLifecycleAudit).mockResolvedValue(undefined);

    const res = await POST(
      postInviteRequest({
        name: "E2E Employee",
        email: "E2E-Employee@Reliance.Test",
        phone: "555-0198",
      }),
      { params: Promise.resolve({ token: INVITE_TOKEN }) }
    );
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      membership: {
        id: "membership-1",
        vendorId: "vendor-1",
        role: "EMPLOYEE",
        status: "ACTIVE",
      },
      user: {
        id: "employee-user-1",
        name: "E2E Employee",
        email: "e2e-employee@reliance.test",
      },
    });
    expect(hoisted.userCreate).toHaveBeenCalledWith({
      data: {
        name: "E2E Employee",
        email: "e2e-employee@reliance.test",
        phone: "555-0198",
      },
    });
    expect(hoisted.vendorMembershipUpsert).toHaveBeenCalledWith({
      where: {
        vendorId_userId: {
          vendorId: "vendor-1",
          userId: "employee-user-1",
        },
      },
      update: expect.objectContaining({
        role: "EMPLOYEE",
        status: "ACTIVE",
        approvedAt: expect.any(Date),
      }),
      create: expect.objectContaining({
        vendorId: "vendor-1",
        userId: "employee-user-1",
        role: "EMPLOYEE",
        status: "ACTIVE",
        approvedAt: expect.any(Date),
      }),
    });
    expect(hoisted.vendorInviteUpdate).toHaveBeenCalledWith({
      where: { id: "invite-1" },
      data: { usesCount: 1, isActive: false },
    });
    expect(recordLifecycleAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "membership_accepted",
        entityType: "membership",
        entityId: "membership-1",
        actorUserId: "employee-user-1",
      })
    );
  });
});
