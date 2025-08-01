'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Star, 
  MapPin, 
  Filter,
  Heart,
  Share2,
  Play,
  Users,
  Clock,
  TrendingUp,
  X,
  SlidersHorizontal,
  ChevronDown,
  Phone,
  MessageSquare,
  Lock
} from 'lucide-react';

export default function PublicBrowsePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [distance, setDistance] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'reviews'>('distance');

  // Mock data for demonstration
  const categories = [
    { 
      id: 'automotive', 
      name: 'Automotive', 
      icon: '🚗', 
      count: 12,
      description: 'Car repair, maintenance, detailing, and roadside assistance',
      popularServices: ['Oil Change', 'Brake Service', 'Tire Rotation', 'Engine Repair']
    },
    { 
      id: 'home', 
      name: 'Home Services', 
      icon: '🏠', 
      count: 45,
      description: 'Plumbing, electrical, cleaning, and home maintenance',
      popularServices: ['Plumbing Repair', 'House Cleaning', 'Electrical Work', 'HVAC Service']
    },
    { 
      id: 'tech', 
      name: 'Technology', 
      icon: '💻', 
      count: 23,
      description: 'Computer repair, IT support, and tech consulting',
      popularServices: ['Computer Repair', 'Network Setup', 'Data Recovery', 'IT Consulting']
    },
    { 
      id: 'health', 
      name: 'Health & Wellness', 
      icon: '💊', 
      count: 18,
      description: 'Personal training, massage therapy, and wellness services',
      popularServices: ['Personal Training', 'Massage Therapy', 'Nutrition Coaching', 'Yoga Classes']
    },
    { 
      id: 'beauty', 
      name: 'Beauty & Personal Care', 
      icon: '💄', 
      count: 31,
      description: 'Hair styling, makeup, nail care, and beauty treatments',
      popularServices: ['Hair Styling', 'Makeup Artistry', 'Nail Care', 'Facial Treatments']
    },
    { 
      id: 'education', 
      name: 'Education', 
      icon: '📚', 
      count: 15,
      description: 'Tutoring, language lessons, and educational services',
      popularServices: ['Math Tutoring', 'Language Lessons', 'Test Prep', 'Music Lessons']
    }
  ];

     const featuredVendors = [
     {
       id: 1,
       name: 'AutoCare Pro',
       category: 'Automotive',
       rating: 4.8,
       reviews: 127,
       distance: 2.3,
       experience: '8 years',
       description: 'Professional automotive repair with quick turnaround times. Specialists in German and Japanese vehicles.',
       image: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=300&fit=crop&crop=center',
       featured: true,
       videoProfile: true,
       verified: true,
       availability: 'immediate',
       services: ['Oil Change', 'Brake Service', 'Engine Repair', 'Diagnostic Testing'],
       specialties: ['German Vehicles', 'Japanese Vehicles', 'Performance Tuning']
     },
     {
       id: 2,
       name: 'HomeFix Solutions',
       category: 'Home Services',
       rating: 4.9,
       reviews: 89,
       distance: 1.7,
       experience: '12 years',
       description: 'Complete home repair and maintenance services. From plumbing to electrical, we handle it all.',
       image: 'https://images.unsplash.com/photo-1581578731548-c6e0ad4d4b7e?w=400&h=300&fit=crop&crop=center',
       featured: false,
       videoProfile: true,
       verified: true,
       availability: 'today',
       services: ['Plumbing Repair', 'Electrical Work', 'HVAC Service', 'General Repairs'],
       specialties: ['Emergency Repairs', 'Preventive Maintenance', 'Home Inspections']
     },
     {
       id: 3,
       name: 'TechWise Consulting',
       category: 'Technology',
       rating: 4.7,
       reviews: 56,
       distance: 4.1,
       experience: '5 years',
       description: 'IT consulting and computer repair services. We make technology work for your business.',
       image: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=300&fit=crop&crop=center',
       featured: true,
       videoProfile: false,
       verified: false,
       availability: 'weekly',
       services: ['Computer Repair', 'Network Setup', 'Data Recovery', 'IT Consulting'],
       specialties: ['Business IT', 'Data Security', 'Cloud Solutions']
     }
   ];

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'immediate': return 'bg-green-500';
      case 'today': return 'bg-yellow-500';
      case 'weekly': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getAvailabilityText = (availability: string) => {
    switch (availability) {
      case 'immediate': return 'Available Now';
      case 'today': return 'Available Today';
      case 'weekly': return 'Available This Week';
      default: return 'Check Availability';
    }
  };

  const getPriceRangeColor = (priceRange: string) => {
    switch (priceRange) {
      case 'budget': return 'text-green-600';
      case 'moderate': return 'text-yellow-600';
      case 'premium': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getPriceRangeText = (priceRange: string) => {
    switch (priceRange) {
      case 'budget': return 'Budget';
      case 'moderate': return 'Moderate';
      case 'premium': return 'Premium';
      default: return 'Standard';
    }
  };

  const filteredVendors = featuredVendors.filter(vendor => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         vendor.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || vendor.category.toLowerCase() === selectedCategory;
    const matchesDistance = vendor.distance <= distance;
    
    return matchesSearch && matchesCategory && matchesDistance;
  });

  const sortedVendors = [...filteredVendors].sort((a, b) => {
    switch (sortBy) {
      case 'distance':
        return a.distance - b.distance;
      case 'rating':
        return b.rating - a.rating;
      case 'reviews':
        return b.reviews - a.reviews;
      default:
        return a.distance - b.distance;
    }
  });

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setDistance(25);
    setSortBy('distance');
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId === 'all' ? 'all' : categories.find(c => c.id === categoryId)?.name || 'all');
    setShowFilters(false);
  };

  const handleShareVendor = (vendorId: number, vendorName: string) => {
    const url = `${window.location.origin}/vendor/${vendorId}`;
    const text = `Check out ${vendorName} on Reliance!`;
    
    if (navigator.share) {
      navigator.share({
        title: vendorName,
        text: text,
        url: url
      });
    } else {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(`${text} ${url}`);
      // You could add a toast notification here
    }
  };

  const handleViewProfile = (vendorId: number) => {
    // This would navigate to the vendor profile page
    window.location.href = `/vendor/${vendorId}`;
  };

  const handleCardClick = (vendorId: number, event: React.MouseEvent) => {
    // Prevent card click if user clicked on a button
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    handleViewProfile(vendorId);
  };

  const handleContactAction = (action: 'call' | 'message') => {
    // Show registration prompt for public users
    alert('Please sign up to contact vendors directly!');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-3">
                <img src="/reliance-logo.png" alt="Reliance" className="h-8 w-8" />
                <span className="text-xl font-bold text-gray-900">RELIANCE</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/auth/register?type=user">
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                  Sign Up
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Browse Local Services
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Find trusted local professionals in your area. Browse services, read reviews, and see vendors in action.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="What service do you need?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name} ({category.count})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Button 
                onClick={() => setShowFilters(!showFilters)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>

          {/* Basic Filters Only */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Basic Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  Clear All
                </button>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Distance</label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={distance}
                    onChange={(e) => setDistance(Number(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-600">{distance} miles</span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'distance' | 'rating' | 'reviews')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="distance">Distance</option>
                    <option value="rating">Rating</option>
                    <option value="reviews">Most Reviews</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Categories */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Popular Categories</h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((category) => (
              <Card 
                key={category.id} 
                className="text-center hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => handleCategoryClick(category.id)}
              >
                <CardContent className="p-4">
                  <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{category.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-1">{category.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{category.count} vendors</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{category.description}</p>
                  <div className="mt-2">
                    <p className="text-xs text-blue-600 font-medium">Popular:</p>
                    <p className="text-xs text-gray-500">{category.popularServices.slice(0, 2).join(', ')}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Featured Vendors */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Featured Vendors Near You</h2>
            {sortedVendors.length > 0 && (
              <div className="text-sm text-gray-600">
                Showing {sortedVendors.length} of {featuredVendors.length} vendors
              </div>
            )}
          </div>
          
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-48 bg-gray-200 rounded-t-lg"></div>
                  <CardContent className="p-4">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-4"></div>
                    <div className="h-3 bg-gray-200 rounded mb-2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sortedVendors.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedVendors.map((vendor) => (
                <Card 
                  key={vendor.id} 
                  className="hover:shadow-lg transition-shadow group cursor-pointer"
                  onClick={(e) => handleCardClick(vendor.id, e)}
                >
                                     <div className="relative">
                     <img
                       src={vendor.image}
                       alt={vendor.name}
                       className="w-full h-48 object-cover rounded-t-lg group-hover:scale-105 transition-transform duration-200"
                     />
                     <div className="absolute top-3 right-3 z-10">
                       <Button 
                         size="sm" 
                         variant="ghost" 
                         className="bg-white/90 hover:bg-white shadow-sm"
                         onClick={(e) => {
                           e.stopPropagation();
                           handleShareVendor(vendor.id, vendor.name);
                         }}
                       >
                         <Share2 className="h-4 w-4" />
                       </Button>
                     </div>
                   </div>
                                     <CardContent className="p-4">
                     <div className="flex items-start justify-between mb-2">
                       <h3 className="font-semibold text-lg text-gray-900">{vendor.name}</h3>
                       <div className="flex gap-2">
                         <Badge variant="outline" className="text-xs">
                           {vendor.category}
                         </Badge>
                         {vendor.verified && (
                           <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                             Verified
                           </Badge>
                         )}
                       </div>
                     </div>
                     
                     {/* Badges moved below vendor name */}
                     <div className="flex flex-wrap gap-2 mb-3">
                       {vendor.featured && (
                         <Badge className="bg-yellow-500 text-white text-xs px-2 py-1">
                           Featured
                         </Badge>
                       )}
                       <Badge className={`${getAvailabilityColor(vendor.availability)} text-white text-xs px-2 py-1`}>
                         {getAvailabilityText(vendor.availability)}
                       </Badge>
                     </div>
                    
                    <div className="flex items-center space-x-4 mb-3">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="ml-1 text-sm font-medium">{vendor.rating}</span>
                        <span className="ml-1 text-sm text-gray-600">({vendor.reviews})</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-1" />
                        {vendor.distance} miles
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {vendor.description}
                    </p>

                                         <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center space-x-4 text-sm text-gray-600">
                         <span>{vendor.experience} experience</span>
                       </div>
                       {vendor.videoProfile && (
                         <div className="flex items-center text-sm text-blue-600">
                           <Play className="h-3 w-3 mr-1" />
                           <span>Video Profile</span>
                         </div>
                       )}
                     </div>

                                         <div className="flex items-center justify-between">
                       <div className="flex space-x-2">
                         <Button 
                           size="sm" 
                           variant="outline" 
                           className="text-xs opacity-60 cursor-not-allowed border-gray-300 text-gray-500" 
                           disabled
                           onClick={(e) => {
                             e.stopPropagation();
                             handleContactAction('call');
                           }}
                         >
                           <Lock className="h-3 w-3 mr-1 text-gray-400" />
                           Call
                         </Button>
                         <Button 
                           size="sm" 
                           variant="outline" 
                           className="text-xs opacity-60 cursor-not-allowed border-gray-300 text-gray-500" 
                           disabled
                           onClick={(e) => {
                             e.stopPropagation();
                             handleContactAction('message');
                           }}
                         >
                           <Lock className="h-3 w-3 mr-1 text-gray-400" />
                           Message
                         </Button>
                       </div>
                      <Button 
                        size="sm" 
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewProfile(vendor.id);
                        }}
                      >
                        View Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No vendors found</h3>
              <p className="text-gray-600 mb-4">Try adjusting your search terms or filters</p>
              <button
                onClick={clearFilters}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Registration Prompts */}
        <div className="mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Want to contact vendors?</h3>
                <p className="text-blue-700 text-sm">Sign up to call, message, and save your favorite vendors.</p>
              </div>
              <Link href="/auth/register?type=user">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  Sign Up Now
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
            Sign up to book services, save favorites, and connect with local professionals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register?type=user">
              <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50">
                Sign Up as Customer
              </Button>
            </Link>
            <Link href="/auth/register?type=vendor">
              <Button size="lg" className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-blue-700 font-semibold">
                Join as Vendor
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 