import type { VendorOnboardingState, VendorMembershipState } from "@/lib/vendor-onboarding-state";

// src/types/vendor.ts

export interface VendorDashboardProfile {
  id?: string;
  firstName: string;
  lastName: string;
  businessName: string;
  businessType: string;
  category: string;
  foundedYear: number | string;
  email: string;
  phone: string;
  city: string;
  state: string;
  serviceTypes: string[] | string;
  specializations: string[] | string;
  serviceAreas: string[] | string;
  totalBookings?: number;
  totalEarnings?: number;
  totalClients?: number;
  rating?: number;
}

export type VendorJobStatus =
  | 'completed'
  | 'in progress'
  | 'scheduled'
  | 'canceled'
  | 'awaiting_review'
  | 'archived';

export interface VendorJob {
  id: string;
  title: string;
  client: string;
  amount: number;
  status: VendorJobStatus;
  date: string; // ISO string
}

export interface VendorReview {
  id: string;
  client: string;
  rating: number;
  comment: string;
  date: string;
  jobType: string;
}

export interface VendorInsight {
  id: string;
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
}

export interface VendorNotification {
  id: string;
  type: 'job' | 'review' | 'payment' | 'reminder';
  title: string;
  message: string;
  time: string;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface VendorDashboardResponse {
  profile: VendorDashboardProfile;
  stats: {
    totalBookings: number;
    totalEarnings: number;
    totalClients: number;
    rating: number;
    ratingCount?: number;
  };
  employeePerformance?: Array<{
    membershipId: string;
    displayName: string;
    averageRating: number;
    reviewCount: number;
  }>;
  recentJobs: VendorJob[];
  lifecycleCounts?: {
    scheduled: number;
    inProgress: number;
    awaitingReview: number;
    completed: number;
    canceled: number;
    rejected?: number;
    archived: number;
  };
  recentReviews: VendorReview[];
  insights: VendorInsight[];
  notifications: VendorNotification[];
  pendingModerationProofs?: number;
  approvedProofs?: number;
  pendingModerationServiceOrderCount?: number;
  approvedServiceOrderCount?: number;
  publicServiceOrderCount?: number;
  approvedProofAssets?: number;
  archivedProofs?: number;
  totalProofAssets?: number;
  trustScore?: number | null;
  trustScoreSummary?: unknown;
  storageUsedBytes?: string;
  storageLimitBytes?: string;
  storagePercentUsed?: number;
}

// Profile-specific types (separate from dashboard)
export interface VendorProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string;
  businessName: string | null;
  businessType: string | null;
  category: string | null;
  foundedYear: number | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  zipCode: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocodedAt?: string | null;
  bio: string | null;
  website: string | null;
  licenseNumber: string | null;
  insuranceStatus: boolean;
  insuranceProvider: string | null;
  insuranceExpiry: string | null; // ISO string
  bondingStatus: boolean;
  emergencyContact: string | null;
  responseTimeSettings: string | null;
  businessHoursJson?: string | null;
  profilePhoto: string | null;
  // Array fields (stored as comma-separated strings in DB)
  serviceTypes: string[];
  specializations: string[];
  serviceAreas: string[];
  // Calculated fields
  totalEmployees: number; // From employees relation
  yearsInBusiness: number | null; // Calculated from foundedYear
  ratingAverage?: number;
  ratingCount?: number;
  // Payments
  paymentsEnabled: boolean;
  // Reminders
  reminders?: {
    review: boolean;
    invoice: boolean;
    maintenance: boolean;
    followUp: boolean;
  };
  // Notifications
  notificationSettings?: {
    job: boolean;
    review: boolean;
    payout: boolean;
    support: boolean;
    marketing: boolean;
    updates: boolean;
  };
  // Security Settings
  twoFactorEnabled?: boolean;
  loginNotifications?: boolean;
  sessionTimeout?: number;
  passwordExpiry?: number | null;
  failedLoginLockout?: number | null;
  membershipStatus?: VendorMembershipState;
  isPubliclyListed?: boolean;
  publiclyListedAt?: string | null;
  serviceDraftCount?: number;
  publishedServiceCount?: number;
  onboarding?: VendorOnboardingState;
}

export interface VendorProfileResponse {
  success: boolean;
  profile: VendorProfile;
  approvalPending?: boolean;
}

export interface VendorProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  businessName?: string;
  businessType?: string;
  category?: string;
  foundedYear?: number;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  address?: string;
  zipCode?: string;
  bio?: string;
  website?: string;
  licenseNumber?: string;
  insuranceStatus?: boolean;
  insuranceProvider?: string;
  insuranceExpiry?: string;
  bondingStatus?: boolean;
  emergencyContact?: string;
  responseTimeSettings?: string;
  businessHoursJson?: string | null;
  profilePhoto?: string;
  serviceTypes?: string[];
  specializations?: string[];
  serviceAreas?: string[];
  // Payments
  paymentsEnabled?: boolean;
  // Reminders
  reminders?: {
    review?: boolean;
    invoice?: boolean;
    maintenance?: boolean;
    followUp?: boolean;
  };
  // Notifications
  notificationSettings?: {
    job?: boolean;
    review?: boolean;
    payout?: boolean;
    support?: boolean;
    marketing?: boolean;
    updates?: boolean;
  };
  // Security Settings
  twoFactorEnabled?: boolean;
  loginNotifications?: boolean;
  sessionTimeout?: number;
  passwordExpiry?: number | null;
  failedLoginLockout?: number | null;
}

// Device Pairing Types
export interface VendorDevice {
  id: string;
  vendorId: string;
  employeeId: string | null;
  deviceName: string; // Required
  deviceType: string; // "PHONE" | "HEADSET"
  userAgent: string | null;
  lastSeenAt: string; // ISO string (has default)
  createdAt: string; // ISO string
}

export interface PairingRequestResponse {
  code: string;
  expiresAt: string; // ISO string
  pairingUrl: string;
  inviteToken?: string;
  linkAccessMode?: "public" | "local_only";
  inviteDelivery?: {
    anySuccess: boolean;
    email?: {
      attempted: boolean;
      success: boolean;
      errorMessage?: string;
      providerMessageId?: string;
    };
    sms?: {
      attempted: boolean;
      success: boolean;
      errorMessage?: string;
      providerMessageId?: string;
      errorCode?: string;
      trialRestriction?: boolean;
    };
    summaryMessage?: string | null;
  };
}

export interface PairingConfirmBody {
  code: string;
  deviceType: string; // "PHONE" | "HEADSET"
  deviceName: string; // Required
  userAgent?: string | null;
}

export interface PairingConfirmResponse {
  success: boolean;
  device: VendorDevice;
}
