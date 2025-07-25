'use client';
// DEVELOPER NOTES (Backend API Requirements)
//
// 1. Manager-only Access:
//    - Restrict this page to vendor managers only. Provide a way to check user role (e.g., /api/auth/me or include role in session/user object).
//
// 2. Data Sources Configuration:
//    - POST /api/vendor/settings/financial-tracking { enabled: boolean, dataSource: 'manual'|'platform'|'external' }
//    - GET /api/vendor/settings/financial-tracking
//      Returns: { enabled: boolean, dataSource: string, lastUpdated: string }
//    - POST /api/vendor/settings/manual-data { monthlyRevenue: number, bookingRate: number, customerAcquisitionCost: number, investments: number }
//    - GET /api/vendor/settings/manual-data
//      Returns: Array<{ id: string, month: string, data: ManualData, createdAt: string }>
//
// 3. Business Performance Dashboard (Conditional - only if financial tracking enabled):
//    - GET /api/vendor/analytics/revenue-impact
//      Returns: { reviewScore: number, avgBookingRate: number, revenueChange: number }
//    - GET /api/vendor/analytics/customer-acquisition
//      Returns: { avgCAC: number, reviewInfluence: number }
//    - GET /api/vendor/analytics/benchmarking
//      Returns: { yourScore: number, competitorAvg: number, percentile: number }
//    - GET /api/vendor/analytics/growth-trends
//      Returns: { months: string[], reviewScores: number[], bookings: number[], revenue: number[] }
//
// 4. Strategic Decision-Making Tools:
//    - GET /api/vendor/analytics/service-performance
//      Returns: Array<{ service: string, avgRating: number, reviewCount: number, revenue?: number, hasFinancialData: boolean }>
//    - GET /api/vendor/analytics/pricing-impact
//      Returns: Array<{ priceRange: string, avgRating: number, bookingRate?: number, hasFinancialData: boolean }>
//    - GET /api/vendor/analytics/geographic-performance
//      Returns: Array<{ area: string, avgRating: number, jobs: number }>
//    - GET /api/vendor/analytics/seasonal-trends
//      Returns: Array<{ season: string, avgRating: number, jobs: number }>
//    - GET /api/vendor/analytics/roi-improvements
//      Returns: Array<{ improvement: string, investment?: number, revenueIncrease?: number, roi?: number, hasFinancialData: boolean }>
//
// 5. Team Management & Accountability:
//    - GET /api/vendor/employees/performance
//      Returns: Array<{
//        id: number, name: string, role: string, avgRating: number, reviewCount: number,
//        responseTime: string, completionRate: number, trainingNeeded: string[],
//        performanceGoal: number, lastReview: string
//      }>
//    - POST /api/vendor/employees/:id/performance-review { rating: number, notes: string, goals: string[] }
//    - GET /api/vendor/employees/:id/training-needs
//      Returns: Array<{ skill: string, priority: 'high'|'medium'|'low', recommendedCourses: string[] }>
//    - GET /api/vendor/analytics/hiring-insights
//      Returns: Array<{ insight: string, confidence: number }>
//    - POST /api/vendor/employees/:id/goals { goals: Array<{ description: string, target: number, deadline: string }> }
//
// 6. Customer Relationship Management:
//    - GET /api/vendor/customers/insights
//      Returns: Array<{
//        id: number, name: string, email: string, phone?: string, totalJobs: number,
//        totalReviews: number, avgRating: number, lastJob: string, lastReview: string,
//        status: 'VIP'|'Active'|'At Risk'|'Inactive', riskLevel: 'Low'|'Medium'|'High',
//        engagementScore: number
//      }>
//    - GET /api/vendor/customers/search?q=string
//      Returns: Array<Customer> (filtered by name, email, or phone)
//    - POST /api/vendor/customers/:id/segment { segment: string, notes: string }
//
// 7. Customer Recovery Tools:
//    - GET /api/vendor/recovery/actions
//      Returns: Array<{
//        id: number, customerId: number, customerName: string, customerEmail: string,
//        action: string, status: 'Pending'|'In Progress'|'Completed'|'Cancelled',
//        priority: 'High'|'Medium'|'Low', assignedTo?: string, dueDate: string,
//        reason: string, template: string, createdAt: string
//      }>
//    - POST /api/vendor/recovery/actions { customerId: number, action: string, assignedTo?: string, dueDate: string, notes: string }
//    - PUT /api/vendor/recovery/actions/:id/status { status: string, notes?: string }
//    - GET /api/vendor/recovery/templates
//      Returns: Array<{ id: number, name: string, template: string, category: string }>
//    - POST /api/vendor/recovery/templates { name: string, template: string, category: string }
//    - GET /api/vendor/recovery/triggers
//      Returns: Array<{ id: number, name: string, condition: string, action: string, priority: string, enabled: boolean, lastTriggered: string }>
//    - POST /api/vendor/recovery/triggers { name: string, condition: string, action: string, priority: string }
//    - PUT /api/vendor/recovery/triggers/:id { enabled: boolean }
//    - GET /api/vendor/recovery/analytics
//      Returns: {
//        overallSuccessRate: number, avgRatingImprovement: number, customerRetentionRate: number,
//        avgResponseTime: string, totalRecovered: number, totalAttempted: number,
//        byMethod: Array<{ method: string, successRate: number, avgImprovement: number }>,
//        byEmployee: Array<{ employee: string, successRate: number, actionsCompleted: number }>
//      }
//    - POST /api/vendor/recovery/actions/:id/email { subject: string, message: string }
//    - POST /api/vendor/recovery/actions/:id/sms { message: string }
//
// 8. Review Feed (Enhanced):
//    - GET /api/vendor/reviews?rating=number&employeeId=number&jobType=string&search=string
//      Returns: Array<{
//        id: number, reviewer: string, date: string, rating: number, text: string,
//        employeeId: number, jobType: string, customerEmail: string, mediaUrl?: string,
//        flagged?: boolean, internalNotes?: string[]
//      }>
//    - Supports filtering by rating, employeeId, jobType, and search (query params)
//    - Supports bulk actions: POST /api/vendor/reviews/bulk-action { ids: number[], action: 'flag'|'export'|'create-task' }
//
// 9. Employee Analytics (Enhanced):
//    - GET /api/vendor/employees/with-reviews
//      Returns: Array<{ id: number, name: string, email: string, role: string, photo: string, avgRating: number, reviewCount: number, recent: string, fiveStarCount: number }>
//    - GET /api/vendor/employees/:id/reviews
//      Returns: Array<{ text: string, date: string, rating: number, jobType: string }>
//
// 10. Internal Notes & Task Management:
//    - POST /api/vendor/reviews/:id/note { note: string }
//    - GET /api/vendor/reviews/:id/notes
//      Returns: Array<{ id: string, note: string, author: string, date: string }>
//    - POST /api/vendor/reviews/:id/task { description: string, assignedTo?: string, dueDate?: string }
//    - GET /api/vendor/reviews/:id/tasks
//      Returns: Array<{ id: string, description: string, status: string, assignedTo?: string, dueDate?: string, created: string }>
//
// 11. Customer Details & History:
//    - GET /api/vendor/customers/:customerId/reviews
//      Returns: Array<Review> (see above)
//    - GET /api/vendor/customers/:customerId/contact
//      Returns: { email: string, phone?: string, address?: string }
//    - GET /api/vendor/customers/:customerId/history
//      Returns: { totalJobs: number, totalSpent: number, avgRating: number, lastActivity: string }
//
// 12. Media Viewing:
//    - Reviews may include mediaUrl (photo/video). Provide secure, signed URLs if private.
//
// 13. Database Schema Requirements:
//    - vendors table: id, name, manager_id, financial_tracking_enabled, data_source
//    - vendor_manual_data table: id, vendor_id, month, monthly_revenue, booking_rate, customer_acquisition_cost, investments, created_at
//    - recovery_actions table: id, vendor_id, customer_id, action_type, status, priority, assigned_to, due_date, reason, template_id, created_at
//    - recovery_templates table: id, vendor_id, name, template, category, created_at
//    - recovery_triggers table: id, vendor_id, name, condition, action, priority, enabled, last_triggered
//    - customer_segments table: id, vendor_id, customer_id, segment, notes, created_at
//    - employee_performance_goals table: id, employee_id, description, target, deadline, status, created_at
//
// 14. All endpoints should validate that the requesting user is a manager for the vendor.
// 15. Implement proper error handling for cases where financial data is not available.
// 16. Add rate limiting for email/SMS sending to prevent abuse.
// 17. Implement audit logging for all recovery actions and status changes.
//
// End DEVELOPER NOTES

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ArrowUpRight, ArrowDownRight, AlertTriangle, Lightbulb, ThumbsUp, ThumbsDown, Info, BarChart2, LineChart, ArrowLeft, Settings, Upload, Download, Calendar, DollarSign, BarChart3, Search, X, Filter, Calendar as CalendarIcon, User, Mail, Phone, MapPin, Clock, TrendingUp, TrendingDown, CheckCircle, AlertCircle, Send } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
// import SimpleTooltip from '../../../../components/ui/tooltip';
// TODO: Import authentication/role utilities as needed

