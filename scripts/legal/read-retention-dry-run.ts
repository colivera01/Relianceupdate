import { PrismaClient } from "@prisma/client";

import { loadRetentionWorkerDryRun } from "../../src/lib/legal/retention-dry-run";

async function main() {
  const db = new PrismaClient();
  try {
    const report = await loadRetentionWorkerDryRun({ db, limit: Number(process.argv[2] || 25) });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Retention dry-run failed");
  process.exitCode = 1;
});
