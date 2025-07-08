import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { Info } from 'lucide-react';
import { Tabs, Tab } from "@/components/ui/tabs"; // If you have a tabs component, otherwise use select

// Placeholder data generators
const generateMetric = () => Math.floor(Math.random() * 1000) + 100;
const generateChartData = (points: number, granularity: string) =>
  Array.from({ length: points }, (_, i) => ({
    name:
      granularity === "hourly"
        ? `Hour ${i}`
        : granularity === "weekly"
        ? `Week ${i + 1}`
        : `Day ${i + 1}`,
    value: Math.floor(Math.random() * 200) + 50,
  }));

interface FilterOptions {
  vendor: string[];
  dateFrom: string;
  dateTo: string;
}

const VENDORS = ["Reliable Plumbers", "Bright Electric", "Spark HVAC"];
const EXPORT_OPTIONS = [
  { label: "Metrics Only", value: "metrics" },
  { label: "User Activity Data", value: "users" },
  { label: "Vendor Growth Data", value: "vendors" },
  { label: "Engagement Data", value: "engagement" },
  { label: "Export All", value: "all" },
];
const GRANULARITY_OPTIONS = ["hourly", "daily", "weekly"];

const METRIC_LABELS: Record<string, string> = {
  users: "Total Users",
  vendors: "Total Vendors",
  mrr: "MRR",
  arr: "ARR",
  churn: "Churn Rate",
  ltv: "LTV",
  cac: "CAC",
  activeUsers: "Active Users",
  payingUsers: "Paying Users",
  jobsCompleted: "Jobs Completed",
  reviewsGenerated: "Reviews Generated",
  vendorsOnline: "Vendors Online",
};
const METRIC_COLORS: Record<string, string> = {
  users: "text-blue-400",
  vendors: "text-green-400",
  mrr: "text-indigo-400",
  arr: "text-indigo-400",
  churn: "text-red-400",
  ltv: "text-yellow-400",
  cac: "text-pink-400",
  activeUsers: "text-blue-400",
  payingUsers: "text-green-400",
  jobsCompleted: "text-purple-400",
  reviewsGenerated: "text-orange-400",
  vendorsOnline: "text-blue-400",
};
const METRIC_KEYS = [
  "users","vendors","mrr","arr","churn","ltv","cac","activeUsers","payingUsers","jobsCompleted","reviewsGenerated","vendorsOnline"
];
const METRIC_TOOLTIPS = {
  users: "The total number of registered users on the platform.",
  vendors: "The total number of vendors offering services on the platform.",
  mrr: "Monthly Recurring Revenue: the predictable revenue generated each month from subscriptions.",
  arr: "Annual Recurring Revenue: the total revenue expected from subscriptions over a year.",
  churn: "The percentage of users or vendors who cancel their subscription during a given period.",
  ltv: "Lifetime Value: the average total revenue expected from a user or vendor over their entire relationship with the platform.",
  cac: "Customer Acquisition Cost: the average cost to acquire a new user or vendor.",
  activeUsers: "The number of users who have logged in or performed actions recently.",
  payingUsers: "The number of users with an active paid subscription.",
  jobsCompleted: "The total number of service jobs completed through the platform.",
  reviewsGenerated: "The total number of customer reviews submitted for completed jobs.",
  vendorsOnline: "The number of vendors currently online and available to accept jobs.",
};

