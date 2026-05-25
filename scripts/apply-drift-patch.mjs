// Splits a SQL Server migration file on GO separators and applies each
// batch via `prisma db execute --stdin`. Read-only diagnostic-friendly:
// idempotency comes from the SQL file itself, not from this runner.

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const filePath = process.argv[2];
if (!filePath) {
  console.error("usage: node scripts/apply-drift-patch.mjs <path-to-sql>");
  process.exit(2);
}

const raw = readFileSync(filePath, "utf8");

// Split on lines containing only GO (case-insensitive, optional whitespace).
const batches = raw
  .split(/^\s*GO\s*$/im)
  .map((b) => b.trim())
  .filter((b) => b.length > 0);

console.log(`[apply] file=${path.resolve(filePath)} batches=${batches.length}`);

function runOne(sql, idx) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["prisma", "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"],
      { stdio: ["pipe", "inherit", "inherit"], shell: process.platform === "win32" }
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`batch #${idx} exited with code ${code}`));
    });
    child.stdin.write(sql);
    child.stdin.end();
  });
}

let i = 0;
for (const batch of batches) {
  i += 1;
  const preview = batch.replace(/\s+/g, " ").slice(0, 100);
  console.log(`[apply] batch ${i}/${batches.length}: ${preview}${batch.length > 100 ? "..." : ""}`);
  try {
    await runOne(batch, i);
  } catch (err) {
    console.error(`[apply] FAILED on batch ${i}:`, err?.message || err);
    console.error("[apply] batch SQL:\n" + batch);
    process.exit(1);
  }
}
console.log(`[apply] done, ${i} batch(es) executed`);
