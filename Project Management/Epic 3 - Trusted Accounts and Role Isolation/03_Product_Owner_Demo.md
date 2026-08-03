# Epic 3 Phase A Product Owner Demo

**Build:** Local Phase A worktree from `43c18f9`
**Overall result:** Automated rehearsal passed; Product Owner replay pending

| Step | Product Owner action | Expected observation | Automated evidence |
|---|---|---|---|
| 1 | Sign in as a customer and open `/vendor/dashboard`. | `Vendor access required`; no vendor data or controls. | Playwright pass; desktop/mobile screenshots |
| 2 | With the same general session, open `/admin/dashboard`. | `Admin access required`; no admin data. | Playwright pass; screenshot |
| 3 | Sign in as an active vendor manager and open `/vendor/dashboard`. | Exact current vendor dashboard opens. | Playwright pass; screenshot |
| 4 | Remove or revoke the test manager membership, refresh, then retry. | Access fails closed. Restore the controlled fixture afterward. | Unit/integration matrix pass |
| 5 | As an employee, attempt a manager-only vendor profile update. | Request is denied with `403`; profile remains unchanged. | Playwright API pass |
| 6 | As an employee assigned to controlled work, verify employee actions remain available but manager actions do not. | Only assigned employee actions appear. | Focused membership/assignment suite pass |
| 7 | Sign in through the admin-scoped flow using the approved admin account. | Admin dashboard opens because an active DB grant exists. | Playwright pass; screenshot |
| 8 | Revoke a controlled admin grant and retry with the same signed session. | Admin access fails closed. Restore only in the controlled test fixture. | Admin grant/session unit matrix pass |
| 9 | Attempt a cross-vendor/customer resource ID. | `403` or non-disclosing `404`; no other tenant data. | IDOR matrix pass |
| 10 | Review permission, review, Trust Score, publication, and private-media records before/after these auth tests. | No synthetic or unrelated record is created. | 97/97 cross-epic regression pass |

## Expected State By Role

- **Customer:** customer routes only; direct vendor/admin URLs are blocked.
- **Vendor manager:** exact active vendor workspace and manager actions only.
- **Employee:** active membership and assignment actions only; no manager authority.
- **Admin:** admin-scoped signed session plus active database grant required.
- **Database:** current `User`, `VendorMembership`, ownership/assignment, and `PlatformRoleGrant` determine authority.
- **Audit:** consequential denials and admin grants contain actor/resource metadata, never credentials or raw secrets.
- **Trust Score/reviews:** unchanged; no authorization event creates an input.
- **Notifications:** unchanged.

## Screenshot Review

Open `08_Screenshots/SCREENSHOT_INDEX.md` and verify the customer blocked states, manager success state, admin success state, and mobile blocked state contain only synthetic data.

## Follow-Up Defects

| ID | Severity | Description | Required before deployment? |
|---|---|---|---|
| E3A-BUILD-01 | High | Untouched `pages/support` and `pages/notifications` block production build. | Yes |
| E3A-SCA-01 | Critical/High | Existing dependency audit advisories require a separate upgrade and regression plan. | Yes for release security gate |

## Product Owner Decision

- [ ] Approve Phase A implementation
- [ ] Authorize a narrowly scoped build-blocker repair
- [ ] Authorize dependency remediation planning
- [ ] Authorize Phase B after Phase A deployment validation

Phase B and Epic 4 remain unauthorized.
