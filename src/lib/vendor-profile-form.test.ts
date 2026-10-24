import { describe, expect, it } from "vitest";

import { validateVendorProfileForm } from "@/lib/vendor-profile-form";

const validProfile = {
  businessName: "Electro LLC",
  businessType: "Electrical",
  category: "Electrical",
  address: "407 Boxwood Circle",
  city: "Winter Springs",
  state: "FL",
  zipCode: "32708",
  email: "manager@example.com",
  phone: "407-555-0100",
};

describe("validateVendorProfileForm", () => {
  it("identifies every missing required profile field at once", () => {
    const errors = validateVendorProfileForm({}, 2026);

    expect(Object.keys(errors)).toEqual([
      "businessName",
      "businessType",
      "category",
      "address",
      "city",
      "state",
      "zipCode",
      "email",
      "phone",
    ]);
  });

  it("rejects malformed public contact data and future founded years", () => {
    expect(validateVendorProfileForm({
      ...validProfile,
      email: "invalid",
      website: "example.com",
      foundedYear: 2027,
    }, 2026)).toMatchObject({
      email: "Enter a valid email address.",
      website: "Enter a valid website URL beginning with http:// or https://.",
      foundedYear: "Founded Year must be a four-digit year no later than 2026.",
    });
  });

  it("accepts a complete current profile", () => {
    expect(validateVendorProfileForm({
      ...validProfile,
      website: "https://example.com",
      foundedYear: 2020,
    }, 2026)).toEqual({});
  });
});
