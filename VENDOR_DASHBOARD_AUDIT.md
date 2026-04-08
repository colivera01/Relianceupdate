# Vendor Dashboard System - Full Audit

## 📋 Table of Contents
1. [Data Flow Overview](#data-flow-overview)
2. [API Route](#api-route)
3. [Prisma Schema & Database](#prisma-schema--database)
4. [Type Definitions](#type-definitions)
5. [Data Hook](#data-hook)
6. [Dashboard Page Component](#dashboard-page-component)
7. [UI Components](#ui-components)
8. [Authentication](#authentication)
9. [Layout & Structure](#layout--structure)
10. [Consistency Issues & Recommendations](#consistency-issues--recommendations)

---

## Data Flow Overview

```
Azure SQL Database
    ↓
Prisma Client (src/server/db.ts)
    ↓
API Route (src/app/api/vendor/dashboard/route.ts)
    ↓
Type: VendorDashboardResponse (src/types/vendor.ts)
    ↓
Hook: useVendorDashboard (src/hooks/useVendorDashboard.ts)
    ↓
Page Component: VendorDashboard (src/app/vendor/dashboard/page.tsx)
    ↓
UI Components (Card, Button, etc.)
```

---

## API Route

**File:** `src/app/api/vendor/dashboard/route.ts`

```typescript
// src/app/api/vendor/dashboard/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getVendorIdFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    // 1) Get vendor ID (currently hard-coded in auth.ts)
    const vendorId = await getVendorIdFromRequest(request);
    console.log("[vendor/dashboard] vendorId from auth:", vendorId);

    if (!vendorId) {
      return NextResponse.json(
        { error: "Unauthorized: no vendor ID" },
        { status: 401 }
      );
    }

    // 2) Fetch just the vendor profile – no joins, no aggregates
    console.log("[vendor/dashboard] Fetching vendor from DB...");
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    console.log("[vendor/dashboard] Vendor found:", vendor ? "YES" : "NO");

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // 3) Return a super-simple VendorDashboardResponse
    console.log("[vendor/dashboard] Building response...");
    const response = {
      profile: {
        id: vendor.id,
        firstName: vendor.firstName ?? "",
        lastName: vendor.lastName ?? "",
        name: vendor.name ?? "",
        businessName: vendor.businessName ?? "",
        businessType: vendor.businessType ?? "",
        category: vendor.category ?? "",
        foundedYear: vendor.foundedYear ?? "",
        email: vendor.email ?? "",
        phone: vendor.phone ?? "",
        city: vendor.city ?? "",
        state: vendor.state ?? "",
        serviceTypes: vendor.serviceTypes ?? "",
        specializations: vendor.specializations ?? "",
        serviceAreas: vendor.serviceAreas ?? "",
      },
      stats: {
        totalBookings: 0,
        totalEarnings: 0,
        totalClients: 0,
        rating: 0,
      },
      recentJobs: [],
      recentReviews: [],
      insights: [],
      notifications: [],
    };

    console.log("[vendor/dashboard] Response built successfully");
    return NextResponse.json(response);
  } catch (err) {
    console.error("Vendor dashboard error:", err);
    console.error("Error details:", err instanceof Error ? err.message : String(err));
    console.error("Error stack:", err instanceof Error ? err.stack : "No stack trace");
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
```

**Key Points:**
- ✅ Uses Prisma to fetch vendor
- ✅ Returns `VendorDashboardResponse` shape
- ⚠️ Stats are hardcoded to 0 (not calculated from DB)
- ⚠️ Arrays are empty (not populated from DB)
- ✅ Proper error handling

---

## Prisma Schema & Database

**File:** `prisma/schema.prisma`

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

// SQL Server doesn't support Prisma enums, using String instead
// EmployeeRole: "MANAGER" | "TECHNICIAN"
// BookingStatus: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED"

model Vendor {
  id              String   @id @default(cuid())
  firstName       String?
  lastName        String?
  name            String   // Keep for backward compatibility
  businessName    String?
  businessType    String?
  category        String?
  foundedYear     Int?
  email           String?  @unique
  phone           String?
  city            String?
  state           String?
  serviceTypes    String?  // Can be comma-separated for now
  specializations String?  // Can be comma-separated for now
  serviceAreas    String?  // Can be comma-separated for now
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  demo            Boolean  @default(false)
  seedBatchId     String?
  
  // Relations
  employees       Employee[]
  services        Service[]
  bookings        Booking[]
  reviews         Review[]

  @@map("vendors")
}

model Employee {
  id          String      @id @default(cuid())
  vendorId    String
  name        String
  email       String
  role        String  // "MANAGER" | "TECHNICIAN"
  photoUrl    String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  demo        Boolean     @default(false)
  seedBatchId String?
  
  // Relations
  vendor      Vendor      @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@map("employees")
}

model Service {
  id          String   @id @default(cuid())
  vendorId    String
  name        String
  description String?
  price       Float
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  demo        Boolean  @default(false)
  seedBatchId String?
  
  // Relations
  vendor      Vendor    @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  bookings    Booking[]

  @@map("services")
}

model User {
  id          String   @id @default(cuid())
  name        String
  email       String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  demo        Boolean  @default(false)
  seedBatchId String?
  
  // Relations
  bookings    Booking[]
  reviews     Review[]

  @@map("users")
}

model Booking {
  id           String        @id @default(cuid())
  userId       String
  serviceId    String
  vendorId     String
  title        String?       // Job/service title
  clientName   String?       // Client name (or use user relation)
  amount       Float?        // Booking amount
  status       String @default("PENDING")  // "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED"
  scheduledFor DateTime?
  date         DateTime?    // Job completion or scheduled date
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  demo         Boolean       @default(false)
  seedBatchId  String?
  
  // Relations
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  service      Service       @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  vendor       Vendor        @relation(fields: [vendorId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@map("bookings")
}

model Review {
  id          String   @id @default(cuid())
  userId      String
  vendorId    String
  clientName  String?  // Client name (or use user relation)
  jobType     String?  // Type of job/service reviewed
  rating      Int
  comment     String?
  date        DateTime? // Review date (defaults to createdAt if not set)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  demo        Boolean  @default(false)
  seedBatchId String?
  
  // Relations
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  vendor      Vendor   @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@map("reviews")
}
```

**Database Client:** `src/server/db.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Construct connection string programmatically to avoid parsing issues
function getDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL;
  
  if (dbUrl) {
    // Log the actual connection string (first 80 chars for security)
    console.log('[db.ts] DATABASE_URL from env, length:', dbUrl.length);
    console.log('[db.ts] DATABASE_URL preview:', dbUrl.substring(0, 80) + '...');
    
    // Check if it contains the problematic encoding
    if (dbUrl.includes('%2320') || dbUrl.includes('%23')) {
      console.warn('[db.ts] WARNING: Connection string contains %23 (#) encoding - this may cause issues');
    }
    
    return dbUrl;
  }
  
  // Fallback: construct from individual env vars if needed
  // This is just for testing - you should use DATABASE_URL
  throw new Error('DATABASE_URL environment variable is not set');
}

let prisma: PrismaClient;

try {
  const connectionString = getDatabaseUrl();
  
  // Try creating PrismaClient with explicit connection string
  prisma = globalForPrisma.prisma ?? new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
  }
} catch (error: any) {
  console.error('[db.ts] ERROR creating PrismaClient:', error.message);
  console.error('[db.ts] Error name:', error.name);
  if (error.stack) {
    console.error('[db.ts] Error stack:', error.stack);
  }
  throw error;
}

export { prisma };
```

**Key Points:**
- ✅ Vendor model has all fields needed for dashboard
- ✅ Relations exist: `bookings`, `reviews`, `services`, `employees`
- ⚠️ `serviceTypes`, `specializations`, `serviceAreas` are `String?` (comma-separated) - API returns as string
- ✅ Booking and Review models have fields needed for dashboard display

---

## Type Definitions

**File:** `src/types/vendor.ts`

```typescript
// src/types/vendor.ts

export interface VendorDashboardProfile {
  firstName: string;
  lastName: string;
  businessName: string;
  businessType: string;
  category: string;
  foundedYear: number | string;
  email: string;
  phone: string;
  city: string;
  state: string;
  serviceTypes: string[] | string;
  specializations: string[] | string;
  serviceAreas: string[] | string;
  totalBookings?: number;
  totalEarnings?: number;
  totalClients?: number;
  rating?: number;
}

export interface VendorJob {
  id: number;
  title: string;
  client: string;
  amount: number;
  status: 'completed' | 'in progress' | 'scheduled';
  date: string; // ISO string
}

export interface VendorReview {
  id: number;
  client: string;
  rating: number;
  comment: string;
  date: string;
  jobType: string;
}

export interface VendorInsight {
  id: number;
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
}

export interface VendorNotification {
  id: number;
  type: 'job' | 'review' | 'payment' | 'reminder';
  title: string;
  message: string;
  time: string;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface VendorDashboardResponse {
  profile: VendorDashboardProfile;
  stats: {
    totalBookings: number;
    totalEarnings: number;
    totalClients: number;
    rating: number;
  };
  recentJobs: VendorJob[];
  recentReviews: VendorReview[];
  insights: VendorInsight[];
  notifications: VendorNotification[];
}
```

**Key Points:**
- ✅ Types match API response structure
- ⚠️ `VendorJob.id` is `number` but Prisma `Booking.id` is `String` (cuid)
- ⚠️ `VendorReview.id` is `number` but Prisma `Review.id` is `String` (cuid)
- ✅ `serviceTypes`, `specializations`, `serviceAreas` support both `string[]` and `string` (flexible)
- ✅ `foundedYear` supports both `number` and `string` (API returns empty string if null)

---

## Data Hook

**File:** `src/hooks/useVendorDashboard.ts`

```typescript
// src/hooks/useVendorDashboard.ts
"use client";
import { useEffect, useState } from "react";
import { VendorDashboardResponse } from "@/types/vendor";

export function useVendorDashboard() {
  const [data, setData] = useState<VendorDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/vendor/dashboard", {
          method: "GET",
          // X NO headers, no Authorization, nothing
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }

        const json = (await res.json()) as VendorDashboardResponse;

        if (!cancelled) {
          setData(json);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error, refetch: () => window.location.reload() };
}
```

**Key Points:**
- ✅ Proper cleanup with `cancelled` flag
- ✅ Type-safe with `VendorDashboardResponse`
- ✅ No auth headers (relies on server-side auth)
- ⚠️ `refetch` uses `window.location.reload()` (could use React Query for better UX)

---

## Dashboard Page Component

**File:** `src/app/vendor/dashboard/page.tsx`

```typescript
"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { CheckCircle, XCircle, Calendar, DollarSign, Users, Star, TrendingUp } from 'lucide-react';
import { useVendorDashboard } from '@/hooks/useVendorDashboard';

export default function VendorDashboard() {
  const { data, loading, error, refetch } = useVendorDashboard();
  const [showAvailability, setShowAvailability] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  // Show loading state
  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-sm text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2">
        <p className="text-red-500 font-medium">Failed to fetch vendor dashboard</p>
        <p className="text-xs text-gray-500">{error}</p>
        <button
          onClick={refetch}
          className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  // Should be rare now
  if (!data) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2">
        <p className="font-medium text-gray-700">No dashboard data</p>
        <p className="text-xs text-gray-500">We couldn&apos;t load your vendor information.</p>
      </div>
    );
  }

  const { profile, stats: dashboardStats, recentJobs, recentReviews, insights, notifications } = data;

  // Display vendor registration data at the top
  const renderVendorInfo = () => {
    if (!profile) return null;

    return (
      <div className="mb-8">
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Welcome, {profile.firstName} {profile.lastName}!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold text-gray-700">Business Information</h4>
                <p className="text-sm text-gray-600">Business: {profile.businessName}</p>
                <p className="text-sm text-gray-600">Type: {profile.businessType}</p>
                <p className="text-sm text-gray-600">Category: {profile.category}</p>
                <p className="text-sm text-gray-600">Founded: {profile.foundedYear}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700">Contact Information</h4>
                <p className="text-sm text-gray-600">Email: {profile.email}</p>
                <p className="text-sm text-gray-600">Phone: {profile.phone}</p>
                <p className="text-sm text-gray-600">Location: {profile.city}, {profile.state}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700">Services</h4>
                <p className="text-sm text-gray-600">
                  Service Types: {Array.isArray(profile.serviceTypes) ? profile.serviceTypes.join(', ') : profile.serviceTypes}
                </p>
                <p className="text-sm text-gray-600">
                  Specializations: {Array.isArray(profile.specializations) ? profile.specializations.join(', ') : profile.specializations}
                </p>
                <p className="text-sm text-gray-600">
                  Service Areas: {Array.isArray(profile.serviceAreas) ? profile.serviceAreas.join(', ') : profile.serviceAreas}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Color map for Tailwind classes - prevents class purging
  const colorMap = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
  } as const;

  // Stats from API response
  const stats = [
    { label: 'Total Bookings', value: dashboardStats.totalBookings, icon: Calendar, color: 'blue' as keyof typeof colorMap },
    { label: 'Total Earnings', value: `$${dashboardStats.totalEarnings}`, icon: DollarSign, color: 'green' as keyof typeof colorMap },
    { label: 'Total Clients', value: dashboardStats.totalClients, icon: Users, color: 'purple' as keyof typeof colorMap },
    { label: 'Average Rating', value: dashboardStats.rating.toFixed(1), icon: Star, color: 'yellow' as keyof typeof colorMap },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {renderVendorInfo()}
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const colors = colorMap[stat.color];
            return (
              <Card key={stat.label} className="bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-full ${colors.bg}`}>
                      <stat.icon className={`h-6 w-6 ${colors.text}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Jobs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Recent Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">You don't have any jobs yet.</p>
                  <p className="text-xs mt-1">Jobs will appear here once clients book your services.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900">{job.title}</h4>
                        <p className="text-sm text-gray-600">{job.client}</p>
                        <p className="text-xs text-gray-500">{job.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">${job.amount}</p>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          job.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          job.status === 'in progress' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Reviews */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-600" />
                Recent Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentReviews.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">You don't have any reviews yet.</p>
                  <p className="text-xs mt-1">Ask your clients to leave one after you complete a job.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentReviews.map((review) => (
                    <div key={review.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{review.client}</h4>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating ? 'text-yellow-500 fill-current' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{review.comment}</p>
                      <p className="text-xs text-gray-500">{review.date}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Insights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {insights.map((insight) => (
            <Card key={insight.id} className="bg-white">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">{insight.title}</p>
                  <p className="text-xl font-bold text-gray-900">{insight.value}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <TrendingUp className={`h-4 w-4 ${
                      insight.trend === 'up' ? 'text-green-500' : 'text-red-500'
                    }`} />
                    <span className={`text-sm ${
                      insight.trend === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {insight.change}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Notifications */}
        <Card className="bg-white mb-8">
          <CardHeader>
            <CardTitle>Recent Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No notifications at this time.</p>
                <p className="text-xs mt-1">You'll see updates about jobs, reviews, and payments here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div key={notification.id} className={`flex items-center gap-3 p-3 rounded-lg ${
                    notification.read ? 'bg-gray-50' : 'bg-blue-50'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      notification.priority === 'high' ? 'bg-red-500' : 
                      notification.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{notification.title}</h4>
                      <p className="text-sm text-gray-600">{notification.message}</p>
                      <p className="text-xs text-gray-500">{notification.time}</p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                onClick={() => setShowAvailability(!showAvailability)}
                className="w-full h-20 text-lg"
                variant="outline"
              >
                <Calendar className="h-6 w-6 mr-2" />
                Manage Availability
              </Button>
              <Button 
                onClick={() => setShowPricing(!showPricing)}
                className="w-full h-20 text-lg"
                variant="outline"
              >
                <DollarSign className="h-6 w-6 mr-2" />
                Update Pricing
              </Button>
              <Button 
                className="w-full h-20 text-lg"
                variant="outline"
              >
                <TrendingUp className="h-6 w-6 mr-2" />
                View Analytics
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**Key Points:**
- ✅ Uses `useVendorDashboard` hook
- ✅ Handles loading, error, and empty states
- ✅ Displays profile data correctly
- ✅ Handles empty arrays with friendly messages
- ✅ Uses `colorMap` to prevent Tailwind class purging
- ✅ Handles both string and array for `serviceTypes`, `specializations`, `serviceAreas`

---

## UI Components

### Card Component
**File:** `src/components/ui/card.tsx`

```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

### Button Component
**File:** `src/components/ui/button.tsx`

```typescript
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

---

## Authentication

**File:** `src/lib/auth.ts`

```typescript
import { cookies } from 'next/headers';
// import jwt from 'jsonwebtoken'; // Uncomment when ready to use real JWT

interface JWTPayload {
  userId?: string;
  vendorId?: string;
  email?: string;
  role?: string;
}

/**
 * Extract and verify JWT token from cookies or headers
 * For now, this is stubbed to return vendorId: 1
 * TODO: Replace with real JWT verification when auth is fully implemented
 */
export async function verifyJwt(token: string): Promise<JWTPayload> {
  // TODO: Replace this stub with real JWT verification
  // Example implementation:
  // const secret = process.env.JWT_SECRET;
  // if (!secret) throw new Error('JWT_SECRET not configured');
  // const decoded = jwt.verify(token, secret) as JWTPayload;
  // return decoded;

  // Stub: For now, accept temp token and return default vendorId
  if (token === 'temp-jwt-token' || !token) {
    return { vendorId: '1', userId: '1' };
  }

  // In production, verify the actual JWT token here
  throw new Error('Invalid token');
}

/**
 * Get vendor ID from request (checks cookies first, then Authorization header)
 * 
 * TEMPORARY: For local development, this returns a hardcoded vendorId.
 * Replace with real auth extraction when JWT is fully implemented.
 */
export async function getVendorIdFromRequest(_request: Request): Promise<string | null> {
  // TEMPORARY: Local development only
  // Use your seeded vendor ID from Prisma Studio / seed script
  return 'cmipm4d6v0000sosgqvb8tp63'; // Sparkle Cleaning Pro (Cesar)
}
```

**Key Points:**
- ⚠️ **TEMPORARY**: Hardcoded vendor ID for local development
- ⚠️ No real JWT verification yet
- ✅ Returns the correct vendor ID that exists in database

---

## Layout & Structure

**File:** `src/app/vendor/layout.tsx`

```typescript
'use client';
import { Users, HardDrive, Star, Briefcase, DollarSign, HelpCircle, LogOut, AlertTriangle, Home } from 'lucide-react';
import { Button } from '../../components/ui/button';
import Link from 'next/link';
import ProfileHeader from '../../components/ProfileHeader';

const sidebarLinks = [
  { label: 'Dashboard', icon: Home, href: '/vendor' },
  { label: 'Profile & Settings', icon: Users, href: '/vendor/profile' },
  { label: 'View Reviews', icon: Star, href: '/vendor/reviews' },
  { label: 'Manage Jobs', icon: Briefcase, href: '/vendor/jobs' },
  { label: 'Employees', icon: Users, href: '/vendor/employees' },
  { label: 'Billing & Earnings', icon: DollarSign, href: '/vendor/billing' },
  { label: 'Support & Help', icon: HelpCircle, href: '/vendor/support' },
  { label: 'Logout', icon: LogOut, href: '/logout' },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col min-h-screen">
        {/* Logo area - white background */}
        <div className="bg-white flex items-center px-6 py-8 border-b border-gray-200 justify-center">
          <img src="/reliance-logo.png" alt="Reliance Logo" className="w-32 h-32 rounded" />
        </div>
        {/* Blue navigation area */}
        <div className="flex-1 bg-blue-800 text-white flex flex-col py-8 px-4">
          {/* Vendor Profile Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <img
                src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&crop=center"
                alt="Business Profile"
                className="w-16 h-16 rounded-full border-2 border-white/20 shadow-md object-cover"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-lg mb-1">Sparkle Clean Pro</div>
              <div className="text-blue-100 text-sm">Professional Cleaning</div>
              <div className="mt-2">
                <span className="px-2 py-1 bg-white/20 text-white text-xs rounded-full">
                  Verified Vendor
                </span>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {sidebarLinks.map((link, idx) => (
              <div key={link.label} className="relative">
                {link.href ? (
                  <Link href={link.href}>
                    <Button 
                      variant="ghost" 
                      className={`w-full justify-start text-white hover:bg-blue-700 rounded-lg px-3 py-2 text-base font-medium ${
                        link.alert ? 'bg-red-600 hover:bg-red-700 animate-pulse' : ''
                      }`}
                    >
                      <link.icon className="w-5 h-5 mr-3" />
                      {link.label}
                      {link.badge && (
                        <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          {link.badge}
                        </span>
                      )}
                    </Button>
                  </Link>
                ) : (
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start text-white hover:bg-blue-700 rounded-lg px-3 py-2 text-base font-medium ${
                      link.alert ? 'bg-red-600 hover:bg-red-700 animate-pulse' : ''
                    }`}
                  >
                    <link.icon className="w-5 h-5 mr-3" />
                    {link.label}
                    {link.badge && (
                      <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        {link.badge}
                      </span>
                    )}
                  </Button>
                )}
                {/* Insert toggles directly after Logout button */}
                {link.label === 'Logout' && (
                  <div className="flex flex-col gap-2 mt-4">
                    <button
                      className="flex items-center gap-2 border border-yellow-400 text-yellow-400 px-3 py-2 rounded hover:bg-yellow-50 hover:text-blue-800 transition-colors font-medium"
                      onClick={() => window.location.href = '/admin/dashboard'}
                    >
                      <span className="w-4 h-4 inline-block">🏛️</span>
                      Switch to Admin View
                    </button>
                    <button
                      className="flex items-center gap-2 border border-green-400 text-green-400 px-3 py-2 rounded hover:bg-green-50 hover:text-blue-800 transition-colors font-medium"
                      onClick={() => window.location.href = '/user-dashboard'}
                    >
                      <span className="w-4 h-4 inline-block">👤</span>
                      Switch to User View
                    </button>
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="mt-auto text-xs text-blue-200 px-2 mb-4">Reliance © 2023</div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col">
        {/* Profile Header with Toggle */}
        <ProfileHeader 
          userData={{
            id: 'vendor-1',
            firstName: 'John',
            lastName: 'Smith',
            email: 'john@techsolutions.com',
            businessName: 'Sparkle Clean Pro',
            category: 'Professional Cleaning'
          }} 
          currentProfile="vendor"
          className="sticky top-0 z-40"
        />
        
        {/* Main Content */}
        <div className="flex-1 px-4 md:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

**Key Points:**
- ⚠️ `ProfileHeader` receives hardcoded `userData` (should use real vendor data from dashboard)
- ✅ Layout provides consistent sidebar and header across vendor pages
- ✅ Sidebar navigation is properly structured

---

## Consistency Issues & Recommendations

### 🔴 Critical Issues

1. **ID Type Mismatch**
   - **Issue:** `VendorJob.id` and `VendorReview.id` are typed as `number`, but Prisma returns `String` (cuid)
   - **Location:** `src/types/vendor.ts`
   - **Fix:** Change to `id: string` in both interfaces

2. **Hardcoded ProfileHeader Data**
   - **Issue:** Layout passes hardcoded `userData` to `ProfileHeader` instead of real vendor data
   - **Location:** `src/app/vendor/layout.tsx` line 116-123
   - **Fix:** Fetch vendor data in layout or pass from dashboard page

3. **Empty Stats & Arrays**
   - **Issue:** API returns zeros and empty arrays (not calculated from DB)
   - **Location:** `src/app/api/vendor/dashboard/route.ts`
   - **Fix:** Calculate from `vendor.bookings` and `vendor.reviews` relations

### 🟡 Medium Priority

4. **Service Types as String**
   - **Issue:** Prisma stores as `String?` (comma-separated), but types allow `string[]`
   - **Location:** Prisma schema vs TypeScript types
   - **Fix:** Either parse string to array in API, or update types to only allow string

5. **Refetch Implementation**
   - **Issue:** `refetch` uses `window.location.reload()` (poor UX)
   - **Location:** `src/hooks/useVendorDashboard.ts`
   - **Fix:** Use React Query or implement proper refetch function

6. **Temporary Auth**
   - **Issue:** Hardcoded vendor ID in `auth.ts`
   - **Location:** `src/lib/auth.ts`
   - **Fix:** Implement real JWT verification (marked as TODO)

### 🟢 Low Priority / Nice to Have

7. **Error Logging**
   - Could add more structured error logging
   - Consider using a logging service

8. **Type Safety**
   - Some `any` types in error handling
   - Could be more strict

9. **Loading States**
   - Could add skeleton loaders instead of simple text

---

## Summary

### ✅ What's Working
- Database connection established
- Vendor profile data fetching
- Type definitions are comprehensive
- UI components are properly structured
- Error handling is in place
- Empty states are user-friendly

### ⚠️ What Needs Attention
- ID types mismatch (number vs string)
- Stats not calculated from database
- Empty arrays not populated
- ProfileHeader uses hardcoded data
- Temporary authentication

### 📝 Next Steps
1. Fix ID types in `VendorJob` and `VendorReview` interfaces
2. Calculate stats from database (bookings, reviews)
3. Populate `recentJobs` and `recentReviews` arrays
4. Pass real vendor data to `ProfileHeader` in layout
5. Implement real JWT authentication
6. Consider using React Query for better data fetching

---

**Generated:** $(date)
**Audit Version:** 1.0



