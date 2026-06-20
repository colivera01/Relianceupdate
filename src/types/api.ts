// Base API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// User Types
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: 'customer' | 'vendor' | 'both';
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bio?: string;
  createdAt: string;
  isActive: boolean;
  phone?: string;
  profilePhoto?: string | null;
}

export interface CustomerProfile extends User {
  preferences?: {
    notifications: boolean;
    emailMarketing: boolean;
  };
  favorites: string[];
  bookingHistory: string[];
  reviews: string[];
}

export interface VendorProfile extends User {
  businessName: string;
  businessType: string;
  category: string;
  businessBio: string;
  foundedYear: string;
  licenseNumber: string;
  insuranceStatus: string;
  bondingStatus: string;
  totalEmployees: string;
  yearsInBusiness: string;
  serviceTypes: string | string[];
  specializations: string | string[];
  serviceAreas: string | string[];
  website?: string;
  emergencyContact?: string;
  responseTime: string;
  profileImage?: string;
  isVerified: boolean;
  isApproved: boolean;
  approvalStatus: string;
  rating: number;
  totalReviews: number;
  totalBookings: number;
  totalEarnings: number;
}

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user: User;
  token: string;
  availableProfiles?: string[];
}

export interface RegisterRequest {
  userType: 'customer' | 'vendor';
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  bio?: string;
  // Vendor-specific fields
  businessName?: string;
  businessType?: string;
  category?: string;
  businessBio?: string;
  foundedYear?: string;
  licenseNumber?: string;
  insuranceStatus?: string;
  bondingStatus?: string;
  totalEmployees?: string;
  yearsInBusiness?: string;
  serviceTypes?: string[];
  specializations?: string[];
  serviceAreas?: string[];
  website?: string;
  emergencyContact?: string;
  responseTime?: string;
  profilePhoto?: string;
}

// Service Types
export interface Service {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  original_price?: number;
  discount?: number;
  duration: string;
  rating: number;
  review_count: number;
  vendor: {
    id: number;
    name: string;
    rating: number;
    review_count: number;
    verified: boolean;
    location: string;
  };
  features: string[];
  inclusions: string[];
  images: string[];
  available: boolean;
  created_at: string;
}

export interface CreateServiceDTO {
  name: string;
  description: string;
  category: string;
  price: number;
  duration: string;
  features: string[];
  inclusions: string[];
  images?: string[];
}

export interface UpdateServiceDTO extends Partial<CreateServiceDTO> {
  available?: boolean;
}

export interface DiscoverServiceResult {
  serviceId: string;
  serviceName: string;
  serviceDescription: string;
  vendorId: string;
  vendorName: string;
  vendorCategory: string | null;
  vendorBusinessType: string | null;
  location: string | null;
  distanceMiles?: number | null;
  previewMediaUrl: string | null;
  previewMediaType: 'image' | 'video' | null;
  price: number;
  rating: number | null;
  reviewCount: number | null;
  trustScore: {
    scored: boolean;
    totalScorePct: number | null;
    maturityState?: 'not_ready' | 'early_stage' | 'emerging' | 'established';
    maturityLabel?: string;
    evidence?: {
      verifiedBookings: number;
      approvedServiceVideos: number;
      validatedDisputes: number;
    };
  };
  badges: {
    verified: boolean | null;
    featured: boolean | null;
  };
  publicListing: {
    serviceEligible: boolean;
    hasPublicMedia: boolean;
  };
  proofCard?: {
    kind: 'public_proof' | 'partial_proof' | 'service_offered_only';
    headline: string;
    statusLabel: string;
    stageAvailability: {
      startingCondition: boolean;
      workInProgress: boolean;
      finalResult: boolean;
    };
    reviewLabel: string;
    trustLabel: string;
    evidenceSummary: string;
    primaryCta: 'View Service Details' | 'View Provider' | 'View Service Offered';
  };
  promotion?: {
    campaignId: string;
    campaignName: string;
    packageKey?: string;
    placementType: string;
    label: string;
    explainer: string;
    targetCategory: string | null;
    targetCity: string | null;
    targetState: string | null;
    targetRadiusMiles?: number | null;
    endsAt: string | null;
  };
}

