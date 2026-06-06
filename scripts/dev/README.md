# Dev-only scripts

One-off checks and local debugging helpers. They are **not** part of production builds.

| Script | Purpose |
|--------|---------|
| `ai-admin-smoke.cjs` | Quick AI route smoke for admin assist surfaces. Useful for verifying truthful success and failure-state responses, especially `503 DB_UNAVAILABLE` behavior during transient Azure issues. |
| `ai-admin-evals.ts` | Saved live AI eval baseline for moderation, dispute summary, and vendor coaching. Creates and auto-cleans the temporary dispute case used in the eval run. |
| `vendor-job-dashboard-persist-check.cjs` | Manual HTTP check: create a booking against a running dev server and verify it appears on the vendor dashboard response. Edit `vendorId`, port, and headers before running. |

Run with Node from the repo root, for example:

`node scripts/dev/vendor-job-dashboard-persist-check.cjs`

For the full AI validation path, use the package scripts from the repo root instead:

- `npm run test:ai:smoke`
- `npm run test:ai:focused`
- `npm run test:ai:gate`
