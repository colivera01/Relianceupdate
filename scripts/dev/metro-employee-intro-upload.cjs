/**
 * Employee INTRO video upload for Metro audit job — mirrors employee/jobs UI API sequence.
 * Usage: node scripts/dev/metro-employee-intro-upload.cjs [bookingId]
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const BOOKING_ID = process.argv[2] || "cmpqjtyxx0002so6gxa6z1td4";
const METRO_VENDOR = "cmnvdegk60000sop8sj18nud2";
const EMPLOYEE_EMAIL = "e2e-trust-employee@reliance.test";
const BASE = process.env.APP_BASE_URL || "http://localhost:3000";
const SAMPLE_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const prisma = new PrismaClient();

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function main() {
  const employee = await prisma.user.findUnique({
    where: { email: EMPLOYEE_EMAIL },
    select: { id: true, name: true },
  });
  if (!employee) throw new Error("Employee user not found");

  const tmpDir = path.join(__dirname, ".tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  const videoPath = path.join(tmpDir, "metro-intro.mp4");
  if (!fs.existsSync(videoPath)) {
    const sampleRes = await fetch(SAMPLE_URL);
    if (!sampleRes.ok) throw new Error(`Failed to download sample video (${sampleRes.status})`);
    fs.writeFileSync(videoPath, Buffer.from(await sampleRes.arrayBuffer()));
  }
  const bytes = fs.statSync(videoPath).size;
  const headers = {
    "Content-Type": "application/json",
    "x-user-id": employee.id,
  };

  const sessionRes = await fetchJson(`${BASE}/api/vendors/${METRO_VENDOR}/media/sessions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bookingId: BOOKING_ID,
      vendorJobVideoStage: "INTRO",
      sessionType: "JOB_SERVICE_VIDEO",
      replaceExisting: true,
      locationContext: "business",
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
      fileName: "metro-intro.mp4",
      expectedBytes: bytes,
      mimeType: "video/mp4",
    }),
  });
  if (!initRes.res.ok) {
    throw new Error(`upload init failed: ${initRes.res.status} ${JSON.stringify(initRes.json)}`);
  }
  const { sasUrl, assetId, blobKey } = initRes.json;
  if (!sasUrl || !assetId || !blobKey) throw new Error("init missing sasUrl/assetId/blobKey");

  const blob = fs.readFileSync(videoPath);
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
    body: JSON.stringify({ stage: "INTRO" }),
  });
  if (!stageRes.res.ok || !stageRes.json?.success) {
    throw new Error(`stage POST failed: ${stageRes.res.status} ${JSON.stringify(stageRes.json)}`);
  }

  const booking = await prisma.booking.findUnique({
    where: { id: BOOKING_ID },
    select: { status: true, customerMetadata: true },
  });
  const sessions = await prisma.mediaSession.findMany({
    where: { bookingId: BOOKING_ID, vendorJobVideoStage: "INTRO" },
    select: {
      id: true,
      vendorJobVideoStage: true,
      mediaAssets: { where: { deletedAt: null }, select: { id: true, moderationStatus: true } },
    },
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        bookingId: BOOKING_ID,
        employeeUserId: employee.id,
        mediaSessionId,
        assetId,
        bookingStatus: booking?.status,
        introSessions: sessions,
        stageResponse: stageRes.json,
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
