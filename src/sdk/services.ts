import { api } from '../lib/api';
import type {
  Service,
  CreateServiceDTO,
  UpdateServiceDTO,
  Pagination
} from '../types/api';

// Services SDK
export const servicesSDK = {
  // Get all services with filters
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

  // Get service by ID
  async getService(id: string): Promise<Service> {
    return api.get<Service>(`/api/services/${id}`);
  },

  // Create new service
  async createService(serviceData: CreateServiceDTO): Promise<{ success: boolean; service: Service }> {
    return api.post<{ success: boolean; service: Service }>('/api/services', serviceData);
  },

  // Update service
  async updateService(id: string, serviceData: UpdateServiceDTO): Promise<{ success: boolean; service: Service }> {
    return api.put<{ success: boolean; service: Service }>(`/api/services/${id}`, serviceData);
  },

  // Delete service
  async deleteService(id: string): Promise<{ success: boolean }> {
    return api.delete<{ success: boolean }>(`/api/services/${id}`);
  },

  // Get popular services
  async getPopularServices(limit?: number): Promise<{ services: Service[] }> {
    return api.get<{ services: Service[] }>('/api/services/popular', { limit });
  },

  // Get services by category
  async getServicesByCategory(category: string, params?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ services: Service[]; pagination: Pagination }> {
    return api.get<{ services: Service[]; pagination: Pagination }>(`/api/services/category/${category}`, params);
  },

  // Get services by vendor
  async getServicesByVendor(vendorId: string, params?: {
    page?: number;
    limit?: number;
    available?: boolean;
  }): Promise<{ services: Service[]; pagination: Pagination }> {
    return api.get<{ services: Service[]; pagination: Pagination }>(`/api/services/vendor/${vendorId}`, params);
  },

  // Get service categories
  async getCategories(): Promise<{ categories: string[] }> {
    return api.get<{ categories: string[] }>('/api/services/categories');
  },

  // Search services
  async searchServices(query: string, params?: {
    category?: string;
    location?: string;
    priceRange?: { min: number; max: number };
    rating?: number;
    page?: number;
    limit?: number;
  }): Promise<{ services: Service[]; pagination: Pagination }> {
    return api.get<{ services: Service[]; pagination: Pagination }>('/api/services/search', {
      q: query,
      ...params
    });
  },

  // Upload service media
  async uploadServiceMedia(serviceId: string, mediaFile: File): Promise<{ success: boolean; mediaId: string; url: string }> {
    const formData = new FormData();
    formData.append('media', mediaFile);
    
    return api.post<{ success: boolean; mediaId: string; url: string }>(
      `/api/services/${serviceId}/media`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  // Delete service media
  async deleteServiceMedia(serviceId: string, mediaId: string): Promise<{ success: boolean }> {
    return api.delete<{ success: boolean }>(`/api/services/${serviceId}/media/${mediaId}`);
  }
};

// Export individual functions for convenience
export const {
  listServices,
  getService,
  createService,
  updateService,
  deleteService,
  getPopularServices,
  getServicesByCategory,
  getServicesByVendor,
  getCategories,
  searchServices,
  uploadServiceMedia,
  deleteServiceMedia
} = servicesSDK;


