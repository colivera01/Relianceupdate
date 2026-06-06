import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "Not available in production" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error:
        "This legacy mock seeding route has been retired. Use /api/admin/seed for real demo-data seeding.",
    },
    { status: 410 }
  );
}