export default function ReportsAnalytics() {
  const [filter, setFilter] = useState<FilterOptions>({
    vendor: [],
    dateFrom: "",
    dateTo: "",
  });
  const [metrics, setMetrics] = useState({
    users: 0,
    vendors: 0,
    mrr: 0,
    arr: 0,
    churn: 0,
    ltv: 0,
    cac: 0,
    activeUsers: 0,
    payingUsers: 0,
    jobsCompleted: 0,
    reviewsGenerated: 0,
    vendorsOnline: 0,
    engagement: 0,
    avgRating: 0,
    subscriptionRev: 0,
    adRevenue: 0,
  });
  const [chartUsers, setChartUsers] = useState<{ name: string; value: number }[]>([]);
  const [chartVendors, setChartVendors] = useState<{ name: string; value: number }[]>([]);
  const [chartEngagement, setChartEngagement] = useState<{ name: string; value: number }[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>(" ");
  const [viewingDetail, setViewingDetail] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [granularity, setGranularity] = useState<string>("daily");
  const [exportChoice, setExportChoice] = useState<string>("metrics");
  const [drilldownMetric, setDrilldownMetric] = useState<string | null>(null);
  const [drilldownTimeframe, setDrilldownTimeframe] = useState<'daily'|'weekly'|'monthly'>('daily');
  const [drilldownStartDate, setDrilldownStartDate] = useState<string>("");
  const [drilldownEndDate, setDrilldownEndDate] = useState<string>("");

  // Threshold constants
  const USER_THRESHOLD = 500;
  const VENDOR_THRESHOLD = 300;
  const ENGAGEMENT_THRESHOLD = 700;

  const getDrilldownData = (metric: string, timeframe: string, startDate?: string, endDate?: string) => {
    // TODO: Replace with backend API call for metric + timeframe or custom date range
    // If custom date range is set, use it to fetch data
    // For now, use random data
    return generateChartData(7, timeframe);
  };

  useEffect(() => {
    setLoading(true);
    const timestamp = new Date().toLocaleString();
    setLastUpdated(timestamp);
    setTimeout(() => {
      setMetrics({
        users: generateMetric(),
        vendors: generateMetric(),
        mrr: generateMetric() * 10,
        arr: generateMetric() * 120,
        churn: +(Math.random() * 5).toFixed(1),
        ltv: generateMetric() * 2,
        cac: generateMetric(),
        activeUsers: generateMetric(),
        payingUsers: generateMetric(),
        jobsCompleted: generateMetric() * 3,
        reviewsGenerated: generateMetric(),
        vendorsOnline: Math.floor(Math.random() * 30),
        engagement: generateMetric(),
        avgRating: +(Math.random() * 2 + 3).toFixed(2),
        subscriptionRev: generateMetric() * 10,
        adRevenue: generateMetric() * 5,
      });
      setChartUsers(generateChartData(7, granularity));
      setChartVendors(generateChartData(7, granularity));
      setChartEngagement(generateChartData(7, granularity));
      setLoading(false);
    }, 500);
  }, [filter, granularity]);

  const clearFilters = () => setFilter({ vendor: [], dateFrom: "", dateTo: "" });
  const applyFilters = () => setFilter({ ...filter });

  const exportCSV = () => {
    let csv = "";
    if (exportChoice === "metrics" || exportChoice === "all") {
      csv += "Metric,Value\n";
      Object.entries(metrics).forEach(([key, val]) => {
        csv += `${key},${val}\n`;
      });
    }
    if (exportChoice === "users" || exportChoice === "all") {
      csv += "\nUser Activity,Value\n";
      chartUsers.forEach((d) => {
        csv += `${d.name},${d.value}\n`;
      });
    }
    if (exportChoice === "vendors" || exportChoice === "all") {
      csv += "\nVendor Growth,Value\n";
      chartVendors.forEach((d) => {
        csv += `${d.name},${d.value}\n`;
      });
    }
    if (exportChoice === "engagement" || exportChoice === "all") {
      csv += "\nEngagement,Value\n";
      chartEngagement.forEach((d) => {
        csv += `${d.name},${d.value}\n`;
      });
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports_${exportChoice}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderDetailModal = () => {
    if (!viewingDetail) return null;
    let title = "";
    let content: React.ReactNode = null;

    if (viewingDetail === "users") {
      title = "User Activity Details";
      content = (
        <ul className="list-disc list-inside space-y-1">
          {chartUsers.map((d, idx) => (
            <li key={idx}>{`${d.name}: ${d.value} users`}</li>
          ))}
        </ul>
      );
    } else if (viewingDetail === "vendors") {
      title = "Vendor Growth Details";
      content = (
        <ul className="list-disc list-inside space-y-1">
          {chartVendors.map((d, idx) => (
            <li key={idx}>{`${d.name}: ${d.value} vendors`}</li>
          ))}
        </ul>
      );
    } else if (viewingDetail === "engagement") {
      title = "Engagement Metrics Details";
      content = (
        <ul className="list-disc list-inside space-y-1">
          {chartEngagement.map((d, idx) => (
            <li key={idx}>{`${d.name}: ${d.value} engagements`}</li>
          ))}
        </ul>
      );
    }
    return (
      <Dialog open onOpenChange={() => setViewingDetail(null)}>
        <DialogContent className="max-w-md space-y-4">
          <DialogTitle>{title}</DialogTitle>
          {content}
          <div className="flex justify-end gap-2">
            {viewingDetail === "users" && (
              <Button size="sm" variant="outline" asChild>
                <a href="/user-management">Go to Users</a>
              </Button>
            )}
            {viewingDetail === "vendors" && (
              <Button size="sm" variant="outline" asChild>
                <a href="/vendor-management">Go to Vendors</a>
              </Button>
            )}
            {viewingDetail === "engagement" && (
              <Button size="sm" variant="outline" asChild>
                <a href="/review-management">Go to Engagement</a>
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setViewingDetail(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const getBadgeVariant = (value: number, threshold: number) => {
    if (value >= threshold) return "default";
    if (value >= threshold * 0.8) return "secondary";
    return "destructive";
  };

  return (
    <div className="p-6 space-y-6 relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50">
          <span className="text-gray-600">Loading...</span>
        </div>
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Reports &amp; Analytics</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Last updated: {lastUpdated}</span>
          <div className="flex items-center gap-1">
            <select
              className="border rounded px-2 py-1 text-sm"
              value={exportChoice}
              onChange={(e) => setExportChoice(e.target.value)}
            >
              {EXPORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={exportCSV}>
              Download
            </Button>
          </div>
        </div>
      </div>

      {/* Summary / Headline Section */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
        {METRIC_KEYS.map((key) => (
          <Card key={key} className="cursor-pointer hover:shadow-lg transition" onClick={() => setDrilldownMetric(key)}>
            <div className="p-4">
              <p className={`text-sm text-gray-500 flex items-center gap-1`}>{METRIC_LABELS[key]} <span className="relative group"><Info className={`w-3 h-3 ${METRIC_COLORS[key]} cursor-pointer`} /><span className="absolute left-1/2 -translate-x-1/2 mt-2 max-w-xs w-max bg-white border border-gray-300 rounded shadow-lg text-xs text-gray-700 p-2 opacity-0 group-hover:opacity-100 pointer-events-none z-10 whitespace-normal text-left">{METRIC_TOOLTIPS[key]}</span></span></p>
              <div className="text-2xl font-semibold">{key === 'mrr' || key === 'arr' || key === 'ltv' || key === 'cac' ? `$${metrics[key as keyof typeof metrics]}` : metrics[key as keyof typeof metrics]}</div>
            </div>
          </Card>
        ))}
      </div>
      {/* Drilldown Modal */}
      {drilldownMetric && (
        <Dialog open onOpenChange={() => setDrilldownMetric(null)}>
          <DialogContent className="max-w-lg space-y-4">
            <DialogTitle>{METRIC_LABELS[drilldownMetric]} Details</DialogTitle>
            <div className="flex items-center gap-2 mb-2">
              <span className={`font-medium ${METRIC_COLORS[drilldownMetric]}`}>{METRIC_LABELS[drilldownMetric]}</span>
              <span className="relative group">
                <Info className={`w-4 h-4 ${METRIC_COLORS[drilldownMetric]} cursor-pointer`} />
                <span className="absolute left-1/2 -translate-x-1/2 mt-2 max-w-xs w-max bg-white border border-gray-300 rounded shadow-lg text-xs text-gray-700 p-2 opacity-0 group-hover:opacity-100 pointer-events-none z-10 whitespace-normal text-left">{METRIC_TOOLTIPS[drilldownMetric]}</span>
              </span>
            </div>
            {/* Date Range Picker */}
            <div className="flex gap-2 items-center mb-2">
              <label className="text-xs text-gray-500">From</label>
              <input type="date" value={drilldownStartDate} onChange={e => setDrilldownStartDate(e.target.value)} className="border rounded px-2 py-1 text-xs" />
              <label className="text-xs text-gray-500">to</label>
              <input type="date" value={drilldownEndDate} onChange={e => setDrilldownEndDate(e.target.value)} className="border rounded px-2 py-1 text-xs" />
              <Button size="sm" variant="outline" onClick={() => { setDrilldownStartDate(""); setDrilldownEndDate(""); }}>Clear</Button>
            </div>
            <div className="flex gap-2 mb-2">
              <Button size="sm" variant={drilldownTimeframe==='daily'?'default':'outline'} onClick={()=>setDrilldownTimeframe('daily')}>Daily</Button>
              <Button size="sm" variant={drilldownTimeframe==='weekly'?'default':'outline'} onClick={()=>setDrilldownTimeframe('weekly')}>Weekly</Button>
              <Button size="sm" variant={drilldownTimeframe==='monthly'?'default':'outline'} onClick={()=>setDrilldownTimeframe('monthly')}>Monthly</Button>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={getDrilldownData(drilldownMetric, drilldownTimeframe, drilldownStartDate, drilldownEndDate)} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <CartesianGrid strokeDasharray="3 3" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setDrilldownMetric(null)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Analytics Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CardTitle>User Growth</CardTitle>
            <span className="relative group">
              <Info className="w-4 h-4 text-blue-400 cursor-pointer" />
              <span className="absolute left-1/2 -translate-x-1/2 mt-2 max-w-xs w-max bg-white border border-gray-300 rounded shadow-lg text-xs text-gray-700 p-2 opacity-0 group-hover:opacity-100 pointer-events-none z-10 whitespace-normal text-left">
                Shows the number of users joining the platform over time. Helps track growth and marketing effectiveness.
              </span>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartUsers} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <CartesianGrid strokeDasharray="3 3" />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CardTitle>Vendor Growth</CardTitle>
            <span className="relative group">
              <Info className="w-4 h-4 text-green-400 cursor-pointer" />
              <span className="absolute left-1/2 -translate-x-1/2 mt-2 max-w-xs w-max bg-white border border-gray-300 rounded shadow-lg text-xs text-gray-700 p-2 opacity-0 group-hover:opacity-100 pointer-events-none z-10 whitespace-normal text-left">
                Shows the number of vendors growing their presence on the platform. Indicates market expansion and platform attractiveness.
              </span>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartVendors} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <CartesianGrid strokeDasharray="3 3" />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CardTitle>Engagement Trend</CardTitle>
            <span className="relative group">
              <Info className="w-4 h-4 text-orange-400 cursor-pointer" />
              <span className="absolute left-1/2 -translate-x-1/2 mt-2 max-w-xs w-max bg-white border border-gray-300 rounded shadow-lg text-xs text-gray-700 p-2 opacity-0 group-hover:opacity-100 pointer-events-none z-10 whitespace-normal text-left">
                Shows the average engagement level per day, which is a key indicator of user satisfaction and platform usage.
              </span>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartEngagement} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <CartesianGrid strokeDasharray="3 3" />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#f59e42" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
} 