import { createHash } from 'node:crypto';

export type GeocodingProvider = 'disabled' | 'azure_maps' | 'census';

export type GeocodableAddress = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
};

export type GeocodeEvidence = {
  version: 2;
  provider: Exclude<GeocodingProvider, 'disabled'>;
  providerApiVersion: string;
  providerResultId: string | null;
  inputAddress: string;
  normalizedAddress: string;
  resultType: 'Address';
  precision: 'Rooftop' | 'Parcel' | 'Interpolation' | 'InterpolationOffset' | 'AddressMatch';
  confidence: string;
  matchCodes: string[];
  fallbackUsed: boolean;
  verifiedAt: string;
  evidenceHash: string;
};

export type GeocodeFailureStatus =
  | 'disabled'
  | 'configuration_error'
  | 'incomplete_address'
  | 'not_found'
  | 'ambiguous'
  | 'insufficient_precision'
  | 'provider_unavailable'
  | 'provider_conflict'
  | 'malformed_response'
  | 'error';

export type GeocodeResult =
  | {
      status: 'success';
      provider: Exclude<GeocodingProvider, 'disabled'>;
      latitude: number;
      longitude: number;
      geocodedAt: Date;
      formattedAddress?: string;
      evidence?: GeocodeEvidence;
    }
  | {
      status: GeocodeFailureStatus;
      provider: GeocodingProvider;
      message?: string;
      candidate?: AzureMapsAddressCandidate;
    };

export type AzureMapsAddressCandidate = {
  id: string | null;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  resultType: string;
  confidence: string;
  matchCodes: string[];
  calculationMethod: string;
};

type AzureMapsFeature = {
  id?: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    type?: string;
    confidence?: string;
    matchCodes?: string[];
    address?: {
      addressLine?: string;
      locality?: string;
      postalCode?: string;
      formattedAddress?: string;
      adminDistricts?: Array<{ shortName?: string; name?: string }>;
    };
    geocodePoints?: Array<{
      geometry?: { coordinates?: [number, number] };
      calculationMethod?: string;
      usageTypes?: string[];
    }>;
  };
};

type AzureMapsResponse = { features?: AzureMapsFeature[] };
type CensusAddressMatch = {
  matchedAddress?: string;
  coordinates?: { x?: number; y?: number };
  addressComponents?: { fromAddress?: string; city?: string; state?: string; zip?: string };
};
type CensusResponse = { result?: { addressMatches?: CensusAddressMatch[] } };
type ProviderAttempt = GeocodeResult;

const AZURE_MAPS_API_VERSION = '2025-01-01';
export const GEOCODING_DISAGREEMENT_METERS = 75;
const ACCEPTED_AZURE_PRECISION = new Set(['Rooftop', 'Parcel', 'Interpolation', 'InterpolationOffset']);

function clean(value: unknown): string {
  return String(value || '').trim();
}

function normalizeForComparison(value: unknown): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeZip(value: unknown): string {
  return clean(value).slice(0, 5);
}

function leadingStreetNumber(value: unknown): string {
  return clean(value).match(/^\s*(\d+[a-z]?)/i)?.[1]?.toLowerCase() || '';
}

function finiteCoordinate(value: unknown): number | null {
  const coordinate = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function hasValidCoordinates(latitude: unknown, longitude: unknown): boolean {
  const lat = finiteCoordinate(latitude);
  const lon = finiteCoordinate(longitude);
  return Boolean(
    lat != null && lon != null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0),
  );
}

export function getGeocodingProvider(): GeocodingProvider {
  const provider = clean(process.env.GEOCODING_PROVIDER).toLowerCase();
  if (provider === 'disabled') return 'disabled';
  if (provider === 'census') return 'census';
  return 'azure_maps';
}

export function hasCompleteAddress(input: GeocodableAddress): boolean {
  return Boolean(clean(input.address) && clean(input.city) && clean(input.state) && clean(input.zipCode));
}

export function formatAddress(input: GeocodableAddress): string {
  return [input.address, input.city, input.state, input.zipCode].map(clean).filter(Boolean).join(', ');
}

export function geocodeFailureMessage(status: GeocodeFailureStatus): string {
  if (status === 'incomplete_address') return 'Enter the complete street, city, state, and ZIP code.';
  if (status === 'ambiguous' || status === 'provider_conflict') {
    return 'More than one location matched. Choose the exact service address.';
  }
  if (status === 'provider_unavailable') {
    return 'Address verification is temporarily unavailable. Try again later.';
  }
  if (status === 'not_found') {
    return 'We could not verify this address. Check the address or choose the correct suggested location.';
  }
  return 'Reliance could not verify this address automatically. Check the exact service address and contact support if it is correct.';
}

