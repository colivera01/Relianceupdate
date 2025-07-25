# User Discovery Backend Integration

## Overview
Backend integration notes for user discovery features including geolocation services, vendor search, trending services, and location-based recommendations.

## Geolocation Services

### Enable User Location
```http
POST /api/user/location/enable
```
**Request Body:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "accuracy": 10,
  "address": "123 Main St, Downtown, NY 10001"
}
```

**Response:**
```json
{
  "success": true,
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "123 Main St, Downtown, NY 10001",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "US"
  },
  "permission": "granted"
}
```

### Disable User Location
```http
POST /api/user/location/disable
```

**Response:**
```json
{
  "success": true,
  "message": "Location tracking disabled"
}
```

### Get Location Status
```http
GET /api/user/location/status
```

**Response:**
```json
{
  "enabled": true,
  "permission": "granted",
  "lastUpdated": "2024-01-20T10:30:00Z",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "123 Main St, Downtown, NY 10001"
  }
}
```

### Update User Location
```http
PATCH /api/user/location
```
**Request Body:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "accuracy": 10
}
```

## Vendor Discovery API

### Search Vendors
```http
GET /api/discover/vendors
```
**Query Parameters:**
- `category` - Service category filter
- `location` - User location (lat,lng)
- `radius` - Search radius in miles (default: 25)
- `rating` - Minimum rating filter
- `price_range` - Price range (min-max)
- `availability` - Available now filter
- `verified` - Verified vendors only
- `sort` - Sort by: distance, rating, price, popularity
- `page` - Page number for pagination
- `limit` - Number of results per page

**Response:**
```json
{
  "vendors": [
    {
      "id": "vendor_123",
      "businessName": "Sparkle Cleaners",
      "businessDescription": "Professional cleaning services for homes and offices",
      "category": "cleaning",
      "rating": 4.8,
      "reviewCount": 127,
      "yearsInBusiness": 5,
      "distance": 0.8,
      "priceRange": "$50-$200",
      "availability": "Available Now",
      "responseTime": "5 min",
      "verified": true,
      "insurance": true,
      "bonded": true,
      "licensed": true,
      "featured": false,
      "imageUrl": "https://...",
      "services": [
        {
          "id": "service_123",
          "name": "Deep House Cleaning",
          "price": 150.00,
          "duration": 180
        }
      ],
      "location": {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "address": "456 Business St, NY 10001"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "filters": {
    "categories": ["cleaning", "plumbing", "electrical", "landscaping"],
    "priceRanges": ["$0-$50", "$50-$100", "$100-$200", "$200+"],
    "ratings": [4.0, 4.5, 4.8, 5.0]
  }
}
```

### Get Vendor Categories
```http
GET /api/discover/categories
```

**Response:**
```json
{
  "categories": [
    {
      "id": "cleaning",
      "name": "Cleaning Services",
      "description": "House cleaning, office cleaning, and specialized cleaning services",
      "icon": "sparkles",
      "popularity": 85,
      "averagePrice": 120.00,
      "vendorCount": 156
    },
    {
      "id": "plumbing",
      "name": "Plumbing",
      "description": "Plumbing repairs, installations, and emergency services",
      "icon": "wrench",
      "popularity": 72,
      "averagePrice": 180.00,
      "vendorCount": 89
    },
    {
      "id": "electrical",
      "name": "Electrical",
      "description": "Electrical repairs, installations, and safety inspections",
      "icon": "zap",
      "popularity": 68,
      "averagePrice": 200.00,
      "vendorCount": 67
    }
  ]
}
```

### Get Trending Services
```http
GET /api/discover/trending
```
**Query Parameters:**
- `location` - User location (lat,lng)
- `limit` - Number of trending services (default: 10)
- `period` - Trending period: daily, weekly, monthly

**Response:**
```json
{
  "trending": [
    {
      "id": "service_123",
      "name": "TikTok Style Haircut",
      "vendorName": "Style Studio NYC",
      "vendorId": "vendor_456",
      "category": "beauty",
      "rating": 4.8,
      "reviewCount": 89,
      "price": 45.00,
      "distance": 0.8,
      "trendingScore": 95,
      "imageUrl": "https://...",
      "description": "Viral TikTok-inspired haircuts and styling",
      "tags": ["trending", "viral", "social media"]
    }
  ],
  "period": "weekly",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "city": "New York"
  }
}
```

