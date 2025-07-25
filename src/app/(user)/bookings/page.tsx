'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Star, 
  Phone, 
  MessageSquare, 
  Video, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  Share2,
  Download,
  RefreshCw,
  Plus,
  CalendarDays,
  Clock as ClockIcon,
  User,
  Building,
  CreditCard,
  FileText,
  Camera,
  CalendarCheck,
  CalendarX,
  CalendarClock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Types for the booking system
interface Booking {
  id: string;
  serviceName: string;
  vendorName: string;
  vendorId: string;
  vendorAvatar: string;
  serviceImage: string;
  date: string;
  time: string;
  duration: number; // in minutes
  status: 'upcoming' | 'in-progress' | 'completed' | 'cancelled' | 'rescheduled';
  price: number;
  address: string;
  latitude: number;
  longitude: number;
  notes: string;
  specialRequests: string[];
  paymentStatus: 'paid' | 'pending' | 'refunded';
  paymentMethod: string;
  bookingNumber: string;
  createdAt: string;
  updatedAt: string;
  rating?: number;
  review?: string;
  reviewDate?: string;
  cancellationReason?: string;
  rescheduleHistory?: Array<{
    from: string;
    to: string;
    reason: string;
    date: string;
  }>;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: 'image' | 'document' | 'video';
  }>;
  communicationHistory?: Array<{
    id: string;
    type: 'message' | 'call' | 'video' | 'system';
    content: string;
    timestamp: string;
    sender: 'user' | 'vendor' | 'system';
  }>;
}

interface Vendor {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  phone: string;
  email: string;
  isOnline: boolean;
  responseTime: string;
}

// Mock data
const mockBookings: Booking[] = [
  {
    id: '1',
    serviceName: 'Deep House Cleaning',
    vendorName: 'Sparkle Cleaners',
    vendorId: 'vendor_1',
    vendorAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    serviceImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    date: '2024-01-20',
    time: '10:00 AM',
    duration: 180,
    status: 'upcoming',
    price: 150.00,
    address: '123 Main St, Downtown, NY 10001',
    latitude: 40.7128,
    longitude: -74.0060,
    notes: 'Please focus on kitchen and bathrooms. We have a cat, so please be careful.',
    specialRequests: ['Eco-friendly products', 'Pet-safe cleaning'],
    paymentStatus: 'paid',
    paymentMethod: 'Credit Card ending in 1234',
    bookingNumber: 'BK-2024-001',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    communicationHistory: [
      {
        id: '1',
        type: 'message',
        content: 'Hi! I have a cat at home. Is that okay?',
        timestamp: '2024-01-15T10:35:00Z',
        sender: 'user'
      },
      {
        id: '2',
        type: 'message',
        content: 'Absolutely! We use pet-safe products and our team is trained to work around pets.',
        timestamp: '2024-01-15T10:40:00Z',
        sender: 'vendor'
      }
    ]
  },
  {
    id: '2',
    serviceName: 'Plumbing Repair',
    vendorName: 'Quick Fix Plumbing',
    vendorId: 'vendor_2',
    vendorAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    serviceImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    date: '2024-01-18',
    time: '2:00 PM',
    duration: 120,
    status: 'completed',
    price: 200.00,
    address: '123 Main St, Downtown, NY 10001',
    latitude: 40.7128,
    longitude: -74.0060,
    notes: 'Leaky faucet in kitchen sink',
    specialRequests: ['Emergency service'],
    paymentStatus: 'paid',
    paymentMethod: 'Credit Card ending in 1234',
    bookingNumber: 'BK-2024-002',
    createdAt: '2024-01-17T14:20:00Z',
    updatedAt: '2024-01-18T16:30:00Z',
    rating: 5,
    review: 'Excellent service! Fixed the leak quickly and professionally.',
    reviewDate: '2024-01-18T17:00:00Z',
    communicationHistory: [
      {
        id: '3',
        type: 'call',
        content: 'Emergency call - leak getting worse',
        timestamp: '2024-01-17T14:25:00Z',
        sender: 'user'
      }
    ]
  },
  {
    id: '3',
    serviceName: 'Electrical Panel Upgrade',
    vendorName: 'Bright Electric Co',
    vendorId: 'vendor_3',
    vendorAvatar: 'https://randomuser.me/api/portraits/men/45.jpg',
    serviceImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    date: '2024-01-25',
    time: '9:00 AM',
    duration: 240,
    status: 'upcoming',
    price: 800.00,
    address: '123 Main St, Downtown, NY 10001',
    latitude: 40.7128,
    longitude: -74.0060,
    notes: 'Upgrading from 100A to 200A panel',
    specialRequests: ['Permit required', 'Inspection needed'],
    paymentStatus: 'pending',
    paymentMethod: 'Credit Card ending in 1234',
    bookingNumber: 'BK-2024-003',
    createdAt: '2024-01-16T09:15:00Z',
    updatedAt: '2024-01-16T09:15:00Z'
  },
  {
    id: '4',
    serviceName: 'Garden Maintenance',
    vendorName: 'Green Thumb Landscaping',
    vendorId: 'vendor_4',
    vendorAvatar: 'https://randomuser.me/api/portraits/women/46.jpg',
    serviceImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    date: '2024-01-12',
    time: '11:00 AM',
    duration: 90,
    status: 'cancelled',
    price: 75.00,
    address: '123 Main St, Downtown, NY 10001',
    latitude: 40.7128,
    longitude: -74.0060,
    notes: 'Weekly garden maintenance',
    specialRequests: ['Organic fertilizers only'],
    paymentStatus: 'refunded',
    paymentMethod: 'Credit Card ending in 1234',
    bookingNumber: 'BK-2024-004',
    createdAt: '2024-01-10T16:45:00Z',
    updatedAt: '2024-01-11T10:20:00Z',
    cancellationReason: 'Weather conditions - heavy rain forecast',
    rescheduleHistory: [
      {
        from: '2024-01-11T11:00:00Z',
        to: '2024-01-12T11:00:00Z',
        reason: 'Weather delay',
        date: '2024-01-10T18:30:00Z'
      }
    ]
  }
];

