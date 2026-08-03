import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = process.env.DATABASE_URL || "";
    const provider =
      url.startsWith("sqlserver://") ? "sqlserver" :
      url.startsWith("file:")        ? "sqlite"    :
      "unknown";

    let dbName: string | null = null;
    if (provider === "sqlserver") {
      const rows = await prisma.$queryRawUnsafe<any[]>("SELECT DB_NAME() AS name");
      dbName = rows?.[0]?.name ?? null;
    } else if (provider === "sqlite") {
      dbName = url.replace(/^file:/, "");
    }

    return NextResponse.json({
      provider,
      dbName,
      envHasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      sampleCounts: {
        vendors: await prisma.vendor.count(),
        employees: await prisma.employee.count(),
        services: await prisma.service.count(),
        users: await prisma.user.count(),
        bookings: await prisma.booking.count(),
        reviews: await prisma.review.count(),
      },
    });
  } catch (e: any) {
    const status = String(e?.message || "").startsWith("Unauthorized")
      ? 401
      : String(e?.message || "").startsWith("Forbidden")
        ? 403
        : 500;
    return NextResponse.json(
      { error: status === 500 ? "Database status check failed" : String(e?.message || "Access denied") },
      { status }
    );
  }
}


