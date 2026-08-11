import { describe, expect, it } from "vitest";
import { verifyJobRecordingLocation } from "./job-recording-location";

const customerBusinessMetadata = JSON.stringify({
  vendor_job_recording_location: "customer-business",
  vendor_job_recording_location_snapshot: {
    type: "customer-business",
    source: "customer_supplied",
    status: "verified_coordinates",
    address: "123 Main St",
    city: "Orlando",
    state: "FL",
    zip_code: "32801",
    latitude: 28.5383,
    longitude: -81.3792,
    captured_at: "2026-07-22T12:00:00.000Z",
  },
});

describe("verifyJobRecordingLocation", () => {
  it("rejects an employee phone outside the customer business radius", async () => {
    const result = await verifyJobRecordingLocation({
      vendorId: "vendor-1",
      metadata: customerBusinessMetadata,
      vendorLocation: null,
      proof: { latitude: 29.7604, longitude: -95.3698, accuracyMeters: 20 },
    });
    expect(result).toMatchObject({ ok: false, status: 403, code: "CUSTOMER_BUSINESS_LOCATION_MISMATCH" });
  });

  it("accepts an accurate phone fix at the customer business address", async () => {
    const result = await verifyJobRecordingLocation({
      vendorId: "vendor-1",
      metadata: customerBusinessMetadata,
      vendorLocation: null,
      proof: { latitude: 28.53831, longitude: -81.37919, accuracyMeters: 20 },
    });
    expect(result).toMatchObject({ ok: true, location: "customer-business" });
  });

  it("accepts normal indoor GPS uncertainty when the address remains within the accuracy radius", async () => {
    const result = await verifyJobRecordingLocation({
      vendorId: "vendor-1",
      metadata: customerBusinessMetadata,
      vendorLocation: null,
      proof: { latitude: 28.5398, longitude: -81.3792, accuracyMeters: 220 },
    });
    expect(result).toMatchObject({ ok: true, location: "customer-business" });
  });

  it("asks for a better phone fix when location accuracy is too low", async () => {
    const result = await verifyJobRecordingLocation({
      vendorId: "vendor-1",
      metadata: customerBusinessMetadata,
      vendorLocation: null,
      proof: { latitude: 28.5383, longitude: -81.3792, accuracyMeters: 650 },
    });
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: "CUSTOMER_BUSINESS_LOCATION_ACCURACY_TOO_LOW",
    });
  });

  it("still rejects a phone whose nearest plausible position is outside the allowed radius", async () => {
    const result = await verifyJobRecordingLocation({
      vendorId: "vendor-1",
      metadata: customerBusinessMetadata,
      vendorLocation: null,
      proof: { latitude: 28.5483, longitude: -81.3792, accuracyMeters: 300 },
    });
    expect(result).toMatchObject({
      ok: false,
      status: 403,
      code: "CUSTOMER_BUSINESS_LOCATION_MISMATCH",
    });
  });

  it("uses the address snapshot saved on the work order after the vendor profile changes", async () => {
    const metadata = JSON.stringify({
      vendor_job_recording_location: "business",
      vendor_job_recording_location_snapshot: {
        type: "business",
        source: "vendor_profile",
        status: "verified_coordinates",
        address: "100 Original Ave",
        city: "Orlando",
        state: "FL",
        zip_code: "32801",
        latitude: 28.5383,
        longitude: -81.3792,
        captured_at: "2026-07-22T12:00:00.000Z",
      },
    });
    const changedVendorProfile = {
      address: "200 New Address Rd",
      city: "Mount Dora",
      state: "FL",
      zipCode: "32757",
      latitude: 28.8025,
      longitude: -81.6445,
      geocodedAt: new Date("2026-07-23T12:00:00.000Z"),
    };

    const result = await verifyJobRecordingLocation({
      vendorId: "vendor-1",
      metadata,
      vendorLocation: changedVendorProfile,
      proof: { latitude: 28.53831, longitude: -81.37919, accuracyMeters: 20 },
    });

    expect(result).toMatchObject({ ok: true, location: "business" });
  });

  it("does not fall back from a customer residence to the vendor profile", async () => {
    const result = await verifyJobRecordingLocation({
      vendorId: "vendor-1",
      metadata: JSON.stringify({ vendor_job_recording_location: "residence" }),
      vendorLocation: {
        address: "100 Vendor Ave",
        city: "Orlando",
        state: "FL",
        zipCode: "32801",
        latitude: 28.5383,
        longitude: -81.3792,
      },
      proof: { latitude: 28.5383, longitude: -81.3792, accuracyMeters: 20 },
    });
    expect(result).toMatchObject({
      ok: false,
      code: "CUSTOMER_RESIDENCE_LOCATION_NOT_CONFIGURED",
    });
  });

  it("does not accept a residence snapshot for a customer business selection", async () => {
    const result = await verifyJobRecordingLocation({
      vendorId: "vendor-1",
      metadata: JSON.stringify({
        vendor_job_recording_location: "customer-business",
        vendor_job_recording_location_snapshot: {
          type: "residence",
          source: "customer_profile",
          status: "verified_coordinates",
          address: "407 Boxwood Circle",
          city: "Winter Springs",
          state: "FL",
          zip_code: "32708",
          latitude: 28.7,
          longitude: -81.3,
          captured_at: "2026-08-11T12:00:00.000Z",
        },
      }),
      vendorLocation: null,
      proof: { latitude: 28.7, longitude: -81.3, accuracyMeters: 20 },
    });
    expect(result).toMatchObject({
      ok: false,
      code: "CUSTOMER_BUSINESS_LOCATION_NOT_CONFIGURED",
    });
  });

  it("does not accept a customer location for a vendor business selection", async () => {
    const result = await verifyJobRecordingLocation({
      vendorId: "vendor-1",
      metadata: JSON.stringify({
        vendor_job_recording_location: "business",
        vendor_job_recording_location_snapshot: {
          type: "business",
          source: "customer_supplied",
          status: "verified_coordinates",
          address: "123 Customer Rd",
          city: "Orlando",
          state: "FL",
          zip_code: "32801",
          latitude: 28.5383,
          longitude: -81.3792,
          captured_at: "2026-08-11T12:00:00.000Z",
        },
      }),
      vendorLocation: null,
      proof: { latitude: 28.5383, longitude: -81.3792, accuracyMeters: 20 },
    });
    expect(result).toMatchObject({ ok: false, code: "BUSINESS_LOCATION_NOT_CONFIGURED" });
  });
});
