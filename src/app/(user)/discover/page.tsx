'use client';

import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Clock, Filter, Heart, Share2, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Types for the user discovery page
interface Vendor {
  id: string;
  businessName: string;
  businessType: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  distance: number; // in miles
  rating: number;
  reviewCount: number;
  priceRange: 'Budget' | 'Moderate' | 'Premium';
  availability: 'Available Now' | 'Available Today' | 'Available This Week';
  responseTime: string; // e.g., "2-4 hours"
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
}

interface Category {
  id: string;
  name: string;
  icon: string;
  vendorCount: number;
  vendors: Vendor[];
}

// More realistic mock data
const vendorImages = [
  '/reliance-logo.png',
  'https://randomuser.me/api/portraits/men/32.jpg',
  'https://randomuser.me/api/portraits/women/44.jpg',
  'https://randomuser.me/api/portraits/men/45.jpg',
  'https://randomuser.me/api/portraits/women/46.jpg',
  'https://randomuser.me/api/portraits/men/47.jpg',
];

const getRandom = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

const mockVendors: Vendor[] = [
  {
    id: '1',
    businessName: 'Quick Fix Plumbing',
    businessType: 'Plumbing',
    category: 'plumbing',
    address: '123 Main St, Downtown',
    latitude: 40.7128,
    longitude: -74.0060,
    distance: 4.6,
    rating: 4.8,
    reviewCount: 127,
    priceRange: 'Moderate',
    availability: 'Available Now',
    responseTime: '1-2 hours',
    verified: true,
    featured: true,
    imageUrl: getRandom(vendorImages),
    services: ['Pipe Repair', 'Drain Cleaning', 'Water Heater'],
    specialties: ['Emergency Repairs', '24/7 Service'],
    yearsInBusiness: 8,
    insurance: true,
    bonded: true,
    licensed: true,
    description: 'Fast, reliable plumbing for emergencies and routine jobs. Highly rated by local homeowners.'
  },
  {
    id: '2',
    businessName: 'Pro Plumbing Solutions',
    businessType: 'Plumbing',
    category: 'plumbing',
    address: '456 Oak Ave, Midtown',
    latitude: 40.7589,
    longitude: -73.9851,
    distance: 5.0,
    rating: 4.6,
    reviewCount: 89,
    priceRange: 'Premium',
    availability: 'Available Today',
    responseTime: '2-4 hours',
    verified: true,
    featured: false,
    imageUrl: getRandom(vendorImages),
    services: ['Commercial Plumbing', 'Luxury Homes', 'Design Consultation'],
    specialties: ['High-End Projects', 'Commercial'],
    yearsInBusiness: 15,
    insurance: true,
    bonded: true,
    licensed: true,
    description: 'Specialists in high-end and commercial plumbing. Trusted by businesses and luxury homeowners.'
  },
  {
    id: '3',
    businessName: 'Budget Plumbers',
    businessType: 'Plumbing',
    category: 'plumbing',
    address: '789 Pine St, Uptown',
    latitude: 40.7505,
    longitude: -73.9934,
    distance: 7.2,
    rating: 4.2,
    reviewCount: 54,
    priceRange: 'Budget',
    availability: 'Available This Week',
    responseTime: 'Same Day',
    verified: false,
    featured: false,
    imageUrl: getRandom(vendorImages),
    services: ['Basic Repairs', 'Installations', 'Maintenance'],
    specialties: ['Budget-Friendly', 'Quick Service'],
    yearsInBusiness: 3,
    insurance: false,
    bonded: false,
    licensed: true,
    description: 'Affordable plumbing for everyday needs. Great for quick fixes and budget-conscious customers.'
  }
];

const categories: Category[] = [
  {
    id: 'plumbing',
    name: 'Plumbing',
    icon: '🔧',
    vendorCount: 3,
    vendors: mockVendors
  },
  {
    id: 'electrical',
    name: 'Electrical',
    icon: '⚡',
    vendorCount: 2,
    vendors: []
  },
  {
    id: 'cleaning',
    name: 'Cleaning',
    icon: '🧹',
    vendorCount: 2,
    vendors: []
  }
];

