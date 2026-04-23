import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { isVendorContextDbTimeoutError, resolveVendorAccessForUser } from "@/lib/vendor-context";
import { VendorProfileResponse, VendorProfileUpdateRequest } from "@/types/vendor";

const VENDOR_PROFILE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  businessName: true,
  businessType: true,
  category: true,
  foundedYear: true,
  email: true,
  phone: true,
  city: true,
  state: true,
  address: true,
  zipCode: true,
  bio: true,
  website: true,
  licenseNumber: true,
  insuranceStatus: true,
  insuranceProvider: true,
  insuranceExpiry: true,
  bondingStatus: true,
  emergencyContact: true,
  responseTimeSettings: true,
  profilePhoto: true,
  serviceTypes: true,
  specializations: true,
  serviceAreas: true,
  paymentsEnabled: true,
  reminders_review: true,
  reminders_invoice: true,
  reminders_maintenance: true,
  reminders_followUp: true,
  notifications_job: true,
  notifications_review: true,
  notifications_payout: true,
  notifications_support: true,
  notifications_marketing: true,
  notifications_updates: true,
  twoFactorEnabled: true,
  loginNotifications: true,
  sessionTimeout: true,
  passwordExpiry: true,
  failedLoginLockout: true,
  _count: {
    select: {
      employees: true,
    },
  },
} as const;

