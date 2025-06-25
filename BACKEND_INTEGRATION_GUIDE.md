# Backend Integration Guide for Dashboard

## Overview
This guide explains what the backend developer needs to implement to connect the dashboard with real data, including charts and visualizations.

## API Endpoints Required

### 1. Dashboard Statistics Endpoint

**Endpoint:** `GET /api/dashboard/stats`

**Expected Response:**
```typescript
{
  totalUsers: number;      // Count of active customers
  totalVendors: number;    // Count of active service providers
  totalReviews: number;    // Count of all reviews
  growthRate: number;      // Percentage growth (can be 0)
  lastUpdated: string;     // ISO timestamp
}
```

### 2. User Growth Chart Data

**Endpoint:** `GET /api/dashboard/user-growth`

**Expected Response:**
```typescript
{
  labels: string[];        // Month labels: ['Jan', 'Feb', 'Mar', ...]
  datasets: [
    {
      label: string;       // 'New Users' or 'Active Users'
      data: number[];      // Monthly counts: [120, 145, 180, ...]
      borderColor: string; // CSS color: '#3B82F6'
      backgroundColor: string; // CSS color with opacity: 'rgba(59, 130, 246, 0.1)'
    }
  ]
}
```

### 3. Revenue Trend Chart Data

**Endpoint:** `GET /api/dashboard/revenue-trend`

**Expected Response:**
```typescript
{
  labels: string[];        // Month labels: ['Jan', 'Feb', 'Mar', ...]
  datasets: [
    {
      label: string;       // 'Subscription Revenue' or 'Ad Revenue'
      data: number[];      // Monthly amounts: [8500, 9200, 10800, ...]
      borderColor: string; // CSS color: '#8B5CF6'
      backgroundColor: string; // CSS color with opacity: 'rgba(139, 92, 246, 0.1)'
    }
  ]
}
```

## Database Queries Needed

### Dashboard Stats
```sql
-- Total Users (customers)
SELECT COUNT(*) as totalUsers 
FROM users 
WHERE userType = 'customer' AND status = 'active';

-- Total Vendors (service providers)
SELECT COUNT(*) as totalVendors 
FROM users 
WHERE userType = 'service_provider' AND status = 'active';

-- Total Reviews
SELECT COUNT(*) as totalReviews 
FROM reviews;
```

### User Growth Data
```sql
-- New users by month (current year)
SELECT 
  MONTH(createdAt) as month,
  COUNT(*) as newUsers
FROM users 
WHERE YEAR(createdAt) = YEAR(CURRENT_DATE())
GROUP BY MONTH(createdAt)
ORDER BY month;

-- Active users by month (users who logged in)
SELECT 
  MONTH(lastLoginAt) as month,
  COUNT(*) as activeUsers
FROM users 
WHERE YEAR(lastLoginAt) = YEAR(CURRENT_DATE()) 
  AND status = 'active'
GROUP BY MONTH(lastLoginAt)
ORDER BY month;
```

### Revenue Data
```sql
-- Subscription revenue by month
SELECT 
  MONTH(createdAt) as month,
  SUM(amount) as subscriptionRevenue
FROM payments 
WHERE type = 'subscription' 
  AND status = 'completed'
  AND YEAR(createdAt) = YEAR(CURRENT_DATE())
GROUP BY MONTH(createdAt)
ORDER BY month;

-- Ad revenue by month
SELECT 
  MONTH(createdAt) as month,
  SUM(amount) as adRevenue
FROM payments 
WHERE type = 'advertisement' 
  AND status = 'completed'
  AND YEAR(createdAt) = YEAR(CURRENT_DATE())
GROUP BY MONTH(createdAt)
ORDER BY month;
```

## User Registration Flow

### When a user registers and selects profile type:

1. **Set the correct `userType`:**
   - `"customer"` for regular users
   - `"service_provider"` for vendors
   - `"admin"` for administrators

2. **Set initial status:**
   - `status: "active"` (or "pending" if verification required)

3. **Example user record:**
```typescript
{
  id: string;
  name: string;
  email: string;
  userType: "customer" | "service_provider" | "admin";
  status: "active" | "inactive" | "suspended" | "pending";
  createdAt: Date;
  lastLoginAt?: Date;
  // ... other user fields
}
```

## Data Models

