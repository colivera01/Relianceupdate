import { SERVICE_TEMPLATES } from '@/config/service-templates';

const PROFILE_CATEGORY_ALIASES: Record<string, string> = {
  electrical: 'Electrician',
  'electrical services': 'Electrician',
};

function resolveTemplateCategory(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;

  const aliased = PROFILE_CATEGORY_ALIASES[normalized.toLowerCase()];
  if (aliased) return aliased;

  return (
    Object.keys(SERVICE_TEMPLATES).find(
      (category) => category.toLowerCase() === normalized.toLowerCase()
    ) || null
  );
}

export function getVendorSpecialtyOptions(input: {
  category?: string | null;
  businessType?: string | null;
  selectedServiceTypes?: string[] | null;
}): string[] {
  const selected = (input.selectedServiceTypes || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  const templateCategory =
    resolveTemplateCategory(input.category) || resolveTemplateCategory(input.businessType);
  const categoryOptions = templateCategory
    ? SERVICE_TEMPLATES[templateCategory].map((template) => template.name)
    : [];

  return Array.from(new Set([...selected, ...categoryOptions]));
}
