# Vendor Dashboard Backend Integration Guide
*Updated: January 2024 - Reflects all vendor management implementations*

## Overview
This document outlines the backend requirements for the comprehensive vendor management system implemented in Project Reliance, including enhanced vendor profiles, service management, and all vendor-side features.

## Implemented Features

### 1. Enhanced Vendor Profile System
- **Comprehensive Business Information**: Business details, years in business, total jobs
- **Performance Metrics**: Response time, completion rate, customer satisfaction
- **Credentials & Verification**: License, insurance, bonding status
- **Service Areas**: Geographic coverage and specializations
- **Media Management**: Profile images and business photos
- **Emergency Contact**: 24/7 contact information

### 2. Service Management System
- **Full CRUD Operations**: Create, read, update, delete services
- **Media Support**: Images and videos with filtering
- **Pricing Management**: Dynamic pricing with discounts
- **Service Categories**: Organized classification
- **Features & Inclusions**: Detailed service descriptions
- **Availability Management**: Service-specific availability

### 3. Vendor Analytics & Performance
- **Business Metrics**: Revenue, bookings, customer satisfaction
- **Performance Tracking**: Response times, completion rates
- **Customer Analytics**: Customer demographics and preferences
- **Financial Reporting**: Revenue trends and projections

## Database Schema

### Vendor Profile Tables

```sql
-- Enhanced Vendors Table
CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    business_description TEXT,
    business_type VARCHAR(100), -- individual, corporation, partnership
    years_in_business INTEGER,
    total_jobs INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    average_response_time VARCHAR(50), -- e.g., "2 hours", "1 day"
    completion_rate DECIMAL(5,2) DEFAULT 0, -- percentage
    customer_satisfaction DECIMAL(3,2) DEFAULT 0, -- average rating
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'suspended')),
    insurance_status BOOLEAN DEFAULT false,
    bonding_status BOOLEAN DEFAULT false,
    license_status BOOLEAN DEFAULT false,
    service_areas TEXT[], -- array of area names
    specializations TEXT[], -- array of specialization tags
    response_time_settings VARCHAR(50), -- e.g., "2 hours", "same day"
    emergency_contact VARCHAR(20),
    emergency_available BOOLEAN DEFAULT false,
    business_hours JSONB, -- structured business hours
    holiday_schedule JSONB, -- holiday availability
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    verified_at TIMESTAMP,
    suspended_at TIMESTAMP
);

-- Vendor Credentials & Documents
CREATE TABLE vendor_credentials (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    credential_type VARCHAR(50) NOT NULL, -- license, insurance, certification, bonding
    credential_number VARCHAR(100),
    issuing_authority VARCHAR(255),
    issue_date DATE,
    expiry_date DATE,
    document_url VARCHAR(500),
    document_verified BOOLEAN DEFAULT false,
    verified_by INTEGER REFERENCES users(id),
    verified_at TIMESTAMP,
    verification_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Vendor Service Areas
CREATE TABLE vendor_service_areas (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    area_name VARCHAR(100) NOT NULL,
    area_code VARCHAR(10),
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50) DEFAULT 'USA',
    coordinates POINT, -- PostgreSQL point type for geolocation
    radius_km INTEGER DEFAULT 25,
    is_primary BOOLEAN DEFAULT false,
    service_charge DECIMAL(10,2), -- additional charge for this area
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vendor Performance Metrics
CREATE TABLE vendor_performance (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- response_time, completion_rate, satisfaction, revenue
    metric_value DECIMAL(10,2),
    metric_unit VARCHAR(20), -- hours, percentage, rating, dollars
    period_start DATE,
    period_end DATE,
    period_type VARCHAR(20), -- daily, weekly, monthly, yearly
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vendor Media
CREATE TABLE vendor_media (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL, -- image, video, document
    media_url VARCHAR(500) NOT NULL,
    media_thumbnail VARCHAR(500),
    media_title VARCHAR(255),
    media_description TEXT,
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Service Management Tables

```sql
-- Enhanced Services Table
CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    category_id INTEGER REFERENCES categories(id),
    subcategory_id INTEGER REFERENCES subcategories(id),
    base_price DECIMAL(10,2) NOT NULL,
    discounted_price DECIMAL(10,2),
    original_price DECIMAL(10,2),
    discount_percentage DECIMAL(5,2),
    duration_minutes INTEGER,
    min_duration_minutes INTEGER,
    max_duration_minutes INTEGER,
    features JSONB, -- array of features
    inclusions JSONB, -- array of what's included
    requirements JSONB, -- array of requirements
    restrictions JSONB, -- array of restrictions
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    is_instant_bookable BOOLEAN DEFAULT true,
    requires_consultation BOOLEAN DEFAULT false,
    consultation_fee DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Service Media
