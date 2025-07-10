// Service catalog entry
export interface ServiceCatalogEntry {
  id: string;
  name: string;
  category?: string; // e.g., "Plumbing"
  active: boolean;
}

// Vendor profile
export interface VendorProfile {
  id: string;
  businessName: string;
  businessType: string; // must match a ServiceCatalogEntry or be 'pending'
  address: string;
  // ...other fields
}

// Pricing entry
export interface VendorPricing {
  vendorId: string;
  serviceId: string;
  price: number;
  custom?: boolean; // true if vendor-defined
} 