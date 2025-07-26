'use client';
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  CheckCircle, 
  Calendar, 
  Clock, 
  MapPin, 
  Star, 
  Download,
  Share2,
  Home,
  User,
  Phone,
  Mail
} from 'lucide-react';

export default function BookingConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params.serviceId as string;

  // Mock booking data
  const booking = {
    id: 'BK' + Math.random().toString(36).substr(2, 9).toUpperCase(),
    service: {
      name: 'Deep House Cleaning',
      vendor: {
        name: 'Sparkle Clean Pro',
        rating: 4.9,
        reviewCount: 127,
        phone: '(555) 123-4567',
        email: 'contact@sparklecleanpro.com'
      },
      price: 120,
      duration: '3-4 hours',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop'
    },
    date: '2024-01-26',
    time: '10:00 AM',
    user: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '(555) 987-6543',
      address: '123 Main St, New York, NY 10001'
    },
    status: 'confirmed',
    paymentStatus: 'paid',
    createdAt: new Date().toISOString()
  };

  const handleDownloadReceipt = () => {
    // In real app, this would generate and download a PDF receipt
    console.log('Downloading receipt...');
  };

  const handleShare = () => {
    // In real app, this would open share dialog
    navigator.share?.({
      title: 'Booking Confirmation',
      text: `I just booked ${booking.service.name} with ${booking.service.vendor.name}!`,
      url: window.location.href
    });
  };

  const handleGoHome = () => {
    router.push('/user-dashboard');
  };

  const handleViewBookings = () => {
    router.push('/bookings');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Success Message */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
          <p className="text-gray-600">Your booking has been successfully confirmed. We've sent you an email with all the details.</p>
        </div>

        {/* Booking Details Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Booking Details</h2>
              <div className="text-sm text-gray-500">#{booking.id}</div>
            </div>

            {/* Service Info */}
            <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <img 
                src={booking.service.image} 
                alt={booking.service.name}
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div>
                <div className="font-semibold text-gray-900">{booking.service.name}</div>
                <div className="text-sm text-gray-600">{booking.service.vendor.name}</div>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span>{booking.service.vendor.rating} ({booking.service.vendor.reviewCount} reviews)</span>
                </div>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-sm text-gray-600">Date</div>
                  <div className="font-medium text-gray-900">
                    {new Date(booking.date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="text-sm text-gray-600">Time</div>
                  <div className="font-medium text-gray-900">{booking.time}</div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg mb-6">
              <MapPin className="w-5 h-5 text-gray-600 mt-0.5" />
              <div>
                <div className="text-sm text-gray-600">Service Address</div>
                <div className="font-medium text-gray-900">{booking.user.address}</div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Paid</span>
                <span className="text-2xl font-bold text-gray-900">${booking.service.price}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600 font-medium">Payment Confirmed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Vendor Contact */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Contact</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-gray-600" />
                <span className="text-gray-700">{booking.service.vendor.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-600" />
                <span className="text-gray-700">{booking.service.vendor.phone}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-600" />
                <span className="text-gray-700">{booking.service.vendor.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">What's Next?</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium mt-0.5">
                1
              </div>
              <div>
                <div className="font-medium text-gray-900">Confirmation Email</div>
                <div className="text-sm text-gray-600">Check your email for booking confirmation and details</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium mt-0.5">
                2
              </div>
              <div>
                <div className="font-medium text-gray-900">Vendor Contact</div>
                <div className="text-sm text-gray-600">The vendor will contact you within 2 hours to confirm details</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium mt-0.5">
                3
              </div>
              <div>
                <div className="font-medium text-gray-900">Service Day</div>
                <div className="text-sm text-gray-600">The vendor will arrive at your scheduled time</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleDownloadReceipt}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Receipt
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-3">
          <button
            onClick={handleGoHome}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </button>
          <button
            onClick={handleViewBookings}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            View All Bookings
          </button>
        </div>
      </div>
    </div>
  );
} 