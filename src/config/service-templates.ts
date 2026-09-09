export type ServiceTemplate = {
  name: string;
  defaultDuration: number;
};

export const SERVICE_TEMPLATES: Record<string, ServiceTemplate[]> = {
  'Automotive Repair': [
    { name: 'Engine Repair', defaultDuration: 120 },
    { name: 'Transmission Service', defaultDuration: 180 },
    { name: 'Brake Service', defaultDuration: 75 },
    { name: 'Oil Change', defaultDuration: 30 },
    { name: 'Tire Service', defaultDuration: 45 },
    { name: 'Electrical System Diagnostic', defaultDuration: 60 },
    { name: 'Hybrid/Electric Vehicle Service', defaultDuration: 90 },
    { name: 'Diesel Engine Service', defaultDuration: 120 },
  ],
  'Automotive Detailing': [
    { name: 'Interior Detailing', defaultDuration: 120 },
    { name: 'Exterior Detailing', defaultDuration: 90 },
    { name: 'Paint Correction', defaultDuration: 180 },
    { name: 'Ceramic Coating', defaultDuration: 240 },
    { name: 'Headlight Restoration', defaultDuration: 60 },
    { name: 'Odor Removal', defaultDuration: 60 },
    { name: 'Fabric Protection', defaultDuration: 60 },
  ],
  Adjuster: [
    { name: 'Property Damage Inspection', defaultDuration: 90 },
    { name: 'Claim Documentation Review', defaultDuration: 75 },
    { name: 'Auto Claim Inspection', defaultDuration: 75 },
    { name: 'Liability Claim Review', defaultDuration: 75 },
    { name: 'Catastrophe Response Inspection', defaultDuration: 120 },
    { name: 'Settlement Support Consultation', defaultDuration: 60 },
  ],
  Barber: [
    { name: 'Haircut', defaultDuration: 30 },
    { name: 'Beard Trim', defaultDuration: 20 },
    { name: 'Fade', defaultDuration: 40 },
    { name: 'Classic Cut', defaultDuration: 30 },
    { name: 'Hair Styling', defaultDuration: 45 },
    { name: 'Hair Color Service', defaultDuration: 90 },
    { name: 'Kids Cut', defaultDuration: 25 },
  ],
  'Body Shop': [
    { name: 'Collision Repair Estimate', defaultDuration: 60 },
    { name: 'Paint Repair', defaultDuration: 120 },
    { name: 'Dent Removal', defaultDuration: 90 },
    { name: 'Frame Straightening', defaultDuration: 180 },
    { name: 'Bumper Repair', defaultDuration: 120 },
    { name: 'Insurance Repair Documentation', defaultDuration: 60 },
  ],
  'Car Wash': [
    { name: 'Exterior Wash', defaultDuration: 30 },
    { name: 'Full Interior Cleaning', defaultDuration: 45 },
    { name: 'Mobile Car Wash', defaultDuration: 60 },
    { name: 'Fleet Wash', defaultDuration: 120 },
    { name: 'Wax and Protect', defaultDuration: 60 },
    { name: 'Ceramic Coating', defaultDuration: 180 },
  ],
  Contractors: [
    { name: 'General Contracting Consultation', defaultDuration: 60 },
    { name: 'Kitchen Remodeling Estimate', defaultDuration: 90 },
    { name: 'Bathroom Remodeling Estimate', defaultDuration: 90 },
    { name: 'Deck Building Estimate', defaultDuration: 75 },
    { name: 'Fence Installation Estimate', defaultDuration: 60 },
    { name: 'Drywall Repair', defaultDuration: 120 },
    { name: 'Flooring Installation Estimate', defaultDuration: 75 },
  ],
  Dealership: [
    { name: 'Vehicle Purchase Consultation', defaultDuration: 60 },
    { name: 'Trade-In Appraisal', defaultDuration: 45 },
    { name: 'Finance Application Support', defaultDuration: 50 },
    { name: 'Used Vehicle Walkthrough', defaultDuration: 45 },
    { name: 'Commercial Vehicle Consultation', defaultDuration: 60 },
    { name: 'Service Department Visit', defaultDuration: 60 },
  ],
  Electrician: [
    { name: 'Outlet Installation', defaultDuration: 60 },
    { name: 'Panel Inspection', defaultDuration: 90 },
    { name: 'Lighting Installation', defaultDuration: 75 },
    { name: 'Electrical Repair', defaultDuration: 90 },
    { name: 'Panel Upgrade Estimate', defaultDuration: 90 },
    { name: 'Smart Home Wiring', defaultDuration: 120 },
    { name: 'Emergency Electrical Service', defaultDuration: 90 },
  ],
  'Electronic Device Repair': [
    { name: 'Screen Replacement', defaultDuration: 60 },
    { name: 'Battery Replacement', defaultDuration: 45 },
    { name: 'Diagnostic Service', defaultDuration: 30 },
    { name: 'Phone Repair', defaultDuration: 60 },
    { name: 'Tablet Repair', defaultDuration: 60 },
    { name: 'Laptop Repair', defaultDuration: 90 },
    { name: 'Data Recovery', defaultDuration: 120 },
  ],
  'HVAC Heating and Air Conditioning': [
    { name: 'AC Installation', defaultDuration: 240 },
    { name: 'AC Repair', defaultDuration: 90 },
    { name: 'Heating Installation', defaultDuration: 240 },
    { name: 'Heating Repair', defaultDuration: 90 },
    { name: 'Maintenance Visit', defaultDuration: 60 },
    { name: 'Duct Cleaning', defaultDuration: 180 },
    { name: 'Thermostat Installation', defaultDuration: 45 },
    { name: 'Ductless System Service', defaultDuration: 120 },
  ],
  'Home cleaners': [
    { name: 'Regular Cleaning', defaultDuration: 120 },
    { name: 'Deep Cleaning', defaultDuration: 180 },
    { name: 'Move-in/Move-out Cleaning', defaultDuration: 240 },
    { name: 'Post-construction Cleaning', defaultDuration: 240 },
    { name: 'Carpet Cleaning', defaultDuration: 120 },
    { name: 'Window Cleaning', defaultDuration: 90 },
    { name: 'Pressure Washing', defaultDuration: 120 },
  ],
  'Hair/Nail Salon': [
    { name: 'Classic Manicure', defaultDuration: 45 },
    { name: 'Pedicure', defaultDuration: 60 },
    { name: 'Hair Styling', defaultDuration: 60 },
    { name: 'Haircut', defaultDuration: 45 },
    { name: 'Hair Coloring', defaultDuration: 120 },
    { name: 'Nail Art', defaultDuration: 60 },
    { name: 'Hair Treatment', defaultDuration: 75 },
    { name: 'Extensions', defaultDuration: 150 },
    { name: 'Gel Polish Service', defaultDuration: 60 },
    { name: 'Acrylic Nails', defaultDuration: 90 },
    { name: 'Nail Repair', defaultDuration: 30 },
    { name: 'Dip Powder Nails', defaultDuration: 75 },
    { name: 'Natural Nail Care', defaultDuration: 45 },
  ],
  Landscaping: [
    { name: 'Lawn Maintenance', defaultDuration: 60 },
    { name: 'Garden Cleanup', defaultDuration: 120 },
    { name: 'Tree Trimming', defaultDuration: 150 },
    { name: 'Landscape Design Consultation', defaultDuration: 90 },
    { name: 'Irrigation System Service', defaultDuration: 120 },
    { name: 'Hardscaping Estimate', defaultDuration: 90 },
    { name: 'Seasonal Cleanup', defaultDuration: 180 },
  ],
  Locksmith: [
    { name: 'Lock Installation', defaultDuration: 60 },
    { name: 'Lock Repair', defaultDuration: 45 },
    { name: 'Key Duplication', defaultDuration: 20 },
    { name: 'Emergency Lockout Service', defaultDuration: 45 },
    { name: 'Security System Service', defaultDuration: 90 },
    { name: 'Safe Service', defaultDuration: 90 },
  ],
  'Medical Services': [
    { name: 'Primary Care Visit', defaultDuration: 45 },
    { name: 'Specialty Care Visit', defaultDuration: 60 },
    { name: 'Diagnostic Service', defaultDuration: 60 },
    { name: 'Preventive Care Visit', defaultDuration: 45 },
    { name: 'Telemedicine Visit', defaultDuration: 30 },
  ],
  'Moving Services': [
    { name: 'Residential Moving', defaultDuration: 240 },
    { name: 'Commercial Moving', defaultDuration: 360 },
    { name: 'Packing Service', defaultDuration: 180 },
    { name: 'Storage Move', defaultDuration: 180 },
    { name: 'Furniture Assembly', defaultDuration: 90 },
    { name: 'Long-distance Moving Estimate', defaultDuration: 90 },
    { name: 'Specialty Item Moving', defaultDuration: 120 },
  ],
  'Pool Cleaning Services': [
    { name: 'Regular Pool Cleaning', defaultDuration: 60 },
    { name: 'Chemical Balancing', defaultDuration: 45 },
    { name: 'Equipment Repair', defaultDuration: 90 },
    { name: 'Pool Opening/Closing', defaultDuration: 120 },
    { name: 'Algae Treatment', defaultDuration: 90 },
    { name: 'Filter Cleaning', defaultDuration: 60 },
  ],
  'Pet Grooming': [
    { name: 'Dog Bath and Brush', defaultDuration: 60 },
    { name: 'Full Grooming Service', defaultDuration: 90 },
    { name: 'Nail Trim', defaultDuration: 20 },
    { name: 'Cat Grooming', defaultDuration: 75 },
    { name: 'Ear Cleaning', defaultDuration: 20 },
    { name: 'De-shedding Treatment', defaultDuration: 60 },
    { name: 'Mobile Grooming Visit', defaultDuration: 90 },
  ],
  Plumbing: [
    { name: 'Drain Cleaning', defaultDuration: 60 },
    { name: 'Faucet Repair', defaultDuration: 45 },
    { name: 'Water Heater Service', defaultDuration: 90 },
    { name: 'Pipe Repair', defaultDuration: 90 },
    { name: 'Fixture Installation', defaultDuration: 75 },
    { name: 'Emergency Plumbing', defaultDuration: 90 },
    { name: 'Sewer Line Service', defaultDuration: 120 },
    { name: 'Gas Line Service', defaultDuration: 120 },
  ],
  'Painting Services': [
    { name: 'Interior Painting', defaultDuration: 240 },
    { name: 'Exterior Painting', defaultDuration: 360 },
    { name: 'Commercial Painting', defaultDuration: 360 },
    { name: 'Residential Painting', defaultDuration: 240 },
    { name: 'Cabinet Painting', defaultDuration: 240 },
    { name: 'Deck Staining', defaultDuration: 180 },
    { name: 'Wallpaper Installation', defaultDuration: 180 },
  ],
  'Pest/Exterminating Services': [
    { name: 'Pest Control', defaultDuration: 60 },
    { name: 'Termite Treatment', defaultDuration: 120 },
    { name: 'Rodent Control', defaultDuration: 90 },
    { name: 'Bed Bug Treatment', defaultDuration: 120 },
    { name: 'Preventive Pest Service', defaultDuration: 60 },
    { name: 'Commercial Pest Control', defaultDuration: 90 },
  ],
  'Security Installation': [
    { name: 'Security System Installation', defaultDuration: 180 },
    { name: 'CCTV Installation', defaultDuration: 180 },
    { name: 'Access Control Installation', defaultDuration: 180 },
    { name: 'Alarm System Service', defaultDuration: 120 },
    { name: 'Monitoring Setup', defaultDuration: 90 },
    { name: 'Commercial Security Consultation', defaultDuration: 90 },
  ],
  'Roofing Services': [
    { name: 'Roof Installation Estimate', defaultDuration: 90 },
    { name: 'Roof Repair', defaultDuration: 180 },
    { name: 'Roof Inspection', defaultDuration: 60 },
    { name: 'Gutter Service', defaultDuration: 120 },
    { name: 'Skylight Installation', defaultDuration: 180 },
    { name: 'Emergency Roof Repair', defaultDuration: 180 },
    { name: 'Roof Maintenance', defaultDuration: 120 },
  ],
  Towing: [
    { name: 'Emergency Towing', defaultDuration: 45 },
    { name: 'Long-distance Towing', defaultDuration: 120 },
    { name: 'Roadside Assistance', defaultDuration: 45 },
    { name: 'Vehicle Recovery', defaultDuration: 90 },
    { name: 'Commercial Towing', defaultDuration: 90 },
    { name: 'Heavy Duty Towing', defaultDuration: 120 },
  ],
  'Tree Services': [
    { name: 'Tree Removal', defaultDuration: 180 },
    { name: 'Tree Trimming', defaultDuration: 150 },
    { name: 'Stump Grinding', defaultDuration: 90 },
    { name: 'Emergency Tree Service', defaultDuration: 180 },
    { name: 'Tree Planting', defaultDuration: 120 },
    { name: 'Arborist Consultation', defaultDuration: 60 },
  ],
};

