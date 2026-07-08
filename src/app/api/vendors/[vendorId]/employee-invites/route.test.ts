import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { requireVendorManager } from "@/lib/membership-auth";
import { sendEmployeeInviteNotification } from "@/lib/notifications/send-employee-invite";

const hoisted = vi.hoisted(() => {
  const vendorInviteFindMany = vi.fn();
  const vendorInviteCreate = vi.fn();
  const vendorMembershipFindMany = vi.fn();
  const vendorMembershipFindUnique = vi.fn();
  const vendorMembershipCreate = vi.fn();
  const vendorMembershipUpdate = vi.fn();
  const userFindUnique = vi.fn();
  const userCreate = vi.fn();
  const userUpdate = vi.fn();
  const vendorFindUnique = vi.fn();
  const prisma = {
    vendorInvite: {
      findMany: vendorInviteFindMany,
      create: vendorInviteCreate,
    },
    vendorMembership: {
      findMany: vendorMembershipFindMany,
      findUnique: vendorMembershipFindUnique,
      create: vendorMembershipCreate,
      update: vendorMembershipUpdate,
    },
    user: {
      findUnique: userFindUnique,
      create: userCreate,
      update: userUpdate,
    },
    vendor: {
      findUnique: vendorFindUnique,
    },
  };
  return {
    prisma,
    vendorInviteFindMany,
    vendorInviteCreate,
    vendorMembershipFindMany,
    vendorMembershipFindUnique,
    vendorMembershipCreate,
    vendorMembershipUpdate,
    userFindUnique,
    userCreate,
    userUpdate,
    vendorFindUnique,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorManager: vi.fn(),
}));

vi.mock("@/lib/notifications/send-employee-invite", () => ({
  sendEmployeeInviteNotification: vi.fn(),
}));

vi.mock("@/lib/env/notification-config", () => ({
  readNotificationEnv: () => ({
    emailEnabled: false,
    resendApiKey: "",
    smsEnabled: false,
    smsProvider: "telnyx",
    telnyxApiKey: "",
    telnyxFromNumber: "",
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioPhoneNumber: "",
    twilioMessagingServiceSid: "",
  }),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

describe("employee invite routes", () => {
  beforeEach(() => {
    vi.mocked(requireVendorManager).mockReset();
    vi.mocked(requireVendorManager).mockResolvedValue({ userId: "manager-1" } as any);
    vi.mocked(sendEmployeeInviteNotification).mockReset();
    vi.mocked(sendEmployeeInviteNotification).mockResolvedValue({
      anySuccess: true,
      channels: [{ channel: "email", attempted: true, success: true }],
      phoneNumberUsed: null,
    } as any);
    hoisted.vendorInviteFindMany.mockReset();
    hoisted.vendorInviteCreate.mockReset();
    hoisted.vendorMembershipFindMany.mockReset();
    hoisted.vendorMembershipFindUnique.mockReset();
    hoisted.vendorMembershipCreate.mockReset();
    hoisted.vendorMembershipUpdate.mockReset();
    hoisted.userFindUnique.mockReset();
    hoisted.userCreate.mockReset();
    hoisted.userUpdate.mockReset();
    hoisted.vendorFindUnique.mockReset();
  });

  it("returns stored invitee contact details for pending invite review", async () => {
    hoisted.vendorInviteFindMany.mockResolvedValue([
      {
        id: "invite-1",
        code: "ABC123",
        token: "token-1",
        isActive: true,
        createdAt: new Date("2026-07-07T04:45:00.000Z"),
        expiresAt: new Date("2026-07-14T04:45:00.000Z"),
        usesCount: 0,
        inviteeName: "Bradley Cooper",
        inviteeEmail: "bradley@example.com",
        inviteePhone: "4075550101",
        inviteeRole: "EMPLOYEE",
      },
    ]);
    hoisted.vendorMembershipFindMany.mockResolvedValue([]);

    const res = await GET(new Request("https://beta.relianceonline.org/api/vendors/vendor-1/employee-invites"), {
      params: Promise.resolve({ vendorId: "vendor-1" }),
    });
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.invites[0].recipient).toMatchObject({
      name: "Bradley Cooper",
      email: "bradley@example.com",
      phone: "4075550101",
      role: "EMPLOYEE",
    });
  });

  it("persists entered invitee contact details when creating an invite", async () => {
    hoisted.userFindUnique.mockResolvedValue(null);
    hoisted.userCreate.mockResolvedValue({
      id: "employee-user-1",
      name: "Bradley Cooper",
      email: "bradley@example.com",
      phone: "4075550101",
    });
    hoisted.vendorMembershipFindUnique.mockResolvedValue(null);
    hoisted.vendorMembershipCreate.mockResolvedValue({ id: "membership-1" });
    hoisted.vendorInviteCreate.mockResolvedValue({
      id: "invite-1",
      code: "ABC123",
      token: "token-1",
      createdAt: new Date("2026-07-07T04:45:00.000Z"),
      expiresAt: new Date("2026-07-14T04:45:00.000Z"),
    });
    hoisted.vendorFindUnique.mockResolvedValue({ businessName: "Electro LLC", name: "Electro" });

    const req = new Request("https://beta.relianceonline.org/api/vendors/vendor-1/employee-invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bradley Cooper",
        email: "BRADLEY@example.com",
        phone: "4075550101",
        role: "employee",
        origin: "https://beta.relianceonline.org",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ vendorId: "vendor-1" }) });

    expect(res.status).toBe(200);
    expect(hoisted.vendorInviteCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vendorId: "vendor-1",
        inviteeName: "Bradley Cooper",
        inviteeEmail: "bradley@example.com",
        inviteePhone: "4075550101",
        inviteeRole: "EMPLOYEE",
      }),
    });
  });
});
