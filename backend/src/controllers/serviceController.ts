import { Request, Response } from 'express';
import { ServiceModel, CreateServiceData, UpdateServiceData } from '../models/Service';
import { logger } from '../utils/logger';

// Get all services with search and filters
export const getServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      category,
      price_min,
      price_max,
      location,
      page = 1,
      limit = 10
    } = req.query;

    const filters = {
      search: search as string,
      category: category as string,
      price_min: price_min ? parseFloat(price_min as string) : undefined,
      price_max: price_max ? parseFloat(price_max as string) : undefined,
      location: location as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };

    const result = await ServiceModel.search(filters);

    res.json({
      services: result.services,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / filters.limit)
      }
    });
  } catch (error) {
    logger.error('Error getting services:', error);
    res.status(500).json({ error: 'Failed to get services' });
  }
};

// Get service by ID
export const getServiceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const serviceId = parseInt(id);

    if (isNaN(serviceId)) {
      res.status(400).json({ error: 'Invalid service ID' });
      return;
    }

    const service = await ServiceModel.findById(serviceId);
    
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }

    res.json({ service });
  } catch (error) {
    logger.error('Error getting service by ID:', error);
    res.status(500).json({ error: 'Failed to get service' });
  }
};

// Get popular services
export const getPopularServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const services = await ServiceModel.getPopular(limit);

    res.json({ services });
  } catch (error) {
    logger.error('Error getting popular services:', error);
    res.status(500).json({ error: 'Failed to get popular services' });
  }
};

// Get services by category
export const getServicesByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    if (!category) {
      res.status(400).json({ error: 'Category is required' });
      return;
    }

    const services = await ServiceModel.getByCategory(category, limit);

    res.json({ services });
  } catch (error) {
    logger.error('Error getting services by category:', error);
    res.status(500).json({ error: 'Failed to get services by category' });
  }
};

// Get service categories
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await ServiceModel.getCategories();
    res.json({ categories });
  } catch (error) {
    logger.error('Error getting categories:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
};

// Create new service (vendor only)
export const createService = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const serviceData: CreateServiceData = req.body;

    // Validation
    if (!serviceData.name || !serviceData.category) {
      res.status(400).json({ 
        error: 'Service name and category are required',
        required: ['name', 'category']
      });
      return;
    }

    // TODO: Check if user is a vendor
    // For now, we'll use a placeholder vendor_id
    // In a real implementation, you'd get this from the user's vendor profile
    const vendorId = 1; // This should come from req.user.vendor_id

    const service = await ServiceModel.create({
      ...serviceData,
      vendor_id: vendorId
    });

    logger.info(`Service created by user ${req.user.id}: ${service.name}`);

    res.status(201).json({
      message: 'Service created successfully',
      service
    });
  } catch (error) {
    logger.error('Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
};

// Update service (vendor only)
export const updateService = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const serviceId = parseInt(id);

    if (isNaN(serviceId)) {
      res.status(400).json({ error: 'Invalid service ID' });
      return;
    }

    const updateData: UpdateServiceData = req.body;

    // TODO: Check if user owns this service
    // For now, we'll allow any authenticated user to update

    const service = await ServiceModel.update(serviceId, updateData);
    
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }

    logger.info(`Service updated by user ${req.user.id}: ${service.name}`);

    res.json({
      message: 'Service updated successfully',
      service
    });
  } catch (error) {
    logger.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
};

// Delete service (vendor only)
export const deleteService = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const serviceId = parseInt(id);

    if (isNaN(serviceId)) {
      res.status(400).json({ error: 'Invalid service ID' });
      return;
    }

    // TODO: Check if user owns this service
    // For now, we'll allow any authenticated user to delete

    const deleted = await ServiceModel.delete(serviceId);
    
    if (!deleted) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }

    logger.info(`Service deleted by user ${req.user.id}: ID ${serviceId}`);

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    logger.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
};

// Get services by vendor
export const getServicesByVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vendorId } = req.params;
    const vendorIdNum = parseInt(vendorId);

    if (isNaN(vendorIdNum)) {
      res.status(400).json({ error: 'Invalid vendor ID' });
      return;
    }

    const services = await ServiceModel.findByVendor(vendorIdNum);

    res.json({ services });
  } catch (error) {
    logger.error('Error getting services by vendor:', error);
    res.status(500).json({ error: 'Failed to get vendor services' });
  }
};

// Get user's own services (vendor dashboard)
export const getMyServices = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // TODO: Get vendor_id from user's vendor profile
    // For now, we'll use a placeholder
    const vendorId = 1; // This should come from req.user.vendor_id

    const services = await ServiceModel.findByVendor(vendorId);

    res.json({ services });
  } catch (error) {
    logger.error('Error getting user services:', error);
    res.status(500).json({ error: 'Failed to get your services' });
  }
}; 