# Reliance legal and consent content package - draft revision 3

Status: **DRAFT / PRODUCT OWNER REVIEW**

These documents are prospective drafts only. They are not effective Terms, Privacy notices, policies, consents, or production copy. They are not counsel-approved. Nothing in this directory is imported by a live route, seeded into the database, or eligible to satisfy a live assent or authorization gate.

## Revision history

- Revision 1 remains unchanged in `docs/legal-content-drafts/2026-10-12/`.
- Revision 1 package SHA-256 remains `63bb7c9523e4690e85843d542b92cd6d78d8ad70714c5b0e13be2df573f5f83b`.
- Revision 2 remains unchanged in `docs/legal-content-drafts/2026-10-12-draft.2/` with package SHA-256 `78893222833248ff6f299e78c59ac1a2a0fba893a8e4e8f72ca50022891d0555`.
- Revision 3 uses new `draft.3` version identifiers and independent hashes.
- Revision 3 responds to Product Owner instruction in GitHub issue #1 comment `6159725181`.
- Its only substantive prospective-copy change from Revision 2 is the corrected canonical support contact.
- No prior version or hash is relabeled, overwritten, or reinterpreted.

## Two-part document contract

Every `.draft.md` file has two machine-bounded sections:

1. **PROSPECTIVE USER-FACING COPY** contains only text proposed for display, publication, or incorporation into a future legal acceptance surface.
2. **INTERNAL ACTIVATION NOTES - NOT USER-FACING** contains engineering dependencies, evidence requirements, attorney-review flags, activation blockers, and operational controls.

The two sections have separate SHA-256 values. The publishable-body hash excludes the visible draft banner, metadata, markers, and internal activation notes. Internal notes must never be stored as the legal text a person accepted.

## Governance boundary

- Operator named in the drafts: Reliance Technologies LLC.
- Product Owner-approved canonical support contact: `Relianceorg.support@gmail.com`.
- The contact is not represented as a physical office, registered office, registered-agent address, or universally sufficient statutory notice address.
- Governance status is `DRAFT`; review state is `PRODUCT_OWNER_REVIEW`.
- `runtime_effective` and `counsel_approved` are both `false`.
- A future activation requires item-by-item Product Owner approval, counsel disposition where identified, completion of mapped dependencies, a new effective version/hash, fresh tests, and separately authorized controlled deployment.
- Historical policy, assent, consent, and visibility evidence remains immutable.

## Activation blockers preserved

- The retired Decide Later action has been removed prospectively from the current Customer recording flow; no action remains pending and fail-closed.
- The draft contact now matches the canonical customer-support configuration.
- Employee job-specific recording-participation wording remains counsel-review pending.
- No role assent, withdrawal/privacy-request workflow, retention worker, or ordinary V2 activation is live.

## Hash contract

`manifest.json` records for each draft:

- content key and new `draft.3` version;
- predecessor `draft.2` version and hashes;
- SHA-256 and byte count for the exact prospective user-facing copy;
- SHA-256 and byte count for internal activation notes;
- SHA-256 and byte count for the complete normalized document; and
- a deterministic package hash over sorted content identity and all three hashes.

Text uses UTF-8 and LF line endings. The manifest contains no clock-derived value. Run:

```text
npm run legal:drafts:manifest
npm run legal:drafts:verify
```

See `coverage-map.md` for C-01 through C-24 coverage, current source truth, revision disposition, and remaining activation dependencies.
