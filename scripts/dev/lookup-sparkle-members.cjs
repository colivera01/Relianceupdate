const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const m = await p.vendorMembership.findMany({
    where: { vendorId: "cmipm4d6v0000sosgqvb8tp63" },
    select: {
      id: true,
      userId: true,
      role: true,
      status: true,
      user: { select: { email: true, name: true } },
    },
  });
  console.log(JSON.stringify(m, null, 2));
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
