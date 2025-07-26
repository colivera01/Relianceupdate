'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Search, 
  MapPin, 
  Star, 
  Clock, 
  Heart, 
  SlidersHorizontal,
  X,
  ChevronDown
} from 'lucide-react';

export default function SearchResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [searchTerm, setSearchTerm] = useState(query);

  const [filters, setFilters] = useState({
    category: '',
    priceRange: '',
    rating: '',
    distance: '',
    availability: ''
  });
  const [sortBy, setSortBy] = useState('relevance');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Mock search results
  const searchResults = [
    {
      id: 1,
      name: 'Deep House Cleaning',
      vendor: 'Sparkle Clean Pro',
      rating: 4.9,
      reviewCount: 127,
      distance: '0.4 mi',
      price: 120,
      originalPrice: 150,
      discount: 20,
      category: 'Home Services',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
      available: true,
      features: ['Eco-friendly', 'Same day', 'Insurance'],
      description: 'Professional deep cleaning service for your entire home.'
    },
    {
      id: 2,
      name: 'TikTok Style Haircut',
      vendor: 'Style Studio NYC',
      rating: 4.8,
      reviewCount: 89,
      distance: '0.8 mi',
      price: 45,
      originalPrice: 60,
      discount: 25,
      category: 'Beauty & Wellness',
      image: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=400&h=300&fit=crop',
      available: true,
      features: ['Trendy styles', 'Consultation', 'Hair care tips'],
      description: 'Get the latest TikTok trending haircuts and styles.'
    },
    {
      id: 3,
      name: 'Plumbing Repair',
      vendor: 'Quick Fix Plumbing',
      rating: 4.7,
      reviewCount: 203,
      distance: '0.6 mi',
      price: 85,
      originalPrice: 100,
      discount: 15,
      category: 'Home Services',
      image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&h=300&fit=crop',
      available: true,
      features: ['24/7 service', 'Emergency', 'Warranty'],
      description: 'Fast and reliable plumbing repair services.'
    },
    {
      id: 4,
      name: 'Instagram-Worthy Nails',
      vendor: 'Nail Art Collective',
      rating: 4.9,
      reviewCount: 156,
      distance: '1.2 mi',
      price: 35,
      originalPrice: 45,
      discount: 22,
      category: 'Beauty & Wellness',
      image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=300&fit=crop',
      available: false,
      features: ['Design consultation', 'Premium products', 'Long-lasting'],
      description: 'Create stunning nail art perfect for Instagram.'
    },
    {
      id: 5,
      name: 'Landscape Design',
      vendor: 'Green Thumb Gardens',
      rating: 4.8,
      reviewCount: 94,
      distance: '1.1 mi',
      price: 200,
      originalPrice: 250,
      discount: 20,
      category: 'Home Services',
      image: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=300&fit=crop',
      available: true,
      features: ['Custom design', 'Maintenance plan', 'Eco-friendly'],
      description: 'Transform your outdoor space with professional landscape design.'
    },
    {
      id: 6,
      name: 'Viral TikTok Makeup',
      vendor: 'Beauty Bar',
      rating: 4.7,
      reviewCount: 78,
      distance: '0.5 mi',
      price: 55,
      originalPrice: 70,
      discount: 21,
      category: 'Beauty & Wellness',
      image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=300&fit=crop',
      available: true,
      features: ['Trendy looks', 'Product recommendations', 'Tutorial'],
      description: 'Get the latest viral TikTok makeup looks.'
    }
  ];

  const categories = [
    'All Categories',
    'Automotive Repair',
    'Automotive Detailing',
    'Adjuster',
    'Barber',
    'Body Shop',
    'Car Wash',
    'Contractors',
    'Dealership',
    'Electrician',
    'Electronic Device Repair',
    'HVAC Heating and Air Conditioning',
    'Home cleaners',
    'Hair/Nail Salon',
    'Landscaping',
    'Locksmith',
    'Medical Services',
    'Moving Services',
    'Pool Cleaning Services',
    'Pet Grooming',
    'Plumbing',
    'Painting Services',
    'Pest/Exterminating Services',
    'Security Installation',
    'Roofing Services',
    'Towing',
    'Tree Services'
  ];

  const priceRanges = [
    'Any Price',
    'Under $50',
    '$50 - $100',
    '$100 - $200',
    'Over $200'
  ];

  const ratings = [
    'Any Rating',
    '4.5+ Stars',
    '4.0+ Stars',
    '3.5+ Stars'
  ];

  const distances = [
    'Any Distance',
    'Under 1 mile',
    '1-3 miles',
    '3-5 miles',
    'Over 5 miles'
  ];

  useEffect(() => {
    setSearchTerm(query);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      priceRange: '',
      rating: '',
      distance: '',
      availability: ''
    });
  };

  const filteredResults = searchResults.filter(result => {
    if (filters.category && filters.category !== 'All Categories' && result.category !== filters.category) {
      return false;
    }
    if (filters.priceRange && filters.priceRange !== 'Any Price') {
      const [min, max] = filters.priceRange.split(' - ').map(p => parseInt(p.replace(/[^0-9]/g, '')));
      if (filters.priceRange.startsWith('Under')) {
        if (result.price >= min) return false;
      } else if (filters.priceRange.startsWith('Over')) {
        if (result.price <= min) return false;
      } else {
        if (result.price < min || result.price > max) return false;
      }
    }
    if (filters.rating && filters.rating !== 'Any Rating') {
      const minRating = parseFloat(filters.rating.split('+')[0]);
      if (result.rating < minRating) return false;
    }
    if (filters.distance && filters.distance !== 'Any Distance') {
      const distanceNum = parseFloat(result.distance.split(' ')[0]);
      if (filters.distance.startsWith('Under')) {
        if (distanceNum >= 1) return false;
      } else if (filters.distance.startsWith('Over')) {
        if (distanceNum <= 5) return false;
      } else {
        const [min, max] = filters.distance.split('-').map(d => parseFloat(d.split(' ')[0]));
        if (distanceNum < min || distanceNum > max) return false;
      }
    }
    if (filters.availability === 'available' && !result.available) {
      return false;
    }
    return true;
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'rating':
        return b.rating - a.rating;
      case 'distance':
        return parseFloat(a.distance.split(' ')[0]) - parseFloat(b.distance.split(' ')[0]);
      default:
        return 0;
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <form onSubmit={handleSearch} className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search for services, vendors, or trends..."
                className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-full border-0 focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all duration-200"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Search Results for "{query}"
            </h1>
            <p className="text-gray-600">
              {sortedResults.length} services found
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex border border-gray-300 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-purple-500 text-white' : 'bg-white text-gray-600'}`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 ${viewMode === 'list' ? 'bg-purple-500 text-white' : 'bg-white text-gray-600'}`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                Clear All
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
                <select
                  value={filters.priceRange}
                  onChange={(e) => handleFilterChange('priceRange', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {priceRanges.map(range => (
                    <option key={range} value={range}>{range}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                <select
                  value={filters.rating}
                  onChange={(e) => handleFilterChange('rating', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {ratings.map(rating => (
                    <option key={rating} value={rating}>{rating}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Distance</label>
                <select
                  value={filters.distance}
                  onChange={(e) => handleFilterChange('distance', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {distances.map(distance => (
                    <option key={distance} value={distance}>{distance}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                <select
                  value={filters.availability}
                  onChange={(e) => handleFilterChange('availability', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Any Availability</option>
                  <option value="available">Available Now</option>
                </select>
              </div>
            </div>
          </div>

        {/* Search Results */}
        {sortedResults.length > 0 ? (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {sortedResults.map((service) => (
              <div key={service.id} className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 ${
                viewMode === 'list' ? 'flex' : ''
              }`}>
                <div className={viewMode === 'list' ? 'w-48 h-32' : 'h-48'}>
                  <img 
                    src={service.image} 
                    alt={service.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className={`p-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{service.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{service.vendor}</p>
                    </div>
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                      <Heart className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span>{service.rating}</span>
                      <span>({service.reviewCount})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{service.distance}</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-3">{service.description}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {service.features.map((feature, index) => (
                      <span 
                        key={index}
                        className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-lg font-bold text-purple-600">${service.price}</span>
                      <span className="text-sm text-gray-500 line-through ml-2">${service.originalPrice}</span>
                    </div>
                    <button 
                      onClick={() => router.push(`/service/${service.id}`)}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your search terms or filters</p>
            <button
              onClick={clearFilters}
              className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 