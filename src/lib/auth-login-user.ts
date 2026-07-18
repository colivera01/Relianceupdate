import { isOwnerAdminUserId } from "@/lib/internal-identities";
import { sanitizeCustomerFacingAvatar } from "@/lib/avatar-display";
import { resolveVendorAccessForUser } from "@/lib/vendor-context";
import { prisma } from "@/server/db";

function toSessionUserType(profiles: Set<string>): "customer" | "vendor" | "admin" | "both" {
  if (profiles.has("admin")) return "admin";
  if (profiles.has("customer") && profiles.has("vendor")) return "both";
  if (profiles.has("vendor")) return "vendor";
  return "customer";
}

export async function buildAuthLoginUserPayload(params: {
  userId: string;
  email: string;
  fallbackName?: string | null;
  avatar?: string | null;
  emailVerifiedAt?: Date | null;
}) {
  const userId = String(params.userId || "").trim();
  const email = String(params.email || "").trim().toLowerCase();

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      profilePhoto: true,
    },
  });

  const profileSet = new Set<string>();
  if (isOwnerAdminUserId(userId)) {
    profileSet.add("admin");
  }

  try {
    const vendorAccess = await resolveVendorAccessForUser(userId);
    if ((vendorAccess.state === "ACTIVE" || vendorAccess.state === "PENDING") && vendorAccess.vendorId) {
      profileSet.add("vendor");
    }
  } catch {
    // Fall through; the caller can still sign in with the non-vendor profile set.
  }

  if (!profileSet.size) {
    profileSet.add("customer");
  } else if (!profileSet.has("admin") && !profileSet.has("vendor")) {
    profileSet.add("customer");
  }

  const availableProfiles = (["customer", "vendor", "admin"] as const).filter((profile) =>
    profileSet.has(profile)
  );
  const userType = toSessionUserType(profileSet);
  const resolvedEmail = dbUser?.email || email;
  const name =
    String(params.fallbackName || "").trim() ||
    String(dbUser?.name || "").trim() ||
    resolvedEmail ||
    "User";

  return {
    id: userId,
    name,
    email: resolvedEmail,
    userType,
    availableProfiles,
    emailVerified: Boolean(params.emailVerifiedAt),
    emailVerifiedAt: params.emailVerifiedAt?.toISOString?.() ?? null,
    avatar:
      sanitizeCustomerFacingAvatar(params.avatar || dbUser?.profilePhoto) || undefined,
  };
}
