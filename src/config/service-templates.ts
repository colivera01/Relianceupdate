export type ServiceTemplate = {
  name: string;
  defaultDuration: number;
};

export const SERVICE_TEMPLATES: Record<string, ServiceTemplate[]> = {
  Cleaning: [
    { name: 'Deep Cleaning', defaultDuration: 180 },
    { name: 'Standard Cleaning', defaultDuration: 120 },
    { name: 'Move-in/Move-out Cleaning', defaultDuration: 240 },
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
