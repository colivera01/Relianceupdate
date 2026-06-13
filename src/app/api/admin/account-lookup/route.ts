import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isTransientDbConnectivityError, PUBLIC_DB_UNAVAILABLE_CODE } from "@/lib/transient-db-errors";
import { countableUserWhere, countableVendorWhere } from "@/lib/metrics-exclusion";

const ACCOUNT_TYPES = new Set(["user", "vendor", "all"]);
const LOOKUP_MODES = new Set(["search", "browse"]);
const VENDOR_SORT_OPTIONS = new Set(["alpha_asc", "alpha_desc", "newest", "oldest"]);
const USER_RESTRICTED_STATUSES = ["suspended", "banned", "deactivated", "archived_inactive"] as const;
const VENDOR_RESTRICTED_STATUSES = [
  "suspended",
  "banned",
  "deactivated",
  "archived_inactive",
  "pending_approval",
] as const;
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

function buildUserSearchClause(query: string) {
  if (!query) return null;
  return {
    OR: [
      { id: { contains: query } },
      { name: { contains: query } },
      { email: { contains: query } },
      { phone: { contains: query } },
      { city: { contains: query } },
      { state: { contains: query } },
      { zipCode: { contains: query } },
    ],
  };
}

function buildVendorSearchClause(query: string) {
  if (!query) return null;
  return {
    OR: [
      { id: { contains: query } },
      { name: { contains: query } },
      { businessName: { contains: query } },
      { email: { contains: query } },
      { phone: { contains: query } },
      { city: { contains: query } },
      { state: { contains: query } },
      { zipCode: { contains: query } },
    ],
  };
}

function buildUserStatusClause(status: string): Record<string, any> | null | false {
  switch (status) {
    case "all":
      return null;
    case "active":
      return { accountStatus: "active" };
    case "pending_verification":
      return {
        OR: [
          { authCredential: { is: null } },
          { authCredential: { is: { emailVerifiedAt: null } } },
        ],
      };
    case "restricted":
      return {
        accountStatus: {
          in: [...USER_RESTRICTED_STATUSES],
        },
      };
    case "inactive":
      return {
        accountStatus: {
          in: ["deactivated", "archived_inactive"],
        },
      };
    case "suspended":
    case "banned":
    case "deactivated":
    case "archived_inactive":
      return { accountStatus: status };
    case "pending_approval":
      return false;
    default:
      return null;
  }
}

function buildVendorStatusClause(status: string): Record<string, any> | null | false {
  switch (status) {
    case "all":
      return null;
    case "active":
      return { accountStatus: "active" };
    case "pending_approval":
      return { accountStatus: "pending_approval" };
    case "restricted":
      return {
        accountStatus: {
          in: [...VENDOR_RESTRICTED_STATUSES],
        },
      };
    case "inactive":
      return {
        accountStatus: {
          in: ["deactivated", "archived_inactive"],
        },
      };
    case "suspended":
    case "banned":
    case "deactivated":
    case "archived_inactive":
      return { accountStatus: status };
    case "pending_verification":
      return false;
    default:
      return null;
  }
}

function buildWhereClause(
  searchClause: Record<string, any> | null,
  statusClause: Record<string, any> | null
) {
  const andClauses = [searchClause, statusClause].filter(Boolean);
  if (andClauses.length === 0) return {};
  if (andClauses.length === 1) return andClauses[0] || {};
  return { AND: andClauses };
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
    const includeInternal = searchParams.get("includeInternal") === "1";
    const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") || "10", 10) || 10, 1), 50);

    if (lookupMode !== "browse" && (!q || q.length < 2)) {
      return NextResponse.json(
        { success: false, error: "Search query must be at least 2 characters" },
        { status: 400 }
      );
    }

    const userStatusClause = buildUserStatusClause(requestedAccountStatus);
    const vendorStatusClause = buildVendorStatusClause(requestedAccountStatus);
    const shouldSearchUsers =
      (targetType === "all" || targetType === "user") && userStatusClause !== false;
    const shouldSearchVendors =
      (targetType === "all" || targetType === "vendor") && vendorStatusClause !== false;
    const userDelegate = (prisma as any).user;
    const vendorDelegate = (prisma as any).vendor;
    const userWhereBase = buildWhereClause(buildUserSearchClause(q), userStatusClause || null);
    const vendorWhereBase = buildWhereClause(buildVendorSearchClause(q), vendorStatusClause || null);
    const userWhere = includeInternal ? userWhereBase : countableUserWhere(userWhereBase);
    const vendorWhere = includeInternal ? vendorWhereBase : countableVendorWhere(vendorWhereBase);

    const vendorOrderBy =
      vendorSort === "alpha_desc"
        ? [{ businessName: "desc" }, { name: "desc" }]
        : vendorSort === "newest"
          ? [{ createdAt: "desc" }]
          : vendorSort === "oldest"
            ? [{ createdAt: "asc" }]
            : [{ businessName: "asc" }, { name: "asc" }];
    const userOrderBy =
      vendorSort === "alpha_desc"
        ? [{ name: "desc" }, { email: "desc" }]
        : vendorSort === "newest"
          ? [{ createdAt: "desc" }]
          : vendorSort === "oldest"
            ? [{ createdAt: "asc" }]
            : [{ name: "asc" }, { email: "asc" }];

    const [users, vendors] = await Promise.all([
      shouldSearchUsers
        ? userDelegate.findMany({
            where: userWhere,
            orderBy: userOrderBy,
            take: limit,
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              city: true,
              state: true,
              zipCode: true,
              demo: true,
              accountStatus: true,
              accountStatusUpdatedAt: true,
              accountStatusReason: true,
              accountStatusAdminNotes: true,
              createdAt: true,
              authCredential: {
                select: {
                  emailVerifiedAt: true,
                },
              },
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
              demo: true,
              accountStatus: true,
              accountStatusUpdatedAt: true,
              accountStatusReason: true,
              accountStatusAdminNotes: true,
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
          city: user.city || null,
          state: user.state || null,
          zipCode: user.zipCode || null,
          accountStatus: user.accountStatus || "active",
          accountStatusUpdatedAt: serializeDate(user.accountStatusUpdatedAt),
          accountStatusReason: user.accountStatusReason,
          accountStatusAdminNotes: user.accountStatusAdminNotes || null,
          isPubliclyListed: null,
          createdAt: serializeDate(user.createdAt),
          emailVerifiedAt: serializeDate(user.authCredential?.emailVerifiedAt),
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
          accountStatusAdminNotes: vendor.accountStatusAdminNotes || null,
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
