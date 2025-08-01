import { pool } from '../config/database';
import { logger } from '../utils/logger';

// Service interface
export interface Service {
  id?: number;
  vendor_id: number;
  name: string;
  description?: string;
  price?: number;
  price_type?: string; // 'fixed', 'hourly', 'quote'
  category: string;
  duration_minutes?: number;
  availability?: any; // JSONB for complex availability data
  features?: string[];
  inclusions?: string[];
  images?: string[];
  videos?: string[];
  status?: string; // 'active', 'inactive', 'draft'
  created_at?: Date;
  updated_at?: Date;
}

// Service creation interface
export interface CreateServiceData {
  vendor_id: number;
  name: string;
  description?: string;
  price?: number;
  price_type?: string;
  category: string;
  duration_minutes?: number;
  availability?: any;
  features?: string[];
  inclusions?: string[];
  images?: string[];
  videos?: string[];
}

// Service update interface
export interface UpdateServiceData {
  name?: string;
  description?: string;
  price?: number;
  price_type?: string;
  category?: string;
  duration_minutes?: number;
  availability?: any;
  features?: string[];
  inclusions?: string[];
  images?: string[];
  videos?: string[];
  status?: string;
}

// Service with vendor information
export interface ServiceWithVendor extends Service {
  vendor?: {
    id: number;
    business_name: string;
    business_type: string;
    average_rating: number;
    total_reviews: number;
    verified: boolean;
    profile_photo_url?: string;
  };
}

