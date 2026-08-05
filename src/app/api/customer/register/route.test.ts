import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const hoisted = vi.hoisted(() => {
  const userUpsert = vi.fn();
  const userFindUnique = vi.fn();
  const bookingFindUnique = vi.fn();
  const bookingUpdateMany = vi.fn();
  const recordCustomerRegistrationEvidence = vi.fn();
  const transaction = vi.fn(async (callback: (tx: any) => Promise<any>) =>
    callback({
      user: { upsert: userUpsert },
      booking: { updateMany: bookingUpdateMany },
    })
  );

  return {
    userUpsert,
    userFindUnique,
    bookingFindUnique,
    bookingUpdateMany,
    recordCustomerRegistrationEvidence,
    transaction,
    prisma: {
      $transaction: transaction,
      user: {
        upsert: userUpsert,
        findUnique: userFindUnique,
      },
      booking: {
        findUnique: bookingFindUnique,
        updateMany: bookingUpdateMany,
      },
    },
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/dev-registered-users", () => ({
  addRegisteredUser: vi.fn(),
}));

vi.mock("@/lib/auth-password", () => ({
  hashPassword: vi.fn(() => "hashed-customer-password"),
}));

vi.mock("@/lib/auth-credentials", () => ({
  upsertDbCredential: vi.fn(async () => ({ id: "credential-1" })),
}));

vi.mock("@/lib/auth-email-verification", () => ({
  sendOrPreviewEmailVerification: vi.fn(async () => ({
    sendResult: { ok: true },
    verificationLink: "https://beta.relianceonline.org/auth/verify-email?token=test-token",
    verificationTokenPreview: "test-token",
  })),
}));

vi.mock("@/lib/legal/customer-registration-policy-evidence", () => ({
  parseRegistrationBoolean: (value: unknown) =>
    value === true || String(value || "").trim().toLowerCase() === "true",
  recordCustomerRegistrationEvidence: hoisted.recordCustomerRegistrationEvidence,
}));

vi.mock("@/lib/geocoding", () => ({
  hasCompleteAddress: vi.fn(() => false),
  geocodeAddress: vi.fn(),
}));

