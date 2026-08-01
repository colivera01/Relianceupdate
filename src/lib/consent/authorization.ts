import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";

export async function requirePermissionManagerForBooking(
  request: Request,
  bookingId: string,
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, vendorId: true },
  });
  if (!booking) throw new Error("Permission work record not found");
  const manager = await requireVendorManager(request, booking.vendorId);
  return { booking, manager };
}

export function permissionAuthorizationStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("Unauthorized")) return 401;
  if (message.includes("Forbidden")) return 403;
  if (message.includes("not found")) return 404;
  return 500;
}
