# Vendor Integration Requirements - Critical Data Flow

## Overview
This document outlines the specific data requirements from vendor pages to ensure all user-facing features display correctly and function properly.

---

## Critical Vendor Page Data Requirements

### 1. Vendor Profile Page (`/vendor/profile`)

#### Required Fields for User Discovery:
```javascript
// These fields MUST be populated for user pages to work
{
  "businessName": "Quick Fix Plumbing", // Required
  "businessType": "Professional Cleaning", // Required
  "serviceTypes": ["House Cleaning", "Deep Cleaning", "Move-in/Move-out"], // Required - multi-select
  "bio": "Professional cleaning services with over 5 years of experience...", // Required
  "profilePhoto": "https://example.com/photo.jpg", // Required
  "address": "123 Main St, Downtown", // Required
  "latitude": 40.7128, // Required for distance calculation
  "longitude": -74.0060, // Required for distance calculation
  "phone": "+1234567890", // Required for contact
  "email": "contact@quickfix.com", // Required
  "yearsInBusiness": 8, // Required for trust indicators
  "insurance": true, // Required for verification badges
  "bonded": true, // Required for verification badges
  "licensed": true, // Required for verification badges
  "verified": true, // System-generated based on verification process
  "featured": false // System-generated based on performance
}
```

#### Data Flow Impact:
- **User Discover Page**: Vendor cards display business name, photo, rating, distance
- **Service Detail Pages**: Vendor information section
- **Search Results**: Vendor listings with all details
- **Favorites Page**: Vendor information in favorite cards

---

### 2. Service Management Page (`/vendor/services`)

#### Required Fields for User Service Pages:
```javascript
// Each service MUST have these fields populated
{
  "name": "Emergency Plumbing Repair", // Required
  "description": "24/7 emergency plumbing services for all types of issues...", // Required
  "price": 150.00, // Required
  "priceType": "fixed", // Required: "fixed", "hourly", "quote"
  "category": "plumbing", // Required - must match user category filters
  "features": [ // Required - displayed on service detail page
    "24/7 Emergency Service",
    "Licensed & Insured",
    "Same Day Service",
    "Free Estimates"
  ],
  "inclusions": [ // Required - "What's Included" section
    "Labor costs",
    "Basic parts",
    "Cleanup",
    "Warranty"
  ],
  "exclusions": [ // Required - "What's Not Included" section
    "Major parts replacement",
    "Permit fees",
    "After-hours surcharge"
  ],
  "images": [ // Required - service gallery
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "videos": [ // Optional - service videos
    "https://example.com/video1.mp4"
  ],
  "availability": { // Required - booking system
    "responseTime": "30-60 minutes",
    "availableNow": true,
    "availableToday": true,
    "availableThisWeek": true
  },
  "serviceAreas": [ // Required - location-based search
    "Downtown",
    "Midtown",
    "Uptown"
  ]
}
```

#### Data Flow Impact:
- **User Dashboard**: Trending services, personalized recommendations
- **Service Detail Pages**: Complete service information display
- **Booking Flow**: Service details, pricing, availability
- **Search Results**: Service listings with all details
- **Reviews**: Service name and description in reviews

---

### 3. Vendor Dashboard Analytics

#### Required Metrics for User Trust:
```javascript
// These metrics MUST be calculated and updated regularly
{
  "totalJobs": 1247, // System-generated from completed bookings
  "averageRating": 4.8, // System-generated from reviews
  "totalReviews": 156, // System-generated from reviews
  "responseTime": 120, // System-generated in minutes
  "completionRate": 98.5, // System-generated percentage
  "customerSatisfaction": 4.9, // System-generated from reviews
  "verificationStatus": "verified", // System-generated based on verification process
  "featuredStatus": false // System-generated based on performance metrics
}
```

#### Data Flow Impact:
- **Vendor Cards**: Trust indicators, ratings, response times
- **Service Detail Pages**: Vendor credibility information
- **Search Rankings**: Performance-based sorting
- **User Trust**: Verification badges and metrics

---

## Integration Points by User Feature

### 1. User Dashboard

#### Personalized Services Section:
```javascript
// Requires data from:
- Vendor profile: businessName, category, rating
- Service management: name, description, price, images
- Analytics: totalJobs, averageRating, responseTime
- User behavior: search history, booking history, favorites
```

#### Trending Services Section:
```javascript
// Requires data from:
- Service management: name, description, price, images, category
- Analytics: totalJobs, averageRating, completionRate
- Booking data: recent bookings, popularity metrics
```

#### Seasonal Suggestions:
```javascript
// Requires data from:
- Service management: category, description
- External data: weather, seasonal trends
- User location: for local seasonal needs
```

### 2. Discover Page

#### Vendor Cards:
```javascript
// Requires data from:
- Vendor profile: businessName, profilePhoto, distance, yearsInBusiness
- Analytics: averageRating, totalReviews, verified, featured
- Service management: availability, responseTime, priceRange
- Location data: latitude, longitude for distance calculation
```

#### Category Sections:
```javascript
// Requires data from:
- Vendor profile: category, serviceTypes
- Service management: category matching
- Analytics: vendorCount per category
```

### 3. Search Page

#### Search Results:
```javascript
// Requires data from:
- Vendor profile: businessName, category, distance, verified
- Service management: name, description, price, availability
- Analytics: averageRating, responseTime, completionRate
- Location data: for distance-based filtering
```

