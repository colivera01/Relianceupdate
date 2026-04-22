import { NextRequest, NextResponse } from "next/server";
import { registeredUsers } from "@/lib/dev-registered-users";
import { prisma } from "@/server/db";

const IS_DEV = process.env.NODE_ENV !== "production";

function normalizeEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emailNorm = normalizeEmail(body?.email);
    const passwordRaw = body?.password != null ? String(body.password) : "";

    console.log("[auth/login] attempt", { email: emailNorm, passwordLen: passwordRaw.length });

    if (!emailNorm || !passwordRaw) {
      return NextResponse.json(
        {
          error: "Email and password are required",
          code: "MISSING_CREDENTIALS",
        },
        { status: 400 }
      );
    }

    const user = registeredUsers.find(
      (u) => u?.email && String(u.email).trim().toLowerCase() === emailNorm
    );

    if (!user) {
      console.warn("[auth/login] USER_NOT_FOUND in dev registry", {
        email: emailNorm,
        knownEmails: registeredUsers.map((u) => u?.email).filter(Boolean),
      });
      return NextResponse.json(
        {
          error: IS_DEV
            ? `No dev user registered for "${emailNorm}". Check src/lib/dev-registered-users.ts.`
            : "Invalid email or password",
          code: "USER_NOT_FOUND",
        },
        { status: 401 }
      );
    }

    if (user.password !== passwordRaw) {
      console.warn("[auth/login] INVALID_PASSWORD", { email: emailNorm });
      return NextResponse.json(
        {
          error: IS_DEV
            ? "Password does not match the dev registry for this email. Use the exact password from dev-registered-users (or reset dev user)."
            : "Invalid email or password",
          code: "INVALID_PASSWORD",
        },
        { status: 401 }
      );
    }

    console.log("[auth/login] credentials OK, resolving DB user for:", emailNorm);

    let usedDevRegistryIdBecauseDbUnreachable = false;

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

    let resolvedUserId = user.id || "temp-id";
    try {
      const dbUser = await prisma.user.findFirst({
        where: { email: user.email },
        select: { id: true },
      });
      if (dbUser?.id) {
        resolvedUserId = dbUser.id;
      } else if (IS_DEV) {
        console.warn("[auth/login] no Prisma user row for email; using dev registry id", {
          email: user.email,
          fallbackId: resolvedUserId,
        });
      }
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      console.error("[auth/login] Prisma error while resolving user id:", msg);
      if (IS_DEV) {
        usedDevRegistryIdBecauseDbUnreachable = true;
        console.warn("[auth/login] DEV: using dev registry user id (DB unreachable). Add client IP to Azure SQL firewall for Prisma-backed ids.", {
          fallbackId: resolvedUserId,
        });
      } else {
        return NextResponse.json(
          {
            error: "Login failed. Please try again.",
            code: "USER_ID_RESOLUTION_DB_ERROR",
          },
          { status: 503 }
        );
      }
    }

    const userResponse = {
      id: resolvedUserId,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      userType: user.userType || "customer",
      availableProfiles,
      avatar:
        user.avatar ||
        `https://randomuser.me/api/portraits/${user.userType === "vendor" ? "men" : "women"}/44.jpg`,
    };

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      user: userResponse,
      token: "temp-jwt-token",
      ...(IS_DEV && usedDevRegistryIdBecauseDbUnreachable
        ? {
            devWarning:
              "Database unreachable; logged in with dev-registry user id. Add your public IP to the Azure SQL server firewall (error 40615) so ids match Prisma and My Services/bookings stay consistent.",
          }
        : {}),
    });

    // Persist server-readable user session context for API routes.
    response.cookies.set("userId", resolvedUserId, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
    response.cookies.set("session_user_id", resolvedUserId, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });

    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[auth/login] unhandled error:", error);
    return NextResponse.json(
      {
        error: IS_DEV ? `Login route exception: ${msg}` : "Login failed. Please try again.",
        code: "LOGIN_ROUTE_EXCEPTION",
        details: IS_DEV ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