function createCustomerRegisterRequest(overrides: Record<string, unknown> = {}) {
  const request = new Request("https://beta.relianceonline.org/api/customer/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Beta",
      lastName: "Customer",
      email: "beta.customer@reliance.test",
      phone: "407-555-0199",
      password: "CustomerTest1!",
      termsAccepted: true,
      privacyAcknowledged: true,
      smsConsent: false,
      address: "123 Main St",
      city: "Orlando",
      state: "Florida",
      zipCode: "32801",
      ...overrides,
    }),
  }) as Request & { nextUrl?: URL };

  request.nextUrl = new URL("https://beta.relianceonline.org/api/customer/register");
  return request as any;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe("POST /api/customer/register", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_BASE_URL", "https://beta.relianceonline.org");
    hoisted.userUpsert.mockReset();
    hoisted.userFindUnique.mockReset();
    hoisted.userFindUnique.mockResolvedValue(null);
    hoisted.bookingFindUnique.mockReset();
    hoisted.bookingUpdateMany.mockReset();
    hoisted.recordCustomerRegistrationEvidence.mockReset();
    hoisted.recordCustomerRegistrationEvidence.mockResolvedValue({ id: "evidence-1" });
    hoisted.transaction.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not return success in production when the customer account cannot be saved", async () => {
    const { addRegisteredUser } = await import("@/lib/dev-registered-users");
    const { upsertDbCredential } = await import("@/lib/auth-credentials");

    vi.mocked(addRegisteredUser).mockClear();
    vi.mocked(upsertDbCredential).mockClear();
    hoisted.userUpsert.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await POST(createCustomerRegisterRequest());
    const json = await readJson(response);

    expect(response.status).toBe(503);
    expect(json).toMatchObject({
      code: "CUSTOMER_REGISTRATION_DB_PERSISTENCE_FAILED",
    });
    expect(addRegisteredUser).not.toHaveBeenCalled();
    expect(upsertDbCredential).not.toHaveBeenCalled();
  });

  it("returns success in production only after durable user and credential records are saved", async () => {
    const { addRegisteredUser } = await import("@/lib/dev-registered-users");
    const { upsertDbCredential } = await import("@/lib/auth-credentials");

    vi.mocked(addRegisteredUser).mockClear();
    vi.mocked(upsertDbCredential).mockClear();
    hoisted.userUpsert.mockResolvedValueOnce({ id: "customer-1" });

    const response = await POST(createCustomerRegisterRequest());
    const json = await readJson(response);

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      customerId: "customer-1",
      emailVerificationRequired: true,
      emailDeliveryQueued: true,
    });
    expect(upsertDbCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "customer-1",
        email: "beta.customer@reliance.test",
      })
    );
    expect(addRegisteredUser).not.toHaveBeenCalled();
    expect(hoisted.recordCustomerRegistrationEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "customer-1",
        actorEmail: "beta.customer@reliance.test",
        smsOptIn: false,
      })
    );
  });

  it("uses the configured public origin for customer verification emails", async () => {
    const { sendOrPreviewEmailVerification } = await import(
      "@/lib/auth-email-verification"
    );
    vi.mocked(sendOrPreviewEmailVerification).mockClear();
    hoisted.userUpsert.mockResolvedValueOnce({ id: "customer-public-origin" });
    const request = createCustomerRegisterRequest();
    request.nextUrl = new URL(
      "https://internal-app-container:8080/api/customer/register"
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sendOrPreviewEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://beta.relianceonline.org",
      })
    );
  });

  it("rejects customer registration when Terms acceptance is missing", async () => {
    const response = await POST(
      createCustomerRegisterRequest({ termsAccepted: false })
    );
    const json = await readJson(response);

    expect(response.status).toBe(400);
    expect(json).toMatchObject({ code: "CUSTOMER_TERMS_ACCEPTANCE_REQUIRED" });
    expect(hoisted.userFindUnique).not.toHaveBeenCalled();
    expect(hoisted.userUpsert).not.toHaveBeenCalled();
  });

  it("rejects customer registration when Privacy acknowledgment is missing", async () => {
    const response = await POST(
      createCustomerRegisterRequest({ privacyAcknowledged: false })
    );
    const json = await readJson(response);

    expect(response.status).toBe(400);
    expect(json).toMatchObject({
      code: "CUSTOMER_PRIVACY_ACKNOWLEDGMENT_REQUIRED",
    });
    expect(hoisted.userFindUnique).not.toHaveBeenCalled();
    expect(hoisted.userUpsert).not.toHaveBeenCalled();
  });

  it("keeps SMS optional and records an affirmative opt-in when selected", async () => {
    hoisted.userUpsert.mockResolvedValueOnce({ id: "customer-sms" });

    const response = await POST(
      createCustomerRegisterRequest({ smsConsent: true })
    );

    expect(response.status).toBe(200);
    expect(hoisted.recordCustomerRegistrationEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "customer-sms",
        smsOptIn: true,
      })
    );
  });

  it("connects an emailed completed work order to the matching new customer account", async () => {
    const { sendOrPreviewEmailVerification } = await import(
      "@/lib/auth-email-verification"
    );
    vi.mocked(sendOrPreviewEmailVerification).mockClear();
    hoisted.bookingFindUnique.mockResolvedValueOnce({
      id: "booking-1",
      userId: "placeholder-1",
      customerMetadata: JSON.stringify({
        claim_status: "UNCLAIMED",
        claim_contact_email: "beta.customer@reliance.test",
      }),
      user: { email: "unclaimed+booking-1@reliance.local" },
    });
    hoisted.userUpsert.mockResolvedValueOnce({ id: "customer-1" });
    hoisted.bookingUpdateMany.mockResolvedValueOnce({ count: 1 });
    const nextPath = "/my-bookings/booking-1?videoReady=1";

    const response = await POST(
      createCustomerRegisterRequest({ registrationNextPath: nextPath })
    );

    expect(response.status).toBe(200);
    expect(hoisted.bookingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "booking-1", userId: "placeholder-1" },
        data: expect.objectContaining({ userId: "customer-1" }),
      })
    );
    expect(sendOrPreviewEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({ nextPath })
    );
    const updateData = hoisted.bookingUpdateMany.mock.calls[0][0].data;
    expect(JSON.parse(updateData.customerMetadata)).toMatchObject({
      claim_status: "CLAIMED",
      customer_account_linked: true,
      linked_customer_user_id: "customer-1",
    });
  });

  it("restores a deactivated customer identity and keeps its already-linked service record", async () => {
    const { upsertDbCredential } = await import("@/lib/auth-credentials");
    vi.mocked(upsertDbCredential).mockClear();
    hoisted.userFindUnique.mockResolvedValueOnce({
      id: "customer-deactivated",
      email: "beta.customer@reliance.test",
      phone: "407-555-0199",
      accountStatus: "deactivated",
    });
    hoisted.bookingFindUnique.mockResolvedValueOnce({
      id: "booking-1",
      userId: "customer-deactivated",
      customerMetadata: JSON.stringify({
        claim_status: "CLAIMED",
        claim_contact_email: "beta.customer@reliance.test",
        linked_customer_user_id: "customer-deactivated",
      }),
      user: { email: "beta.customer@reliance.test" },
    });
    hoisted.userUpsert.mockResolvedValueOnce({ id: "customer-deactivated" });

    const response = await POST(
      createCustomerRegisterRequest({
        registrationNextPath: "/my-bookings/booking-1?videoReady=1",
      })
    );
    const json = await readJson(response);

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      customerId: "customer-deactivated",
      accountRestored: true,
      emailVerificationRequired: true,
    });
    expect(hoisted.userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "beta.customer@reliance.test" },
        update: expect.objectContaining({
          accountStatus: "active",
          accountStatusReason: null,
          accountStatusAdminNotes: null,
        }),
      })
    );
    expect(upsertDbCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "customer-deactivated",
        emailVerifiedAt: null,
      })
    );
    expect(hoisted.bookingUpdateMany).not.toHaveBeenCalled();
  });

  it("does not overwrite an existing active account through registration", async () => {
    hoisted.userFindUnique.mockResolvedValueOnce({
      id: "customer-active",
      email: "beta.customer@reliance.test",
      phone: "407-555-0199",
      accountStatus: "active",
    });

    const response = await POST(createCustomerRegisterRequest());
    const json = await readJson(response);

    expect(response.status).toBe(409);
    expect(json).toMatchObject({
      code: "CUSTOMER_ACCOUNT_ALREADY_EXISTS",
    });
    expect(hoisted.userUpsert).not.toHaveBeenCalled();
  });
});