#### Filter Options:
```javascript
// Requires data from:
- Vendor profile: category, verified, insurance, bonded, licensed
- Service management: price, availability
- Analytics: averageRating
- Location data: for distance filtering
```

### 4. Service Detail Pages

#### Service Information:
```javascript
// Requires data from:
- Service management: ALL fields (name, description, price, features, inclusions, exclusions, images, videos)
- Vendor profile: businessName, profilePhoto, verified, yearsInBusiness
- Analytics: averageRating, totalReviews, responseTime, completionRate
```

#### Booking Integration:
```javascript
// Requires data from:
- Service management: price, availability, responseTime
- Vendor profile: contact information
- Booking system: availability slots, booking process
```

### 5. Booking System

#### Booking Flow:
```javascript
// Requires data from:
- Service management: price, availability, responseTime
- Vendor profile: contact information, service areas
- Booking system: date/time slots, confirmation process
```

#### My Bookings Page:
```javascript
// Requires data from:
- Booking system: booking details, status, dates
- Service management: service name, description
- Vendor profile: businessName, contact information
- Payment system: payment status, amounts
```

### 6. Reviews System

#### Review Display:
```javascript
// Requires data from:
- Reviews: rating, title, content, date, helpful count
- Vendor profile: businessName, profilePhoto
- Service management: service name
- Booking system: booking details, service date
```

#### Review System Integration:
```javascript
// Requires data from:
- Booking system: completion status, dates, service details
- Service management: service name, description, category
- Vendor profile: businessName, vendorImage
- Review system: pending review creation, 72-hour timer
- Timer system: track 72 hours from service completion
- Auto-generation: Always 5-star rating for auto-generated reviews
- Notification system: alert users of pending reviews
- User management: user preferences, review history
```

### 7. Favorites System

#### Favorites Display:
```javascript
// Requires data from:
- Vendor profile: businessName, profilePhoto, distance, rating
- Analytics: averageRating, totalReviews, verified
- Service management: availability, responseTime
- Favorites system: user notes, last contacted
```

### 8. User Profile & Settings

#### Profile Management:
```javascript
// Requires data from:
- User system: personal information, preferences
- Booking system: booking history, statistics
- Reviews system: review history, ratings given
- Favorites system: favorite vendors count
```

---

## Critical Integration Checklist

### Vendor Profile Page Requirements:
- [ ] Business name field (required)
- [ ] Business type field (required)
- [ ] Service types multi-select (required)
- [ ] Bio text area (required)
- [ ] Profile photo upload (required)
- [ ] Address and location fields (required)
- [ ] Phone and email fields (required)
- [ ] Years in business field (required)
- [ ] Insurance/bonded/licensed checkboxes (required)
- [ ] Service areas definition (required)

### Service Management Page Requirements:
- [ ] Service name field (required)
- [ ] Service description field (required)
- [ ] Pricing configuration (required)
- [ ] Service category selection (required)
- [ ] Features list input (required)
- [ ] Inclusions list input (required)
- [ ] Exclusions list input (required)
- [ ] Image upload functionality (required)
- [ ] Video upload functionality (optional)
- [ ] Availability scheduling (required)
- [ ] Response time setting (required)
- [ ] Service areas mapping (required)

### Analytics Dashboard Requirements:
- [ ] Total jobs completed counter (system-generated)
- [ ] Average rating calculation (system-generated)
- [ ] Response time tracking (system-generated)
- [ ] Completion rate calculation (system-generated)
- [ ] Customer satisfaction metrics (system-generated)
- [ ] Verification status display (system-generated)
- [ ] Featured status indicator (system-generated)

### Data Validation Requirements:
- [ ] All required fields must be validated
- [ ] Location data must be geocoded
- [ ] Image uploads must be processed and optimized
- [ ] Video uploads must be processed and compressed
- [ ] Pricing must be validated and formatted
- [ ] Contact information must be validated
- [ ] Service areas must be properly mapped

### Real-time Updates:
- [ ] Analytics must update in real-time
- [ ] Availability must sync with booking system
- [ ] Ratings must update immediately after reviews
- [ ] Profile changes must reflect immediately
- [ ] Service updates must be live

---

## Error Handling

### Missing Data Scenarios:
```javascript
// Handle cases where vendor data is incomplete
{
  "businessName": "Quick Fix Plumbing", // ✅ Present
  "profilePhoto": null, // ❌ Missing - show default avatar
  "bio": "", // ❌ Empty - show "No description available"
  "rating": null, // ❌ Missing - show "No ratings yet"
  "distance": null, // ❌ Missing - show "Distance unavailable"
  "availability": null // ❌ Missing - show "Contact for availability"
}
```

### Fallback Values:
```javascript
// Default values for missing data
{
  "defaultProfilePhoto": "/images/default-vendor-avatar.png",
  "defaultBio": "No description available",
  "defaultRating": 0,
  "defaultDistance": "Distance unavailable",
  "defaultAvailability": "Contact for availability",
  "defaultResponseTime": "Contact for response time"
}
```

---

## Performance Considerations

### Data Optimization:
- [ ] Cache frequently accessed vendor data
- [ ] Optimize image and video delivery
- [ ] Implement pagination for large datasets
- [ ] Use database indexing for search queries
- [ ] Compress API responses

### Loading States:
- [ ] Show skeleton loaders while data loads
- [ ] Implement progressive image loading
- [ ] Cache vendor profiles locally
- [ ] Preload critical data

---

This document ensures that all vendor pages provide the necessary data for user-facing features to function correctly and display properly. 