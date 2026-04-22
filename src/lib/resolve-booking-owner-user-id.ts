import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

/**
 * Resolve a registered customer `User.id` from the email entered on a booking/job form.
 * Used when vendor staff creates a booking so `Booking.userId` matches the customer's account
 * (required for My Services and GET /api/bookings/[id]/media).
 */
export async function findUserIdByEmailCaseInsensitive(
  prisma: PrismaClient,
  clientEmail: string
): Promise<string | null> {
  const trimmed = clientEmail.trim();
  if (!trimmed) return null;

  const byExact = await prisma.user.findFirst({
    where: { email: trimmed },
    select: { id: true },
  });
  if (byExact?.id) return byExact.id;

  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT TOP (1) [id] FROM [users] WHERE LOWER(LTRIM(RTRIM([email]))) = LOWER(LTRIM(RTRIM(${trimmed})))`
  );
  return rows[0]?.id ?? null;
}
