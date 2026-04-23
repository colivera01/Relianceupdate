/**
 * Map Prisma / DB errors from MediaSession.create into HTTP responses for POST /media/sessions.
 */
export function mapMediaSessionCreateFailure(error: unknown): {
  status: number;
  body: {
    success: false;
    code: string;
    message: string;
    details?: string;
    prismaCode?: string;
  };
} {
  const err = error as Record<string, unknown> | null;
  const msg = String(err?.message ?? error ?? "");
  const prismaCode = String(err?.code ?? "");
  const name = String(err?.name ?? "");
  const isDev = process.env.NODE_ENV !== "production";

  if (msg.includes("Unknown argument") && msg.includes("vendorJobVideoStage")) {
    return {
      status: 503,
      body: {
        success: false,
        code: "PRISMA_CLIENT_STALE",
        message:
          "The Prisma Client is out of sync with the schema (unknown field vendorJobVideoStage). Run `npx prisma generate` from the project root, then restart the dev server.",
        ...(isDev ? { details: msg } : {}),
      },
    };
  }

  if (/invalid column name/i.test(msg) && /vendorJobVideoStage/i.test(msg)) {
    return {
      status: 503,
      body: {
        success: false,
        code: "DB_COLUMN_MISSING_VENDOR_JOB_VIDEO_STAGE",
        message:
          "The database table media_sessions is missing column vendorJobVideoStage. Apply the migration prisma/migrations/20260422130000_media_session_vendor_job_video_stage/migration.sql (or run prisma migrate deploy), then retry.",
        ...(isDev ? { details: msg } : {}),
      },
    };
  }

  if (name === "PrismaClientKnownRequestError" && prismaCode === "P2003") {
    return {
      status: 400,
      body: {
        success: false,
        code: "FOREIGN_KEY_VIOLATION",
        message:
          "Media session create failed a foreign-key check (e.g. userId, bookingId, or serviceId does not exist or does not belong to this vendor).",
        ...(isDev ? { details: msg, prismaCode } : {}),
      },
    };
  }

  return {
    status: 500,
    body: {
      success: false,
      code: "MEDIA_SESSION_CREATE_FAILED",
      message: "Failed to create media session.",
      ...(isDev ? { details: msg, prismaCode: prismaCode || undefined } : {}),
    },
  };
}
