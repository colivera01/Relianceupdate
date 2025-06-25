import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

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

export default function ReportsAnalytics() {
  const [filter, setFilter] = useState<FilterOptions>({
    vendor: [],
    dateFrom: "",
    dateTo: "",
  });
  const [metrics, setMetrics] = useState({
    users: 0,
    vendors: 0,
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

  // Threshold constants
  const USER_THRESHOLD = 500;
  const VENDOR_THRESHOLD = 300;
  const ENGAGEMENT_THRESHOLD = 700;

  useEffect(() => {
    setLoading(true);
    const timestamp = new Date().toLocaleString();
    setLastUpdated(timestamp);
    setTimeout(() => {
      setMetrics({
        users: generateMetric(),
        vendors: generateMetric(),
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setViewingDetail("users")}> 
          <div>
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-semibold flex items-center gap-2">
              {metrics.users}
              <Badge variant={getBadgeVariant(metrics.users, USER_THRESHOLD)}>
                {metrics.users >= USER_THRESHOLD ? "On Target" : metrics.users >= USER_THRESHOLD * 0.8 ? "Caution" : "Below"}
              </Badge>
            </p>
          </div>
        </Card>
        <Card className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setViewingDetail("vendors")}> 
          <div>
            <p className="text-sm text-gray-500">Total Vendors</p>
            <p className="text-2xl font-semibold flex items-center gap-2">
              {metrics.vendors}
              <Badge variant={getBadgeVariant(metrics.vendors, VENDOR_THRESHOLD)}>
                {metrics.vendors >= VENDOR_THRESHOLD ? "On Target" : metrics.vendors >= VENDOR_THRESHOLD * 0.8 ? "Caution" : "Below"}
              </Badge>
            </p>
          </div>
        </Card>
        <Card className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setViewingDetail("engagement")}> 
          <div>
            <p className="text-sm text-gray-500">Avg Engagement/Day</p>
            <p className="text-2xl font-semibold flex items-center gap-2">
              {metrics.engagement}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
} 