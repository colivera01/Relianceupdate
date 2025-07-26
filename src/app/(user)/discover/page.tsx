'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Star, Clock, Filter, Heart, Share2, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

// Mock data
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
  // Plumbing Vendors
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
    services: ['Full Plumbing', 'Installation', 'Maintenance'],
    specialties: ['Luxury Homes', 'Commercial'],
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
    address: '789 Elm St, Suburbia',
    latitude: 40.7306,
    longitude: -73.9352,
    distance: 7.2,
    rating: 4.2,
    reviewCount: 54,
    priceRange: 'Budget',
    availability: 'Available This Week',
    responseTime: 'Same Day',
    verified: false,
    featured: false,
    imageUrl: getRandom(vendorImages),
    services: ['Leak Detection', 'Pipe Replacement'],
    specialties: ['Affordable Pricing'],
    yearsInBusiness: 3,
    insurance: false,
    bonded: false,
    licensed: true,
    description: 'Affordable plumbing for everyday needs. Great for quick fixes and budget-conscious customers.'
  },
  // Electrical Vendors
  {
    id: '4',
    businessName: 'Bright Electric Co',
    businessType: 'Electrical',
    category: 'electrician',
    address: '789 Pine St, Uptown',
    latitude: 40.7505,
    longitude: -73.9934,
    distance: 3.2,
    rating: 4.9,
    reviewCount: 203,
    priceRange: 'Moderate',
    availability: 'Available Now',
    responseTime: '30-60 min',
    verified: true,
    featured: true,
    imageUrl: getRandom(vendorImages),
    services: ['Wiring', 'Panel Upgrades', 'Lighting'],
    specialties: ['Smart Home', 'LED Installation'],
    yearsInBusiness: 12,
    insurance: true,
    bonded: true,
    licensed: true,
    description: 'Top-rated electricians for smart home upgrades and fast repairs. 24/7 emergency service.'
  },
  {
    id: '5',
    businessName: 'Safe Circuit Pros',
    businessType: 'Electrical',
    category: 'electrician',
    address: '321 Maple Ave, Midtown',
    latitude: 40.7589,
    longitude: -73.9851,
    distance: 6.1,
    rating: 4.5,
    reviewCount: 77,
    priceRange: 'Premium',
    availability: 'Available Today',
    responseTime: '2-3 hours',
    verified: true,
    featured: false,
    imageUrl: getRandom(vendorImages),
    services: ['Electrical Safety', 'Panel Replacement'],
    specialties: ['Safety Inspections'],
    yearsInBusiness: 10,
    insurance: true,
    bonded: true,
    licensed: true,
    description: 'Experts in electrical safety and upgrades. Ideal for home inspections and renovations.'
  },
  // Cleaning Vendors
  {
    id: '6',
    businessName: 'Sparkle Cleaners',
    businessType: 'Cleaning',
    category: 'home-cleaners',
    address: '555 Clean St, Downtown',
    latitude: 40.7128,
    longitude: -74.0060,
    distance: 2.3,
    rating: 4.7,
    reviewCount: 150,
    priceRange: 'Moderate',
    availability: 'Available Now',
    responseTime: '1 hour',
    verified: true,
    featured: true,
    imageUrl: getRandom(vendorImages),
    services: ['Home Cleaning', 'Office Cleaning'],
    specialties: ['Eco-Friendly', 'Pet Safe'],
    yearsInBusiness: 6,
    insurance: true,
    bonded: true,
    licensed: true,
    description: 'Eco-friendly cleaning for homes and offices. Pet-safe products and flexible scheduling.'
  },
  {
    id: '7',
    businessName: 'Budget Maids',
    businessType: 'Cleaning',
    category: 'home-cleaners',
    address: '888 Budget Ave, Suburbia',
    latitude: 40.7306,
    longitude: -73.9352,
    distance: 8.5,
    rating: 4.1,
    reviewCount: 40,
    priceRange: 'Budget',
    availability: 'Available This Week',
    responseTime: 'Same Day',
    verified: false,
    featured: false,
    imageUrl: getRandom(vendorImages),
    services: ['Move Out Cleaning', 'Deep Cleaning'],
    specialties: ['Affordable', 'Quick Turnaround'],
    yearsInBusiness: 2,
    insurance: false,
    bonded: false,
    licensed: false,
    description: 'Affordable cleaning for move-outs and deep cleans. Fast, friendly, and budget-friendly.'
  },
  // Additional vendors for other categories
  {
    id: '8',
    businessName: 'AutoCare Pro',
    businessType: 'Automotive',
    category: 'automotive-repair',
    address: '123 Auto St, Downtown',
    latitude: 40.7128,
    longitude: -74.0060,
    distance: 3.5,
    rating: 4.6,
    reviewCount: 89,
    priceRange: 'Moderate',
    availability: 'Available Today',
    responseTime: 'Same Day',
    verified: true,
    featured: true,
    imageUrl: getRandom(vendorImages),
    services: ['Engine Repair', 'Brake Service', 'Oil Change'],
    specialties: ['German Cars', 'Quick Service'],
    yearsInBusiness: 12,
    insurance: true,
    bonded: true,
    licensed: true,
    description: 'Professional automotive repair with quick turnaround times. Specialists in German vehicles.'
  },
  {
    id: '9',
    businessName: 'Elite Detailing',
    businessType: 'Automotive',
    category: 'automotive-detailing',
    address: '456 Detail Ave, Midtown',
    latitude: 40.7589,
    longitude: -73.9851,
    distance: 4.2,
    rating: 4.9,
    reviewCount: 156,
    priceRange: 'Premium',
    availability: 'Available Now',
    responseTime: '2-4 hours',
    verified: true,
    featured: true,
    imageUrl: getRandom(vendorImages),
    services: ['Interior Detailing', 'Exterior Detailing', 'Paint Protection'],
    specialties: ['Luxury Vehicles', 'Ceramic Coating'],
    yearsInBusiness: 8,
    insurance: true,
    bonded: true,
    licensed: true,
    description: 'Premium automotive detailing for luxury and classic vehicles. Ceramic coating specialists.'
  },
  {
    id: '10',
    businessName: 'Style Studio NYC',
    businessType: 'Beauty',
    category: 'hair-nail-salon',
    address: '789 Style St, Uptown',
    latitude: 40.7505,
    longitude: -73.9934,
    distance: 2.8,
    rating: 4.8,
    reviewCount: 234,
    priceRange: 'Premium',
    availability: 'Available Today',
    responseTime: '1-2 hours',
    verified: true,
    featured: true,
    imageUrl: getRandom(vendorImages),
    services: ['Hair Styling', 'Nail Art', 'Makeup'],
    specialties: ['Wedding Styling', 'Color Specialist'],
    yearsInBusiness: 15,
    insurance: true,
    bonded: true,
    licensed: true,
    description: 'Luxury hair and nail salon specializing in wedding styling and color services.'
  },
  {
    id: '11',
    businessName: 'Green Thumb Landscaping',
    businessType: 'Landscaping',
    category: 'landscaping',
    address: '321 Garden Ave, Suburbia',
    latitude: 40.7306,
    longitude: -73.9352,
    distance: 6.8,
    rating: 4.7,
    reviewCount: 98,
    priceRange: 'Moderate',
    availability: 'Available This Week',
    responseTime: 'Same Day',
    verified: true,
    featured: false,
    imageUrl: getRandom(vendorImages),
    services: ['Lawn Care', 'Garden Design', 'Tree Trimming'],
    specialties: ['Sustainable Design', 'Native Plants'],
    yearsInBusiness: 10,
    insurance: true,
    bonded: true,
    licensed: true,
    description: 'Eco-friendly landscaping with sustainable design principles. Native plant specialists.'
  },
  {
    id: '12',
    businessName: '24/7 Locksmith Pro',
    businessType: 'Locksmith',
    category: 'locksmith',
    address: '555 Lock St, Downtown',
    latitude: 40.7128,
    longitude: -74.0060,
    distance: 1.5,
    rating: 4.5,
    reviewCount: 67,
    priceRange: 'Moderate',
    availability: 'Available Now',
    responseTime: '15-30 min',
    verified: true,
    featured: true,
    imageUrl: getRandom(vendorImages),
    services: ['Lock Installation', 'Key Duplication', 'Emergency Unlock'],
    specialties: ['24/7 Service', 'Car Locks'],
    yearsInBusiness: 8,
    insurance: true,
    bonded: true,
    licensed: true,
    description: '24/7 locksmith services for residential and automotive needs. Fast emergency response.'
  }
];

