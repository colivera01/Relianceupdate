import crypto from "node:crypto";
import {
  AI_EVAL_TEMP_REPORT_REASON,
  disputeEvalCase,
  moderationEvalCases,
  vendorCoachingEvalCase,
} from "../../src/lib/ai/eval-fixtures";
import {
  evaluateDisputeSummaryExpectation,
  evaluateModerationAssistantExpectation,
  evaluateVendorCoachingSummaryExpectation,
} from "../../src/lib/ai/evals";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET || "reliance-dev-session-secret-change-me";
const ADMIN_USER_ID =
  process.env.AI_EVAL_ADMIN_USER_ID || "D43B6BB3-1A72-45EC-A362-A6E1E0580EA0";
const ADMIN_EMAIL =
  process.env.AI_EVAL_ADMIN_EMAIL || "colivera080124@gmail.com";
const CUSTOMER_USER_ID =
  process.env.AI_EVAL_CUSTOMER_USER_ID || "e2e-smoke-customer";
const CUSTOMER_EMAIL =
  process.env.AI_EVAL_CUSTOMER_EMAIL || "e2e-smoke-customer@reliance.test";
const VENDOR_USER_ID =
  process.env.AI_EVAL_VENDOR_USER_ID || "cmohivpc60000sorokbuehp94";
const VENDOR_EMAIL =
  process.env.AI_EVAL_VENDOR_EMAIL || "e2e-trust-manager@reliance.test";
const VENDOR_ID =
  process.env.AI_EVAL_VENDOR_ID || "cmnvdegk60000sop8sj18nud2";

