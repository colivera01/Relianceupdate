const crypto = require("crypto");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const BOOKING_ID = process.env.AI_SMOKE_BOOKING_ID || "cmpv8a5nl0007sob42f84wtp9";
const REPORT_ID = process.env.AI_SMOKE_REPORT_ID || "cmpwtdz870000so184m28t1ul";
const ADMIN_USER_ID =
  process.env.AI_SMOKE_ADMIN_USER_ID || "D43B6BB3-1A72-45EC-A362-A6E1E0580EA0";
const ADMIN_EMAIL = process.env.AI_SMOKE_ADMIN_EMAIL || "colivera080124@gmail.com";
const SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET || "reliance-dev-session-secret-change-me";

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createSignedAdminBearerToken() {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    userId: ADMIN_USER_ID,
    email: ADMIN_EMAIL,
    userType: "admin",
    availableProfiles: ["admin", "customer"],
    issuedAt: now,
    expiresAt: now + 60 * 60 * 24 * 7,
    version: 1,
  };
  const payload = base64Url(JSON.stringify(claims));
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${payload}.${signature}`;
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function run() {
  const token = createSignedAdminBearerToken();
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const moderationResponse = await fetch(
    `${BASE_URL}/api/admin/media/packages/${BOOKING_ID}/assist`,
    {
      method: "POST",
      headers,
    }
  );
  const moderationJson = await readJson(moderationResponse);

  const disputeResponse = await fetch(
    `${BASE_URL}/api/admin/reported-content/${REPORT_ID}/assist`,
    {
      method: "POST",
      headers,
    }
  );
  const disputeJson = await readJson(disputeResponse);

  console.log(
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        moderation: {
          status: moderationResponse.status,
          success: moderationJson?.success ?? false,
          code: moderationJson?.code ?? null,
          model: moderationJson?.model ?? null,
          promptVersion: moderationJson?.promptVersion ?? null,
          decision: moderationJson?.suggestion?.decision ?? null,
          confidence: moderationJson?.suggestion?.confidence ?? null,
        },
        dispute: {
          status: disputeResponse.status,
          success: disputeJson?.success ?? false,
          code: disputeJson?.code ?? null,
          model: disputeJson?.model ?? null,
          promptVersion: disputeJson?.promptVersion ?? null,
          nextStep: disputeJson?.suggestion?.recommendedNextStep ?? null,
          confidence: disputeJson?.suggestion?.confidence ?? null,
        },
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