const categories: Category[] = [
  {
    id: 'automotive-repair',
    name: 'Automotive Repair',
    icon: '🚗',
    vendorCount: mockVendors.filter(v => v.category === 'automotive-repair').length,
    vendors: mockVendors.filter(v => v.category === 'automotive-repair'),
  },
  {
    id: 'automotive-detailing',
    name: 'Automotive Detailing',
    icon: '✨',
    vendorCount: mockVendors.filter(v => v.category === 'automotive-detailing').length,
    vendors: mockVendors.filter(v => v.category === 'automotive-detailing'),
  },
  {
    id: 'adjuster',
    name: 'Adjuster',
    icon: '📋',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'barber',
    name: 'Barber',
    icon: '✂️',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'body-shop',
    name: 'Body Shop',
    icon: '🔧',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'car-wash',
    name: 'Car Wash',
    icon: '🚿',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'contractors',
    name: 'Contractors',
    icon: '🏗️',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'dealership',
    name: 'Dealership',
    icon: '🏢',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'electrician',
    name: 'Electrician',
    icon: '⚡',
    vendorCount: mockVendors.filter(v => v.category === 'electrician').length,
    vendors: mockVendors.filter(v => v.category === 'electrician'),
  },
  {
    id: 'electronic-device-repair',
    name: 'Electronic Device Repair',
    icon: '📱',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'hvac',
    name: 'HVAC Heating and Air Conditioning',
    icon: '❄️',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'home-cleaners',
    name: 'Home cleaners',
    icon: '🧹',
    vendorCount: mockVendors.filter(v => v.category === 'home-cleaners').length,
    vendors: mockVendors.filter(v => v.category === 'home-cleaners'),
  },
  {
    id: 'hair-nail-salon',
    name: 'Hair/Nail Salon',
    icon: '💅',
    vendorCount: mockVendors.filter(v => v.category === 'hair-nail-salon').length,
    vendors: mockVendors.filter(v => v.category === 'hair-nail-salon'),
  },
  {
    id: 'landscaping',
    name: 'Landscaping',
    icon: '🌿',
    vendorCount: mockVendors.filter(v => v.category === 'landscaping').length,
    vendors: mockVendors.filter(v => v.category === 'landscaping'),
  },
  {
    id: 'locksmith',
    name: 'Locksmith',
    icon: '🔐',
    vendorCount: mockVendors.filter(v => v.category === 'locksmith').length,
    vendors: mockVendors.filter(v => v.category === 'locksmith'),
  },
  {
    id: 'medical-services',
    name: 'Medical Services',
    icon: '🏥',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'moving-services',
    name: 'Moving Services',
    icon: '📦',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'pool-cleaning',
    name: 'Pool Cleaning Services',
    icon: '🏊',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'pet-grooming',
    name: 'Pet Grooming',
    icon: '🐕',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'plumbing',
    name: 'Plumbing',
    icon: '🔧',
    vendorCount: mockVendors.filter(v => v.category === 'plumbing').length,
    vendors: mockVendors.filter(v => v.category === 'plumbing'),
  },
  {
    id: 'painting-services',
    name: 'Painting Services',
    icon: '🎨',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'pest-exterminating',
    name: 'Pest/Exterminating Services',
    icon: '🐜',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'security-installation',
    name: 'Security Installation',
    icon: '🔒',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'roofing-services',
    name: 'Roofing Services',
    icon: '🏠',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'towing',
    name: 'Towing',
    icon: '🚛',
    vendorCount: 0,
    vendors: [],
  },
  {
    id: 'tree-services',
    name: 'Tree Services',
    icon: '🌳',
    vendorCount: 0,
    vendors: [],
  },
];

