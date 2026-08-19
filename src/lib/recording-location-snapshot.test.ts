import { describe, expect, it } from 'vitest';
import { buildRecordingLocationSnapshot } from './recording-location-snapshot';

const evidence = {
  version: 2 as const,
  provider: 'azure_maps' as const,
  providerApiVersion: '2025-01-01',
  providerResultId: 'result-1',
  inputAddress: '407 Boxwood Circle, Winter Springs, FL, 32708',
  normalizedAddress: '407 Boxwood Cir, Winter Springs, FL 32708',
  resultType: 'Address' as const,
  precision: 'Rooftop' as const,
  confidence: 'High',
  matchCodes: ['Good'],
  fallbackUsed: false,
  verifiedAt: '2026-08-19T12:00:00.000Z',
  evidenceHash: 'a'.repeat(64),
};

describe('recording location snapshot', () => {
  it.each([
    ['business', 'vendor_profile'],
    ['residence', 'customer_supplied'],
    ['customer-business', 'customer_supplied'],
  ] as const)('binds provider evidence to the immutable %s source', (type, source) => {
    const snapshot = buildRecordingLocationSnapshot(type, source, {
      address: '407 Boxwood Circle',
      city: 'Winter Springs',
      state: 'FL',
      zipCode: '32708',
      latitude: 28.698,
      longitude: -81.305,
      geocodedAt: new Date('2026-08-19T12:00:00.000Z'),
      geocodingEvidence: evidence,
    });

    expect(snapshot).toMatchObject({
      type,
      source,
      status: 'verified_coordinates',
      evidence_version: 2,
      geocoding_evidence: {
        provider: 'azure_maps',
        sourceLocationType: type,
      },
    });
    expect(snapshot.snapshot_evidence_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does not classify zero coordinates as verified', () => {
    const snapshot = buildRecordingLocationSnapshot('residence', 'customer_supplied', {
      address: '407 Boxwood Circle',
      city: 'Winter Springs',
      state: 'FL',
      zipCode: '32708',
      latitude: 0,
      longitude: 0,
      geocodedAt: new Date('2026-08-19T12:00:00.000Z'),
      geocodingEvidence: evidence,
    });
    expect(snapshot.status).toBe('address_only');
  });
});
