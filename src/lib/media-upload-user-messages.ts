/**
 * Vendor-facing copy for media upload / session API failures.
 * Prefer `code` from JSON when present; avoid exposing raw 500 bodies.
 */

type ApiErrBody = {
  success?: boolean;
  code?: string;
  message?: string;
  error?: string;
  details?: string;
};

/** Known POST /media/sessions and related codes → short vendor copy. */
const VENDOR_MEDIA_CODE_MESSAGES: Record<string, string> = {
  VENDOR_JOB_VIDEO_STAGE_REQUIRED:
    "Choose a video stage (Intro, In Progress, or Completed) before uploading.",
  VENDOR_JOB_VIDEO_BOOKING_REQUIRED:
    "This upload must be tied to a job we can load from your dashboard. Re-open the job from the list and try again.",
  JOB_ASSIGNMENT_REQUIRED:
    "Assign this job before uploading service videos.",
  COMPLIANCE_LOCATION_REQUIRED:
    "Complete Legal Compliance by selecting where recording will occur before uploading.",
  CONSENT_REQUIRED:
    "Customer consent must be accepted before recording can proceed.",
  INVALID_SESSION_STATUS: "The upload session could not be updated. Close the dialog and try again.",
  UNAUTHORIZED: "Your session expired or you do not have access to this vendor. Sign in again.",
  PRISMA_CLIENT_STALE:
    "The app’s database client is out of date. Stop the dev server, run `npx prisma generate`, then restart.",
  DB_COLUMN_MISSING_VENDOR_JOB_VIDEO_STAGE:
    "The database is missing support for staged job videos. Ask an admin to apply the latest migration, then retry.",
  FOREIGN_KEY_VIOLATION:
    "We could not link this upload to your vendor or job. Confirm the job still exists and try again.",
  MEDIA_SESSION_CREATE_FAILED: "We could not start your upload. Please try again in a moment.",
  MEDIA_STORAGE_UNAVAILABLE:
    "Secure video storage is temporarily unavailable. Please try again shortly. If it keeps happening, contact support.",
};

export function getVendorMediaApiUserMessage(parsed: unknown, status: number): string {
  const p = parsed as ApiErrBody | null;
  const code = p?.code ? String(p.code).trim() : "";
  const serverMsg = typeof p?.message === "string" ? p.message.trim() : "";
  const legacyErr = typeof p?.error === "string" ? p.error.trim() : "";

  if (code === "JOB_VIDEO_STAGE_OCCUPIED") {
    return (
      serverMsg ||
      "This job already has a video for that stage. Pick another stage or turn on “Replace existing…”."
    );
  }

  if (code && VENDOR_MEDIA_CODE_MESSAGES[code]) {
    return VENDOR_MEDIA_CODE_MESSAGES[code];
  }

  if (serverMsg && !/^failed to create media session\.?$/i.test(serverMsg)) {
    return serverMsg;
  }

  if (legacyErr && !/^internal server error$/i.test(legacyErr)) {
    return legacyErr;
  }

  if (status === 403) {
    return "You do not have permission to upload for this vendor.";
  }
  if (status === 404) {
    return "The upload service was not found. Refresh the page and try again.";
  }
  if (status === 409) {
    return "This action conflicts with the current job or file. Change the stage or enable replacement, then retry.";
  }
  if (status === 422) {
    return serverMsg || "Some upload details were invalid. Check the form and try again.";
  }
  if (status >= 500) {
    return "The upload service is temporarily unavailable. Please try again shortly. If the problem continues, contact support.";
  }

  return serverMsg || "Something went wrong during upload. Please try again.";
}
