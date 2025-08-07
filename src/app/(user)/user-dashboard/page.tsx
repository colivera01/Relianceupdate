'use client';
import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Clock, Heart, Share2, Play, TrendingUp, Zap, Users, Calendar, Award } from 'lucide-react';

export default function UserDashboardPage() {
  const [location, setLocation] = useState('New York, NY');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch user profile data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/customer/profile', {
          headers: {
            'Authorization': 'Bearer temp-jwt-token'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUserData(data.profile);
          // Update location based on user data
          if (data.profile.city && data.profile.state) {
            setLocation(`${data.profile.city}, ${data.profile.state}`);
          }
        } else {
          setError('Failed to fetch user data');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Failed to fetch user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Display user registration data at the top
  const renderUserInfo = () => {
    if (!userData) return null;

    return (
      <div className="mb-8">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {userData.firstName?.charAt(0)}{userData.lastName?.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Welcome back, {userData.firstName} {userData.lastName}!
              </h2>
              <p className="text-gray-600">Ready to discover amazing services?</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <h4 className="font-semibold text-gray-700">Contact Information</h4>
              <p className="text-sm text-gray-600">Email: {userData.email}</p>
              <p className="text-sm text-gray-600">Phone: {userData.phone}</p>
              <p className="text-sm text-gray-600">Location: {userData.city}, {userData.state}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700">Account Details</h4>
              <p className="text-sm text-gray-600">Member since: {new Date(userData.createdAt).toLocaleDateString()}</p>
              <p className="text-sm text-gray-600">Status: {userData.isActive ? 'Active' : 'Inactive'}</p>
            </div>
            {userData.bio && (
              <div>
                <h4 className="font-semibold text-gray-700">About You</h4>
                <p className="text-sm text-gray-600">{userData.bio}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header with Search */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Reliance
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{location}</span>
              </div>
            </div>
            
            {/* Search Bar - TikTok/Instagram Style */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search for services, vendors, or trends..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-full border-0 focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all duration-200"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Heart className="w-5 h-5 text-pink-500" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Share2 className="w-5 h-5 text-blue-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {renderUserInfo()}
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
            {trendingServices.map((service) => (
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
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-purple-600">{service.price}</span>
                    <button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200">
                      Book Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nearby Vendors - Amazon Style */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900">📍 Near You</h2>
            <span className="text-sm text-gray-500">• {nearbyVendors.length} vendors available</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {nearbyVendors.map((vendor) => (
              <div key={vendor.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200">
                <div className="relative">
                  <img 
                    src={vendor.image} 
                    alt={vendor.name}
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      vendor.available 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {vendor.available ? 'Available' : 'Busy'}
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">{vendor.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{vendor.service}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span>{vendor.rating}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{vendor.distance}</span>
                    </div>
                  </div>
                  <button className="w-full bg-blue-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Social Features - TikTok/Instagram Style */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/50">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-bold text-gray-900">💬 Community Highlights</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <Award className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Top Rated</h3>
              <p className="text-sm text-gray-600">See what others are loving</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Quick Book</h3>
              <p className="text-sm text-gray-600">Book in under 30 seconds</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-blue-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <Share2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Share & Earn</h3>
              <p className="text-sm text-gray-600">Get rewards for referrals</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 