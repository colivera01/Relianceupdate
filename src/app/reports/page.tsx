"use client";
import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";

const TIME_RANGES = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 90 Days", value: "90d" },
  { label: "Custom", value: "custom" },
];

// Mock data for KPIs
const kpis = {
  totalUsers: 1200,
  totalVendors: 85,
  mrr: 4200,
  arr: 50400,
  churnRate: 2.1,
  ltv: 320,
  cac: 45,
  activeUsers: 900,
  payingUsers: 300,
  jobsCompleted: 3400,
  reviewsGenerated: 1200,
  vendorsOnline: 19,
  flaggedReviews: 8,
  autoReviews: 32,
  avgResponse: 2.3,
  avgCompletion: 5.8,
};
// Mock growth data
const userGrowth = [
  { date: "Jan", count: 100 },
  { date: "Feb", count: 120 },
  { date: "Mar", count: 140 },
  { date: "Apr", count: 180 },
  { date: "May", count: 210 },
  { date: "Jun", count: 250 },
];
const vendorGrowth = [
  { date: "Jan", count: 8 },
  { date: "Feb", count: 10 },
  { date: "Mar", count: 12 },
  { date: "Apr", count: 15 },
  { date: "May", count: 18 },
  { date: "Jun", count: 22 },
];
const churnData = [
  { date: "Jan", churned: 2, closed: 1 },
  { date: "Feb", churned: 3, closed: 2 },
  { date: "Mar", churned: 4, closed: 2 },
  { date: "Apr", churned: 2, closed: 1 },
  { date: "May", churned: 5, closed: 3 },
  { date: "Jun", churned: 3, closed: 2 },
];
const cohortData = [
  { cohortMonth: "Jan", retained: 80, total: 100 },
  { cohortMonth: "Feb", retained: 90, total: 120 },
  { cohortMonth: "Mar", retained: 110, total: 140 },
  { cohortMonth: "Apr", retained: 150, total: 180 },
  { cohortMonth: "May", retained: 180, total: 210 },
  { cohortMonth: "Jun", retained: 220, total: 250 },
];
const geoReviews = [
  { region: "NY", reviews: 320, jobs: 900 },
  { region: "CA", reviews: 210, jobs: 700 },
  { region: "TX", reviews: 180, jobs: 600 },
  { region: "FL", reviews: 120, jobs: 400 },
];
const topVendors = [
  { name: "Sparkle Cleaners", jobs: 440, reviews: 120, avgRating: 4.8 },
  { name: "Bright Electric", jobs: 380, reviews: 110, avgRating: 4.7 },
  { name: "Reliable Plumbers", jobs: 320, reviews: 100, avgRating: 4.6 },
];
const engagement = [
  { name: "Sparkle Cleaners", reviews: 120, jobs: 440, avgRating: 4.8 },
  { name: "Bright Electric", reviews: 110, jobs: 380, avgRating: 4.7 },
  { name: "Reliable Plumbers", reviews: 100, jobs: 320, avgRating: 4.6 },
];
const funnel = { registered: 1200, firstJob: 900, firstReview: 700, repeatUsers: 500 };
const forecast = [
  { date: "Jul", predicted: 270 },
  { date: "Aug", predicted: 300 },
  { date: "Sep", predicted: 340 },
];
const anomalies = [
  { date: "May", metric: "users", value: 210, expected: 180, anomalyScore: 0.8 },
  { date: "Jun", metric: "jobs", value: 250, expected: 220, anomalyScore: 0.7 },
];

