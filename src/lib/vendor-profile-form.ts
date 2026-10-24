export const vendorProfileFieldLabels = {
  businessName: "Business Name",
  businessType: "Business Type",
  category: "Service Category",
  address: "Business Address",
  city: "City",
  state: "State",
  zipCode: "ZIP Code",
  email: "Email",
  phone: "Phone",
  website: "Website",
  foundedYear: "Founded Year",
} as const;

export type VendorProfileField = keyof typeof vendorProfileFieldLabels;
export type VendorProfileFieldErrors = Partial<Record<VendorProfileField, string>>;

const requiredFields: VendorProfileField[] = [
  "businessName",
  "businessType",
  "category",
  "address",
  "city",
  "state",
  "zipCode",
  "email",
  "phone",
];

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateVendorProfileForm(
  values: Partial<Record<VendorProfileField, unknown>>,
  currentYear = new Date().getFullYear(),
): VendorProfileFieldErrors {
  const errors: VendorProfileFieldErrors = {};

  for (const field of requiredFields) {
    if (!hasText(values[field])) {
      errors[field] = `${vendorProfileFieldLabels[field]} is required.`;
    }
  }

  if (hasText(values.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values.email).trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (hasText(values.website)) {
    try {
      const url = new URL(String(values.website).trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.website = "Website must begin with http:// or https://.";
      }
    } catch {
      errors.website = "Enter a valid website URL beginning with http:// or https://.";
    }
  }

  if (values.foundedYear !== undefined && values.foundedYear !== null && values.foundedYear !== "") {
    const year = Number(values.foundedYear);
    if (!Number.isInteger(year) || year < 1000 || year > currentYear) {
      errors.foundedYear = `Founded Year must be a four-digit year no later than ${currentYear}.`;
    }
  }

  return errors;
}
