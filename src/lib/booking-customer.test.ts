import { describe, expect, it } from "vitest";
import { resolveBookingCustomer } from "./booking-customer";

describe("resolveBookingCustomer", () => {
  it("keeps the customer saved on the work order ahead of a linked account", () => {
    expect(
      resolveBookingCustomer({
        clientName: "Emily Matos",
        customerMetadata: JSON.stringify({
          client_name: "Emily Matos",
          client_email: "emily@example.com",
          client_phone: "4075550101",
        }),
        user: { id: "linked-user", name: "Ivan Olivera", email: "ivan@example.com", phone: "4075550102" },
      })
    ).toEqual({
      id: "linked-user",
      name: "Emily Matos",
      email: "emily@example.com",
      phone: "4075550101",
    });
  });
});
