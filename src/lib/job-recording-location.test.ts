import { describe, expect, it } from "vitest";
import { verifyJobRecordingLocation } from "./job-recording-location";

const customerBusinessMetadata = JSON.stringify({
  vendor_job_recording_location: "customer-business",
  vendor_job_customer_business_address: "123 Main St",
  vendor_job_customer_business_city: "Orlando",
  vendor_job_customer_business_state: "FL",
  vendor_job_customer_business_zip_code: "32801",
  vendor_job_customer_business_latitude: 28.5383,
  vendor_job_customer_business_longitude: -81.3792,
  vendor_job_customer_business_geocoded_at: "2026-07-22T12:00:00.000Z",
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
});
