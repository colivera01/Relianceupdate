import { Router } from 'express';
import {
  getServices,
  getServiceById,
  getPopularServices,
  getServicesByCategory,
  getCategories,
  createService,
  updateService,
  deleteService,
  getServicesByVendor,
  getMyServices
} from '../controllers/serviceController';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = Router();

// Public routes (no authentication required)
router.get('/', optionalAuth, getServices);
router.get('/popular', getPopularServices);
router.get('/categories', getCategories);
router.get('/category/:category', getServicesByCategory);
router.get('/vendor/:vendorId', getServicesByVendor);
router.get('/:id', getServiceById);

// Protected routes (authentication required)
router.post('/', authenticateToken, createService);
router.put('/:id', authenticateToken, updateService);
router.delete('/:id', authenticateToken, deleteService);
router.get('/my/services', authenticateToken, getMyServices);

export default router; 