const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const v = await p.vendor.findMany({
    select: { id: true, businessName: true, demo: true, isPubliclyListed: true },
    orderBy: { businessName: "asc" },
  });
  console.log(JSON.stringify(v, null, 2));
  await p.$disconnect();
})();