### Get Featured Vendors
```http
GET /api/discover/featured
```
**Query Parameters:**
- `location` - User location (lat,lng)
- `limit` - Number of featured vendors (default: 6)

**Response:**
```json
{
  "featured": [
    {
      "id": "vendor_123",
      "businessName": "Premium Cleaners",
      "featuredReason": "Top rated in your area",
      "rating": 4.9,
      "reviewCount": 234,
      "distance": 1.2,
      "imageUrl": "https://...",
      "promotion": {
        "type": "discount",
        "value": "20% off first booking",
        "code": "WELCOME20"
      }
    }
  ]
}
```

## Vendor Details API

### Get Vendor Profile
```http
GET /api/discover/vendors/{vendorId}
```

**Response:**
```json
{
  "id": "vendor_123",
  "businessName": "Sparkle Cleaners",
  "businessDescription": "Professional cleaning services for homes and offices",
  "category": "cleaning",
  "rating": 4.8,
  "reviewCount": 127,
  "yearsInBusiness": 5,
  "verified": true,
  "insurance": true,
  "bonded": true,
  "licensed": true,
  "responseTime": "5 min",
  "availability": "Available Now",
  "imageUrl": "https://...",
  "gallery": [
    "https://...",
    "https://..."
  ],
  "services": [
    {
      "id": "service_123",
      "name": "Deep House Cleaning",
      "description": "Complete house cleaning service",
      "price": 150.00,
      "duration": 180,
      "popular": true
    }
  ],
  "reviews": [
    {
      "id": "review_123",
      "userName": "Jane D.",
      "rating": 5,
      "review": "Excellent service! Very professional.",
      "date": "2024-01-15T10:30:00Z",
      "serviceName": "Deep House Cleaning"
    }
  ],
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "456 Business St, NY 10001",
    "serviceArea": 25
  },
  "availability": {
    "schedule": {
      "monday": {"start": "08:00", "end": "18:00"},
      "tuesday": {"start": "08:00", "end": "18:00"},
      "wednesday": {"start": "08:00", "end": "18:00"},
      "thursday": {"start": "08:00", "end": "18:00"},
      "friday": {"start": "08:00", "end": "18:00"},
      "saturday": {"start": "09:00", "end": "16:00"},
      "sunday": {"start": "10:00", "end": "14:00"}
    },
    "nextAvailable": "2024-01-20T10:00:00Z"
  }
}
```

### Get Vendor Availability
```http
GET /api/discover/vendors/{vendorId}/availability
```
**Query Parameters:**
- `date` - Date to check availability
- `service_id` - Service type for duration calculation

**Response:**
```json
{
  "vendorId": "vendor_123",
  "date": "2024-01-20",
  "availableSlots": [
    {
      "time": "09:00",
      "duration": 180,
      "available": true,
      "price": 150.00
    },
    {
      "time": "10:00",
      "duration": 180,
      "available": true,
      "price": 150.00
    },
    {
      "time": "11:00",
      "duration": 180,
      "available": false,
      "reason": "Existing booking"
    }
  ]
}
```

## Search and Filtering

### Advanced Search
```http
POST /api/discover/search
```
**Request Body:**
```json
{
  "query": "house cleaning",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "radius": 25
  },
  "filters": {
    "categories": ["cleaning"],
    "priceRange": {"min": 50, "max": 200},
    "rating": 4.0,
    "availability": "today",
    "verified": true,
    "insurance": true
  },
  "sort": "distance",
  "page": 1,
  "limit": 20
}
```

### Get Search Suggestions
```http
GET /api/discover/suggestions
```
**Query Parameters:**
- `q` - Search query
- `location` - User location (lat,lng)

**Response:**
```json
{
  "suggestions": [
    {
      "type": "service",
      "text": "Deep House Cleaning",
      "category": "cleaning"
    },
    {
      "type": "vendor",
      "text": "Sparkle Cleaners",
      "category": "cleaning"
    },
    {
      "type": "category",
      "text": "Cleaning Services",
      "category": "cleaning"
    }
  ]
}
```

## User Preferences and Recommendations

