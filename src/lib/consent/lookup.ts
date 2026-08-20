import { prisma } from "@/server/db";
import { hashOpaqueSecret } from "./token";

export function verifiedPermissionRequestsEnabled(): boolean {
  const value = String(
    process.env.VERIFIED_PERMISSION_REQUESTS_ENABLED ?? "true",
  )
    .trim()
    .toLowerCase();
  return !["0", "false", "off", "no"].includes(value);
}

export async function findPermissionByActionSecret(secret: string) {
  const secretHash = hashOpaqueSecret(secret);
  return (prisma as any).consentRequestLink.findUnique({
    where: { secretHash },
    include: {
      consentRecord: {
        include: {
          booking: {
            include: {
              service: { select: { id: true, name: true } },
              user: {
                select: { id: true, name: true, email: true, phone: true },
              },
            },
          },
          vendor: { select: { id: true, name: true, businessName: true } },
          contentVersion: true,
          decisionEvidence: true,
        },
      },
    },
  });
}

export function actionLinkAvailability(link: any, now = new Date()) {
  if (!link) return { active: false, reason: "not_found" as const };
  if (
    ["CANCELED", "CANCELLED"].includes(
      String(link.consentRecord?.booking?.status || "").trim().toUpperCase(),
    )
  ) {
    return { active: false, reason: "canceled" as const };
  }
  if (link.revokedAt) return { active: false, reason: "superseded" as const };
  if (new Date(link.expiresAt).getTime() <= now.getTime()) {
    return { active: false, reason: "expired" as const };
  }
  const lifecycle = String(
    link.consentRecord?.lifecycleStatus || "",
  ).toUpperCase();
  if (["SUPERSEDED", "WRONG_RECIPIENT"].includes(lifecycle)) {
    return {
      active: false,
      reason: lifecycle.toLowerCase() as "superseded" | "wrong_recipient",
    };
  }
  if (
    link.consentRecord?.decisionEvidence ||
    ["ACCEPTED", "DECLINED"].includes(
      String(link.consentRecord?.status || "").toUpperCase(),
    )
  ) {
    return { active: false, reason: "decided" as const };
  }
  return { active: true, reason: null };
}
