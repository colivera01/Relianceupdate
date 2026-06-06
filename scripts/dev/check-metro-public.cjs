const { PrismaClient } = require("@prisma/client");
const METRO = "cmnvdegk60000sop8sj18nud2";
const p = new PrismaClient();
(async () => {
  const v = await p.vendor.findUnique({
    where: { id: METRO },
    select: { demo: true, isPubliclyListed: true, accountStatus: true },
  });
  const services = await p.service.findMany({
    where: { vendorId: METRO },
    select: { id: true, name: true, demo: true, isPublished: true },
  });
  console.log(JSON.stringify({ v, services }, null, 2));
  await p.$disconnect();
})();
