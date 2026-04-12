import { NextRequest, NextResponse } from "next/server";
import { registeredUsers } from "@/lib/dev-registered-users";

export async function GET(_request: NextRequest) {
  try {
    return NextResponse.json({
      message: "Debug endpoint - registered users",
      userCount: registeredUsers.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Debug endpoint failed" },
      { status: 500 }
    );
  }
}
