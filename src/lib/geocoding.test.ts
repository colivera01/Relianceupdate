import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GEOCODING_DISAGREEMENT_METERS,
  geocodeAddress,
  geocodeFailureMessage,
  getGeocodingProvider,
  providersMateriallyDisagree,
} from './geocoding';

const testAddress = {
  address: '888 City Walk Ln',
  city: 'Oviedo',
  state: 'FL',
  zipCode: '32765',
};

function azureResponse(overrides: Record<string, unknown> = {}) {
  return {
    features: [
      {
        id: 'azure-address-888-city-walk',
        geometry: { coordinates: [-81.208, 28.66] },
        properties: {
          type: 'Address',
          confidence: 'High',
          matchCodes: ['Good'],
          address: {
            addressLine: '888 City Walk Ln',
            locality: 'Oviedo',
            postalCode: '32765',
            formattedAddress: '888 City Walk Ln, Oviedo, FL 32765',
            adminDistricts: [{ shortName: 'FL', name: 'Florida' }],
          },
          geocodePoints: [
            {
              geometry: { coordinates: [-81.208, 28.66] },
              calculationMethod: 'Rooftop',
              usageTypes: ['Display'],
            },
          ],
          ...overrides,
        },
      },
    ],
  };
}

function censusResponse(latitude = 28.6601, longitude = -81.2081) {
  return {
    result: {
      addressMatches: [
        {
          matchedAddress: '888 CITY WALK LN, OVIEDO, FL, 32765',
          coordinates: { x: longitude, y: latitude },
          addressComponents: { fromAddress: '888', city: 'OVIEDO', state: 'FL', zip: '32765' },
        },
      ],
    },
  };
}

