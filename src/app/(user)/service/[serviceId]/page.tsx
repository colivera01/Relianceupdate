'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { resolveCustomerUserId } from '@/lib/customer-user-id';
import { 
  MapPin, 
  Star, 
  Clock, 
  Phone, 
  Mail, 
  Calendar, 
  Heart, 
  Share2, 
  ChevronLeft,
  CheckCircle,
  Users,
  Award,
  Shield,
  Clock as TimeIcon
} from 'lucide-react';

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const serviceId = String(params?.serviceId ?? "");
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'photos'>('overview');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'images' | 'videos'>('all');
  const [service, setService] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any>(null);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  // Fetch service details, reviews, and availability
  useEffect(() => {
    const fetchServiceData = async () => {
      try {
        setLoading(true);
        
        // Fetch service details
        const serviceResponse = await fetch(`/api/services/${serviceId}`);
        if (!serviceResponse.ok) {
          throw new Error('Failed to fetch service details');
        }
        const serviceData = await serviceResponse.json();
        setService(serviceData.service);

        // Fetch reviews
        const reviewsResponse = await fetch(`/api/reviews?serviceId=${serviceId}`);
        if (reviewsResponse.ok) {
          const reviewsData = await reviewsResponse.json();
          setReviews(reviewsData.reviews || []);
        }

        // Fetch availability
        if (serviceData.service.vendor?.id) {
          const availabilityResponse = await fetch(`/api/availability/vendor/${serviceData.service.vendor.id}`);
          if (availabilityResponse.ok) {
            const availabilityData = await availabilityResponse.json();
            setAvailability(availabilityData.availability);
          }
        }

        // Check if service is in favorites
        const userId = resolveCustomerUserId(user?.id);
        const favoritesQuery = userId ? `?userId=${encodeURIComponent(userId)}` : '';
        const favoritesResponse = await fetch(`/api/users/favorites${favoritesQuery}`, {
          headers: {
            ...(userId ? { 'x-user-id': userId } : {}),
          },
        });
        if (favoritesResponse.ok) {
          const favoritesData = await favoritesResponse.json();
          const existingFavorite = favoritesData.favorites?.find((fav: any) => fav.serviceId === serviceId);
          setIsFavorite(Boolean(existingFavorite));
          setFavoriteId(existingFavorite?.favoriteId || null);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (serviceId) {
      fetchServiceData();
    }
  }, [serviceId, user?.id]);

  const handleBookNow = () => {
    router.push(`/booking/${serviceId}`);
  };

  const handleContactVendor = () => {
    if (service?.vendor?.phone) {
      window.open(`tel:${service.vendor.phone}`, '_blank');
    }
  };

  const handleToggleFavorite = async () => {
    if (!service) return;

    try {
      setFavoriteLoading(true);
      
      if (isFavorite) {
        // Remove from favorites
        const userId = resolveCustomerUserId(user?.id);
        const removeQuery = userId ? `?userId=${encodeURIComponent(userId)}` : '';
        const response = await fetch(`/api/users/favorites/${favoriteId || serviceId}${removeQuery}`, {
          method: 'DELETE',
          headers: {
            ...(userId ? { 'x-user-id': userId } : {}),
          },
        });
        
        if (response.ok) {
          setIsFavorite(false);
          setFavoriteId(null);
        }
      } else {
        // Add to favorites
        const userId = resolveCustomerUserId(user?.id);
        const response = await fetch('/api/users/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(userId ? { 'x-user-id': userId } : {}),
          },
          body: JSON.stringify({
            serviceId,
            ...(userId ? { userId } : {}),
          }),
        });
        
        if (response.ok) {
          const payload = await response.json();
          setIsFavorite(true);
          setFavoriteId(payload?.favorite?.favoriteId || null);
        }
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: service?.name || 'Service',
        text: `Check out this ${service?.name} service by ${service?.vendor?.name}`,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      // You could show a toast notification here
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading service details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">⚠️</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => router.back()}
            className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Service not found</p>
          <button 
            onClick={() => router.back()}
            className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
            
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-testid="service-page-favorite-toggle"
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                onClick={handleToggleFavorite}
                disabled={favoriteLoading}
                className={`p-2 rounded-full transition-colors ${
                  isFavorite ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-600 hover:bg-pink-100 hover:text-pink-600'
                } ${favoriteLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
              <button 
                onClick={handleShare}
                className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-blue-100 hover:text-blue-600 transition-colors"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Service Images */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-6">
              <div className="relative">
                <img 
                  src={service.images?.[0] || '/placeholder-service.jpg'} 
                  alt={service.name}
                  className="w-full h-96 object-cover"
                />
                {service.original_price && service.price < service.original_price && (
                  <div className="absolute top-4 left-4">
                    <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      {Math.round(((service.original_price - service.price) / service.original_price) * 100)}% OFF
                    </div>
                  </div>
                )}
                {service.socialProof && (
                  <div className="absolute top-4 right-4">
                    <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      {service.socialProof.bookingsToday} booked today
                    </div>
                  </div>
                )}
              </div>
              
              {/* Media Gallery */}
              {service.images && service.images.length > 0 && (
                <div className="p-4">
                  {/* Media Filter */}
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setMediaFilter('all')}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        mediaFilter === 'all' 
                          ? 'bg-purple-500 text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      All ({(service.images?.length || 0) + (service.videos?.length || 0)})
                    </button>
                    <button
                      onClick={() => setMediaFilter('images')}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        mediaFilter === 'images' 
                          ? 'bg-purple-500 text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Photos ({service.images?.length || 0})
                    </button>
                    <button
                      onClick={() => setMediaFilter('videos')}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        mediaFilter === 'videos' 
                          ? 'bg-purple-500 text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Videos ({service.videos?.length || 0})
                    </button>
                  </div>
                  
                  <div className="flex gap-2 overflow-x-auto">
                    {/* Images */}
                    {mediaFilter !== 'videos' && service.images?.map((image: string, index: number) => (
                      <div key={`image-${index}`} className="relative flex-shrink-0">
                        <img 
                          src={image} 
                          alt={`${service.name} photo ${index + 1}`}
                          className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        />
                        <div className="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded">
                          Photo
                        </div>
                      </div>
                    ))}
                    
                    {/* Videos */}
                    {mediaFilter !== 'images' && service.videos?.map((video: string, index: number) => (
                      <div key={`video-${index}`} className="relative flex-shrink-0">
                        <video 
                          src={video}
                          className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8 5v10l8-5-8-5z"/>
                            </svg>
                          </div>
                        </div>
                        <div className="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded">
                          Video
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Service Information */}
            <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{service.name}</h1>
                  <div className="flex items-center gap-4 text-gray-600">
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{service.vendor?.rating || 0}</span>
                      <span>({service.vendor?.review_count || 0} reviews)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{service.vendor?.location || 'Location not available'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{service.duration || 'Duration not specified'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-3xl font-bold text-purple-600">${service.price}</div>
                  {service.original_price && service.price < service.original_price && (
                    <>
                      <div className="text-lg text-gray-500 line-through">${service.original_price}</div>
                      <div className="text-sm text-green-600 font-medium">Save ${service.original_price - service.price}</div>
                    </>
                  )}
                </div>
              </div>

              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                {service.description}
              </p>

              {/* Features */}
              {service.inclusions && service.inclusions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">What's Included</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {service.inclusions.map((item: string, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Features */}
              {service.features && service.features.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Features</h3>
                  <div className="flex flex-wrap gap-2">
                    {service.features.map((feature: string, index: number) => (
                      <span 
                        key={index}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-sm mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'overview', label: 'Overview', icon: null },
                    { id: 'reviews', label: `Reviews (${reviews.length})`, icon: null },
                    { id: 'photos', label: `Photos & Videos (${(service.images?.length || 0) + (service.videos?.length || 0)})`, icon: null }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-6">
                {activeTab === 'overview' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">About This Service</h3>
                    <p className="text-gray-700 leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div>
                    {reviews.length > 0 ? (
                      <div className="space-y-6">
                        {reviews.map((review) => (
                          <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                                  <span className="text-white font-semibold text-sm">
                                    {review.user?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                                  </span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900">{review.user?.name || 'Anonymous'}</span>
                                    {review.verified && (
                                      <span className="text-blue-500 text-xs">✓ Verified</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star 
                                        key={i} 
                                        className={`w-4 h-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                                      />
                                    ))}
                                    <span className="text-sm text-gray-500 ml-2">{review.created_at ? new Date(review.created_at).toLocaleDateString() : 'Recently'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <p className="text-gray-700 leading-relaxed">{review.comment}</p>
                            <div className="flex items-center gap-4 mt-3">
                              <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-500 transition-colors">
                                <span>👍</span>
                                <span>{review.helpful_count || 0} helpful</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No reviews yet. Be the first to review this service!</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'photos' && (
                  <div>
                    {/* Media Filter for Photos Tab */}
                    <div className="flex gap-2 mb-6">
                      <button
                        onClick={() => setMediaFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          mediaFilter === 'all' 
                            ? 'bg-purple-500 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        All Media ({(service.images?.length || 0) + (service.videos?.length || 0)})
                      </button>
                      <button
                        onClick={() => setMediaFilter('images')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          mediaFilter === 'images' 
                            ? 'bg-purple-500 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Photos ({service.images?.length || 0})
                      </button>
                      <button
                        onClick={() => setMediaFilter('videos')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          mediaFilter === 'videos' 
                            ? 'bg-purple-500 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Videos ({service.videos?.length || 0})
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Images */}
                      {mediaFilter !== 'videos' && service.images?.map((image: string, index: number) => (
                        <div key={`photo-${index}`} className="relative group">
                          <img 
                            src={image} 
                            alt={`${service.name} photo ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          />
                          <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                            Photo
                          </div>
                        </div>
                      ))}
                      
                      {/* Videos */}
                      {mediaFilter !== 'images' && service.videos?.map((video: string, index: number) => (
                        <div key={`video-${index}`} className="relative group">
                          <video 
                            src={video}
                            className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 bg-black bg-opacity-50 rounded-full flex items-center justify-center group-hover:bg-opacity-70 transition-all">
                              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M8 5v10l8-5-8-5z"/>
                              </svg>
                            </div>
                          </div>
                          <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                            Video
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Booking Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24 mb-6">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-purple-600 mb-1">${service.price}</div>
                {service.original_price && service.price < service.original_price && (
                  <>
                    <div className="text-lg text-gray-500 line-through">${service.original_price}</div>
                    <div className="text-sm text-green-600 font-medium">Save ${service.original_price - service.price}</div>
                  </>
                )}
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>Next available: {availability?.next_available ? new Date(availability.next_available).toLocaleDateString() : 'Check availability'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <TimeIcon className="w-4 h-4" />
                  <span>{availability?.schedule ? 'Check schedule for details' : 'Contact vendor for hours'}</span>
                </div>
              </div>

              <button 
                onClick={handleBookNow}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200 mb-4"
              >
                Book Now
              </button>

              <button 
                onClick={handleContactVendor}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Contact Vendor
              </button>
            </div>

            {/* Vendor Card */}
            {service.vendor && (
              <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-lg">
                      {service.vendor.name?.split(' ').map((n: string) => n[0]).join('') || 'V'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{service.vendor.name}</h3>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm text-gray-600">{service.vendor.rating || 0} ({service.vendor.review_count || 0})</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{service.vendor.location || 'Location not available'}</span>
                  </div>
                  {service.vendor.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span>{service.vendor.phone}</span>
                    </div>
                  )}
                  {service.vendor.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span>{service.vendor.email}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Response Time</div>
                      <div className="font-medium">{service.vendor.response_time || 'Contact vendor'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Total Jobs</div>
                      <div className="font-medium">{service.vendor.total_jobs || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Years in Business</div>
                      <div className="font-medium">{service.vendor.years_in_business || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Verified</div>
                      <div className="font-medium text-green-600">✓ {service.vendor.verified ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  {service.vendor.insurance && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Insured
                    </span>
                  )}
                  {service.vendor.bonded && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      Bonded
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Social Proof */}
            {service.socialProof && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Popular in your area</span>
                </div>
                <div className="text-sm text-green-600">
                  {service.socialProof.bookingsToday} people in {service.socialProof.area} booked this {service.socialProof.timeFrame}
                </div>
                {service.socialProof.peopleLikeYou && (
                  <div className="text-sm text-green-600 mt-1">
                    {service.socialProof.peopleLikeYou} people like you also viewed this service
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 