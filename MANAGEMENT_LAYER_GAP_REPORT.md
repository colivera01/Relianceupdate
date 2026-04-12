# Management Layer Gap Report

## Vendor Management Pages

### `/vendor/services`
- **Current data source:** local `useState` array in page file.
- **Real API routes available now:** `/api/services`, `/api/services/[id]`, `/api/services/[id]/media` (partial fit).
- **Missing API support:** vendor-scoped service management contract and publish/list status semantics in vendor UI.
- **Blocked actions:** persisted create/edit/delete/toggle in current page.
- **Status:** mocked.

### `/vendor/employees`
- **Current data source:** local mock arrays in page file.
- **Real API routes available now:** vendor membership/device routes exist but not employee CRUD route family expected by page.
- **Missing API support:** `/api/vendor/employees` style CRUD endpoints.
- **Blocked actions:** real add/edit/delete employee workflow.
- **Status:** mocked.

### `/vendor/reviews`
- **Current data source:** very large local mock/placeholder dataset and TODO comments.
- **Real API routes available now:** review domain APIs + admin moderation endpoints; vendor-specific rich analytics endpoints not implemented.
- **Missing API support:** extensive `/api/vendor/reviews/*`, `/api/vendor/analytics/*`, recovery/customer-insight endpoint set.
- **Blocked actions:** most analytics/recovery/task actions in UI.
- **Status:** mostly mocked.

### `/vendor/analytics`
- **Current data source:** local mock employees/analytics.
- **Real API routes available now:** limited dashboard stats routes; no complete vendor analytics suite.
- **Missing API support:** vendor analytics endpoint family expected by page.
- **Blocked actions:** live metric filtering/drilldowns.
- **Status:** mocked.

### `/vendor/billing`
- **Current data source:** local state + comments for future payment endpoints.
- **Real API routes available now:** no dedicated vendor billing/payments API family in current route tree.
- **Missing API support:** enable/disable payments, payout history, payout request, payment status endpoints.
- **Blocked actions:** all real billing operations.
- **Status:** mocked.

## Admin Management Pages

### `/admin/dashboard`
- **Current data source:** local mock stats.
- **Real API routes available now:** `/api/dashboard/stats`, `/api/dashboard/user-growth` (limited).
- **Missing API support:** route(s) referenced by page comments such as revenue trend endpoint.
- **Blocked actions:** live KPI coverage completeness.
- **Status:** partially mocked.

### `/admin/users`
- **Current data source:** component-backed (`@/components/UserManagement`) - internal source not audited in this pass.
- **Real API routes available now:** `/api/users` exists, but full admin user management contract unclear.
- **Missing API support:** explicit admin user moderation/management routes.
- **Blocked actions:** unknown until component/API contract audit is completed.
- **Status:** partially unknown / likely partial.

### `/admin/reports`
- **Current data source:** component-backed (`@/components/ReportsAnalytics`) - internal source not audited in this pass.
- **Real API routes available now:** dashboard/admin data routes exist but report-specific API set unclear.
- **Missing API support:** explicit report generation/export endpoints.
- **Blocked actions:** likely report export/scheduled reporting.
- **Status:** partially unknown / likely partial.

### `/admin/settings`
- **Current data source:** component-backed (`@/components/Settings`) - internal source not audited in this pass.
- **Real API routes available now:** no explicit centralized admin settings API route family discovered.
- **Missing API support:** persisted admin/global settings endpoints.
- **Blocked actions:** durable settings save/versioning/audit.
- **Status:** partially unknown / likely partial.

### `/admin/activity`
- **Current data source:** component-backed (`@/components/ActivityMonitoring`) - internal source not audited in this pass.
- **Real API routes available now:** `/api/admin/audit-logs` available and stable.
- **Missing API support:** activity-specific filters/streaming endpoint parity if component expects richer telemetry.
- **Blocked actions:** unknown until component route usage audit.
- **Status:** partial (likely can be aligned to audit logs quickly).

## Implementation Order (recommended)
1. `vendor/services` (best low-risk ROI; APIs mostly exist).
2. `vendor/employees` (define concrete CRUD + membership relationship policy).
3. `admin/dashboard` (replace mocks with available stats endpoints first).
4. `admin/activity` (align to `/api/admin/audit-logs` contract).
5. `vendor/analytics` (narrow MVP metrics, avoid giant endpoint burst).
6. `vendor/billing` (requires new payment backend scope; keep after core ops).
7. `vendor/reviews` (large scope; split into moderation vs analytics increments).
8. `admin/users` / `admin/reports` / `admin/settings` component-level API contract audit and phased implementation.