export class ServiceModel {
  // Create a new service
  static async create(serviceData: CreateServiceData): Promise<Service> {
    try {
      const query = `
        INSERT INTO services (vendor_id, name, description, price, price_type, category, 
                            duration_minutes, availability, features, inclusions, images, videos)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const values = [
        serviceData.vendor_id,
        serviceData.name,
        serviceData.description || null,
        serviceData.price || null,
        serviceData.price_type || null,
        serviceData.category,
        serviceData.duration_minutes || null,
        serviceData.availability ? JSON.stringify(serviceData.availability) : null,
        serviceData.features || [],
        serviceData.inclusions || [],
        serviceData.images || [],
        serviceData.videos || []
      ];

      const result = await pool.query(query, values);
      const service = result.rows[0];

      logger.info(`Service created: ${service.name} by vendor ${serviceData.vendor_id}`);
      return service;
    } catch (error) {
      logger.error('Error creating service:', error);
      throw error;
    }
  }

  // Find service by ID
  static async findById(id: number): Promise<ServiceWithVendor | null> {
    try {
      const query = `
        SELECT s.*, 
               v.business_name, v.business_type, v.average_rating, 
               v.total_reviews, v.verified, v.profile_photo_url
        FROM services s
        LEFT JOIN vendors v ON s.vendor_id = v.id
        WHERE s.id = $1 AND s.status = 'active'
      `;

      const result = await pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const service = result.rows[0];
      return {
        ...service,
        vendor: {
          id: service.vendor_id,
          business_name: service.business_name,
          business_type: service.business_type,
          average_rating: service.average_rating,
          total_reviews: service.total_reviews,
          verified: service.verified,
          profile_photo_url: service.profile_photo_url
        }
      };
    } catch (error) {
      logger.error('Error finding service by ID:', error);
      throw error;
    }
  }

  // Find services by vendor
  static async findByVendor(vendorId: number): Promise<Service[]> {
    try {
      const query = 'SELECT * FROM services WHERE vendor_id = $1 ORDER BY created_at DESC';
      const result = await pool.query(query, [vendorId]);
      return result.rows;
    } catch (error) {
      logger.error('Error finding services by vendor:', error);
      throw error;
    }
  }

  // Search services with filters
  static async search(filters: {
    category?: string;
    price_min?: number;
    price_max?: number;
    location?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ services: ServiceWithVendor[], total: number }> {
    try {
      let whereConditions = ['s.status = $1'];
      let values = ['active'];
      let valueIndex = 2;

      // Add search filter
      if (filters.search) {
        whereConditions.push(`(s.name ILIKE $${valueIndex} OR s.description ILIKE $${valueIndex})`);
        values.push(`%${filters.search}%`);
        valueIndex++;
      }

      // Add category filter
      if (filters.category) {
        whereConditions.push(`s.category = $${valueIndex}`);
        values.push(filters.category);
        valueIndex++;
      }

      // Add price filters
      if (filters.price_min !== undefined) {
        whereConditions.push(`s.price >= $${valueIndex}`);
        values.push(filters.price_min);
        valueIndex++;
      }

      if (filters.price_max !== undefined) {
        whereConditions.push(`s.price <= $${valueIndex}`);
        values.push(filters.price_max);
        valueIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Count total
      const countQuery = `
        SELECT COUNT(*) 
        FROM services s
        LEFT JOIN vendors v ON s.vendor_id = v.id
        WHERE ${whereClause}
      `;

      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get services with pagination
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;

      const query = `
        SELECT s.*, 
               v.business_name, v.business_type, v.average_rating, 
               v.total_reviews, v.verified, v.profile_photo_url
        FROM services s
        LEFT JOIN vendors v ON s.vendor_id = v.id
        WHERE ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT $${valueIndex} OFFSET $${valueIndex + 1}
      `;

      const result = await pool.query(query, [...values, limit, offset]);
      
      const services = result.rows.map(service => ({
        ...service,
        vendor: {
          id: service.vendor_id,
          business_name: service.business_name,
          business_type: service.business_type,
          average_rating: service.average_rating,
          total_reviews: service.total_reviews,
          verified: service.verified,
          profile_photo_url: service.profile_photo_url
        }
      }));

      return { services, total };
    } catch (error) {
      logger.error('Error searching services:', error);
      throw error;
    }
  }

  // Get popular services
  static async getPopular(limit: number = 10): Promise<ServiceWithVendor[]> {
    try {
      const query = `
        SELECT s.*, 
               v.business_name, v.business_type, v.average_rating, 
               v.total_reviews, v.verified, v.profile_photo_url
        FROM services s
        LEFT JOIN vendors v ON s.vendor_id = v.id
        WHERE s.status = 'active' AND v.verified = true
        ORDER BY v.average_rating DESC, v.total_reviews DESC
        LIMIT $1
      `;

      const result = await pool.query(query, [limit]);
      
      return result.rows.map(service => ({
        ...service,
        vendor: {
          id: service.vendor_id,
          business_name: service.business_name,
          business_type: service.business_type,
          average_rating: service.average_rating,
          total_reviews: service.total_reviews,
          verified: service.verified,
          profile_photo_url: service.profile_photo_url
        }
      }));
    } catch (error) {
      logger.error('Error getting popular services:', error);
      throw error;
    }
  }

  // Get services by category
  static async getByCategory(category: string, limit: number = 10): Promise<ServiceWithVendor[]> {
    try {
      const query = `
        SELECT s.*, 
               v.business_name, v.business_type, v.average_rating, 
               v.total_reviews, v.verified, v.profile_photo_url
        FROM services s
        LEFT JOIN vendors v ON s.vendor_id = v.id
        WHERE s.category = $1 AND s.status = 'active'
        ORDER BY v.average_rating DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [category, limit]);
      
      return result.rows.map(service => ({
        ...service,
        vendor: {
          id: service.vendor_id,
          business_name: service.business_name,
          business_type: service.business_type,
          average_rating: service.average_rating,
          total_reviews: service.total_reviews,
          verified: service.verified,
          profile_photo_url: service.profile_photo_url
        }
      }));
    } catch (error) {
      logger.error('Error getting services by category:', error);
      throw error;
    }
  }

  // Update service
  static async update(id: number, updateData: UpdateServiceData): Promise<Service | null> {
    try {
      const fields = Object.keys(updateData)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');

      const query = `
        UPDATE services 
        SET ${fields}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const values = [id, ...Object.values(updateData)];
      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Service updated: ID ${id}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating service:', error);
      throw error;
    }
  }

  // Delete service
  static async delete(id: number): Promise<boolean> {
    try {
      const query = 'DELETE FROM services WHERE id = $1';
      const result = await pool.query(query, [id]);
      
      if (result.rowCount === 0) {
        return false;
      }

      logger.info(`Service deleted: ID ${id}`);
      return true;
    } catch (error) {
      logger.error('Error deleting service:', error);
      throw error;
    }
  }

  // Get service categories
  static async getCategories(): Promise<string[]> {
    try {
      const query = 'SELECT DISTINCT category FROM services WHERE status = \'active\' ORDER BY category';
      const result = await pool.query(query);
      return result.rows.map(row => row.category);
    } catch (error) {
      logger.error('Error getting service categories:', error);
      throw error;
    }
  }
} 