import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const policyUpsert = vi.fn();
  const evidenceCreate = vi.fn();
  const evidenceUpdateMany = vi.fn();
  const transaction = vi.fn(async (callback: (tx: any) => Promise<any>) =>
    callback({
      policyDocumentVersion: { upsert: policyUpsert },
      customerRegistrationEvidence: {
        create: evidenceCreate,
        updateMany: evidenceUpdateMany,
      },
    })
  );

  return {
    prisma: { $transaction: transaction },
    policyUpsert,
    evidenceCreate,
    evidenceUpdateMany,
    transaction,
  };
});

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));

describe("customer registration policy evidence", () => {
  beforeEach(() => {
    hoisted.policyUpsert.mockReset();
    hoisted.evidenceCreate.mockReset();
    hoisted.evidenceUpdateMany.mockReset();
    hoisted.transaction.mockClear();
  });

  it("defines stable immutable policy identities and SHA-256 snapshots", async () => {
    const { CUSTOMER_REGISTRATION_POLICIES } = await import(
      "./customer-registration-policy-evidence"
    );

    expect(Object.values(CUSTOMER_REGISTRATION_POLICIES)).toHaveLength(3);
    for (const policy of Object.values(CUSTOMER_REGISTRATION_POLICIES)) {
      expect(policy.version).toBe("beta-2026-08-01");
      expect(policy.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(policy.contentSnapshot.length).toBeGreaterThan(100);
      expect(policy.sourceRevision).toBe(
        "684dc79364b22aa984e7ed990feaedfd9bc9f406"
      );
    }
  });

  it("stores one policy reference set and records an SMS opt-out without policy duplication", async () => {
    const {
      CUSTOMER_REGISTRATION_POLICIES,
      recordCustomerRegistrationEvidence,
    } = await import("./customer-registration-policy-evidence");

    const definitions = Object.values(CUSTOMER_REGISTRATION_POLICIES);
    hoisted.policyUpsert.mockImplementation(async (input: any) => {
      const definition = definitions.find(
        (item) => item.id === input.create.id
      );
      return { id: definition?.id, contentHash: definition?.contentHash };
    });
    hoisted.evidenceCreate.mockResolvedValue({ id: "registration-evidence-1" });
    const request = new Request("https://beta.relianceonline.org/api/customer/register", {
      headers: {
        "x-forwarded-for": "198.51.100.24, 10.0.0.1",
        "user-agent": "Reliance registration test browser",
      },
    });

    await recordCustomerRegistrationEvidence({
      request,
      userId: "customer-1",
      actorEmail: "Customer@Example.com",
      smsOptIn: false,
      registeredAt: new Date("2026-08-04T12:00:00.000Z"),
    });

    expect(hoisted.policyUpsert).toHaveBeenCalledTimes(3);
    for (const call of hoisted.policyUpsert.mock.calls) {
      expect(call[0]).toMatchObject({ update: {} });
    }
    expect(hoisted.evidenceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "customer-1",
        actorEmail: "customer@example.com",
        actorRole: "CUSTOMER",
        smsOptIn: false,
        registrationIp: "198.51.100.24",
        userAgent: "Reliance registration test browser",
        verificationMethod: "EMAIL_VERIFICATION_LINK",
        termsPolicyVersionId: "policy_terms_beta_2026_08_01",
        privacyPolicyVersionId: "policy_privacy_beta_2026_08_01",
        smsPolicyVersionId: "policy_sms_beta_2026_08_01",
      }),
    });
    expect(hoisted.evidenceCreate.mock.calls[0][0].data).not.toHaveProperty(
      "contentSnapshot"
    );
  });

  it("refuses to reuse a policy version whose immutable hash differs", async () => {
    const { recordCustomerRegistrationEvidence } = await import(
      "./customer-registration-policy-evidence"
    );
    hoisted.policyUpsert.mockResolvedValue({
      id: "policy-tampered",
      contentHash: "0".repeat(64),
    });

    await expect(
      recordCustomerRegistrationEvidence({
        request: new Request("https://beta.relianceonline.org/api/customer/register"),
        userId: "customer-1",
        actorEmail: "customer@example.com",
        smsOptIn: false,
      })
    ).rejects.toThrow("POLICY_VERSION_HASH_MISMATCH");
    expect(hoisted.evidenceCreate).not.toHaveBeenCalled();
  });
});