// Business Performance Dashboard mock data
const revenueImpact = { reviewScore: 4.6, avgBookingRate: 0.23, revenueChange: 1200 };
const customerAcquisition = { avgCAC: 45.00, reviewInfluence: 0.15 };
const benchmarking = { yourScore: 4.6, competitorAvg: 4.3, percentile: 80 };
const growth = {
  months: ["Feb", "Mar", "Apr", "May", "Jun"],
  reviewScores: [4.2, 4.4, 4.5, 4.6, 4.7],
  bookings: [120, 130, 140, 150, 160],
  revenue: [10000, 11000, 12000, 13000, 14000]
};

// Strategic Decision-Making Tools mock data
const servicePerformance = [
  { service: "Plumbing", avgRating: 4.8, reviewCount: 45, revenue: 8500, hasFinancialData: true },
  { service: "Electrical", avgRating: 4.5, reviewCount: 32, revenue: 6200, hasFinancialData: true },
  { service: "HVAC", avgRating: 4.2, reviewCount: 28, revenue: null, hasFinancialData: false },
  { service: "Landscaping", avgRating: 4.7, reviewCount: 23, revenue: null, hasFinancialData: false }
];
const pricingImpact = [
  { priceRange: "$50-100", avgRating: 4.6, bookingRate: 0.25, hasFinancialData: true },
  { priceRange: "$100-200", avgRating: 4.8, bookingRate: 0.18, hasFinancialData: true },
  { priceRange: "$200+", avgRating: 4.3, bookingRate: null, hasFinancialData: false }
];
const geographicPerformance = [
  { area: "Downtown", avgRating: 4.7, jobs: 45 },
  { area: "Suburbs", avgRating: 4.4, jobs: 38 },
  { area: "Rural", avgRating: 4.2, jobs: 25 }
];
const seasonalTrends = [
  { season: "Spring", avgRating: 4.6, jobs: 45 },
  { season: "Summer", avgRating: 4.8, jobs: 52 },
  { season: "Fall", avgRating: 4.5, jobs: 38 },
  { season: "Winter", avgRating: 4.3, jobs: 29 }
];
const roiImprovements = [
  { improvement: "Response Time", investment: 500, revenueIncrease: 1200, roi: 140, hasFinancialData: true },
  { improvement: "Quality Training", investment: 800, revenueIncrease: 1500, roi: 87.5, hasFinancialData: true },
  { improvement: "Equipment Upgrade", investment: null, revenueIncrease: null, roi: null, hasFinancialData: false }
];

// Enhanced Team Management & Accountability mock data
const employeePerformance = [
  { 
    id: 1, 
    name: "Maria Lopez", 
    role: "Senior Technician", 
    avgRating: 4.8, 
    reviewCount: 32, 
    responseTime: "1.2h", 
    completionRate: 98, 
    trainingNeeded: ["Advanced HVAC", "Customer Service"], 
    performanceGoal: 4.7,
    lastReview: "2024-05-15",
    monthlyPerformance: [
      { month: "Jan 2024", rating: 4.7, reviews: 8, responseTime: "1.3h", completion: 97, trend: "stable" },
      { month: "Feb 2024", rating: 4.8, reviews: 6, responseTime: "1.1h", completion: 98, trend: "up" },
      { month: "Mar 2024", rating: 4.9, reviews: 7, responseTime: "1.0h", completion: 99, trend: "up" },
      { month: "Apr 2024", rating: 4.8, reviews: 5, responseTime: "1.2h", completion: 98, trend: "stable" },
      { month: "May 2024", rating: 4.8, reviews: 6, responseTime: "1.2h", completion: 98, trend: "stable" }
    ],
    strengths: ["Technical expertise", "Customer communication", "Reliability"],
    areasForImprovement: ["Advanced HVAC systems", "Conflict resolution"],
    nextReviewDate: "2024-06-15",
    performanceLevel: "Exceeds Expectations"
  },
  { 
    id: 2, 
    name: "James Lee", 
    role: "Technician", 
    avgRating: 4.2, 
    reviewCount: 21, 
    responseTime: "2.1h", 
    completionRate: 92, 
    trainingNeeded: ["Response Time", "Technical Skills"], 
    performanceGoal: 4.5,
    lastReview: "2024-04-20",
    monthlyPerformance: [
      { month: "Jan 2024", rating: 4.0, reviews: 5, responseTime: "2.5h", completion: 90, trend: "down" },
      { month: "Feb 2024", rating: 4.1, reviews: 4, responseTime: "2.3h", completion: 91, trend: "up" },
      { month: "Mar 2024", rating: 4.3, reviews: 6, responseTime: "2.0h", completion: 93, trend: "up" },
      { month: "Apr 2024", rating: 4.2, reviews: 3, responseTime: "2.1h", completion: 92, trend: "stable" },
      { month: "May 2024", rating: 4.2, reviews: 3, responseTime: "2.1h", completion: 92, trend: "stable" }
    ],
    strengths: ["Problem-solving", "Team collaboration", "Safety awareness"],
    areasForImprovement: ["Response time", "Advanced troubleshooting"],
    nextReviewDate: "2024-05-20",
    performanceLevel: "Meets Expectations"
  },
  { 
    id: 3, 
    name: "Sarah Johnson", 
    role: "Apprentice", 
    avgRating: 4.6, 
    reviewCount: 15, 
    responseTime: "1.8h", 
    completionRate: 95, 
    trainingNeeded: ["Advanced Plumbing"], 
    performanceGoal: 4.3,
    lastReview: "2024-05-10",
    monthlyPerformance: [
      { month: "Jan 2024", rating: 4.2, reviews: 2, responseTime: "2.2h", completion: 92, trend: "up" },
      { month: "Feb 2024", rating: 4.4, reviews: 3, responseTime: "2.0h", completion: 93, trend: "up" },
      { month: "Mar 2024", rating: 4.5, reviews: 4, responseTime: "1.9h", completion: 94, trend: "up" },
      { month: "Apr 2024", rating: 4.6, reviews: 3, responseTime: "1.8h", completion: 95, trend: "up" },
      { month: "May 2024", rating: 4.6, reviews: 3, responseTime: "1.8h", completion: 95, trend: "stable" }
    ],
    strengths: ["Learning ability", "Customer service", "Attention to detail"],
    areasForImprovement: ["Advanced plumbing techniques", "Time management"],
    nextReviewDate: "2024-06-10",
    performanceLevel: "Exceeds Expectations"
  }
];