CREATE TABLE service_media (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL, -- image, video
    media_url VARCHAR(500) NOT NULL,
    media_thumbnail VARCHAR(500),
    media_title VARCHAR(255),
    media_description TEXT,
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    file_size INTEGER,
    duration_seconds INTEGER, -- for videos
    created_at TIMESTAMP DEFAULT NOW()
);

-- Service Pricing Tiers
CREATE TABLE service_pricing_tiers (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    tier_name VARCHAR(100) NOT NULL, -- basic, standard, premium
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INTEGER,
    features JSONB,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Service Availability
CREATE TABLE service_availability (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME,
    end_time TIME,
    is_available BOOLEAN DEFAULT true,
    max_bookings_per_day INTEGER,
    advance_booking_days INTEGER DEFAULT 30,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Analytics & Reporting Tables

```sql
-- Vendor Analytics
CREATE TABLE vendor_analytics (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_bookings INTEGER DEFAULT 0,
    completed_bookings INTEGER DEFAULT 0,
    cancelled_bookings INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    average_booking_value DECIMAL(10,2) DEFAULT 0,
    average_response_time_minutes INTEGER,
    completion_rate DECIMAL(5,2),
    customer_satisfaction DECIMAL(3,2),
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(vendor_id, date)
);

-- Service Performance
CREATE TABLE service_performance (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_bookings INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    average_rating DECIMAL(3,2),
    view_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(service_id, date)
);

-- Customer Analytics
CREATE TABLE vendor_customer_analytics (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES users(id),
    total_bookings INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    average_rating DECIMAL(3,2),
    last_booking_date DATE,
    customer_lifetime_value DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(vendor_id, customer_id)
);
```

## API Endpoints

### Vendor Profile Management

```typescript
// Get Vendor Profile
GET /api/vendors/:vendorId/profile
Response: {
  "id": number,
  "business_name": string,
  "business_description": string,
  "years_in_business": number,
  "total_jobs": number,
  "average_response_time": string,
  "completion_rate": number,
  "customer_satisfaction": number,
  "verification_status": string,
  "insurance_status": boolean,
  "bonding_status": boolean,
  "service_areas": string[],
  "specializations": string[],
  "emergency_contact": string,
  "business_hours": object,
  "media": array
}

// Update Vendor Profile
PUT /api/vendors/:vendorId/profile
{
  "business_name": string,
  "business_description": string,
  "years_in_business": number,
  "response_time_settings": string,
  "emergency_contact": string,
  "service_areas": string[],
  "specializations": string[]
}

// Upload Vendor Media
POST /api/vendors/:vendorId/media
Content-Type: multipart/form-data
{
  "media_type": "image|video",
  "file": File,
  "title": string,
  "description": string,
  "is_primary": boolean
}

// Manage Vendor Credentials
GET /api/vendors/:vendorId/credentials
POST /api/vendors/:vendorId/credentials
PUT /api/vendors/:vendorId/credentials/:credentialId
DELETE /api/vendors/:vendorId/credentials/:credentialId
```

### Service Management

```typescript
// Service CRUD Operations
GET /api/vendors/:vendorId/services
POST /api/vendors/:vendorId/services
GET /api/vendors/:vendorId/services/:serviceId
PUT /api/vendors/:vendorId/services/:serviceId
DELETE /api/vendors/:vendorId/services/:serviceId

// Service Media Management
POST /api/vendors/:vendorId/services/:serviceId/media
DELETE /api/vendors/:vendorId/services/:serviceId/media/:mediaId
PUT /api/vendors/:vendorId/services/:serviceId/media/:mediaId/reorder

// Service Pricing
GET /api/vendors/:vendorId/services/:serviceId/pricing
PUT /api/vendors/:vendorId/services/:serviceId/pricing
POST /api/vendors/:vendorId/services/:serviceId/pricing-tiers

// Service Availability
GET /api/vendors/:vendorId/services/:serviceId/availability
PUT /api/vendors/:vendorId/services/:serviceId/availability
```

### Analytics & Reporting

```typescript
// Vendor Analytics
GET /api/vendors/:vendorId/analytics
Query Parameters:
- period: string (day, week, month, year)
- date_from: string (YYYY-MM-DD)
- date_to: string (YYYY-MM-DD)

// Service Performance
GET /api/vendors/:vendorId/services/analytics
GET /api/vendors/:vendorId/services/:serviceId/analytics

// Customer Analytics
GET /api/vendors/:vendorId/customers/analytics
GET /api/vendors/:vendorId/customers/:customerId/analytics

// Financial Reports
GET /api/vendors/:vendorId/reports/revenue
GET /api/vendors/:vendorId/reports/bookings
GET /api/vendors/:vendorId/reports/performance
```

## Business Logic Implementation

### Vendor Profile Management

```typescript
interface VendorProfile {
  business_name: string;
  business_description?: string;
  years_in_business?: number;
  response_time_settings?: string;
  emergency_contact?: string;
  service_areas?: string[];
  specializations?: string[];
  business_hours?: BusinessHours;
}

async function updateVendorProfile(vendor_id: number, profile: VendorProfile): Promise<Vendor> {
  // Validate business name uniqueness
  if (profile.business_name) {
    const existingVendor = await db.vendors.findOne({
      where: {
        business_name: profile.business_name,
        id: { [Op.ne]: vendor_id }
      }
    });
    
    if (existingVendor) {
      throw new Error('Business name already exists');
    }
  }
  
  // Update vendor profile
  const vendor = await db.vendors.findByPk(vendor_id);
  await vendor.update(profile);
  
  // Update performance metrics if needed
  if (profile.years_in_business) {
    await updateVendorMetrics(vendor_id);
  }
  
  // Send notification to admin for verification if needed
  if (profile.business_name !== vendor.business_name) {
    await requestVerification(vendor_id);
  }
  
  return vendor;
}
```

### Service Management

```typescript
interface ServiceData {
  name: string;
  description?: string;
  category_id: number;
  base_price: number;
  duration_minutes?: number;
  features?: string[];
  inclusions?: string[];
  requirements?: string[];
}

async function createService(vendor_id: number, serviceData: ServiceData): Promise<Service> {
  // Validate category exists
  const category = await db.categories.findByPk(serviceData.category_id);
  if (!category) {
    throw new Error('Invalid category');
  }
  
  // Validate pricing
  if (serviceData.base_price <= 0) {
    throw new Error('Price must be greater than 0');
  }
  
  // Create service
  const service = await db.services.create({
    vendor_id,
    ...serviceData,
    is_active: true
  });
  
  // Create default availability
  await createDefaultAvailability(service.id);
  
  // Send notification to admin for review
  await notifyAdminServiceCreated(service);
  
  return service;
}

async function updateService(service_id: number, serviceData: Partial<ServiceData>): Promise<Service> {
  const service = await db.services.findByPk(service_id);
  
  if (!service) {
    throw new Error('Service not found');
  }
  
  // Check if service has active bookings
  const activeBookings = await db.bookings.count({
    where: {
      service_id,
      status: { [Op.in]: ['pending', 'confirmed', 'in_progress'] }
    }
  });
  
  if (activeBookings > 0 && serviceData.base_price) {
    throw new Error('Cannot change price for service with active bookings');
  }
  
  // Update service
  await service.update(serviceData);
  
  // Update service performance metrics
  await updateServiceMetrics(service_id);
  
  return service;
}
```

### Media Management

```typescript
interface MediaUpload {
  media_type: 'image' | 'video';
  file: File;
  title?: string;
  description?: string;
  is_primary?: boolean;
}

async function uploadVendorMedia(vendor_id: number, mediaData: MediaUpload): Promise<VendorMedia> {
  // Validate file type and size
  const maxSize = mediaData.media_type === 'video' ? 100 * 1024 * 1024 : 10 * 1024 * 1024; // 100MB for video, 10MB for image
  if (mediaData.file.size > maxSize) {
    throw new Error(`File size too large. Maximum size: ${maxSize / (1024 * 1024)}MB`);
  }
  
  // Upload file to cloud storage
  const uploadResult = await uploadToCloudStorage(mediaData.file, {
    folder: `vendors/${vendor_id}/media`,
    public: true
  });
  
  // Create media record
  const media = await db.vendor_media.create({
    vendor_id,
    media_type: mediaData.media_type,
    media_url: uploadResult.url,
    media_thumbnail: uploadResult.thumbnail,
    media_title: mediaData.title,
    media_description: mediaData.description,
    is_primary: mediaData.is_primary || false
  });
  
  // If this is primary media, update other media
  if (mediaData.is_primary) {
    await db.vendor_media.update(
      { is_primary: false },
      {
        where: {
          vendor_id,
          id: { [Op.ne]: media.id }
        }
      }
    );
  }
  
  return media;
}
```

### Analytics & Performance Tracking

```typescript
async function calculateVendorAnalytics(vendor_id: number, period: string): Promise<VendorAnalytics> {
  const dateRange = getDateRange(period);
  
  // Get booking data
  const bookings = await db.bookings.findAll({
    where: {
      vendor_id,
      created_at: {
        [Op.between]: [dateRange.start, dateRange.end]
      }
    }
  });
  
  // Calculate metrics
  const totalBookings = bookings.length;
  const completedBookings = bookings.filter(b => b.status === 'completed').length;
  const totalRevenue = bookings.reduce((sum, b) => sum + parseFloat(b.total_price), 0);
  const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;
  
  // Calculate response time
  const responseTime = await calculateAverageResponseTime(vendor_id, dateRange);
  
  // Calculate completion rate
  const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;
  
  // Calculate customer satisfaction
  const reviews = await db.reviews.findAll({
    where: {
      vendor_id,
      created_at: {
        [Op.between]: [dateRange.start, dateRange.end]
      }
    }
  });
  
  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
    : 0;
  
  return {
    total_bookings: totalBookings,
    completed_bookings: completedBookings,
    total_revenue: totalRevenue,
    average_booking_value: averageBookingValue,
    average_response_time_minutes: responseTime,
    completion_rate: completionRate,
    customer_satisfaction: averageRating
  };
}
```

## Security & Validation

### Input Validation

```typescript
function validateVendorProfile(profile: any): VendorProfile {
  const schema = Joi.object({
    business_name: Joi.string().min(2).max(255).required(),
    business_description: Joi.string().max(2000).optional(),
    years_in_business: Joi.number().integer().min(0).max(100).optional(),
    response_time_settings: Joi.string().max(100).optional(),
    emergency_contact: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
    service_areas: Joi.array().items(Joi.string().max(100)).max(20).optional(),
    specializations: Joi.array().items(Joi.string().max(100)).max(10).optional(),
    business_hours: Joi.object().optional()
  });
  
  const { error, value } = schema.validate(profile);
  if (error) {
    throw new Error(`Validation error: ${error.details[0].message}`);
  }
  
  return value;
}

function validateServiceData(serviceData: any): ServiceData {
  const schema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    description: Joi.string().max(2000).optional(),
    category_id: Joi.number().integer().positive().required(),
    base_price: Joi.number().positive().required(),
    duration_minutes: Joi.number().integer().positive().optional(),
    features: Joi.array().items(Joi.string().max(200)).max(20).optional(),
    inclusions: Joi.array().items(Joi.string().max(200)).max(20).optional(),
    requirements: Joi.array().items(Joi.string().max(200)).max(20).optional()
  });
  
  const { error, value } = schema.validate(serviceData);
  if (error) {
    throw new Error(`Validation error: ${error.details[0].message}`);
  }
  
  return value;
}
```

### Authorization

```typescript
async function authorizeVendorAccess(vendor_id: number, user_id: number): Promise<boolean> {
  const vendor = await db.vendors.findByPk(vendor_id);
  
  if (!vendor) {
    return false;
  }
  
  // Vendor can access their own data
  if (vendor.user_id === user_id) {
    return true;
  }
  
  // Admin can access all vendor data
  const user = await db.users.findByPk(user_id);
  if (user?.role === 'admin') {
    return true;
  }
  
  return false;
}
```

## Performance Optimization

### Database Indexing

```sql
-- Vendor performance indexes
CREATE INDEX idx_vendors_user_id ON vendors(user_id);
CREATE INDEX idx_vendors_verification_status ON vendors(verification_status);
CREATE INDEX idx_vendors_active ON vendors(is_active);
CREATE INDEX idx_vendors_location ON vendors USING GIST(coordinates);

-- Service performance indexes
CREATE INDEX idx_services_vendor_id ON services(vendor_id);
CREATE INDEX idx_services_category_id ON services(category_id);
CREATE INDEX idx_services_active ON services(is_active);
CREATE INDEX idx_services_price ON services(base_price);

-- Analytics indexes
CREATE INDEX idx_vendor_analytics_vendor_date ON vendor_analytics(vendor_id, date);
CREATE INDEX idx_service_performance_service_date ON service_performance(service_id, date);
CREATE INDEX idx_vendor_performance_vendor_type ON vendor_performance(vendor_id, metric_type);
```

### Caching Strategy

```typescript
// Cache vendor profile for 1 hour
async function getCachedVendorProfile(vendor_id: number): Promise<VendorProfile> {
  const cacheKey = `vendor:profile:${vendor_id}`;
  
  let profile = await redis.get(cacheKey);
  if (profile) {
    return JSON.parse(profile);
  }
  
  profile = await db.vendors.findByPk(vendor_id, {
    include: [
      { model: db.vendor_media, where: { is_public: true } },
      { model: db.vendor_credentials }
    ]
  });
  
  await redis.setex(cacheKey, 3600, JSON.stringify(profile));
  return profile;
}

// Cache vendor analytics for 30 minutes
async function getCachedVendorAnalytics(vendor_id: number, period: string): Promise<VendorAnalytics> {
  const cacheKey = `vendor:analytics:${vendor_id}:${period}`;
  
  let analytics = await redis.get(cacheKey);
  if (analytics) {
    return JSON.parse(analytics);
  }
  
  analytics = await calculateVendorAnalytics(vendor_id, period);
  
  await redis.setex(cacheKey, 1800, JSON.stringify(analytics));
  return analytics;
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('Vendor Profile Management', () => {
  it('should update vendor profile with valid data', async () => {
    const vendorData = {
      business_name: 'Test Business',
      business_description: 'Test description',
      years_in_business: 5
    };
    
    const vendor = await updateVendorProfile(1, vendorData);
    
    expect(vendor.business_name).toBe('Test Business');
    expect(vendor.years_in_business).toBe(5);
  });
  
  it('should reject duplicate business name', async () => {
    const vendorData = {
      business_name: 'Existing Business'
    };
    
    await expect(updateVendorProfile(2, vendorData)).rejects.toThrow('Business name already exists');
  });
});

describe('Service Management', () => {
  it('should create service with valid data', async () => {
    const serviceData = {
      name: 'Test Service',
      category_id: 1,
      base_price: 100,
      duration_minutes: 60
    };
    
    const service = await createService(1, serviceData);
    
    expect(service.name).toBe('Test Service');
    expect(service.base_price).toBe(100);
    expect(service.is_active).toBe(true);
  });
  
  it('should reject service with invalid price', async () => {
    const serviceData = {
      name: 'Test Service',
      category_id: 1,
      base_price: -50
    };
    
    await expect(createService(1, serviceData)).rejects.toThrow('Price must be greater than 0');
  });
});
```

### Integration Tests

```typescript
describe('Vendor Workflow', () => {
  it('should complete full vendor onboarding', async () => {
    // 1. Create vendor profile
    const vendor = await createVendorProfile(validVendorData);
    
    // 2. Upload credentials
    const credential = await uploadCredential(vendor.id, validCredentialData);
    
    // 3. Create services
    const service = await createService(vendor.id, validServiceData);
    
    // 4. Upload service media
    const media = await uploadServiceMedia(service.id, validMediaData);
    
    // 5. Set availability
    await setServiceAvailability(service.id, validAvailabilityData);
    
    // 6. Verify final state
    const finalVendor = await db.vendors.findByPk(vendor.id, {
      include: [
        { model: db.services },
        { model: db.vendor_credentials },
        { model: db.vendor_media }
      ]
    });
    
    expect(finalVendor.services).toHaveLength(1);
    expect(finalVendor.vendor_credentials).toHaveLength(1);
    expect(finalVendor.vendor_media).toHaveLength(1);
  });
});
```

## Implementation Priority

### Phase 1: Core Vendor Management
1. **Basic vendor profile creation and management**
2. **Service CRUD operations**
3. **Basic media upload**
4. **Simple analytics**

### Phase 2: Enhanced Features
1. **Advanced profile features (credentials, verification)**
2. **Service pricing tiers and availability**
3. **Advanced media management**
4. **Performance tracking**

### Phase 3: Advanced Features
1. **Advanced analytics and reporting**
2. **Customer relationship management**
3. **Financial reporting**
4. **Integration with external services**

This comprehensive backend integration guide covers all the vendor management features we've implemented and provides a complete roadmap for building a robust, scalable vendor management system. 