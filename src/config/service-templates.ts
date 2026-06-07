export type ServiceTemplate = {
  name: string;
  defaultDuration: number;
};

export const SERVICE_TEMPLATES: Record<string, ServiceTemplate[]> = {
  Adjuster: [
    { name: 'Property Damage Inspection', defaultDuration: 90 },
    { name: 'Claim Documentation Review', defaultDuration: 75 },
    { name: 'Settlement Support Consultation', defaultDuration: 60 },
  ],
  'Body Shop': [
    { name: 'Collision Repair Estimate', defaultDuration: 60 },
    { name: 'Paint Repair', defaultDuration: 120 },
    { name: 'Dent Removal', defaultDuration: 90 },
  ],
  Cleaning: [
    { name: 'Deep Cleaning', defaultDuration: 180 },
    { name: 'Standard Cleaning', defaultDuration: 120 },
    { name: 'Move-in/Move-out Cleaning', defaultDuration: 240 },
  ],
  'Car Wash': [
    { name: 'Exterior Wash', defaultDuration: 30 },
    { name: 'Full Interior Cleaning', defaultDuration: 45 },
    { name: 'Wax and Protect', defaultDuration: 60 },
  ],
  Dealership: [
    { name: 'Vehicle Purchase Consultation', defaultDuration: 60 },
    { name: 'Trade-In Appraisal', defaultDuration: 45 },
    { name: 'Finance Application Support', defaultDuration: 50 },
  ],
  Barber: [
    { name: 'Haircut', defaultDuration: 30 },
    { name: 'Beard Trim', defaultDuration: 20 },
    { name: 'Fade', defaultDuration: 40 },
  ],
  Plumbing: [
    { name: 'Drain Cleaning', defaultDuration: 60 },
    { name: 'Faucet Repair', defaultDuration: 45 },
    { name: 'Water Heater Service', defaultDuration: 90 },
  ],
  Electrician: [
    { name: 'Outlet Installation', defaultDuration: 60 },
    { name: 'Panel Inspection', defaultDuration: 90 },
    { name: 'Lighting Installation', defaultDuration: 75 },
  ],
  'Electronic Device Repair': [
    { name: 'Screen Replacement', defaultDuration: 60 },
    { name: 'Battery Replacement', defaultDuration: 45 },
    { name: 'Diagnostic Service', defaultDuration: 30 },
  ],
  Landscaping: [
    { name: 'Lawn Maintenance', defaultDuration: 60 },
    { name: 'Garden Cleanup', defaultDuration: 120 },
    { name: 'Tree Trimming', defaultDuration: 150 },
  ],
};

export function getServiceTemplatesForCategory(category: string | null | undefined): ServiceTemplate[] {
  const key = String(category || '').trim();
  return key ? SERVICE_TEMPLATES[key] || [] : [];
}
