# Reliance legal and consent content package

Status: **DRAFT / PRODUCT OWNER REVIEW**

These documents are prospective content drafts only. They are not effective terms, privacy notices, policies, consents, or production copy. They are not counsel-approved. Nothing in this directory is imported by a live route, seeded into the database, or eligible to satisfy a live assent or authorization gate.

## Governance boundary

- Operator named in these drafts: Reliance Technologies LLC.
- Product Owner legal-plan contact: `colivera080124@gmail.com`.
- The contact is not described as a registered office, physical legal address, or statutory-agent address.
- Governance status is `DRAFT`; review state is `PRODUCT_OWNER_REVIEW`.
- A future activation requires separate Product Owner authorization, counsel disposition where identified, implementation of all mapped dependencies, fresh tests, a new immutable content version, and a controlled deployment.
- Historical policy and consent evidence remains immutable. These drafts must never be backfilled onto prior decisions.
- The current live support contract remains unchanged by this package. Before activation, the Product Owner must reconcile the legal-plan contact above with the separately approved live customer-support mailbox.

## Snapshot and hash contract

Each `.draft.md` file carries a unique content key and version. `manifest.json` records:

- the SHA-256 of the exact body after front matter, suitable for a future `contentSnapshot` binding;
- the SHA-256 of the complete normalized document;
- UTF-8 byte counts; and
- a deterministic package hash over sorted content key, version, and body hash tuples.

Line endings are normalized to LF. The manifest contains no clock-derived value, so identical content produces identical evidence. Run:

```text
npm run legal:drafts:manifest
npm run legal:drafts:verify
```

## Source hierarchy

The drafts reconcile:

1. Product Owner decisions in GitHub issue #1 comment `6133947167`.
2. The C-01 through C-24 legal/content review in comment `6133434000`.
3. Current Reliance routes, models, exact decision evidence, and dormant legal infrastructure at source commit `8dbe47be9174374f5b2cb8bb31f544e316261cbd`.
4. Current official legal and governance references listed in `coverage-map.md`.

Where those sources do not establish a reliable promise, the draft says less and the coverage map records an activation dependency. Product or engineering behavior is not inferred from desired wording.

## Package contents

The package includes Terms, Privacy, Vendor assent, accountless Employee assent, Customer recording authorization, Employee job-specific recording participation, Employee standing Public participation, Customer Public/Private package choices, withdrawal/dispute language, privacy-request intake, transactional SMS, AI disclosure/governance, retention/disposition, and accessibility language.

See `coverage-map.md` for C-01 through C-24 coverage, current implementation placement, future placement, confidence, counsel-review needs, and activation blockers.
