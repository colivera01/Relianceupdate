import { getServiceTemplatesForCategory } from '@/config/service-templates';

export function getVendorSpecialtyOptions(input: {
  category?: string | null;
  businessType?: string | null;
  selectedServiceTypes?: string[] | null;
}): string[] {
  const selected = (input.selectedServiceTypes || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  const categoryTemplates = getServiceTemplatesForCategory(input.category);
  const templates = categoryTemplates.length
    ? categoryTemplates
    : getServiceTemplatesForCategory(input.businessType);
  const categoryOptions = templates.map((template) => template.name);

  return Array.from(new Set([...selected, ...categoryOptions]));
}
