# Personalization Backend Integration Guide

## Overview
Backend integration requirements for personalized features including "For You" recommendations, seasonal suggestions, recently viewed services, and smart categories.

## 1. "For You" Personalized Recommendations

### API Endpoints

#### Get Personalized Recommendations
```http
GET /api/user/recommendations
```

**Query Parameters:**
- `limit` - Number of recommendations (default: 10)
- `category` - Filter by service category
- `confidence_threshold` - Minimum confidence score (default: 0.7)

**Response:**
```json
{
  "recommendations": [
    {
      "id": "service_123",
      "name": "Deep House Cleaning",
      "vendor": "Sparkle Clean Pro",
      "vendorId": "vendor_456",
      "rating": 4.9,
      "distance": 0.4,
      "price": 120.00,
      "imageUrl": "https://...",
      "reason": "Based on your last booking",
      "confidence": 0.95,
      "category": "cleaning",
      "relevanceFactors": [
        "previous_booking",
        "location_proximity",
        "rating_match",
        "price_range"
      ]
    }
  ],
  "totalCount": 10,
  "lastUpdated": "2024-01-20T10:30:00Z"
}
```

#### Update User Preferences
```http
POST /api/user/preferences
```

**Request Body:**
```json
{
  "categories": ["cleaning", "plumbing", "landscaping"],
  "priceRange": {
    "min": 50,
    "max": 200
  },
  "preferredVendors": ["vendor_123", "vendor_456"],
  "homeType": "single_family",
  "pets": ["dog", "cat"],
  "familySize": 4
}
```

### Database Schema

```sql
-- User preferences table
CREATE TABLE user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  categories JSONB,
  price_range JSONB,
  preferred_vendors TEXT[],
  home_type VARCHAR(50),
  pets TEXT[],
  family_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User behavior tracking
CREATE TABLE user_behavior (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action_type VARCHAR(50), -- 'view', 'book', 'favorite', 'review'
  service_id INTEGER REFERENCES services(id),
  vendor_id INTEGER REFERENCES vendors(id),
  category VARCHAR(50),
  price DECIMAL(10,2),
  rating INTEGER,
  timestamp TIMESTAMP DEFAULT NOW(),
  session_id VARCHAR(100)
);

-- Recommendation engine cache
CREATE TABLE recommendation_cache (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  service_id INTEGER REFERENCES services(id),
  confidence_score DECIMAL(3,2),
  reason TEXT,
  relevance_factors JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
```

## 2. Seasonal Suggestions

### API Endpoints

#### Get Seasonal Recommendations
```http
GET /api/seasonal/recommendations
```

**Query Parameters:**
- `location` - User location (lat,lng)
- `season` - Current season (auto-detected or manual)
- `weather` - Current weather conditions
- `limit` - Number of suggestions (default: 8)

**Response:**
```json
{
  "seasonalSuggestions": [
    {
      "id": "service_789",
      "name": "AC Maintenance",
      "vendor": "Cool Comfort Pro",
      "rating": 4.8,
      "distance": 0.9,
      "price": 75.00,
      "imageUrl": "https://...",
      "reason": "Summer is here! Keep cool",
      "urgency": "high",
      "season": "summer",
      "weatherTrigger": "temperature > 80",
      "seasonalDiscount": 15
    }
  ],
  "currentSeason": "summer",
  "weatherConditions": {
    "temperature": 85,
    "condition": "sunny",
    "humidity": 65
  },
  "seasonalTips": [
    "Schedule AC maintenance before peak summer",
    "Consider gutter cleaning for fall preparation"
  ]
}
```

#### Update Weather Data
```http
POST /api/weather/update
```

**Request Body:**
```json
{
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "weather": {
    "temperature": 85,
    "condition": "sunny",
    "humidity": 65,
    "forecast": "hot_sunny_week"
  }
}
```

### Database Schema

