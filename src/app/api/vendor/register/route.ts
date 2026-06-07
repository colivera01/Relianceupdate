import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { addressChanged, geocodeAddress } from "@/lib/geocoding";
import { trySetVendorApprovalStatus } from "@/lib/vendor-status";
import { getServiceTemplatesForCategory, type ServiceTemplate } from "@/config/service-templates";
import { requireVerifiedEmailForAction } from "@/lib/email-verification-enforcement";
import { addRegisteredUser, findRegisteredUserByEmail } from "@/lib/dev-registered-users";
import { hashPassword } from "@/lib/auth-password";
import { findDbCredentialByEmail, upsertDbCredential } from "@/lib/auth-credentials";
import { sendOrPreviewEmailVerification } from "@/lib/auth-email-verification";

type SelectedServiceInput = {
  name: string;
  defaultDuration?: number;
  price?: number;
  description?: string;
  source?: string;
};

function parseOptionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function parseOptionalInteger(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBooleanFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseCommaSeparatedText(value: unknown) {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
    return normalized.length > 0 ? normalized.join(", ") : null;
  }

  const normalized = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized.join(", ") : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = await getUserIdFromRequest(request);
    const businessName = String(body?.businessName || "").trim();
    const rawBusinessType = String(body?.businessType || "").trim();
    const customBusinessType = String(body?.customBusinessType || "").trim();
    const primaryCategory = String(body?.category || "").trim();
    const address = String(body?.address || "").trim();
    const city = String(body?.city || "").trim();
    const state = String(body?.state || "").trim();
    const zipCode = String(body?.zipCode || "").trim();
    const businessType =
      rawBusinessType.toLowerCase() === "other" ? customBusinessType : rawBusinessType;
    const vendorProfileData = {
      foundedYear: parseOptionalInteger(body?.foundedYear),
      bio: parseOptionalString(body?.businessBio),
      website: parseOptionalString(body?.website),
      licenseNumber: parseOptionalString(body?.licenseNumber),
      insuranceStatus: parseBooleanFlag(body?.insuranceStatus),
      bondingStatus: parseBooleanFlag(body?.bondingStatus),
      emergencyContact: parseOptionalString(body?.emergencyContact),
      responseTimeSettings: parseOptionalString(body?.responseTime),
      serviceTypes: parseCommaSeparatedText(body?.serviceTypes),
      specializations: parseCommaSeparatedText(body?.specializations),
      serviceAreas: parseCommaSeparatedText(body?.serviceAreas),
    };

    if (!businessName || !businessType) {
      return NextResponse.json(
        { error: "Business name and business type are required." },
        { status: 400 }
      );
    }

    if (!address || !city || !state || !zipCode) {
      return NextResponse.json(
        { error: "Vendor street address, city, state, and ZIP code are required." },
        { status: 400 }
      );
    }

    let verification:
      | Awaited<ReturnType<typeof sendOrPreviewEmailVerification>>
      | null = null;
    let persistedCredentialId: string | null = null;
    let resolvedUserId = userId ? String(userId) : "";

    if (!resolvedUserId) {
      const firstName = String(body?.firstName || "").trim();
      const lastName = String(body?.lastName || "").trim();
      const email = String(body?.email || "").trim().toLowerCase();
      const phone = String(body?.phone || "").trim();
      const password = String(body?.password || "");

      if (!firstName || !lastName || !email || !phone || !password) {
        return NextResponse.json(
          {
            error:
              "First name, last name, email, phone number, and password are required to create a vendor account.",
          },
          { status: 400 }
        );
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }

      if (password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters long" },
          { status: 400 }
        );
      }

      const [existingCredential, existingUser, existingVendor, existingRegistryUser] = await Promise.all([
        findDbCredentialByEmail(email).catch(() => null),
        prisma.user.findUnique({
          where: { email },
          select: { id: true },
        }),
        (prisma as any).vendor.findUnique({
          where: { email },
          select: { id: true },
        }),
        Promise.resolve(findRegisteredUserByEmail(email)),
      ]);
      if (existingCredential || existingUser || existingVendor || existingRegistryUser) {
        return NextResponse.json(
          {
            error:
              "An account with this email already exists. Sign in first to continue vendor setup.",
            code: "ACCOUNT_ALREADY_EXISTS",
          },
          { status: 409 }
        );
      }

      const passwordHash = hashPassword(password);
      const createdUser = await prisma.user.create({
        data: {
          name: `${firstName} ${lastName}`.trim(),
          email,
          phone,
          address: address || null,
          city: city || null,
          state: state || null,
          zipCode: zipCode || null,
          locationPreferenceEnabled: false,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      });
      resolvedUserId = String(createdUser.id);

      const credential = await upsertDbCredential({
        userId: resolvedUserId,
        email,
        passwordHash,
      });
      persistedCredentialId = String(credential.id);
      addRegisteredUser({
        id: resolvedUserId,
        firstName,
        lastName,
        email,
        phone,
        passwordHash,
        userType: "vendor",
        businessName,
        businessType,
        category: primaryCategory || businessType,
        address,
        city,
        state,
        zipCode,
        createdAt: new Date().toISOString(),
        isActive: true,
      });
      verification = await sendOrPreviewEmailVerification({
        email,
        credentialId: persistedCredentialId,
        recipientName: `${firstName} ${lastName}`.trim() || null,
        baseUrl: request.nextUrl.origin,
      }).catch((sendError) => {
        console.error("Vendor verification email send error:", sendError);
        return null;
      });
    } else {
      const verificationGate = await requireVerifiedEmailForAction({
        userId: resolvedUserId,
        action: "register_vendor_account",
      });
      if (verificationGate) {
        return verificationGate;
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: resolvedUserId },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existingManagerMembership = await (prisma as any).vendorMembership.findFirst({
      where: {
        userId: resolvedUserId,
        role: "MANAGER",
      },
      include: {
        vendor: true,
      },
      orderBy: [{ requestedAt: "desc" }],
    });

    if (existingManagerMembership?.status === "ACTIVE") {
      return NextResponse.json({
        success: true,
        message: "Vendor registration already approved.",
        vendorId: String(existingManagerMembership.vendorId),
        membershipId: String(existingManagerMembership.id),
      requiresApproval: false,
      approved: true,
      });
    }

    if (!existingManagerMembership && user.email) {
      const existingVendor = await (prisma as any).vendor.findUnique({
        where: { email: user.email },
        select: { id: true },
      });

      if (existingVendor) {
        return NextResponse.json(
          {
            error:
              "A vendor profile with this email already exists. Sign in first or contact Reliance support to recover access.",
            code: "VENDOR_EMAIL_ALREADY_EXISTS",
          },
          { status: 409 }
        );
      }
    }

    let vendorId: string;
    let membershipId: string;
    const nextAddress = { address, city, state, zipCode };
    const geocodeResult = await geocodeAddress(nextAddress);
    const coordinateData =
      geocodeResult.status === "success"
        ? {
            latitude: geocodeResult.latitude,
            longitude: geocodeResult.longitude,
            geocodedAt: geocodeResult.geocodedAt,
          }
        : { latitude: null, longitude: null, geocodedAt: null };

    if (existingManagerMembership) {
      const shouldRefreshCoordinates = addressChanged(existingManagerMembership.vendor, nextAddress);
      const updated = await (prisma as any).$transaction(async (tx: any) => {
        await tx.vendor.update({
          where: { id: existingManagerMembership.vendorId },
          data: {
            name: businessName,
            businessName,
            businessType,
            category: primaryCategory || businessType,
            address,
            city,
            state,
            zipCode,
            ...vendorProfileData,
            ...(shouldRefreshCoordinates ? coordinateData : {}),
          },
        });

        const membership = await tx.vendorMembership.update({
          where: { id: existingManagerMembership.id },
          data: {
            status: "PENDING",
            deniedAt: null,
            deniedByUserId: null,
            revokedAt: null,
            revokedByUserId: null,
            approvedAt: null,
            approvedByUserId: null,
          },
        });

        return {
          vendorId: String(existingManagerMembership.vendorId),
          membershipId: String(membership.id),
        };
      });

      vendorId = updated.vendorId;
      membershipId = updated.membershipId;
    } else {
      const created = await (prisma as any).$transaction(async (tx: any) => {
        const vendor = await tx.vendor.create({
          data: {
            name: businessName,
            businessName,
            businessType,
            category: primaryCategory || businessType,
            firstName: String(body?.firstName || "").trim() || user.name || null,
            lastName: String(body?.lastName || "").trim() || null,
            email: user.email || null,
            phone: user.phone || null,
            address,
            city,
            state,
            zipCode,
            ...vendorProfileData,
            ...coordinateData,
          },
        });

        const membership = await tx.vendorMembership.create({
          data: {
            vendorId: vendor.id,
            userId: resolvedUserId,
            role: "MANAGER",
            status: "PENDING",
          },
        });

        return { vendorId: String(vendor.id), membershipId: String(membership.id) };
      });

      vendorId = created.vendorId;
      membershipId = created.membershipId;
    }

    await trySetVendorApprovalStatus(vendorId, "PENDING");
    await upsertVendorServicesFromRegistration(vendorId, body, primaryCategory);

    return NextResponse.json({
      success: true,
      message: userId
        ? "Vendor registered successfully. Vendor account pending approval."
        : "Vendor account created. Verify your email, then sign in to continue vendor setup.",
      vendorId,
      membershipId,
      requiresApproval: true,
      approved: false,
      emailVerificationRequired: !userId,
      emailDeliveryQueued: Boolean(verification?.sendResult.ok),
      ...(process.env.NODE_ENV !== "production" && verification
        ? {
            verificationLinkPreview: verification.verificationLink,
            verificationTokenPreview: verification.verificationTokenPreview,
          }
        : {}),
    });
  } catch (error) {
    console.error("Vendor registration error:", error);
    const prismaCode = typeof error === "object" && error && "code" in error ? String((error as any).code) : "";
    const prismaTarget =
      typeof error === "object" && error && "meta" in error
        ? String((error as any).meta?.target || "")
        : "";

    if (prismaCode === "P2002" && prismaTarget.toLowerCase().includes("email")) {
      return NextResponse.json(
        {
          error:
            "A vendor profile with this email already exists. Sign in first or contact Reliance support to recover access.",
          code: "VENDOR_EMAIL_ALREADY_EXISTS",
        },
        { status: 409 }
      );
    }

    if (prismaCode === "P1001") {
      return NextResponse.json(
        {
          error:
            "Reliance could not reach the vendor registration service right now. Please try again in a moment.",
          code: "REGISTRATION_SERVICE_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}

function parseSelectedServices(raw: unknown): SelectedServiceInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const name = String((item as any)?.name || "").trim();
      const defaultDurationRaw = (item as any)?.defaultDuration;
      const defaultDuration =
        defaultDurationRaw === undefined || defaultDurationRaw === null || String(defaultDurationRaw).trim() === ""
          ? undefined
          : Number(defaultDurationRaw);
      const priceRaw = (item as any)?.price;
      const price =
        priceRaw === undefined || priceRaw === null || String(priceRaw).trim() === ""
          ? undefined
          : Number(priceRaw);
      const description = String((item as any)?.description || "").trim() || undefined;
      const source = String((item as any)?.source || "").trim() || undefined;
      if (!name) return null;
      if (defaultDuration !== undefined && (!Number.isFinite(defaultDuration) || defaultDuration <= 0)) return null;
      if (price !== undefined && (!Number.isFinite(price) || price < 0)) return null;
      return { name, defaultDuration, price, description, source };
    })
    .filter(Boolean) as SelectedServiceInput[];
}

function parseServiceTypes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v || "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

async function upsertVendorServicesFromRegistration(
  vendorId: string,
  body: Record<string, unknown>,
  primaryCategory: string
) {
  const selectedServices = parseSelectedServices(body?.selectedServices);
  const categoryTemplates = getServiceTemplatesForCategory(primaryCategory);
  const serviceTypes = parseServiceTypes(body?.serviceTypes);

  const normalized = new Map<string, SelectedServiceInput>();
  // If selectedServices is provided, treat it as the authoritative renamed/selected list.
  // Only fall back to serviceTypes or category templates when selectedServices is missing.
  if (selectedServices.length > 0) {
    for (const item of selectedServices) {
      const key = item.name.toLowerCase();
      if (!normalized.has(key)) normalized.set(key, item);
    }
  } else if (serviceTypes.length > 0) {
    for (const serviceType of serviceTypes) {
      const key = serviceType.toLowerCase();
      if (!normalized.has(key)) {
        normalized.set(key, { name: serviceType, defaultDuration: 60 });
      }
    }
  } else {
    for (const item of categoryTemplates) {
      const key = item.name.toLowerCase();
      if (!normalized.has(key)) normalized.set(key, item);
    }
  }

  const servicesToEnsure = Array.from(normalized.values());
  if (servicesToEnsure.length === 0) return;

  const existing = await prisma.service.findMany({
    where: { vendorId },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((row) => String(row.name || "").trim().toLowerCase()).filter(Boolean));
  const pendingCreates = servicesToEnsure.filter((item) => !existingNames.has(item.name.toLowerCase()));
  if (pendingCreates.length === 0) return;

  await (prisma as any).service.createMany({
    data: pendingCreates.map((item) => ({
      vendorId,
      name: item.name,
      description:
        item.description ||
        `Prebuilt ${primaryCategory || "General"} service template${
          item.defaultDuration ? ` (estimated ${item.defaultDuration} min)` : ""
        }`,
      price: item.price ?? 0,
      isPublished: false,
    })),
  });
}
