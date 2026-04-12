import { NextRequest, NextResponse } from "next/server";
import { registeredUsers } from "@/lib/dev-registered-users";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    console.log("Login attempt for email:", email);

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = registeredUsers.find((u) => u.email === email);

    if (!user) {
      console.log("User not found:", email);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (user.password !== password) {
      console.log("Invalid password for user:", email);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    console.log("Login successful for user:", email);

    let availableProfiles: string[] = [];

    if (
      user.userType === "vendor" ||
      user.businessName ||
      user.category ||
      user.serviceTypes
    ) {
      availableProfiles.push("vendor");
    }

    if (user.userType === "customer" || !user.businessName) {
      availableProfiles.push("customer");
    }

    if (availableProfiles.length > 1) {
      user.userType = "both";
    } else if (availableProfiles.length === 1) {
      user.userType = availableProfiles[0];
    }

    const userResponse = {
      id: user.id || "temp-id",
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      userType: user.userType || "customer",
      availableProfiles,
      avatar:
        user.avatar ||
        `https://randomuser.me/api/portraits/${user.userType === "vendor" ? "men" : "women"}/44.jpg`,
    };

    return NextResponse.json({
      success: true,
      message: "Login successful",
      user: userResponse,
      token: "temp-jwt-token",
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
