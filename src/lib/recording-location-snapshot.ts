import { createHash } from 'node:crypto';
import type { GeocodeEvidence } from './geocoding';

export type RecordingLocationType = 'business' | 'residence' | 'customer-business';
export type RecordingLocationSource = 'customer_profile' | 'customer_supplied' | 'vendor_profile';

type SnapshotAddress = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocodedAt?: Date | null;
  geocodingEvidence?: GeocodeEvidence | null;
};

function finiteCoordinate(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildRecordingLocationSnapshot(
  location: RecordingLocationType,
  source: RecordingLocationSource,
  address: SnapshotAddress | null,
) {
  const normalized = {
    address: String(address?.address || '').trim(),
    city: String(address?.city || '').trim(),
    state: String(address?.state || '').trim(),
    zipCode: String(address?.zipCode || '').trim(),
  };
  const hasAddress = Boolean(normalized.address && normalized.city && normalized.state && normalized.zipCode);
  const latitude = finiteCoordinate(address?.latitude);
  const longitude = finiteCoordinate(address?.longitude);
  const hasVerifiedCoordinates = Boolean(
    latitude != null &&
      longitude != null &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !(latitude === 0 && longitude === 0) &&
      address?.geocodedAt instanceof Date &&
      Number.isFinite(address.geocodedAt.getTime()),
  );
  const providerEvidence = address?.geocodingEvidence
    ? { ...address.geocodingEvidence, sourceLocationType: location }
    : null;
  const snapshotEvidenceHash = providerEvidence
    ? createHash('sha256')
        .update(
          JSON.stringify({
            type: location,
            source,
            ...normalized,
            latitude,
            longitude,
            providerEvidence,
          }),
        )
        .digest('hex')
    : null;

  return {
    type: location,
    source,
    status:
      location === 'customer-business' && !hasAddress
        ? 'pending_customer_input'
        : hasVerifiedCoordinates
          ? 'verified_coordinates'
          : hasAddress
            ? 'address_only'
            : 'not_available',
    address: normalized.address || null,
    city: normalized.city || null,
    state: normalized.state || null,
    zip_code: normalized.zipCode || null,
    latitude,
    longitude,
    geocoded_at: address?.geocodedAt?.toISOString?.() || null,
    evidence_version: providerEvidence ? 2 : 1,
    geocoding_evidence: providerEvidence,
    snapshot_evidence_hash: snapshotEvidenceHash,
    captured_at: new Date().toISOString(),
  };
}
