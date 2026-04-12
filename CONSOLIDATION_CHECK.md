# Consolidation pass checklist

**Date:** 2026-04-11  
**Goal:** Recover from interrupted/partial merges and reduce duplicate paths **without** new product features.

## What was cleaned up

| Item | Action |
|------|--------|
| Duplicate `ClientProviders` | **Canonical:** `src/components/ClientProviders.tsx` (Radix `TooltipProvider` + `AuthProvider` + optional MSW). **Removed:** root `components/ClientProviders.tsx`. **Updated:** `src/app/layout.tsx` → `import ClientProviders from '@/components/ClientProviders'`. |
| Root `components/` clutter | All former root-level `.tsx` prototypes moved to `components/legacy-pages-router/`. **Pages Router** imports updated in `pages/support.js` and `pages/notifications.js`. Added `components/legacy-pages-router/README.md`. |
| Duplicate `components/ui/` | **Removed** entire tree (dead duplicate of `src/components/ui/`). Legacy modules now import `@/components/ui/*`. |
| `ReviewManagement` / `SupportTicketsPage` | Switched `./ui/...` imports to `@/components/ui/...` before the move so they resolve to `src/components/ui/`. |
| Missing `popover` | **Added** `src/components/ui/popover.tsx` (content restored from git `HEAD:components/ui/popover.tsx`) so `legacy-pages-router/ReviewManagement.tsx` typechecks after duplicate `ui` removal. |
| `src/components/SupportTickets.tsx` | **Deleted** — empty file, no imports in `src/`. |
| `temp-create-job-check.cjs` | **Deleted** from repo root. **Replaced by** `scripts/dev/vendor-job-dashboard-persist-check.cjs` and `scripts/dev/README.md`. |
| Handoff docs | **`CHANGELOG_LATEST.md`:** new consolidation section; removed stale “fix `/admin/vendors` broken dependency” follow-up (replaced with done note). **`PROJECT_STATE.md`:** new “Recovery + consolidation” section. |

## Verification

- `npx tsc --noEmit` — pass (after `popover.tsx` added).
- `npm run build` — pass.
- `npm test` (Vitest) — 13 tests, pass.

## What remains intentionally deferred

- **Vendor jobs hybrid page**, **booking list edge cases**, **management-layer APIs**, **smart review vendor UX**, **integration tests** — unchanged scope vs `PROJECT_STATE.md` / `MANAGEMENT_LAYER_GAP_REPORT.md`.
- **Legacy Pages Router** (`/support`, `/notifications` under `pages/`) — kept working; not migrated to App Router in this pass.
- **`components/legacy-pages-router/ReviewManagement.tsx` and other large files** — still mock-heavy prototypes; not wired to App Router admin routes.

## Files still considered legacy

| Path | Role |
|------|------|
| `components/legacy-pages-router/**` | Old admin/support UI used only by `pages/support.js` and `pages/notifications.js` (and retained for reference). |
| `components/legacy-pages-router/layout/MainLayout.tsx` | Unused by current `pages/_app.js`; kept with legacy bundle for possible reuse. |

## Git hygiene summary (non-destructive guidance)

**Safe to commit as part of this consolidation slice (when you are ready to commit):**

- `src/components/ClientProviders.tsx`, `src/app/layout.tsx`
- `src/components/ui/popover.tsx`
- `components/legacy-pages-router/**` (moved files + README)
- `pages/support.js`, `pages/notifications.js`
- Deleted paths: root `components/*.tsx` (moved), `components/ui/**` (removed), `components/ClientProviders.tsx`, `src/components/SupportTickets.tsx`, `temp-create-job-check.cjs`
- `scripts/dev/**`
- `PROJECT_STATE.md`, `CHANGELOG_LATEST.md`, `CONSOLIDATION_CHECK.md`

**Already deleted from disk (show as `D` in git until staged):**

- Root `components/ClientProviders.tsx`
- All former root `components/*.tsx` (now under `legacy-pages-router/`)
- `components/ui/**` (duplicate)
- `src/components/SupportTickets.tsx`
- `temp-create-job-check.cjs`

**Not touched by this pass but still in a large dirty tree:**

- Many other `M` / `??` files (API, prisma, vendor jobs, etc.) from earlier work — commit separately in logical batches when ready.

**Do not commit:**

- `.env.local`, `.env.new`, secrets, or local-only env files.

## Is the tree safer for the next implementation pass?

**Yes.** There is a single client-provider entry for App Router, one canonical `src/components/ui/` tree, a clearly labeled legacy folder for Pages Router, no empty `SupportTickets` stub, and handoff docs aligned on `/admin/vendors`. Build and tests are green. Remaining risk is **volume of unrelated uncommitted changes** elsewhere in the repo — address with staged commits, not with further folder moves in this pass.