export async function GET(request: Request) {
  try {
    if (process.env.NODE_ENV !== "production") {
      const cookieHeader = request.headers.get("cookie") || "";
      const resolvedUserId = await getUserIdFromRequest(request);
      console.info("[api/vendor/profile][GET] auth-debug", {
        hasCookieHeader: Boolean(cookieHeader),
        hasUserIdCookie: cookieHeader.includes("userId="),
        hasSessionUserIdCookie: cookieHeader.includes("session_user_id="),
        headerUserId: request.headers.get("x-user-id"),
        hasAuthorization: Boolean(request.headers.get("authorization")),
        resolvedUserId,
      });
    }
    const resolvedUserId = await getUserIdFromRequest(request);
    if (!resolvedUserId) {
      return NextResponse.json(
        { code: "VENDOR_SESSION_CONTEXT_UNAVAILABLE", error: "Vendor session context unavailable. Please sign in again." },
        { status: 401 }
      );
    }
    const vendorContext = await resolveVendorAccessForUser(resolvedUserId);
    if (vendorContext.state === "PENDING") {
      return NextResponse.json(
        { code: "VENDOR_PENDING_APPROVAL", error: "Vendor account pending approval" },
        { status: 403 }
      );
    }
    if (vendorContext.state !== "ACTIVE" || !vendorContext.vendorId) {
      return NextResponse.json(
        {
          code: "VENDOR_SESSION_CONTEXT_UNAVAILABLE",
          error: "Vendor session context unavailable. Please sign in again.",
        },
        { status: 401 }
      );
    }
    const vendorId = vendorContext.vendorId;

    // Fetch vendor from Prisma
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: VENDOR_PROFILE_SELECT,
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Calculate derived fields
    const totalEmployees = Number((vendor as any)?._count?.employees || 0);
    const yearsInBusiness = vendor.foundedYear
      ? new Date().getFullYear() - vendor.foundedYear
      : null;

    // Map Prisma data to VendorProfile
    const profile = {
      id: vendor.id,
      firstName: vendor.firstName ?? null,
      lastName: vendor.lastName ?? null,
      name: vendor.name,
      businessName: vendor.businessName ?? null,
      businessType: vendor.businessType ?? null,
      category: vendor.category ?? null,
      foundedYear: vendor.foundedYear ?? null,
      email: vendor.email ?? null,
      phone: vendor.phone ?? null,
      city: vendor.city ?? null,
      state: vendor.state ?? null,
      address: vendor.address ?? null,
      zipCode: vendor.zipCode ?? null,
      bio: vendor.bio ?? null,
      website: vendor.website ?? null,
      licenseNumber: vendor.licenseNumber ?? null,
      insuranceStatus: vendor.insuranceStatus ?? false,
      insuranceProvider: vendor.insuranceProvider ?? null,
      insuranceExpiry: vendor.insuranceExpiry?.toISOString() ?? null,
      bondingStatus: vendor.bondingStatus ?? false,
      emergencyContact: vendor.emergencyContact ?? null,
      responseTimeSettings: vendor.responseTimeSettings ?? null,
      profilePhoto: vendor.profilePhoto ?? null,
      // Convert comma-separated strings to arrays
      serviceTypes: vendor.serviceTypes ? vendor.serviceTypes.split(',').map(s => s.trim()).filter(Boolean) : [],
      specializations: vendor.specializations ? vendor.specializations.split(',').map(s => s.trim()).filter(Boolean) : [],
      serviceAreas: vendor.serviceAreas ? vendor.serviceAreas.split(',').map(s => s.trim()).filter(Boolean) : [],
      // Calculated fields
      totalEmployees,
      yearsInBusiness,
      // Payments (use optional chaining in case Prisma client hasn't been regenerated)
      paymentsEnabled: (vendor as any).paymentsEnabled ?? false,
      // Reminders
      reminders: {
        review: (vendor as any).reminders_review ?? true,
        invoice: (vendor as any).reminders_invoice ?? false,
        maintenance: (vendor as any).reminders_maintenance ?? true,
        followUp: (vendor as any).reminders_followUp ?? true,
      },
      // Notifications
      notificationSettings: {
        job: (vendor as any).notifications_job ?? true,
        review: (vendor as any).notifications_review ?? true,
        payout: (vendor as any).notifications_payout ?? false,
        support: (vendor as any).notifications_support ?? true,
        marketing: (vendor as any).notifications_marketing ?? false,
        updates: (vendor as any).notifications_updates ?? true,
      },
      // Security Settings
      twoFactorEnabled: (vendor as any).twoFactorEnabled ?? false,
      loginNotifications: (vendor as any).loginNotifications ?? true,
      sessionTimeout: (vendor as any).sessionTimeout ?? 30,
      passwordExpiry: (vendor as any).passwordExpiry ?? null,
      failedLoginLockout: (vendor as any).failedLoginLockout ?? null,
    };

    const response: VendorProfileResponse = {
      success: true,
      profile,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Vendor profile GET error:", err);
    const dbFailure = isVendorContextDbTimeoutError(err);
    return NextResponse.json(
      {
        code: dbFailure ? "DB_CONNECTION_TIMEOUT" : "VENDOR_CONTEXT_ERROR",
        error: dbFailure
          ? "Vendor context is temporarily unavailable because the database connection failed. Please retry."
          : "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: dbFailure ? 503 : 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    if (process.env.NODE_ENV !== "production") {
      const cookieHeader = request.headers.get("cookie") || "";
      const resolvedUserId = await getUserIdFromRequest(request);
      console.info("[api/vendor/profile][PUT] auth-debug", {
        hasCookieHeader: Boolean(cookieHeader),
        hasUserIdCookie: cookieHeader.includes("userId="),
        hasSessionUserIdCookie: cookieHeader.includes("session_user_id="),
        headerUserId: request.headers.get("x-user-id"),
        hasAuthorization: Boolean(request.headers.get("authorization")),
        resolvedUserId,
      });
    }
    const resolvedUserId = await getUserIdFromRequest(request);
    if (!resolvedUserId) {
      return NextResponse.json(
        { code: "VENDOR_SESSION_CONTEXT_UNAVAILABLE", error: "Vendor session context unavailable. Please sign in again." },
        { status: 401 }
      );
    }
    const vendorContext = await resolveVendorAccessForUser(resolvedUserId);
    if (vendorContext.state === "PENDING") {
      return NextResponse.json(
        { code: "VENDOR_PENDING_APPROVAL", error: "Vendor account pending approval" },
        { status: 403 }
      );
    }
    if (vendorContext.state !== "ACTIVE" || !vendorContext.vendorId) {
      return NextResponse.json(
        {
          code: "VENDOR_SESSION_CONTEXT_UNAVAILABLE",
          error: "Vendor session context unavailable. Please sign in again.",
        },
        { status: 401 }
      );
    }
    const vendorId = vendorContext.vendorId;

    const body = (await request.json()) as VendorProfileUpdateRequest;

    // Build update data object (only include defined fields)
    const updateData: Record<string, any> = {};
    
    if (body.firstName !== undefined) updateData.firstName = body.firstName || null;
    if (body.lastName !== undefined) updateData.lastName = body.lastName || null;
    if (body.businessName !== undefined) updateData.businessName = body.businessName || null;
    if (body.businessType !== undefined) updateData.businessType = body.businessType || null;
    if (body.category !== undefined) updateData.category = body.category || null;
    if (body.foundedYear !== undefined) updateData.foundedYear = body.foundedYear || null;
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.city !== undefined) updateData.city = body.city || null;
    if (body.state !== undefined) updateData.state = body.state || null;
    if (body.address !== undefined) updateData.address = body.address || null;
    if (body.zipCode !== undefined) updateData.zipCode = body.zipCode || null;
    if (body.bio !== undefined) updateData.bio = body.bio || null;
    if (body.website !== undefined) updateData.website = body.website || null;
    if (body.licenseNumber !== undefined) updateData.licenseNumber = body.licenseNumber || null;
    if (body.insuranceStatus !== undefined) updateData.insuranceStatus = body.insuranceStatus;
    if (body.insuranceProvider !== undefined) updateData.insuranceProvider = body.insuranceProvider || null;
    if (body.insuranceExpiry !== undefined) updateData.insuranceExpiry = body.insuranceExpiry ? new Date(body.insuranceExpiry) : null;
    if (body.bondingStatus !== undefined) updateData.bondingStatus = body.bondingStatus;
    if (body.emergencyContact !== undefined) updateData.emergencyContact = body.emergencyContact || null;
    if (body.responseTimeSettings !== undefined) updateData.responseTimeSettings = body.responseTimeSettings || null;
    if (body.profilePhoto !== undefined) updateData.profilePhoto = body.profilePhoto || null;
    // Convert arrays to comma-separated strings
    if (body.serviceTypes !== undefined) updateData.serviceTypes = body.serviceTypes.length > 0 ? body.serviceTypes.join(', ') : null;
    if (body.specializations !== undefined) updateData.specializations = body.specializations.length > 0 ? body.specializations.join(', ') : null;
    if (body.serviceAreas !== undefined) updateData.serviceAreas = body.serviceAreas.length > 0 ? body.serviceAreas.join(', ') : null;
    // Payments
    if (body.paymentsEnabled !== undefined) updateData.paymentsEnabled = body.paymentsEnabled;
    // Reminders
    if (body.reminders !== undefined) {
      if (body.reminders.review !== undefined) updateData.reminders_review = body.reminders.review;
      if (body.reminders.invoice !== undefined) updateData.reminders_invoice = body.reminders.invoice;
      if (body.reminders.maintenance !== undefined) updateData.reminders_maintenance = body.reminders.maintenance;
      if (body.reminders.followUp !== undefined) updateData.reminders_followUp = body.reminders.followUp;
    }
    // Notifications
    if (body.notificationSettings !== undefined) {
      if (body.notificationSettings.job !== undefined) updateData.notifications_job = body.notificationSettings.job;
      if (body.notificationSettings.review !== undefined) updateData.notifications_review = body.notificationSettings.review;
      if (body.notificationSettings.payout !== undefined) updateData.notifications_payout = body.notificationSettings.payout;
      if (body.notificationSettings.support !== undefined) updateData.notifications_support = body.notificationSettings.support;
      if (body.notificationSettings.marketing !== undefined) updateData.notifications_marketing = body.notificationSettings.marketing;
      if (body.notificationSettings.updates !== undefined) updateData.notifications_updates = body.notificationSettings.updates;
    }
    // Security Settings
    if (body.twoFactorEnabled !== undefined) updateData.twoFactorEnabled = body.twoFactorEnabled;
    if (body.loginNotifications !== undefined) updateData.loginNotifications = body.loginNotifications;
    if (body.sessionTimeout !== undefined) updateData.sessionTimeout = body.sessionTimeout;
    if (body.passwordExpiry !== undefined) updateData.passwordExpiry = body.passwordExpiry ?? null;
    if (body.failedLoginLockout !== undefined) updateData.failedLoginLockout = body.failedLoginLockout ?? null;

    // Update vendor in Prisma
    const updatedVendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: updateData,
      select: VENDOR_PROFILE_SELECT,
    });

    // Map back to VendorProfile format
    const totalEmployees = Number((updatedVendor as any)?._count?.employees || 0);
    const yearsInBusiness = updatedVendor.foundedYear
      ? new Date().getFullYear() - updatedVendor.foundedYear
      : null;

    const profile = {
      id: updatedVendor.id,
      firstName: updatedVendor.firstName ?? null,
      lastName: updatedVendor.lastName ?? null,
      name: updatedVendor.name,
      businessName: updatedVendor.businessName ?? null,
      businessType: updatedVendor.businessType ?? null,
      category: updatedVendor.category ?? null,
      foundedYear: updatedVendor.foundedYear ?? null,
      email: updatedVendor.email ?? null,
      phone: updatedVendor.phone ?? null,
      city: updatedVendor.city ?? null,
      state: updatedVendor.state ?? null,
      address: updatedVendor.address ?? null,
      zipCode: updatedVendor.zipCode ?? null,
      bio: updatedVendor.bio ?? null,
      website: updatedVendor.website ?? null,
      licenseNumber: updatedVendor.licenseNumber ?? null,
      insuranceStatus: updatedVendor.insuranceStatus ?? false,
      insuranceProvider: updatedVendor.insuranceProvider ?? null,
      insuranceExpiry: updatedVendor.insuranceExpiry?.toISOString() ?? null,
      bondingStatus: updatedVendor.bondingStatus ?? false,
      emergencyContact: updatedVendor.emergencyContact ?? null,
      responseTimeSettings: updatedVendor.responseTimeSettings ?? null,
      profilePhoto: updatedVendor.profilePhoto ?? null,
      serviceTypes: updatedVendor.serviceTypes ? updatedVendor.serviceTypes.split(',').map(s => s.trim()).filter(Boolean) : [],
      specializations: updatedVendor.specializations ? updatedVendor.specializations.split(',').map(s => s.trim()).filter(Boolean) : [],
      serviceAreas: updatedVendor.serviceAreas ? updatedVendor.serviceAreas.split(',').map(s => s.trim()).filter(Boolean) : [],
      totalEmployees,
      yearsInBusiness,
      // Payments (use optional chaining in case Prisma client hasn't been regenerated)
      paymentsEnabled: (updatedVendor as any).paymentsEnabled ?? false,
      // Reminders
      reminders: {
        review: (updatedVendor as any).reminders_review ?? true,
        invoice: (updatedVendor as any).reminders_invoice ?? false,
        maintenance: (updatedVendor as any).reminders_maintenance ?? true,
        followUp: (updatedVendor as any).reminders_followUp ?? true,
      },
      // Notifications
      notificationSettings: {
        job: (updatedVendor as any).notifications_job ?? true,
        review: (updatedVendor as any).notifications_review ?? true,
        payout: (updatedVendor as any).notifications_payout ?? false,
        support: (updatedVendor as any).notifications_support ?? true,
        marketing: (updatedVendor as any).notifications_marketing ?? false,
        updates: (updatedVendor as any).notifications_updates ?? true,
      },
      // Security Settings
      twoFactorEnabled: (updatedVendor as any).twoFactorEnabled ?? false,
      loginNotifications: (updatedVendor as any).loginNotifications ?? true,
      sessionTimeout: (updatedVendor as any).sessionTimeout ?? 30,
      passwordExpiry: (updatedVendor as any).passwordExpiry ?? null,
      failedLoginLockout: (updatedVendor as any).failedLoginLockout ?? null,
    };

    const response: VendorProfileResponse = {
      success: true,
      profile,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Vendor profile PUT error:", err);
    const dbFailure = isVendorContextDbTimeoutError(err);
    return NextResponse.json(
      {
        code: dbFailure ? "DB_CONNECTION_TIMEOUT" : "VENDOR_CONTEXT_ERROR",
        error: dbFailure
          ? "Vendor context is temporarily unavailable because the database connection failed. Please retry."
          : "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: dbFailure ? 503 : 500 }
    );
  }
}