### User Model
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  userType: "customer" | "service_provider" | "admin";
  status: "active" | "inactive" | "suspended" | "pending";
  createdAt: Date;
  lastLoginAt?: Date;
  updatedAt: Date;
  // ... other fields
}
```

### Payment Model (for revenue tracking)
```typescript
interface Payment {
  id: string;
  userId: string;
  amount: number;
  type: "subscription" | "advertisement" | "other";
  status: "pending" | "completed" | "failed" | "refunded";
  createdAt: Date;
  // ... other fields
}
```

### Review Model (if separate from users)
```typescript
interface Review {
  id: string;
  userId: string;
  vendorId: string;
  rating: number;
  content: string;
  createdAt: Date;
  // ... other fields
}
```

## Implementation Steps

### 1. Database Schema
Ensure your database has:
- `users` table with `userType`, `status`, `createdAt`, `lastLoginAt` fields
- `payments` table with `type`, `amount`, `status`, `createdAt` fields
- `reviews` table (if separate from users)
- Proper indexes on date fields and status fields for performance

### 2. API Implementation
Replace the mock implementations in:
- `/src/app/api/dashboard/stats/route.ts`
- `/src/app/api/dashboard/user-growth/route.ts`
- `/src/app/api/dashboard/revenue-trend/route.ts`

### 3. User Registration
When users register, ensure you set:
```typescript
// Based on their profile selection
const userType = profileSelection === 'vendor' ? 'service_provider' : 'customer';

await db.users.create({
  data: {
    name,
    email,
    userType,
    status: 'active', // or 'pending' if verification needed
    createdAt: new Date(),
    // ... other fields
  }
});
```

### 4. Chart Data Aggregation
Implement monthly data aggregation:
```typescript
// Example: Aggregate user registrations by month
const monthlyData = await db.users.groupBy({
  by: ['createdAt'],
  _count: {
    id: true
  },
  where: {
    createdAt: {
      gte: new Date(new Date().getFullYear(), 0, 1) // Start of current year
    }
  }
});

// Convert to chart format
const chartData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  datasets: [{
    label: 'New Users',
    data: monthlyData.map(item => item._count.id),
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  }]
};
```

## Error Handling

The frontend expects:
- **200 OK** with data for successful requests
- **500 Internal Server Error** with error message for failures
- Proper CORS headers if needed

## Performance Considerations

1. **Caching:** Consider caching dashboard stats for 5 minutes
2. **Indexing:** Index date fields, `userType`, and `status` fields
3. **Aggregation:** Use database aggregation functions for better performance
4. **Real-time updates:** Consider WebSockets for live updates

## Testing

Test your implementation with:
```bash
# Dashboard stats
curl http://localhost:3000/api/dashboard/stats

# User growth data
curl http://localhost:3000/api/dashboard/user-growth

# Revenue trend data
curl http://localhost:3000/api/dashboard/revenue-trend
```

Expected responses:
```json
// /api/dashboard/stats
{
  "totalUsers": 1250,
  "totalVendors": 89,
  "totalReviews": 5670,
  "growthRate": 12,
  "lastUpdated": "2024-01-15T10:30:00.000Z"
}

// /api/dashboard/user-growth
{
  "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  "datasets": [
    {
      "label": "New Users",
      "data": [120, 145, 180, 220, 280, 320, 380, 420, 480, 520, 580, 650],
      "borderColor": "#3B82F6",
      "backgroundColor": "rgba(59, 130, 246, 0.1)"
    }
  ]
}
```

## Frontend Features Ready

The frontend now includes:
- ✅ Loading states for all components
- ✅ Error handling with fallback data
- ✅ Auto-refresh every 5 minutes
- ✅ Manual refresh button
- ✅ Interactive charts with mock data
- ✅ Chart legends and tooltips
- ✅ Summary statistics for each chart
- ✅ Last updated timestamp
- ✅ Proper TypeScript types
- ✅ Backend developer notes on dashboard

## Visual Chart Requirements

The dashboard now displays:
1. **User Growth Chart** - Shows new users and active users over time
2. **Revenue Trend Chart** - Shows subscription and ad revenue over time
3. **Interactive Elements** - Hover tooltips, legends, and summary stats
4. **Responsive Design** - Works on all screen sizes

## Questions?

If you need clarification on any part of this integration, please refer to:
- The API route templates in `/src/app/api/dashboard/`
- The dashboard component in `/src/app/page.tsx`
- The user management component for user type examples
- The mock data examples showing expected data patterns 