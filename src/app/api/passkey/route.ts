import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { listPasskeysForUser, revokePasskeyForUser, shapePasskeySummary } from "@/lib/auth-passkeys";

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      {
        error: "You must be signed in to manage passkeys.",
        code: "AUTH_REQUIRED",
      },
      { status: 401 }
    );
  }

  const passkeys = await listPasskeysForUser(userId);
  return NextResponse.json({
    passkeys: passkeys.map(shapePasskeySummary),
    count: passkeys.length,
  });
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      {
        error: "You must be signed in to manage passkeys.",
        code: "AUTH_REQUIRED",
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const passkeyId = searchParams.get("passkeyId") || "";
  if (!passkeyId.trim()) {
    return NextResponse.json(
      {
        error: "Passkey id is required.",
        code: "PASSKEY_ID_REQUIRED",
      },
      { status: 400 }
    );
  }

  const result = await revokePasskeyForUser({
    userId,
    passkeyId,
  });

  if (!result.revoked) {
    return NextResponse.json(
      {
        error: result.reason === "PASSKEY_NOT_FOUND" ? "Passkey not found." : "Failed to revoke passkey.",
        code: result.reason,
      },
      { status: result.reason === "PASSKEY_NOT_FOUND" ? 404 : 400 }
    );
  }

  return NextResponse.json({
    success: true,
    revokedPasskeyId: result.passkeyId,
  });
}