const hiringInsights = [
  { insight: "HVAC technicians with 4.5+ ratings earn 15% more", confidence: 85 },
  { insight: "Customer service training reduces negative reviews by 40%", confidence: 92 },
  { insight: "Response time under 2 hours increases ratings by 0.3", confidence: 78 }
];

// Customer Relationship Management mock data
const customerInsights = [
  {
    id: 1,
    name: "John Smith",
    email: "john.smith@email.com",
    phone: "(555) 123-4567",
    totalJobs: 8,
    totalReviews: 6,
    avgRating: 4.8,
    lastJob: "2024-06-01",
    lastReview: "2024-06-01",
    status: "VIP",
    riskLevel: "Low",
    engagementScore: 95
  },
  {
    id: 2,
    name: "Sarah Johnson",
    email: "sarah.j@email.com",
    phone: "(555) 234-5678",
    totalJobs: 3,
    totalReviews: 2,
    avgRating: 4.2,
    lastJob: "2024-05-15",
    lastReview: "2024-05-15",
    status: "Active",
    riskLevel: "Medium",
    engagementScore: 72
  },
  {
    id: 3,
    name: "Mike Davis",
    email: "mike.davis@email.com",
    phone: "(555) 345-6789",
    totalJobs: 12,
    totalReviews: 10,
    avgRating: 4.9,
    lastJob: "2024-06-05",
    lastReview: "2024-06-05",
    status: "VIP",
    riskLevel: "Low",
    engagementScore: 98
  },
  {
    id: 4,
    name: "Lisa Wilson",
    email: "lisa.w@email.com",
    phone: "(555) 456-7890",
    totalJobs: 2,
    totalReviews: 2,
    avgRating: 3.8,
    lastJob: "2024-04-20",
    lastReview: "2024-04-20",
    status: "At Risk",
    riskLevel: "High",
    engagementScore: 45
  }
];

const customerSegments = [
  { 
    segment: "VIP Customers", 
    count: 15, 
    criteria: "5+ reviews, 4.5+ avg rating, active in last 3 months",
    avgRating: 4.8,
    avgReviews: 8.2,
    lastActivity: "2.1 months ago"
  },
  { 
    segment: "Regular Customers", 
    count: 45, 
    criteria: "2-4 reviews, 4.0+ avg rating, active in last 6 months",
    avgRating: 4.5,
    avgReviews: 3.1,
    lastActivity: "4.3 months ago"
  },
  { 
    segment: "At Risk", 
    count: 8, 
    criteria: "Below 4.0 avg rating OR no activity in 6+ months",
    avgRating: 3.9,
    avgReviews: 2.8,
    lastActivity: "8.5 months ago"
  },
  { 
    segment: "New Customers", 
    count: 22, 
    criteria: "1-2 reviews, joined in last 3 months",
    avgRating: 4.3,
    avgReviews: 1.5,
    lastActivity: "1.2 months ago"
  }
];

const recoveryActions = [
  { 
    id: 1,
    customerId: 4, 
    customerName: "Lisa Wilson",
    customerEmail: "lisa.w@email.com",
    action: "Follow-up call", 
    status: "Pending", 
    priority: "High", 
    assignedTo: "Maria Lopez",
    dueDate: "2024-06-10",
    reason: "Low rating (3.8 stars)",
    template: "Apologize for experience, offer discount on next service"
  },
  { 
    id: 2,
    customerId: 2, 
    customerName: "Sarah Johnson",
    customerEmail: "sarah.j@email.com",
    action: "Discount offer", 
    status: "Completed", 
    priority: "Medium", 
    assignedTo: "James Lee",
    dueDate: "2024-06-08",
    reason: "Inactive for 2+ months",
    template: "Send 15% discount for next booking"
  },
  { 
    id: 3,
    customerId: 1, 
    customerName: "John Smith",
    customerEmail: "john.smith@email.com",
    action: "VIP check-in", 
    status: "In Progress", 
    priority: "Medium", 
    assignedTo: "Maria Lopez",
    dueDate: "2024-06-12",
    reason: "VIP customer - quarterly check-in",
    template: "Thank for loyalty, offer exclusive service"
  },
  { 
    id: 4,
    customerId: 5, 
    customerName: "Robert Chen",
    customerEmail: "robert.chen@email.com",
    action: "Service improvement", 
    status: "Pending", 
    priority: "High", 
    assignedTo: "James Lee",
    dueDate: "2024-06-09",
    reason: "Complaint about response time",
    template: "Address response time concerns, offer compensation"
  }
];

const recoveryTemplates = [
  { name: "Apology Call", template: "Hi [Name], I wanted to personally apologize for your recent experience. We take all feedback seriously and would like to make this right." },
  { name: "Discount Offer", template: "Hi [Name], we value your business and would like to offer you a 15% discount on your next service as a gesture of goodwill." },
  { name: "VIP Check-in", template: "Hi [Name], as one of our valued customers, I wanted to check in and see how everything is going with your recent services." },
  { name: "Service Improvement", template: "Hi [Name], thank you for your feedback. We're implementing improvements based on your suggestions and would love to show you the changes." }
];

// Automated Action Triggers
const autoTriggers = [
  { 
    id: 1, 
    name: "Low Rating Alert", 
    condition: "Review below 4.0 stars", 
    action: "Follow-up call", 
    priority: "High", 
    enabled: true,
    lastTriggered: "2024-06-05"
  },
  { 
    id: 2, 
    name: "VIP Inactivity", 
    condition: "VIP customer inactive 2+ months", 
    action: "VIP check-in", 
    priority: "Medium", 
    enabled: true,
    lastTriggered: "2024-06-03"
  },
  { 
    id: 3,
    name: "At Risk Escalation", 
    condition: "Customer becomes 'At Risk'", 
    action: "Recovery campaign", 
    priority: "High", 
    enabled: true,
    lastTriggered: "2024-06-01"
  }
];

// Recovery Success Analytics
const recoveryAnalytics = {
  overallSuccessRate: 75,
  avgRatingImprovement: 0.8,
  customerRetentionRate: 82,
  avgResponseTime: "2.3 days",
  totalRecovered: 24,
  totalAttempted: 32,
  byMethod: [
    { method: "Follow-up Call", successRate: 85, avgImprovement: 1.2 },
    { method: "Discount Offer", successRate: 70, avgImprovement: 0.6 },
    { method: "VIP Check-in", successRate: 90, avgImprovement: 0.3 },
    { method: "Service Improvement", successRate: 65, avgImprovement: 1.1 }
  ],
  byEmployee: [
    { employee: "Maria Lopez", successRate: 88, actionsCompleted: 12 },
    { employee: "James Lee", successRate: 72, actionsCompleted: 8 },
    { employee: "Sarah Johnson", successRate: 80, actionsCompleted: 6 }
  ]
};

// Placeholder: Only managers can access
const isManager = true; // Replace with real role check

