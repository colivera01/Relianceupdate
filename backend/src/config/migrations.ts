import { pool } from './database';
import { logger } from '../utils/logger';

// Database migration functions
export const runMigrations = async (): Promise<void> => {
  try {
    logger.info('Starting database migrations...');

    // Create users table
    await createUsersTable();
    
    // Create vendors table
    await createVendorsTable();
    
    // Create services table
    await createServicesTable();
    
    // Create bookings table
    await createBookingsTable();
    
    // Create reviews table
    await createReviewsTable();

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
};

const createUsersTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      phone VARCHAR(20),
      profile_photo_url VARCHAR(500),
      member_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP,
      is_premium BOOLEAN DEFAULT FALSE,
      location_enabled BOOLEAN DEFAULT TRUE,
      two_factor_enabled BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await pool.query(query);
  logger.info('Users table created/verified');
};

const createVendorsTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS vendors (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      business_name VARCHAR(255) NOT NULL,
      business_type VARCHAR(100) NOT NULL,
      category VARCHAR(100) NOT NULL,
      description TEXT,
      bio TEXT,
      profile_photo_url VARCHAR(500),
      address TEXT NOT NULL,
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      phone VARCHAR(20),
      email VARCHAR(255),
      website VARCHAR(500),
      years_in_business INTEGER,
      verified BOOLEAN DEFAULT FALSE,
      featured BOOLEAN DEFAULT FALSE,
      insurance BOOLEAN DEFAULT FALSE,
      bonded BOOLEAN DEFAULT FALSE,
      licensed BOOLEAN DEFAULT FALSE,
      average_rating DECIMAL(3, 2) DEFAULT 0,
      total_reviews INTEGER DEFAULT 0,
      total_jobs INTEGER DEFAULT 0,
      completion_rate DECIMAL(5, 2) DEFAULT 0,
      average_response_time INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await pool.query(query);
  logger.info('Vendors table created/verified');
};

const createServicesTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2),
      price_type VARCHAR(20),
      category VARCHAR(100) NOT NULL,
      duration_minutes INTEGER,
      availability JSONB,
      features TEXT[],
      inclusions TEXT[],
      images TEXT[],
      videos TEXT[],
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await pool.query(query);
  logger.info('Services table created/verified');
};

const createBookingsTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
      service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      time TIME NOT NULL,
      duration_minutes INTEGER,
      status VARCHAR(20) DEFAULT 'pending',
      total_amount DECIMAL(10, 2),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await pool.query(query);
  logger.info('Bookings table created/verified');
};

const createReviewsTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
      reviewer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
      service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
      rating INTEGER CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await pool.query(query);
  logger.info('Reviews table created/verified');
};

// Create indexes for better performance
export const createIndexes = async (): Promise<void> => {
  try {
    logger.info('Creating database indexes...');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);',
      'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category);',
      'CREATE INDEX IF NOT EXISTS idx_vendors_verified ON vendors(verified);',
      'CREATE INDEX IF NOT EXISTS idx_services_vendor_id ON services(vendor_id);',
      'CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);',
      'CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);',
      'CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_bookings_vendor_id ON bookings(vendor_id);',
      'CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);',
      'CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);',
      'CREATE INDEX IF NOT EXISTS idx_reviews_vendor_id ON reviews(vendor_id);',
      'CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);'
    ];

    for (const indexQuery of indexes) {
      await pool.query(indexQuery);
    }

    logger.info('Database indexes created successfully');
  } catch (error) {
    logger.error('Index creation failed:', error);
    throw error;
  }
};

// Seed the database with sample data (for development)
export const seedDatabase = async (): Promise<void> => {
  try {
    logger.info('Seeding database with sample data...');

    // Check if users already exist
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) > 0) {
      logger.info('Database already has data, skipping seed');
      return;
    }

    // Insert sample users
    const sampleUsers = [
      {
        email: 'john.doe@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+1234567890'
      },
      {
        email: 'jane.smith@example.com',
        password: 'password123',
        first_name: 'Jane',
        last_name: 'Smith',
        phone: '+1234567891'
      }
    ];

    for (const userData of sampleUsers) {
      const hashedPassword = await require('bcryptjs').hash(userData.password, 12);
      await pool.query(
        'INSERT INTO users (email, password_hash, first_name, last_name, phone) VALUES ($1, $2, $3, $4, $5)',
        [userData.email, hashedPassword, userData.first_name, userData.last_name, userData.phone]
      );
    }

    logger.info('Sample data seeded successfully');
  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
}; 