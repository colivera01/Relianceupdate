const { PrismaClient } = require("@prisma/client");
const BOOKING_ID = process.argv[2] || "cmpqjtyxx0002so6gxa6z1td4";
const p = new PrismaClient();
(async () => {
  const booking = await p.booking.findUnique({
    where: { id: BOOKING_ID },
    select: {
      id: true,
      title: true,
      status: true,
      clientName: true,
      customerMetadata: true,
      vendorId: true,
      user: { select: { email: true, id: true } },
    },
  });
  const consent = await p.consentRecord.findFirst({
    where: { bookingId: BOOKING_ID },
    orderBy: { requestedAt: "desc" },
    select: {
      id: true,
      token: true,
      status: true,
      acceptedAt: true,
      expiresAt: true,
      requestedAt: true,
      consentType: true,
    },
  });
  const sessions = await p.mediaSession.findMany({
    where: { bookingId: BOOKING_ID },
    select: {
      id: true,
      vendorJobVideoStage: true,
      mediaAssets: { where: { deletedAt: null }, select: { id: true, moderationStatus: true }, take: 3 },
    },
  });
  console.log(JSON.stringify({ booking, consent, sessions }, null, 2));
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
