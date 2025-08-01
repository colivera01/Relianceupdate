import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  refreshToken
} from '../controllers/authController';
import { authenticateToken, requireAuth, rateLimit } from '../middleware/auth';

const router = Router();

// Apply rate limiting to auth routes
router.use(rateLimit(5, 15 * 60 * 1000)); // 5 requests per 15 minutes

// Public routes (no authentication required)
router.post('/register', register);
router.post('/login', login);

// Protected routes (authentication required)
router.get('/profile', authenticateToken, getProfile);
router.patch('/profile', authenticateToken, updateProfile);
router.post('/change-password', authenticateToken, changePassword);
router.post('/logout', authenticateToken, logout);
router.post('/refresh', authenticateToken, refreshToken);

export default router; 