### Save Search Preferences
```http
POST /api/user/preferences/search
```
**Request Body:**
```json
{
  "preferredCategories": ["cleaning", "plumbing"],
  "preferredPriceRange": {"min": 50, "max": 200},
  "preferredDistance": 25,
  "notifications": {
    "newVendors": true,
    "priceDrops": true,
    "trendingServices": true
  }
}
```

### Get Personalized Recommendations
```http
GET /api/discover/recommendations
```
**Query Parameters:**
- `location` - User location (lat,lng)
- `limit` - Number of recommendations (default: 10)

**Response:**
```json
{
  "recommendations": [
    {
      "id": "vendor_123",
      "businessName": "Sparkle Cleaners",
      "reason": "Based on your previous bookings",
      "matchScore": 95,
      "rating": 4.8,
      "distance": 0.8,
      "price": 150.00
    }
  ],
  "basedOn": {
    "previousBookings": true,
    "searchHistory": true,
    "location": true
  }
}
```

## Favorites and Bookmarks

### Add to Favorites
```http
POST /api/user/favorites/vendors
```
**Request Body:**
```json
{
  "vendorId": "vendor_123"
}
```

### Remove from Favorites
```http
DELETE /api/user/favorites/vendors/{vendorId}
```

### Get User Favorites
```http
GET /api/user/favorites/vendors
```

**Response:**
```json
{
  "favorites": [
    {
      "id": "vendor_123",
      "businessName": "Sparkle Cleaners",
      "rating": 4.8,
      "distance": 0.8,
      "addedAt": "2024-01-15T10:30:00Z",
      "lastBooked": "2024-01-10T14:00:00Z"
    }
  ]
}
```

## Location Services

### Geocoding Service
```http
GET /api/location/geocode
```
**Query Parameters:**
- `address` - Address to geocode

**Response:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "address": "123 Main St, Downtown, NY 10001",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "country": "US"
}
```

### Reverse Geocoding
```http
GET /api/location/reverse-geocode
```
**Query Parameters:**
- `lat` - Latitude
- `lng` - Longitude

**Response:**
```json
{
  "address": "123 Main St, Downtown, NY 10001",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "country": "US",
  "neighborhood": "Downtown"
}
```

### Calculate Distance
```http
POST /api/location/distance
```
**Request Body:**
```json
{
  "origin": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "destination": {
    "latitude": 40.7589,
    "longitude": -73.9851
  }
}
```

**Response:**
```json
{
  "distance": 3.2,
  "unit": "miles",
  "duration": 15,
  "unit": "minutes"
}
```

## Analytics and Insights

### Get Discovery Analytics
```http
GET /api/discover/analytics
```
**Query Parameters:**
- `location` - User location (lat,lng)
- `period` - Analytics period: daily, weekly, monthly

**Response:**
```json
{
  "totalVendors": 156,
  "availableVendors": 89,
  "averageRating": 4.6,
  "averagePrice": 125.00,
  "popularCategories": [
    {
      "category": "cleaning",
      "vendorCount": 45,
      "averageRating": 4.7
    }
  ],
  "trendingServices": [
    {
      "service": "Deep House Cleaning",
      "growth": 25.5,
      "popularity": 85
    }
  ]
}
```

## Real-time Updates

### WebSocket Events

#### Vendor Status Updates
```javascript
// Subscribe to vendor status updates in area
socket.emit('subscribe_vendors', { 
  location: { lat: 40.7128, lng: -74.0060 },
  radius: 25 
});

// Receive vendor status updates
socket.on('vendor_status_update', (data) => {
  console.log('Vendor status updated:', data);
  // {
  //   vendorId: 'vendor_123',
  //   availability: 'Available Now',
  //   responseTime: '5 min',
  //   location: { latitude: 40.7128, longitude: -74.0060 }
  // }
});
```

#### New Vendor Notifications
```javascript
// Subscribe to new vendor notifications
socket.emit('subscribe_new_vendors', { 
  location: { lat: 40.7128, lng: -74.0060 },
  radius: 25 
});

// Receive new vendor notifications
socket.on('new_vendor', (data) => {
  console.log('New vendor in area:', data);
  // {
  //   vendorId: 'vendor_456',
  //   businessName: 'New Cleaners',
  //   category: 'cleaning',
  //   distance: 1.2
  // }
});
```

This backend integration provides comprehensive discovery features with location-based services, real-time updates, and personalized recommendations. 