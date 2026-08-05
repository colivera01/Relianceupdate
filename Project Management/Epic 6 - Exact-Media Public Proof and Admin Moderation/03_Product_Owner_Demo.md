# Epic 6 Product Owner Demo

**Build / commit:** `d6edf5cee81b11d9c1eb9fc5ee9bbbe4fbe96e5d`
**Demo date:** Pending live beta replay
**Overall result:** Automated evidence ready; manual decision pending

| Validate | Exact Product Owner action and expected observation | Current evidence |
|---|---|---|
| Workflow | Open a manager-approved Private package. Propose Final Result, approve it as customer, complete applicable employee and vendor decisions, approve as admin, then confirm only that exact clip appears publicly. | Automated pass; live replay pending. |
| Exact version | Replace or alter the selected clip after approval. The old Public URL must stop serving it and the new version must require a new chain. | Unit/API pass. |
| Customer choices | Repeat with selected stages, none/Private, and correction. No choice or no action may fabricate approval. | Unit/API and visual evidence pass. |
| Vendor state | Confirm Final Result is the only default and another stage must be selected intentionally. Confirm vendor cannot override a decline. | Component screenshot and service tests pass. |
| Employee state | Confirm only the implicated employee can decide likeness/audio for that exact stage. | API tests and desktop/mobile screenshots pass. |
| Admin state | Confirm incomplete/stale proposals cannot be approved and admin cannot broaden missing authority. | Service/API tests and admin screenshot pass. |
| Public serving | Open Explore Proof, service detail, vendor public profile, favorites, and direct media URL. Only active canonical eligibility may appear. | Public-route tests pass; live beta replay pending. |
| Database | Verify proposal/stages, exact hashes/versions, customer, participant, vendor, admin, eligibility, and audit rows. | Schema/migration reviewed; beta migration pending. |
| Legacy Public | After migration, verify former raw Public assets are inventoried and Private, not deleted or silently republished. | Migration review complete; beta reconciliation pending. |
| Reviews | Confirm publication decisions create no review or rating and genuine review behavior is unchanged. | Regression pass. |
| Trust Score | Confirm Private/declined/pending publication creates no Trust Score input. | Regression pass; full score certification remains Epic 8. |
| Notifications | Confirm existing unrelated notifications remain unchanged. Publication lifecycle delivery is not part of this checkpoint and is recorded for Epic 10. | No notification code changed. |
| Audit | Reconstruct proposal, exact versions, every decision, invalidation, eligibility, and legacy restriction without raw secrets. | Unit/API pass; live DB inspection pending. |
| Screenshots | Review the nine indexed controlled desktop/mobile/state images. | Ready in `08_Screenshots/README.md`. |

## Expected Role States

- **Customer:** Private until the customer affirmatively selects exact media.
- **Vendor:** May propose and represent, but never override another authority holder.
- **Employee:** May decide only applicable personal likeness/audio.
- **Admin:** May moderate a complete chain, never repair or broaden missing authority.

## Follow-Up Defects

No confirmed Epic 6 application defect remains. Migration application, deployment, storage playback, cache checks, and live four-role replay are release gates.

## Product Owner Decision

- [ ] Approved to close this epic
- [ ] Changes required
- [ ] Blocked
- [ ] Next epic authorized

**Decision notes:** Pending Product Owner review.
