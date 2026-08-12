# RV-8 Admin Audit Deployment And Smoke Report

## Scope

This checkpoint deployed and validated the approved admin-audit compatibility correction at commit `211142b736f487a88c219a7ef41d5d2ff21c6170`. It did not change application behavior, database schema, migrations, existing audit records, or any RV-9/Epic 8 scope.

## Deployment Provenance

- Repository: `C:/Users/Cesar Olivera/Project Reliance-rv8-residence`
- Branch: `codex/rv8-residence-location-correction`
- Commit: `211142b736f487a88c219a7ef41d5d2ff21c6170`
- Package: `reliance-beta-211142b-rv8-admin-audit-20260812.zip`
- Package SHA-256: `26105abf44413d8a4300083d6979f289e6fe7b0d2cb58157ebef0d7e23a52544`
- Package size: 69,949,869 bytes
- ZIP entries: 3,349
- App Service: `app-reliance-beta-wcus`

Two independent clean builds produced the same package SHA-256. The ZIP passed allow-list and forbidden-material checks. Exact-ZIP startup resolved Next.js only from the extracted package, reached Ready, returned HTTP 200 from `/` and `/api/health`, served repeated optimizer requests, and created no `.next/cache`.

The uploaded package was downloaded and hashed again. Its remote SHA-256 matched the local candidate exactly.

## Configuration Preservation

The approved structured JSON `@file` transport was used. Dry run and post-apply verification confirmed:

- 53 settings before;
- 53 settings after;
- exactly three approved deployment settings changed;
- all 50 unrelated setting fingerprints remained identical;
- the temporary structured settings file was deleted;
- no SAS value or secret was written to this report, Git, screenshots, or command output.

## Health And Immediate Smoke

The App Service is Running and reports the approved commit/package markers. Both `beta.relianceonline.org` and the Azure default hostname returned HTTP 200 for five consecutive homepage and health probes.

Non-mutating route checks passed for the homepage, Explore Proof, Support, Notifications, login, customer dashboard boundary, vendor dashboard boundary, employee assigned-work boundary, admin boundary, and a public permission route. Notification and lifecycle worker endpoints rejected unauthorized requests with HTTP 401. Three consecutive live image-optimizer requests returned valid HTTP 200 image responses.

The post-deployment Azure log review found no new `.next/cache` write, image-cache ENOENT, failed cache write, optimizer unhandled rejection, `MODULE_NOT_FOUND`, bad run-from-package configuration, or volume-mount failure.

## Canonical Admin Audit Validation

A controlled `reactivate` action was performed against the already-active synthetic `Epic One Customer` account. This preserved account availability and did not trigger an account-restriction notification.

Results:

- API response: HTTP 200
- matching audit count before: 0
- matching audit count after: 1
- delta: exactly 1
- canonical SQL proof: new record ID begins with `audit_`
- actor: matched the verified beta administrator
- action type: `ACCOUNT_ACTIVE`
- entity target: matched the controlled synthetic user
- timestamp: present
- previous state: present
- resulting state: present
- metadata: present
- target account status before/after: `active` / `active`
- sensitive evidence scan: no raw OTP, permission token, SAS value, credential, worker secret, session secret, or password detected

The `audit_` prefix is emitted by the canonical SQL path; the Prisma fallback uses its model default identifier. This proves normal current-schema operation did not require fallback.

## Historical Log Integrity

Azure retains earlier `Invalid column name 'action'` errors. They were not deleted or rewritten. The newest relevant historical entry predates this corrected action. The canonical action was recorded at `2026-08-12T22:20:23.455Z` and generated no later legacy-column error, canonical-insert failure, duplicate, or audit-related unhandled exception.

## RV-8 Resume Decision

The corrected cumulative package is healthy and the admin-audit smoke passes. The controlled residence record remains suitable for physical replay:

- permission is current, verified, and `ALLOWED`;
- employee certification is active;
- recent precise-location attempts are verified;
- no staged media session exists;
- no staged media asset exists;
- the earlier failed transaction created no duplicate staged evidence.

The Product Owner may resume with the preserved Starting Condition preview if the phone browser still retains it. Otherwise, one fresh controlled Starting Condition attempt must be recorded through the normal employee UI. No database manipulation is permitted.

RV-8 remains open until physical capture, truthful upload/retry, duplicate protection, manager correction, replacement, approval, Private customer playback, and unauthorized-role denial pass. RV-9 and Epic 8 have not started.
