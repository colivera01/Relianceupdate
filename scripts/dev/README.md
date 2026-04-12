# Dev-only scripts

One-off checks and local debugging helpers. They are **not** part of production builds.

| Script | Purpose |
|--------|---------|
| `vendor-job-dashboard-persist-check.cjs` | Manual HTTP check: create a booking against a running dev server and verify it appears on the vendor dashboard response. Edit `vendorId`, port, and headers before running. |

Run with Node from the repo root, for example:

`node scripts/dev/vendor-job-dashboard-persist-check.cjs`
