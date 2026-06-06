import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { internalUserNotClauses, launchExcludedUserIds } from "@/lib/internal-identities";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const users = await prisma.user.findMany({
      where: {
        demo: false,
        id: { notIn: launchExcludedUserIds() },
        NOT: internalUserNotClauses(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        state: true,
        zipCode: true,
        accountStatus: true,
        createdAt: true,
        authCredential: {
          select: {
            emailVerifiedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      users: users.map((user) => ({
        id: user.id,
        name: user.name || "Unnamed customer",
        email: user.email || null,
        phone: user.phone || null,
        city: user.city || null,
        state: user.state || null,
        zipCode: user.zipCode || null,
        status: user.accountStatus || "active",
        role: "customer",
        emailVerified: Boolean(user.authCredential?.emailVerifiedAt),
        createdAt: user.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    const message = String(error?.message || "");
    const status = message === "Unauthorized" ? 401 : message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json(
      {
        success: false,
        error:
          status === 401
            ? "Unauthorized"
            : status === 403
              ? "Forbidden: Admin access required"
              : "Failed to load users",
      },
      { status }
    );
  }
}