export default function VendorReviewsPage() {
  if (!isManager) {
    return <div className="p-8 text-center text-red-600 font-semibold">Access denied. Only managers can view reviews.</div>;
  }

  // Mock employees (from vendor/employees/page.tsx)
  const employees = [
    { id: 1, name: 'Maria Lopez', email: 'maria@vendor.com', role: 'Technician', photo: 'https://randomuser.me/api/portraits/women/44.jpg' },
    { id: 2, name: 'James Lee', email: 'james@vendor.com', role: 'Technician', photo: 'https://randomuser.me/api/portraits/men/45.jpg' },
  ];
  // Mock review stats for each employee
  const employeeReviews = [
    { employeeId: 1, avgRating: 4.8, reviewCount: 32, recent: 'Maria was very professional and quick.' },
    { employeeId: 2, avgRating: 4.2, reviewCount: 21, recent: 'James did a great job, but arrived late.' },
  ];

  // Mock job types for reviews
  const jobTypes = ['Plumbing', 'Electrical', 'HVAC'];
  // Add jobType and customerEmail to reviewFeed
  const reviewFeed = [
    { id: 1, reviewer: 'John Smith', date: '2024-06-01', rating: 5, text: 'Excellent service, very satisfied!', employeeId: 1, jobType: 'Plumbing', customerEmail: 'john@example.com' },
    { id: 2, reviewer: 'Alice Brown', date: '2024-05-28', rating: 5, text: 'Maria was great, but the job took longer than expected.', employeeId: 1, jobType: 'Electrical', customerEmail: 'alice@example.com' },
    { id: 3, reviewer: 'Carlos Rivera', date: '2024-05-25', rating: 4, text: 'James was friendly, but there was a delay.', employeeId: 2, jobType: 'HVAC', customerEmail: 'carlos@example.com' },
    { id: 4, reviewer: 'Samantha Lee', date: '2024-05-20', rating: 5, text: 'Outstanding work by James!', employeeId: 2, jobType: 'Plumbing', customerEmail: 'samantha@example.com' },
    { id: 5, reviewer: 'Anonymous', date: '2024-05-18', rating: 2, text: 'Not happy with the response time.', employeeId: 1, jobType: 'Electrical', customerEmail: '' },
  ];
  // Job type filter
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  // Bulk selection state
  const [selectedReviews, setSelectedReviews] = useState([]);
  // Internal notes state
  const [internalNotes, setInternalNotes] = useState({});
  // Customer history modal state
  const [openCustomerModal, setOpenCustomerModal] = useState(false);
  const [modalCustomer, setModalCustomer] = useState(null);
  // Task creation state (mocked)
  const [createdTasks, setCreatedTasks] = useState([]);
  // Enhanced Filter state
  const [ratingFilter, setRatingFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  // Filtered reviews with job type
  const filteredReviews = reviewFeed.filter(r =>
    (ratingFilter === 'all' || r.rating === Number(ratingFilter)) &&
    (employeeFilter === 'all' || r.employeeId === Number(employeeFilter)) &&
    (jobTypeFilter === 'all' || r.jobType === jobTypeFilter)
  );
  // Enhanced Alert System with Multi-Level Categories
  const alertCategories = {
    critical: ['security breach', 'payment fraud'],
    warning: ['slow response', 'multiple failed logins', 'unusual activity'],
    info: ['profile incomplete', 'verification pending'],
    success: ['new user milestone', 'positive feedback trend']
  };

  // Predictive Analytics Integration
  const userInsights = {
    churnRisk: 0.15, // 15% risk based on recent negative reviews
    engagementScore: 78, // 78/100 engagement score
    satisfactionTrend: 0.2, // +0.2 trend over last 30 days
    supportNeeds: 'medium' // low/medium/high support requirement
  };

  // Enhanced review analysis
  const analyzeReviewContext = (reviewText, userProfile) => {
    const sentiment = reviewText.toLowerCase().includes('excellent') || reviewText.toLowerCase().includes('great') ? 'positive' : 'negative';
    const category = reviewText.toLowerCase().includes('service') ? 'service' : 'platform';
    const urgency = reviewText.toLowerCase().includes('urgent') || reviewText.toLowerCase().includes('immediate') ? 'high' : 'low';
    return { sentiment, category, urgency };
  };
  // Time-based trends (mocked data)
  const trendsData = [
    { month: 'Feb', avg: 4.2 },
    { month: 'Mar', avg: 4.4 },
    { month: 'Apr', avg: 4.5 },
    { month: 'May', avg: 4.6 },
    { month: 'Jun', avg: 4.7 },
  ];
  // Employee comparison (mocked)
  const employeeComparison = employees.map(emp => ({ name: emp.name, avg: employeeReviews.find(r => r.employeeId === emp.id)?.avgRating ?? 0 }));

  // Actionable Insights: Sentiment and Themes (mocked)
  const positiveReviews = reviewFeed.filter(r => r.rating >= 4).length;
  const negativeReviews = reviewFeed.filter(r => r.rating <= 2).length;
  const sentimentTrend = positiveReviews - negativeReviews;
  const commonThemes = ['professional', 'quick', 'friendly', 'late'];

  // Mock all reviews for each employee (now with date and rating)
  const allEmployeeReviews = {
    1: [
      { text: 'Maria was very professional and quick.', date: '2024-06-01', rating: 5 },
      { text: 'Great attention to detail.', date: '2024-05-28', rating: 5 },
      { text: 'Would hire again.', date: '2024-05-20', rating: 4 },
    ],
    2: [
      { text: 'James did a great job, but arrived late.', date: '2024-05-25', rating: 4 },
      { text: 'Friendly and helpful.', date: '2024-05-22', rating: 5 },
      { text: 'Resolved the issue efficiently.', date: '2024-05-18', rating: 5 },
    ],
  };

  // Data configuration state
  const [financialTrackingEnabled, setFinancialTrackingEnabled] = useState(false);
  const [dataSource, setDataSource] = useState('manual'); // 'manual', 'platform', 'external'
  const [showDataEntryForm, setShowDataEntryForm] = useState(false);

  // Manual data entry form state
  const [manualData, setManualData] = useState({
    monthlyRevenue: '',
    bookingRate: '',
    customerAcquisitionCost: '',
    investments: ''
  });

  // Customer Recovery Tools state
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showTriggersModal, setShowTriggersModal] = useState(false);
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [showAllActions, setShowAllActions] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [showStatusUpdateModal, setShowStatusUpdateModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Additional state variables for interactive functionality
  const [modalEmp, setModalEmp] = useState(null);
  const [openEmpModal, setOpenEmpModal] = useState(false);

  // Enhanced state for new features
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [showBulkActionModal, setShowBulkActionModal] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [savedFilters, setSavedFilters] = useState([]);
  const [currentFilterName, setCurrentFilterName] = useState('');
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  
  // Pending Approvals state
  const [activeTab, setActiveTab] = useState('reviews'); // 'reviews' or 'approvals'
  const [pendingApprovals, setPendingApprovals] = useState([
    { 
      id: 1, 
      jobTitle: 'Water Heater Repair', 
      employee: 'Maria Lopez', 
      mediaType: 'video', 
      uploadedAt: '2024-06-10 10:00',
      thumbnail: 'https://picsum.photos/200/150?random=1',
      url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
      status: 'pending-approval',
      customerEmail: 'john.smith@email.com',
      customerName: 'John Smith'
    },
    { 
      id: 2, 
      jobTitle: 'AC Installation', 
      employee: 'James Lee', 
      mediaType: 'photo', 
      uploadedAt: '2024-06-10 10:05',
      thumbnail: 'https://picsum.photos/200/150?random=2',
      url: 'https://picsum.photos/400/300?random=2',
      status: 'pending-approval',
      customerEmail: 'sarah.j@email.com',
      customerName: 'Sarah Johnson'
    }
  ]);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [showApprovalConfirmation, setShowApprovalConfirmation] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(null);

  // Enhanced filtering logic
  const enhancedFilteredReviews = reviewFeed.filter(r => {
    const matchesRating = ratingFilter === 'all' || r.rating === Number(ratingFilter);
    const matchesEmployee = employeeFilter === 'all' || r.employeeId === Number(employeeFilter);
    const matchesJobType = jobTypeFilter === 'all' || r.jobType === jobTypeFilter;
    const matchesSearch = search === '' || 
      r.reviewer.toLowerCase().includes(search.toLowerCase()) ||
      r.text.toLowerCase().includes(search.toLowerCase()) ||
      employees.find(e => e.id === r.employeeId)?.name.toLowerCase().includes(search.toLowerCase());
    
    // Date range filtering
    const reviewDate = new Date(r.date);
    const matchesDateRange = !dateRange.start || !dateRange.end || 
      (reviewDate >= new Date(dateRange.start) && reviewDate <= new Date(dateRange.end));
    
    // Sentiment filtering
    const sentiment = r.rating >= 4 ? 'positive' : r.rating <= 2 ? 'negative' : 'neutral';
    const matchesSentiment = sentimentFilter === 'all' || sentiment === sentimentFilter;
    
    return matchesRating && matchesEmployee && matchesJobType && matchesSearch && matchesDateRange && matchesSentiment;
  });

  // Export functionality
  const exportReviews = (format) => {
    const data = enhancedFilteredReviews.map(r => ({
      Reviewer: r.reviewer,
      Date: r.date,
      Rating: r.rating,
      Employee: employees.find(e => e.id === r.employeeId)?.name || 'N/A',
      JobType: r.jobType,
      Review: r.text,
      CustomerEmail: r.customerEmail
    }));

    if (format === 'csv') {
      const csvContent = [
        Object.keys(data[0]).join(','),
        ...data.map(row => Object.values(row).map(val => `"${val}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reviews_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } else if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reviews_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    }
    
    setShowExportModal(false);
  };

  // Save filter preset
  const saveFilterPreset = () => {
    const preset = {
      name: currentFilterName,
      filters: {
        ratingFilter,
        employeeFilter,
        jobTypeFilter,
        search,
        dateRange,
        sentimentFilter
      },
      createdAt: new Date().toISOString()
    };
    setSavedFilters([...savedFilters, preset]);
    setShowSaveFilterModal(false);
    setCurrentFilterName('');
  };

  // Load filter preset
  const loadFilterPreset = (preset) => {
    setRatingFilter(preset.filters.ratingFilter);
    setEmployeeFilter(preset.filters.employeeFilter);
    setJobTypeFilter(preset.filters.jobTypeFilter);
    setSearch(preset.filters.search);
    setDateRange(preset.filters.dateRange);
    setSentimentFilter(preset.filters.sentimentFilter);
  };

  // Pending Approvals functions
  const handleApprove = (approvalId) => {
    const approvedItem = pendingApprovals.find(a => a.id === approvalId);
    if (approvedItem) {
      // Show confirmation popup
      setPendingApproval(approvedItem);
      setShowApprovalConfirmation(true);
    }
  };

  const confirmApproval = () => {
    if (pendingApproval) {
      // Approve and deliver directly to customer
      const approvedContentItem = {
        ...pendingApproval,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: 'Manager', // In real app, get from auth context
        deliveredAt: new Date().toISOString()
      };
      
      // Remove from pending approvals
      setPendingApprovals(prev => prev.filter(a => a.id !== pendingApproval.id));
      
      // Backend calls: 
      // 1. POST /api/vendor/approvals/:id/approve
      // 2. POST /api/vendor/deliver/:contentId (automatic delivery)
      // 3. POST /api/vendor/jobs/:jobId/archive-content (add to content archive)
      console.log('Content approved and delivered to customer:', approvedContentItem);
      
      // Close confirmation popup
      setShowApprovalConfirmation(false);
      setPendingApproval(null);
      
      // Show success message
      alert(`Content approved and delivered to ${pendingApproval.customerName}. 72hr countdown will start when they open it.`);
    }
  };

  const cancelApproval = () => {
    setShowApprovalConfirmation(false);
    setPendingApproval(null);
  };

  const handleReject = (approvalId) => {
    const rejectedItem = pendingApprovals.find(a => a.id === approvalId);
    if (rejectedItem) {
      // Log rejection for audit trail
      console.log('Content rejected:', rejectedItem);
      
      // Remove from pending approvals
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
      
      // Backend call: POST /api/vendor/approvals/:id/reject
      console.log('Content rejected:', rejectedItem);
    }
  };

  const openMediaViewer = (media) => {
    setSelectedMedia(media);
    setShowMediaViewer(true);
  };



  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+A to select all
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setSelectedReviews(enhancedFilteredReviews.map(r => r.id));
      }
      // Escape to close modals
      if (e.key === 'Escape') {
        setOpenEmpModal(false);
        setOpenCustomerModal(false);
        setShowReviewModal(false);
        setShowExportModal(false);
        setShowSaveFilterModal(false);
        setShowBulkActionModal(false);
      }
      // Ctrl+E to export
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        setShowExportModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enhancedFilteredReviews]);

  // Real-time metrics calculation
  const realTimeMetrics = {
    totalReviews: enhancedFilteredReviews.length,
    averageRating: enhancedFilteredReviews.length > 0 
      ? (enhancedFilteredReviews.reduce((sum, r) => sum + r.rating, 0) / enhancedFilteredReviews.length).toFixed(1)
      : 0,
    positiveReviews: enhancedFilteredReviews.filter(r => r.rating >= 4).length,
    negativeReviews: enhancedFilteredReviews.filter(r => r.rating <= 2).length,
    neutralReviews: enhancedFilteredReviews.filter(r => r.rating === 3).length,
    sentimentBreakdown: {
      positive: enhancedFilteredReviews.filter(r => r.rating >= 4).length,
      neutral: enhancedFilteredReviews.filter(r => r.rating === 3).length,
      negative: enhancedFilteredReviews.filter(r => r.rating <= 2).length
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Back to Dashboard Button */}
      <div className="mb-4">
        <a href="/vendor" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 font-medium shadow-sm transition">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </a>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('reviews')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reviews'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Reviews & Analytics
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'approvals'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Approvals
              {pendingApprovals.length > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {pendingApprovals.length}
                </span>
              )}
            </button>

          </nav>
        </div>
      </div>

      {/* Reviews Tab Content */}
      {activeTab === 'reviews' && (
        <>
          {/* Real-time Metrics Dashboard */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Real-time Metrics</h2>
                <p className="text-sm text-gray-600">Live performance indicators</p>
              </div>
            </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{realTimeMetrics.totalReviews}</div>
            <div className="text-sm text-blue-600">Total Reviews</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{realTimeMetrics.averageRating}</div>
            <div className="text-sm text-green-600">Avg Rating</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg">
            <div className="text-2xl font-bold text-emerald-600">{realTimeMetrics.positiveReviews}</div>
            <div className="text-sm text-emerald-600">Positive</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{realTimeMetrics.neutralReviews}</div>
            <div className="text-sm text-yellow-600">Neutral</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{realTimeMetrics.negativeReviews}</div>
            <div className="text-sm text-red-600">Negative</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{selectedReviews.length}</div>
            <div className="text-sm text-purple-600">Selected</div>
          </div>
        </div>
      </div>

      {/* Sentiment Breakdown Chart */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <BarChart2 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Sentiment Breakdown</h2>
            <p className="text-sm text-gray-600">Review sentiment analysis</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                <span className="text-sm font-medium">Positive (4-5 stars)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span className="text-sm font-medium">Neutral (3 stars)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-sm font-medium">Negative (1-2 stars)</span>
              </div>
            </div>
          </div>
          <div className="flex h-8 rounded-lg overflow-hidden">
            {realTimeMetrics.totalReviews > 0 && (
              <>
                <div 
                  className="bg-emerald-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(realTimeMetrics.sentimentBreakdown.positive / realTimeMetrics.totalReviews) * 100}%` }}
                >
                  {realTimeMetrics.sentimentBreakdown.positive}
                </div>
                <div 
                  className="bg-yellow-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(realTimeMetrics.sentimentBreakdown.neutral / realTimeMetrics.totalReviews) * 100}%` }}
                >
                  {realTimeMetrics.sentimentBreakdown.neutral}
                </div>
                <div 
                  className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(realTimeMetrics.sentimentBreakdown.negative / realTimeMetrics.totalReviews) * 100}%` }}
                >
                  {realTimeMetrics.sentimentBreakdown.negative}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Data Sources Configuration */}
      <div className="mb-8">
        <div className="bg-gray-50 border border-gray-200 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            Data Sources Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Financial Tracking Toggle */}
            <div className="bg-white rounded-lg p-4 shadow border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="font-semibold">Financial Tracking</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={financialTrackingEnabled}
                    onChange={(e) => setFinancialTrackingEnabled(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-600">Track revenue, booking rates, and ROI calculations</p>
            </div>
            {/* Data Source Selection */}
            <div className="bg-white rounded-lg p-4 shadow border">
              <div className="flex items-center gap-2 mb-3">
                <Upload className="w-4 h-4 text-blue-600" />
                <span className="font-semibold">Data Source</span>
              </div>
              <select 
                className="w-full p-2 border rounded-md"
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
              >
                <option value="manual">Manual Entry</option>
                <option value="platform">Platform Payments</option>
                <option value="external">External Integration</option>
              </select>
              <p className="text-sm text-gray-600 mt-2">
                {dataSource === 'manual' && 'Enter your data manually each month'}
                {dataSource === 'platform' && 'Use data from platform payments (if available)'}
                {dataSource === 'external' && 'Connect to external accounting systems'}
              </p>
            </div>
          </div>
          {/* Manual Data Entry Form */}
          {financialTrackingEnabled && dataSource === 'manual' && (
            <div className="mt-6 bg-white rounded-lg p-4 shadow border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Manual Data Entry
                </h3>
                <button 
                  className="text-blue-600 hover:text-blue-800 text-sm"
                  onClick={() => setShowDataEntryForm(!showDataEntryForm)}
                >
                  {showDataEntryForm ? 'Hide Form' : 'Add Data'}
                </button>
              </div>
              {showDataEntryForm && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Revenue ($)</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border rounded-md"
                      placeholder="e.g., 15000"
                      value={manualData.monthlyRevenue}
                      onChange={(e) => setManualData({...manualData, monthlyRevenue: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Booking Rate (%)</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border rounded-md"
                      placeholder="e.g., 25"
                      value={manualData.bookingRate}
                      onChange={(e) => setManualData({...manualData, bookingRate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Acquisition Cost ($)</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border rounded-md"
                      placeholder="e.g., 200"
                      value={manualData.customerAcquisitionCost}
                      onChange={(e) => setManualData({...manualData, customerAcquisitionCost: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Investments ($)</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border rounded-md"
                      placeholder="e.g., 500"
                      value={manualData.investments}
                      onChange={(e) => setManualData({...manualData, investments: e.target.value})}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Enhanced Alert System & Predictive Analytics Dashboard */}
      <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-lg text-red-800">Alerts & Warnings</CardTitle>
                <p className="text-sm text-red-600">Critical issues requiring attention</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-red-200">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <div className="font-semibold text-red-700">Security breach detected</div>
                <div className="text-sm text-red-600">Immediate action required</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-yellow-200">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
              <div>
                <div className="font-semibold text-yellow-700">Slow response warning</div>
                <div className="text-sm text-yellow-600">Customer satisfaction at risk</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-200">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div>
                <div className="font-semibold text-blue-700">Profile incomplete</div>
                <div className="text-sm text-blue-600">Update required</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-200">
              <ThumbsUp className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <div className="font-semibold text-green-700">Positive feedback trend</div>
                <div className="text-sm text-green-600">Great job team!</div>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Predictive Analytics */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg text-blue-800">Predictive Analytics</CardTitle>
                <p className="text-sm text-blue-600">AI-powered insights</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-lg border border-blue-200">
                <div className="text-sm text-blue-600 mb-1">Churn Risk</div>
                <div className="text-2xl font-bold text-red-600">15%</div>
                <div className="text-xs text-gray-500">Based on recent reviews</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-blue-200">
                <div className="text-sm text-blue-600 mb-1">Engagement</div>
                <div className="text-2xl font-bold text-blue-600">78/100</div>
                <div className="text-xs text-gray-500">Customer engagement score</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-lg border border-blue-200">
                <div className="text-sm text-blue-600 mb-1">Satisfaction</div>
                <div className="text-2xl font-bold text-green-600">+0.2</div>
                <div className="text-xs text-gray-500">30-day trend</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-blue-200">
                <div className="text-sm text-blue-600 mb-1">Support Needs</div>
                <div className="text-2xl font-bold text-yellow-600">Medium</div>
                <div className="text-xs text-gray-500">Current level</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Enhanced Unified Filter System */}
      <div className="mb-8 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-800">Advanced Filters</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSaveFilterModal(true)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Filter
            </button>
            <select
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg"
              onChange={(e) => {
                const preset = savedFilters.find(f => f.name === e.target.value);
                if (preset) loadFilterPreset(preset);
              }}
              value=""
            >
              <option value="">Load Saved Filter</option>
              {savedFilters.map(filter => (
                <option key={filter.name} value={filter.name}>{filter.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={ratingFilter} onChange={e => setRatingFilter(e.target.value)}>
              <option value="all">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}>
              <option value="all">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={jobTypeFilter} onChange={e => setJobTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {jobTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sentiment</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={sentimentFilter} onChange={e => setSentimentFilter(e.target.value)}>
              <option value="all">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={dateRange.start}
              onChange={e => setDateRange({...dateRange, start: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={dateRange.end}
              onChange={e => setDateRange({...dateRange, end: e.target.value})}
            />
          </div>
        </div>
        
        <div className="mt-4 flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search reviews, customers, employees..." 
            />
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => {
                setRatingFilter('all');
                setEmployeeFilter('all');
                setJobTypeFilter('all');
                setSearch('');
                setDateRange({start: '', end: ''});
                setSentimentFilter('all');
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>
      {/* Unified Performance Dashboard (conditionally render financial metrics) */}
      {financialTrackingEnabled && (
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg text-green-800">Business Performance</CardTitle>
                  <p className="text-sm text-green-600">Financial impact analysis</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <div className="text-sm text-green-600 mb-1">Review Score</div>
                  <div className="text-2xl font-bold text-green-700">{revenueImpact.reviewScore}</div>
                </div>
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <div className="text-sm text-green-600 mb-1">Avg Booking Rate</div>
                  <div className="text-2xl font-bold text-green-700">{(revenueImpact.avgBookingRate * 100).toFixed(1)}%</div>
                </div>
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <div className="text-sm text-green-600 mb-1">Revenue Change</div>
                  <div className="text-2xl font-bold text-green-700">${revenueImpact.revenueChange}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <LineChart className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg text-blue-800">Growth Trends</CardTitle>
                  <p className="text-sm text-blue-600">Monthly performance</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end h-32">
                {growth.months.map((month, i) => (
                  <div key={month} className="flex flex-col items-center flex-1">
                    <div className="w-full bg-blue-200 rounded-t-lg transition-all duration-300 hover:bg-blue-300" style={{height: `${(growth.reviewScores[i] / 5) * 100}%`}}></div>
                    <span className="text-xs mt-2 font-medium text-blue-700">{month}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-blue-600">Review scores: {growth.reviewScores.join(" → ")}</div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Enhanced Review List with Smart Actions */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Review List</h2>
              <p className="text-sm text-gray-600">
                {enhancedFilteredReviews.length} reviews found
                {selectedReviews.length > 0 && ` • ${selectedReviews.length} selected`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
        
        {/* Bulk Action Bar */}
        {selectedReviews.length > 0 && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-800">{selectedReviews.length} reviews selected</span>
              <button 
                className="text-sm text-blue-600 underline hover:text-blue-800" 
                onClick={() => setSelectedReviews([])}
              >
                Clear Selection
              </button>
            </div>
            <div className="flex gap-2">
              <button 
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                onClick={() => {
                  setBulkAction('export');
                  setShowBulkActionModal(true);
                }}
              >
                Export Selected
              </button>
              <button 
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                onClick={() => {
                  setBulkAction('flag');
                  setShowBulkActionModal(true);
                }}
              >
                Flag Selected
              </button>
            </div>
          </div>
        )}
        
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    <input 
                      type="checkbox" 
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedReviews(enhancedFilteredReviews.map(r => r.id));
                        } else {
                          setSelectedReviews([]);
                        }
                      }}
                      checked={selectedReviews.length === enhancedFilteredReviews.length && enhancedFilteredReviews.length > 0}
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Reviewer</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Rating</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Employee</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Job Type</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Review</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {enhancedFilteredReviews.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        checked={selectedReviews.includes(r.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedReviews([...selectedReviews, r.id]);
                          } else {
                            setSelectedReviews(selectedReviews.filter(id => id !== r.id));
                          }
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.reviewer}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{r.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-gray-900">{r.rating}</span>
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{employees.find(e => e.id === r.employeeId)?.name || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {r.jobType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      <button
                        onClick={() => {
                          setSelectedReview(r);
                          setShowReviewModal(true);
                        }}
                        className="text-left hover:text-blue-600 transition-colors"
                      >
                        {r.text}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <button
                          className="text-xs text-blue-600 underline hover:text-blue-800"
                          onClick={() => { setModalCustomer(r); setOpenCustomerModal(true); }}
                        >
                          View Customer
                        </button>
                        <button
                          className="text-xs text-green-600 underline hover:text-green-800"
                          onClick={() => alert('Note saved!')}
                        >
                          Save Note
                        </button>
                        <button
                          className="text-xs text-purple-600 underline hover:text-purple-800"
                          onClick={() => setCreatedTasks([...createdTasks, r.id])}
                        >
                          {createdTasks.includes(r.id) ? 'Task Created' : 'Create Task'}
                        </button>
                        <button
                          className="text-xs text-orange-600 underline hover:text-orange-800"
                          onClick={() => alert(`Contacting ${r.customerEmail}`)}
                        >
                          Contact Customer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Team Management & Accountability (Monthly Performance Reviews) */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 rounded-lg">
            <BarChart2 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Monthly Employee Performance Reviews</h2>
            <p className="text-sm text-gray-600">Detailed performance tracking and insights</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {employeePerformance.map(emp => (
            <Card key={emp.id} className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-4">
                  <img src={employees.find(e => e.id === emp.id)?.photo} alt={emp.name} className="w-12 h-12 rounded-full border-2 border-gray-200" />
                  <div className="flex-1">
                    <div className="font-bold text-lg text-gray-900">{emp.name}</div>
                    <div className="text-sm text-gray-500">{emp.role}</div>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        emp.performanceLevel === 'Exceeds Expectations' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {emp.performanceLevel}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{emp.avgRating}</div>
                    <div className="text-xs text-blue-600">Avg Rating</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{emp.completionRate}%</div>
                    <div className="text-xs text-green-600">Completion</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Response Time:</span>
                    <span className="font-semibold">{emp.responseTime}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Reviews:</span>
                    <span className="font-semibold">{emp.reviewCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Next Review:</span>
                    <span className="font-semibold">{emp.nextReviewDate}</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Strengths:</div>
                  <div className="text-sm text-green-700">{emp.strengths.join(", ")}</div>
                  <div className="text-sm font-semibold text-gray-700 mb-2 mt-3">Areas for Improvement:</div>
                  <div className="text-sm text-red-700">{emp.areasForImprovement.join(", ")}</div>
                  <div className="mt-3">
                    <button 
                      className="text-xs text-blue-600 underline hover:text-blue-800" 
                      onClick={() => { setModalEmp(emp); setOpenEmpModal(true); }}
                    >
                      View All Details
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      {/* Customer Recovery Tools */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-red-100 rounded-lg">
            <BarChart2 className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Customer Recovery Tools</h2>
            <p className="text-sm text-gray-600">Proactive customer retention strategies</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-red-800">Recovery Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recoveryActions.map(a => (
                <div key={a.id} className="p-4 bg-white rounded-lg border border-red-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold text-red-800">{a.action}</div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      a.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      a.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {a.status}
                    </span>
                  </div>
                  <div className="text-sm text-blue-600 mb-1">Customer: {a.customerName}</div>
                  <div className="text-xs text-gray-500">Due: {a.dueDate} | Priority: {a.priority}</div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-green-800">Recovery Analytics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-white rounded-lg border border-green-200">
                  <div className="text-3xl font-bold text-green-600">{recoveryAnalytics.overallSuccessRate}%</div>
                  <div className="text-sm text-green-600">Success Rate</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border border-green-200">
                  <div className="text-3xl font-bold text-green-600">{recoveryAnalytics.avgRatingImprovement}</div>
                  <div className="text-sm text-green-600">Rating Improvement</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-white rounded-lg border border-green-200">
                  <div className="text-3xl font-bold text-green-600">{recoveryAnalytics.customerRetentionRate}%</div>
                  <div className="text-sm text-green-600">Retention Rate</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border border-green-200">
                  <div className="text-3xl font-bold text-green-600">{recoveryAnalytics.totalRecovered}</div>
                  <div className="text-sm text-green-600">Total Recovered</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Customer Relationship Management */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 rounded-lg">
            <BarChart2 className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Customer Segments</h2>
            <p className="text-sm text-gray-600">Strategic customer categorization</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {customerSegments.map(seg => (
            <Card key={seg.segment} className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-purple-800 text-lg">{seg.segment}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center p-3 bg-white rounded-lg border border-purple-200">
                  <div className="text-3xl font-bold text-purple-600">{seg.count}</div>
                  <div className="text-sm text-purple-600">Customers</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-white rounded border border-purple-200">
                    <div className="text-lg font-bold text-purple-600">{seg.avgRating}</div>
                    <div className="text-xs text-purple-600">Avg Rating</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded border border-purple-200">
                    <div className="text-lg font-bold text-purple-600">{seg.avgReviews}</div>
                    <div className="text-xs text-purple-600">Avg Reviews</div>
                  </div>
                </div>
                <div className="text-xs text-purple-600 text-center">{seg.lastActivity}</div>
                <div className="text-xs text-gray-500 text-center">{seg.criteria}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      {/* Strategic Decision-Making Tools */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-orange-100 rounded-lg">
            <BarChart2 className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Service Performance</h2>
            <p className="text-sm text-gray-600">Data-driven service insights</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-orange-800">Service Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {servicePerformance.map(s => (
                <div key={s.service} className="p-4 bg-white rounded-lg border border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-orange-800">{s.service}</div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold">{s.avgRating}</span>
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">{s.reviewCount} reviews</div>
                  {s.hasFinancialData && s.revenue && (
                    <div className="text-sm font-semibold text-green-600">${s.revenue} revenue</div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-orange-800">Pricing Impact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pricingImpact.map(p => (
                <div key={p.priceRange} className="p-4 bg-white rounded-lg border border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-orange-800">{p.priceRange}</div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold">{p.avgRating}</span>
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    </div>
                  </div>
                  {p.hasFinancialData && p.bookingRate && (
                    <div className="text-sm font-semibold text-green-600">{(p.bookingRate * 100).toFixed(1)}% booking rate</div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Internal Notes & Task Management */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <BarChart2 className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Internal Notes & Tasks</h2>
            <p className="text-sm text-gray-600">Team collaboration tools</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl shadow-lg p-6">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-700 mb-2">Add notes or tasks to reviews</div>
            <div className="text-sm text-gray-500">Feature coming soon</div>
          </div>
        </div>
      </div>
      {/* Media Viewing (if any) */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-pink-100 rounded-lg">
            <BarChart2 className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Media Viewing</h2>
            <p className="text-sm text-gray-600">Review media content</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-pink-50 to-pink-100 border border-pink-200 rounded-xl shadow-lg p-6">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-700 mb-2">Media content for reviews</div>
            <div className="text-sm text-gray-500">Feature coming soon</div>
          </div>
        </div>
      </div>

        </>
      )}

      {/* Pending Approvals Tab Content */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          {/* Approvals Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Pending Approvals</h2>
              <p className="text-sm text-gray-600">
                {pendingApprovals.length} items awaiting your review
              </p>
            </div>
          </div>

          {/* Approvals List */}
          {pendingApprovals.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg mb-2">No pending approvals</div>
              <div className="text-gray-400 text-sm">All media has been reviewed</div>
            </div>
          ) : (
            <div className="grid gap-6">
              {pendingApprovals.map((approval) => (
                <Card key={approval.id} className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-red-800">{approval.jobTitle}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-4">
                      {/* Media Thumbnail */}
                      <div className="flex-shrink-0">
                        <div className="w-32 h-24 bg-gray-200 rounded-lg overflow-hidden">
                          <img 
                            src={approval.thumbnail} 
                            alt="Media thumbnail" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      
                      {/* Approval Details */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-gray-900">{approval.employee}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-sm text-gray-600">{approval.uploadedAt}</span>
                        </div>
                        <div className="text-sm text-gray-600 mb-3">
                          {approval.mediaType === 'video' ? 'Video Upload' : 'Photo Upload'}
                        </div>
                        <div className="text-sm text-red-700 font-medium mb-4">Status: Pending Approval</div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-3">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => openMediaViewer(approval)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            Review
                          </Button>
                          <Button 
                            size="sm" 
                            variant="default" 
                            onClick={() => handleApprove(approval.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleReject(approval.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}



      {/* Keyboard Shortcuts Help */}
      <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-3 rounded-lg shadow-lg opacity-0 hover:opacity-100 transition-opacity group">
        <div className="text-xs">
          <div className="font-semibold mb-1">Keyboard Shortcuts</div>
          <div>Ctrl+A: Select All</div>
          <div>Ctrl+E: Export</div>
          <div>Esc: Close Modals</div>
        </div>
      </div>

      {/* MODALS */}

      {/* Employee Performance Modal */}
      {openEmpModal && modalEmp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Employee Performance Details</h2>
                <button
                  onClick={() => setOpenEmpModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Performance Overview</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{modalEmp.avgRating}</div>
                      <div className="text-sm text-blue-600">Average Rating</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{modalEmp.completionRate}%</div>
                      <div className="text-sm text-green-600">Completion Rate</div>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{modalEmp.reviewCount}</div>
                      <div className="text-sm text-purple-600">Total Reviews</div>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Monthly Performance</h3>
                  <div className="space-y-2">
                    {modalEmp.monthlyPerformance.map(mp => (
                      <div key={mp.month} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{mp.month}</span>
                          <span className="text-sm text-gray-600">{mp.rating} stars</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {mp.reviews} reviews • {mp.responseTime} response • {mp.completion}% complete
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Strengths & Areas for Improvement</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-green-700 mb-2">Strengths</h4>
                    <ul className="space-y-1">
                      {modalEmp.strengths.map((strength, index) => (
                        <li key={index} className="text-sm text-green-600 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-700 mb-2">Areas for Improvement</h4>
                    <ul className="space-y-1">
                      {modalEmp.areasForImprovement.map((area, index) => (
                        <li key={index} className="text-sm text-red-600 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {area}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Information Modal */}
      {openCustomerModal && modalCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Customer Information</h2>
                <button
                  onClick={() => setOpenCustomerModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-600" />
                  <div>
                    <div className="font-semibold">{modalCustomer.reviewer}</div>
                    <div className="text-sm text-gray-600">Customer</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-600" />
                  <div>
                    <div className="font-semibold">{modalCustomer.customerEmail}</div>
                    <div className="text-sm text-gray-600">Email</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CalendarIcon className="w-5 h-5 text-gray-600" />
                  <div>
                    <div className="font-semibold">{modalCustomer.date}</div>
                    <div className="text-sm text-gray-600">Review Date</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-gray-600" />
                  <div>
                    <div className="font-semibold">{modalCustomer.rating} Stars</div>
                    <div className="text-sm text-gray-600">Rating</div>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="font-semibold mb-2">Review</h3>
                  <p className="text-gray-700">{modalCustomer.text}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Detail Modal */}
      {showReviewModal && selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Review Details</h2>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-4">Review Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Reviewer</label>
                      <div className="font-semibold">{selectedReview.reviewer}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Date</label>
                      <div className="font-semibold">{selectedReview.date}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Rating</label>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold">{selectedReview.rating}</span>
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Employee</label>
                      <div className="font-semibold">{employees.find(e => e.id === selectedReview.employeeId)?.name || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Job Type</label>
                      <div className="font-semibold">{selectedReview.jobType}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-4">Review Content</h3>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-700 leading-relaxed">{selectedReview.text}</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      Contact Customer
                    </button>
                    <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                      Save Note
                    </button>
                    <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                      Create Task
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Export Reviews</h2>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <div className="text-sm text-gray-600">
                  Exporting {enhancedFilteredReviews.length} reviews
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => exportReviews(exportFormat)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Export
                  </button>
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Filter Modal */}
      {showSaveFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Save Filter Preset</h2>
                <button
                  onClick={() => setShowSaveFilterModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={currentFilterName}
                    onChange={(e) => setCurrentFilterName(e.target.value)}
                    placeholder="Enter filter name..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={saveFilterPreset}
                    disabled={!currentFilterName.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowSaveFilterModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Confirmation Modal */}
      {showBulkActionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Confirm Bulk Action</h2>
                <button
                  onClick={() => setShowBulkActionModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-lg font-semibold mb-2">
                    {bulkAction === 'export' ? 'Export Selected Reviews' : 'Flag Selected Reviews'}
                  </div>
                  <div className="text-sm text-gray-600">
                    This action will affect {selectedReviews.length} reviews
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (bulkAction === 'export') {
                        exportReviews('csv');
                      } else {
                        alert('Reviews flagged successfully!');
                      }
                      setShowBulkActionModal(false);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowBulkActionModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {showApprovalConfirmation && pendingApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Confirm Approval</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-lg font-semibold mb-2">
                    Ready to deliver to customer?
                  </div>
                  <div className="text-sm text-gray-600 mb-4">
                    This content will be immediately sent to <strong>{pendingApproval.customerName}</strong> and the 72-hour review period will start when they open it.
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <div className="font-semibold mb-2">What happens next:</div>
                    <ul className="space-y-1 text-xs">
                      <li>• Customer receives notification with content link</li>
                      <li>• 72-hour countdown starts when they open the content</li>
                      <li>• Content moves to archive after customer review</li>
                      <li>• Customer can provide feedback within the time limit</li>
                    </ul>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button 
                    onClick={confirmApproval}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    Approve & Deliver
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={cancelApproval}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Media Viewer Modal */}
      {showMediaViewer && selectedMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Media Review</h2>
                <button
                  onClick={() => {
                    setShowMediaViewer(false);
                    setSelectedMedia(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">{selectedMedia.jobTitle}</h3>
                  <div className="text-sm text-gray-600 mb-4">
                    Uploaded by {selectedMedia.employee} on {selectedMedia.uploadedAt}
                  </div>
                </div>
                
                {/* Media Display */}
                <div className="bg-gray-100 rounded-lg p-4">
                  {selectedMedia.mediaType === 'video' ? (
                    <video 
                      controls 
                      className="w-full max-h-96 object-contain"
                      src={selectedMedia.url}
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <img 
                      src={selectedMedia.url} 
                      alt="Media content" 
                      className="w-full max-h-96 object-contain"
                    />
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="default" 
                    onClick={() => {
                      handleApprove(selectedMedia.id);
                      setShowMediaViewer(false);
                      setSelectedMedia(null);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      handleReject(selectedMedia.id);
                      setShowMediaViewer(false);
                      setSelectedMedia(null);
                    }}
                  >
                    Reject
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowMediaViewer(false);
                      setSelectedMedia(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 