function base64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createSignedBearerToken(claims: Record<string, unknown>) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    JSON.stringify({
      issuedAt: now,
      expiresAt: now + 60 * 60,
      version: 1,
      ...claims,
    })
  );
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${payload}.${signature}`;
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, any>;
  } catch {
    return { raw: text };
  }
}

async function requestJson(
  url: string,
  init: RequestInit = {},
  attempts = 3
): Promise<{ response: Response; json: Record<string, any> }> {
  let last!: { response: Response; json: Record<string, any> };

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, init);
    const json = await readJson(response);
    last = { response, json };
    if (response.status !== 503 && response.status !== 500) {
      return last;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    }
  }

  return last;
}

async function dismissReport(reportId: string, adminToken: string) {
  return requestJson(`${BASE_URL}/api/admin/reported-content`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      reportId,
      status: "dismissed",
      resolutionNotes: disputeEvalCase.dismissResolutionNotes,
    }),
  });
}

async function cleanupStaleEvalReports(adminToken: string) {
  const lookup = await requestJson(
    `${BASE_URL}/api/admin/reported-content?includeInternal=1&q=${encodeURIComponent(
      AI_EVAL_TEMP_REPORT_REASON
    )}&limit=25`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    }
  );

  const cleaned: Array<{ reportId: string; status: number; finalStatus: string | null }> = [];
  for (const report of lookup.json?.reports || []) {
    if (report?.status === "dismissed") continue;
    const dismiss = await dismissReport(String(report.id), adminToken);
    cleaned.push({
      reportId: String(report.id),
      status: dismiss.response.status,
      finalStatus: dismiss.json?.report?.status ?? null,
    });
  }

  return cleaned;
}

async function runModerationEval(adminToken: string) {
  const cases = [];

  for (const testCase of moderationEvalCases) {
    const assist = await requestJson(
      `${BASE_URL}/api/admin/media/packages/${testCase.bookingId}/assist`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    if (!assist.response.ok) {
      cases.push({
        id: testCase.id,
        bookingId: testCase.bookingId,
        passed: false,
        failures: [`HTTP ${assist.response.status}`],
        status: assist.response.status,
        body: assist.json,
      });
      continue;
    }

    const evaluation = evaluateModerationAssistantExpectation(
      assist.json.suggestion,
      testCase.expectation
    );

    cases.push({
      id: testCase.id,
      bookingId: testCase.bookingId,
      status: assist.response.status,
      model: assist.json.model ?? null,
      promptVersion: assist.json.promptVersion ?? null,
      decision: assist.json.suggestion?.decision ?? null,
      confidence: assist.json.suggestion?.confidence ?? null,
      passed: evaluation.passed,
      failures: evaluation.failures,
    });
  }

  return cases;
}

async function runDisputeEval(adminToken: string, customerToken: string) {
  const create = await requestJson(`${BASE_URL}/api/reports/content`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify(disputeEvalCase.createPayload),
  });

  if (!create.response.ok) {
    return {
      createdReportId: null,
      status: create.response.status,
      passed: false,
      failures: [`Report creation failed with HTTP ${create.response.status}`],
      body: create.json,
      dismissed: null,
    };
  }

  const reportId = String(create.json?.report?.id || create.json?.reportId || "");
  let dismissed: { status: number; finalStatus: string | null } | null = null;
  let result:
    | Record<string, any>
    | null = null;

  try {
    const assist = await requestJson(
      `${BASE_URL}/api/admin/reported-content/${reportId}/assist`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    if (!assist.response.ok) {
      result = {
        createdReportId: reportId,
        status: assist.response.status,
        passed: false,
        failures: [`Assist route failed with HTTP ${assist.response.status}`],
        body: assist.json,
      };
      return result;
    }

    const evaluation = evaluateDisputeSummaryExpectation(
      assist.json.suggestion,
      disputeEvalCase.expectation
    );

    result = {
      id: disputeEvalCase.id,
      createdReportId: reportId,
      status: assist.response.status,
      model: assist.json.model ?? null,
      promptVersion: assist.json.promptVersion ?? null,
      nextStep: assist.json.suggestion?.recommendedNextStep ?? null,
      confidence: assist.json.suggestion?.confidence ?? null,
      passed: evaluation.passed,
      failures: evaluation.failures,
    };
    return result;
  } finally {
    const dismiss = await dismissReport(reportId, adminToken);
    dismissed = {
      status: dismiss.response.status,
      finalStatus: dismiss.json?.report?.status ?? null,
    };
    if (result) {
      result.dismissed = dismissed;
    }
  }
}

async function runVendorCoachingEval() {
  const assist = await requestJson(`${BASE_URL}/api/vendor/coaching-summary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": VENDOR_USER_ID,
      "x-vendor-id": VENDOR_ID,
      Authorization: `Bearer ${createSignedBearerToken({
        userId: VENDOR_USER_ID,
        email: VENDOR_EMAIL,
        userType: "vendor",
        availableProfiles: ["vendor"],
      })}`,
    },
    body: JSON.stringify(vendorCoachingEvalCase.requestBody),
  });

  if (!assist.response.ok) {
    return {
      id: vendorCoachingEvalCase.id,
      status: assist.response.status,
      passed: false,
      failures: [`Assist route failed with HTTP ${assist.response.status}`],
      body: assist.json,
    };
  }

  const evaluation = evaluateVendorCoachingSummaryExpectation(
    assist.json.suggestion,
    vendorCoachingEvalCase.expectation
  );

  return {
    id: vendorCoachingEvalCase.id,
    status: assist.response.status,
    model: assist.json.model ?? null,
    promptVersion: assist.json.promptVersion ?? null,
    confidence: assist.json.suggestion?.confidence ?? null,
    priorityHeadline: assist.json.suggestion?.priorityHeadline ?? null,
    passed: evaluation.passed,
    failures: evaluation.failures,
  };
}

async function main() {
  const adminToken = createSignedBearerToken({
    userId: ADMIN_USER_ID,
    email: ADMIN_EMAIL,
    userType: "admin",
    availableProfiles: ["admin", "customer"],
  });

  const customerToken = createSignedBearerToken({
    userId: CUSTOMER_USER_ID,
    email: CUSTOMER_EMAIL,
    userType: "customer",
    availableProfiles: ["customer"],
  });

  const cleaned = await cleanupStaleEvalReports(adminToken);
  const moderation = await runModerationEval(adminToken);
  const dispute = await runDisputeEval(adminToken, customerToken);
  const vendorCoaching = await runVendorCoachingEval();

  const allCases = [...moderation, dispute, vendorCoaching];
  const passedCount = allCases.filter((item) => item.passed).length;
  const failedCases = allCases.filter((item) => !item.passed);

  const summary = {
    baseUrl: BASE_URL,
    cleaned,
    counts: {
      total: allCases.length,
      passed: passedCount,
      failed: failedCases.length,
    },
    moderation,
    dispute,
    vendorCoaching,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failedCases.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
