import { getVendorCategoryAcceptedValues } from '@/config/service-templates';

export function buildVendorCategoryFilter(value: string) {
  const acceptedValues = getVendorCategoryAcceptedValues(value);
  return {
    OR: [
      { category: { in: acceptedValues } },
      { businessType: { in: acceptedValues } },
    ],
  };
}

export function buildServiceVendorCategoryFilter(value: string) {
  const acceptedValues = getVendorCategoryAcceptedValues(value);
  return {
    OR: [
      { vendor: { category: { in: acceptedValues } } },
      { vendor: { businessType: { in: acceptedValues } } },
    ],
  };
}

export function buildPromotionCategoryFilter(value: string) {
  const acceptedValues = getVendorCategoryAcceptedValues(value);
  return {
    OR: [
      { targetCategory: { in: acceptedValues } },
      { service: { vendor: { category: { in: acceptedValues } } } },
      { service: { vendor: { businessType: { in: acceptedValues } } } },
    ],
  };
}
