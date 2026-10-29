import { describe, expect, it } from "vitest";

import { mapBookingToContract } from "./booking-shape";

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    userId: "customer-1",
    vendorId: "vendor-1",
    serviceId: "service-1",
    title: "Outlet installation",
    clientName: "Customer",
    amount: 125,
    customerMetadata: JSON.stringify({ service_time_zone: "America/New_York" }),
    status: "CONFIRMED",
    scheduledFor: new Date("2026-11-05T14:00:00.000Z"),
    date: new Date("2026-11-05T14:00:00.000Z"),
    createdAt: new Date("2026-10-29T12:00:00.000Z"),
    updatedAt: new Date("2026-10-29T12:00:00.000Z"),
    service: {
      id: "service-1",
      name: "Outlet installation",
      description: "Install one outlet.",
      price: 125,
    },
    vendor: {
      id: "vendor-1",
      name: "Electro LLC",
      businessName: "Electro LLC",
    },
    ...overrides,
  };
}

describe("mapBookingToContract", () => {
  it("renders the canonical instant in the persisted service timezone", () => {
    const contract = mapBookingToContract(booking());

    expect(contract).toMatchObject({
      booking_date: "2026-11-05",
      booking_time: "09:00:00",
      scheduled_for: "2026-11-05T14:00:00.000Z",
      service_time_zone: "America/New_York",
    });
  });

  it("falls back to the platform service timezone when metadata is absent", () => {
    const contract = mapBookingToContract(
      booking({
        customerMetadata: null,
        scheduledFor: new Date("2026-07-06T13:30:00.000Z"),
        date: new Date("2026-07-06T13:30:00.000Z"),
      }),
    );

    expect(contract).toMatchObject({
      booking_date: "2026-07-06",
      booking_time: "09:30:00",
      scheduled_for: "2026-07-06T13:30:00.000Z",
      service_time_zone: "America/New_York",
    });
  });

  it("does not invent an appointment date for an unscheduled request", () => {
    const contract = mapBookingToContract(
      booking({
        scheduledFor: null,
        date: null,
      }),
    );

    expect(contract.booking_date).toBeNull();
    expect(contract.booking_time).toBeNull();
    expect(contract.scheduled_for).toBeNull();
  });
});
