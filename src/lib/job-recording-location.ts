import { prisma } from "@/server/db";
import { distanceMeters, hasValidCoordinates } from "@/lib/distance";
import { geocodeAddress, hasCompleteAddress } from "@/lib/geocoding";

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
  | { ok: true; location: "business" | "customer-business"; distanceMeters: number }
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

async function resolveVendorLocation(vendorId: string, location: VendorLocation | null) {
  if (!location) return null;
  if (location.geocodedAt && hasValidCoordinates(location)) return location;
  if (!hasCompleteAddress(location)) return location;
  const result = await geocodeAddress(location);
  if (result.status !== "success") return location;
  await prisma.vendor.update({
    where: { id: vendorId },
    data: { latitude: result.latitude, longitude: result.longitude, geocodedAt: result.geocodedAt },
  });
  return { ...location, latitude: result.latitude, longitude: result.longitude, geocodedAt: result.geocodedAt };
}

function customerBusinessLocation(metadataValue: string | null | undefined): VendorLocation | null {
  const metadata = parseMetadata(metadataValue);
  const location = {
    address: String(metadata.vendor_job_customer_business_address || "").trim() || null,
    city: String(metadata.vendor_job_customer_business_city || "").trim() || null,
    state: String(metadata.vendor_job_customer_business_state || "").trim() || null,
    zipCode: String(metadata.vendor_job_customer_business_zip_code || "").trim() || null,
    latitude: finite(metadata.vendor_job_customer_business_latitude),
    longitude: finite(metadata.vendor_job_customer_business_longitude),
    geocodedAt: metadata.vendor_job_customer_business_geocoded_at
      ? new Date(String(metadata.vendor_job_customer_business_geocoded_at))
      : null,
  };
  return hasCompleteAddress(location) ? location : null;
}

function recordingLocationSnapshot(
  metadataValue: string | null | undefined,
  expectedType: "business" | "customer-business"
): VendorLocation | null {
  const metadata = parseMetadata(metadataValue);
  const raw = metadata.vendor_job_recording_location_snapshot;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const snapshot = raw as Record<string, unknown>;
  if (locationChoice(snapshot.type) !== expectedType) return null;
  const location = {
    address: String(snapshot.address || "").trim() || null,
    city: String(snapshot.city || "").trim() || null,
    state: String(snapshot.state || "").trim() || null,
    zipCode: String(snapshot.zip_code || snapshot.zipCode || "").trim() || null,
    latitude: finite(snapshot.latitude),
    longitude: finite(snapshot.longitude),
    geocodedAt: snapshot.geocoded_at ? new Date(String(snapshot.geocoded_at)) : null,
  };
  return hasCompleteAddress(location) || hasValidCoordinates(location) ? location : null;
}

async function resolveImmutableSnapshotLocation(location: VendorLocation | null) {
  if (!location) return null;
  if (hasValidCoordinates(location)) return location;
  if (!hasCompleteAddress(location)) return location;
  const result = await geocodeAddress(location);
  if (result.status !== "success") return location;
  return {
    ...location,
    latitude: result.latitude,
    longitude: result.longitude,
    geocodedAt: result.geocodedAt,
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
  const location = locationChoice(metadata.vendor_job_recording_location) || locationChoice(input.location);
  if (location !== "business" && location !== "customer-business") {
    return { ok: false, status: 422, code: "LOCATION_VERIFICATION_NOT_REQUIRED", message: "This service order does not require business-location verification." };
  }

  const immutableSnapshot = recordingLocationSnapshot(input.metadata, location);
  const expected = immutableSnapshot
    ? await resolveImmutableSnapshotLocation(immutableSnapshot)
    : location === "business"
      ? await resolveVendorLocation(input.vendorId, input.vendorLocation)
      : customerBusinessLocation(input.metadata);
  const label = location === "business" ? "registered vendor business address" : "customer business address";
  if (!expected || !hasValidCoordinates(expected)) {
    return {
      ok: false,
      status: 409,
      code: location === "business" ? "BUSINESS_LOCATION_NOT_CONFIGURED" : "CUSTOMER_BUSINESS_LOCATION_NOT_CONFIGURED",
      message: `The ${label} must be verified before recording can begin.`,
    };
  }
  if (input.proof.latitude == null || input.proof.longitude == null || input.proof.accuracyMeters == null) {
    return { ok: false, status: 409, code: "BUSINESS_LOCATION_PROOF_REQUIRED", message: `Allow location access so Reliance can confirm this device is at the ${label}.` };
  }
  const distance = distanceMeters(
    { latitude: input.proof.latitude, longitude: input.proof.longitude },
    { latitude: expected.latitude!, longitude: expected.longitude! }
  );
  if (input.proof.accuracyMeters > RECORDING_LOCATION_MAX_ACCURACY_METERS) {
    return {
      ok: false,
      status: 409,
      code:
        location === "business"
          ? "BUSINESS_LOCATION_ACCURACY_TOO_LOW"
          : "CUSTOMER_BUSINESS_LOCATION_ACCURACY_TOO_LOW",
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
      code: location === "business" ? "BUSINESS_LOCATION_MISMATCH" : "CUSTOMER_BUSINESS_LOCATION_MISMATCH",
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
