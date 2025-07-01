"use client";
import { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as ChartTooltip, BarChart, Bar, Legend } from "recharts";

const mockStats = {
  totalUsers: 1250,
  totalVendors: 89,
  totalReviews: 5670,
  growthRate: 12,
};

const userGrowth = [
  { month: "Jan", newUsers: 120, activeUsers: 800 },
  { month: "Feb", newUsers: 145, activeUsers: 850 },
  { month: "Mar", newUsers: 180, activeUsers: 920 },
  { month: "Apr", newUsers: 220, activeUsers: 1050 },
  { month: "May", newUsers: 280, activeUsers: 1180 },
  { month: "Jun", newUsers: 320, activeUsers: 1320 },
  { month: "Jul", newUsers: 380, activeUsers: 1480 },
  { month: "Aug", newUsers: 420, activeUsers: 1650 },
  { month: "Sep", newUsers: 480, activeUsers: 1820 },
  { month: "Oct", newUsers: 520, activeUsers: 2000 },
  { month: "Nov", newUsers: 580, activeUsers: 2180 },
  { month: "Dec", newUsers: 650, activeUsers: 2350 },
];
const revenueTrend = [
  { month: "Jan", subscription: 8500, ad: 3200 },
  { month: "Feb", subscription: 9200, ad: 3800 },
  { month: "Mar", subscription: 10800, ad: 4500 },
  { month: "Apr", subscription: 12500, ad: 5200 },
  { month: "May", subscription: 14200, ad: 6100 },
  { month: "Jun", subscription: 16800, ad: 7200 },
  { month: "Jul", subscription: 19500, ad: 8400 },
  { month: "Aug", subscription: 22500, ad: 9800 },
  { month: "Sep", subscription: 25800, ad: 11500 },
  { month: "Oct", subscription: 29200, ad: 13200 },
  { month: "Nov", subscription: 32800, ad: 15100 },
  { month: "Dec", subscription: 36500, ad: 17200 },
];

export default function DashboardPage() {
  const [stats, setStats] = useState(mockStats);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLastRefresh(new Date());
      setLoading(false);
    }, 1000);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button onClick={handleRefresh} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.totalUsers}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Vendors</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.totalVendors}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Reviews</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.totalReviews}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Growth</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.growthRate}%</CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Growth (Monthly)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={userGrowth} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Line type="monotone" dataKey="newUsers" stroke="#3B82F6" strokeWidth={3} name="New Users" />
                <Line type="monotone" dataKey="activeUsers" stroke="#10B981" strokeWidth={3} name="Active Users" />
                <ChartTooltip />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend (Monthly)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueTrend} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Bar dataKey="subscription" fill="#8B5CF6" name="Subscription Revenue" />
                <Bar dataKey="ad" fill="#F59E0B" name="Ad Revenue" />
                <ChartTooltip />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      {/* Backend Developer Notes */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">📋 Backend Developer Notes</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>Chart Data Endpoints Needed:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><code>GET /api/dashboard/user-growth</code> - Monthly user growth data</li>
            <li><code>GET /api/dashboard/revenue-trend</code> - Monthly revenue data</li>
            <li>Expected format: <code>{`{ labels: string[], datasets: { label: string, data: number[] }[] }`}</code></li>
          </ul>
          <p className="mt-2"><strong>Current Mock Data:</strong> Shows realistic growth patterns for reference</p>
        </div>
      </div>
    </div>
  );
} 