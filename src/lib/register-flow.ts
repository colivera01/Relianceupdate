import { getServiceTemplatesForCategory } from '@/config/service-templates';

export type RegisterRole = 'user' | 'vendor';

export type RegisterFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  smsConsent: boolean;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bio: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  businessType: string;
  category: string;
  businessBio: string;
  foundedYear: string;
  totalEmployees: string;
  yearsInBusiness: string;
  responseTime: string;
  serviceDescription: string;
  serviceTypes: string[];
  specializations: string[];
  serviceAreas: string[];
  profilePhoto: string;
  insuranceProvider: string;
  insuranceExpiry: string;
  licenseNumber: string;
  insuranceStatus: boolean;
  bondingStatus: boolean;
  website: string;
  emergencyContact: string;
};

export type TemplateServiceDetailDraft = {
  defaultDuration: string;
  price: string;
  description: string;
};

export type SelectedTemplateServicePayload = {
  name: string;
  defaultDuration?: number;
  price?: number;
  description?: string;
  source: 'template';
};

const EMPTY_TEMPLATE_SERVICE_DETAIL: TemplateServiceDetailDraft = {
  defaultDuration: '',
  price: '',
  description: '',
};

export function createInitialRegisterFormData(): RegisterFormData {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    smsConsent: false,
    address: '',
    city: '',
    state: '',
    zipCode: '',
    bio: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    businessType: '',
    category: '',
    businessBio: '',
    foundedYear: '',
    totalEmployees: '',
    yearsInBusiness: '',
    responseTime: '',
    serviceDescription: '',
    serviceTypes: [],
    specializations: [],
    serviceAreas: [],
    profilePhoto: '',
    insuranceProvider: '',
    insuranceExpiry: '',
    licenseNumber: '',
    insuranceStatus: false,
    bondingStatus: false,
    website: '',
    emergencyContact: '',
  };
}

export function getRegisterFormDataForRoleSwitch(
  current: RegisterFormData,
  nextRole: RegisterRole,
): RegisterFormData {
  const base = createInitialRegisterFormData();

  return {
    ...base,
    firstName: current.firstName,
    lastName: current.lastName,
    email: current.email,
    phone: current.phone,
    smsConsent: current.smsConsent,
    address: current.address,
    city: current.city,
    state: current.state,
    zipCode: current.zipCode,
    password: current.password,
    confirmPassword: current.confirmPassword,
    bio: nextRole === 'user' ? current.bio : '',
  };
}

function parsePositiveNumber(value: string | undefined) {
  const normalized = String(value || '').trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseNonNegativeNumber(value: string | undefined) {
  const normalized = String(value || '').trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function getTemplateServiceDefaultDetail(
  category: string,
  serviceType: string,
): TemplateServiceDetailDraft {
  const matchingTemplate = getServiceTemplatesForCategory(category).find(
    (template) => template.name === serviceType,
  );

  return {
    ...EMPTY_TEMPLATE_SERVICE_DETAIL,
    defaultDuration: matchingTemplate ? String(matchingTemplate.defaultDuration) : '',
  };
}

export function buildSelectedTemplateServices(params: {
  category: string;
  serviceTypes: string[];
  nameOverrides: Record<string, string>;
  detailDrafts: Record<string, TemplateServiceDetailDraft>;
}): SelectedTemplateServicePayload[] {
  const templateDefaults = new Map(
    getServiceTemplatesForCategory(params.category).map((template) => [
      template.name,
      template.defaultDuration,
    ]),
  );

  const selectedServices: SelectedTemplateServicePayload[] = [];

  for (const serviceType of params.serviceTypes) {
      const name = String(params.nameOverrides[serviceType] || serviceType).trim();
      if (!name) continue;

      const detailDraft = params.detailDrafts[serviceType] || EMPTY_TEMPLATE_SERVICE_DETAIL;
      const defaultDuration =
        parsePositiveNumber(detailDraft.defaultDuration) ?? templateDefaults.get(serviceType);
      const price = parseNonNegativeNumber(detailDraft.price);
      const description = String(detailDraft.description || '').trim() || undefined;

      selectedServices.push({
        name,
        defaultDuration,
        price,
        description,
        source: 'template' as const,
      });
  }

  return selectedServices;
}
