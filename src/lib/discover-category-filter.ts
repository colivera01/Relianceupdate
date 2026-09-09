import { getVendorCategoryAcceptedValues } from '@/config/service-templates';

const FALLBACK_CATEGORY_LABEL = 'Other Services';
const FALLBACK_CATEGORY_KEY = 'other-services';
const LEGACY_FALLBACK_CATEGORY_LABEL = 'Uncategorized';

function isFallbackCategoryFilter(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === FALLBACK_CATEGORY_LABEL.toLowerCase() ||
    normalized === FALLBACK_CATEGORY_KEY ||
    normalized === LEGACY_FALLBACK_CATEGORY_LABEL.toLowerCase()
  );
}

export function buildDiscoverServiceCategoryFilter(category: string) {
  if (isFallbackCategoryFilter(category)) {
    return {
      OR: [
        { vendor: { category: FALLBACK_CATEGORY_LABEL } },
        { vendor: { businessType: FALLBACK_CATEGORY_LABEL } },
        { vendor: { category: LEGACY_FALLBACK_CATEGORY_LABEL } },
        { vendor: { businessType: LEGACY_FALLBACK_CATEGORY_LABEL } },
        { vendor: { category: null, businessType: null } },
        { vendor: { category: '', businessType: null } },
        { vendor: { category: null, businessType: '' } },
        { vendor: { category: '', businessType: '' } },
      ],
    };
  }

  const acceptedValues = getVendorCategoryAcceptedValues(category);
  return {
    OR: [
      { vendor: { category: { in: acceptedValues } } },
      { vendor: { businessType: { in: acceptedValues } } },
    ],
  };
}

export function buildDiscoverPromotionCategoryFilter(category: string) {
  if (isFallbackCategoryFilter(category)) {
    return {
      OR: [
        { targetCategory: null },
        { targetCategory: '' },
        { targetCategory: FALLBACK_CATEGORY_LABEL },
        { targetCategory: LEGACY_FALLBACK_CATEGORY_LABEL },
        { service: { vendor: { category: FALLBACK_CATEGORY_LABEL } } },
        { service: { vendor: { businessType: FALLBACK_CATEGORY_LABEL } } },
        { service: { vendor: { category: LEGACY_FALLBACK_CATEGORY_LABEL } } },
        { service: { vendor: { businessType: LEGACY_FALLBACK_CATEGORY_LABEL } } },
        { service: { vendor: { category: null, businessType: null } } },
        { service: { vendor: { category: '', businessType: null } } },
        { service: { vendor: { category: null, businessType: '' } } },
        { service: { vendor: { category: '', businessType: '' } } },
      ],
    };
  }

  const acceptedValues = getVendorCategoryAcceptedValues(category);
  return {
    OR: [
      { targetCategory: null },
      { targetCategory: '' },
      { targetCategory: { in: acceptedValues } },
      { service: { vendor: { category: { in: acceptedValues } } } },
      { service: { vendor: { businessType: { in: acceptedValues } } } },
    ],
  };
}
