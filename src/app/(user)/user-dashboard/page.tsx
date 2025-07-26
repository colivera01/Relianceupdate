'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Star, Clock, Heart, Share2, Play, TrendingUp, Zap, Users, Calendar, Award, Bell } from 'lucide-react';

export default function UserDashboardPage() {
  const router = useRouter();

  // Mock data for Gen Z appeal
  const trendingServices = [
    { id: 1, name: 'TikTok Style Haircut', vendor: 'Style Studio NYC', rating: 4.8, distance: '0.8 mi', price: '$45', image: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=300&h=200&fit=crop', trending: true },
    { id: 2, name: 'Instagram-Worthy Nails', vendor: 'Nail Art Collective', rating: 4.9, distance: '1.2 mi', price: '$35', image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=300&h=200&fit=crop', trending: true },
    { id: 3, name: 'Viral TikTok Makeup', vendor: 'Beauty Bar', rating: 4.7, distance: '0.5 mi', price: '$55', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=300&h=200&fit=crop', trending: true },
    { id: 4, name: 'Social Media Photography', vendor: 'Photo Studio Pro', rating: 4.6, distance: '1.5 mi', price: '$120', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=300&h=200&fit=crop', trending: false },
  ];

  const nearbyVendors = [
    { id: 1, name: 'Urban Style Co.', service: 'Hair & Beauty', rating: 4.8, distance: '0.3 mi', image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=200&fit=crop', available: true },
    { id: 2, name: 'Tech Repair Hub', service: 'Electronics', rating: 4.6, distance: '0.7 mi', image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&h=200&fit=crop', available: true },
    { id: 3, name: 'Fitness Studio', service: 'Health & Wellness', rating: 4.9, distance: '1.1 mi', image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop', available: false },
    { id: 4, name: 'Creative Design Lab', service: 'Art & Design', rating: 4.7, distance: '0.9 mi', image: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=300&h=200&fit=crop', available: true },
  ];

  const quickStats = [
    { label: 'Bookings This Month', value: '8', icon: Calendar, color: 'blue' },
    { label: 'Favorites', value: '23', icon: Heart, color: 'pink' },
    { label: 'Reviews Given', value: '12', icon: Star, color: 'yellow' },
    { label: 'Money Saved', value: '$156', icon: TrendingUp, color: 'green' },
  ];

  // Mock personalized data - replace with real API calls
  const personalizedServices = [
    { 
      id: 5, 
      name: 'Deep House Cleaning', 
      vendor: 'Sparkle Clean Pro', 
      rating: 4.9, 
      distance: '0.4 mi', 
      price: '$120', 
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop',
      reason: 'Based on your last booking',
      confidence: 0.95,
      category: 'cleaning'
    },
    { 
      id: 6, 
      name: 'Plumbing Repair', 
      vendor: 'Quick Fix Plumbing', 
      rating: 4.7, 
      distance: '0.6 mi', 
      price: '$85', 
      image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&h=200&fit=crop',
      reason: 'Popular in your neighborhood',
      confidence: 0.88,
      category: 'plumbing'
    },
    { 
      id: 7, 
      name: 'Landscape Design', 
      vendor: 'Green Thumb Gardens', 
      rating: 4.8, 
      distance: '1.1 mi', 
      price: '$200', 
      image: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=300&h=200&fit=crop',
      reason: 'Matches your home type',
      confidence: 0.82,
      category: 'landscaping'
    },
    { 
      id: 8, 
      name: 'Pet Grooming', 
      vendor: 'Pawsome Grooming', 
      rating: 4.6, 
      distance: '0.8 mi', 
      price: '$45', 
      image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300&h=200&fit=crop',
      reason: 'Based on your pet profile',
      confidence: 0.79,
      category: 'pet_services'
    },
  ];

  const recentlyViewedServices = [
    { id: 1, name: 'TikTok Style Haircut', vendor: 'Style Studio NYC', lastViewed: '2 hours ago' },
    { id: 2, name: 'Instagram-Worthy Nails', vendor: 'Nail Art Collective', lastViewed: '1 day ago' },
    { id: 3, name: 'Viral TikTok Makeup', vendor: 'Beauty Bar', lastViewed: '3 days ago' },
  ];

  const smartCategories = [
    { name: 'Home Services', icon: '🏠', count: 12, reason: 'Based on your home type' },
    { name: 'Beauty & Wellness', icon: '💄', count: 8, reason: 'Your recent bookings' },
    { name: 'Tech Support', icon: '💻', count: 5, reason: 'Your device preferences' },
    { name: 'Pet Care', icon: '🐕', count: 3, reason: 'Your pet profile' },
  ];

  // Social proof data - local activity indicators
  const socialProofData = [
    {
      serviceId: 1,
      serviceName: 'TikTok Style Haircut',
      vendor: 'Style Studio NYC',
      bookingsToday: 23,
      area: 'Downtown',
      timeFrame: 'today'
    },
    {
      serviceId: 2,
      serviceName: 'Instagram-Worthy Nails',
      vendor: 'Nail Art Collective',
      bookingsToday: 18,
      area: 'Midtown',
      timeFrame: 'today'
    },
    {
      serviceId: 3,
      serviceName: 'Viral TikTok Makeup',
      vendor: 'Beauty Bar',
      bookingsToday: 31,
      area: 'Your Area',
      timeFrame: 'today'
    },
    {
      serviceId: 4,
      serviceName: 'Social Media Photography',
      vendor: 'Photo Studio Pro',
      bookingsToday: 12,
      area: 'Downtown',
      timeFrame: 'today'
    }
  ];

  // Community reviews from local neighborhood
  const communityReviews = [
    {
      id: 1,
      serviceName: 'Deep House Cleaning',
      vendor: 'Sparkle Clean Pro',
      reviewer: 'Sarah M.',
      neighborhood: 'Downtown',
      rating: 5,
      review: 'Amazing service! My apartment looks brand new. Highly recommend!',
      date: '2 hours ago',
      verified: true,
      helpful: 8
    },
    {
      id: 2,
      serviceName: 'Plumbing Repair',
      vendor: 'Quick Fix Plumbing',
      reviewer: 'Mike R.',
      neighborhood: 'Midtown',
      rating: 5,
      review: 'Fixed my leaky faucet in 30 minutes. Professional and affordable!',
      date: '5 hours ago',
      verified: true,
      helpful: 12
    },
    {
      id: 3,
      serviceName: 'Landscape Design',
      vendor: 'Green Thumb Gardens',
      reviewer: 'Lisa K.',
      neighborhood: 'Your Area',
      rating: 4,
      review: 'Beautiful garden transformation. Great communication throughout.',
      date: '1 day ago',
      verified: true,
      helpful: 6
    },
    {
      id: 4,
      serviceName: 'Pet Grooming',
      vendor: 'Pawsome Grooming',
      reviewer: 'David T.',
      neighborhood: 'Downtown',
      rating: 5,
      review: 'My dog loves going here! Clean facility and gentle staff.',
      date: '2 days ago',
      verified: true,
      helpful: 15
    }
  ];

  // Price comparison data
  const priceComparisonData = [
    {
      serviceName: 'Deep House Cleaning',
      vendors: [
        { name: 'Sparkle Clean Pro', price: 120, rating: 4.9, distance: '0.4 mi', features: ['Eco-friendly', 'Same day', 'Insurance'] },
        { name: 'Quick Clean Co', price: 95, rating: 4.6, distance: '0.8 mi', features: ['Standard', 'Next day', 'Basic'] },
        { name: 'Premium Cleaners', price: 150, rating: 4.8, distance: '1.2 mi', features: ['Premium', 'Same day', 'Insurance', 'Deep clean'] }
      ]
    },
    {
      serviceName: 'Plumbing Repair',
      vendors: [
        { name: 'Quick Fix Plumbing', price: 85, rating: 4.7, distance: '0.6 mi', features: ['24/7', 'Emergency', 'Warranty'] },
        { name: 'Reliable Plumbers', price: 110, rating: 4.5, distance: '1.1 mi', features: ['Standard', 'Next day', 'Basic warranty'] },
        { name: 'Elite Plumbing', price: 130, rating: 4.9, distance: '1.5 mi', features: ['Premium', 'Same day', 'Extended warranty'] }
      ]
    }
  ];

  // Smart notifications and alerts
  const smartNotifications = [
    {
      id: 1,
      type: 'service_reminder',
      title: 'Quarterly Cleaning Due',
      message: 'Time to schedule your quarterly deep cleaning',
      service: 'Deep House Cleaning',
      dueDate: '2024-02-15',
      priority: 'medium',
      icon: '🧹'
    },
    {
      id: 2,
      type: 'price_drop',
      title: 'Price Drop Alert!',
      message: 'Your favorite service is now 20% off',
      service: 'Instagram-Worthy Nails',
      vendor: 'Nail Art Collective',
      discount: 20,
      priority: 'high',
      icon: '💰'
    },
    {
      id: 3,
      type: 'new_vendor',
      title: 'New Vendors in Your Area',
      message: '3 new vendors joined in your area',
      count: 3,
      area: 'Downtown',
      priority: 'low',
      icon: '🆕'
    },
    {
      id: 4,
      type: 'calendar_sync',
      title: 'Calendar Sync Available',
      message: 'Sync your bookings with Google Calendar',
      priority: 'low',
      icon: '📅'
    }
  ];

  // Service history and analytics
  const serviceHistory = [
    {
      id: 1,
      serviceName: 'Deep House Cleaning',
      vendor: 'Sparkle Clean Pro',
      date: '2024-01-15',
      price: 120,
      rating: 5,
      status: 'completed'
    },
    {
      id: 2,
      serviceName: 'Plumbing Repair',
      vendor: 'Quick Fix Plumbing',
      date: '2024-01-10',
      price: 85,
      rating: 4,
      status: 'completed'
    },
    {
      id: 3,
      serviceName: 'Pet Grooming',
      vendor: 'Pawsome Grooming',
      date: '2024-01-05',
      price: 45,
      rating: 5,
      status: 'completed'
    }
  ];

  // Spending analytics
  const spendingAnalytics = {
    monthly: {
      january: 250,
      february: 180,
      march: 320,
      april: 195,
      may: 280,
      june: 220
    },
    yearly: 2024,
    totalSpent: 1445,
    averagePerMonth: 240.83,
    savings: 156,
    topCategories: [
      { category: 'Cleaning', spent: 480, percentage: 33 },
      { category: 'Plumbing', spent: 340, percentage: 24 },
      { category: 'Pet Care', spent: 225, percentage: 16 }
    ]
  };

  // Vendor performance comparison
  const vendorPerformance = [
    {
      vendor: 'Sparkle Clean Pro',
      totalBookings: 8,
      averageRating: 4.9,
      totalSpent: 960,
      lastUsed: '2024-01-15',
      reliability: 98
    },
    {
      vendor: 'Quick Fix Plumbing',
      totalBookings: 3,
      averageRating: 4.3,
      totalSpent: 255,
      lastUsed: '2024-01-10',
      reliability: 95
    },
    {
      vendor: 'Pawsome Grooming',
      totalBookings: 5,
      averageRating: 4.8,
      totalSpent: 225,
      lastUsed: '2024-01-05',
      reliability: 97
    }
  ];

  // Seasonal suggestions based on weather and time of year
  const seasonalSuggestions = [
    {
      id: 9,
      name: 'AC Maintenance',
      vendor: 'Cool Comfort Pro',
      rating: 4.8,
      distance: '0.9 mi',
      price: '$75',
      image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=300&h=200&fit=crop',
      reason: 'Summer is here! Keep cool',
      urgency: 'high',
      season: 'summer'
    },
    {
      id: 10,
      name: 'Gutter Cleaning',
      vendor: 'Rain Ready Services',
      rating: 4.6,
      distance: '1.2 mi',
      price: '$120',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop',
      reason: 'Prepare for fall weather',
      urgency: 'medium',
      season: 'fall'
    },
    {
      id: 11,
      name: 'Holiday Decorating',
      vendor: 'Festive Lights Co',
      rating: 4.9,
      distance: '0.7 mi',
      price: '$150',
      image: 'https://images.unsplash.com/photo-1543589923-d58f523daec0?w=300&h=200&fit=crop',
      reason: 'Get ready for the holidays',
      urgency: 'medium',
      season: 'winter'
    },
    {
      id: 12,
      name: 'Spring Cleaning',
      vendor: 'Fresh Start Cleaners',
      rating: 4.7,
      distance: '0.5 mi',
      price: '$180',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop',
      reason: 'Perfect time for deep cleaning',
      urgency: 'low',
      season: 'spring'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header with Search */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">

            
            {/* Search Bar - TikTok/Instagram Style */}
            <div className="flex-1 max-w-md mx-8">
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const searchTerm = formData.get('search') as string;
                if (searchTerm.trim()) {
                  router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
                }
              }} className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  name="search"
                  type="text"
                  placeholder="Search for services, vendors, or trends..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-full border-0 focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all duration-200"
                />
              </form>
            </div>


          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Quick Book Section */}
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 mb-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Ready to Book?</h2>
                  <p className="text-purple-100 mb-4">Find and book services in just a few clicks</p>
                  <div>
                    <button
                      onClick={() => router.push('/search')}
                      className="bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                    >
                      🔍 Browse Services
                    </button>
                  </div>
                </div>
                <div className="hidden md:block">
                  <div className="text-6xl">🚀</div>
                </div>
              </div>
            </div>

        {/* Quick Stats - Instagram Story Style */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {quickStats.map((stat, index) => (
            <div key={index} className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full bg-${stat.color}-100`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trending Services - Netflix Style */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-red-500" />
            <h2 className="text-xl font-bold text-gray-900">🔥 Trending Now</h2>
            <span className="text-sm text-gray-500">• Based on your area</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {trendingServices.map((service) => {
              const socialProof = socialProofData.find(sp => sp.serviceId === service.id);
              return (
                <div key={service.id} className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="relative">
                    <img 
                      src={service.image} 
                      alt={service.name}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {service.trending && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                        🔥 Trending
                      </div>
                    )}
                    <button className="absolute top-2 right-2 p-2 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <Heart className="w-4 h-4 text-pink-500" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                      <div className="flex items-center gap-2 text-white">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{service.rating}</span>
                        <span className="text-xs">• {service.distance}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1">{service.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{service.vendor}</p>
                    
                    {/* Social Proof Indicator */}
                    {socialProof && (
                      <div className="mb-3 p-2 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 text-green-700">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-xs font-medium">
                            {socialProof.bookingsToday} people in {socialProof.area} booked this {socialProof.timeFrame}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-purple-600">{service.price}</span>
                      <button 
                        onClick={() => router.push(`/booking/${service.id}`)}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Personalized Services - TikTok/Instagram Style */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-bold text-gray-900">👋 For You</h2>
            <span className="text-sm text-gray-500">• Based on your recent activity</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {personalizedServices.map((service) => (
              <div key={service.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200">
                <div className="relative">
                  <img 
                    src={service.image} 
                    alt={service.name}
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <div className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {service.confidence * 100}%
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">{service.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{service.reason}</p>
                                      <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-purple-600">{service.price}</span>
                      <button 
                        onClick={() => router.push(`/booking/${service.id}`)}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
                      >
                        Book Now
                      </button>
                    </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Seasonal Suggestions - Weather-based */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <h2 className="text-xl font-bold text-gray-900">🌤️ Seasonal Suggestions</h2>
            <span className="text-sm text-gray-500">• Based on weather and time of year</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {seasonalSuggestions.map((service) => (
              <div key={service.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200">
                <div className="relative">
                  <img 
                    src={service.image} 
                    alt={service.name}
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      service.urgency === 'high' ? 'bg-red-100 text-red-700' :
                      service.urgency === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {service.urgency === 'high' ? '🔥 Urgent' : 
                       service.urgency === 'medium' ? '⚡ Recommended' : '💡 Good to do'}
                    </div>
                  </div>
                  <div className="absolute top-2 right-2">
                    <div className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      {service.season}
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">{service.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{service.reason}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-orange-600">{service.price}</span>
                    <button 
                      onClick={() => router.push(`/booking/${service.id}`)}
                      className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:from-orange-600 hover:to-red-600 transition-all duration-200"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recently Viewed - Amazon Style */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900">👀 Recently Viewed</h2>
            <span className="text-sm text-gray-500">• {recentlyViewedServices.length} services</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentlyViewedServices.map((service) => (
              <div key={service.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200">
                <div className="relative">
                  <img 
                    src={service.image} 
                    alt={service.name}
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <div className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {service.lastViewed}
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">{service.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{service.vendor}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span>{service.rating}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{service.distance}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => router.push(`/service/${service.id}`)}
                    className="w-full bg-blue-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Categories - TikTok/Instagram Style */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/50">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-bold text-gray-900">🧠 Smart Categories</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {smartCategories.map((category, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl">{category.icon}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{category.name}</h3>
                <p className="text-sm text-gray-600">{category.reason}</p>
                <p className="text-sm text-gray-500 mt-1">({category.count} services)</p>
              </div>
            ))}
          </div>
        </div>

        {/* Community Reviews - Local Neighborhood */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-green-500" />
            <h2 className="text-xl font-bold text-gray-900">🏘️ Community Reviews</h2>
            <span className="text-sm text-gray-500">• From your neighborhood</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {communityReviews.map((review) => (
              <div key={review.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-200 border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-400 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {review.reviewer.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{review.reviewer}</span>
                        {review.verified && (
                          <span className="text-blue-500 text-xs">✓ Verified</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <span>{review.neighborhood}</span>
                        <span>•</span>
                        <span>{review.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`w-4 h-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                      />
                    ))}
                  </div>
                </div>
                
                <div className="mb-3">
                  <h4 className="font-semibold text-gray-900 mb-1">{review.serviceName}</h4>
                  <p className="text-sm text-gray-600 mb-2">{review.vendor}</p>
                  <p className="text-gray-700 text-sm leading-relaxed">"{review.review}"</p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <button className="flex items-center gap-1 hover:text-blue-500 transition-colors">
                      <span>👍</span>
                      <span>{review.helpful} helpful</span>
                    </button>
                  </div>
                  <button 
                    onClick={() => router.push(`/service/${review.id}`)}
                    className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors"
                  >
                    View Service
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-6">
            <button className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-6 py-3 rounded-full font-medium hover:from-green-600 hover:to-blue-600 transition-all duration-200">
              See More Community Reviews
            </button>
          </div>
        </div>

        {/* Smart Notifications & Alerts */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-orange-500" />
            <h2 className="text-xl font-bold text-gray-900">🔔 Smart Notifications</h2>
            <span className="text-sm text-gray-500">• Personalized alerts and reminders</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {smartNotifications.map((notification) => (
              <div key={notification.id} className={`bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-200 border-l-4 ${
                notification.priority === 'high' ? 'border-l-red-500' :
                notification.priority === 'medium' ? 'border-l-yellow-500' :
                'border-l-blue-500'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{notification.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        notification.priority === 'high' ? 'bg-red-100 text-red-700' :
                        notification.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {notification.priority}
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{notification.message}</p>
                    
                    {notification.type === 'service_reminder' && (
                      <div className="text-sm text-gray-500 mb-3">
                        Due: {notification.dueDate}
                      </div>
                    )}
                    
                    {notification.type === 'price_drop' && (
                      <div className="text-sm text-green-600 font-medium mb-3">
                        Save ${notification.discount}%
                      </div>
                    )}
                    
                    {notification.type === 'new_vendor' && (
                      <div className="text-sm text-blue-600 mb-3">
                        {notification.count} new vendors in {notification.area}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-orange-600 hover:to-red-600 transition-all duration-200">
                        {notification.type === 'service_reminder' ? 'Schedule Now' :
                         notification.type === 'price_drop' ? 'Book Now' :
                         notification.type === 'new_vendor' ? 'View Vendors' :
                         'Connect'}
                      </button>
                      <button className="text-gray-500 hover:text-gray-700 text-sm">
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Price Comparison */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-bold text-gray-900">💰 Price Comparison</h2>
            <span className="text-sm text-gray-500">• Compare vendors side-by-side</span>
          </div>
          
          <div className="space-y-6">
            {priceComparisonData.map((comparison, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">{comparison.serviceName}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {comparison.vendors.map((vendor, vendorIndex) => (
                    <div key={vendorIndex} className={`p-4 rounded-xl border-2 ${
                      vendorIndex === 0 ? 'border-green-200 bg-green-50' :
                      vendorIndex === 1 ? 'border-blue-200 bg-blue-50' :
                      'border-purple-200 bg-purple-50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{vendor.name}</h4>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm">{vendor.rating}</span>
                        </div>
                      </div>
                      
                      <div className="text-2xl font-bold text-gray-900 mb-2">
                        ${vendor.price}
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-3">
                        {vendor.distance} away
                      </div>
                      
                      <div className="space-y-1 mb-4">
                        {vendor.features.map((feature, featureIndex) => (
                          <div key={featureIndex} className="flex items-center gap-2 text-xs">
                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                            <span className="text-gray-600">{feature}</span>
                          </div>
                        ))}
                      </div>
                      
                      <button 
                        onClick={() => router.push(`/service/${comparison.serviceName.toLowerCase().replace(/\s+/g, '-')}`)}
                        className={`w-full py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          vendorIndex === 0 ? 'bg-green-500 text-white hover:bg-green-600' :
                          vendorIndex === 1 ? 'bg-blue-500 text-white hover:bg-blue-600' :
                          'bg-purple-500 text-white hover:bg-purple-600'
                        }`}
                      >
                        Book Now
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analytics Dashboard */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <h2 className="text-xl font-bold text-gray-900">📊 Analytics Dashboard</h2>
            <span className="text-sm text-gray-500">• Your service insights and savings</span>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Spending Analytics */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">💰 Spending Analytics</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                  <div className="text-2xl font-bold text-gray-900">${spendingAnalytics.totalSpent}</div>
                  <div className="text-sm text-gray-600">Total Spent</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl">
                  <div className="text-2xl font-bold text-green-600">${spendingAnalytics.savings}</div>
                  <div className="text-sm text-gray-600">Money Saved</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Top Categories</h4>
                {spendingAnalytics.topCategories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{category.category}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full" 
                          style={{ width: `${category.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">${category.spent}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vendor Performance */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">🏆 Vendor Performance</h3>
              
              <div className="space-y-4">
                {vendorPerformance.map((vendor, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{vendor.vendor}</h4>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{vendor.averageRating}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Bookings:</span>
                        <span className="font-medium ml-1">{vendor.totalBookings}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Spent:</span>
                        <span className="font-medium ml-1">${vendor.totalSpent}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Reliability:</span>
                        <span className="font-medium ml-1">{vendor.reliability}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Last Used:</span>
                        <span className="font-medium ml-1">{vendor.lastUsed}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Service History */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mt-6">
            <h3 className="font-semibold text-gray-900 mb-4">📋 Service History</h3>
            
            <div className="space-y-3">
              {serviceHistory.map((service) => (
                <div key={service.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {service.serviceName.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{service.serviceName}</h4>
                      <p className="text-sm text-gray-600">{service.vendor}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-medium text-gray-900">${service.price}</div>
                      <div className="text-sm text-gray-600">{service.date}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`w-4 h-4 ${i < service.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                        />
                      ))}
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      service.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {service.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 