# Legacy Pages Router components

These modules support the **classic `pages/` router** (`pages/support.js`, `pages/notifications.js`) and older admin prototypes. They are **not** imported by the primary **App Router** tree under `src/app/` (which uses `@/components/*` → `src/components/`).

- Do not add new features here unless maintaining those legacy routes.
- Prefer new work in `src/components/` and App Router pages.
- UI primitives come from `src/components/ui/` via the `@/components/ui/...` alias.