export type VendorCategoryDefinition = {
  key: string;
  label: string;
  aliases: readonly string[];
  serviceTemplates: readonly ServiceTemplate[];
  registrationAvailable: boolean;
  specialtySuggestions: boolean;
};

type CategoryMetadata = Omit<VendorCategoryDefinition, 'serviceTemplates'>;

const CATEGORY_METADATA: readonly CategoryMetadata[] = [
  { key: 'automotive-repair', label: 'Automotive Repair', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'automotive-detailing', label: 'Automotive Detailing', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'adjuster', label: 'Adjuster', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'barber', label: 'Barber', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'body-shop', label: 'Body Shop', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'car-wash', label: 'Car Wash', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'contractors', label: 'Contractors', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'dealership', label: 'Dealership', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'electrician', label: 'Electrician', aliases: ['Electrical', 'Electrical Services', 'Electrical service'], registrationAvailable: true, specialtySuggestions: true },
  { key: 'electronic-device-repair', label: 'Electronic Device Repair', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'hvac-heating-and-air-conditioning', label: 'HVAC Heating and Air Conditioning', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'home-cleaners', label: 'Home cleaners', aliases: ['Cleaning'], registrationAvailable: true, specialtySuggestions: true },
  { key: 'hair-nail-salon', label: 'Hair/Nail Salon', aliases: ['Nail Salon'], registrationAvailable: true, specialtySuggestions: true },
  { key: 'landscaping', label: 'Landscaping', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'locksmith', label: 'Locksmith', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'medical-services', label: 'Medical Services', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'moving-services', label: 'Moving Services', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'pool-cleaning-services', label: 'Pool Cleaning Services', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'pet-grooming', label: 'Pet Grooming', aliases: ['Pet Groomers'], registrationAvailable: true, specialtySuggestions: true },
  { key: 'plumbing', label: 'Plumbing', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'painting-services', label: 'Painting Services', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'pest-exterminating-services', label: 'Pest/Exterminating Services', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'security-installation', label: 'Security Installation', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'roofing-services', label: 'Roofing Services', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'towing', label: 'Towing', aliases: [], registrationAvailable: true, specialtySuggestions: true },
  { key: 'tree-services', label: 'Tree Services', aliases: [], registrationAvailable: true, specialtySuggestions: true },
];