const mockVendors: Vendor[] = [
  {
    id: 'vendor_1',
    name: 'Sparkle Cleaners',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    rating: 4.8,
    reviewCount: 127,
    phone: '+1 (555) 123-4567',
    email: 'contact@sparklecleaners.com',
    isOnline: true,
    responseTime: '5 min'
  },
  {
    id: 'vendor_2',
    name: 'Quick Fix Plumbing',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    rating: 4.9,
    reviewCount: 203,
    phone: '+1 (555) 234-5678',
    email: 'info@quickfixplumbing.com',
    isOnline: true,
    responseTime: '2 min'
  },
  {
    id: 'vendor_3',
    name: 'Bright Electric Co',
    avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
    rating: 4.7,
    reviewCount: 89,
    phone: '+1 (555) 345-6789',
    email: 'service@brightelectric.com',
    isOnline: false,
    responseTime: '15 min'
  },
  {
    id: 'vendor_4',
    name: 'Green Thumb Landscaping',
    avatar: 'https://randomuser.me/api/portraits/women/46.jpg',
    rating: 4.6,
    reviewCount: 67,
    phone: '+1 (555) 456-7890',
    email: 'hello@greenthumb.com',
    isOnline: true,
    responseTime: '8 min'
  }
];

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>(mockBookings);
  const [vendors, setVendors] = useState<Vendor[]>(mockVendors);
  const [selectedTab, setSelectedTab] = useState('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState<string | null>(null);

  // Filter bookings based on current tab and filters
  const filteredBookings = bookings.filter(booking => {
    const matchesTab = selectedTab === 'all' || booking.status === selectedTab;
    const matchesSearch = booking.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         booking.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         booking.bookingNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    return matchesTab && matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'rescheduled': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming': return <CalendarClock className="w-4 h-4" />;
      case 'in-progress': return <Clock className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      case 'rescheduled': return <AlertTriangle className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  const handleCancelBooking = (bookingId: string, reason: string) => {
    setBookings(prev => prev.map(booking => 
      booking.id === bookingId 
        ? { ...booking, status: 'cancelled', cancellationReason: reason, updatedAt: new Date().toISOString() }
        : booking
    ));
    setShowCancelModal(null);
  };

  const handleRescheduleBooking = (bookingId: string, newDate: string, newTime: string) => {
    setBookings(prev => prev.map(booking => {
      if (booking.id === bookingId) {
        const rescheduleHistory = booking.rescheduleHistory || [];
        rescheduleHistory.push({
          from: `${booking.date}T${booking.time}`,
          to: `${newDate}T${newTime}`,
          reason: 'User requested reschedule',
          date: new Date().toISOString()
        });
        
        return {
          ...booking,
          date: newDate,
          time: newTime,
          rescheduleHistory,
          updatedAt: new Date().toISOString()
        };
      }
      return booking;
    }));
    setShowRescheduleModal(null);
  };

  const handleSubmitReview = (bookingId: string, rating: number, review: string) => {
    setBookings(prev => prev.map(booking => 
      booking.id === bookingId 
        ? { 
            ...booking, 
            rating, 
            review, 
            reviewDate: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        : booking
    ));
    setShowReviewModal(null);
  };

  const BookingCard = ({ booking }: { booking: Booking }) => {
    const vendor = vendors.find(v => v.id === booking.vendorId);
    const isExpanded = expandedBooking === booking.id;

    return (
      <Card className="mb-4 border border-gray-200 hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4 flex-1">
              <img 
                src={booking.serviceImage} 
                alt={booking.serviceName}
                className="w-20 h-20 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{booking.serviceName}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Building className="w-4 h-4" />
                      <span>{booking.vendorName}</span>
                      {vendor?.isOnline && (
                        <Badge variant="secondary" className="text-xs">Online</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">${booking.price.toFixed(2)}</div>
                    <Badge className={getStatusColor(booking.status)}>
                      {getStatusIcon(booking.status)}
                      <span className="ml-1 capitalize">{booking.status.replace('-', ' ')}</span>
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(booking.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{booking.time} ({booking.duration} min)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{booking.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>{booking.bookingNumber}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t pt-4 space-y-4">
                    {/* Vendor Details */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={vendor?.avatar} />
                        <AvatarFallback>{vendor?.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-medium">{vendor?.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span>{vendor?.rating} ({vendor?.reviewCount} reviews)</span>
                          <span>•</span>
                          <span>Response: {vendor?.responseTime}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Phone className="w-4 h-4 mr-1" />
                          Call
                        </Button>
                        <Button size="sm" variant="outline">
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Message
                        </Button>
                        <Button size="sm" variant="outline">
                          <Video className="w-4 h-4 mr-1" />
                          Video
                        </Button>
                      </div>
                    </div>

                    {/* Booking Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-medium mb-2">Notes</h5>
                        <p className="text-sm text-gray-600">{booking.notes}</p>
                      </div>
                      <div>
                        <h5 className="font-medium mb-2">Special Requests</h5>
                        <div className="flex flex-wrap gap-1">
                          {booking.specialRequests.map((request, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {request}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Payment Information */}
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <h5 className="font-medium mb-2 flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Payment Information
                      </h5>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Status:</span>
                          <Badge className={`ml-2 ${booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {booking.paymentStatus}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-gray-600">Method:</span>
                          <span className="ml-2">{booking.paymentMethod}</span>
                        </div>
                      </div>
                    </div>

                    {/* Communication History */}
                    {booking.communicationHistory && booking.communicationHistory.length > 0 && (
                      <div>
                        <h5 className="font-medium mb-2">Recent Communication</h5>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {booking.communicationHistory.slice(-3).map((comm) => (
                            <div key={comm.id} className="flex items-start gap-2 text-sm">
                              <div className={`w-2 h-2 rounded-full mt-2 ${
                                comm.sender === 'user' ? 'bg-blue-500' : 
                                comm.sender === 'vendor' ? 'bg-green-500' : 'bg-gray-500'
                              }`} />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium capitalize">{comm.sender}</span>
                                  <span className="text-gray-500">
                                    {new Date(comm.timestamp).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-gray-600">{comm.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-4 border-t">
                      {booking.status === 'upcoming' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setShowRescheduleModal(booking.id)}>
                            <Edit className="w-4 h-4 mr-1" />
                            Reschedule
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setShowCancelModal(booking.id)}>
                            <XCircle className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                      {booking.status === 'completed' && !booking.rating && (
                        <Button size="sm" onClick={() => setShowReviewModal(booking.id)}>
                          <Star className="w-4 h-4 mr-1" />
                          Leave Review
                        </Button>
                      )}
                      <Button size="sm" variant="outline">
                        <Share2 className="w-4 h-4 mr-1" />
                        Share
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4 mr-1" />
                        Download Receipt
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpandedBooking(isExpanded ? null : booking.id)}
              className="ml-2"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
              <p className="text-gray-600">Manage your service appointments</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                New Booking
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Bookings</p>
                  <p className="text-2xl font-bold">{bookings.length}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Upcoming</p>
                  <p className="text-2xl font-bold">{bookings.filter(b => b.status === 'upcoming').length}</p>
                </div>
                <CalendarClock className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold">{bookings.filter(b => b.status === 'completed').length}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Spent</p>
                  <p className="text-2xl font-bold">
                    ${bookings.reduce((sum, b) => sum + b.price, 0).toFixed(0)}
                  </p>
                </div>
                <CreditCard className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search bookings, services, or vendors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="in-progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="mt-6">
            {filteredBookings.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filters'
                    : 'Start by booking your first service'
                  }
                </p>
                <Button>
                  <Plus className="w-4 h-4 mr-1" />
                  Book a Service
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Cancel Booking</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to cancel this booking?</p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowCancelModal(null)}
                className="flex-1"
              >
                Keep Booking
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => handleCancelBooking(showCancelModal, 'User requested cancellation')}
                className="flex-1"
              >
                Cancel Booking
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Reschedule Booking</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">New Date</label>
                <Input type="date" min={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">New Time</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="09:00">9:00 AM</SelectItem>
                    <SelectItem value="10:00">10:00 AM</SelectItem>
                    <SelectItem value="11:00">11:00 AM</SelectItem>
                    <SelectItem value="12:00">12:00 PM</SelectItem>
                    <SelectItem value="13:00">1:00 PM</SelectItem>
                    <SelectItem value="14:00">2:00 PM</SelectItem>
                    <SelectItem value="15:00">3:00 PM</SelectItem>
                    <SelectItem value="16:00">4:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setShowRescheduleModal(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => handleRescheduleBooking(showRescheduleModal, '2024-01-22', '10:00')}
                className="flex-1"
              >
                Reschedule
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Leave a Review</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star} 
                      className="w-6 h-6 cursor-pointer fill-yellow-400 text-yellow-400" 
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Review</label>
                <textarea 
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows={4}
                  placeholder="Share your experience..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setShowReviewModal(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => handleSubmitReview(showReviewModal, 5, 'Great service!')}
                className="flex-1"
              >
                Submit Review
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 