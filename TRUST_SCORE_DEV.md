# Trust Score — Local Dev Runtime Notes

## Canonical local dev port

**Port 3000 is the canonical Reliance dev port** (`npm run dev` → `http://localhost:3000`). Use **3000 only** for admin, UI, API, and Trust Score verification unless explicitly asked otherwise. Stop stale servers on other ports (e.g. 3001, 3007); after `prisma generate`, restart with `npm run dev` on **3000**.

## After Prisma schema or migration changes

1. Run `npm exec prisma generate` (or `npx prisma generate`).
2. **Restart the Next.js dev server** on port **3000** (`npm run dev`).

Next.js hot reload recompiles application code but **does not** reload the generated `@prisma/client` in an already-running Node process. If you skip the restart, admin Trust Score reads can silently return empty snapshots even when the database has current rows.

## How to tell stale client vs genuinely not scored

- **Genuine "not yet scored":** Admin API returns `snapshotReadCapability: "ok"` and `trustScore.scored: false` (or a snapshot with `totalScorePct: null`).
- **Stale dev server:** Admin API returns `snapshotReadCapability: "delegate_unavailable"`. The admin panel shows a red **"Trust Score read unavailable (stale dev server)"** banner — not the gray "Not yet scored" state.

## Admin verification headers (local)

```
x-admin: true
x-user-role: admin
x-user-id: <any non-empty id>
```

## Canonical reconciliation vendors (live Azure `reliance-db`)

| Vendor | ID |
|--------|-----|
| Sparkle Clean Pro | `cmipm4d6v0000sosgqvb8tp63` |
| Metro Home Care Pros | `cmnvdegk60000sop8sj18nud2` |

Endpoint: `GET http://localhost:3000/api/admin/vendors/{vendorId}/trust-score`

## Dev scripts (`package.json`)

- **`npm run dev`** — `next dev -p 3000` (preferred for Trust Score / admin work).
- **`npm run dev:live`** — `next dev` without `-p 3000`; Next may bind **3001** if 3000 is busy. For verification, use `dev` on 3000 or free port 3000 first.
