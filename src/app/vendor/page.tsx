// BACKEND DEVELOPER NOTES:
// - Fetch vendor dashboard data from GET /api/vendor/dashboard
// - Fetch business info, location, and stats from GET /api/vendor/profile and /api/vendor/stats
// - Feature cards should link to real data-driven pages
// - Team analytics should fetch from GET /api/vendor/analytics
// - All actions should be authenticated as vendor

'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, Briefcase, HardDrive, DollarSign, Users, HelpCircle, Info, Edit2, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import SimpleTooltip from '@/components/ui/tooltip';

const featureCards = [
  {
    title: 'Manage Jobs',
    description: 'View, accept, and update your job requests.',
    icon: Briefcase,
    action: 'Go to Jobs',
    href: '/vendor/jobs',
  },
  {
    title: 'View Reviews',
    description: 'See client feedback and performance trends.',
    icon: Star,
    action: 'See Reviews',
    href: '/vendor/reviews',
  },
  {
    title: 'Billing & Earnings',
    description: 'Track your payments, invoices, and plans.',
    icon: DollarSign,
    action: 'View Billing',
    href: '/vendor/billing',
  },
  {
    title: 'Profile & Settings',
    description: 'Edit your business info and preferences.',
    icon: Users,
    action: 'Go to Profile',
    href: '/vendor/profile',
  },
  {
    title: 'Support & Help',
    description: 'Get assistance or open a support ticket.',
    icon: HelpCircle,
    action: 'Get Support',
    href: '/vendor/support',
  },
];

const mockEmployees = [
  { id: 1, name: 'Maria Lopez', jobs: 8, avgScore: 4.9, reviews: ["Great work!", "Very professional."] },
  { id: 2, name: 'James Lee', jobs: 5, avgScore: 4.7, reviews: ["Quick and efficient.", "Would hire again."] },
];

const mockBusinesses = [
  {
    id: 1,
    name: 'Tech Solutions Inc.',
    location: 'New York, NY',
    rating: 4.8,
    logo: '/reliance-logo.png', // Use your logo or a placeholder
  },
  {
    id: 2,
    name: 'Bright Electric',
    location: 'Boston, MA',
    rating: 4.6,
    logo: '', // No logo, will use initials
  },
];

export default function VendorMainPage() {
  const [selectedBusiness, setSelectedBusiness] = useState(mockBusinesses[0]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [employees] = useState(mockEmployees);
  // Mock vendor location and user location for distance calculation
  const vendorLocation = { lat: 40.7128, lng: -74.0060 }; // Example: New York
  const userLocation = { lat: 40.7306, lng: -73.9352 }; // Example: NYC (different point)

  // Simple Haversine formula for mock distance (in miles)
  function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 3958.8; // Radius of Earth in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  }

  const distance = getDistanceMiles(
    vendorLocation.lat,
    vendorLocation.lng,
    userLocation.lat,
    userLocation.lng
  );

  return (
    <div className="px-4 md:px-8 py-8 space-y-6">
      {/* Business Switcher Dropdown */}
      {mockBusinesses.length > 1 && (
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex items-center gap-2">
            <button
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 font-medium shadow-sm transition"
              onClick={() => setShowDropdown((v) => !v)}
            >
              {selectedBusiness.logo ? (
                <img src={selectedBusiness.logo} alt={selectedBusiness.name} className="w-8 h-8 rounded-full border" />
              ) : (
                <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-700 border">
                  {selectedBusiness.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                </span>
              )}
              <span className="font-semibold">{selectedBusiness.name}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            <SimpleTooltip content="Switch between your businesses if you manage more than one.">
              <Info className="w-4 h-4 text-gray-400 cursor-pointer" />
            </SimpleTooltip>
          </div>
        </div>
      )}
      {/* Helper Text: Only show if multiple businesses */}
      {mockBusinesses.length > 1 && (
        <div className="text-xs text-gray-500 mb-4 ml-2">Click the dropdown to switch between your businesses.</div>
      )}
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Your Vendor Portal</h1>
          <p className="text-gray-600 text-lg">Manage your business, jobs, and performance all in one place.</p>
        </div>
        {/* Enhanced Business Card */}
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {featureCards.map((card) => (
          <Card key={card.title} className="bg-white border border-gray-200 shadow-sm hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <card.icon className="w-8 h-8 text-blue-700" />
              <CardTitle className="text-lg font-semibold">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-gray-700 mb-4 min-h-[48px]">{card.description}</div>
              <Button asChild>
                <a href={card.href}>{card.action}</a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Team Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-start">
            <div className="mb-2 text-gray-700">See detailed performance and reviews for your team members.</div>
            <Button asChild>
              <a href="/vendor/analytics">View Team Analytics</a>
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Backend Developer Notes Section */}
      <div className="mt-10">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded shadow-sm">
          <h3 className="font-bold text-yellow-800 mb-2">Backend Developer Notes</h3>
          <ul className="text-sm text-yellow-900 list-disc pl-5 space-y-1">
            <li>Fetch vendor dashboard data from <b>GET /api/vendor/dashboard</b></li>
            <li>Fetch business info, location, and stats from <b>GET /api/vendor/profile</b> and <b>/api/vendor/stats</b></li>
            <li>Feature cards should link to real data-driven pages</li>
            <li>Team analytics should fetch from <b>GET /api/vendor/analytics</b></li>
            <li>All actions should be authenticated as vendor</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 