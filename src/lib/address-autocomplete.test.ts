import { describe, expect, it, vi } from "vitest";
import {
  suggestionsFromCensus,
  suggestionsFromMapbox,
  getAddressAutocompleteSuggestions,
} from "./address-autocomplete";

describe("address autocomplete", () => {
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

  it("normalizes Mapbox address features into form fields", () => {
    const suggestions = suggestionsFromMapbox({
      features: [
        {
          id: "address.1",
          place_name: "407 Boxwood Cir, Winter Springs, Florida 32708, United States",
          text: "Boxwood Cir",
          address: "407",
          center: [-81.305084, 28.69057],
          context: [
            { id: "place.1", text: "Winter Springs" },
            { id: "region.1", text: "Florida", short_code: "US-FL" },
            { id: "postcode.1", text: "32708" },
          ],
        },
      ],
    });

    expect(suggestions[0]).toMatchObject({
      id: "address.1",
      address: "407 Boxwood Cir",
      city: "Winter Springs",
      state: "FL",
      zipCode: "32708",
    });
  });

  it("does not call the provider for very short queries", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(getAddressAutocompleteSuggestions("12")).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
