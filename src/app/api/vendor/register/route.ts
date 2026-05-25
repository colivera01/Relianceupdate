import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { addressChanged, geocodeAddress } from "@/lib/geocoding";
import { trySetVendorApprovalStatus } from "@/lib/vendor-status";
import { getServiceTemplatesForCategory, type ServiceTemplate } from "@/config/service-templates";

type SelectedServiceInput = {
  name: string;
  defaultDuration?: number;
  price?: number;
  description?: string;
  source?: string;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existingManagerMembership = await (prisma as any).vendorMembership.findFirst({
      where: {
        userId,
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
            category: businessType,
            address,
            city,
            state,
            zipCode,
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
            category: businessType,
            firstName: user.name || null,
            email: user.email || null,
            phone: user.phone || null,
            address,
            city,
            state,
            zipCode,
            ...coordinateData,
          },
        });

        const membership = await tx.vendorMembership.create({
          data: {
            vendorId: vendor.id,
            userId,
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
      message: "Vendor registered successfully. Vendor account pending approval.",
      vendorId,
      membershipId,
      requiresApproval: true,
      approved: false,
    });
  } catch (error) {
    console.error("Vendor registration error:", error);
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