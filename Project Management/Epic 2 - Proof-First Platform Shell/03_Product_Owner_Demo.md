# Epic 2 Product Owner Demo

**Epic:** Proof-First Platform Shell
**Build / commit:** Epic 2 scoped checkpoint, hash reported after commit
**Demo date:** Pending Product Owner replay
**Product Owner:** Cesar Olivera
**Overall result:** Ready to run

## Demo Checklist

| Validate | Exact action and expected observation | Engineering result | Product Owner result |
|---|---|---|---|
| Homepage | Open `/`. Within five seconds identify Reliance and the primary action. After thirty seconds explain: real completed work helps you decide who to trust. | Pass | Pending |
| Explore Proof | Select **Explore Proof**. Confirm Public Service Videos, reviews, Trust Score, and Services Offered are separate concepts. | Pass | Pending |
| Search and recovery | Search/filter results, clear filters, and inspect empty/loading/failure recovery. | Pass | Pending |
| Completed work | Open a public result. Confirm proof leads and service request/contact remains secondary. | Pass | Pending |
| Provider credibility | Open the provider. Confirm the page first answers why the business may be trusted. | Pass | Pending |
| Customer shell | Sign in as a controlled customer and confirm **Explore Proof** is consistent in navigation and return actions. | Source/focused test pass | Pending beta replay |
| Vendor shell | Sign in as controlled vendor and confirm operational controls are unchanged while public-growth copy is proof-first. | Source/build pass | Pending beta replay |
| Employee shell | Open a controlled assigned link. Confirm assignment and canonical permission gates are unchanged. | 9/9 regression pass | Pending beta replay |
| Admin shell | Sign in as controlled admin and confirm **Featured Proof** labels while route and controls remain intact. | Source/build pass | Pending beta replay |
| Notifications | Confirm no notification was triggered or changed by navigation/copy use. | No trigger/template diff | Pending |
| Database | Confirm ordinary browsing creates no work record, review, rating, Trust Score input, permission, or publication event. | No DB/API mutation added | Pending |
| Trust Score | Confirm shown values are existing server values and that browsing does not alter them. | No calculation diff | Pending |
| Reviews | Confirm reviews remain genuine, optional, separate signals; browsing creates none. | No review logic diff | Pending |
| Audit history | Confirm browsing/copy changes add no consequential decision record; existing role/security audit behavior remains. | No audit diff | Pending |
| Screenshots | Review `08_Screenshots/README.md`; verify before/after and all state images contain no secrets/private media. | Pass | Pending |

## Five-Person Comprehension Script

For each person, show the homepage for five seconds, close it, and ask: “What page was that, and what could you do there?” Then show it for thirty seconds and ask:

1. What does Reliance do?
2. Why is it different?
3. What would you do next?
4. What is the difference between Service Videos, reviews, Trust Score, and Services Offered?
5. Does the company feel trustworthy? Why or why not?

Record the answer and page rating without coaching. Epic approval requires the answer to center on seeing real completed work before deciding whom to trust.

## Expected Role State

- **Customer:** public proof is understandable; private data remains private.
- **Vendor:** work and profile controls remain available and unchanged.
- **Employee:** only assigned and permitted recording actions are available.
- **Admin:** existing evidence and moderation controls remain; terminology is proof-first.

## Product Owner Decision

- [ ] Approved to close Epic 2
- [ ] Changes required
- [ ] Blocked
- [ ] Epic 3 authorized

**Decision notes:** Pending manual replay and five-person comprehension results.
