# DB baseline readiness checklist (existing Azure SQL)

**Date:** 2026-04-12  
**Source of truth:** `DB_BASELINE_AND_SCHEMA_DRIFT_NOTES.md`  
**Context:** Non-empty Azure SQL database, possible **`P3005`** on **`migrate deploy`**, E2E smoke **`globalSetup`** blocked on schema drift (e.g. missing **`users.phone`**).

---

## 1. Which path is being prepared for

Check **one** primary path before execution (the team should record the decision in the change ticket or runbook).

| Path | When to choose |
|------|----------------|
| **A — Prisma baseline flow** | Default for Reliance: existing DB must be **baselined** so **`_prisma_migrations`** matches reality, then **`npx prisma migrate deploy`** applies only **new** migrations. See Prisma: [Baseline a production database](https://www.prisma.io/docs/guides/migrate/baseline-database). |
| **B — Manual DDL alignment** | Tactical only: unblock a specific drift (e.g. add **`users.phone`**) when baseline is **not** yet approved or timeboxed; **must** be followed by a migration (or baseline) so Git and DB stay aligned. |

**Fill in for this run:**  
- [ ] Path **A** (Prisma baseline)  
- [ ] Path **B** (manual DDL first, baseline/migrations to follow)

---

## 2. Exact preconditions to verify before touching the DB

- [ ] **Target confirmed:** Server, database name, and **`DATABASE_URL`** point to the **intended** environment (dev / staging / prod)—no accidental cross-env execution.
- [ ] **Backups / restore point:** For shared or production-like DB, a **recent backup** or agreed restore path exists and is documented.
- [ ] **Change window:** Stakeholders notified if app restarts, brief locks, or failed deploys could affect users.
- [ ] **Prisma CLI version** matches what the repo expects (same major as in **`package.json`** / lockfile).
- [ ] **Migration folder state:** Local **`prisma/migrations`** is **clean** (correct branch, no uncommitted migration edits) before baseline or deploy.
- [ ] **Current drift documented:** Known errors (e.g. **`users.phone`** missing, **`P3005`**) copied into the ticket so success criteria are clear.
- [ ] **App processes stopped** on machines that will run **`npx prisma generate`** (avoids Windows **`EPERM`** on `query_engine-windows.dll.node` during rename).

---

## 3. Seed-critical tables / columns to confirm first

Align with **`prisma/schema.prisma`** and with **`e2e/global-setup.ts`** (see **`DB_BASELINE_AND_SCHEMA_DRIFT_NOTES.md` §4**).

**Highest priority (smoke blocker observed):**

- [ ] **`users`**: column **`phone`** exists (and any other **`User`** columns Prisma expects vs live table—compare with schema or **`prisma migrate diff`**).
- [ ] **`users`**: can insert/upsert test row shape used by smoke (`id`, `email`, `name`, `demo`, …).

**Next (globalSetup after User succeeds):**

- [ ] **`vendors`**: **`isPubliclyListed`**, plus columns used in create/update: **`name`**, **`businessName`**, **`email`**, **`phone`**, **`demo`**, etc.
- [ ] **`services`**: **`isPublished`**, plus **`vendorId`**, **`name`**, **`description`**, **`price`**, **`demo`**, etc.

**Indexes / constraints:**  
- [ ] **`users.email`** unique behavior matches schema (upsert uses email).  
- [ ] **`vendors.email`** unique if smoke vendor email is fixed.

---

## 4. Migration-history risks to watch for

- [ ] **`P3005` (non-empty DB):** Do **not** expect raw **`migrate deploy`** to fix an unbaselined DB; baseline first per Prisma docs.
- [ ] **Wrong baseline:** Marking migrations as applied **without** them having run can hide missing tables/columns and cause **later** runtime failures.
- [ ] **Partially applied history:** If **`_prisma_migrations`** exists but rows do not match files on disk, resolve with DBA + Prisma guidance before adding new baselines.
- [ ] **Destructive SQL in old migrations:** Review migration SQL for **`DROP`**, narrow **`ALTER`**, or data-type changes on Azure SQL before applying to a shared DB.
- [ ] **Order / dependencies:** FKs between **`users`**, **`vendors`**, **`services`**, **`bookings`**—ensure migrations apply in an order that respects existing data.
- [ ] **Drift after baseline:** Any **manual** hotfix on the server must be mirrored in **`schema.prisma`** + a new migration or drift will return.

---

## 5. Post-fix verification steps

Run in order after schema / migration history is aligned:

1. [ ] **`npx prisma generate`** — completes without **`EPERM`** / file-lock errors (retry after stopping **`next dev`** / other Node processes if needed).
2. [ ] **DB introspection sanity (optional):** **`npx prisma db pull`** (scratch branch) or **`prisma migrate diff`** against the target to confirm **`users.phone`** and other critical columns match expectations.
3. [ ] **Smoke fixture / globalSetup:** Run **`npm run test:e2e:smoke`** once; confirm **`e2e/smoke-fixture.json`** is written and **`globalSetup`** completes (no Prisma error on **`user.upsert`** / vendor / service).
4. [ ] **Full smoke:** Same command should proceed past globalSetup into the browser test; address UI/network failures separately from schema.
5. [ ] **App smoke (optional):** Hit a few **`/api/`** routes or UI flows that use **`User`** / **`Vendor`** / **`Service`** to confirm no remaining drift errors in logs.

---

## 6. Rollback / caution notes (shared Azure SQL)

- **Shared DB:** Treat every **`ALTER`** and migration as **visible to all consumers** of that database; coordinate with other teams using the same instance.
- **Rollback:** Prisma **`migrate deploy`** does not auto-rollback; plan **restore from backup** or forward-fix with a **new** migration if something goes wrong.
- **Data-preserving changes:** Prefer **additive** columns (nullable or defaulted) over destructive drops on shared environments.
- **Secrets:** Do not commit **`DATABASE_URL`**; use Key Vault / CI secrets / local **`.env.local`** only on trusted machines.
- **Re-baseline:** If you baseline the wrong state, do **not** delete rows from **`_prisma_migrations`** casually—involve someone who understands Prisma + DBA impact.

---

## Related docs

- **`DB_BASELINE_AND_SCHEMA_DRIFT_NOTES.md`** — failure modes, Path A vs B, minimal smoke requirements, pre-rerun checklist.
- **`E2E_SMOKE_IMPLEMENTATION_NOTES.md`** — E2E commands, connectivity vs schema, **`globalSetup`** behavior.