export default function DiscoverPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [distance, setDistance] = useState([25]);
  const [minRating, setMinRating] = useState([0]);
  const [availability, setAvailability] = useState('any');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(true);

  const toggleFavorite = (vendorId: string) => {
    setFavorites(prev => 
      prev.includes(vendorId) 
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  const VendorCard = ({ vendor }: { vendor: Vendor }) => (
    <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={vendor.imageUrl} 
              alt={vendor.businessName}
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <CardTitle className="text-lg">{vendor.businessName}</CardTitle>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{vendor.distance} miles away</span>
              </div>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(vendor.id);
            }}
            className={`p-2 rounded-full transition-colors ${
              favorites.includes(vendor.id) 
                ? 'text-red-500 bg-red-50' 
                : 'text-gray-400 hover:text-red-500'
            }`}
          >
            <Heart className={`w-5 h-5 ${favorites.includes(vendor.id) ? 'fill-current' : ''}`} />
          </button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold">{vendor.rating}</span>
            <span className="text-sm text-gray-600">({vendor.reviewCount} reviews)</span>
          </div>
          <span className="text-sm text-gray-600">{vendor.yearsInBusiness} years</span>
        </div>
        
        <p className="text-gray-700 mb-3">{vendor.description}</p>
        
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="secondary" className="text-xs">
            {vendor.availability}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {vendor.priceRange}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <Clock className="w-4 h-4" />
          <span>Response: {vendor.responseTime}</span>
        </div>
        
        <div className="flex flex-wrap gap-1 mb-4">
          {vendor.verified && <Badge className="bg-green-100 text-green-700 text-xs">Verified</Badge>}
          {vendor.insurance && <Badge className="bg-blue-100 text-blue-700 text-xs">Insurance</Badge>}
          {vendor.bonded && <Badge className="bg-purple-100 text-purple-700 text-xs">Bonded</Badge>}
          {vendor.licensed && <Badge className="bg-orange-100 text-orange-700 text-xs">Licensed</Badge>}
        </div>
        
        <div className="flex gap-2">
          <Button className="flex-1" size="sm">
            <Phone className="w-4 h-4 mr-2" />
            Contact
          </Button>
          <Button variant="outline" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const CategorySection = ({ category }: { category: Category }) => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{category.icon}</span>
          <h2 className="text-xl font-semibold">{category.name}</h2>
          <span className="text-sm text-gray-600">({category.vendorCount} vendors)</span>
        </div>
        <Button variant="ghost" size="sm">
          View All
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {category.vendors.map(vendor => (
          <VendorCard key={vendor.id} vendor={vendor} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex gap-6">
      {/* Filters Panel */}
      <div className={`w-80 flex-shrink-0 ${showFilters ? 'block' : 'hidden'}`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search */}
            <div>
              <Label htmlFor="search">Search Services</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="What do you need help with?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <Label>Service Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="cleaning">Cleaning</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Distance */}
            <div>
              <Label>Distance: {distance[0]} miles</Label>
              <Slider
                value={distance}
                onValueChange={setDistance}
                max={50}
                min={1}
                step={1}
                className="mt-2"
              />
            </div>

            {/* Rating */}
            <div>
              <Label>Minimum Rating: {minRating[0]}+ stars</Label>
              <Slider
                value={minRating}
                onValueChange={setMinRating}
                max={5}
                min={0}
                step={0.5}
                className="mt-2"
              />
            </div>

            {/* Availability */}
            <div>
              <Label>Availability</Label>
              <Select value={availability} onValueChange={setAvailability}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Availability</SelectItem>
                  <SelectItem value="now">Available Now</SelectItem>
                  <SelectItem value="today">Available Today</SelectItem>
                  <SelectItem value="week">Available This Week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Verified Only */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="verified"
                checked={verifiedOnly}
                onCheckedChange={(checked) => setVerifiedOnly(checked as boolean)}
              />
              <Label htmlFor="verified">Verified vendors only</Label>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setDistance([25]);
                setMinRating([0]);
                setAvailability('any');
                setVerifiedOnly(false);
              }}
            >
              Clear All Filters
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Discover Services</h1>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>Location detected</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Favorites ({favorites.length})
            </Button>
          </div>
        </div>

        {/* Featured Categories */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Featured Service Categories</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {categories.map(category => (
              <Card key={category.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{category.icon}</span>
                    <div>
                      <h3 className="font-semibold">{category.name}</h3>
                      <p className="text-sm text-gray-600">{category.vendorCount} vendors available</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Vendor Listings */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Featured Services Near You</h2>
          {categories.map(category => (
            <CategorySection key={category.id} category={category} />
          ))}
        </div>
      </div>
    </div>
  );
} 