```sql
-- Seasonal service mappings
CREATE TABLE seasonal_services (
  id SERIAL PRIMARY KEY,
  service_id INTEGER REFERENCES services(id),
  season VARCHAR(20),
  urgency VARCHAR(20), -- 'high', 'medium', 'low'
  reason TEXT,
  weather_trigger JSONB,
  seasonal_discount INTEGER,
  priority INTEGER
);

-- Weather data cache
CREATE TABLE weather_cache (
  id SERIAL PRIMARY KEY,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  temperature DECIMAL(5,2),
  condition VARCHAR(50),
  humidity INTEGER,
  forecast JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 3. Recently Viewed Services

### API Endpoints

#### Get Recently Viewed
```http
GET /api/user/recently-viewed
```

**Query Parameters:**
- `limit` - Number of recent items (default: 10)
- `category` - Filter by category
- `days` - Look back period in days (default: 30)

**Response:**
```json
{
  "recentlyViewed": [
    {
      "id": "service_123",
      "name": "TikTok Style Haircut",
      "vendor": "Style Studio NYC",
      "vendorId": "vendor_456",
      "imageUrl": "https://...",
      "lastViewed": "2024-01-20T08:30:00Z",
      "viewCount": 3,
      "category": "beauty",
      "price": 45.00,
      "rating": 4.8
    }
  ],
  "totalCount": 15,
  "viewingPatterns": {
    "mostViewedCategory": "beauty",
    "averageViewsPerService": 2.3,
    "favoriteVendors": ["vendor_123", "vendor_456"]
  }
}
```

#### Track Service View
```http
POST /api/user/track-view
```

**Request Body:**
```json
{
  "serviceId": "service_123",
  "vendorId": "vendor_456",
  "category": "beauty",
  "sessionId": "session_789",
  "viewDuration": 45, // seconds
  "source": "homepage" // where they came from
}
```

### Database Schema

```sql
-- Recently viewed services
CREATE TABLE recently_viewed (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  service_id INTEGER REFERENCES services(id),
  vendor_id INTEGER REFERENCES vendors(id),
  category VARCHAR(50),
  view_count INTEGER DEFAULT 1,
  first_viewed TIMESTAMP DEFAULT NOW(),
  last_viewed TIMESTAMP DEFAULT NOW(),
  total_view_duration INTEGER DEFAULT 0, -- seconds
  source VARCHAR(50)
);

-- View tracking for analytics
CREATE TABLE view_tracking (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  service_id INTEGER REFERENCES services(id),
  session_id VARCHAR(100),
  view_duration INTEGER,
  source VARCHAR(50),
  timestamp TIMESTAMP DEFAULT NOW()
);
```

## 4. Smart Categories

### API Endpoints

#### Get Smart Categories
```http
GET /api/user/smart-categories
```

**Response:**
```json
{
  "smartCategories": [
    {
      "name": "Home Services",
      "icon": "🏠",
      "count": 12,
      "reason": "Based on your home type",
      "category": "home_services",
      "relevanceScore": 0.92,
      "trending": true,
      "services": [
        {
          "id": "service_123",
          "name": "House Cleaning",
          "vendor": "Clean Pro",
          "rating": 4.8,
          "price": 120.00
        }
      ]
    }
  ],
  "userInsights": {
    "homeType": "single_family",
    "preferredCategories": ["cleaning", "plumbing"],
    "spendingPatterns": {
      "averageSpend": 150.00,
      "favoritePriceRange": "100-200"
    }
  }
}
```

## 5. Social Proof Indicators

### API Endpoints

#### Get Social Proof Data
```http
GET /api/social-proof/indicators
```

**Query Parameters:**
- `location` - User location (lat,lng)
- `radius` - Search radius in miles (default: 10)
- `timeFrame` - Time period (today, week, month)

**Response:**
```json
{
  "socialProofData": [
    {
      "serviceId": "service_123",
      "serviceName": "TikTok Style Haircut",
      "vendor": "Style Studio NYC",
      "bookingsToday": 23,
      "area": "Downtown",
      "timeFrame": "today",
      "trending": true,
      "localActivity": {
        "bookingsInLastHour": 5,
        "bookingsInLastDay": 23,
        "bookingsInLastWeek": 156,
        "averageRating": 4.8
      }
    }
  ],
  "localInsights": {
    "totalBookingsToday": 89,
    "mostActiveArea": "Downtown",
    "trendingServices": ["haircuts", "nails", "makeup"],
    "peakBookingTime": "2:00 PM"
  }
}
```

#### Track Booking Activity
```http
POST /api/social-proof/track-booking
```

**Request Body:**
```json
{
  "serviceId": "service_123",
  "vendorId": "vendor_456",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "area": "Downtown",
  "timestamp": "2024-01-20T10:30:00Z"
}
```

### Database Schema

```sql
-- Social proof tracking
CREATE TABLE social_proof_bookings (
  id SERIAL PRIMARY KEY,
  service_id INTEGER REFERENCES services(id),
  vendor_id INTEGER REFERENCES vendors(id),
  user_id INTEGER REFERENCES users(id),
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  area VARCHAR(100),
  booking_time TIMESTAMP DEFAULT NOW(),
  anonymized BOOLEAN DEFAULT TRUE
);

