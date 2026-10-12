import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  loadRoleAssentGapInventory,
  type RoleAssentRequirement,
} from "../../src/lib/legal/assent-gap-report";

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("Usage: read-assent-gap-inventory.ts <requirements.json>");
  const requirements = JSON.parse(
    fs.readFileSync(path.resolve(inputPath), "utf8"),
  ) as RoleAssentRequirement[];
  if (!Array.isArray(requirements)) throw new Error("Requirements JSON must be an array");
  const db = new PrismaClient();
  try {
    const report = await loadRoleAssentGapInventory({ db, requirements });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Assent-gap inventory failed");
  process.exitCode = 1;
});
