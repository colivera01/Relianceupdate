import { Request, Response } from 'express';
import { UserModel, CreateUserData, UpdateUserData } from '../models/User';
import { generateToken, authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

// Register a new user
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, first_name, last_name, phone }: CreateUserData = req.body;

    // Validation
    if (!email || !password || !first_name || !last_name) {
      res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'password', 'first_name', 'last_name']
      });
      return;
    }

    // Check if email already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long' });
      return;
    }

    // Create user
    const userData: CreateUserData = {
      email,
      password,
      first_name,
      last_name,
      phone
    };

    const user = await UserModel.create(userData);

    // Generate JWT token
    const token = generateToken(user);

    // Update last login
    await UserModel.updateLastLogin(user.id!);

    logger.info(`User registered successfully: ${email}`);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        profile_photo_url: user.profile_photo_url,
        member_since: user.member_since,
        is_premium: user.is_premium
      },
      token
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// Login user
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ 
        error: 'Email and password are required',
        required: ['email', 'password']
      });
      return;
    }

    // Find user by email
    const user = await UserModel.findByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValidPassword = await UserModel.verifyPassword(user, password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const token = generateToken(user);

    // Update last login
    await UserModel.updateLastLogin(user.id!);

    logger.info(`User logged in: ${email}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        profile_photo_url: user.profile_photo_url,
        member_since: user.member_since,
        last_login: user.last_login,
        is_premium: user.is_premium
      },
      token
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Get current user profile
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        first_name: req.user.first_name,
        last_name: req.user.last_name,
        phone: req.user.phone,
        profile_photo_url: req.user.profile_photo_url,
        member_since: req.user.member_since,
        last_login: req.user.last_login,
        is_premium: req.user.is_premium,
        location_enabled: req.user.location_enabled,
        two_factor_enabled: req.user.two_factor_enabled
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

// Update user profile
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const updateData: UpdateUserData = req.body;

    // Validate email if provided
    if (updateData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }

      // Check if email is already taken by another user
      const existingUser = await UserModel.findByEmail(updateData.email);
      if (existingUser && existingUser.id !== req.user.id) {
        res.status(409).json({ error: 'Email already taken' });
        return;
      }
    }

    // Update user
    const updatedUser = await UserModel.update(req.user.id!, updateData);
    
    if (!updatedUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    logger.info(`Profile updated for user: ${req.user.email}`);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        phone: updatedUser.phone,
        profile_photo_url: updatedUser.profile_photo_url,
        member_since: updatedUser.member_since,
        last_login: updatedUser.last_login,
        is_premium: updatedUser.is_premium,
        location_enabled: updatedUser.location_enabled,
        two_factor_enabled: updatedUser.two_factor_enabled
      }
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// Change password
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ 
        error: 'Current password and new password are required',
        required: ['currentPassword', 'newPassword']
      });
      return;
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long' });
      return;
    }

    // Get user with password hash
    const user = await UserModel.findByEmail(req.user.email);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify current password
    const isValidPassword = await UserModel.verifyPassword(user, currentPassword);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Update password
    const updatedUser = await UserModel.update(req.user.id!, {
      password_hash: newPassword // This will be hashed in the model
    } as any);

    if (!updatedUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    logger.info(`Password changed for user: ${req.user.email}`);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

// Logout (client-side token removal)
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // You could implement a blacklist for tokens if needed
    logger.info(`User logged out: ${req.user?.email || 'unknown'}`);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

// Refresh token (optional - for extending session)
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Generate new token
    const newToken = generateToken(req.user);

    logger.info(`Token refreshed for user: ${req.user.email}`);

    res.json({
      message: 'Token refreshed successfully',
      token: newToken
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
}; 