'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, MapPin, Star, Clock, Phone, Share2, Trash2, Filter, Search, Grid, List, SortAsc, SortDesc } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// Types for the favorites page
interface FavoriteVendor {
  id: string;
  businessName: string;
  businessType: string;
  category: string;
  address: string;
  distance: number;
  rating: number;
  reviewCount: number;
  priceRange: 'Budget' | 'Moderate' | 'Premium';
  availability: 'Available Now' | 'Available Today' | 'Available This Week';
  responseTime: string;
  verified: boolean;
  featured: boolean;
  imageUrl: string;
  services: string[];
  specialties: string[];
  yearsInBusiness: number;
  insurance: boolean;
  bonded: boolean;
  licensed: boolean;
  description: string;
  favoritedAt: string; // ISO date string
  lastContacted?: string; // ISO date string
  notes?: string; // User's personal notes
}

// Mock data for favorited vendors
const mockFavoriteVendors: FavoriteVendor[] = [
  {
    id: '1',
    businessName: 'Quick Fix Plumbing',
    businessType: 'Plumbing',
    category: 'plumbing',
    address: '123 Main St, Downtown',
    distance: 4.6,
    rating: 4.8,
    reviewCount: 127,
    priceRange: 'Moderate',
    availability: 'Available Now',
    responseTime: '1-2 hours',
    verified: true,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&crop=center',
    services: ['Pipe Repair', 'Drain Cleaning', 'Water Heater'],
    specialties: ['Emergency Repairs', '24/7 Service'],
    yearsInBusiness: 8,
    insurance: true,
    bonded: true,
    licensed: true,
    description: 'Fast, reliable plumbing for emergencies and routine jobs. Highly rated by local homeowners.',
    favoritedAt: '2024-01-15T10:30:00Z',
    lastContacted: '2024-01-20T14:15:00Z',
    notes: 'Great for emergencies, responds quickly'
  },
  {
    id: '4',
    businessName: 'Bright Electric Co',
    businessType: 'Electrical',
    category: 'electrician',
    address: '789 Pine St, Uptown',
    distance: 3.2,
    rating: 4.9,
    reviewCount: 203,
    priceRange: 'Moderate',
    availability: 'Available Now',
    responseTime: '30-60 min',
    verified: true,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&crop=center',
    services: ['Wiring', 'Panel Upgrades', 'Lighting'],
    specialties: ['Smart Home', 'LED Installation'],
    yearsInBusiness: 12,
    insurance: true,
    bonded: true,
    licensed: true,
    description: 'Top-rated electricians for smart home upgrades and fast repairs. 24/7 emergency service.',
    favoritedAt: '2024-01-10T09:15:00Z',
    notes: 'Smart home specialist, expensive but worth it'
  },
  {
    id: '6',
    businessName: 'Sparkle Cleaners',
    businessType: 'Cleaning',
    category: 'home-cleaners',
    address: '555 Clean St, Downtown',
    distance: 2.3,
    rating: 4.7,
    reviewCount: 150,
    priceRange: 'Moderate',
    availability: 'Available Now',
    responseTime: '1 hour',
    verified: true,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&crop=center',
    services: ['Home Cleaning', 'Office Cleaning'],
    specialties: ['Eco-Friendly', 'Pet Safe'],
    yearsInBusiness: 6,
    insurance: true,
    bonded: true,
    licensed: true,
    description: 'Eco-friendly cleaning for homes and offices. Pet-safe products and flexible scheduling.',
    favoritedAt: '2024-01-05T16:45:00Z',
    lastContacted: '2024-01-18T11:30:00Z',
    notes: 'Eco-friendly, pet safe, great for regular cleaning'
  },
  {
    id: '8',
    businessName: 'AutoCare Pro',
    businessType: 'Automotive',
    category: 'automotive-repair',
    address: '123 Auto St, Downtown',
    distance: 3.5,
    rating: 4.6,
    reviewCount: 89,
    priceRange: 'Moderate',
    availability: 'Available Today',
    responseTime: 'Same Day',
    verified: true,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&crop=center',
    services: ['Engine Repair', 'Brake Service', 'Oil Change'],
    specialties: ['German Cars', 'Quick Service'],
    yearsInBusiness: 12,
    insurance: true,
    bonded: true,
    licensed: true,
    description: 'Professional automotive repair with quick turnaround times. Specialists in German vehicles.',
    favoritedAt: '2024-01-12T13:20:00Z',
    notes: 'Specializes in German cars, quick turnaround'
  },
  {
    id: '10',
    businessName: 'Style Studio NYC',
    businessType: 'Beauty',
    category: 'hair-nail-salon',
    address: '789 Style St, Uptown',
    distance: 2.8,
    rating: 4.8,
    reviewCount: 234,
    priceRange: 'Premium',
    availability: 'Available Today',
    responseTime: '1-2 hours',
    verified: true,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&crop=center',
    services: ['Hair Styling', 'Nail Art', 'Makeup'],
    specialties: ['Wedding Styling', 'Color Specialist'],
    yearsInBusiness: 15,
    insurance: true,
    bonded: true,
    licensed: true,
    description: 'Luxury hair and nail salon specializing in wedding styling and color services.',
    favoritedAt: '2024-01-08T15:10:00Z',
    lastContacted: '2024-01-22T10:00:00Z',
    notes: 'Luxury salon, perfect for special occasions'
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

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteVendor[]>(mockFavoriteVendors);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'rating' | 'distance'>('recent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');


  // Filter and sort favorites
  const filteredAndSortedFavorites = favorites
    .filter(favorite => {
      // Search filter
      if (searchQuery && !favorite.businessName.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !favorite.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Category filter
      if (selectedCategory !== 'All Categories' && favorite.category !== selectedCategory.toLowerCase().replace(/\s+/g, '-')) {
        return false;
      }
      
      
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'recent':
          comparison = new Date(b.favoritedAt).getTime() - new Date(a.favoritedAt).getTime();
          break;
        case 'name':
          comparison = a.businessName.localeCompare(b.businessName);
          break;
        case 'rating':
          comparison = b.rating - a.rating;
          break;
        case 'distance':
          comparison = a.distance - b.distance;
          break;
      }
      
      return sortOrder === 'asc' ? -comparison : comparison;
    });

  const removeFavorite = (vendorId: string) => {
    setFavorites(prev => prev.filter(fav => fav.id !== vendorId));
  };

  const handleContact = (vendorId: string) => {
    router.push(`/messages?vendor=${vendorId}`);
  };

  const handleViewDetails = (vendorId: string) => {
    router.push(`/service/${vendorId}`);
  };

  const handleBookNow = (vendorId: string) => {
    router.push(`/booking/${vendorId}`);
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  const FavoriteCard = ({ favorite }: { favorite: FavoriteVendor }) => (
    <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer group border border-gray-200 bg-white">
      <div className="relative">
        <div className="h-48 rounded-t-lg relative overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600">
          <img src={favorite.imageUrl} alt={favorite.businessName} className="absolute inset-0 w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute top-3 right-3 flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 bg-white/20 hover:bg-white/30"
              onClick={(e) => {
                e.stopPropagation();
                handleContact(favorite.id);
              }}
            >
              <Phone size={16} className="text-white" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 bg-white/20 hover:bg-white/30"
              onClick={(e) => e.stopPropagation()}
            >
              <Share2 size={16} className="text-white" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 bg-red-500/20 hover:bg-red-500/30"
              onClick={(e) => {
                e.stopPropagation();
                removeFavorite(favorite.id);
              }}
            >
              <Trash2 size={16} className="text-red-500" />
            </Button>
          </div>
          {favorite.featured && (
            <Badge className="absolute top-3 left-3 bg-yellow-500 text-black">
              Featured
            </Badge>
          )}
          <div className="absolute bottom-3 left-3 text-white">
            <div className="flex items-center gap-1 text-sm">
              <MapPin size={14} />
              {favorite.distance} miles away
            </div>
          </div>
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{favorite.businessName}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Star size={14} className="fill-yellow-400 text-yellow-400" />
                <span>{favorite.rating}</span>
                <span>({favorite.reviewCount})</span>
              </div>
              <span>•</span>
              <span>{favorite.yearsInBusiness} years</span>
            </div>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 mb-3 line-clamp-2">{favorite.description}</div>
        
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={favorite.availability === 'Available Now' ? 'default' : 'secondary'}>
              {favorite.availability}
            </Badge>
            <Badge variant="outline">{favorite.priceRange}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock size={14} />
            <span>Response: {favorite.responseTime}</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {favorite.verified && <Badge variant="outline" className="text-xs">✓ Verified</Badge>}
            {favorite.insurance && <Badge variant="outline" className="text-xs">Insurance</Badge>}
            {favorite.bonded && <Badge variant="outline" className="text-xs">Bonded</Badge>}
            {favorite.licensed && <Badge variant="outline" className="text-xs">Licensed</Badge>}
          </div>
        </div>



        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <span>Favorited {getTimeAgo(favorite.favoritedAt)}</span>
        </div>
        
        <div className="flex gap-2">
          <Button 
            size="sm" 
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              handleBookNow(favorite.id);
            }}
          >
            Book Now
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              handleViewDetails(favorite.id);
            }}
          >
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const FavoriteListItem = ({ favorite }: { favorite: FavoriteVendor }) => (
    <Card className="hover:shadow-md transition-all duration-300 cursor-pointer group border border-gray-200 bg-white">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <img src={favorite.imageUrl} alt={favorite.businessName} className="w-16 h-16 rounded-lg object-cover" />
            {favorite.featured && (
              <Badge className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs">
                Featured
              </Badge>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{favorite.businessName}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                    <span>{favorite.rating}</span>
                    <span>({favorite.reviewCount})</span>
                  </div>
                  <span>•</span>
                  <span>{favorite.yearsInBusiness} years</span>
                  <span>•</span>
                  <span>{favorite.distance} miles away</span>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-2 line-clamp-1">{favorite.description}</p>
            
            <div className="flex items-center gap-2 text-sm mb-2">
              <Badge variant={favorite.availability === 'Available Now' ? 'default' : 'secondary'}>
                {favorite.availability}
              </Badge>
              <Badge variant="outline">{favorite.priceRange}</Badge>
              {favorite.verified && <Badge variant="outline" className="text-xs">✓ Verified</Badge>}
            </div>



            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Favorited {getTimeAgo(favorite.favoritedAt)}</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 flex-shrink-0">
            <Button 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleBookNow(favorite.id);
              }}
            >
              Book Now
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleViewDetails(favorite.id);
              }}
            >
              View Details
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleContact(favorite.id);
              }}
            >
              <Phone size={14} className="mr-1" />
              Contact
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              className="text-red-500 hover:text-red-700"
              onClick={(e) => {
                e.stopPropagation();
                removeFavorite(favorite.id);
              }}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">My Favorites</h1>
              <Badge variant="secondary" className="text-sm">
                {filteredAndSortedFavorites.length} favorites
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm">
                <Heart size={16} className="mr-1" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters and Controls */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search your favorites..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="min-w-48">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recently Added</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="distance">Distance</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSortOrder}
                className="px-2"
              >
                {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
              </Button>
            </div>

            {/* View Mode */}
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="px-2"
              >
                <Grid size={16} />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="px-2"
              >
                <List size={16} />
              </Button>
            </div>
          </div>


        </div>

        {/* Content */}
        {filteredAndSortedFavorites.length === 0 ? (
          <div className="text-center py-12">
            <Heart size={64} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No favorites found</h3>
            <p className="text-gray-600 mb-6">
                          {searchQuery || selectedCategory !== 'All Categories'
              ? 'Try adjusting your filters to see more results.'
              : 'Start adding vendors to your favorites to see them here.'}
            </p>
            <Button onClick={() => router.push('/discover')}>
              Discover Services
            </Button>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
          }>
            {filteredAndSortedFavorites.map((favorite) => (
              viewMode === 'grid' 
                ? <FavoriteCard key={favorite.id} favorite={favorite} />
                : <FavoriteListItem key={favorite.id} favorite={favorite} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 