# Database baseline and schema drift (E2E smoke context)

**Date:** 2026-04-12  
**Audience:** Anyone running **`npm run test:e2e:smoke`** or **`npx prisma migrate deploy`** against an existing Reliance SQL Server database.

---

## 1. Current failure

**E2E smoke (`e2e/global-setup.ts`)**  
- **`prisma.user.upsert(...)`** fails because the live **`users`** table does not have a **`phone`** column, while the generated Prisma client and **`prisma/schema.prisma`** expect it.

**`npx prisma migrate deploy`**  
- Fails with **`P3005`**: the database is **non-empty** and Prisma does **not** see a aligned migration history (tables exist, but `_prisma_migrations` / baseline is not set up for this repo’s **`prisma/migrations`**). Prisma refuses to apply the migration stack blindly to avoid destructive assumptions on an existing database.

---

## 2. Why this happens

- The environment uses an **existing database** (data and tables already present), not a greenfield database created only from this repo’s migrations.
- **`_prisma_migrations`** is empty, out of date, or otherwise **not aligned** with the current **`prisma/migrations`** folder, so **`migrate deploy`** cannot safely assume “apply everything from zero.”
- **Application code and `schema.prisma`** have moved **ahead** of the live schema (e.g. **`User.phone`** and possibly other columns), causing **schema drift** at runtime.

---

## 3. Required remediation paths

### Path A: Prisma baseline for an existing database (recommended long-term)

Follow Prisma’s official flow: mark the current schema state as applied (baseline), then use **`migrate deploy`** for **new** migrations only. See: [How to baseline a production database](https://www.prisma.io/docs/guides/migrate/baseline-database).

**Pros (this project):** Single source of truth (**`prisma/migrations`**); repeatable across staging/production; future columns stay managed by migrations.  
**Cons:** Requires coordination, understanding of current DB vs migration SQL, and a one-time baseline window; wrong baseline can mark migrations as applied without them having run.

### Path B: Manual SQL / DBA alignment to match `schema.prisma`

Add or alter columns (e.g. **`ALTER TABLE users ADD phone ...`**) and any other missing pieces so the physical schema matches **`schema.prisma`**, then optionally fix **`_prisma_migrations`** manually or baseline afterward.

**Pros:** Fast for a single missing column in an emergency; no Prisma CLI baseline step if you fully trust hand-written DDL.  
**Cons:** Easy to drift again; not repeatable for the team unless every change is mirrored in migrations; risk of mismatch between “what DBA did” and **`schema.prisma`**.

**In this project:** Path A fits Reliance’s **SQL Server + Prisma** setup and growing **`prisma/migrations`** tree. Path B is reasonable only as a **tactical patch** if baseline is blocked and smoke must unblock quickly—with a follow-up migration so Git stays authoritative.

---

## 4. Minimal immediate requirement for E2E smoke pass 1

**Blocking today:** **`users.phone`** must exist (nullable is fine if the migration defines it that way—match **`schema.prisma`**).

**Also exercised by `e2e/global-setup.ts` (verify columns exist before expecting smoke to pass):**

| Model    | Operations / fields used (non-exhaustive of full model) |
|----------|-----------------------------------------------------------|
| **User** | `upsert`: `id`, `email`, `name`, `demo` — Prisma still issues statements against the full **`User`** row shape; missing **`phone`** fails first. |
| **Vendor** | `findFirst` by `email`; `create` / `update`: `name`, `businessName`, `email`, `phone`, `demo`, **`isPubliclyListed`**. |
| **Service** | `findFirst` / `create` / `update`: `vendorId`, `name`, `description`, `price`, `demo`, **`isPublished`**. |

If **`vendors.isPubliclyListed`**, **`services.isPublished`**, or other required columns are missing on the target DB, **`globalSetup`** will fail on the next operation after **`User`** is fixed. Compare live tables to **`prisma/schema.prisma`** (or run **`npx prisma migrate diff`** / **`db pull`** as appropriate).

---

## 5. Pre-rerun checklist (`npm run test:e2e:smoke`)

- [ ] **DB reachable** from the machine running Playwright (`DATABASE_URL` in `.env` / `.env.local`).
- [ ] **Schema aligned** with **`schema.prisma`** (baseline + deploy, or verified manual alignment); **`users.phone`** present at minimum.
- [ ] **`npx prisma generate`** run after schema or client changes (CI often does this in install/build).
- [ ] **Chromium installed** for Playwright: `npx playwright install chromium`.
- [ ] **Env present:** `DATABASE_URL`; optional `E2E_CUSTOMER_PASSWORD`; `PLAYWRIGHT_BASE_URL` / `PORT` if not using defaults.

After the above, rerun **`npm run test:e2e:smoke`**.

---

## Related docs

- **`E2E_SMOKE_IMPLEMENTATION_NOTES.md`** — smoke tooling, connectivity vs schema notes, commands.
