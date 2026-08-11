import { prisma } from "@/server/db";
import { distanceMeters } from "@/lib/distance";
import {
  normalizeRecordingLocationChoice,
  validateRecordingLocationSnapshot,
} from "@/lib/job-assignment";

export const RECORDING_LOCATION_RADIUS_METERS = 150;
export const RECORDING_LOCATION_MAX_ACCURACY_METERS = 500;

export type RecordingLocationProof = {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  capturedAt?: string | null;
};

type VendorLocation = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocodedAt?: Date | null;
};

export type RecordingLocationVerification =
  | { ok: true; location: "business" | "residence" | "customer-business"; distanceMeters: number }
  | { ok: false; status: number; code: string; message: string; details?: Record<string, number> };

function finite(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function locationChoice(value: unknown): "business" | "residence" | "customer-business" | null {
  const normalized = String(value || "").trim().toLowerCase().replace(/_/g, "-");
  return normalized === "business" || normalized === "residence" || normalized === "customer-business"
    ? normalized
    : null;
}

export function parseRecordingLocationProof(body: Record<string, unknown>): RecordingLocationProof {
  const nested =
    body.locationProof && typeof body.locationProof === "object" && !Array.isArray(body.locationProof)
      ? (body.locationProof as Record<string, unknown>)
      : {};
  return {
    latitude: finite(nested.latitude ?? body.latitude ?? body.geoLatitude),
    longitude: finite(nested.longitude ?? body.longitude ?? body.geoLongitude),
    accuracyMeters: finite(
      nested.accuracyMeters ?? nested.accuracy ?? body.accuracyMeters ?? body.geoAccuracyMeters
    ),
    capturedAt: String(nested.capturedAt ?? body.locationCapturedAt ?? "").trim() || null,
  };
}

export async function verifyJobRecordingLocation(input: {
  vendorId: string;
  metadata: string | null | undefined;
  vendorLocation: VendorLocation | null;
  proof: RecordingLocationProof;
  location?: unknown;
}): Promise<RecordingLocationVerification> {
  const metadata = parseMetadata(input.metadata);
  const location =
    normalizeRecordingLocationChoice(metadata.vendor_job_recording_location) ||
    locationChoice(input.location);
  if (!location) {
    return { ok: false, status: 422, code: "RECORDING_LOCATION_REQUIRED", message: "Choose the service location before verifying this device." };
  }

  const snapshotValidation = validateRecordingLocationSnapshot(input.metadata, location);
  const expected = snapshotValidation.ok ? snapshotValidation.snapshot : null;
  const label =
    location === "business"
      ? "saved vendor business address"
      : location === "customer-business"
        ? "saved customer business address"
        : "saved customer residence";
  const codePrefix =
    location === "business"
      ? "BUSINESS_LOCATION"
      : location === "customer-business"
        ? "CUSTOMER_BUSINESS_LOCATION"
        : "CUSTOMER_RESIDENCE_LOCATION";
  if (!expected) {
    return {
      ok: false,
      status: 409,
      code:
        location === "business"
          ? "BUSINESS_LOCATION_NOT_CONFIGURED"
          : location === "customer-business"
            ? "CUSTOMER_BUSINESS_LOCATION_NOT_CONFIGURED"
            : "CUSTOMER_RESIDENCE_LOCATION_NOT_CONFIGURED",
      message: `The ${label} is missing a matching verified work-record snapshot. The vendor manager must correct the work record before recording can begin.`,
    };
  }
  if (input.proof.latitude == null || input.proof.longitude == null || input.proof.accuracyMeters == null) {
    return { ok: false, status: 409, code: `${codePrefix}_PROOF_REQUIRED`, message: `Allow precise location so Reliance can confirm this device is at the ${label}.` };
  }
  const distance = distanceMeters(
    { latitude: input.proof.latitude, longitude: input.proof.longitude },
    { latitude: expected.latitude, longitude: expected.longitude }
  );
  if (input.proof.accuracyMeters > RECORDING_LOCATION_MAX_ACCURACY_METERS) {
    return {
      ok: false,
      status: 409,
      code: `${codePrefix}_ACCURACY_TOO_LOW`,
      message: `The phone's location signal is not precise enough to verify the ${label}. Turn on precise location, move near a window or outdoors, and try again.`,
      details: {
        allowedRadiusMeters: RECORDING_LOCATION_RADIUS_METERS,
        maxAccuracyMeters: RECORDING_LOCATION_MAX_ACCURACY_METERS,
        distanceMeters: Math.round(distance),
        accuracyMeters: Math.round(input.proof.accuracyMeters),
      },
    };
  }

  // Browser geolocation reports a point plus an uncertainty radius. Compare the
  // nearest plausible device position so ordinary indoor GPS drift does not look
  // like the employee is at a different address.
  const nearestPossibleDistance = Math.max(0, distance - input.proof.accuracyMeters);
  if (nearestPossibleDistance > RECORDING_LOCATION_RADIUS_METERS) {
    return {
      ok: false,
      status: 403,
      code: `${codePrefix}_MISMATCH`,
      message: `This device is not close enough to the ${label}. Recording cannot begin at this location.`,
      details: {
        allowedRadiusMeters: RECORDING_LOCATION_RADIUS_METERS,
        maxAccuracyMeters: RECORDING_LOCATION_MAX_ACCURACY_METERS,
        distanceMeters: Math.round(distance),
        accuracyMeters: Math.round(input.proof.accuracyMeters),
        nearestPossibleDistanceMeters: Math.round(nearestPossibleDistance),
      },
    };
  }
  return { ok: true, location, distanceMeters: distance };
}

export async function recordJobRecordingLocationAttempt(input: {
  bookingId: string;
  vendorId: string;
  membershipId: string | null;
  assessmentId: string;
  actorUserId: string | null;
  proof: RecordingLocationProof;
  result: RecordingLocationVerification;
}) {
  return prisma.recordingLocationAttempt.create({
    data: {
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      membershipId: input.membershipId,
      assessmentId: input.assessmentId,
      actorUserId: input.actorUserId,
      status: input.result.ok ? "VERIFIED" : "FAILED",
      resultCode: input.result.ok ? "LOCATION_VERIFIED" : input.result.code,
      distanceMeters: input.result.ok
        ? Math.round(input.result.distanceMeters)
        : input.result.details?.distanceMeters ?? null,
      accuracyMeters:
        input.proof.accuracyMeters == null ? null : Math.round(input.proof.accuracyMeters),
    },
  });
}
