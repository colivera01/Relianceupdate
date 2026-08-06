# Epic 7 Lessons Learned

**Date reviewed:** 2026-08-05

## What Went Well

- One canonical least-exposure resolver kept Public, Private, recording, download, and admin behavior consistent.
- Independent Blob absence verification made the difference between a deletion request and truthful completion explicit.
- Building on Epic 5 package identity and Epic 6 exact-media eligibility avoided a second media-authority system.

## What Surprised Us

- Legacy archive fields could easily imply deletion before storage verification; compatibility fields required stricter write rules.
- Retention scheduling needed an explicit manager-approval integration, not only lifecycle-page initialization.

## What Slowed Development

- The repository contains five unrelated baseline test failures, so Epic-specific evidence had to be separated carefully.
- Live storage, worker, and cache behavior cannot be proven in a local fixture alone.

## What Should Change Before the Next Epic

- Apply migration and run the four-role/storage replay before freezing Epic 7.
- Keep lifecycle outcomes out of Trust Score and dashboard calculations unless a later approved epic explicitly defines a genuine signal.
- Configure worker cadence and operational alerting during release hardening.