export interface DiscoverServicesResponse {
  success: boolean;
  promotedListings?: DiscoverServiceResult[];
  results: DiscoverServiceResult[];
  pagination: Pagination;
  appliedFilters: {
    q: string | null;
    category: string | null;
    sortBy: string;
    radiusMiles?: number | null;
  };
  location?: {
    inputAccepted: boolean;
    inputSource: 'none' | 'coordinates' | 'address';
    geocodingProvider?: 'disabled' | 'mapbox';
    geocodedVendorCount?: number;
    distanceResultCount?: number;
    distanceFilteringApplied: boolean;
    distanceSortingApplied: boolean;
    supportedFutureInputs: string[];
  };
  notes?: {
    distance?: string;
    reviews?: string;
  };
}

export interface PublicCategoryAggregate {
  key: string;
  label: string;
  serviceCount: number;
  vendorCount: number;
  sampleServices: string[];
}

export interface PublicCategoriesResponse {
  success: boolean;
  categories: PublicCategoryAggregate[];
  meta?: {
    countedServices: number;
    eligibilityRule?: string;
    note?: string;
  };
}

// Booking Types
export interface Booking {
  id: number;
  service: {
    id: number;
    name: string;
    price: number;
    duration: string;
  };
  vendor: {
    id: number;
    name: string;
    rating: number;
    phone: string;
  };
  user: {
    id: number;
    name: string;
    email: string;
  };
  booking_date: string;
  booking_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  total_price: number;
  user_notes?: string;
  created_at: string;
}

export interface CreateBookingDTO {
  serviceId: number;
  vendorId: number;
  bookingDate: string;
  bookingTime: string;
  userNotes?: string;
}

export interface UpdateBookingDTO {
  status?: 'confirmed' | 'completed' | 'cancelled';
  userNotes?: string;
}

// Review Types
export interface Review {
  id: number;
  serviceId: number;
  vendorId: number;
  userId: number;
  rating: number;
  comment: string;
  createdAt: string;
  helpful: number;
  response?: string;
  responseDate?: string;
}

export interface CreateReviewDTO {
  serviceId: number;
  vendorId: number;
  rating: number;
  comment: string;
}

export interface UpdateReviewDTO {
  rating?: number;
  comment?: string;
}

// Availability Types
export interface VendorAvailability {
  vendorId: string;
  schedule: {
    [day: string]: {
      available: boolean;
      startTime?: string;
      endTime?: string;
      breaks?: Array<{
        start: string;
        end: string;
      }>;
    };
  };
  exceptions?: Array<{
    date: string;
    available: boolean;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }>;
  responseTime: string;
  emergencyAvailable: boolean;
}

export interface UpdateAvailabilityDTO {
  schedule?: VendorAvailability['schedule'];
  exceptions?: VendorAvailability['exceptions'];
  responseTime?: string;
  emergencyAvailable?: boolean;
}

// Search Types
export interface SearchParams {
  q?: string;
  category?: string;
  location?: string;
  priceRange?: {
    min: number;
    max: number;
  };
  rating?: number;
  availability?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  id: string;
  type: 'service' | 'vendor' | 'category';
  title: string;
  description: string;
  image?: string;
  rating?: number;
  price?: number;
  location?: string;
  relevance: number;
}

export interface SearchResponse {
  results: SearchResult[];
  suggestions: string[];
  total: number;
  page: number;
  limit: number;
}

// Favorite Types
export interface Favorite {
  id: string;
  userId: string;
  serviceId?: string;
  vendorId?: string;
  type: 'service' | 'vendor';
  notes?: string;
  createdAt: string;
}

export interface CreateFavoriteDTO {
  serviceId?: string;
  vendorId?: string;
  type: 'service' | 'vendor';
  notes?: string;
}

export interface FavoriteServiceItem {
  favoriteId: string;
  serviceId: string;
  serviceName: string;
  serviceDescription: string;
  price: number;
  vendorId: string;
  vendorName: string;
  vendorCategory: string | null;
  vendorBusinessType: string | null;
  location: string | null;
  rating: number | null;
  reviewCount: number | null;
  previewMediaUrl: string | null;
  previewMediaType: 'image' | 'video' | null;
  publicListing: {
    serviceEligible: boolean;
    hasPublicMedia: boolean;
  };
  favoritedAt: string;
}

export interface FavoritesListResponse {
  success: boolean;
  favorites: FavoriteServiceItem[];
  pagination: Pagination;
}

// Profile Toggle Types
export interface ProfileToggleRequest {
  targetProfile: 'customer' | 'vendor';
}

export interface ProfileToggleResponse {
  success: boolean;
  currentProfile: 'customer' | 'vendor';
  availableProfiles: string[];
}

// Error Types
export interface ApiError {
  error: string;
  message?: string;
  statusCode: number;
  details?: any;
}
