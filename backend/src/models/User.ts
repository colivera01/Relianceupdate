import { pool } from '../config/database';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';

// User interface
export interface User {
  id?: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone?: string;
  profile_photo_url?: string;
  member_since?: Date;
  last_login?: Date;
  is_premium?: boolean;
  location_enabled?: boolean;
  two_factor_enabled?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

// User creation interface (without id and timestamps)
export interface CreateUserData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

// User update interface
export interface UpdateUserData {
  first_name?: string;
  last_name?: string;
  phone?: string;
  profile_photo_url?: string;
  is_premium?: boolean;
  location_enabled?: boolean;
  two_factor_enabled?: boolean;
}

export class UserModel {
  // Create a new user
  static async create(userData: CreateUserData): Promise<User> {
    try {
      // Hash the password
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(userData.password, saltRounds);

      const query = `
        INSERT INTO users (email, password_hash, first_name, last_name, phone)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const values = [
        userData.email,
        password_hash,
        userData.first_name,
        userData.last_name,
        userData.phone || null
      ];

      const result = await pool.query(query, values);
      const user = result.rows[0];

      // Remove password_hash from the returned user
      delete user.password_hash;

      logger.info(`User created: ${user.email}`);
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email: string): Promise<User | null> {
    try {
      const query = 'SELECT * FROM users WHERE email = $1';
      const result = await pool.query(query, [email]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  // Find user by ID
  static async findById(id: number): Promise<User | null> {
    try {
      const query = 'SELECT * FROM users WHERE id = $1';
      const result = await pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      // Remove password_hash from the returned user
      delete user.password_hash;
      return user;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  // Update user
  static async update(id: number, updateData: UpdateUserData): Promise<User | null> {
    try {
      const fields = Object.keys(updateData)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');

      const query = `
        UPDATE users 
        SET ${fields}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const values = [id, ...Object.values(updateData)];
      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      delete user.password_hash;
      return user;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  // Update last login
  static async updateLastLogin(id: number): Promise<void> {
    try {
      const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
      await pool.query(query, [id]);
      logger.info(`Updated last login for user ID: ${id}`);
    } catch (error) {
      logger.error('Error updating last login:', error);
      throw error;
    }
  }

  // Verify password
  static async verifyPassword(user: User, password: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, user.password_hash);
    } catch (error) {
      logger.error('Error verifying password:', error);
      return false;
    }
  }

  // Delete user
  static async delete(id: number): Promise<boolean> {
    try {
      const query = 'DELETE FROM users WHERE id = $1';
      const result = await pool.query(query, [id]);
      
      if (result.rowCount === 0) {
        return false;
      }

      logger.info(`User deleted: ID ${id}`);
      return true;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  // Get all users (with pagination)
  static async findAll(page: number = 1, limit: number = 10): Promise<{ users: User[], total: number }> {
    try {
      const offset = (page - 1) * limit;
      
      const countQuery = 'SELECT COUNT(*) FROM users';
      const countResult = await pool.query(countQuery);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT id, email, first_name, last_name, phone, profile_photo_url, 
               member_since, last_login, is_premium, location_enabled, 
               two_factor_enabled, created_at, updated_at
        FROM users 
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
      `;

      const result = await pool.query(query, [limit, offset]);
      
      return {
        users: result.rows,
        total
      };
    } catch (error) {
      logger.error('Error finding all users:', error);
      throw error;
    }
  }
} 