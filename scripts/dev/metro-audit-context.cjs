const { PrismaClient } = require("@prisma/client");
const METRO = "cmnvdegk60000sop8sj18nud2";
const p = new PrismaClient();
(async () => {
  const vendor = await p.vendor.findUnique({
    where: { id: METRO },
    select: {
      id: true,
      businessName: true,
      demo: true,
      isPubliclyListed: true,
      email: true,
    },
  });
  const bookings = await p.booking.findMany({
    where: { vendorId: METRO, demo: false },
    select: { id: true, title: true, status: true, clientName: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
  const services = await p.service.findMany({
    where: { vendorId: METRO },
    select: { id: true, name: true, isPublished: true, demo: true },
  });
  const memberships = await p.vendorMembership.findMany({
    where: { vendorId: METRO, status: "ACTIVE" },
    select: { id: true, role: true, user: { select: { email: true, name: true } } },
  });
  const devices = await p.device.findMany({
    where: { vendorId: METRO },
    select: { id: true, deviceType: true, deviceUid: true, model: true },
    take: 5,
  });
  console.log(JSON.stringify({ vendor, services, bookings, memberships, devices }, null, 2));
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
