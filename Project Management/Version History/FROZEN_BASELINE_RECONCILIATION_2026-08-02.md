# Frozen Baseline Reconciliation - 2026-08-02

## Purpose

Consolidate the approved Reliance governing documents inside the real application repository after several frozen design files were previously saved outside Git.

Repository: `C:\Users\Cesar Olivera\Project Reliance`

## Restored From Git

The locally deleted Epic 1 project records, Phase 1 review report, consent decision register, and recording workflow specifications were restored from the current committed repository state. No committed wording was rewritten.

## Added To Git Without Modification

| Frozen document | Permanent repository path | SHA-256 |
| --- | --- | --- |
| Consent Architecture V1 | `docs/legal-consent-audit/RELIANCE_CONSENT_ARCHITECTURE_V1.md` | `3B6FB8E96FA5EF23281141C688552A8797028C86B75481B6B3E158C1D1FBC4AC` |
| Consent UX Specification V1 | `docs/legal-consent-audit/RELIANCE_CONSENT_UX_SPECIFICATION_V1.md` | `0E84BE1607248F8D9E35A8486FE6E7CEBBB884C637060CB33BC4787E185739DB` |
| Platform Language Guide | `RELIANCE_PLATFORM_LANGUAGE_GUIDE.md` | `87F19AAAE1891B945CF15CD984E18E9C742466AAE30E1430E7C9C0AAF9E2FB8F` |
| Implementation Roadmap V2 | `Project Management/RELIANCE_IMPLEMENTATION_ROADMAP_V2.md` | `EB3376DBB3FC803A5CEA766DCC2FEA9BCBE8AD46219CF19BD6B6C2B54311DB43` |
| Epic 1 Implementation Plan | `Project Management/Epic 1 - Verified Permission Request/RELIANCE_EPIC_1_VERIFIED_PERMISSION_REQUEST_IMPLEMENTATION_PLAN.md` | `5379F7BF3634818B1074CA3448E0D949D7227B2D0931FB64EEADA11D66B59780` |

Each repository copy is byte-for-byte identical to its approved source copy.

## Duplicate Review

- The Desktop copies of the workflow V1, workflow V1.1, and decision register differ from the committed repository copies only by line endings.
- The Desktop Beta Readiness Checklist is an older copy. The repository checklist contains later Epic 1 and beta-feedback updates and remains the authoritative tracker.
- The standalone audit `.docx` under the dated Codex workspace is a convenience copy outside Git. The repository Markdown audit and committed downloadable `.docx` remain authoritative.

## Unchanged

- No frozen document content was edited.
- No application code, database schema, migration, deployment package, or Azure setting was changed.
- `tsconfig.tsbuildinfo` and the untracked `output/` directory were left untouched.

