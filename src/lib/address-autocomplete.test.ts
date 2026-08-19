import { afterEach, describe, expect, it, vi } from "vitest";
import {
  suggestionsFromCensus,
  getAddressAutocompleteSuggestions,
} from "./address-autocomplete";

describe("address autocomplete", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("normalizes Census address matches into form fields", () => {
    const suggestions = suggestionsFromCensus({
      result: {
        addressMatches: [
          {
            matchedAddress: "407 BOXWOOD CIR, WINTER SPRINGS, FL, 32708",
            coordinates: { x: -81.30508401645, y: 28.690570919537 },
            addressComponents: {
              fromAddress: "401",
              streetName: "BOXWOOD",
              suffixType: "CIR",
              city: "WINTER SPRINGS",
              state: "FL",
              zip: "32708",
            },
          },
        ],
      },
    });

    expect(suggestions[0]).toMatchObject({
      label: "407 BOXWOOD CIR, WINTER SPRINGS, FL, 32708",
      address: "407 BOXWOOD CIR",
      city: "WINTER SPRINGS",
      state: "FL",
      zipCode: "32708",
      latitude: 28.690570919537,
      longitude: -81.30508401645,
    });
  });

  it("uses Azure Maps suggestions under the same primary-provider configuration", async () => {
    vi.stubEnv("GEOCODING_PROVIDER", "azure_maps");
    vi.stubEnv("AZURE_MAPS_SUBSCRIPTION_KEY", "test-key");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            id: "azure-address-1",
            geometry: { coordinates: [-81.305084, 28.69057] },
            properties: {
              type: "Address",
              confidence: "High",
              matchCodes: ["Good"],
              address: {
                addressLine: "407 Boxwood Cir",
                locality: "Winter Springs",
                postalCode: "32708",
                formattedAddress: "407 Boxwood Cir, Winter Springs, FL 32708",
                adminDistricts: [{ shortName: "FL" }],
              },
              geocodePoints: [
                {
                  geometry: { coordinates: [-81.305084, 28.69057] },
                  calculationMethod: "Rooftop",
                  usageTypes: ["Display"],
                },
              ],
            },
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const suggestions = await getAddressAutocompleteSuggestions("407 Boxwood");

    expect(suggestions[0]).toMatchObject({
      id: "azure-address-1",
      address: "407 Boxwood Cir",
      city: "Winter Springs",
      state: "FL",
      zipCode: "32708",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("atlas.microsoft.com/geocode"),
      expect.objectContaining({ headers: expect.objectContaining({ "subscription-key": "test-key" }) }),
    );
  });

  it("does not call the provider for very short queries", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(getAddressAutocompleteSuggestions("12")).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
