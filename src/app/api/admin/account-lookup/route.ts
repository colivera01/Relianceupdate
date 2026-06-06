import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isTransientDbConnectivityError, PUBLIC_DB_UNAVAILABLE_CODE } from "@/lib/transient-db-errors";

const ACCOUNT_TYPES = new Set(["user", "vendor", "all"]);
const LOOKUP_MODES = new Set(["search", "browse"]);
const VENDOR_SORT_OPTIONS = new Set(["alpha_asc", "alpha_desc", "newest", "oldest"]);
const ACCOUNT_LOOKUP_DB_UNAVAILABLE_MESSAGE =
  "Account lookup is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function forbiddenResponse(error: any) {
  const message = error?.message || "Forbidden";
  return NextResponse.json({ success: false, error: message, message }, { status: 403 });
}

function serializeDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const q = normalizeString(searchParams.get("q"));
    const requestedType = normalizeString(searchParams.get("targetType")).toLowerCase() || "all";
    const requestedMode = normalizeString(searchParams.get("mode")).toLowerCase() || "search";
    const targetType = ACCOUNT_TYPES.has(requestedType) ? requestedType : "all";
    const lookupMode = LOOKUP_MODES.has(requestedMode) ? requestedMode : "search";
    const requestedAccountStatus = normalizeString(searchParams.get("accountStatus")).toLowerCase() || "all";
    const requestedSort = normalizeString(searchParams.get("sort")).toLowerCase() || "alpha_asc";
    const vendorSort = VENDOR_SORT_OPTIONS.has(requestedSort) ? requestedSort : "alpha_asc";
    const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") || "10", 10) || 10, 1), 50);

    if (lookupMode !== "browse" && (!q || q.length < 2)) {
      return NextResponse.json(
        { success: false, error: "Search query must be at least 2 characters" },
        { status: 400 }
      );
    }

    const shouldSearchUsers = lookupMode !== "browse" && (targetType === "all" || targetType === "user");
    const shouldSearchVendors = lookupMode === "browse" || targetType === "all" || targetType === "vendor";
    const userDelegate = (prisma as any).user;
    const vendorDelegate = (prisma as any).vendor;
    const vendorWhere: Record<string, any> = {};

    if (q) {
      vendorWhere.OR = [
        { id: { contains: q } },
        { name: { contains: q } },
        { businessName: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { city: { contains: q } },
        { state: { contains: q } },
      ];
    }

    if (requestedAccountStatus === "inactive") {
      vendorWhere.accountStatus = { in: ["deactivated", "archived_inactive"] };
    } else if (requestedAccountStatus !== "all") {
      vendorWhere.accountStatus = requestedAccountStatus;
    }

    const vendorOrderBy =
      vendorSort === "alpha_desc"
        ? [{ businessName: "desc" }, { name: "desc" }]
        : vendorSort === "newest"
          ? [{ createdAt: "desc" }]
          : vendorSort === "oldest"
            ? [{ createdAt: "asc" }]
            : [{ businessName: "asc" }, { name: "asc" }];

    const [users, vendors] = await Promise.all([
      shouldSearchUsers
        ? userDelegate.findMany({
            where: {
              OR: [
                { id: { contains: q } },
                { name: { contains: q } },
                { email: { contains: q } },
                { phone: { contains: q } },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              accountStatus: true,
              accountStatusUpdatedAt: true,
              accountStatusReason: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      shouldSearchVendors
        ? vendorDelegate.findMany({
            where: vendorWhere,
            orderBy: vendorOrderBy,
            take: limit,
            select: {
              id: true,
              name: true,
              businessName: true,
              email: true,
              phone: true,
              city: true,
              state: true,
              zipCode: true,
              serviceAreas: true,
              accountStatus: true,
              accountStatusUpdatedAt: true,
              accountStatusReason: true,
              isPubliclyListed: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      success: true,
      results: [
        ...users.map((user: any) => ({
          targetType: "user",
          id: user.id,
          displayName: user.name || user.email || user.phone || user.id,
          email: user.email,
          phone: user.phone,
          accountStatus: user.accountStatus || "active",
          accountStatusUpdatedAt: serializeDate(user.accountStatusUpdatedAt),
          accountStatusReason: user.accountStatusReason,
          isPubliclyListed: null,
          createdAt: serializeDate(user.createdAt),
        })),
        ...vendors.map((vendor: any) => ({
          targetType: "vendor",
          id: vendor.id,
          displayName: vendor.businessName || vendor.name || vendor.email || vendor.id,
          ownerName: vendor.name || null,
          businessName: vendor.businessName || null,
          email: vendor.email,
          phone: vendor.phone,
          city: vendor.city || null,
          state: vendor.state || null,
          zipCode: vendor.zipCode || null,
          serviceAreas: vendor.serviceAreas || null,
          accountStatus: vendor.accountStatus || "active",
          accountStatusUpdatedAt: serializeDate(vendor.accountStatusUpdatedAt),
          accountStatusReason: vendor.accountStatusReason,
          isPubliclyListed: Boolean(vendor.isPubliclyListed),
          createdAt: serializeDate(vendor.createdAt),
        })),
      ],
    });
  } catch (error: any) {
    console.error("[admin/account-lookup] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return forbiddenResponse(error);
    }
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error: ACCOUNT_LOOKUP_DB_UNAVAILABLE_MESSAGE,
          message: ACCOUNT_LOOKUP_DB_UNAVAILABLE_MESSAGE,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "Failed to search accounts" }, { status: 500 });
  }
}
