'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Star, 
  CheckCircle, 
  X, 
  AlertCircle,
  ChevronLeft,
  Filter,
  Search
} from 'lucide-react';

export default function MyBookingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'service'>('date');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Mock booking data
  const bookings = {
    upcoming: [
      {
        id: 'BK001',
        service: {
          name: 'Deep House Cleaning',
          vendor: 'Sparkle Clean Pro',
          image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop',
          rating: 4.9,
          reviewCount: 127
        },
        date: '2024-01-26',
        time: '10:00 AM',
        duration: '3-4 hours',
        price: 120,
        status: 'confirmed',
        address: '123 Main St, New York, NY 10001',
        notes: 'Please use eco-friendly products'
      },
      {
        id: 'BK002',
        service: {
          name: 'TikTok Style Haircut',
          vendor: 'Style Studio NYC',
          image: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=300&h=200&fit=crop',
          rating: 4.8,
          reviewCount: 89
        },
        date: '2024-01-28',
        time: '2:00 PM',
        duration: '1 hour',
        price: 45,
        status: 'confirmed',
        address: '456 Fashion Ave, New York, NY 10002',
        notes: 'Bring reference photos'
      }
    ],
    past: [
      {
        id: 'BK003',
        service: {
          name: 'Plumbing Repair',
          vendor: 'Quick Fix Plumbing',
          image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&h=200&fit=crop',
          rating: 4.7,
          reviewCount: 156
        },
        date: '2024-01-15',
        time: '11:00 AM',
        duration: '2 hours',
        price: 85,
        status: 'completed',
        address: '123 Main St, New York, NY 10001',
        notes: 'Fixed leaky faucet in kitchen'
      },
      {
        id: 'BK004',
        service: {
          name: 'Instagram-Worthy Nails',
          vendor: 'Nail Art Collective',
          image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=300&h=200&fit=crop',
          rating: 4.9,
          reviewCount: 203
        },
        date: '2024-01-10',
        time: '3:00 PM',
        duration: '1.5 hours',
        price: 35,
        status: 'completed',
        address: '789 Beauty Blvd, New York, NY 10003',
        notes: 'Gel manicure with nail art'
      }
    ],
    cancelled: [
      {
        id: 'BK005',
        service: {
          name: 'Pet Grooming',
          vendor: 'Pawsome Grooming',
          image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300&h=200&fit=crop',
          rating: 4.6,
          reviewCount: 78
        },
        date: '2024-01-20',
        time: '1:00 PM',
        duration: '2 hours',
        price: 45,
        status: 'cancelled',
        address: '321 Pet Street, New York, NY 10004',
        notes: 'Pet was sick, had to reschedule',
        cancellationReason: 'Pet was not feeling well'
      }
    ]
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <X className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const filteredBookings = bookings[activeTab]
    .filter(booking =>
      booking.service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.service.vendor.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(booking => 
      filterCategory === 'all' || 
      booking.service.name.toLowerCase().includes(filterCategory.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'price':
          return b.price - a.price;
        case 'service':
          return a.service.name.localeCompare(b.service.name);
        default:
          return 0;
      }
    });

  const handleCancelBooking = (bookingId: string) => {
    // In real app, this would call an API
    if (confirm('Are you sure you want to cancel this booking?')) {
      console.log('Cancelling booking:', bookingId);
      alert('Booking cancelled successfully!');
    }
  };

  const handleRescheduleBooking = (bookingId: string) => {
    // In real app, this would navigate to reschedule page
    console.log('Rescheduling booking:', bookingId);
    alert('Redirecting to reschedule page...');
    // router.push(`/booking/${bookingId}/reschedule`);
  };

  const handleContactVendor = (vendorName: string) => {
    // In real app, this would open chat or contact form
    console.log('Contacting vendor:', vendorName);
    alert(`Opening chat with ${vendorName}...`);
    // router.push(`/messages?vendor=${vendorName}`);
  };

  const handleViewBookingDetails = (bookingId: string) => {
    // In real app, this would navigate to detailed booking page
    console.log('Viewing booking details:', bookingId);
  };

  const handleLeaveReview = (bookingId: string) => {
    // In real app, this would navigate to review page
    console.log('Leaving review for booking:', bookingId);
  };

  const handleReBook = (bookingId: string) => {
    // In real app, this would navigate to booking page with pre-filled service
    console.log('Re-booking service:', bookingId);
  };

  const handleAddToCalendar = (booking: any) => {
    // In real app, this would add to user's calendar
    const event = {
      title: `${booking.service.name} - ${booking.service.vendor}`,
      start: new Date(`${booking.date}T${booking.time}`),
      end: new Date(`${booking.date}T${booking.time}`),
      location: booking.address,
      description: booking.notes || ''
    };
    console.log('Adding to calendar:', event);
    alert('Event added to your calendar!');
  };

  const handleDownloadReceipt = (bookingId: string) => {
    // In real app, this would generate and download PDF receipt
    console.log('Downloading receipt for booking:', bookingId);
    alert('Receipt downloaded successfully!');
  };

  const getDaysUntilBooking = (date: string) => {
    const today = new Date();
    const bookingDate = new Date(date);
    const diffTime = bookingDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 0) return 'Past';
    return `In ${diffDays} days`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
            </div>
            
            {/* Search and Filters */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search bookings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              {/* Quick Book Button */}
              <button
                onClick={() => router.push('/user-dashboard')}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
              >
                + New Booking
              </button>
              
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-white text-purple-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'calendar' 
                      ? 'bg-white text-purple-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Calendar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'upcoming', label: 'Upcoming', count: bookings.upcoming.length },
                { id: 'past', label: 'Past', count: bookings.past.length },
                { id: 'cancelled', label: 'Cancelled', count: bookings.cancelled.length }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Enhanced Filters and Sorting */}
        <div className="bg-white rounded-2xl shadow-sm mb-6 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Sort By */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="date">Date</option>
                  <option value="price">Price</option>
                  <option value="service">Service Name</option>
                </select>
              </div>

              {/* Filter by Category */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Filter:</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-1 pr-8 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-[140px]"
                >
                  <option value="all">All Services</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="beauty">Beauty</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="pet">Pet Services</option>
                </select>
              </div>
            </div>

            {/* Results Count */}
            <div className="text-sm text-gray-600">
              {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''} found
            </div>
          </div>
        </div>

        {/* Bookings List/Calendar View */}
        <div className="space-y-4">
          {viewMode === 'calendar' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Calendar View</h3>
                <p className="text-sm text-gray-600">Coming soon! For now, use the list view.</p>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => setViewMode('list')}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                  Switch to List View
                </button>
              </div>
            </div>
          )}
          
          {viewMode === 'list' && (
            <>
              {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <div className="text-gray-400 mb-4">
                <Calendar className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No {activeTab} bookings</h3>
              <p className="text-gray-600">
                {activeTab === 'upcoming' 
                  ? "You don't have any upcoming bookings. Start exploring services!"
                  : activeTab === 'past'
                  ? "You haven't completed any bookings yet."
                  : "You haven't cancelled any bookings."
                }
              </p>
              {activeTab === 'upcoming' && (
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => router.push('/user-dashboard')}
                    className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
                  >
                    🚀 Start Booking
                  </button>
                  <button
                    onClick={() => router.push('/search')}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    🔍 Browse Services
                  </button>
                </div>
              )}
            </div>
          ) : (
                         filteredBookings.map((booking) => (
               <div key={booking.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleViewBookingDetails(booking.id)}>
                 <div className="p-6">
                   <div className="flex items-start gap-4">
                    {/* Service Image */}
                    <img 
                      src={booking.service.image} 
                      alt={booking.service.name}
                      className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                    />
                    
                    {/* Booking Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{booking.service.name}</h3>
                          <p className="text-gray-600">{booking.service.vendor}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm text-gray-600">
                              {booking.service.rating} ({booking.service.reviewCount} reviews)
                            </span>
                          </div>
                        </div>
                        
                                                 {/* Status Badge and Countdown */}
                         <div className="flex flex-col items-end gap-2">
                           <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(booking.status)}`}>
                             {getStatusIcon(booking.status)}
                             <span className="capitalize">{booking.status}</span>
                           </div>
                           {activeTab === 'upcoming' && (
                             <div className="text-xs text-purple-600 font-medium">
                               {getDaysUntilBooking(booking.date)}
                             </div>
                           )}
                         </div>
                      </div>

                      {/* Date & Time */}
                      <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(booking.date).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{booking.time} ({booking.duration})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{booking.address}</span>
                        </div>
                      </div>

                      {/* Notes */}
                      {booking.notes && (
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                          <p className="text-sm text-gray-700">{booking.notes}</p>
                        </div>
                      )}

                      {/* Cancellation Reason */}
                      {booking.cancellationReason && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                          <p className="text-sm text-red-700">
                            <strong>Cancellation Reason:</strong> {booking.cancellationReason}
                          </p>
                        </div>
                      )}

                      {/* Price */}
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-semibold text-gray-900">
                          ${booking.price}
                        </div>
                        
                                                 {/* Action Buttons */}
                         <div className="flex items-center gap-2">
                           {activeTab === 'upcoming' && (
                             <>
                               <button
                                 onClick={(e) => { e.stopPropagation(); handleAddToCalendar(booking); }}
                                 className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                                 title="Add to Calendar"
                               >
                                 📅
                               </button>
                               <button
                                 onClick={(e) => { e.stopPropagation(); handleRescheduleBooking(booking.id); }}
                                 className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                               >
                                 Reschedule
                               </button>
                               <button
                                 onClick={(e) => { e.stopPropagation(); handleCancelBooking(booking.id); }}
                                 className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                               >
                                 Cancel
                               </button>
                             </>
                           )}
                           
                           {activeTab === 'past' && (
                             <>
                               <button
                                 onClick={(e) => { e.stopPropagation(); handleLeaveReview(booking.id); }}
                                 className="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors"
                               >
                                 Leave Review
                               </button>
                               <button
                                 onClick={(e) => { e.stopPropagation(); handleReBook(booking.id); }}
                                 className="px-4 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
                               >
                                 Re-book
                               </button>
                               <button
                                 onClick={(e) => { e.stopPropagation(); handleDownloadReceipt(booking.id); }}
                                 className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                                 title="Download Receipt"
                               >
                                 📄
                               </button>
                             </>
                           )}
                           
                           <button
                             onClick={(e) => { e.stopPropagation(); handleContactVendor(booking.service.vendor); }}
                             className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
                           >
                             Contact Vendor
                           </button>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 