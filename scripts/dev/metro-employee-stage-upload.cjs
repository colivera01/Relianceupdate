/**
 * Metro employee stage upload helper.
 *
 * Mirrors the employee/jobs UI HTTP sequence without requiring a local Prisma
 * database connection:
 * 1. POST /api/vendors/:vendorId/media/sessions
 * 2. POST /api/vendors/:vendorId/media/upload/init
 * 3. PUT blob to SAS URL
 * 4. POST /api/vendors/:vendorId/media/upload/complete
 * 5. POST /api/employee/jobs/:bookingId/stage
 *
 * Usage:
 *   node scripts/dev/metro-employee-stage-upload.cjs [bookingId] [INTRO|IN_PROGRESS|COMPLETED] [locationContext] [consentToken]
 */
const fs = require("fs");
const path = require("path");

const BOOKING_ID = process.argv[2] || "cmpqjtyxx0002so6gxa6z1td4";
const STAGE = String(process.argv[3] || "INTRO").trim().toUpperCase();
const LOCATION_CONTEXT = String(process.argv[4] || "business").trim().toLowerCase();
const CONSENT_TOKEN = String(process.argv[5] || "").trim();
const METRO_VENDOR = "cmnvdegk60000sop8sj18nud2";
const BASE = process.env.APP_BASE_URL || "http://localhost:3000";
const DEV_EMPLOYEE_USER_ID = "e2e-trust-employee";
const STAGE_FILE = path.join(__dirname, ".tmp", "metro-intro.mp4");

if (!["INTRO", "IN_PROGRESS", "COMPLETED"].includes(STAGE)) {
  throw new Error(`Unsupported stage "${STAGE}"`);
}
if (!["business", "residence", "customer-business"].includes(LOCATION_CONTEXT)) {
  throw new Error(`Unsupported locationContext "${LOCATION_CONTEXT}"`);
}
if (!fs.existsSync(STAGE_FILE)) {
  throw new Error(`Missing sample file: ${STAGE_FILE}`);
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function main() {
  const bytes = fs.statSync(STAGE_FILE).size;
  const headers = {
    "Content-Type": "application/json",
    "x-user-id": DEV_EMPLOYEE_USER_ID,
  };

  const sessionRes = await fetchJson(`${BASE}/api/vendors/${METRO_VENDOR}/media/sessions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bookingId: BOOKING_ID,
      vendorJobVideoStage: STAGE,
      sessionType: "JOB_SERVICE_VIDEO",
      replaceExisting: true,
      locationContext: LOCATION_CONTEXT,
      consentAccepted: LOCATION_CONTEXT === "business" ? false : Boolean(CONSENT_TOKEN),
      consentToken: LOCATION_CONTEXT === "business" ? undefined : CONSENT_TOKEN,
      deviceType: "PHONE",
    }),
  });
  if (!sessionRes.res.ok) {
    throw new Error(`session create failed: ${sessionRes.res.status} ${JSON.stringify(sessionRes.json)}`);
  }
  const mediaSessionId = String(sessionRes.json?.session?.id || "");
  if (!mediaSessionId) throw new Error("No mediaSessionId returned");

  const initRes = await fetchJson(`${BASE}/api/vendors/${METRO_VENDOR}/media/upload/init`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fileName: `metro-${STAGE.toLowerCase()}.mp4`,
      expectedBytes: bytes,
      mimeType: "video/mp4",
    }),
  });
  if (!initRes.res.ok) {
    throw new Error(`upload init failed: ${initRes.res.status} ${JSON.stringify(initRes.json)}`);
  }
  const { sasUrl, assetId, blobKey } = initRes.json;
  if (!sasUrl || !assetId || !blobKey) throw new Error("init missing sasUrl/assetId/blobKey");

  const blob = fs.readFileSync(STAGE_FILE);
  const putRes = await fetch(String(sasUrl), {
    method: "PUT",
    headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": "video/mp4" },
    body: blob,
  });
  if (!putRes.ok) throw new Error(`blob PUT failed (${putRes.status})`);

  const completeRes = await fetchJson(`${BASE}/api/vendors/${METRO_VENDOR}/media/upload/complete`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      assetId,
      blobKey,
      blobUrl: null,
      bytes,
      mimeType: "video/mp4",
      mediaSessionId,
      durationSeconds: 5,
    }),
  });
  if (!completeRes.res.ok || !completeRes.json?.success) {
    throw new Error(`upload complete failed: ${completeRes.res.status} ${JSON.stringify(completeRes.json)}`);
  }

  const stageRes = await fetchJson(`${BASE}/api/employee/jobs/${BOOKING_ID}/stage`, {
    method: "POST",
    headers,
    body: JSON.stringify({ stage: STAGE }),
  });
  if (!stageRes.res.ok || !stageRes.json?.success) {
    throw new Error(`stage POST failed: ${stageRes.res.status} ${JSON.stringify(stageRes.json)}`);
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        bookingId: BOOKING_ID,
        stage: STAGE,
        mediaSessionId,
        assetId,
        stageResponse: stageRes.json,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
