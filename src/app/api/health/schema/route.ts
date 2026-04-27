import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

type SchemaCheck = {
  key: string;
  ok: boolean;
  details?: string;
};

const REQUIRED_REVIEW_COLUMNS = [
  "assignedMembershipId",
  "assignedEmployeeName",
  "assignedUserId",
  "attributionVersion",
];

const FILTERED_BOOKING_UNIQUE_INDEX_NAME = "reviews_bookingId_unique_not_null";

export async function GET() {
  try {
    const columnRows = (await (prisma as any).$queryRawUnsafe(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'reviews'
      `
    )) as Array<{ COLUMN_NAME?: string }>;

    const existingColumns = new Set(
      columnRows.map((row) => String(row?.COLUMN_NAME || "").trim()).filter(Boolean)
    );

    const indexRows = (await (prisma as any).$queryRawUnsafe(
      `
      SELECT name
      FROM sys.indexes
      WHERE object_id = OBJECT_ID('dbo.reviews')
        AND name = '${FILTERED_BOOKING_UNIQUE_INDEX_NAME}'
      `
    )) as Array<{ name?: string }>;

    const hasFilteredUniqueIndex = indexRows.some(
      (row) => String(row?.name || "").trim() === FILTERED_BOOKING_UNIQUE_INDEX_NAME
    );

    const checks: SchemaCheck[] = [
      ...REQUIRED_REVIEW_COLUMNS.map((column) => ({
        key: `reviews.column.${column}`,
        ok: existingColumns.has(column),
        details: existingColumns.has(column)
          ? "Present"
          : `Missing column ${column} on dbo.reviews`,
      })),
      {
        key: "reviews.index.bookingId_unique_not_null",
        ok: hasFilteredUniqueIndex,
        details: hasFilteredUniqueIndex
          ? "Present"
          : `Missing filtered unique index ${FILTERED_BOOKING_UNIQUE_INDEX_NAME} on dbo.reviews`,
      },
    ];

    const allOk = checks.every((check) => check.ok);
    return NextResponse.json({
      success: allOk,
      checks,
      ...(allOk
        ? {}
        : {
            message: "Run review-attribution hotfix or migration",
          }),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        checks: [] as SchemaCheck[],
        message: "Run review-attribution hotfix or migration",
        error: "Schema health check failed",
        details: error?.message || "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