-- Local activity cache
CREATE TABLE local_activity_cache (
  id SERIAL PRIMARY KEY,
  area VARCHAR(100),
  service_id INTEGER REFERENCES services(id),
  bookings_today INTEGER DEFAULT 0,
  bookings_this_week INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  last_updated TIMESTAMP DEFAULT NOW()
);
```

## 6. Community Reviews

### API Endpoints

#### Get Community Reviews
```http
GET /api/community/reviews
```

**Query Parameters:**
- `location` - User location (lat,lng)
- `neighborhood` - Specific neighborhood
- `limit` - Number of reviews (default: 10)
- `verified` - Verified reviews only (default: true)

**Response:**
```json
{
  "communityReviews": [
    {
      "id": "review_123",
      "serviceName": "Deep House Cleaning",
      "vendor": "Sparkle Clean Pro",
      "reviewer": "Sarah M.",
      "neighborhood": "Downtown",
      "rating": 5,
      "review": "Amazing service! My apartment looks brand new. Highly recommend!",
      "date": "2024-01-20T08:30:00Z",
      "verified": true,
      "helpful": 8,
      "reviewerProfile": {
        "totalReviews": 12,
        "memberSince": "2023-01-15",
        "verifiedCustomer": true,
        "profileImage": "https://..."
      },
      "serviceDetails": {
        "serviceId": "service_456",
        "category": "cleaning",
        "price": 120.00,
        "completedDate": "2024-01-19"
      }
    }
  ],
  "neighborhoodStats": {
    "totalReviews": 156,
    "averageRating": 4.7,
    "mostReviewedService": "House Cleaning",
    "topVendors": ["Sparkle Clean Pro", "Quick Fix Plumbing"]
  }
}
```

#### Submit Community Review
```http
POST /api/community/reviews
```

**Request Body:**
```json
{
  "serviceId": "service_123",
  "vendorId": "vendor_456",
  "rating": 5,
  "review": "Great service, highly recommend!",
  "neighborhood": "Downtown",
  "anonymous": false,
  "allowContact": true
}
```

#### Mark Review as Helpful
```http
POST /api/community/reviews/{reviewId}/helpful
```

**Request Body:**
```json
{
  "helpful": true,
  "reason": "accurate_description"
}
```

### Database Schema

```sql
-- Community reviews
CREATE TABLE community_reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  service_id INTEGER REFERENCES services(id),
  vendor_id INTEGER REFERENCES vendors(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  neighborhood VARCHAR(100),
  verified BOOLEAN DEFAULT FALSE,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Review helpfulness tracking
CREATE TABLE review_helpful_votes (
  id SERIAL PRIMARY KEY,
  review_id INTEGER REFERENCES community_reviews(id),
  user_id INTEGER REFERENCES users(id),
  helpful BOOLEAN,
  reason VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Neighborhood statistics
CREATE TABLE neighborhood_stats (
  id SERIAL PRIMARY KEY,
  neighborhood VARCHAR(100),
  total_reviews INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  most_reviewed_service VARCHAR(100),
  last_updated TIMESTAMP DEFAULT NOW()
);
```

#### Update Category Preferences
```http
POST /api/user/category-preferences
```

**Request Body:**
```json
{
  "preferredCategories": ["cleaning", "plumbing", "landscaping"],
  "avoidedCategories": ["pet_services"],
  "homeType": "single_family",
  "familySize": 4,
  "pets": ["dog"]
}
```

### Database Schema

```sql
-- Smart category mappings
CREATE TABLE smart_categories (
  id SERIAL PRIMARY KEY,
  category_name VARCHAR(100),
  icon VARCHAR(10),
  description TEXT,
  triggers JSONB, -- conditions that trigger this category
  priority INTEGER
);

-- User category preferences
CREATE TABLE user_category_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  category VARCHAR(50),
  preference_score DECIMAL(3,2), -- 0-1 score
  interaction_count INTEGER DEFAULT 0,
  last_interaction TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 7. Personalization Engine Logic

### Recommendation Algorithm

```typescript
// Pseudo-code for recommendation engine
interface RecommendationEngine {
  // Calculate personalized recommendations
  calculateRecommendations(userId: string): Promise<Recommendation[]> {
    const userProfile = await getUserProfile(userId);
    const userBehavior = await getUserBehavior(userId);
    const availableServices = await getAvailableServices(userLocation);
    
    return availableServices.map(service => ({
      service,
      confidence: calculateConfidence(service, userProfile, userBehavior),
      reason: generateReason(service, userProfile, userBehavior),
      relevanceFactors: identifyRelevanceFactors(service, userProfile)
    })).sort((a, b) => b.confidence - a.confidence);
  }
  
  // Calculate confidence score (0-1)
  calculateConfidence(service, userProfile, userBehavior): number {
    let score = 0;
    
    // Category preference (30%)
    if (userProfile.preferredCategories.includes(service.category)) {
      score += 0.3;
    }
    
    // Price range match (25%)
    if (service.price >= userProfile.priceRange.min && 
        service.price <= userProfile.priceRange.max) {
      score += 0.25;
    }
    
    // Location proximity (20%)
    const distance = calculateDistance(userProfile.location, service.location);
    if (distance <= 5) score += 0.2;
    else if (distance <= 10) score += 0.1;
    
    // Rating match (15%)
    if (service.rating >= 4.5) score += 0.15;
    else if (service.rating >= 4.0) score += 0.1;
    
    // Previous interactions (10%)
    const previousInteractions = userBehavior.filter(b => 
      b.serviceId === service.id || b.vendorId === service.vendorId
    );
    if (previousInteractions.length > 0) score += 0.1;
    
    return Math.min(score, 1);
  }
}
```

### Seasonal Logic

```typescript
// Seasonal recommendation logic
interface SeasonalEngine {
  getSeasonalSuggestions(location: Location, weather: Weather): Promise<SeasonalSuggestion[]> {
    const currentSeason = this.determineSeason(new Date());
    const seasonalServices = await this.getSeasonalServices(currentSeason);
    
    return seasonalServices.map(service => ({
      ...service,
      urgency: this.calculateUrgency(service, weather, currentSeason),
      reason: this.generateSeasonalReason(service, weather, currentSeason)
    }));
  }
  
  determineSeason(date: Date): string {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }
  
  calculateUrgency(service: Service, weather: Weather, season: string): string {
    // High urgency conditions
    if (season === 'summer' && weather.temperature > 85 && service.category === 'ac_maintenance') {
      return 'high';
    }
    if (season === 'fall' && weather.condition === 'rainy' && service.category === 'gutter_cleaning') {
      return 'high';
    }
    
    // Medium urgency conditions
    if (this.isSeasonalService(service, season)) {
      return 'medium';
    }
    
    return 'low';
  }
}
```

## 8. Caching Strategy

### Redis Cache Structure

```typescript
// Cache keys and TTL
const CACHE_KEYS = {
  USER_RECOMMENDATIONS: 'user:recommendations:{userId}',
  SEASONAL_SUGGESTIONS: 'seasonal:suggestions:{location}',
  RECENTLY_VIEWED: 'user:recently-viewed:{userId}',
  SMART_CATEGORIES: 'user:smart-categories:{userId}',
  WEATHER_DATA: 'weather:{location}'
};

const CACHE_TTL = {
  USER_RECOMMENDATIONS: 3600, // 1 hour
  SEASONAL_SUGGESTIONS: 1800, // 30 minutes
  RECENTLY_VIEWED: 7200, // 2 hours
  SMART_CATEGORIES: 3600, // 1 hour
  WEATHER_DATA: 900 // 15 minutes
};
```

## 9. Performance Optimization

### Database Indexes

```sql
-- Performance indexes for personalization queries
CREATE INDEX idx_user_behavior_user_id ON user_behavior(user_id);
CREATE INDEX idx_user_behavior_timestamp ON user_behavior(timestamp);
CREATE INDEX idx_user_behavior_category ON user_behavior(category);
CREATE INDEX idx_recently_viewed_user_id ON recently_viewed(user_id);
CREATE INDEX idx_recently_viewed_last_viewed ON recently_viewed(last_viewed);
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_recommendation_cache_user_id ON recommendation_cache(user_id);
CREATE INDEX idx_recommendation_cache_expires ON recommendation_cache(expires_at);
```

### Query Optimization

```sql
-- Optimized query for recently viewed services
SELECT 
  s.id, s.name, s.price, s.rating,
  v.name as vendor_name,
  rv.last_viewed, rv.view_count
FROM recently_viewed rv
JOIN services s ON rv.service_id = s.id
JOIN vendors v ON rv.vendor_id = v.id
WHERE rv.user_id = $1
  AND rv.last_viewed > NOW() - INTERVAL '30 days'
ORDER BY rv.last_viewed DESC
LIMIT 10;
```

## 10. Analytics & Monitoring

### Key Metrics to Track

```typescript
// Personalization metrics
interface PersonalizationMetrics {
  // Recommendation performance
  recommendationClickRate: number;
  recommendationConversionRate: number;
  averageConfidenceScore: number;
  
  // Seasonal suggestions
  seasonalSuggestionEngagement: number;
  weatherTriggerAccuracy: number;
  
  // User engagement
  recentlyViewedReengagement: number;
  smartCategoryClickRate: number;
  
  // System performance
  recommendationGenerationTime: number;
  cacheHitRate: number;
  apiResponseTime: number;
}
```

### Monitoring Alerts

```typescript
// Alert conditions
const ALERTS = {
  LOW_RECOMMENDATION_ACCURACY: 'confidence_score < 0.6',
  HIGH_API_LATENCY: 'response_time > 2000ms',
  LOW_CACHE_HIT_RATE: 'cache_hit_rate < 0.8',
  SEASONAL_SUGGESTION_FAILURE: 'seasonal_api_error_rate > 0.1'
};
```

## 11. Implementation Timeline

### Phase 1: Basic Personalization (Week 1-2)
- [ ] User preferences storage
- [ ] Basic recommendation algorithm
- [ ] Recently viewed tracking
- [ ] Simple caching

### Phase 2: Enhanced Features (Week 3-4)
- [ ] Seasonal suggestions
- [ ] Smart categories
- [ ] Advanced recommendation logic
- [ ] Performance optimization

### Phase 3: Advanced Analytics (Week 5-6)
- [ ] A/B testing framework
- [ ] Advanced metrics
- [ ] Machine learning integration
- [ ] Real-time personalization

## 12. Testing Strategy

### Unit Tests

```typescript
// Test recommendation engine
describe('RecommendationEngine', () => {
  test('should calculate confidence scores correctly', () => {
    const engine = new RecommendationEngine();
    const service = mockService();
    const userProfile = mockUserProfile();
    const userBehavior = mockUserBehavior();
    
    const confidence = engine.calculateConfidence(service, userProfile, userBehavior);
    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });
});
```

### Integration Tests

```typescript
// Test API endpoints
describe('Personalization API', () => {
  test('should return personalized recommendations', async () => {
    const response = await request(app)
      .get('/api/user/recommendations')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.recommendations).toHaveLength(10);
    expect(response.body.recommendations[0]).toHaveProperty('confidence');
  });
});
```

## 13. Advanced User Features

### Price Comparison

#### API Endpoints

#### Get Price Comparison
```http
GET /api/price-comparison/{serviceId}
```

**Query Parameters:**
- `location` - User location (lat,lng)
- `radius` - Search radius in miles (default: 25)
- `sort` - Sort by: price, rating, distance, popularity

**Response:**
```json
{
  "serviceName": "Deep House Cleaning",
  "vendors": [
    {
      "id": "vendor_123",
      "name": "Sparkle Clean Pro",
      "price": 120.00,
      "rating": 4.9,
      "distance": 0.4,
      "features": ["Eco-friendly", "Same day", "Insurance"],
      "availability": "Same day",
      "warranty": "30 days",
      "popularity": 95
    }
  ],
  "priceRange": {
    "min": 95.00,
    "max": 150.00,
    "average": 121.67
  },
  "recommendations": {
    "bestValue": "vendor_456",
    "highestRated": "vendor_123",
    "closest": "vendor_789"
  }
}
```

### Smart Notifications

#### API Endpoints

#### Get User Notifications
```http
GET /api/user/notifications
```

**Query Parameters:**
- `type` - Filter by notification type
- `priority` - Filter by priority level
- `unread` - Show only unread notifications

**Response:**
```json
{
  "notifications": [
    {
      "id": "notif_123",
      "type": "service_reminder",
      "title": "Quarterly Cleaning Due",
      "message": "Time to schedule your quarterly deep cleaning",
      "service": "Deep House Cleaning",
      "dueDate": "2024-02-15",
      "priority": "medium",
      "icon": "🧹",
      "actionUrl": "/book/cleaning",
      "createdAt": "2024-01-20T10:30:00Z",
      "read": false
    }
  ],
  "unreadCount": 3,
  "settings": {
    "emailNotifications": true,
    "pushNotifications": true,
    "smsNotifications": false
  }
}
```

#### Create Notification
```http
POST /api/user/notifications
```

**Request Body:**
```json
{
  "type": "price_drop",
  "title": "Price Drop Alert!",
  "message": "Your favorite service is now 20% off",
  "serviceId": "service_123",
  "vendorId": "vendor_456",
  "priority": "high",
  "scheduledFor": "2024-01-21T09:00:00Z"
}
```

### Calendar Integration

#### API Endpoints

#### Sync with Calendar
```http
POST /api/calendar/sync
```

**Request Body:**
```json
{
  "provider": "google", // google, outlook, apple
  "accessToken": "token_123",
  "calendarId": "primary",
  "syncDirection": "bidirectional", // import, export, bidirectional
  "settings": {
    "autoSync": true,
    "syncPastBookings": false,
    "includeReminders": true
  }
}
```

#### Get Calendar Events
```http
GET /api/calendar/events
```

**Query Parameters:**
- `startDate` - Start date for events
- `endDate` - End date for events
- `includeBookings` - Include service bookings

**Response:**
```json
{
  "events": [
    {
      "id": "event_123",
      "title": "Deep House Cleaning",
      "start": "2024-01-25T10:00:00Z",
      "end": "2024-01-25T12:00:00Z",
      "type": "booking",
      "serviceId": "service_123",
      "vendorId": "vendor_456",
      "location": "123 Main St",
      "description": "Quarterly deep cleaning service"
    }
  ]
}
```

### Analytics Dashboard

#### API Endpoints

#### Get Spending Analytics
```http
GET /api/user/analytics/spending
```

**Query Parameters:**
- `period` - Time period (month, quarter, year)
- `category` - Filter by service category
- `vendor` - Filter by specific vendor

**Response:**
```json
{
  "spending": {
    "totalSpent": 1445.00,
    "averagePerMonth": 240.83,
    "savings": 156.00,
    "monthlyBreakdown": {
      "january": 250.00,
      "february": 180.00,
      "march": 320.00
    },
    "categoryBreakdown": [
      {
        "category": "Cleaning",
        "spent": 480.00,
        "percentage": 33,
        "bookings": 4
      }
    ]
  },
  "trends": {
    "spendingTrend": "increasing",
    "savingsTrend": "stable",
    "favoriteCategory": "Cleaning"
  }
}
```

#### Get Vendor Performance
```http
GET /api/user/analytics/vendor-performance
```

**Response:**
```json
{
  "vendors": [
    {
      "id": "vendor_123",
      "name": "Sparkle Clean Pro",
      "totalBookings": 8,
      "averageRating": 4.9,
      "totalSpent": 960.00,
      "lastUsed": "2024-01-15",
      "reliability": 98,
      "responseTime": "2.3 hours",
      "completionRate": 100,
      "trends": {
        "ratingTrend": "improving",
        "bookingTrend": "stable"
      }
    }
  ],
  "insights": {
    "mostReliableVendor": "vendor_123",
    "bestValueVendor": "vendor_456",
    "fastestResponse": "vendor_789"
  }
}
```

#### Get Service History
```http
GET /api/user/analytics/service-history
```

**Query Parameters:**
- `limit` - Number of services to return
- `status` - Filter by service status
- `category` - Filter by service category

**Response:**
```json
{
  "services": [
    {
      "id": "service_123",
      "serviceName": "Deep House Cleaning",
      "vendor": "Sparkle Clean Pro",
      "date": "2024-01-15",
      "price": 120.00,
      "rating": 5,
      "status": "completed",
      "category": "cleaning",
      "duration": "2 hours",
      "notes": "Excellent service, very thorough"
    }
  ],
  "summary": {
    "totalServices": 16,
    "averageRating": 4.7,
    "totalSpent": 1445.00,
    "mostUsedService": "Deep House Cleaning"
  }
}
```

### Database Schema

```sql
-- Price comparison tracking
CREATE TABLE price_comparisons (
  id SERIAL PRIMARY KEY,
  service_id INTEGER REFERENCES services(id),
  vendor_id INTEGER REFERENCES vendors(id),
  price DECIMAL(10,2),
  features JSONB,
  availability VARCHAR(50),
  warranty VARCHAR(100),
  popularity INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Smart notifications
CREATE TABLE user_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type VARCHAR(50),
  title VARCHAR(200),
  message TEXT,
  priority VARCHAR(20),
  icon VARCHAR(10),
  action_url VARCHAR(500),
  scheduled_for TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  dismissed_at TIMESTAMP
);

-- Calendar integration
CREATE TABLE calendar_sync (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  provider VARCHAR(20),
  access_token TEXT,
  refresh_token TEXT,
  calendar_id VARCHAR(100),
  sync_direction VARCHAR(20),
  settings JSONB,
  last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics data
CREATE TABLE user_analytics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  service_id INTEGER REFERENCES services(id),
  vendor_id INTEGER REFERENCES vendors(id),
  amount DECIMAL(10,2),
  category VARCHAR(50),
  booking_date DATE,
  completion_date DATE,
  rating INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vendor performance tracking
CREATE TABLE vendor_performance (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  vendor_id INTEGER REFERENCES vendors(id),
  total_bookings INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  total_spent DECIMAL(10,2),
  last_used DATE,
  reliability INTEGER,
  response_time INTEGER, -- in minutes
  completion_rate INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Implementation Logic

```typescript
// Price comparison engine
interface PriceComparisonEngine {
  comparePrices(serviceId: string, location: Location): Promise<PriceComparison> {
    const vendors = await getVendorsForService(serviceId, location);
    const priceRange = calculatePriceRange(vendors);
    const recommendations = generateRecommendations(vendors, priceRange);
    
    return {
      serviceName: service.name,
      vendors: vendors.map(vendor => ({
        ...vendor,
        features: extractFeatures(vendor),
        popularity: calculatePopularity(vendor)
      })),
      priceRange,
      recommendations
    };
  }
}

// Smart notification system
interface NotificationSystem {
  createNotification(userId: string, notification: NotificationData): Promise<void> {
    const notification = await saveNotification(userId, notification);
    
    // Send to different channels based on user preferences
    if (user.preferences.emailNotifications) {
      await sendEmailNotification(user.email, notification);
    }
    
    if (user.preferences.pushNotifications) {
      await sendPushNotification(user.deviceToken, notification);
    }
    
    if (user.preferences.smsNotifications) {
      await sendSMSNotification(user.phone, notification);
    }
  }
  
  generateServiceReminders(userId: string): Promise<Notification[]> {
    const userServices = await getUserServices(userId);
    const reminders = [];
    
    for (const service of userServices) {
      const nextDueDate = calculateNextDueDate(service);
      if (isDueSoon(nextDueDate)) {
        reminders.push({
          type: 'service_reminder',
          title: `${service.name} Due`,
          message: `Time to schedule your ${service.frequency} ${service.name}`,
          dueDate: nextDueDate,
          priority: 'medium'
        });
      }
    }
    
    return reminders;
  }
}

// Analytics engine
interface AnalyticsEngine {
  calculateSpendingAnalytics(userId: string, period: string): Promise<SpendingAnalytics> {
    const transactions = await getUserTransactions(userId, period);
    const totalSpent = sum(transactions.map(t => t.amount));
    const savings = calculateSavings(transactions);
    const categoryBreakdown = groupByCategory(transactions);
    
    return {
      totalSpent,
      averagePerMonth: totalSpent / getMonthCount(period),
      savings,
      categoryBreakdown,
      trends: analyzeTrends(transactions)
    };
  }
  
  trackVendorPerformance(userId: string, vendorId: string): Promise<VendorPerformance> {
    const bookings = await getUserBookingsWithVendor(userId, vendorId);
    const ratings = bookings.map(b => b.rating);
    const totalSpent = sum(bookings.map(b => b.amount));
    
    return {
      totalBookings: bookings.length,
      averageRating: average(ratings),
      totalSpent,
      lastUsed: max(bookings.map(b => b.date)),
      reliability: calculateReliability(bookings),
      responseTime: average(bookings.map(b => b.responseTime)),
      completionRate: calculateCompletionRate(bookings)
    };
  }
}
```

This comprehensive backend integration guide provides all the necessary endpoints, database schemas, and logic for implementing the personalized features in your frontend. 