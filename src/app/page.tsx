'use client';

import { useState, useEffect } from 'react';

// Types for backend integration
interface DashboardStats {
  totalUsers: number;
  totalVendors: number;
  totalReviews: number;
  growthRate: number;
  lastUpdated: string;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
  }[];
}

interface DashboardCardProps {
  icon: string;
  label: string;
  value: string | number;
  loading?: boolean;
  error?: boolean;
}

// Mock chart data for backend developer reference
const generateMockChartData = (): { userGrowth: ChartData; revenueTrend: ChartData } => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return {
    userGrowth: {
      labels: months,
      datasets: [
        {
          label: 'New Users',
          data: [120, 145, 180, 220, 280, 320, 380, 420, 480, 520, 580, 650],
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
        },
        {
          label: 'Active Users',
          data: [800, 850, 920, 1050, 1180, 1320, 1480, 1650, 1820, 2000, 2180, 2350],
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
        }
      ]
    },
    revenueTrend: {
      labels: months,
      datasets: [
        {
          label: 'Subscription Revenue',
          data: [8500, 9200, 10800, 12500, 14200, 16800, 19500, 22500, 25800, 29200, 32800, 36500],
          borderColor: '#8B5CF6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
        },
        {
          label: 'Ad Revenue',
          data: [3200, 3800, 4500, 5200, 6100, 7200, 8400, 9800, 11500, 13200, 15100, 17200],
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
        }
      ]
    }
  };
};

// Simple chart component for demonstration
const SimpleChart = ({ data, title, loading }: { data: ChartData; title: string; loading: boolean }) => {
  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          Loading chart...
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.datasets.flatMap(dataset => dataset.data));
  const minValue = Math.min(...data.datasets.flatMap(dataset => dataset.data));

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">{title}</h3>
      
      {/* Chart Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        {data.datasets.map((dataset, index) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded" 
              style={{ backgroundColor: dataset.borderColor }}
            ></div>
            <span className="text-gray-600">{dataset.label}</span>
          </div>
        ))}
      </div>

      {/* Simple Bar Chart Visualization */}
      <div className="h-32 flex items-end justify-between gap-1">
        {data.labels.map((label, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div className="w-full flex flex-col gap-1">
              {data.datasets.map((dataset, datasetIndex) => {
                const value = dataset.data[index];
                const height = ((value - minValue) / (maxValue - minValue)) * 100;
                return (
                  <div
                    key={datasetIndex}
                    className="w-full rounded-sm transition-all duration-300 hover:opacity-80"
                    style={{
                      height: `${height}%`,
                      backgroundColor: dataset.backgroundColor,
                      border: `1px solid ${dataset.borderColor}`,
                      minHeight: '4px'
                    }}
                    title={`${dataset.label}: ${value.toLocaleString()}`}
                  ></div>
                );
              })}
            </div>
            <span className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-left">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {data.datasets.map((dataset, index) => {
          const currentValue = dataset.data[dataset.data.length - 1];
          const previousValue = dataset.data[dataset.data.length - 2];
          const change = previousValue ? ((currentValue - previousValue) / previousValue * 100) : 0;
          
          return (
            <div key={index} className="bg-gray-50 p-3 rounded">
              <div className="font-medium text-gray-700">{dataset.label}</div>
              <div className="text-lg font-bold">{currentValue.toLocaleString()}</div>
              <div className={`text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {change >= 0 ? '+' : ''}{change.toFixed(1)}% from last month
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [chartData] = useState(generateMockChartData());

  // Function to fetch dashboard data from backend
  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // TODO: Replace with actual backend endpoint
      // Backend developer should implement: GET /api/dashboard/stats
      const response = await fetch('/api/dashboard/stats');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: DashboardStats = await response.json();
      setStats(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      
      // Fallback to mock data for development
      setStats({
        totalUsers: 1250,
        totalVendors: 89,
        totalReviews: 5670,
        growthRate: 12,
        lastUpdated: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 5 minutes
  useEffect(() => {
    fetchDashboardStats();
    
    const interval = setInterval(fetchDashboardStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Manual refresh function
  const handleRefresh = () => {
    fetchDashboardStats();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          {lastRefresh && (
            <span className="text-sm text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">
            <strong>Error:</strong> {error}
          </p>
          <p className="text-red-600 text-xs mt-1">
            Showing fallback data. Please check your connection.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <DashboardCard 
          icon="👥" 
          label="Total Users" 
          value={stats?.totalUsers || 0}
          loading={loading}
          error={!!error}
        />
        <DashboardCard 
          icon="🏢" 
          label="Total Vendors" 
          value={stats?.totalVendors || 0}
          loading={loading}
          error={!!error}
        />
        <DashboardCard 
          icon="⭐" 
          label="Total Reviews" 
          value={stats?.totalReviews || 0}
          loading={loading}
          error={!!error}
        />
        <DashboardCard 
          icon="📈" 
          label="Growth" 
          value={`${stats?.growthRate || 0}%`}
          loading={loading}
          error={!!error}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 shadow">
          <SimpleChart 
            data={chartData.userGrowth} 
            title="User Growth (Monthly)" 
            loading={loading}
          />
        </div>
        <div className="bg-white rounded-lg p-6 shadow">
          <SimpleChart 
            data={chartData.revenueTrend} 
            title="Revenue Trend (Monthly)" 
            loading={loading}
          />
        </div>
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

function DashboardCard({ icon, label, value, loading = false, error = false }: DashboardCardProps) {
  return (
    <div className={`bg-white rounded-lg p-6 flex flex-col items-center shadow transition-all duration-200 ${
      error ? 'border-2 border-red-200' : ''
    }`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-lg font-semibold text-center">{label}</div>
      <div className="text-2xl font-bold">
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            Loading...
          </div>
        ) : (
          <span className={error ? 'text-red-600' : ''}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
        )}
      </div>
    </div>
  );
}