'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  Star, 
  CheckCircle,
  CreditCard,
  User,
  Phone,
  Mail
} from 'lucide-react';

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params.serviceId as string;
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [userDetails, setUserDetails] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });
  const [currentStep, setCurrentStep] = useState<'date' | 'details' | 'review' | 'payment'>('date');
  const [service, setService] = useState<any>(null);
  const [availability, setAvailability] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch service details and availability
  useEffect(() => {
    const fetchServiceData = async () => {
      try {
        setLoading(true);
        
        // Fetch service details
        const serviceResponse = await fetch(`/api/services/${serviceId}`);
        if (!serviceResponse.ok) {
          throw new Error('Failed to fetch service details');
        }
        const serviceData = await serviceResponse.json();
        setService(serviceData.service);

        // Fetch availability
        const availabilityResponse = await fetch(`/api/availability/vendor/${serviceData.service.vendor.id}`);
        if (!availabilityResponse.ok) {
          throw new Error('Failed to fetch availability');
        }
        const availabilityData = await availabilityResponse.json();
        setAvailability(availabilityData.availability);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (serviceId) {
      fetchServiceData();
    }
  }, [serviceId]);

  // Mock available dates and times (in real app, this would come from availability API)
  const availableDates = [
    { date: '2024-01-25', day: 'Thursday', available: true },
    { date: '2024-01-26', day: 'Friday', available: true },
    { date: '2024-01-27', day: 'Saturday', available: true },
    { date: '2024-01-28', day: 'Sunday', available: false },
    { date: '2024-01-29', day: 'Monday', available: true },
    { date: '2024-01-30', day: 'Tuesday', available: true },
  ];

  const availableTimes = [
    '9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'
  ];

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleInputChange = (field: string, value: string) => {
    setUserDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleContinue = () => {
    if (currentStep === 'date') {
      if (selectedDate && selectedTime) {
        setCurrentStep('details');
      }
    } else if (currentStep === 'details') {
      setCurrentStep('review');
    } else if (currentStep === 'review') {
      setCurrentStep('payment');
    }
  };

  const handleBack = () => {
    if (currentStep === 'details') {
      setCurrentStep('date');
    } else if (currentStep === 'review') {
      setCurrentStep('details');
    } else if (currentStep === 'payment') {
      setCurrentStep('review');
    }
  };

  const handleConfirmBooking = async () => {
    if (!service || !selectedDate || !selectedTime) {
      setError('Missing required booking information');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Convert time format for API
      const time24Hour = convertTo24Hour(selectedTime);
      
      const bookingData = {
        service_id: parseInt(serviceId),
        vendor_id: service.vendor.id,
        booking_date: selectedDate,
        booking_time: time24Hour,
        user_notes: userDetails.notes,
        custom_fields: {
          customer_name: userDetails.name,
          customer_email: userDetails.email,
          customer_phone: userDetails.phone,
          service_address: userDetails.address
        }
      };

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create booking');
      }

      const bookingResult = await response.json();
      
      // Redirect to confirmation page with booking ID
      router.push(`/booking/${serviceId}/confirmation?bookingId=${bookingResult.booking.id}`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const convertTo24Hour = (time12Hour: string) => {
    const [time, period] = time12Hour.split(' ');
    const [hours, minutes] = time.split(':');
    let hour24 = parseInt(hours);
    
    if (period === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (period === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    
    return `${hour24.toString().padStart(2, '0')}:${minutes}:00`;
  };

  const isFormValid = () => {
    if (currentStep === 'date') {
      return selectedDate && selectedTime;
    }
    if (currentStep === 'details') {
      return userDetails.name && userDetails.email && userDetails.phone && userDetails.address;
    }
    return true;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading service details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">⚠️</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => router.back()}
            className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Service not found</p>
          <button 
            onClick={() => router.back()}
            className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep === 'date' ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  1
                </div>
                <span className={`text-sm ${currentStep === 'date' ? 'text-purple-600 font-medium' : 'text-gray-500'}`}>
                  Date & Time
                </span>
              </div>
              <div className="w-8 h-0.5 bg-gray-200"></div>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep === 'details' ? 'bg-purple-500 text-white' : 
                  ['review', 'payment'].includes(currentStep) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  2
                </div>
                <span className={`text-sm ${currentStep === 'details' ? 'text-purple-600 font-medium' : 
                  ['review', 'payment'].includes(currentStep) ? 'text-green-600' : 'text-gray-500'}`}>
                  Details
                </span>
              </div>
              <div className="w-8 h-0.5 bg-gray-200"></div>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep === 'review' ? 'bg-purple-500 text-white' : 
                  currentStep === 'payment' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  3
                </div>
                <span className={`text-sm ${currentStep === 'review' ? 'text-purple-600 font-medium' : 
                  currentStep === 'payment' ? 'text-green-600' : 'text-gray-500'}`}>
                  Review
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {currentStep === 'date' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Date & Time</h2>
                
                {/* Date Selection */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Available Dates</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Available</span>
                      <div className="w-3 h-3 bg-gray-300 rounded-full ml-3"></div>
                      <span>Unavailable</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {availableDates.map((date) => (
                      <button
                        key={date.date}
                        onClick={() => handleDateSelect(date.date)}
                        disabled={!date.available}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          selectedDate === date.date
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : date.available 
                              ? 'border-gray-200 hover:border-purple-500 hover:bg-purple-50' 
                              : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{date.day}</div>
                            <div className="text-sm text-gray-600">
                              {new Date(date.date).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </div>
                          </div>
                          {selectedDate === date.date && (
                            <CheckCircle className="w-5 h-5 text-purple-600" />
                          )}
                        </div>
                        {!date.available && (
                          <div className="text-xs mt-1 text-gray-400">Unavailable</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Selection */}
                {selectedDate && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Times</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {availableTimes.map((time) => (
                        <button
                          key={time}
                          onClick={() => handleTimeSelect(time)}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            selectedTime === time 
                              ? 'border-purple-500 bg-purple-50 text-purple-700' 
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {selectedDate && !selectedTime && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm">Please select a time slot to continue</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 'details' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Details</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={userDetails.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={userDetails.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter your email"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={userDetails.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter your phone number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Address *
                    </label>
                    <textarea
                      value={userDetails.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter the address where you need the service"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Special Instructions (Optional)
                    </label>
                    <textarea
                      value={userDetails.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Any special instructions or requirements"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 'review' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Review Your Booking</h2>
                
                <div className="space-y-6">
                  {/* Service Details */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Service Details</h3>
                    <div className="flex items-center gap-4">
                      <img 
                        src={service.images?.[0] || '/placeholder-service.jpg'} 
                        alt={service.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{service.name}</div>
                        <div className="text-sm text-gray-600">{service.vendor.name}</div>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span>{service.vendor.rating} ({service.vendor.review_count} reviews)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Date & Time</h3>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(selectedDate).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 mt-1">
                      <Clock className="w-4 h-4" />
                      <span>{selectedTime}</span>
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Contact Details</h3>
                    <div className="space-y-2 text-gray-700">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{userDetails.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span>{userDetails.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span>{userDetails.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{userDetails.address}</span>
                      </div>
                    </div>
                    {userDetails.notes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Special Instructions:</div>
                        <div className="text-sm text-gray-600">{userDetails.notes}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 'payment' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Payment</h2>
                
                <div className="space-y-6">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Payment Method</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 border border-purple-500 bg-purple-50 rounded-lg">
                        <CreditCard className="w-5 h-5 text-purple-600" />
                        <span className="font-medium">Credit/Debit Card</span>
                        <CheckCircle className="w-5 h-5 text-purple-600 ml-auto" />
                      </div>
                      <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                        <div className="w-5 h-5 border-2 border-gray-300 rounded"></div>
                        <span>PayPal</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Card Details</h3>
                    <div className="space-y-4">
                      <input
                        type="text"
                        placeholder="Card Number"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          type="text"
                          placeholder="MM/YY"
                          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <input
                          type="text"
                          placeholder="CVC"
                          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
              {currentStep !== 'date' && (
                <button
                  onClick={handleBack}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              )}
              
              <div className="ml-auto">
                {currentStep === 'payment' ? (
                  <button
                    onClick={handleConfirmBooking}
                    disabled={submitting}
                    className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Creating Booking...' : 'Confirm Booking'}
                  </button>
                ) : (
                  <button
                    onClick={handleContinue}
                    disabled={!isFormValid()}
                    className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4">Booking Summary</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <img 
                    src={service.images?.[0] || '/placeholder-service.jpg'} 
                    alt={service.name}
                    className="w-12 h-12 object-cover rounded-lg"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{service.name}</div>
                    <div className="text-sm text-gray-600">{service.vendor.name}</div>
                  </div>
                </div>

                {selectedDate && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(selectedDate).toLocaleDateString('en-US', { 
                      weekday: 'short',
                      month: 'short', 
                      day: 'numeric' 
                    })}</span>
                    {selectedTime && (
                      <>
                        <span>•</span>
                        <span>{selectedTime}</span>
                      </>
                    )}
                  </div>
                )}

                {selectedDate && selectedTime && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Date & Time Selected</span>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Service Price</span>
                    <span className="line-through text-gray-500">${service.original_price || service.price}</span>
                  </div>
                  {service.original_price && (
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Discount</span>
                      <span className="text-green-600">-${service.original_price - service.price}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>${service.price}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 