# Complete Backend Integration Guide
*Updated: January 2024 - Reflects all frontend implementations completed*

## Overview
This document provides a comprehensive guide for backend integration of the Project Reliance platform, covering all implemented frontend features and their corresponding backend requirements.

## Table of Contents
1. [User Dashboard & Discovery](#user-dashboard--discovery)
2. [Booking System](#booking-system)
3. [Service Management](#service-management)
4. [Vendor Management](#vendor-management)
5. [User Management](#user-management)
6. [Review System](#review-system)
7. [Messaging System](#messaging-system)
8. [Analytics & Reporting](#analytics--reporting)
9. [Payment System](#payment-system)
10. [Notification System](#notification-system)
11. [Search & Discovery](#search--discovery)
12. [Calendar Integration](#calendar-integration)
13. [File Management](#file-management)
14. [Security & Authentication](#security--authentication)

---

## User Dashboard & Discovery

### Implemented Features
- **Personalized Services**: AI-driven recommendations based on user behavior
- **Seasonal Suggestions**: Weather and time-based service recommendations
- **Social Proof Indicators**: Real-time booking counts and popularity metrics
- **Community Reviews**: Local neighborhood recommendations
- **Smart Categories**: Auto-generated categories based on user behavior
- **Price Comparison**: Side-by-side vendor pricing
- **Smart Notifications**: Service reminders, price drops, new vendor alerts
- **Analytics Dashboard**: Service history, spending analytics, quality trends

### Backend Requirements

#### Database Schema
```sql
-- User Preferences & Behavior
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    preferred_categories TEXT[],
    preferred_price_range DECIMAL(10,2)[],
    preferred_vendors INTEGER[],
    location_preferences JSONB,
    notification_settings JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User Behavior Tracking
CREATE TABLE user_behavior (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action_type VARCHAR(50), -- view, search, book, review, etc.
    service_id INTEGER REFERENCES services(id),
    vendor_id INTEGER REFERENCES vendors(id),
    category_id INTEGER REFERENCES categories(id),
    search_query TEXT,
    session_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seasonal Suggestions
CREATE TABLE seasonal_suggestions (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id),
    season VARCHAR(20), -- spring, summer, fall, winter
    weather_conditions JSONB,
    urgency_level VARCHAR(20), -- high, medium, low
    reason TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Social Proof Data
CREATE TABLE social_proof_metrics (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id),
    vendor_id INTEGER REFERENCES vendors(id),
    area_code VARCHAR(10),
    daily_bookings INTEGER DEFAULT 0,
    weekly_bookings INTEGER DEFAULT 0,
    popularity_score DECIMAL(3,2),
    last_updated TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints
```typescript
// Personalized Recommendations
GET /api/recommendations/personalized
GET /api/recommendations/seasonal
GET /api/recommendations/recently-viewed

// Social Proof
GET /api/social-proof/area/:areaCode
GET /api/social-proof/service/:serviceId

// User Analytics
GET /api/analytics/user/:userId
GET /api/analytics/spending/:userId
GET /api/analytics/quality-trends/:userId

// Smart Categories
GET /api/categories/smart/:userId
```

---

## Booking System

### Implemented Features
- **Multi-step Booking Flow**: Date/time selection, user details, review, payment
- **Real-time Availability**: Vendor calendar integration
- **Booking Management**: Upcoming, past, cancelled bookings
- **Booking Actions**: Reschedule, cancel, contact vendor, add to calendar
- **Receipt Generation**: Download booking receipts
- **Review Integration**: Leave reviews for completed bookings

### Backend Requirements

#### Database Schema
```sql
-- Bookings
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    service_id INTEGER REFERENCES services(id),
    vendor_id INTEGER REFERENCES vendors(id),
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    duration_minutes INTEGER,
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, completed, cancelled
    total_price DECIMAL(10,2),
    user_notes TEXT,
    vendor_notes TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Booking Details
CREATE TABLE booking_details (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id),
    field_name VARCHAR(100),
    field_value TEXT,
    field_type VARCHAR(50), -- text, number, boolean, date
    created_at TIMESTAMP DEFAULT NOW()
);

-- Booking Status History
CREATE TABLE booking_status_history (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id),
    status VARCHAR(20),
    changed_by INTEGER REFERENCES users(id),
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vendor Availability
CREATE TABLE vendor_availability (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id),
    day_of_week INTEGER, -- 0-6 (Sunday-Saturday)
    start_time TIME,
    end_time TIME,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vendor Time Slots
CREATE TABLE vendor_time_slots (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id),
    service_id INTEGER REFERENCES services(id),
    date DATE,
    time_slot TIME,
    is_available BOOLEAN DEFAULT true,
    is_booked BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints
```typescript
// Booking Management
POST /api/bookings
GET /api/bookings/user/:userId
GET /api/bookings/:bookingId
PUT /api/bookings/:bookingId
DELETE /api/bookings/:bookingId

// Booking Actions
POST /api/bookings/:bookingId/reschedule
POST /api/bookings/:bookingId/cancel
POST /api/bookings/:bookingId/confirm
POST /api/bookings/:bookingId/complete

// Availability
GET /api/availability/vendor/:vendorId
GET /api/availability/service/:serviceId
POST /api/availability/vendor/:vendorId

// Receipts
GET /api/bookings/:bookingId/receipt
POST /api/bookings/:bookingId/receipt/generate
```

---

## Service Management

### Implemented Features
- **Service Detail Pages**: Comprehensive service information with media
- **Media Management**: Images and videos with filtering
- **Service Categories**: Organized service classification
- **Pricing Management**: Dynamic pricing with discounts
- **Service Features**: Detailed service descriptions and inclusions

### Backend Requirements

#### Database Schema
```sql
-- Services
CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    subcategory_id INTEGER REFERENCES subcategories(id),
    base_price DECIMAL(10,2),
    discounted_price DECIMAL(10,2),
    duration_minutes INTEGER,
    features JSONB,
    inclusions JSONB,
    requirements JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Service Media
CREATE TABLE service_media (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id),
    media_type VARCHAR(20), -- image, video
    media_url VARCHAR(500),
    media_thumbnail VARCHAR(500),
    display_order INTEGER,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Service Categories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(7),
    parent_id INTEGER REFERENCES categories(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Service Pricing
CREATE TABLE service_pricing (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id),
    pricing_type VARCHAR(20), -- fixed, hourly, per_unit
    base_price DECIMAL(10,2),
    unit_price DECIMAL(10,2),
    minimum_price DECIMAL(10,2),
    maximum_price DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints
```typescript
// Service Management
GET /api/services
GET /api/services/:serviceId
POST /api/services
PUT /api/services/:serviceId
DELETE /api/services/:serviceId

// Service Media
POST /api/services/:serviceId/media
DELETE /api/services/:serviceId/media/:mediaId
PUT /api/services/:serviceId/media/:mediaId/reorder

// Categories
GET /api/categories
GET /api/categories/:categoryId/services
POST /api/categories
PUT /api/categories/:categoryId

// Pricing
GET /api/services/:serviceId/pricing
PUT /api/services/:serviceId/pricing
```

---

## Vendor Management

### Implemented Features
- **Vendor Profile Management**: Comprehensive vendor information
- **Service Management System**: CRUD operations for services
- **Performance Metrics**: Response time, completion rate, customer satisfaction
- **Credentials & Verification**: License, insurance, bonding status
- **Service Areas**: Geographic coverage and specializations
- **Media Management**: Profile images and service media

### Backend Requirements

#### Database Schema
```sql
-- Vendors
CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    business_name VARCHAR(255) NOT NULL,
    business_description TEXT,
    years_in_business INTEGER,
    total_jobs INTEGER DEFAULT 0,
    average_response_time VARCHAR(50),
    completion_rate DECIMAL(5,2),
    customer_satisfaction DECIMAL(3,2),
    verification_status VARCHAR(20) DEFAULT 'pending',
    insurance_status BOOLEAN DEFAULT false,
    bonding_status BOOLEAN DEFAULT false,
    service_areas TEXT[],
    specializations TEXT[],
    response_time_settings VARCHAR(50),
    emergency_contact VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Vendor Credentials
CREATE TABLE vendor_credentials (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id),
    credential_type VARCHAR(50), -- license, insurance, certification
    credential_number VARCHAR(100),
    issuing_authority VARCHAR(255),
    issue_date DATE,
    expiry_date DATE,
    document_url VARCHAR(500),
    is_verified BOOLEAN DEFAULT false,
    verified_by INTEGER REFERENCES users(id),
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vendor Service Areas
CREATE TABLE vendor_service_areas (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id),
    area_name VARCHAR(100),
    area_code VARCHAR(10),
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50),
    coordinates POINT,
    radius_km INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vendor Performance
CREATE TABLE vendor_performance (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id),
    metric_type VARCHAR(50), -- response_time, completion_rate, satisfaction
    metric_value DECIMAL(5,2),
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints
```typescript
// Vendor Management
GET /api/vendors
GET /api/vendors/:vendorId
POST /api/vendors
PUT /api/vendors/:vendorId
DELETE /api/vendors/:vendorId

// Vendor Profile
GET /api/vendors/:vendorId/profile
PUT /api/vendors/:vendorId/profile
POST /api/vendors/:vendorId/credentials
PUT /api/vendors/:vendorId/credentials/:credentialId

// Vendor Performance
GET /api/vendors/:vendorId/performance
GET /api/vendors/:vendorId/analytics

// Service Areas
GET /api/vendors/:vendorId/service-areas
POST /api/vendors/:vendorId/service-areas
DELETE /api/vendors/:vendorId/service-areas/:areaId
```

---

## User Management

### Implemented Features
- **User Profiles**: Personal information and preferences
- **Booking History**: Complete booking and review history
- **Favorites**: Saved services and vendors
- **Preferences**: Service preferences and notification settings
- **Analytics**: Personal spending and quality trends

### Backend Requirements

#### Database Schema
```sql
-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    profile_image VARCHAR(500),
    membership_type VARCHAR(20) DEFAULT 'standard',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User Favorites
CREATE TABLE user_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    service_id INTEGER REFERENCES services(id),
    vendor_id INTEGER REFERENCES vendors(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- User Preferences
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    preferred_categories INTEGER[],
    preferred_price_range DECIMAL(10,2)[],
    preferred_vendors INTEGER[],
    notification_settings JSONB,
    privacy_settings JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User Analytics
CREATE TABLE user_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    total_spent DECIMAL(10,2) DEFAULT 0,
    total_bookings INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2),
    favorite_categories INTEGER[],
    favorite_vendors INTEGER[],
    last_updated TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints
```typescript
// User Management
GET /api/users/:userId
PUT /api/users/:userId
DELETE /api/users/:userId

// User Profile
GET /api/users/:userId/profile
PUT /api/users/:userId/profile
POST /api/users/:userId/profile-image

// User Favorites
GET /api/users/:userId/favorites
POST /api/users/:userId/favorites
DELETE /api/users/:userId/favorites/:favoriteId

// User Preferences
GET /api/users/:userId/preferences
PUT /api/users/:userId/preferences

// User Analytics
GET /api/users/:userId/analytics
GET /api/users/:userId/spending
GET /api/users/:userId/quality-trends
```

---

## Review System

### Implemented Features
- **Service Reviews**: Star ratings and detailed reviews
- **Vendor Reviews**: Overall vendor ratings and feedback
- **Review Management**: Moderation and response system
- **Review Analytics**: Rating trends and sentiment analysis

### Backend Requirements

#### Database Schema
```sql
-- Reviews
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    service_id INTEGER REFERENCES services(id),
    vendor_id INTEGER REFERENCES vendors(id),
    booking_id INTEGER REFERENCES bookings(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    review_title VARCHAR(255),
    is_verified BOOLEAN DEFAULT false,
    is_helpful INTEGER DEFAULT 0,
    is_moderated BOOLEAN DEFAULT false,
    moderation_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Review Responses
CREATE TABLE review_responses (
    id SERIAL PRIMARY KEY,
    review_id INTEGER REFERENCES reviews(id),
    vendor_id INTEGER REFERENCES vendors(id),
    response_text TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Review Helpful Votes
CREATE TABLE review_helpful_votes (
    id SERIAL PRIMARY KEY,
    review_id INTEGER REFERENCES reviews(id),
    user_id INTEGER REFERENCES users(id),
    is_helpful BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Review Categories
CREATE TABLE review_categories (
    id SERIAL PRIMARY KEY,
    review_id INTEGER REFERENCES reviews(id),
    category_name VARCHAR(100),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints
```typescript
// Review Management
GET /api/reviews
GET /api/reviews/:reviewId
POST /api/reviews
PUT /api/reviews/:reviewId
DELETE /api/reviews/:reviewId

// Review Responses
POST /api/reviews/:reviewId/responses
PUT /api/reviews/:reviewId/responses/:responseId

// Review Moderation
GET /api/reviews/moderation/pending
PUT /api/reviews/:reviewId/moderate
POST /api/reviews/:reviewId/helpful

// Review Analytics
GET /api/reviews/analytics/vendor/:vendorId
GET /api/reviews/analytics/service/:serviceId
```

---

## Messaging System

### Implemented Features
- **User-Vendor Chat**: Direct messaging between users and vendors
- **Booking Communications**: Automated messages for booking updates
- **Support Tickets**: Customer support messaging system
- **Notification System**: Real-time notifications and alerts

### Backend Requirements

#### Database Schema
```sql
-- Messages
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id),
    receiver_id INTEGER REFERENCES users(id),
    conversation_id INTEGER REFERENCES conversations(id),
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, file, system
    message_text TEXT,
    message_data JSONB,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    vendor_id INTEGER REFERENCES vendors(id),
    booking_id INTEGER REFERENCES bookings(id),
    conversation_type VARCHAR(20), -- booking, support, general
    is_active BOOLEAN DEFAULT true,
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    notification_type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    notification_data JSONB,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Support Tickets
CREATE TABLE support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    vendor_id INTEGER REFERENCES vendors(id),
    ticket_type VARCHAR(50),
    subject VARCHAR(255),
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',
    assigned_to INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints
```typescript
// Messaging
GET /api/conversations
GET /api/conversations/:conversationId
POST /api/conversations
GET /api/conversations/:conversationId/messages
POST /api/conversations/:conversationId/messages

// Notifications
GET /api/notifications
PUT /api/notifications/:notificationId/read
DELETE /api/notifications/:notificationId

// Support
GET /api/support/tickets
POST /api/support/tickets
GET /api/support/tickets/:ticketId
PUT /api/support/tickets/:ticketId
```

---

## Analytics & Reporting

### Implemented Features
- **User Analytics**: Personal spending and booking trends
- **Vendor Analytics**: Performance metrics and business insights
- **Platform Analytics**: Overall platform usage and trends
- **Revenue Analytics**: Financial reporting and insights

### Backend Requirements

#### Database Schema
```sql
-- Analytics Events
CREATE TABLE analytics_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    event_type VARCHAR(100),
    event_data JSONB,
    session_id VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Revenue Analytics
CREATE TABLE revenue_analytics (
    id SERIAL PRIMARY KEY,
    date DATE,
    total_revenue DECIMAL(12,2),
    total_bookings INTEGER,
    average_booking_value DECIMAL(10,2),
    platform_fee_revenue DECIMAL(10,2),
    vendor_revenue DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vendor Analytics
CREATE TABLE vendor_analytics (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id),
    date DATE,
    total_bookings INTEGER,
    total_revenue DECIMAL(10,2),
    average_rating DECIMAL(3,2),
    response_time_minutes INTEGER,
    completion_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- User Analytics
CREATE TABLE user_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE,
    total_spent DECIMAL(10,2),
    total_bookings INTEGER,
    average_rating DECIMAL(3,2),
    favorite_categories INTEGER[],
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints
```typescript
// Analytics
GET /api/analytics/platform
GET /api/analytics/vendor/:vendorId
GET /api/analytics/user/:userId
GET /api/analytics/revenue

// Reports
GET /api/reports/vendor/:vendorId
GET /api/reports/user/:userId
GET /api/reports/platform
POST /api/reports/generate
```

---

## Payment System

### Implemented Features
- **Payment Processing**: Secure payment handling
- **Invoice Generation**: Automated invoice creation
- **Refund Management**: Refund processing and tracking
- **Payment History**: Complete payment records

### Backend Requirements

#### Database Schema
```sql
-- Payments
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id),
    user_id INTEGER REFERENCES users(id),
    vendor_id INTEGER REFERENCES vendors(id),
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending',
    transaction_id VARCHAR(255),
    gateway_response JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id),
    payment_id INTEGER REFERENCES payments(id),
    invoice_number VARCHAR(50),
    amount DECIMAL(10,2),
    tax_amount DECIMAL(10,2),
    total_amount DECIMAL(10,2),
    invoice_data JSONB,
    pdf_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Refunds
CREATE TABLE refunds (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments(id),
    amount DECIMAL(10,2),
    reason TEXT,
    refund_status VARCHAR(20) DEFAULT 'pending',
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints
```typescript
// Payments
POST /api/payments
GET /api/payments/:paymentId
PUT /api/payments/:paymentId
POST /api/payments/:paymentId/refund

// Invoices
GET /api/invoices/:invoiceId
POST /api/invoices/generate
GET /api/invoices/:invoiceId/download
```

---

## Search & Discovery

### Implemented Features
- **Advanced Search**: Multi-criteria search functionality
- **Filtering**: Category, price, rating, location filters
- **Sorting**: Multiple sorting options
- **Search Analytics**: Search behavior tracking

### Backend Requirements

#### Database Schema
```sql
-- Search Index
CREATE TABLE search_index (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id),
    vendor_id INTEGER REFERENCES vendors(id),
    search_text TSVECTOR,
    category_tags TEXT[],
    price_range INTEGER[],
    location_data JSONB,
    rating DECIMAL(3,2),
    popularity_score DECIMAL(5,2),
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Search Analytics
CREATE TABLE search_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    search_query TEXT,
    filters_applied JSONB,
    results_count INTEGER,
    clicked_result_id INTEGER,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints
```typescript
// Search
GET /api/search
GET /api/search/suggestions
POST /api/search/analytics

// Discovery
GET /api/discover/popular
GET /api/discover/trending
GET /api/discover/nearby
```

---

## Calendar Integration

### Implemented Features
- **Calendar Sync**: Google Calendar, Outlook, Apple Calendar
- **Booking Calendar**: Integrated booking calendar
- **Availability Management**: Real-time availability updates

### Backend Requirements

#### Database Schema
```sql
-- Calendar Integrations
CREATE TABLE calendar_integrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    calendar_type VARCHAR(20), -- google, outlook, apple
    access_token TEXT,
    refresh_token TEXT,
    calendar_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Calendar Events
CREATE TABLE calendar_events (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id),
    calendar_integration_id INTEGER REFERENCES calendar_integrations(id),
    external_event_id VARCHAR(255),
    event_data JSONB,
    sync_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints
```typescript
// Calendar Integration
POST /api/calendar/connect
GET /api/calendar/events
POST /api/calendar/events
DELETE /api/calendar/events/:eventId

// Availability
GET /api/calendar/availability
POST /api/calendar/availability/update
```

---

## File Management

### Implemented Features
- **Media Upload**: Images and videos for services
- **File Storage**: Secure file storage and retrieval
- **Media Processing**: Image optimization and video processing

### Backend Requirements

#### Database Schema
```sql
-- Files
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    file_size INTEGER,
    file_type VARCHAR(50),
    mime_type VARCHAR(100),
    uploader_id INTEGER REFERENCES users(id),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Media Processing
CREATE TABLE media_processing (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id),
    processing_type VARCHAR(50), -- resize, compress, thumbnail
    status VARCHAR(20) DEFAULT 'pending',
    result_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
```

#### API Endpoints
```typescript
// File Management
POST /api/files/upload
GET /api/files/:fileId
DELETE /api/files/:fileId
POST /api/files/:fileId/process
```

---

## Security & Authentication

### Implemented Features
- **User Authentication**: Secure login and registration
- **Authorization**: Role-based access control
- **Data Protection**: Encryption and security measures

### Backend Requirements

#### Database Schema
```sql
-- User Sessions
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    session_token VARCHAR(255) UNIQUE,
    device_info JSONB,
    ip_address INET,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Security Logs
CREATE TABLE security_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action_type VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints
```typescript
// Authentication
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
POST /api/auth/refresh
POST /api/auth/forgot-password
POST /api/auth/reset-password

// Security
GET /api/security/logs
POST /api/security/verify-email
POST /api/security/verify-phone
```

---

## Implementation Priority

### Phase 1: Core Functionality (High Priority)
1. **User Authentication & Authorization**
2. **Basic Booking System**
3. **Service Management**
4. **Vendor Management**
5. **Payment Processing**

### Phase 2: Enhanced Features (Medium Priority)
1. **Review System**
2. **Messaging System**
3. **Search & Discovery**
4. **File Management**
5. **Basic Analytics**

### Phase 3: Advanced Features (Lower Priority)
1. **Advanced Analytics**
2. **Calendar Integration**
3. **AI/ML Features**
4. **Advanced Notifications**
5. **Mobile App APIs**

---

## Technology Stack Recommendations

### Backend Framework
- **Node.js** with Express.js or NestJS
- **Python** with Django or FastAPI
- **Java** with Spring Boot

### Database
- **PostgreSQL** for primary database
- **Redis** for caching and sessions
- **MongoDB** for analytics data (optional)

### File Storage
- **AWS S3** or **Google Cloud Storage**
- **CloudFront** or **Cloud CDN** for delivery

### Payment Processing
- **Stripe** for payment processing
- **PayPal** as alternative

### Real-time Features
- **Socket.io** for real-time messaging
- **Redis** for pub/sub

### Search
- **Elasticsearch** for advanced search
- **Algolia** as managed alternative

---

## Performance Considerations

### Database Optimization
- Implement proper indexing on frequently queried columns
- Use database connection pooling
- Implement query optimization and caching

### API Performance
- Implement API rate limiting
- Use pagination for large datasets
- Implement response caching

### File Management
- Use CDN for static assets
- Implement image optimization
- Use lazy loading for media

### Security
- Implement HTTPS everywhere
- Use JWT tokens for authentication
- Implement input validation and sanitization
- Use prepared statements for database queries

---

## Testing Strategy

### Unit Testing
- Test individual API endpoints
- Test database operations
- Test business logic functions

### Integration Testing
- Test complete user workflows
- Test payment processing
- Test file upload/download

### Performance Testing
- Load testing for high-traffic scenarios
- Database performance testing
- API response time testing

### Security Testing
- Penetration testing
- Authentication testing
- Data validation testing

---

This comprehensive backend integration guide covers all the frontend features we've implemented and provides a roadmap for building a robust, scalable backend system for the Project Reliance platform. 