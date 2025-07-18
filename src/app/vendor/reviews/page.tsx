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

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Star, ArrowUpRight, ArrowDownRight, AlertTriangle, Lightbulb, ThumbsUp, ThumbsDown, Info, BarChart2, LineChart, ArrowLeft, Settings, Upload, Download, Calendar, DollarSign, BarChart3, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import SimpleTooltip from '@/components/ui/tooltip';
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

// Team Management & Accountability mock data
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
    lastReview: "2024-05-15"
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
    lastReview: "2024-04-20"
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
    lastReview: "2024-05-10"
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
  // Filter state
  const [ratingFilter, setRatingFilter] = React.useState('all');
  const [employeeFilter, setEmployeeFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  // Filtered reviews with job type
  const filteredReviews = reviewFeed.filter(r =>
    (ratingFilter === 'all' || r.rating === Number(ratingFilter)) &&
    (employeeFilter === 'all' || r.employeeId === Number(employeeFilter)) &&
    (jobTypeFilter === 'all' || r.jobType === jobTypeFilter)
  );
  // Repeat issues (mocked)
  const repeatIssues = ['slow response'];
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

  return (
    <div className="p-8 space-y-8">
      {/* Back to Dashboard Button */}
      <div className="mb-4">
        <a href="/vendor" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 font-medium shadow-sm transition">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </a>
      </div>
      {/* Data Sources Configuration */}
      <div className="mb-8">
        <div className="bg-gray-50 border border-gray-200 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            Data Sources Configuration
            <SimpleTooltip content="Configure how you want to track your business data. You can enable financial tracking even if you don't use our platform for payments."><Info className="w-5 h-5 text-gray-500 cursor-pointer" /></SimpleTooltip>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Financial Tracking Toggle */}
            <div className="bg-white rounded-lg p-4 shadow border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="font-semibold">Financial Tracking</span>
                  <SimpleTooltip content="Enable this to see financial impact analysis and ROI calculations based on your review data."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></SimpleTooltip>
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
                <SimpleTooltip content="Choose how you want to provide your business data. Manual entry is available for all vendors."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></SimpleTooltip>
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
                  <SimpleTooltip content="Enter your business data manually. This will be used for financial impact calculations."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></SimpleTooltip>
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
                      placeholder="e.g., 45"
                      value={manualData.customerAcquisitionCost}
                      onChange={(e) => setManualData({...manualData, customerAcquisitionCost: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Investments ($)</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border rounded-md"
                      placeholder="e.g., 500"
                      value={manualData.investments}
                      onChange={(e) => setManualData({...manualData, investments: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                      Save Data
                    </button>
                    <button className="ml-2 text-gray-600 hover:text-gray-800">
                      Import from CSV
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data Status Indicator */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                {financialTrackingEnabled 
                  ? `Financial tracking enabled using ${dataSource} data source`
                  : 'Financial tracking disabled - showing review-only metrics'
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Business Performance Dashboard - Conditional */}
      {financialTrackingEnabled && (
        <div className="mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              Business Performance Dashboard
              <SimpleTooltip content="This dashboard shows how your reviews impact your business performance and growth. All metrics are visible only to managers."><Info className="w-5 h-5 text-blue-500 cursor-pointer" /></SimpleTooltip>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Revenue Impact */}
              <div className="bg-white rounded-lg p-4 shadow flex flex-col gap-2 border border-blue-100">
                <div className="flex items-center gap-2 font-semibold">
                  Revenue Impact
                  <SimpleTooltip content="Shows how your average review score affects your booking rate and revenue."><Info className="w-4 h-4 text-blue-400 cursor-pointer" /></SimpleTooltip>
                </div>
                <div className="text-2xl font-bold text-blue-700">${revenueImpact.revenueChange.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Review Score: <span className="font-semibold">{revenueImpact.reviewScore}</span></div>
                <div className="text-sm text-gray-600">Avg. Booking Rate: <span className="font-semibold">{(revenueImpact.avgBookingRate * 100).toFixed(1)}%</span></div>
                {dataSource === 'manual' && <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Manual Data</div>}
              </div>
              {/* Customer Acquisition Cost */}
              <div className="bg-white rounded-lg p-4 shadow flex flex-col gap-2 border border-blue-100">
                <div className="flex items-center gap-2 font-semibold">
                  Customer Acquisition Cost
                  <SimpleTooltip content="Shows your average cost to acquire a new customer and how reviews influence it."><Info className="w-4 h-4 text-blue-400 cursor-pointer" /></SimpleTooltip>
                </div>
                <div className="text-2xl font-bold text-blue-700">${customerAcquisition.avgCAC.toFixed(2)}</div>
                <div className="text-sm text-gray-600">Review Influence: <span className="font-semibold">{(customerAcquisition.reviewInfluence * 100).toFixed(1)}%</span></div>
                {dataSource === 'manual' && <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Manual Data</div>}
              </div>
              {/* Competitive Benchmarking */}
              <div className="bg-white rounded-lg p-4 shadow flex flex-col gap-2 border border-blue-100">
                <div className="flex items-center gap-2 font-semibold">
                  Competitive Benchmarking
                  <SimpleTooltip content="Compares your review score to the average of your local competitors."><Info className="w-4 h-4 text-blue-400 cursor-pointer" /></SimpleTooltip>
                </div>
                <div className="text-2xl font-bold text-blue-700">{benchmarking.yourScore} <span className="text-gray-500 text-base">/ {benchmarking.competitorAvg}</span></div>
                <div className="text-sm text-gray-600">Percentile: <span className="font-semibold">Top {benchmarking.percentile}%</span></div>
              </div>
              {/* Business Growth */}
              <div className="bg-white rounded-lg p-4 shadow flex flex-col gap-2 border border-blue-100">
                <div className="flex items-center gap-2 font-semibold">
                  Business Growth
                  <SimpleTooltip content="Shows your review score, bookings, and revenue growth over the last 5 months."><Info className="w-4 h-4 text-blue-400 cursor-pointer" /></SimpleTooltip>
                </div>
                <div className="text-sm text-gray-600">Review Scores: <span className="font-semibold">{growth.reviewScores.join(", ")}</span></div>
                <div className="text-sm text-gray-600">Bookings: <span className="font-semibold">{growth.bookings.join(", ")}</span></div>
                <div className="text-sm text-gray-600">Revenue: <span className="font-semibold">${growth.revenue[growth.revenue.length-1].toLocaleString()}</span></div>
                {dataSource === 'manual' && <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Manual Data</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Non-Financial Performance Overview - Always Visible */}
      <div className="mb-8">
        <div className="bg-purple-50 border border-purple-200 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            Review Performance Overview
            <SimpleTooltip content="Core review metrics that don't require financial data. Available to all vendors."><Info className="w-5 h-5 text-purple-500 cursor-pointer" /></SimpleTooltip>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Average Rating */}
            <div className="bg-white rounded-lg p-4 shadow flex flex-col gap-2 border border-purple-100">
              <div className="flex items-center gap-2 font-semibold">
                Average Rating
                <SimpleTooltip content="Your overall customer satisfaction score based on all reviews."><Info className="w-4 h-4 text-purple-400 cursor-pointer" /></SimpleTooltip>
              </div>
              <div className="flex items-center text-3xl font-bold">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-7 h-7 ${i < Math.floor(4.6) ? 'text-yellow-400' : 'text-gray-300'}`} fill={i < Math.round(4.6) ? '#facc15' : 'none'} />
                ))}
                <span className="ml-2 text-2xl text-gray-700">4.6</span>
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-semibold text-2xl text-purple-700">128</span> total reviews
              </div>
            </div>
            {/* Response Rate */}
            <div className="bg-white rounded-lg p-4 shadow flex flex-col gap-2 border border-purple-100">
              <div className="flex items-center gap-2 font-semibold">
                Response Rate
                <SimpleTooltip content="Percentage of reviews you've responded to within 24 hours."><Info className="w-4 h-4 text-purple-400 cursor-pointer" /></SimpleTooltip>
              </div>
              <div className="text-2xl font-bold text-purple-700">87%</div>
              <div className="text-sm text-gray-600">24-hour response target</div>
            </div>
            {/* Customer Satisfaction */}
            <div className="bg-white rounded-lg p-4 shadow flex flex-col gap-2 border border-purple-100">
              <div className="flex items-center gap-2 font-semibold">
                Customer Satisfaction
                <SimpleTooltip content="Percentage of customers who would recommend your services."><Info className="w-4 h-4 text-purple-400 cursor-pointer" /></SimpleTooltip>
              </div>
              <div className="text-2xl font-bold text-purple-700">94%</div>
              <div className="text-sm text-gray-600">Would recommend</div>
            </div>
            {/* Review Velocity */}
            <div className="bg-white rounded-lg p-4 shadow flex flex-col gap-2 border border-purple-100">
              <div className="flex items-center gap-2 font-semibold">
                Review Velocity
                <SimpleTooltip content="Average number of reviews received per month."><Info className="w-4 h-4 text-purple-400 cursor-pointer" /></SimpleTooltip>
              </div>
              <div className="text-2xl font-bold text-purple-700">21</div>
              <div className="text-sm text-gray-600">reviews/month</div>
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Decision-Making Tools */}
      <div className="mb-8">
        <div className="bg-green-50 border border-green-200 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            Strategic Decision-Making Tools
            <SimpleTooltip content="These tools help you make informed business decisions about services, pricing, and operations based on review data."><Info className="w-5 h-5 text-green-500 cursor-pointer" /></SimpleTooltip>
          </h2>
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
            <Info className="w-4 h-4 inline mr-2" />
            <strong>Note:</strong> Financial data is only available for services processed through our platform. Services with external billing will show "External billing" instead of dollar amounts.
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Service Performance Analysis */}
            <div className="bg-white rounded-lg p-4 shadow border border-green-100">
              <div className="flex items-center gap-2 font-semibold mb-3">
                Service Performance Analysis
                <SimpleTooltip content="Compare review scores and revenue across different services to identify your best and worst performing areas."><Info className="w-4 h-4 text-green-400 cursor-pointer" /></SimpleTooltip>
              </div>
              <div className="space-y-2">
                {servicePerformance.map((service, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium">{service.service}</div>
                      <div className="text-sm text-gray-600">{service.reviewCount} reviews</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">{service.avgRating} ★</div>
                      {service.hasFinancialData ? (
                        <div className="text-sm text-gray-600">${service.revenue.toLocaleString()}</div>
                      ) : (
                        <div className="text-sm text-gray-400 italic">External billing</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing Impact Analysis */}
            <div className="bg-white rounded-lg p-4 shadow border border-green-100">
              <div className="flex items-center gap-2 font-semibold mb-3">
                Pricing Impact Analysis
                <SimpleTooltip content="See how different price points affect your review scores and booking rates to optimize your pricing strategy."><Info className="w-4 h-4 text-green-400 cursor-pointer" /></SimpleTooltip>
              </div>
              <div className="space-y-2">
                {pricingImpact.map((price, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div className="font-medium">{price.priceRange}</div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">{price.avgRating} ★</div>
                      {price.hasFinancialData ? (
                        <div className="text-sm text-gray-600">{(price.bookingRate * 100).toFixed(1)}% bookings</div>
                      ) : (
                        <div className="text-sm text-gray-400 italic">External billing</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Geographic Performance */}
            <div className="bg-white rounded-lg p-4 shadow border border-green-100">
              <div className="flex items-center gap-2 font-semibold mb-3">
                Geographic Performance
                <SimpleTooltip content="Track review scores by service area to identify where you excel and where you need to improve."><Info className="w-4 h-4 text-green-400 cursor-pointer" /></SimpleTooltip>
              </div>
              <div className="space-y-2">
                {geographicPerformance.map((area, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div className="font-medium">{area.area}</div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">{area.avgRating} ★</div>
                      <div className="text-sm text-gray-600">{area.jobs} jobs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seasonal Trends */}
            <div className="bg-white rounded-lg p-4 shadow border border-green-100">
              <div className="flex items-center gap-2 font-semibold mb-3">
                Seasonal Trends
                <SimpleTooltip content="Identify seasonal patterns in review scores to plan staffing and marketing strategies."><Info className="w-4 h-4 text-green-400 cursor-pointer" /></SimpleTooltip>
              </div>
              <div className="space-y-2">
                {seasonalTrends.map((season, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div className="font-medium">{season.season}</div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">{season.avgRating} ★</div>
                      <div className="text-sm text-gray-600">{season.jobs} jobs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ROI of Improvements */}
          <div className="mt-6 bg-white rounded-lg p-4 shadow border border-green-100">
            <div className="flex items-center gap-2 font-semibold mb-3">
              ROI of Improvements
              <SimpleTooltip content="Track the return on investment for improvements made based on review feedback."><Info className="w-4 h-4 text-green-400 cursor-pointer" /></SimpleTooltip>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {roiImprovements.map((improvement, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded border">
                  <div className="font-medium text-green-700">{improvement.improvement}</div>
                  {improvement.hasFinancialData ? (
                    <>
                      <div className="text-sm text-gray-600">Investment: ${improvement.investment}</div>
                      <div className="text-sm text-gray-600">Revenue Increase: ${improvement.revenueIncrease}</div>
                      <div className="font-semibold text-green-600">ROI: {improvement.roi}%</div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-400 italic">External billing - financial data not available</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Team Management & Accountability */}
      <div className="mb-8">
        <div className="bg-orange-50 border border-orange-200 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            Team Management & Accountability
            <SimpleTooltip content="Manage employee performance, track training needs, and implement performance goals based on review data."><Info className="w-5 h-5 text-orange-500 cursor-pointer" /></SimpleTooltip>
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Employee Performance Reviews */}
            <div className="bg-white rounded-lg p-4 shadow border border-orange-100">
              <div className="flex items-center gap-2 font-semibold mb-3">
                Employee Performance Reviews
                <SimpleTooltip content="Track individual employee performance based on review scores and operational metrics."><Info className="w-4 h-4 text-orange-400 cursor-pointer" /></SimpleTooltip>
              </div>
              <div className="space-y-3">
                {employeePerformance.map((employee) => (
                  <div key={employee.id} className="p-3 bg-gray-50 rounded border">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{employee.name}</div>
                        <div className="text-sm text-gray-600">{employee.role}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-orange-600">{employee.avgRating} ★</div>
                        <div className="text-sm text-gray-600">{employee.reviewCount} reviews</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>Response: {employee.responseTime}</div>
                      <div>Completion: {employee.completionRate}%</div>
                      <div>Goal: {employee.performanceGoal} ★</div>
                      <div>Last Review: {employee.lastReview}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Training Needs Analysis */}
            <div className="bg-white rounded-lg p-4 shadow border border-orange-100">
              <div className="flex items-center gap-2 font-semibold mb-3">
                Training Needs Analysis
                <SimpleTooltip content="Identify training needs based on review patterns and employee performance gaps."><Info className="w-4 h-4 text-orange-400 cursor-pointer" /></SimpleTooltip>
              </div>
              <div className="space-y-3">
                {employeePerformance.map((employee) => (
                  <div key={employee.id} className="p-3 bg-gray-50 rounded border">
                    <div className="font-medium mb-2">{employee.name}</div>
                    <div className="space-y-1">
                      {employee.trainingNeeded.map((training, index) => (
                        <div key={index} className="text-sm text-red-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {training}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hiring Insights */}
            <div className="bg-white rounded-lg p-4 shadow border border-orange-100">
              <div className="flex items-center gap-2 font-semibold mb-3">
                Hiring Insights
                <SimpleTooltip content="Data-driven insights to inform hiring decisions and improve team performance."><Info className="w-4 h-4 text-orange-400 cursor-pointer" /></SimpleTooltip>
              </div>
              <div className="space-y-3">
                {hiringInsights.map((insight, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded border">
                    <div className="text-sm text-gray-700 mb-2">{insight.insight}</div>
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-500">Confidence</div>
                      <div className="text-xs font-semibold text-blue-600">{insight.confidence}%</div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div className="bg-blue-600 h-2 rounded-full" style={{width: `${insight.confidence}%`}}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Goals & Tracking */}
            <div className="bg-white rounded-lg p-4 shadow border border-orange-100">
              <div className="flex items-center gap-2 font-semibold mb-3">
                Performance Goals & Tracking
                <SimpleTooltip content="Set and track performance goals for individual employees and the team."><Info className="w-4 h-4 text-orange-400 cursor-pointer" /></SimpleTooltip>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded border">
                  <div className="font-medium text-orange-700">Team Average Goal</div>
                  <div className="text-2xl font-bold text-orange-600">4.6 ★</div>
                  <div className="text-sm text-gray-600">Current: 4.5 ★</div>
                  <div className="text-xs text-green-600 mt-1">+0.1 to goal</div>
                </div>
                <div className="p-3 bg-gray-50 rounded border">
                  <div className="font-medium text-orange-700">Response Time Goal</div>
                  <div className="text-2xl font-bold text-orange-600">1.5h</div>
                  <div className="text-sm text-gray-600">Current: 1.7h</div>
                  <div className="text-xs text-red-600 mt-1">-0.2h to goal</div>
                </div>
                <div className="p-3 bg-gray-50 rounded border">
                  <div className="font-medium text-orange-700">Completion Rate Goal</div>
                  <div className="text-2xl font-bold text-orange-600">95%</div>
                  <div className="text-sm text-gray-600">Current: 95%</div>
                  <div className="text-xs text-green-600 mt-1">Goal achieved!</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Relationship Management */}
      <div className="mb-8">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            Customer Relationship Management
            <SimpleTooltip content="Manage customer relationships, track lifetime value, and implement recovery strategies based on review data."><Info className="w-5 h-5 text-indigo-500 cursor-pointer" /></SimpleTooltip>
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Lifetime Value */}
            <div className="bg-white rounded-lg p-4 shadow border border-indigo-100">
              <div className="flex items-center gap-2 font-semibold mb-3">
                Customer Engagement Analysis
                <SimpleTooltip content="Track customer engagement and identify VIP customers based on review behavior and activity patterns."><Info className="w-4 h-4 text-indigo-400 cursor-pointer" /></SimpleTooltip>
              </div>
              <div className="space-y-3">
                {customerInsights.map((customer) => (
                  <div key={customer.id} className="p-3 bg-gray-50 rounded border">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-gray-600">{customer.email}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-indigo-600">{customer.engagementScore}%</div>
                        <div className="text-sm text-gray-600">{customer.totalJobs} jobs</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>Rating: {customer.avgRating} ★</div>
                      <div>Status: <span className={`px-2 py-1 rounded text-xs ${
                        customer.status === 'VIP' ? 'bg-green-100 text-green-700' :
                        customer.status === 'At Risk' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{customer.status}</span></div>
                      <div>Reviews: {customer.totalReviews}</div>
                      <div>Risk: <span className={`px-2 py-1 rounded text-xs ${
                        customer.riskLevel === 'Low' ? 'bg-green-100 text-green-700' :
                        customer.riskLevel === 'High' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{customer.riskLevel}</span></div>
                      <div>Last Job: {customer.lastJob}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Segmentation */}
            <div className="bg-white rounded-lg p-4 shadow border border-indigo-100">
              <div className="flex items-center gap-2 font-semibold mb-3">
                Customer Segmentation
                <SimpleTooltip content="View customers by segments based on review behavior and engagement patterns, not financial data."><Info className="w-4 h-4 text-indigo-400 cursor-pointer" /></SimpleTooltip>
              </div>
              
              {/* Categorization Rules */}
              <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                <div className="font-medium text-blue-800 mb-2">Categorization Rules</div>
                <div className="text-sm text-blue-700 space-y-1">
                  <div>• <strong>VIP:</strong> 5+ reviews, 4.5+ avg rating, active in last 3 months</div>
                  <div>• <strong>Regular:</strong> 2-4 reviews, 4.0+ avg rating, active in last 6 months</div>
                  <div>• <strong>At Risk:</strong> Below 4.0 avg rating OR no activity in 6+ months</div>
                  <div>• <strong>New:</strong> 1-2 reviews, joined in last 3 months</div>
                </div>
              </div>
              
              <div className="space-y-3">
                {customerSegments.map((segment, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded border">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium">{segment.segment}</div>
                      <div className="text-sm font-semibold text-indigo-600">{segment.count} customers</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                      <div>Avg Rating: {segment.avgRating} ★</div>
                      <div>Avg Reviews: {segment.avgReviews}</div>
                      <div>Last Activity: {segment.lastActivity}</div>
                    </div>
                    <div className="text-xs text-gray-500 italic">{segment.criteria}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Recovery Tools */}
            <div className="bg-white rounded-lg p-4 shadow border border-indigo-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 font-semibold">
                  Customer Recovery Tools
                  <SimpleTooltip content="Track and manage recovery actions for customers at risk of churning."><Info className="w-4 h-4 text-indigo-400 cursor-pointer" /></SimpleTooltip>
                </div>
                <div className="flex gap-2">
                  <select 
                    value={priorityFilter} 
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="All">All Priorities</option>
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                  <select 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="All">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              
              {/* Automated Triggers Section */}
              <div className="mb-4 p-3 bg-green-50 rounded border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-green-800">Automated Triggers</div>
                  <button 
                    onClick={() => setShowTriggersModal(true)}
                    className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                  >
                    Configure Rules
                  </button>
                </div>
                <div className="space-y-2">
                  {autoTriggers.map((trigger) => (
                    <div key={trigger.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium">{trigger.name}</span>
                        <span className="text-gray-600 ml-2">({trigger.condition})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded ${
                          trigger.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{trigger.priority}</span>
                        <span className="text-gray-500">Last: {trigger.lastTriggered}</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={trigger.enabled} />
                          <div className="w-6 h-3 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0px] after:left-[0px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-3 mb-4">
                {recoveryActions
                  .filter(action => 
                    (priorityFilter === 'All' || action.priority === priorityFilter) &&
                    (statusFilter === 'All' || action.status === statusFilter)
                  )
                  .slice(0, 3)
                  .map((action) => (
                  <div key={action.id} className="p-3 bg-gray-50 rounded border">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-indigo-700">{action.action}</div>
                        <div className="text-sm text-gray-700">{action.customerName} ({action.customerEmail})</div>
                        <div className="text-xs text-gray-600 mt-1">{action.reason}</div>
                      </div>
                      <div className="text-right ml-4">
                        <div className={`text-xs px-2 py-1 rounded mb-1 ${
                          action.priority === 'High' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{action.priority}</div>
                        <div className={`text-xs px-2 py-1 rounded ${
                          action.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          action.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{action.status}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                      <div>Assigned to: {action.assignedTo}</div>
                      <div>Due: {action.dueDate}</div>
                    </div>
                    <div className="text-xs text-gray-500 italic mb-2">{action.template}</div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setSelectedAction(action);
                          setShowStatusUpdateModal(true);
                        }}
                        className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                      >
                        Update Status
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedAction(action);
                          // Mark as complete logic would go here
                          alert(`Marked "${action.action}" for ${action.customerName} as complete!`);
                        }}
                        className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                      >
                        Mark Complete
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedAction(action);
                          setShowEmailModal(true);
                        }}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      >
                        Send Email
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedAction(action);
                          setShowSMSModal(true);
                        }}
                        className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700"
                      >
                        Send SMS
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedCustomer(customerInsights.find(c => c.email === action.customerEmail));
                          setShowCustomerModal(true);
                        }}
                        className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700"
                      >
                        View Customer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Recovery Success Analytics */}
              <div className="border-t pt-3 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Recovery Success Analytics</span>
                  <button 
                    onClick={() => setShowDetailedReport(true)}
                    className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                  >
                    View Detailed Report
                  </button>
                </div>
                
                {/* Overall Metrics */}
                <div className="grid grid-cols-4 gap-4 text-xs mb-3">
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="font-semibold text-green-700">{recoveryAnalytics.overallSuccessRate}%</div>
                    <div className="text-gray-600">Success Rate</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <div className="font-semibold text-blue-700">+{recoveryAnalytics.avgRatingImprovement}</div>
                    <div className="text-gray-600">Avg Rating Improvement</div>
                  </div>
                  <div className="text-center p-2 bg-purple-50 rounded">
                    <div className="font-semibold text-purple-700">{recoveryAnalytics.customerRetentionRate}%</div>
                    <div className="text-gray-600">Retention Rate</div>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded">
                    <div className="font-semibold text-orange-700">{recoveryAnalytics.avgResponseTime}</div>
                    <div className="text-gray-600">Avg Response Time</div>
                  </div>
                </div>
                
                {/* Success by Method */}
                <div className="mb-3">
                  <div className="text-xs font-medium mb-2">Success by Recovery Method:</div>
                  <div className="space-y-1">
                    {recoveryAnalytics.byMethod.map((method, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <span>{method.method}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">{method.successRate}%</span>
                          <span className="text-blue-600">+{method.avgImprovement} rating</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Employee Performance */}
                <div>
                  <div className="text-xs font-medium mb-2">Employee Performance:</div>
                  <div className="space-y-1">
                    {recoveryAnalytics.byEmployee.map((emp, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <span>{emp.employee}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">{emp.successRate}%</span>
                          <span className="text-gray-600">({emp.actionsCompleted} actions)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="border-t pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">Quick Actions:</span>
                  <button 
                    onClick={() => setShowRecoveryModal(true)}
                    className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                  >
                    Create Recovery Action
                  </button>
                  <button 
                    onClick={() => setShowAllActions(true)}
                    className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                  >
                    View All Actions ({recoveryActions.length})
                  </button>
                  <button 
                    onClick={() => setShowTemplatesModal(true)}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  >
                    Recovery Templates
                  </button>
                  <button 
                    onClick={() => setShowTriggersModal(true)}
                    className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700"
                  >
                    Auto-Trigger Rules
                  </button>
                </div>
              </div>
            </div>


          </div>


        </div>
      </div>

      {/* Review Feed */}
      <Card className="shadow-lg rounded-xl border border-gray-200 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <BarChart2 className="w-6 h-6 text-blue-600" /> Review Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Average Rating by Month Bar Chart */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-sm">
            <div className="flex flex-col items-center mb-4">
              <div className="flex items-center gap-2 font-semibold text-lg">
                <BarChart2 className="w-5 h-5 text-blue-600" />
                <span>Average Rating by Month</span>
                <SimpleTooltip content="Shows the average review rating for each month. Helps track performance trends over time."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></SimpleTooltip>
              </div>
            </div>
            <div className="flex gap-8 items-end h-40 w-full">
              {trendsData.map((d, i) => (
                <div key={d.month} className="flex flex-col items-center w-16">
                  <div className="rounded-t w-10 shadow-md" style={{ height: `${d.avg * 30}px`, background: '#3b82f6' }}></div>
                  <span className="text-xs mt-2 font-semibold text-gray-700">{d.month}</span>
                  <span className="text-xs text-blue-700 font-bold">{d.avg.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Employee Comparison Bar Chart */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-sm">
            <div className="flex flex-col items-center mb-4">
              <div className="flex items-center gap-2 font-semibold text-lg">
                <BarChart2 className="w-5 h-5 text-blue-600" />
                <span>Employee Rating Comparison</span>
                <SimpleTooltip content="Compares the average review rating for each employee. Helps identify top and low performers."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></SimpleTooltip>
              </div>
            </div>
            <div className="flex gap-8 items-end h-40 w-full">
              {employeeComparison.map((e, i) => (
                <div key={e.name} className="flex flex-col items-center w-24">
                  <div className="rounded-t w-10 shadow-md" style={{ height: `${e.avg * 30}px`, background: '#60a5fa' }}></div>
                  <span className="text-xs mt-2 font-semibold text-gray-700">{e.name}</span>
                  <span className="text-xs text-blue-700 font-bold">{e.avg.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Repeat Issues */}
          {repeatIssues.length > 0 && (
            <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-red-700 font-semibold flex items-center gap-1">
                Repeat issues
                <SimpleTooltip content="These are recurring negative comments from recent reviews. Addressing them can improve your ratings."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></SimpleTooltip>:
              </span>
              {repeatIssues.map((issue, idx) => (
                <span key={idx} className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs ml-1">{issue}</span>
              ))}
            </div>
          )}
          {/* Sticky Search Bar and Filters */}
          <div className="mb-4 flex flex-wrap gap-4 items-center sticky top-0 bg-white z-10 py-2 border-b">
            <input
              type="text"
              className="border rounded px-3 py-1 w-64"
              placeholder="Search reviews..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <label className="text-sm">Filter by rating:
              <select className="ml-2 border rounded px-2 py-1 pr-6" value={ratingFilter} onChange={e => setRatingFilter(e.target.value)}>
                <option value="all">All</option>
                {[5,4,3,2,1].map(r => <option key={r} value={r}>{r}★</option>)}
              </select>
            </label>
            <label className="text-sm">Filter by employee:
              <select className="ml-2 border rounded px-2 py-1 pr-6" value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}>
                <option value="all">All</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </label>
            <label className="text-sm">Filter by job type:
              <select className="ml-2 border rounded px-2 py-1 pr-6" value={jobTypeFilter} onChange={e => setJobTypeFilter(e.target.value)}>
                <option value="all">All</option>
                {jobTypes.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </label>
            {/* Bulk Action Bar */}
            {selectedReviews.length > 0 && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded px-3 py-1 ml-4">
                <span className="text-blue-700 font-semibold">{selectedReviews.length} selected</span>
                <button className="text-xs text-blue-600 underline" onClick={() => setSelectedReviews([])}>Clear</button>
                <button className="text-xs text-green-600 underline" onClick={() => alert('Exported!')}>Export</button>
                <button className="text-xs text-red-600 underline" onClick={() => alert('Flagged!')}>Flag</button>
              </div>
            )}
          </div>
          {/* Review List */}
          <div className="space-y-4">
            {filteredReviews.length === 0 ? (
              <div className="text-gray-500 flex flex-col items-center py-8">
                <span className="text-2xl mb-2">📝</span>
                <span>No reviews found for selected filters or search.</span>
              </div>
            ) : (
              filteredReviews
                .filter(r => search === '' || r.text.toLowerCase().includes(search.toLowerCase()))
                .map(r => {
                  const emp = employees.find(e => e.id === r.employeeId);
                  const isSelected = selectedReviews.includes(r.id);
                  const customerReviews = reviewFeed.filter(rev => rev.reviewer === r.reviewer);
                  return (
                    <div key={r.id} className="border rounded p-4 bg-white shadow-sm flex flex-col md:flex-row md:items-center md:gap-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => {
                          setSelectedReviews(prev => e.target.checked ? [...prev, r.id] : prev.filter(id => id !== r.id));
                        }}
                        className="mr-2 accent-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <button
                            className="font-semibold text-blue-700 hover:underline"
                            onClick={() => { setModalCustomer(r); setOpenCustomerModal(true); }}
                          >
                            {r.reviewer}
                          </button>
                          <span className="text-xs text-gray-400 ml-2">{r.date}</span>
                          <span className="ml-4 flex items-center text-yellow-600 font-bold">
                            {Array.from({ length: r.rating }).map((_, i) => <Star className="w-4 h-4" key={i} fill="#facc15" />)}
                          </span>
                          <span className="ml-4 text-xs text-gray-500">{r.jobType}</span>
                        </div>
                        <div className="text-gray-700 mb-1">{r.text}</div>
                        {emp && <div className="text-xs text-gray-500">Employee: {emp.name}</div>}
                        {/* Internal Notes */}
                        <div className="mt-2 flex flex-col md:flex-row md:items-center md:gap-2">
                          <input
                            type="text"
                            className="border rounded px-2 py-1 text-xs w-full md:w-64"
                            placeholder="Add internal note..."
                            value={internalNotes[r.id] || ''}
                            onChange={e => setInternalNotes({ ...internalNotes, [r.id]: e.target.value })}
                          />
                          <button
                            className="text-xs text-green-600 underline mt-1 md:mt-0"
                            onClick={() => alert('Note saved!')}
                          >Save Note</button>
                          <button
                            className="text-xs text-purple-600 underline mt-1 md:mt-0"
                            onClick={() => setCreatedTasks([...createdTasks, r.id])}
                            disabled={createdTasks.includes(r.id)}
                          >{createdTasks.includes(r.id) ? 'Task Created' : 'Create Task'}</button>
                          {r.customerEmail && (
                            <button
                              className="text-xs text-blue-600 underline mt-1 md:mt-0"
                              onClick={() => alert(`Contacting ${r.customerEmail}`)}
                            >Contact Customer</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
          {/* Customer History Modal */}
          <Dialog open={openCustomerModal} onOpenChange={setOpenCustomerModal}>
            <DialogContent className="max-w-md">
              <DialogTitle>All Reviews from {modalCustomer?.reviewer}</DialogTitle>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                {modalCustomer && reviewFeed.filter(rev => rev.reviewer === modalCustomer.reviewer).map((rev, idx) => (
                  <li key={idx} className="text-gray-700 flex flex-col gap-1">
                    <span>{rev.text}</span>
                    <span className="text-xs text-gray-400">{rev.date}</span>
                    <span className="flex items-center text-yellow-500">{Array.from({ length: rev.rating }).map((_, i) => <Star className="w-3 h-3" key={i} fill="#facc15" />)}</span>
                  </li>
                ))}
              </ul>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Customer Recovery Tools Modals */}
      
      {/* Create Recovery Action Modal */}
      <Dialog open={showRecoveryModal} onOpenChange={setShowRecoveryModal}>
        <DialogContent className="max-w-md">
          <DialogTitle>Create Recovery Action</DialogTitle>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Customer</label>
              <div className="relative">
                <input 
                  type="text" 
                  className="w-full border rounded px-3 py-2 pr-8" 
                  placeholder="Search by name, email, or phone..."
                  onChange={(e) => {
                    // Filter customers based on search input
                    const searchTerm = e.target.value.toLowerCase();
                    // This would filter customerInsights based on name, email, or phone
                  }}
                />
                <Search className="absolute right-2 top-2.5 w-4 h-4 text-gray-400" />
              </div>
              <div className="mt-1 max-h-32 overflow-y-auto border rounded">
                {customerInsights.map(customer => (
                  <div 
                    key={customer.id} 
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                    onClick={() => {
                      // Handle customer selection
                    }}
                  >
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-gray-600 text-xs">{customer.email} • {customer.phone || 'No phone'}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Action Type</label>
              <select className="w-full border rounded px-3 py-2">
                <option>Follow-up call</option>
                <option>Discount offer</option>
                <option>VIP check-in</option>
                <option>Service improvement</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Assigned To 
                <span className="text-gray-500 text-xs ml-1">(Optional)</span>
              </label>
              <select className="w-full border rounded px-3 py-2">
                <option value="">I'll handle this myself</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} - {emp.role}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Leave as "I'll handle this myself" if you want to manage the recovery personally
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Due Date</label>
              <input type="date" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea className="w-full border rounded px-3 py-2" rows={3} placeholder="Add notes..."></textarea>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  alert('Recovery action created successfully!');
                  setShowRecoveryModal(false);
                }}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Create Action
              </button>
              <button 
                onClick={() => setShowRecoveryModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recovery Templates Modal */}
      <Dialog open={showTemplatesModal} onOpenChange={setShowTemplatesModal}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Recovery Templates</DialogTitle>
          <div className="space-y-4">
            {recoveryTemplates.map((template, index) => (
              <div key={index} className="p-3 border rounded">
                <div className="font-medium mb-2">{template.name}</div>
                <div className="text-sm text-gray-600 mb-2">{template.template}</div>
                <div className="flex gap-2">
                  <button className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">
                    Use Template
                  </button>
                  <button className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700">
                    Edit
                  </button>
                </div>
              </div>
            ))}
            <button 
              onClick={() => {
                alert('New template created!');
                setShowTemplatesModal(false);
              }}
              className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Create New Template
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auto-Trigger Rules Modal */}
      <Dialog open={showTriggersModal} onOpenChange={setShowTriggersModal}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Auto-Trigger Rules</DialogTitle>
          <div className="space-y-4">
            {autoTriggers.map((trigger) => (
              <div key={trigger.id} className="p-3 border rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{trigger.name}</div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked={trigger.enabled} />
                    <div className="w-6 h-3 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0px] after:left-[0px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
                <div className="text-sm text-gray-600 mb-2">Condition: {trigger.condition}</div>
                <div className="text-sm text-gray-600 mb-2">Action: {trigger.action}</div>
                <div className="text-sm text-gray-600">Last Triggered: {trigger.lastTriggered}</div>
              </div>
            ))}
            <button 
              onClick={() => {
                alert('New trigger rule created!');
                setShowTriggersModal(false);
              }}
              className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Create New Rule
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detailed Report Modal */}
      <Dialog open={showDetailedReport} onOpenChange={setShowDetailedReport}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogTitle>Recovery Success Analytics - Detailed Report</DialogTitle>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-700">{recoveryAnalytics.overallSuccessRate}%</div>
                <div className="text-sm text-gray-600">Overall Success Rate</div>
              </div>
              <div className="p-4 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-700">+{recoveryAnalytics.avgRatingImprovement}</div>
                <div className="text-sm text-gray-600">Average Rating Improvement</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-3">Success by Recovery Method</h3>
              <div className="space-y-2">
                {recoveryAnalytics.byMethod.map((method, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="font-medium">{method.method}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-green-600 font-semibold">{method.successRate}% success</span>
                      <span className="text-blue-600">+{method.avgImprovement} rating improvement</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-3">Employee Performance</h3>
              <div className="space-y-2">
                {recoveryAnalytics.byEmployee.map((emp, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="font-medium">{emp.employee}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-green-600 font-semibold">{emp.successRate}% success</span>
                      <span className="text-gray-600">({emp.actionsCompleted} actions completed)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View All Actions Modal */}
      <Dialog open={showAllActions} onOpenChange={setShowAllActions}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogTitle>All Recovery Actions</DialogTitle>
          <div className="space-y-3">
            {recoveryActions.map((action) => (
              <div key={action.id} className="p-3 border rounded">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-indigo-700">{action.action}</div>
                    <div className="text-sm text-gray-700">{action.customerName} ({action.customerEmail})</div>
                    <div className="text-xs text-gray-600 mt-1">{action.reason}</div>
                  </div>
                  <div className="text-right ml-4">
                    <div className={`text-xs px-2 py-1 rounded mb-1 ${
                      action.priority === 'High' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{action.priority}</div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      action.status === 'Completed' ? 'bg-green-100 text-green-700' :
                      action.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{action.status}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                  <div>Assigned to: {action.assignedTo}</div>
                  <div>Due: {action.dueDate}</div>
                </div>
                <div className="text-xs text-gray-500 italic mb-2">{action.template}</div>
                <div className="flex gap-2">
                  <button className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">
                    Update Status
                  </button>
                  <button className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
                    Mark Complete
                  </button>
                  <button className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">
                    Send Email
                  </button>
                  <button className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700">
                    Send SMS
                  </button>
                  <button className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700">
                    View Customer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Update Modal */}
      <Dialog open={showStatusUpdateModal} onOpenChange={setShowStatusUpdateModal}>
        <DialogContent className="max-w-md">
          <DialogTitle>Update Action Status</DialogTitle>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Action</label>
              <div className="text-sm text-gray-600">{selectedAction?.action} for {selectedAction?.customerName}</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New Status</label>
              <select className="w-full border rounded px-3 py-2">
                <option>Pending</option>
                <option>In Progress</option>
                <option>Completed</option>
                <option>Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea className="w-full border rounded px-3 py-2" rows={3} placeholder="Add status update notes..."></textarea>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  alert('Status updated successfully!');
                  setShowStatusUpdateModal(false);
                }}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Update Status
              </button>
              <button 
                onClick={() => setShowStatusUpdateModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-md">
          <DialogTitle>Send Email</DialogTitle>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">To</label>
              <div className="text-sm text-gray-600">{selectedAction?.customerEmail}</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <input type="text" className="w-full border rounded px-3 py-2" placeholder="Email subject..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea className="w-full border rounded px-3 py-2" rows={6} placeholder="Email message..."></textarea>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  alert('Email sent successfully!');
                  setShowEmailModal(false);
                }}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Send Email
              </button>
              <button 
                onClick={() => setShowEmailModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SMS Modal */}
      <Dialog open={showSMSModal} onOpenChange={setShowSMSModal}>
        <DialogContent className="max-w-md">
          <DialogTitle>Send SMS</DialogTitle>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">To</label>
              <div className="text-sm text-gray-600">{selectedAction?.customerName}</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea className="w-full border rounded px-3 py-2" rows={4} placeholder="SMS message..."></textarea>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  alert('SMS sent successfully!');
                  setShowSMSModal(false);
                }}
                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              >
                Send SMS
              </button>
              <button 
                onClick={() => setShowSMSModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Details Modal */}
      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent className="max-w-md">
          <DialogTitle>Customer Details</DialogTitle>
          {selectedCustomer && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <div className="text-sm text-gray-600">{selectedCustomer.name}</div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <div className="text-sm text-gray-600">{selectedCustomer.email}</div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <div className="text-sm text-gray-600">{selectedCustomer.phone}</div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Total Jobs</label>
                <div className="text-sm text-gray-600">{selectedCustomer.totalJobs}</div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Total Reviews</label>
                <div className="text-sm text-gray-600">{selectedCustomer.totalReviews}</div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Average Rating</label>
                <div className="text-sm text-gray-600">{selectedCustomer.avgRating} ★</div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <div className="text-sm text-gray-600">{selectedCustomer.status}</div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Risk Level</label>
                <div className="text-sm text-gray-600">{selectedCustomer.riskLevel}</div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Engagement Score</label>
                <div className="text-sm text-gray-600">{selectedCustomer.engagementScore}%</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 