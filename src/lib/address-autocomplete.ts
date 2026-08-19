import { getAzureMapsAddressCandidates, getGeocodingProvider } from "./geocoding";

export type AddressAutocompleteSuggestion = {
  id: string;
  label: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
};

type CensusAddressMatch = {
  matchedAddress?: string;
  coordinates?: {
    x?: number;
    y?: number;
  };
  addressComponents?: {
    zip?: string;
    streetName?: string;
    preType?: string;
    city?: string;
    preDirection?: string;
    suffixDirection?: string;
    fromAddress?: string;
    state?: string;
    suffixType?: string;
    toAddress?: string;
    suffixQualifier?: string;
    preQualifier?: string;
  };
};

type CensusAutocompleteResponse = {
  result?: {
    addressMatches?: CensusAddressMatch[];
  };
};

function clean(value: unknown): string {
  return String(value || "").trim();
}

function compact(parts: Array<string | null | undefined>, separator = " "): string {
  return parts.map(clean).filter(Boolean).join(separator);
}

function normalizeState(value: string): string {
  const state = clean(value);
  return state.length > 2 ? state.slice(0, 2).toUpperCase() : state.toUpperCase();
}

function suggestionId(prefix: string, index: number, label: string): string {
  return `${prefix}-${index}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function parseMatchedAddress(value: string): Pick<AddressAutocompleteSuggestion, "address" | "city" | "state" | "zipCode"> {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  const [address = "", city = "", state = "", zipCode = ""] = parts;
  return {
    address,
    city,
    state: normalizeState(state),
    zipCode,
  };
}

export function suggestionsFromCensus(payload: CensusAutocompleteResponse): AddressAutocompleteSuggestion[] {
  const matches = payload.result?.addressMatches || [];
  return matches
    .map((match, index) => {
      const components = match.addressComponents;
      const label = clean(match.matchedAddress);
      const parsed = label ? parseMatchedAddress(label) : null;
      const street = compact([
        components?.fromAddress,
        components?.preDirection,
        components?.preType,
        components?.streetName,
        components?.suffixType,
        components?.suffixDirection,
      ]);
      const address = clean(parsed?.address || street);
      const city = clean(components?.city || parsed?.city);
      const state = normalizeState(clean(components?.state || parsed?.state));
      const zipCode = clean(components?.zip || parsed?.zipCode);
      const latitude = match.coordinates?.y;
      const longitude = match.coordinates?.x;

      if (!address || !city || !state || !zipCode) return null;
      return {
        id: suggestionId("census", index, label || compact([address, city, state, zipCode], ",")),
        label: label || `${address}, ${city}, ${state}, ${zipCode}`,
        address,
        city,
        state,
        zipCode,
        ...(typeof latitude === "number" ? { latitude } : {}),
        ...(typeof longitude === "number" ? { longitude } : {}),
      };
    })
    .filter((suggestion): suggestion is AddressAutocompleteSuggestion => Boolean(suggestion));
}

export async function getAddressAutocompleteSuggestions(query: string): Promise<AddressAutocompleteSuggestion[]> {
  const q = clean(query);
  if (q.length < 3) return [];

  if (getGeocodingProvider() === "azure_maps") {
    const candidates = await getAzureMapsAddressCandidates(q);
    return candidates.map((candidate, index) => ({
      id: candidate.id || suggestionId("azure-maps", index, candidate.formattedAddress),
      label: candidate.formattedAddress,
      address: candidate.address,
      city: candidate.city,
      state: normalizeState(candidate.state),
      zipCode: candidate.zipCode,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    }));
  }

  const baseUrl =
    clean(process.env.CENSUS_GEOCODING_ENDPOINT) ||
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
  const params = new URLSearchParams({
    address: q,
    benchmark: clean(process.env.CENSUS_GEOCODING_BENCHMARK) || "Public_AR_Current",
    format: "json",
  });
  const response = await fetch(`${baseUrl}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return [];
  return suggestionsFromCensus((await response.json()) as CensusAutocompleteResponse);
}
