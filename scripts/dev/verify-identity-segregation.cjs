const { PrismaClient } = require("@prisma/client");

const SPARKLE = "cmipm4d6v0000sosgqvb8tp63";
const METRO = "cmnvdegk60000sop8sj18nud2";
const OWNER = "D43B6BB3-1A72-45EC-A362-A6E1E0580EA0";
const BASE = "http://localhost:3000";

const p = new PrismaClient();

async function fetchJson(path) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function main() {
  const sparkleRow = await p.vendor.findUnique({
    where: { id: SPARKLE },
    select: { demo: true, isPubliclyListed: true, businessName: true },
  });
  const ownerRow = await p.user.findUnique({
    where: { id: OWNER },
    select: { demo: true, email: true },
  });

  const publicSparkle = await fetchJson(`/api/vendors/${SPARKLE}/public`);
  const publicMetro = await fetchJson(`/api/vendors/${METRO}/public`);
  const trustSparkle = await fetchJson(`/api/vendors/${SPARKLE}/trust-score`);
  const trustMetro = await fetchJson(`/api/vendors/${METRO}/trust-score`);
  const discover = await fetchJson("/api/services/discover?limit=50");

  const services = discover.json?.services || discover.json?.data?.services || [];
  const vendorNames = services
    .map((s) => s.vendor?.businessName || s.vendorName || s.businessName)
    .filter(Boolean);

  console.log(
    JSON.stringify(
      {
        db: { sparkleRow, ownerRow },
        http: {
          publicSparkle: publicSparkle.status,
          publicMetro: publicMetro.status,
          trustSparkle: trustSparkle.status,
          trustMetro: trustMetro.status,
          discoverStatus: discover.status,
          discoverHasSparkle: vendorNames.some((n) => /sparkle/i.test(String(n))),
          discoverSampleVendors: [...new Set(vendorNames)].slice(0, 8),
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
