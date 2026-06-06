const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const rows = await p.vendorMembership.findMany({
    where: { role: "MANAGER", status: "ACTIVE" },
    select: {
      vendorId: true,
      userId: true,
      user: { select: { email: true, name: true } },
      vendor: { select: { businessName: true, name: true } },
    },
    take: 30,
  });
  for (const r of rows) {
    const bookings = await p.booking.count({
      where: { userId: r.userId },
    });
    console.log(
      JSON.stringify({
        vendor: r.vendor?.businessName || r.vendor?.name,
        vendorId: r.vendorId,
        userId: r.userId,
        email: r.user?.email,
        customerBookings: bookings,
      })
    );
  }
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