describe('authoritative geocoding', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses Azure Maps as the primary and accepts a precise manual address without autocomplete', async () => {
    vi.stubEnv('GEOCODING_PROVIDER', 'azure_maps');
    vi.stubEnv('AZURE_MAPS_SUBSCRIPTION_KEY', 'test-key');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => azureResponse() }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await geocodeAddress(testAddress);

    expect(getGeocodingProvider()).toBe('azure_maps');
    expect(result).toMatchObject({
      status: 'success',
      provider: 'azure_maps',
      latitude: 28.66,
      longitude: -81.208,
      formattedAddress: '888 City Walk Ln, Oviedo, FL 32765',
      evidence: {
        version: 2,
        provider: 'azure_maps',
        providerApiVersion: '2025-01-01',
        providerResultId: 'azure-address-888-city-walk',
        precision: 'Rooftop',
        confidence: 'High',
        matchCodes: ['Good'],
        fallbackUsed: false,
      },
    });
    if (result.status === 'success') {
      expect(result.evidence?.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.evidence?.inputAddress).toBe('888 City Walk Ln, Oviedo, FL, 32765');
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses Census only as an explicit fallback after an Azure no-match', async () => {
    vi.stubEnv('AZURE_MAPS_SUBSCRIPTION_KEY', 'test-key');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ features: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => censusResponse() });
    vi.stubGlobal('fetch', fetchMock);

    const result = await geocodeAddress(testAddress);

    expect(result).toMatchObject({
      status: 'success',
      provider: 'census',
      evidence: { fallbackUsed: true, precision: 'AddressMatch', matchCodes: ['Good'] },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails closed when the Azure primary credential is missing', async () => {
    vi.stubEnv('GEOCODING_PROVIDER', 'azure_maps');
    vi.stubEnv('AZURE_MAPS_SUBSCRIPTION_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(geocodeAddress(testAddress)).resolves.toMatchObject({
      status: 'configuration_error',
      provider: 'azure_maps',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['weak precision', { geocodePoints: [{ geometry: { coordinates: [-81.208, 28.66] }, calculationMethod: '', usageTypes: ['Display'] }] }, 'insufficient_precision'],
    ['up hierarchy', { matchCodes: ['UpHierarchy'] }, 'insufficient_precision'],
    ['ambiguity', { matchCodes: ['Good', 'Ambiguous'] }, 'ambiguous'],
  ])('fails closed for %s', async (_label, overrides, expectedStatus) => {
    vi.stubEnv('AZURE_MAPS_SUBSCRIPTION_KEY', 'test-key');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => azureResponse(overrides) }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await geocodeAddress(testAddress);

    expect(result.status).toBe(expectedStatus);
  });

  it('rejects malformed and zero-coordinate provider responses', async () => {
    vi.stubEnv('AZURE_MAPS_SUBSCRIPTION_KEY', 'test-key');
    const malformed = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ unexpected: true }) }));
    vi.stubGlobal('fetch', malformed);
    await expect(geocodeAddress(testAddress)).resolves.toMatchObject({ status: 'malformed_response' });

    const zero = azureResponse();
    zero.features[0].geometry.coordinates = [0, 0];
    zero.features[0].properties.geocodePoints[0].geometry.coordinates = [0, 0];
    const zeroFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => zero })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ result: { addressMatches: [] } }) });
    vi.stubGlobal('fetch', zeroFetch);
    await expect(geocodeAddress(testAddress)).resolves.toMatchObject({ status: 'not_found' });
  });

  it('accepts equivalent fallback coordinates but blocks a material provider conflict', async () => {
    vi.stubEnv('AZURE_MAPS_SUBSCRIPTION_KEY', 'test-key');
    const weakAzure = azureResponse({ matchCodes: ['UpHierarchy'] });
    const equivalentFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => weakAzure })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => censusResponse() });
    vi.stubGlobal('fetch', equivalentFetch);
    await expect(geocodeAddress(testAddress)).resolves.toMatchObject({ status: 'success', provider: 'census' });

    const conflictFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => weakAzure })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => censusResponse(28.68, -81.23) });
    vi.stubGlobal('fetch', conflictFetch);
    await expect(geocodeAddress(testAddress)).resolves.toMatchObject({ status: 'provider_conflict' });
  });

  it('falls back during an Azure outage but fails when both providers are unavailable', async () => {
    vi.stubEnv('AZURE_MAPS_SUBSCRIPTION_KEY', 'test-key');
    const fallbackFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => censusResponse() });
    vi.stubGlobal('fetch', fallbackFetch);
    await expect(geocodeAddress(testAddress)).resolves.toMatchObject({ status: 'success', provider: 'census' });

    const outageFetch = vi.fn(async () => ({ ok: false, status: 503 }));
    vi.stubGlobal('fetch', outageFetch);
    await expect(geocodeAddress(testAddress)).resolves.toMatchObject({ status: 'provider_unavailable' });
  });

  it('uses half the recording radius as the material disagreement threshold', () => {
    expect(GEOCODING_DISAGREEMENT_METERS).toBe(75);
    expect(
      providersMateriallyDisagree(
        { latitude: 28.66, longitude: -81.208 },
        { latitude: 28.6601, longitude: -81.2081 },
      ),
    ).toBe(false);
    expect(
      providersMateriallyDisagree(
        { latitude: 28.66, longitude: -81.208 },
        { latitude: 28.68, longitude: -81.23 },
      ),
    ).toBe(true);
  });

  it('keeps vendor-facing failure outcomes truthful and provider-neutral', () => {
    expect(geocodeFailureMessage('incomplete_address')).toBe(
      'Enter the complete street, city, state, and ZIP code.',
    );
    expect(geocodeFailureMessage('not_found')).toContain('could not verify this address');
    expect(geocodeFailureMessage('ambiguous')).toContain('More than one location matched');
    expect(geocodeFailureMessage('provider_conflict')).toContain('More than one location matched');
    expect(geocodeFailureMessage('provider_unavailable')).toContain('temporarily unavailable');
    expect(geocodeFailureMessage('insufficient_precision')).not.toContain('Azure');
  });
});
