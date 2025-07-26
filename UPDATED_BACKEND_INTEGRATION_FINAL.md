# Complete Backend Integration Guide - Updated Final Version

## Overview
This document outlines the complete backend integration requirements for Project Reliance, including all implemented frontend features and their corresponding backend systems.

## Core Database Schema

### Users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  profile_photo VARCHAR(255),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  address TEXT,
  preferences JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Vendors
```sql
CREATE TABLE vendors (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  business_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(100),
  description TEXT,
  profile_photo VARCHAR(255),
  bio TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  service_areas JSONB, -- Array of service area objects
  service_types TEXT[], -- Array of service type strings
  verification_status VARCHAR(20) DEFAULT 'pending',
  insurance_info JSONB,
  bonding_info JSONB,
  credentials JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Services
```sql
CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES vendors(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2),
  price_type VARCHAR(20), -- 'fixed', 'hourly', 'quote'
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
```

### Bookings
```sql
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  vendor_id INTEGER REFERENCES vendors(id),
  service_id INTEGER REFERENCES services(id),
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'
  total_price DECIMAL(10, 2),
  notes TEXT,
  user_notes TEXT,
  vendor_notes TEXT,
  completion_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Reviews (Updated)
```sql
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  vendor_id INTEGER REFERENCES vendors(id),
  booking_id INTEGER REFERENCES bookings(id),
  type VARCHAR(20) NOT NULL DEFAULT 'written', -- 'written' (users write reviews about vendors)
  creation_type VARCHAR(20) NOT NULL, -- 'manual', 'auto'
  rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 5), -- 0 for pending reviews
  title VARCHAR(255), -- NULL for pending reviews
  content TEXT, -- NULL for pending reviews
  helpful_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- 'published', 'pending', 'rejected'
  auto_generated_reason VARCHAR(255),
  auto_generated_at TIMESTAMP, -- When auto-review was generated
  manual_review_deadline TIMESTAMP, -- 72 hours from service completion
  images TEXT[], -- Array of image URLs
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Favorites
```sql
CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  vendor_id INTEGER REFERENCES vendors(id),
  service_id INTEGER REFERENCES services(id),
  notes TEXT,
  contacted BOOLEAN DEFAULT FALSE,
  last_contacted TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Notifications
```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type VARCHAR(50) NOT NULL, -- 'booking_confirmed', 'service_completed', 'review_pending', 'price_drop', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- Additional data for the notification
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Authentication
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET /api/auth/me
PUT /api/auth/profile
```

### Users
```
GET /api/users
GET /api/users/:id
PUT /api/users/:id
DELETE /api/users/:id
GET /api/users/:id/preferences
PUT /api/users/:id/preferences
```

### Vendors
```
GET /api/vendors
GET /api/vendors/:id
POST /api/vendors
PUT /api/vendors/:id
DELETE /api/vendors/:id
GET /api/vendors/:id/services
GET /api/vendors/:id/reviews
GET /api/vendors/:id/availability
```

### Services
```
GET /api/services
GET /api/services/:id
POST /api/services
PUT /api/services/:id
DELETE /api/services/:id
GET /api/services/search
GET /api/services/categories
POST /api/services/:id/media
DELETE /api/services/:id/media/:mediaId
```

### Bookings
```
GET /api/bookings
GET /api/bookings/:id
POST /api/bookings
PUT /api/bookings/:id
DELETE /api/bookings/:id
POST /api/bookings/:id/confirm
POST /api/bookings/:id/complete
POST /api/bookings/:id/cancel
GET /api/bookings/user/:userId
GET /api/bookings/vendor/:vendorId
```

### Reviews (Updated)
```
GET /api/reviews
GET /api/reviews/:id
POST /api/reviews
PUT /api/reviews/:id
DELETE /api/reviews/:id
POST /api/reviews/:id/helpful
POST /api/reviews/:id/reply
GET /api/reviews/auto-generate
POST /api/reviews/auto-generate
POST /api/reviews/check-72-hour-deadline
POST /api/reviews/create-pending
GET /api/reviews/pending-count
POST /api/reviews/:id/complete
```

### Favorites
```
GET /api/favorites
GET /api/favorites/:id
POST /api/favorites
PUT /api/favorites/:id
DELETE /api/favorites/:id
GET /api/favorites/user/:userId
```

### Notifications
```
GET /api/notifications
GET /api/notifications/:id
POST /api/notifications
PUT /api/notifications/:id/read
DELETE /api/notifications/:id
GET /api/notifications/unread-count
```

### Dashboard Analytics
```
GET /api/dashboard/stats
GET /api/dashboard/user-growth
GET /api/dashboard/vendor-stats
GET /api/dashboard/booking-stats
```

## Review System Integration (Updated)

