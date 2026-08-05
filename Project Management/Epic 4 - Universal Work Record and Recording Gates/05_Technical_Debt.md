# Epic 4 Technical Debt

**Last reviewed:** 2026-08-04

| Issue | Reason | Impact | Recommended resolution | Target Epic | Status |
|---|---|---|---|---|---|
| Physical camera/GPS/upload matrix not executed | Requires supported handsets and deployed migrations | Automated gates pass, but device behavior is not release-certified | Run controlled Android/iOS weak-network and denied-permission matrix | Epic 5 / RR-1A | Open |
| Customer/vendor/admin screenshot set is not complete | This package focused on the highest-risk employee gate | Release-wide visual evidence remains incomplete | Capture full role journeys after deployment | Epic 4 replay / Epic 5 | Open |
| Rejected-correction lifecycle tests disagree with current behavior | Existing fixture expectations predate current manager-review state | Full suite is not green, unrelated to canonical gate | Reconcile in a separately approved maintenance task | Epic 5 or maintenance | Open |
| Existing dependency advisories | No dependencies changed in Epic 4 | Security debt remains visible | Continue approved package-specific remediation; no blind upgrade | Release hardening | Open |
| Legacy capture copy mentions manager review in some blocked contexts | Existing capture panel copy is broader than canonical block copy | Minor employee wording mismatch; authority remains correct | Align contextual helper copy during capture UX work | Epic 5 | Open |

## Debt Accepted by Product Owner

None yet. Open items are not hidden acceptance criteria; Product Owner replay and deployment remain explicit gates.