export const CUSTOM_VENDOR_CATEGORY = 'Other';

export const CANONICAL_VENDOR_CATEGORY_REGISTRY: readonly VendorCategoryDefinition[] = CATEGORY_METADATA.map(
  (category) => ({
    ...category,
    serviceTemplates: SERVICE_TEMPLATES[category.label] || [],
  }),
);

export const CANONICAL_VENDOR_CATEGORY_LABELS = CANONICAL_VENDOR_CATEGORY_REGISTRY.map(
  (category) => category.label,
);

export const VENDOR_REGISTRATION_CATEGORY_OPTIONS = [
  ...CANONICAL_VENDOR_CATEGORY_LABELS,
  CUSTOM_VENDOR_CATEGORY,
];

function normalizeCategory(value: string | null | undefined): string {
  return String(value || '').trim().toLocaleLowerCase('en-US');
}

const CATEGORY_LOOKUP = new Map<string, VendorCategoryDefinition>();
for (const category of CANONICAL_VENDOR_CATEGORY_REGISTRY) {
  CATEGORY_LOOKUP.set(normalizeCategory(category.key), category);
  CATEGORY_LOOKUP.set(normalizeCategory(category.label), category);
  for (const alias of category.aliases) {
    CATEGORY_LOOKUP.set(normalizeCategory(alias), category);
  }
}

export function resolveVendorCategory(
  value: string | null | undefined,
): VendorCategoryDefinition | null {
  return CATEGORY_LOOKUP.get(normalizeCategory(value)) || null;
}

export function canonicalizeVendorCategory(value: string | null | undefined): string | null {
  return resolveVendorCategory(value)?.label || null;
}

export function canonicalizeVendorRegistrationCategory(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeCategory(value);
  if (normalized === normalizeCategory(CUSTOM_VENDOR_CATEGORY)) {
    return CUSTOM_VENDOR_CATEGORY;
  }
  return canonicalizeVendorCategory(value);
}

export function getVendorCategoryAcceptedValues(
  value: string | null | undefined,
): string[] {
  const category = resolveVendorCategory(value);
  if (category) {
    return [category.label, ...category.aliases];
  }
  const raw = String(value || '').trim();
  return raw ? [raw] : [];
}

export function getServiceTemplatesForCategory(category: string | null | undefined): ServiceTemplate[] {
  const resolved = resolveVendorCategory(category);
  return resolved ? [...resolved.serviceTemplates] : [];
}
