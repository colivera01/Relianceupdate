import { api } from '../lib/api';
import type {
  Service,
  CreateServiceDTO,
  UpdateServiceDTO,
  Pagination,
  DiscoverServicesResponse,
  PublicCategoriesResponse
} from '../types/api';

/**
 * Services SDK — Next.js App Router routes under `/api/services/*`.
 *
 * **Canonical product paths:** `discoverServices` → `GET /api/services/discover`; `getService` → `GET /api/services/[id]`; `getCategories` → `GET /api/services/categories`. `listServices` hits the legacy mock list route.
 * **Service media uploads:** use vendor APIs (`/api/vendors/[vendorId]/media/...`), not this module.
 * **Service search across vendors:** use `searchSDK.searchServices` → `GET /api/search` (not `/api/services/search`).
 */

export const servicesSDK = {
  async listServices(params?: {
    search?: string;
    category?: string;
    vendorId?: string;
    priceMin?: number;
    priceMax?: number;
    location?: string;
    rating?: number;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ services: Service[]; pagination: Pagination }> {
    return api.get<{ services: Service[]; pagination: Pagination }>('/api/services', params);
  },

  async getService(id: string): Promise<Service> {
    const res = await api.get<{ service?: Service } & Record<string, unknown>>(`/api/services/${id}`);
    const wrapped = res?.service;
    if (wrapped != null) {
      return wrapped as Service;
    }
    if (res && typeof res === 'object' && 'id' in res && 'name' in res) {
      return res as unknown as Service;
    }
    throw new Error('Invalid service response');
  },

  /** POST `/api/services` — body uses snake_case `vendor_id` per route. */
  async createService(
    serviceData: CreateServiceDTO & { vendorId?: string | number; vendor_id?: string | number }
  ): Promise<{ success: boolean; service: Service }> {
    const vendor_id = serviceData.vendor_id ?? serviceData.vendorId;
    if (vendor_id === undefined || vendor_id === null || String(vendor_id).trim() === '') {
      throw new Error('createService requires vendor_id or vendorId');
    }
    return api.post<{ success: boolean; service: Service }>('/api/services', {
      name: serviceData.name,
      description: serviceData.description,
      category: serviceData.category,
      price: serviceData.price,
      duration: serviceData.duration,
      features: serviceData.features,
      inclusions: serviceData.inclusions,
      images: serviceData.images ?? [],
      vendor_id,
    });
  },

  async updateService(id: string, serviceData: UpdateServiceDTO): Promise<{ success: boolean; service: Service }> {
    return api.put<{ success: boolean; service: Service }>(`/api/services/${id}`, serviceData);
  },

  async deleteService(id: string): Promise<{ success: boolean }> {
    return api.delete<{ success: boolean }>(`/api/services/${id}`);
  },

  async getCategories(): Promise<PublicCategoriesResponse> {
    return api.get<PublicCategoriesResponse>('/api/services/categories');
  },

  async discoverServices(params?: {
    q?: string;
    category?: string;
    sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'name';
    page?: number;
    limit?: number;
  }): Promise<DiscoverServicesResponse> {
    return api.get<DiscoverServicesResponse>('/api/services/discover', params);
  },
};

export const {
  listServices,
  getService,
  createService,
  updateService,
  deleteService,
  getCategories,
  discoverServices,
} = servicesSDK;
