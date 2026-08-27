# RV-8 Vendor Invite Migration Provenance Exception

## Scope

This release-governance record authorizes one historical checksum exception for:

`20260707012500_add_vendor_invite_recipient_fields`

It does not authorize checksum exceptions for any other migration. A second or changed mismatch is a release stop condition.

## Provenance

| Item | Evidence |
| --- | --- |
| Applied to beta | 2026-07-07 06:10:35.629 UTC |
| Applied checksum | `b69471cc0bd357e81cc419cb5119bfb0cbfe6c8fb842f4ca00bf494bbe1a4f6b` |
| First repository commit | `ef70948eb94bfdd037b5fdf0e990abb6de1d6a82` |
| First committed | 2026-07-08 08:05:50 -04:00 |
| Current file raw SHA-256 | `c8eb76acae5006ed92ba6814199e4537762161ef78a9edc1f81a04a7d648e155` |
| Current Git blob SHA-256 | `b1cdb20eb5d4358d2c76df4132061053e63a8dc2fb3e6202f5d4ed262655a9c3` |
| Applied steps | 1, successfully finished |

The original applied bytes cannot be reproduced from the committed file using raw, LF-normalized, or CRLF-normalized content. The migration was applied before its first surviving repository commit. No claim is made about the missing original bytes.

## Semantic Verification

The intended migration adds exactly these nullable columns to `dbo.vendor_invites`:

| Column | SQL Server contract |
| --- | --- |
| `inviteeName` | `NVARCHAR(1000) NULL` |
| `inviteeEmail` | `NVARCHAR(1000) NULL` |
| `inviteePhone` | `NVARCHAR(1000) NULL` |
| `inviteeRole` | `NVARCHAR(1000) NULL` |

Read-only beta inspection confirmed all four live definitions match the current intended DDL. No beta row, schema object, migration row, or checksum was changed during reconciliation.

## Risk Decision

The byte-level provenance gap is historical and cannot be repaired truthfully by editing an applied migration or changing `_prisma_migrations`. The semantic effect is narrow, additive, and fully inspectable. Product Owner approval therefore permits this one mismatch only when all of the following remain true:

1. The migration name and live applied checksum match this record exactly.
2. The four live column definitions match the semantic contract above.
3. The repository contains this provenance record.
4. Migration history otherwise matches the repository with no missing, pending, rolled-back, or additional checksum mismatch.
5. The SQL Server semantic schema validator passes.

Any failure of these conditions blocks deployment. Future checksum mismatches require a separate investigation and explicit Product Owner approval; they are not covered by this exception.