export default function ReportsAnalytics() {
  const [timeRange, setTimeRange] = useState("30d");
  // TODO: Wire up filters to backend data

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h2 className="text-3xl font-bold">Reports & Analytics</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-48">{TIME_RANGES.find(t => t.value === timeRange)?.label}</SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card><CardHeader><CardTitle>Total Users</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.totalUsers}</CardContent></Card>
        <Card><CardHeader><CardTitle>Total Vendors</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.totalVendors}</CardContent></Card>
        <Card><CardHeader><CardTitle>MRR</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${kpis.mrr}</CardContent></Card>
        <Card><CardHeader><CardTitle>ARR</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${kpis.arr}</CardContent></Card>
        <Card><CardHeader><CardTitle>Churn Rate</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.churnRate}%</CardContent></Card>
        <Card><CardHeader><CardTitle>LTV</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${kpis.ltv}</CardContent></Card>
        <Card><CardHeader><CardTitle>CAC</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${kpis.cac}</CardContent></Card>
        <Card><CardHeader><CardTitle>Active Users</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.activeUsers}</CardContent></Card>
        <Card><CardHeader><CardTitle>Paying Users</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.payingUsers}</CardContent></Card>
        <Card><CardHeader><CardTitle>Jobs Completed</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.jobsCompleted}</CardContent></Card>
        <Card><CardHeader><CardTitle>Reviews Generated</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.reviewsGenerated}</CardContent></Card>
        <Card><CardHeader><CardTitle>Vendors Online</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.vendorsOnline}</CardContent></Card>
        <Card><CardHeader><CardTitle>Flagged Reviews</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.flaggedReviews}</CardContent></Card>
        <Card><CardHeader><CardTitle>Auto-Reviews</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.autoReviews}</CardContent></Card>
        <Card><CardHeader><CardTitle>Avg Response Time</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.avgResponse} hrs</CardContent></Card>
        <Card><CardHeader><CardTitle>Avg Completion Time</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.avgCompletion} hrs</CardContent></Card>
      </div>
      {/* Growth & Churn Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card><CardHeader><CardTitle>User Growth</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><LineChart data={userGrowth}><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={3} /><ChartTooltip /></LineChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>Vendor Growth</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><LineChart data={vendorGrowth}><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={3} /><ChartTooltip /></LineChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>Churn/Closures</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><AreaChart data={churnData}><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Area type="monotone" dataKey="churned" stackId="1" stroke="#ef4444" fill="#fee2e2" /><Area type="monotone" dataKey="closed" stackId="1" stroke="#f59e42" fill="#fef3c7" /><ChartTooltip /></AreaChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>Cohort Retention</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><BarChart data={cohortData}><XAxis dataKey="cohortMonth" /><YAxis allowDecimals={false} /><Bar dataKey="retained" fill="#6366f1" /><Bar dataKey="total" fill="#d1d5db" /><ChartTooltip /></BarChart></ResponsiveContainer></CardContent></Card>
      </div>
      {/* Geographic & Engagement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card><CardHeader><CardTitle>Reviews by State</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><BarChart data={geoReviews}><XAxis dataKey="region" /><YAxis allowDecimals={false} /><Bar dataKey="reviews" fill="#3B82F6" /><Bar dataKey="jobs" fill="#10B981" /><Legend /><ChartTooltip /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>Top Vendors</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><BarChart data={topVendors}><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Bar dataKey="jobs" fill="#6366f1" /><Bar dataKey="reviews" fill="#f59e42" /><Legend /><ChartTooltip /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>Engagement by Vendor</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><BarChart data={engagement}><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Bar dataKey="reviews" fill="#3B82F6" /><Bar dataKey="jobs" fill="#10B981" /><Bar dataKey="avgRating" fill="#f59e42" /><Legend /><ChartTooltip /></BarChart></ResponsiveContainer></CardContent></Card>
      </div>
      {/* Funnel & Forecast */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card><CardHeader><CardTitle>Conversion Funnel</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><BarChart data={[funnel]}><XAxis dataKey="stage" type="category" data={["registered","firstJob","firstReview","repeatUsers"]} /><YAxis allowDecimals={false} /><Bar dataKey="registered" fill="#3B82F6" /><Bar dataKey="firstJob" fill="#10B981" /><Bar dataKey="firstReview" fill="#f59e42" /><Bar dataKey="repeatUsers" fill="#ef4444" /><Legend /><ChartTooltip /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>Forecast (Next 3 Months)</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><LineChart data={forecast}><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Line type="monotone" dataKey="predicted" stroke="#6366f1" strokeWidth={3} /><ChartTooltip /></LineChart></ResponsiveContainer></CardContent></Card>
      </div>
      {/* Anomalies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card><CardHeader><CardTitle>Anomalies</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><BarChart data={anomalies}><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Bar dataKey="value" fill="#ef4444" /><Bar dataKey="expected" fill="#10B981" /><Legend /><ChartTooltip /></BarChart></ResponsiveContainer></CardContent></Card>
      </div>
      {/* Backend Developer Notes */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">📋 Backend Developer Notes</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>Endpoints Needed:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><code>GET /api/reports/kpis?range=7d</code> - Returns all key metrics for the selected time range</li>
            <li><code>GET /api/reports/growth?type=user|vendor&interval=day|week|month&range=30d</code> - User/vendor growth</li>
            <li><code>GET /api/reports/churn?type=user|vendor&interval=month&range=12m</code> - Churn/closure rate</li>
            <li><code>GET /api/reports/cohort?type=user|vendor&range=12m</code> - Cohort retention</li>
            <li><code>GET /api/reports/geo-reviews?region=state|city&range=30d</code> - Reviews/jobs by region</li>
            <li><code>GET /api/reports/engagement?by=vendor|user|region&range=30d</code> - Engagement/quality</li>
            <li><code>GET /api/reports/funnel?range=30d</code> - Conversion funnel</li>
            <li><code>GET /api/reports/compare?entity=vendor|region&id1=xxx&id2=yyy&range=30d</code> - Compare entities</li>
            <li><code>GET /api/reports/forecast?metric=users|revenue|jobs&range=90d</code> - Forecasting</li>
            <li><code>GET /api/reports/anomalies?range=30d</code> - Anomaly detection</li>
          </ul>
          <p className="mt-2"><strong>All endpoints should support time range, segmentation, and comparison filters.</strong></p>
          <p><strong>Data Model:</strong> All events must be timestamped and geotagged. Store churn/closure reasons if possible.</p>
          <p><strong>Export/Sharing:</strong> Endpoints for PDF/CSV/image export. Option to generate shareable dashboard links.</p>
          <p><strong>Security:</strong> Restrict access to analytics endpoints to authorized roles. Log all access to analytics data.</p>
        </div>
      </div>
    </div>
  );
} 