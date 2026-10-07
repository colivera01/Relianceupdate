type PlatformRoleIdentityDb = {
  platformRoleGrant: {
    findFirst: (args: Record<string, unknown>) => Promise<{ userId: string } | null>;
  };
};

export async function findActiveAdminIdentityCollision(params: {
  db: PlatformRoleIdentityDb;
  userIds: Array<string | null | undefined>;
}): Promise<string | null> {
  const userIds = Array.from(
    new Set(params.userIds.map((userId) => String(userId || "").trim()).filter(Boolean))
  );
  if (userIds.length === 0) return null;

  const grant = await params.db.platformRoleGrant.findFirst({
    where: {
      userId: { in: userIds },
      role: "ADMIN",
      status: "ACTIVE",
    },
    select: { userId: true },
  });

  return grant?.userId ? String(grant.userId) : null;
}
