export type GeocodingProvider = 'disabled' | 'mapbox';

export type GeocodableAddress = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
};

export type GeocodeResult =
  | {
      status: 'success';
      provider: GeocodingProvider;
      latitude: number;
      longitude: number;
      geocodedAt: Date;
      formattedAddress?: string;
    }
  | {
      status: 'disabled' | 'incomplete_address' | 'not_found' | 'error';
      provider: GeocodingProvider;
      message?: string;
    };

type MapboxFeature = {
  center?: [number, number];
  place_name?: string;
};

type MapboxResponse = {
  features?: MapboxFeature[];
};

function clean(value: string | null | undefined): string {
  return String(value || '').trim();
}

export function getGeocodingProvider(): GeocodingProvider {
  const provider = clean(process.env.GEOCODING_PROVIDER).toLowerCase();
  if (provider === 'mapbox') return 'mapbox';
  return 'disabled';
}

export function hasCompleteAddress(input: GeocodableAddress): boolean {
  return Boolean(clean(input.address) && clean(input.city) && clean(input.state) && clean(input.zipCode));
}

export function formatAddress(input: GeocodableAddress): string {
  return [input.address, input.city, input.state, input.zipCode].map(clean).filter(Boolean).join(', ');
}

export function addressChanged(
  previous: GeocodableAddress | null | undefined,
  next: GeocodableAddress
): boolean {
  if (!previous) return hasCompleteAddress(next);
  return (
    clean(previous.address).toLowerCase() !== clean(next.address).toLowerCase() ||
    clean(previous.city).toLowerCase() !== clean(next.city).toLowerCase() ||
    clean(previous.state).toLowerCase() !== clean(next.state).toLowerCase() ||
    clean(previous.zipCode).toLowerCase() !== clean(next.zipCode).toLowerCase()
  );
}

export async function geocodeAddress(input: GeocodableAddress): Promise<GeocodeResult> {
  const provider = getGeocodingProvider();
  if (provider === 'disabled') {
    return {
      status: 'disabled',
      provider,
      message: 'Geocoding is disabled. Set GEOCODING_PROVIDER and provider credentials to enable it.',
    };
  }

  if (!hasCompleteAddress(input)) {
    return {
      status: 'incomplete_address',
      provider,
      message: 'Street address, city, state, and ZIP code are required before geocoding.',
    };
  }

  if (provider === 'mapbox') {
    return geocodeWithMapbox(input);
  }

  return {
    status: 'disabled',
    provider,
    message: 'No supported geocoding provider is configured.',
  };
}

async function geocodeWithMapbox(input: GeocodableAddress): Promise<GeocodeResult> {
  const provider: GeocodingProvider = 'mapbox';
  const apiKey = clean(process.env.GEOCODING_API_KEY || process.env.MAPBOX_GEOCODING_API_KEY);
  if (!apiKey) {
    return {
      status: 'disabled',
      provider,
      message: 'Mapbox geocoding requires GEOCODING_API_KEY or MAPBOX_GEOCODING_API_KEY.',
    };
  }

  try {
    const baseUrl =
      clean(process.env.MAPBOX_GEOCODING_ENDPOINT) ||
      'https://api.mapbox.com/geocoding/v5/mapbox.places';
    const query = encodeURIComponent(formatAddress(input));
    const url = `${baseUrl}/${query}.json?access_token=${encodeURIComponent(apiKey)}&limit=1&types=address,place,postcode`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      return {
        status: 'error',
        provider,
        message: `Mapbox geocoding failed with HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as MapboxResponse;
    const feature = payload.features?.[0];
    const center = feature?.center;
    const longitude = center?.[0];
    const latitude = center?.[1];
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return {
        status: 'not_found',
        provider,
        message: 'No geocoding result found for this address.',
      };
    }

    return {
      status: 'success',
      provider,
      latitude,
      longitude,
      geocodedAt: new Date(),
      formattedAddress: feature?.place_name,
    };
  } catch (error) {
    return {
      status: 'error',
      provider,
      message: error instanceof Error ? error.message : 'Unknown geocoding error.',
    };
  }
}
