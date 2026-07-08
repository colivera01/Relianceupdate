import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendTeamInviteAcceptedNotification } from "./send-team-invite-accepted";
import { sendEmail } from "@/lib/email/resend";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";

const hoisted = vi.hoisted(() => {
  const vendorMembershipFindMany = vi.fn();

  return {
    prisma: {
      vendorMembership: {
        findMany: vendorMembershipFindMany,
      },
    },
    vendorMembershipFindMany,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/email/resend", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/notifications/notification-audit", () => ({
  logNotificationAttempt: vi.fn(),
}));

describe("sendTeamInviteAcceptedNotification", () => {
  beforeEach(() => {
    hoisted.vendorMembershipFindMany.mockReset();
    vi.mocked(sendEmail).mockReset();
    vi.mocked(logNotificationAttempt).mockReset();
  });

  it("emails active vendor managers when an employee accepts a team invite", async () => {
    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        user: {
          name: "Electro Manager",
          email: "manager@electro.test",
        },
      },
    ]);
    vi.mocked(sendEmail).mockResolvedValue({
      ok: true,
      providerMessageId: "email-1",
    });

    const result = await sendTeamInviteAcceptedNotification({
      inviteId: "invite-1",
      vendorId: "vendor-1",
      actorUserId: "employee-1",
      vendorName: "Electro LLC",
      employeeName: "Bradley Cooper",
      employeeEmail: "bradley@example.com",
      employeePhone: "4079148888",
      employeeRole: "EMPLOYEE",
      baseUrl: "https://beta.relianceonline.org",
    });

    expect(hoisted.vendorMembershipFindMany).toHaveBeenCalledWith({
      where: {
        vendorId: "vendor-1",
        status: { in: ["ACTIVE", "active"] },
        role: { in: ["MANAGER", "manager"] },
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      take: 25,
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "manager@electro.test",
        subject: "Reliance team update: Bradley Cooper accepted the invite",
        html: expect.stringContaining("Team invite accepted"),
        text: expect.stringContaining("Bradley Cooper accepted the team invite for Electro LLC."),
      })
    );
    expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain("https://beta.relianceonline.org/vendor/employees");
    expect(logNotificationAttempt).toHaveBeenCalledWith("employee-1", "invite-1", {
      kind: "employee_invite_accepted",
      channel: "email",
      recipient: "manager@electro.test",
      success: true,
      providerMessageId: "email-1",
      fallbackLink: "https://beta.relianceonline.org/vendor/employees",
      errorMessage: undefined,
    });
    expect(result).toEqual({
      attempted: 1,
      sent: 1,
      recipients: ["manager@electro.test"],
      errors: [],
    });
  });
});