### Review Creation Flow
```javascript
// 1. Service Completion - Create Pending Review
// API: POST /api/reviews/create-pending
{
  "bookingId": "booking_id",
  "userId": "user_id",
  "vendorId": "vendor_id",
  "serviceName": "Interior House Painting",
  "serviceDate": "2024-01-22T08:00:00Z",
  "price": 1200,
  "category": "painting-services"
}

// 2. User Writes Review
// API: POST /api/reviews/:id/complete
{
  "rating": 5,
  "title": "Excellent painting service",
  "content": "The painters did an amazing job...",
  "images": ["url1", "url2"]
}

// 3. Auto-Generation Logic (72-hour timer)
// API: POST /api/reviews/auto-generate
{
  "bookingId": "booking_id",
  "reason": "no_review_after_72_hours",
  "defaultRating": 5, // Always 5 stars for auto-generated reviews
  "defaultTitle": "Service completed successfully",
  "defaultContent": "Your service has been completed successfully. This review was automatically generated as no review was submitted within 72 hours of service completion.",
  "autoGeneratedAt": "2024-01-20T10:30:00Z"
}
```

### Review Display & Management
```javascript
// API: GET /api/reviews?status=pending&creationType=manual
{
  "reviews": [
    {
      "id": "review_id",
      "type": "written",
      "creationType": "manual",
      "status": "pending",
      "vendor": {
        "name": "Premium Paint Pros",
        "image": "url"
      },
      "rating": 0, // Pending reviews have 0 rating
      "title": null, // Pending reviews have no title
      "content": null, // Pending reviews have no content
      "serviceName": "Interior House Painting",
      "serviceDate": "2024-01-22T08:00:00Z",
      "price": 1200,
      "category": "painting-services",
      "createdAt": "2024-01-22T10:00:00Z"
    }
  ]
}

// API: GET /api/reviews/pending-count
{
  "pendingCount": 2,
  "totalReviews": 9
}
```

## Integration Requirements by Feature

### User Dashboard
- **Personalized Services**: User preferences, booking history, location data
- **Seasonal Suggestions**: Weather API, user location, service categories
- **Social Proof Indicators**: Real-time booking data, user location
- **Community Reviews**: Local review aggregation, user preferences
- **Price Comparison**: Vendor pricing data, service categories
- **Smart Notifications**: User preferences, booking status, review deadlines

### Booking System
- **Multi-step Flow**: Service details, vendor availability, pricing
- **My Bookings**: Booking history, status tracking, vendor information
- **Booking Management**: Status updates, rescheduling, cancellation
- **Payment Integration**: Payment processing, receipt generation

### Reviews System (Updated)
- **Pending Reviews**: Service completion triggers, 72-hour timer
- **Review Writing**: User interface, media upload, rating system
- **Auto-Generation**: Timer system, default content, 5-star rating
- **Review Management**: Edit/delete permissions, moderation

### Favorites System
- **Favorite Management**: Add/remove favorites, notes, contact tracking
- **Quick Actions**: Contact vendor, book service, view details
- **Organization**: Categories, search, filtering

### Search & Discovery
- **Service Search**: Full-text search, category filtering, location-based
- **Vendor Discovery**: Profile data, service offerings, availability
- **Advanced Filters**: Price range, rating, distance, availability

### User Profile & Settings
- **Profile Management**: Personal information, preferences, privacy
- **Settings**: Notification preferences, privacy settings, account management
- **Location Services**: Geolocation, address management

## Vendor Integration Requirements

### Vendor Profile Page
- **Business Information**: Name, type, contact details, bio
- **Service Types**: Multi-select service categories
- **Profile Photo**: Image upload and management
- **Service Areas**: Geographic coverage areas
- **Credentials**: Verification documents, insurance, bonding

### Service Management Page
- **Service Creation**: Name, description, pricing, category
- **Media Management**: Image and video upload
- **Features & Inclusions**: Detailed service information
- **Availability**: Scheduling and availability management
- **Pricing**: Fixed, hourly, or quote-based pricing

### Service Completion Workflow
- **Mark Service Complete**: Update booking status
- **Trigger Pending Review**: Create review record
- **Send Notification**: Alert user of completion
- **Start 72-Hour Timer**: Track review deadline

## Performance & Security Considerations

### Database Optimization
- Indexes on frequently queried fields
- Query optimization for complex joins
- Caching for static data
- Pagination for large result sets

### Security Measures
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF tokens
- Rate limiting
- Authentication and authorization

### Scalability
- Horizontal scaling for high traffic
- CDN for media files
- Load balancing
- Database sharding for large datasets
- Caching strategies

## Implementation Priority

### High Priority (Core Functionality)
1. **Authentication System**
2. **User & Vendor Management**
3. **Service Management**
4. **Booking System**
5. **Review System (Updated)**
6. **Basic Search & Discovery**

### Medium Priority (Enhanced Features)
1. **Favorites System**
2. **Advanced Search Filters**
3. **Notification System**
4. **Analytics Dashboard**
5. **Payment Integration**

### Low Priority (Advanced Features)
1. **AI/ML Integration**
2. **Real-time Features**
3. **Advanced Analytics**
4. **Mobile App APIs**
5. **Third-party Integrations**

## Testing Strategy

### Unit Testing
- API endpoint testing
- Database operation testing
- Business logic validation
- Error handling verification

### Integration Testing
- End-to-end workflow testing
- Cross-system integration
- Performance testing
- Security testing

### User Acceptance Testing
- Frontend-backend integration
- User workflow validation
- Performance under load
- Mobile responsiveness

This updated integration guide reflects all the latest changes to the review system and provides a comprehensive roadmap for backend implementation. 