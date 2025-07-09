'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar, 
  Clock, 
  Star, 
  DollarSign, 
  TrendingUp, 
  Users, 
  MapPin, 
  Phone,
  Mail,
  Settings,
  Bell,
  HelpCircle
} from 'lucide-react';

interface VendorStats {
  totalJobs: number;
  completedJobs: number;
  pendingJobs: number;
  averageRating: number;
  totalEarnings: number;
  thisMonthEarnings: number;
  activeClients: number;
  responseRate: number;
}

interface RecentJob {
  id: string;
  title: string;
  client: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  date: string;
  amount: number;
  location: string;
}

interface RecentReview {
  id: string;
  client: string;
  rating: number;
  comment: string;
  date: string;
  jobTitle: string;
}

const mockStats: VendorStats = {
  totalJobs: 156,
  completedJobs: 142,
  pendingJobs: 8,
  averageRating: 4.8,
  totalEarnings: 28450,
  thisMonthEarnings: 3200,
  activeClients: 23,
  responseRate: 94
};

const mockRecentJobs: RecentJob[] = [
  {
    id: '1',
    title: 'Kitchen Sink Repair',
    client: 'Sarah Johnson',
    status: 'in-progress',
    date: '2024-01-15',
    amount: 120,
    location: 'Downtown'
  },
  {
    id: '2',
    title: 'Bathroom Faucet Installation',
    client: 'Mike Chen',
    status: 'completed',
    date: '2024-01-14',
    amount: 95,
    location: 'Westside'
  },
  {
    id: '3',
    title: 'Garbage Disposal Repair',
    client: 'Lisa Rodriguez',
    status: 'pending',
    date: '2024-01-16',
    amount: 150,
    location: 'Northside'
  }
];

const mockRecentReviews: RecentReview[] = [
  {
    id: '1',
    client: 'Sarah Johnson',
    rating: 5,
    comment: 'Excellent work! Fixed my sink quickly and professionally.',
    date: '2024-01-15',
    jobTitle: 'Kitchen Sink Repair'
  },
  {
    id: '2',
    client: 'Mike Chen',
    rating: 5,
    comment: 'Great service, very reliable and clean work.',
    date: '2024-01-14',
    jobTitle: 'Bathroom Faucet Installation'
  }
];

export default function VendorDashboard() {
  const [stats, setStats] = useState<VendorStats>(mockStats);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>(mockRecentJobs);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>(mockRecentReviews);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Welcome back, John!</h1>
              <p className="text-blue-100 text-lg">Here's what's happening with your business today</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" className="text-white border-white hover:bg-white hover:text-blue-600">
                <Bell className="w-4 h-4 mr-2" />
                Notifications
              </Button>
              <Button variant="outline" size="sm" className="text-white border-white hover:bg-white hover:text-blue-600">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-8">
        {/* Remove business info/company summary card here if present */}
        {/* Main Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
          {/* Manage Jobs Card */}
          <Card className="bg-white shadow-lg border-0">
            <CardContent className="p-6">
              <CardTitle className="text-xl font-semibold mb-2">Manage Jobs</CardTitle>
              <p className="text-gray-600 mb-4">View, accept, and update your job requests.</p>
              <Button asChild className="w-full">
                <a href="/vendor/jobs">Go to Jobs</a>
              </Button>
            </CardContent>
          </Card>
          {/* View Reviews Card */}
          <Card className="bg-white shadow-lg border-0">
            <CardContent className="p-6">
              <CardTitle className="text-xl font-semibold mb-2">View Reviews</CardTitle>
              <p className="text-gray-600 mb-4">See client feedback and performance trends.</p>
              <Button asChild className="w-full">
                <a href="/vendor/reviews">See Reviews</a>
              </Button>
            </CardContent>
          </Card>
          {/* Billing & Earnings Card */}
          <Card className="bg-white shadow-lg border-0">
            <CardContent className="p-6">
              <CardTitle className="text-xl font-semibold mb-2">Billing & Earnings</CardTitle>
              <p className="text-gray-600 mb-4">Track your payments, invoices, and plans.</p>
              <Button asChild className="w-full">
                <a href="/vendor/billing">Go to Billing</a>
              </Button>
            </CardContent>
          </Card>
          {/* Profile & Settings Card */}
          <Card className="bg-white shadow-lg border-0">
            <CardContent className="p-6">
              <CardTitle className="text-xl font-semibold mb-2">Profile & Settings</CardTitle>
              <p className="text-gray-600 mb-4">Edit your business info and preferences.</p>
              <Button asChild className="w-full">
                <a href="/vendor/profile">Go to Profile</a>
              </Button>
            </CardContent>
          </Card>
          {/* Support & Help Card */}
          <Card className="bg-white shadow-lg border-0">
            <CardContent className="p-6">
              <CardTitle className="text-xl font-semibold mb-2">Support & Help</CardTitle>
              <p className="text-gray-600 mb-4">Get assistance or open a support ticket.</p>
              <Button asChild className="w-full">
                <a href="/vendor/support">Get Support</a>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Jobs */}
          <div className="lg:col-span-2">
            <Card className="bg-white shadow-lg border-0">
              <CardHeader className="border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-semibold">Recent Jobs</CardTitle>
                  <Button variant="outline" size="sm">View All</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-200">
                  {recentJobs.map((job) => (
                    <div key={job.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="font-medium text-gray-900">{job.title}</h3>
                            <Badge className={getStatusColor(job.status)}>
                              {job.status.replace('-', ' ')}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              {job.client}
                            </div>
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              {job.location}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {new Date(job.date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{formatCurrency(job.amount)}</p>
                          <Button variant="outline" size="sm" className="mt-2">
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Reviews */}
            <Card className="bg-white shadow-lg border-0">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="text-lg font-semibold">Recent Reviews</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-200">
                  {mockRecentReviews.map((review) => (
                    <div key={review.id} className="p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-600">{review.client}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{review.comment}</p>
                      <p className="text-xs text-gray-500">{review.jobTitle}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-white shadow-lg border-0">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <Button className="w-full justify-start" variant="outline">
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Availability
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Update Pricing
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <MapPin className="w-4 h-4 mr-2" />
                    Service Areas
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Get Support
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Performance Progress */}
            <Card className="bg-white shadow-lg border-0">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="text-lg font-semibold">Performance</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Job Completion Rate</span>
                      <span>91%</span>
                    </div>
                    <Progress value={91} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Client Satisfaction</span>
                      <span>96%</span>
                    </div>
                    <Progress value={96} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Response Time</span>
                      <span>2.3h avg</span>
                    </div>
                    <Progress value={85} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 