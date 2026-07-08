import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodeAddress, getGeocodingProvider } from "./geocoding";

describe("geocoding", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses Census geocoding by default so beta can refresh saved address coordinates", async () => {
    vi.stubEnv("GEOCODING_PROVIDER", "");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        result: {
          addressMatches: [
            {
              matchedAddress: "407 BOXWOOD CIR, WINTER SPRINGS, FL, 32708",
              coordinates: {
                x: -81.2851,
                y: 28.6852,
              },
            },
          ],
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await geocodeAddress({
      address: "407 Boxwood Circle",
      city: "Winter Springs",
      state: "FL",
      zipCode: "32708",
    });

    expect(getGeocodingProvider()).toBe("census");
    expect(result).toEqual(
      expect.objectContaining({
        status: "success",
        provider: "census",
        latitude: 28.6852,
        longitude: -81.2851,
        formattedAddress: "407 BOXWOOD CIR, WINTER SPRINGS, FL, 32708",
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("geocoding.geo.census.gov/geocoder/locations/onelineaddress"),
      expect.objectContaining({
        headers: { Accept: "application/json" },
      })
    );
  });

  it("allows geocoding to be explicitly disabled", async () => {
    vi.stubEnv("GEOCODING_PROVIDER", "disabled");

    await expect(
      geocodeAddress({
        address: "407 Boxwood Circle",
        city: "Winter Springs",
        state: "FL",
        zipCode: "32708",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        status: "disabled",
        provider: "disabled",
      })
    );
  });
});