export function addressChanged(previous: GeocodableAddress | null | undefined, next: GeocodableAddress): boolean {
  if (!previous) return hasCompleteAddress(next);
  return (
    normalizeForComparison(previous.address) !== normalizeForComparison(next.address) ||
    normalizeForComparison(previous.city) !== normalizeForComparison(next.city) ||
    normalizeForComparison(previous.state) !== normalizeForComparison(next.state) ||
    normalizeZip(previous.zipCode) !== normalizeZip(next.zipCode)
  );
}

function azureMapsKey(): string {
  return clean(process.env.AZURE_MAPS_SUBSCRIPTION_KEY || process.env.GEOCODING_API_KEY);
}

function azureMapsEndpoint(): string {
  return clean(process.env.AZURE_MAPS_GEOCODING_ENDPOINT) || 'https://atlas.microsoft.com/geocode';
}

function azureMapsApiVersion(): string {
  return clean(process.env.AZURE_MAPS_GEOCODING_API_VERSION) || AZURE_MAPS_API_VERSION;
}

function evidenceHash(value: Omit<GeocodeEvidence, 'evidenceHash'>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function successResult(
  provider: 'azure_maps' | 'census',
  candidate: {
    latitude: number;
    longitude: number;
    formattedAddress: string;
    providerApiVersion: string;
    providerResultId?: string | null;
    precision: GeocodeEvidence['precision'];
    confidence: string;
    matchCodes: string[];
  },
  input: GeocodableAddress,
  fallbackUsed: boolean,
): GeocodeResult {
  const geocodedAt = new Date();
  const withoutHash: Omit<GeocodeEvidence, 'evidenceHash'> = {
    version: 2,
    provider,
    providerApiVersion: candidate.providerApiVersion,
    providerResultId: candidate.providerResultId || null,
    inputAddress: formatAddress(input),
    normalizedAddress: candidate.formattedAddress,
    resultType: 'Address',
    precision: candidate.precision,
    confidence: candidate.confidence,
    matchCodes: [...candidate.matchCodes],
    fallbackUsed,
    verifiedAt: geocodedAt.toISOString(),
  };
  return {
    status: 'success',
    provider,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    geocodedAt,
    formattedAddress: candidate.formattedAddress,
    evidence: { ...withoutHash, evidenceHash: evidenceHash(withoutHash) },
  };
}

function featureToAzureCandidate(feature: AzureMapsFeature): AzureMapsAddressCandidate | null {
  const properties = feature.properties;
  const address = properties?.address;
  const displayPoint = properties?.geocodePoints?.find((point) =>
    point.usageTypes?.some((usage) => usage.toLowerCase() === 'display'),
  );
  const coordinates = displayPoint?.geometry?.coordinates || feature.geometry?.coordinates;
  const longitude = finiteCoordinate(coordinates?.[0]);
  const latitude = finiteCoordinate(coordinates?.[1]);
  const addressLine = clean(address?.addressLine);
  const city = clean(address?.locality);
  const state = clean(address?.adminDistricts?.[0]?.shortName || address?.adminDistricts?.[0]?.name);
  const zipCode = clean(address?.postalCode);
  const formattedAddress = clean(address?.formattedAddress);
  if (!hasValidCoordinates(latitude, longitude) || !addressLine || !city || !state || !zipCode || !formattedAddress) {
    return null;
  }
  return {
    id: clean(feature.id) || null,
    address: addressLine,
    city,
    state,
    zipCode,
    formattedAddress,
    latitude: latitude!,
    longitude: longitude!,
    resultType: clean(properties?.type),
    confidence: clean(properties?.confidence),
    matchCodes: Array.isArray(properties?.matchCodes) ? properties!.matchCodes!.map(clean).filter(Boolean) : [],
    calculationMethod: clean(displayPoint?.calculationMethod),
  };
}

export function azureMapsCandidates(payload: AzureMapsResponse): AzureMapsAddressCandidate[] {
  return (payload.features || []).map(featureToAzureCandidate).filter((value): value is AzureMapsAddressCandidate => Boolean(value));
}

function candidateMatchesInput(candidate: AzureMapsAddressCandidate, input: GeocodableAddress): boolean {
  const requestedNumber = leadingStreetNumber(input.address);
  return Boolean(
    requestedNumber &&
      leadingStreetNumber(candidate.address) === requestedNumber &&
      normalizeForComparison(candidate.city) === normalizeForComparison(input.city) &&
      normalizeForComparison(candidate.state) === normalizeForComparison(input.state) &&
      normalizeZip(candidate.zipCode) === normalizeZip(input.zipCode),
  );
}

function isAcceptableAzureCandidate(candidate: AzureMapsAddressCandidate, input: GeocodableAddress): boolean {
  const matchCodes = new Set(candidate.matchCodes.map((code) => code.toLowerCase()));
  return Boolean(
    candidate.resultType.toLowerCase() === 'address' &&
      ['high', 'medium'].includes(candidate.confidence.toLowerCase()) &&
      matchCodes.has('good') &&
      !matchCodes.has('ambiguous') &&
      !matchCodes.has('uphierarchy') &&
      ACCEPTED_AZURE_PRECISION.has(candidate.calculationMethod) &&
      candidateMatchesInput(candidate, input),
  );
}

export function distanceMeters(
  first: Pick<AzureMapsAddressCandidate, 'latitude' | 'longitude'>,
  second: Pick<AzureMapsAddressCandidate, 'latitude' | 'longitude'>,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const radius = 6_371_000;
  const lat1 = toRadians(first.latitude);
  const lat2 = toRadians(second.latitude);
  const deltaLat = toRadians(second.latitude - first.latitude);
  const deltaLon = toRadians(second.longitude - first.longitude);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function providersMateriallyDisagree(
  first: Pick<AzureMapsAddressCandidate, 'latitude' | 'longitude'>,
  second: Pick<AzureMapsAddressCandidate, 'latitude' | 'longitude'>,
): boolean {
  return distanceMeters(first, second) > GEOCODING_DISAGREEMENT_METERS;
}

async function geocodeWithAzureMaps(input: GeocodableAddress): Promise<ProviderAttempt> {
  const apiKey = azureMapsKey();
  if (!apiKey) {
    return { status: 'configuration_error', provider: 'azure_maps', message: 'Azure Maps credentials are not configured.' };
  }
  const apiVersion = azureMapsApiVersion();
  const params = new URLSearchParams({
    'api-version': apiVersion,
    addressLine: clean(input.address),
    locality: clean(input.city),
    adminDistrict: clean(input.state),
    postalCode: clean(input.zipCode),
    countryRegion: 'US',
    top: '5',
  });
  try {
    const response = await fetch(`${azureMapsEndpoint()}?${params.toString()}`, {
      headers: { Accept: 'application/geo+json', 'subscription-key': apiKey },
    });
    if (response.status === 401 || response.status === 403) {
      return { status: 'configuration_error', provider: 'azure_maps', message: 'Azure Maps rejected the credential.' };
    }
    if (!response.ok) {
      return { status: 'provider_unavailable', provider: 'azure_maps', message: `Azure Maps failed with HTTP ${response.status}.` };
    }
    const payload = (await response.json()) as AzureMapsResponse;
    if (!Array.isArray(payload.features)) {
      return { status: 'malformed_response', provider: 'azure_maps', message: 'Azure Maps returned a malformed response.' };
    }
    const candidates = azureMapsCandidates(payload);
    if (candidates.length === 0) {
      return { status: 'not_found', provider: 'azure_maps', message: 'No address result was found.' };
    }
    const acceptable = candidates.filter((candidate) => isAcceptableAzureCandidate(candidate, input));
    if (acceptable.length === 0) {
      const ambiguous = candidates.some((candidate) =>
        candidate.matchCodes.some((code) => code.toLowerCase() === 'ambiguous'),
      );
      return {
        status: ambiguous ? 'ambiguous' : 'insufficient_precision',
        provider: 'azure_maps',
        message: ambiguous ? 'More than one address matched.' : 'No sufficiently precise address matched.',
        candidate: candidates[0],
      };
    }
    if (acceptable.length > 1 && acceptable.slice(1).some((candidate) => providersMateriallyDisagree(acceptable[0], candidate))) {
      return { status: 'ambiguous', provider: 'azure_maps', message: 'Materially different acceptable addresses matched.' };
    }
    const selected = acceptable[0];
    return successResult(
      'azure_maps',
      {
        latitude: selected.latitude,
        longitude: selected.longitude,
        formattedAddress: selected.formattedAddress,
        providerApiVersion: apiVersion,
        providerResultId: selected.id,
        precision: selected.calculationMethod as GeocodeEvidence['precision'],
        confidence: selected.confidence,
        matchCodes: selected.matchCodes,
      },
      input,
      false,
    );
  } catch (error) {
    return { status: 'provider_unavailable', provider: 'azure_maps', message: error instanceof Error ? error.message : 'Azure Maps is unavailable.' };
  }
}

function censusMatchIsPrecise(match: CensusAddressMatch, input: GeocodableAddress): boolean {
  const matched = normalizeForComparison(match.matchedAddress);
  const components = match.addressComponents;
  return Boolean(
    matched &&
      leadingStreetNumber(components?.fromAddress || match.matchedAddress) === leadingStreetNumber(input.address) &&
      normalizeForComparison(components?.city || match.matchedAddress).includes(normalizeForComparison(input.city)) &&
      normalizeForComparison(components?.state || match.matchedAddress).includes(normalizeForComparison(input.state)) &&
      normalizeForComparison(components?.zip || match.matchedAddress).includes(normalizeZip(input.zipCode)),
  );
}

async function geocodeWithCensus(input: GeocodableAddress, fallbackUsed: boolean): Promise<GeocodeResult> {
  const apiVersion = clean(process.env.CENSUS_GEOCODING_BENCHMARK) || 'Public_AR_Current';
  const baseUrl = clean(process.env.CENSUS_GEOCODING_ENDPOINT) || 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
  const params = new URLSearchParams({ address: formatAddress(input), benchmark: apiVersion, format: 'json' });
  try {
    const response = await fetch(`${baseUrl}?${params.toString()}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      return { status: 'provider_unavailable', provider: 'census', message: `Census failed with HTTP ${response.status}.` };
    }
    const payload = (await response.json()) as CensusResponse;
    const matches = payload.result?.addressMatches;
    if (!Array.isArray(matches)) {
      return { status: 'malformed_response', provider: 'census', message: 'Census returned a malformed response.' };
    }
    if (matches.length === 0) return { status: 'not_found', provider: 'census', message: 'No address result was found.' };
    if (matches.length > 1) return { status: 'ambiguous', provider: 'census', message: 'Multiple addresses matched.' };
    const match = matches[0];
    const latitude = finiteCoordinate(match.coordinates?.y);
    const longitude = finiteCoordinate(match.coordinates?.x);
    if (!hasValidCoordinates(latitude, longitude)) {
      return { status: 'malformed_response', provider: 'census', message: 'Census returned invalid coordinates.' };
    }
    if (!censusMatchIsPrecise(match, input)) {
      return { status: 'insufficient_precision', provider: 'census', message: 'Census did not return a complete address-level match.' };
    }
    return successResult(
      'census',
      {
        latitude: latitude!,
        longitude: longitude!,
        formattedAddress: clean(match.matchedAddress),
        providerApiVersion: apiVersion,
        precision: 'AddressMatch',
        confidence: 'SingleMatch',
        matchCodes: ['Good'],
      },
      input,
      fallbackUsed,
    );
  } catch (error) {
    return { status: 'provider_unavailable', provider: 'census', message: error instanceof Error ? error.message : 'Census is unavailable.' };
  }
}

export async function geocodeAddress(input: GeocodableAddress): Promise<GeocodeResult> {
  const provider = getGeocodingProvider();
  if (!hasCompleteAddress(input)) {
    return { status: 'incomplete_address', provider, message: 'Street address, city, state, and ZIP code are required.' };
  }
  if (provider === 'disabled') return { status: 'disabled', provider, message: 'Address verification is disabled.' };
  if (provider === 'census') return geocodeWithCensus(input, false);

  const primary = await geocodeWithAzureMaps(input);
  if (primary.status === 'success') return primary;
  if (['configuration_error', 'disabled', 'malformed_response', 'ambiguous'].includes(primary.status)) return primary;

  const fallback = await geocodeWithCensus(input, true);
  if (fallback.status !== 'success') {
    if (primary.status === 'insufficient_precision') return primary;
    if (primary.status === 'provider_unavailable' && fallback.status === 'provider_unavailable') {
      return { status: 'provider_unavailable', provider: 'azure_maps', message: 'Address verification providers are unavailable.' };
    }
    return fallback;
  }
  if (primary.status === 'insufficient_precision' && primary.candidate && providersMateriallyDisagree(primary.candidate, fallback)) {
    const conflictReference = createHash('sha256')
      .update(
        JSON.stringify({
          input: formatAddress(input),
          primary: [primary.candidate.latitude, primary.candidate.longitude],
          fallback: [fallback.latitude, fallback.longitude],
        }),
      )
      .digest('hex');
    console.warn('[geocoding] provider conflict blocked', {
      conflictReference,
      distanceMeters: Math.round(distanceMeters(primary.candidate, fallback)),
      thresholdMeters: GEOCODING_DISAGREEMENT_METERS,
    });
    return { status: 'provider_conflict', provider: 'azure_maps', message: 'Providers returned materially different locations.' };
  }
  return fallback;
}

export async function getAzureMapsAddressCandidates(query: string): Promise<AzureMapsAddressCandidate[]> {
  const q = clean(query);
  if (q.length < 3 || getGeocodingProvider() !== 'azure_maps') return [];
  const apiKey = azureMapsKey();
  if (!apiKey) return [];
  const params = new URLSearchParams({ 'api-version': azureMapsApiVersion(), query: q, top: '5' });
  const response = await fetch(`${azureMapsEndpoint()}?${params.toString()}`, {
    headers: { Accept: 'application/geo+json', 'subscription-key': apiKey },
  });
  if (!response.ok) return [];
  return azureMapsCandidates((await response.json()) as AzureMapsResponse).filter(
    (candidate) => candidate.resultType.toLowerCase() === 'address',
  );
}
