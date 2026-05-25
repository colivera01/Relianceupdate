'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDiscoverServices, useServiceCategories } from '@/hooks/useServices';
import { 
  Search, 
  Star, 
  Shield, 
  Clock, 
  Users, 
  CheckCircle, 
  ArrowRight,
  Play,
  TrendingUp,
  Zap,
  Heart,
  MessageCircle,
  Settings,
  Sparkles
} from 'lucide-react';

const HOME_MARKETPLACE_PREVIEW_LIMIT = 3;

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'user' | 'vendor'>('user');
  const {
    data: marketplaceData,
    isLoading: marketplaceLoading,
    isError: marketplaceError,
  } = useDiscoverServices({
    sortBy: 'newest',
    limit: HOME_MARKETPLACE_PREVIEW_LIMIT,
  });
  const {
    data: categoryData,
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = useServiceCategories();

  const features = [
    {
      icon: <Search className="h-6 w-6" />,
      title: "Discover Local Services",
      description: "Find exactly what you need, when you need it."
    },
    {
      icon: <MessageCircle className="h-6 w-6" />,
      title: "Transparent Video Profiles",
      description: "See vendors in action with video showcases and demonstrations."
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Powerful Analytics",
      description: "Vendors get detailed insights to grow their business."
    },
    {
      icon: <Star className="h-6 w-6" />,
      title: "Enhanced Reviews",
      description: "Generate more authentic reviews than other platforms."
    }
  ];

  const vendorBenefits = [
    "Scale your business with new customers",
    "Create compelling video profiles",
    "Build your brand and reputation",
    "Access powerful business analytics",
    "Generate authentic customer reviews"
  ];

  const userBenefits = [
    "Find local professionals with video profiles",
    "See vendors in action before hiring",
    "Read real customer reviews",
    "Make informed decisions with transparency",
    "Connect with local service providers"
  ];

  const marketplaceResults = marketplaceData?.results || [];
  const categoryPreview = (categoryData?.categories || []).slice(0, 4);
  const totalPublicServices = marketplaceData?.pagination?.total ?? categoryData?.meta?.countedServices ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-slate-900">
      {/* Navigation */}
      <nav className="border-b border-blue-200 bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="relative">
                  <img src="/reliance-logo.png" alt="Reliance" className="h-16 w-16 transition-transform group-hover:scale-110 drop-shadow-md" />
                </div>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/browse">
                <Button variant="ghost" className="text-slate-600 hover:text-blue-700 hover:bg-blue-50">
                  Browse Services
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400">
                  Sign In
                </Button>
              </Link>
              <Link href="#register">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-20 h-20 bg-blue-400/20 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute top-40 right-20 w-32 h-32 bg-blue-300/20 rounded-full blur-xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-blue-500/20 rounded-full blur-xl animate-pulse delay-2000"></div>
        </div>
        
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 to-blue-800/90"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="bg-white rounded-full p-6 shadow-2xl">
                  <img src="/reliance-logo.png" alt="Reliance" className="h-48 w-48 mx-auto drop-shadow-lg" />
                </div>
              </div>
            </div>
            <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Get the Job Done Right
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">
                {" "}— With People You Can Count On
              </span>
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto leading-relaxed">
              Whether you're looking for help at home or support from a specialist, Reliance connects you with local professionals you can trust — no hassle, no guesswork.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="#register">
                <Button size="lg" className="text-lg px-8 py-4 bg-white text-blue-700 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-200 group">
                  <Play className="mr-2 h-5 w-5 group-hover:animate-pulse" />
                  Get Started
                </Button>
              </Link>
              <Link href="/browse">
                <Button size="lg" className="text-lg px-8 py-4 bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 group font-semibold">
                  <Search className="mr-2 h-5 w-5 group-hover:animate-pulse" />
                  Browse Services
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Why Choose Reliance?
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-4">
              Built for transparency, powered by integrity.
            </p>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto">
              Reliance is designed for those who want more than just a quick hire — we're here to make service experiences smooth, honest, and reliable from the very beginning.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center border-0 bg-gradient-to-br from-blue-50 to-white hover:from-blue-100 hover:to-white transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl group">
                <CardHeader>
                  <div className="mx-auto w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white mb-4 shadow-md group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg text-slate-900">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-slate-600">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Live Marketplace Preview */}
      <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
            <div>
              <Badge className="mb-3 bg-blue-100 text-blue-800 hover:bg-blue-100">
                Live marketplace
              </Badge>
              <h2 className="text-4xl font-bold text-slate-900 mb-3">
                See what is active on Reliance
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl">
                These listings and category counts come from the same public-safe inventory that powers Browse.
              </p>
            </div>
            <Link href="/browse">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                View All Services
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid lg:grid-cols-[1.6fr_1fr] gap-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-slate-900">Newest Public Services</h3>
                <span className="text-sm text-slate-500">
                  {marketplaceLoading ? 'Loading...' : `${totalPublicServices} public service${totalPublicServices === 1 ? '' : 's'}`}
                </span>
              </div>

              {marketplaceLoading ? (
                <div className="grid md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((item) => (
                    <Card key={item} className="animate-pulse border-blue-100">
                      <CardContent className="p-5">
                        <div className="h-4 bg-slate-200 rounded mb-3" />
                        <div className="h-3 bg-slate-200 rounded mb-2" />
                        <div className="h-3 bg-slate-200 rounded w-2/3 mb-5" />
                        <div className="h-9 bg-slate-200 rounded" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : marketplaceError ? (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-5 text-sm text-amber-900">
                    We could not load live marketplace services right now. You can still browse the public catalog.
                  </CardContent>
                </Card>
              ) : marketplaceResults.length === 0 ? (
                <Card className="border-slate-200 bg-white">
                  <CardContent className="p-5 text-sm text-slate-600">
                    No public services are available yet. Check back as vendors publish approved listings.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-3 gap-4">
                  {marketplaceResults.map((item) => (
                    <Card key={item.serviceId} className="bg-white border-blue-100 shadow-sm hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="text-lg leading-snug text-slate-900">
                            {item.serviceName}
                          </CardTitle>
                          {item.vendorCategory ? (
                            <Badge variant="outline" className="text-xs">
                              {item.vendorCategory}
                            </Badge>
                          ) : null}
                        </div>
                        <CardDescription className="line-clamp-2">
                          {item.serviceDescription || 'Public service listing'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-slate-700 mb-2">
                          Vendor:{' '}
                          <Link href={`/vendors/${item.vendorId}`} className="font-medium text-blue-700 hover:text-blue-800">
                            {item.vendorName}
                          </Link>
                        </p>
                        <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
                          {typeof item.rating === 'number' && typeof item.reviewCount === 'number' ? (
                            <span className="flex items-center gap-1 font-medium text-slate-900">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              {item.rating.toFixed(1)} ({item.reviewCount} public review{item.reviewCount === 1 ? '' : 's'})
                            </span>
                          ) : (
                            <span className="font-medium text-slate-900">New public listing</span>
                          )}
                          <span>{item.publicListing.hasPublicMedia ? 'Public proof available' : 'Vendor verified listing'}</span>
                        </div>
                        <Link href={`/service/${item.serviceId}`}>
                          <Button variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-50">
                            View Service
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Card className="bg-white border-blue-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl text-slate-900">Public Categories</CardTitle>
                <CardDescription>Backend-derived category counts from public inventory.</CardDescription>
              </CardHeader>
              <CardContent>
                {categoriesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="h-10 bg-slate-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : categoriesError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Category counts are temporarily unavailable.
                  </div>
                ) : categoryPreview.length === 0 ? (
                  <div className="text-sm text-slate-600">
                    Categories will appear as public services are published.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {categoryPreview.map((category) => (
                      <Link
                        key={category.key}
                        href={`/browse?category=${encodeURIComponent(category.label)}`}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <span className="font-medium text-slate-800">{category.label}</span>
                        <span className="text-sm text-slate-500">
                          {category.serviceCount} service{category.serviceCount === 1 ? '' : 's'}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Registration Section */}
      <section id="register" className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Join Reliance Today
            </h2>
            <p className="text-lg text-slate-600">
              Choose your path and start your journey
            </p>
          </div>

          {/* Toggle Buttons */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-lg p-1 shadow-lg">
              <button
                onClick={() => setActiveTab('user')}
                className={`px-8 py-3 rounded-md font-medium transition-all ${
                  activeTab === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                    : 'text-slate-600 hover:text-blue-700'
                }`}
              >
                I Need Services
              </button>
              <button
                onClick={() => setActiveTab('vendor')}
                className={`px-8 py-3 rounded-md font-medium transition-all ${
                  activeTab === 'vendor'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                    : 'text-slate-600 hover:text-blue-700'
                }`}
              >
                I Provide Services
              </button>
            </div>
          </div>

          {/* Registration Cards */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* User Registration */}
            <Card className={`transition-all duration-300 bg-white border-blue-200 shadow-lg hover:shadow-xl ${activeTab === 'user' ? 'ring-2 ring-blue-500 scale-105' : 'opacity-90'}`}>
              <CardHeader>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-slate-900">Find Services</CardTitle>
                    <CardDescription className="text-slate-600">Join as a customer</CardDescription>
                  </div>
                </div>
                <ul className="space-y-3">
                  {userBenefits.map((benefit, index) => (
                    <li key={index} className="flex items-center space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-slate-700">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </CardHeader>
              <CardContent>
                <Link href="/auth/register?type=user">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 group">
                    Join as Customer
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Vendor Registration */}
            <Card className={`transition-all duration-300 bg-white border-blue-200 shadow-lg hover:shadow-xl ${activeTab === 'vendor' ? 'ring-2 ring-blue-500 scale-105' : 'opacity-90'}`}>
              <CardHeader>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-slate-900">Provide Services</CardTitle>
                    <CardDescription className="text-slate-600">Join as a vendor</CardDescription>
                  </div>
                </div>
                <ul className="space-y-3">
                  {vendorBenefits.map((benefit, index) => (
                    <li key={index} className="flex items-center space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-slate-700">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </CardHeader>
              <CardContent>
                <Link href="/auth/register?type=vendor">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 group">
                    Join as Vendor
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src="/reliance-logo.png" alt="Reliance" className="h-12 w-12 rounded drop-shadow-md" />
                <span className="text-xl font-bold text-white">RELIANCE</span>
              </div>
              <p className="text-slate-400">
                Connecting local professionals with customers through transparency and video profiles.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-white">For Customers</h3>
              <ul className="space-y-2 text-slate-400">
                <li><Link href="/browse" className="hover:text-white transition-colors">Browse Services</Link></li>
                <li><Link href="/auth/register?type=user" className="hover:text-white transition-colors">Sign Up</Link></li>
                <li><Link href="/auth/login" className="hover:text-white transition-colors">Sign In</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-white">For Vendors</h3>
              <ul className="space-y-2 text-slate-400">
                <li><Link href="/auth/register?type=vendor" className="hover:text-white transition-colors">Join as Vendor</Link></li>
                <li><Link href="/auth/login" className="hover:text-white transition-colors">Sign In</Link></li>
                <li><Link href="/auth/login" className="hover:text-white transition-colors">Vendor Portal</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-white">Support</h3>
              <ul className="space-y-2 text-slate-400">
                <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-400">
            <p>&copy; 2024 Reliance. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}