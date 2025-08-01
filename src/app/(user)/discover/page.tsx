'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Star, 
  MapPin, 
  Filter,
  Heart,
  Share2,
  Play,
  Clock,
  Phone,
  MessageSquare,
  SlidersHorizontal,
  X
} from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviews: number;
  distance: number;
  experience: string;
  description: string;
  image: string;
  featured: boolean;
  videoProfile: boolean;
  verified: boolean;
  availability: 'immediate' | 'today' | 'weekly';
  priceRange: 'budget' | 'moderate' | 'premium';
  specialties: string[];
  location: {
    lat: number;
    lng: number;
    address: string;
  };
}

export default function UserDiscoverPage() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [distanceFilter, setDistanceFilter] = useState<number>(25);
  const [ratingFilter, setRatingFilter] = useState<number>(0);
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'reviews'>('distance');

  // Mock data for demonstration
  const categories = [
    { id: 'automotive', name: 'Automotive', icon: '🚗', count: 12 },
    { id: 'home', name: 'Home Services', icon: '🏠', count: 45 },
    { id: 'tech', name: 'Technology', icon: '💻', count: 23 },
    { id: 'health', name: 'Health & Wellness', icon: '💊', count: 18 },
    { id: 'beauty', name: 'Beauty & Personal Care', icon: '💄', count: 31 },
    { id: 'education', name: 'Education', icon: '📚', count: 15 }
  ];

  const vendors: Vendor[] = [
    {
      id: '1',
      name: 'AutoCare Pro',
      category: 'Automotive',
      rating: 4.8,
      reviews: 127,
      distance: 2.3,
      experience: '8 years',
      description: 'Professional automotive repair with quick turnaround times. Specialists in German and Japanese vehicles.',
      image: '/api/placeholder/300/200',
      featured: true,
      videoProfile: true,
      verified: true,
      availability: 'immediate',
      priceRange: 'moderate',
      specialties: ['German Cars', 'Japanese Cars', 'Diagnostics'],
      location: { lat: 40.7128, lng: -74.0060, address: 'New York, NY' }
    },
    {
      id: '2',
      name: 'HomeFix Solutions',
      category: 'Home Services',
      rating: 4.9,
      reviews: 89,
      distance: 1.7,
      experience: '12 years',
      description: 'Complete home repair and maintenance services. From plumbing to electrical, we handle it all.',
      image: '/api/placeholder/300/200',
      featured: false,
      videoProfile: true,
      verified: true,
      availability: 'today',
      priceRange: 'budget',
      specialties: ['Plumbing', 'Electrical', 'HVAC'],
      location: { lat: 40.7128, lng: -74.0060, address: 'New York, NY' }
    },
    {
      id: '3',
      name: 'TechWise Consulting',
      category: 'Technology',
      rating: 4.7,
      reviews: 56,
      distance: 4.1,
      experience: '5 years',
      description: 'IT consulting and computer repair services. We make technology work for your business.',
      image: '/api/placeholder/300/200',
      featured: true,
      videoProfile: false,
      verified: false,
      availability: 'weekly',
      priceRange: 'premium',
      specialties: ['IT Consulting', 'Computer Repair', 'Network Setup'],
      location: { lat: 40.7128, lng: -74.0060, address: 'New York, NY' }
    },
    {
      id: '4',
      name: 'Beauty Glow Studio',
      category: 'Beauty & Personal Care',
      rating: 4.6,
      reviews: 203,
      distance: 0.8,
      experience: '6 years',
      description: 'Professional beauty services including hair styling, makeup, and skincare treatments.',
      image: '/api/placeholder/300/200',
      featured: false,
      videoProfile: true,
      verified: true,
      availability: 'immediate',
      priceRange: 'moderate',
      specialties: ['Hair Styling', 'Makeup', 'Skincare'],
      location: { lat: 40.7128, lng: -74.0060, address: 'New York, NY' }
    },
    {
      id: '5',
      name: 'Wellness Center',
      category: 'Health & Wellness',
      rating: 4.9,
      reviews: 78,
      distance: 3.2,
      experience: '10 years',
      description: 'Comprehensive wellness services including massage therapy, acupuncture, and nutrition counseling.',
      image: '/api/placeholder/300/200',
      featured: true,
      videoProfile: true,
      verified: true,
      availability: 'today',
      priceRange: 'premium',
      specialties: ['Massage Therapy', 'Acupuncture', 'Nutrition'],
      location: { lat: 40.7128, lng: -74.0060, address: 'New York, NY' }
    },
    {
      id: '6',
      name: 'Quick Fix Plumbing',
      category: 'Home Services',
      rating: 4.5,
      reviews: 156,
      distance: 0.6,
      experience: '15 years',
      description: 'Fast and reliable plumbing repair services. Available 24/7 for emergencies.',
      image: '/api/placeholder/300/200',
      featured: false,
      videoProfile: false,
      verified: true,
      availability: 'immediate',
      priceRange: 'budget',
      specialties: ['Emergency Plumbing', 'Repairs', 'Installation'],
      location: { lat: 40.7128, lng: -74.0060, address: 'New York, NY' }
    },
    {
      id: '7',
      name: 'Style Studio NYC',
      category: 'Beauty & Personal Care',
      rating: 4.8,
      reviews: 89,
      distance: 0.8,
      experience: '4 years',
      description: 'Trendy hair styling and beauty services. Specialists in modern cuts and styling.',
      image: '/api/placeholder/300/200',
      featured: true,
      videoProfile: true,
      verified: false,
      availability: 'today',
      priceRange: 'moderate',
      specialties: ['Hair Styling', 'Color', 'Trendy Cuts'],
      location: { lat: 40.7128, lng: -74.0060, address: 'New York, NY' }
    },
    {
      id: '8',
      name: 'Green Thumb Gardens',
      category: 'Home Services',
      rating: 4.7,
      reviews: 94,
      distance: 1.1,
      experience: '8 years',
      description: 'Professional landscaping and garden design services. Transform your outdoor space.',
      image: '/api/placeholder/300/200',
      featured: false,
      videoProfile: true,
      verified: true,
      availability: 'weekly',
      priceRange: 'premium',
      specialties: ['Landscaping', 'Garden Design', 'Maintenance'],
      location: { lat: 40.7128, lng: -74.0060, address: 'New York, NY' }
    }
  ];

  // Get user location on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('Error getting location:', error);
          // Fallback to default location
          setUserLocation({ lat: 40.7128, lng: -74.0060 });
        }
      );
    } else {
      // Fallback to default location
      setUserLocation({ lat: 40.7128, lng: -74.0060 });
    }
  }, []);

  const toggleFavorite = (vendorId: string) => {
    setFavorites(prev => 
      prev.includes(vendorId) 
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    );
  };

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

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         vendor.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || vendor.category.toLowerCase() === selectedCategory;
    const matchesDistance = vendor.distance <= distanceFilter;
    const matchesRating = vendor.rating >= ratingFilter;
    const matchesAvailability = availabilityFilter === 'all' || vendor.availability === availabilityFilter;
    const matchesVerified = !verifiedOnly || vendor.verified;

    return matchesSearch && matchesCategory && matchesDistance && matchesRating && matchesAvailability && matchesVerified;
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

  const vendorsByCategory = categories.map(category => ({
    ...category,
    vendors: sortedVendors.filter(vendor => vendor.category === category.name)
  }));

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setDistanceFilter(25);
    setRatingFilter(0);
    setAvailabilityFilter('all');
    setVerifiedOnly(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Discover Services</h1>
          <p className="text-gray-600 mt-1">
            {userLocation ? `Showing vendors within ${distanceFilter} miles of your location` : 'Loading your location...'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        <input
          type="text"
          placeholder="Search for services, vendors, or descriptions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <X className="h-4 w-4" />
              Clear All
            </button>
          </div>
          
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Distance</label>
              <input
                type="range"
                min="1"
                max="50"
                value={distanceFilter}
                onChange={(e) => setDistanceFilter(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-sm text-gray-600">{distanceFilter} miles</span>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min Rating</label>
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={ratingFilter}
                onChange={(e) => setRatingFilter(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-sm text-gray-600">{ratingFilter}+ stars</span>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Any Availability</option>
                <option value="immediate">Available Now</option>
                <option value="today">Available Today</option>
                <option value="weekly">Available This Week</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Verified vendors only</span>
            </label>
          </div>
        </div>
      )}

      {/* Sort Options */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Sort by:</span>
          <div className="flex border border-gray-300 rounded-lg">
            <button
              onClick={() => setSortBy('distance')}
              className={`px-3 py-1 text-sm ${sortBy === 'distance' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}
            >
              Distance
            </button>
            <button
              onClick={() => setSortBy('rating')}
              className={`px-3 py-1 text-sm ${sortBy === 'rating' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}
            >
              Rating
            </button>
            <button
              onClick={() => setSortBy('reviews')}
              className={`px-3 py-1 text-sm ${sortBy === 'reviews' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}
            >
              Reviews
            </button>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          {sortedVendors.length} vendors found
        </div>
      </div>

      {/* Vendors Grid */}
      {sortedVendors.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedVendors.map((vendor) => (
            <Card key={vendor.id} className="hover:shadow-lg transition-shadow">
              <div className="relative">
                <img
                  src={vendor.image}
                  alt={vendor.name}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
                <div className="absolute top-2 left-2 flex gap-2">
                  {vendor.featured && (
                    <Badge className="bg-yellow-500 text-white text-xs">
                      Featured
                    </Badge>
                  )}
                  <Badge className={`${getAvailabilityColor(vendor.availability)} text-white text-xs`}>
                    {getAvailabilityText(vendor.availability)}
                  </Badge>
                </div>
                <div className="absolute top-2 right-2 flex space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="bg-white/80 hover:bg-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(vendor.id);
                    }}
                  >
                    <Heart className={`h-4 w-4 ${favorites.includes(vendor.id) ? 'fill-red-500 text-red-500' : ''}`} />
                  </Button>
                  <Button size="sm" variant="ghost" className="bg-white/80 hover:bg-white">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg text-gray-900">{vendor.name}</h3>
                  {vendor.verified && (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                      Verified
                    </Badge>
                  )}
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
                    <span className={getPriceRangeColor(vendor.priceRange)}>
                      {getPriceRangeText(vendor.priceRange)}
                    </span>
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
                    <Button size="sm" variant="outline" className="text-xs">
                      <Phone className="h-3 w-3 mr-1" />
                      Call
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Message
                    </Button>
                  </div>
                  <Link href={`/vendor/${vendor.id}`}>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                      View Profile
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No vendors found</h3>
          <p className="text-gray-600">Try adjusting your filters or search terms.</p>
        </div>
      )}
    </div>
  );
} 