export default function DiscoverPage() {
  const router = useRouter();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<number[]>([0, 100]);
  const [distanceFilter, setDistanceFilter] = useState<number>(25);
  const [ratingFilter, setRatingFilter] = useState<number>(0);
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

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
          // Fallback to default location or ask user to enter address
        }
      );
    }
  }, []);

  // Filter vendors based on all criteria
  const filteredVendors = mockVendors.filter(vendor => {
    // Search filter
    if (searchQuery && !vendor.businessName.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !vendor.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !vendor.services.some(service => service.toLowerCase().includes(searchQuery.toLowerCase()))) {
      return false;
    }
    
    // Category filter
    if (selectedCategory !== 'all' && vendor.category !== selectedCategory) {
      return false;
    }
    
    // Distance filter
    if (vendor.distance > distanceFilter) {
      return false;
    }
    
    // Rating filter
    if (vendor.rating < ratingFilter) {
      return false;
    }
    
    // Availability filter
    if (availabilityFilter !== 'all') {
      if (availabilityFilter === 'now' && vendor.availability !== 'Available Now') {
        return false;
      }
      if (availabilityFilter === 'today' && vendor.availability !== 'Available Today') {
        return false;
      }
      if (availabilityFilter === 'week' && vendor.availability !== 'Available This Week') {
        return false;
      }
    }
    
    // Verified filter
    if (verifiedOnly && !vendor.verified) {
      return false;
    }
    
    return true;
  });

  // Update categories with filtered vendors
  const updatedCategories = categories.map(category => ({
    ...category,
    vendorCount: filteredVendors.filter(v => v.category === category.id).length,
    vendors: filteredVendors.filter(v => v.category === category.id)
  }));

  const toggleFavorite = (vendorId: string) => {
    setFavorites(prev => 
      prev.includes(vendorId) 
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  const handleViewDetails = (vendorId: string) => {
    router.push(`/service/${vendorId}`);
  };

  const handleContact = (vendorId: string) => {
    router.push(`/messages?vendor=${vendorId}`);
  };

  const handleViewAll = (categoryId: string) => {
    router.push(`/search?category=${categoryId}`);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setDistanceFilter(25);
    setRatingFilter(0);
    setAvailabilityFilter('all');
    setVerifiedOnly(false);
  };

  const VendorCard = ({ vendor }: { vendor: Vendor }) => (
    <Card className="w-72 h-[450px] flex-shrink-0 hover:shadow-lg transition-all duration-300 cursor-pointer group border border-gray-200 bg-white">
      <div className="relative">
        <div className="h-40 rounded-t-lg relative overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600">
          <img src={vendor.imageUrl} alt={vendor.businessName} className="absolute inset-0 w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute top-3 right-3 flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 bg-white/20 hover:bg-white/30"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(vendor.id);
              }}
            >
              <Heart 
                size={16} 
                className={favorites.includes(vendor.id) ? 'fill-red-500 text-red-500' : 'text-white'} 
              />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 bg-white/20 hover:bg-white/30"
              onClick={(e) => e.stopPropagation()}
            >
              <Share2 size={16} className="text-white" />
            </Button>
          </div>
          {vendor.featured && (
            <Badge className="absolute top-3 left-3 bg-yellow-500 text-black">
              Featured
            </Badge>
          )}
          <div className="absolute bottom-3 left-3 text-white">
            <div className="flex items-center gap-1 text-sm">
              <MapPin size={14} />
              {vendor.distance} miles away
            </div>
          </div>
        </div>
      </div>
      
      <CardContent className="p-4 flex flex-col h-[210px]">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{vendor.businessName}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Star size={14} className="fill-yellow-400 text-yellow-400" />
                <span>{vendor.rating}</span>
                <span>({vendor.reviewCount})</span>
              </div>
              <span>•</span>
              <span>{vendor.yearsInBusiness} years</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 mb-2 line-clamp-2 flex-shrink-0">{vendor.description}</div>
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={vendor.availability === 'Available Now' ? 'default' : 'secondary'}>
              {vendor.availability}
            </Badge>
            <Badge variant="outline">{vendor.priceRange}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock size={14} />
            <span>Response: {vendor.responseTime}</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {vendor.verified && <Badge variant="outline" className="text-xs">✓ Verified</Badge>}
            {vendor.insurance && <Badge variant="outline" className="text-xs">Insurance</Badge>}
            {vendor.bonded && <Badge variant="outline" className="text-xs">Bonded</Badge>}
            {vendor.licensed && <Badge variant="outline" className="text-xs">Licensed</Badge>}
          </div>
        </div>
        <div className="flex gap-2 mt-auto pt-2">
          <Button 
            size="sm" 
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              handleContact(vendor.id);
            }}
          >
            <Phone size={14} className="mr-1" />
            Contact
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              handleViewDetails(vendor.id);
            }}
          >
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const CategorySection = ({ category }: { category: Category }) => (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{category.icon}</span>
          <h2 className="text-xl font-semibold">{category.name}</h2>
          <Badge variant="secondary">{category.vendorCount} vendors</Badge>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => handleViewAll(category.id)}
        >
          View All
        </Button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide min-w-0">
        {category.vendors.map((vendor) => (
          <VendorCard key={vendor.id} vendor={vendor} />
        ))}
        {category.vendors.length === 0 && (
          <div className="w-72 h-96 flex items-center justify-center text-gray-500 border border-dashed rounded-lg bg-gray-100">
            No vendors available in this category
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">Discover Services</h1>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin size={16} />
                {userLocation ? 'Location detected' : 'Enter your address'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter size={16} className="mr-1" />
                Filters
              </Button>
              <Button size="sm">
                <Heart size={16} className="mr-1" />
                Favorites ({favorites.length})
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Side Panel */}
        <div className="w-72 flex-shrink-0">
          <Card className="sticky top-24 border border-gray-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Filters & Search</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search */}
              <div className="space-y-2">
                <Label>Search Services</Label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="What do you need help with?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              {/* Category Filter */}
              <div className="space-y-2">
                <Label>Service Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start" className="max-h-60 overflow-y-auto">
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Distance Filter */}
              <div className="space-y-2">
                <Label>Distance: {distanceFilter} miles</Label>
                <Slider
                  value={[distanceFilter]}
                  onValueChange={(value) => setDistanceFilter(value[0])}
                  max={50}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
              {/* Rating Filter */}
              <div className="space-y-2">
                <Label>Minimum Rating: {ratingFilter}+ stars</Label>
                <Slider
                  value={[ratingFilter]}
                  onValueChange={(value) => setRatingFilter(value[0])}
                  max={5}
                  min={0}
                  step={0.5}
                  className="w-full"
                />
              </div>
              {/* Availability Filter */}
              <div className="space-y-2">
                <Label>Availability</Label>
                <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start">
                    <SelectItem value="all">Any Availability</SelectItem>
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
              {/* Clear Filters */}
              <Button variant="outline" className="w-full" onClick={clearAllFilters}>
                Clear All Filters
              </Button>
            </CardContent>
          </Card>
        </div>
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Featured Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 border-b border-gray-200 pb-2">Featured Services Near You</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {updatedCategories.slice(0, 3).map((category) => (
                <Card key={category.id} className="hover:shadow-md transition-shadow cursor-pointer border border-gray-200 bg-white h-[100px]">
                  <CardContent className="p-4 flex items-center gap-3 h-full">
                    <span className="text-3xl flex-shrink-0">{category.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-1">{category.name}</h3>
                      <p className="text-xs text-gray-600 leading-tight">{category.vendorCount} vendors available</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          {/* Category Sections */}
          {updatedCategories.map((category) => (
            <CategorySection key={category.id} category={category} />
          ))}
        </div>
      </div>
    </div>
  );
} 