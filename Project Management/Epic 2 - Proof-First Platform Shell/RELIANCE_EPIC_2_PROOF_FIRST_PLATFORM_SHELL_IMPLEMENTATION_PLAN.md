# RELIANCE EPIC 2 PROOF-FIRST PLATFORM SHELL IMPLEMENTATION PLAN

**Status:** Approved and executed  
**Planning baseline:** `abe9d0d6fdd54f5942cb0f4511527b64bd04e1c0` on `cursor-latest-build`  
**Implementation status:** Complete; Product Owner demo pending  
**Migration status:** None proposed  
**Deployment status:** No deployment authorized by this plan

## Baseline And Ordering Note

The active Project Dashboard identifies **Epic 2 - Proof-First Platform Shell** as the next approved planning target after the completed **Epic 1 - Verified Permission Request**. The frozen roadmap retains an older epic-number sequence in which Verified Permission Request appeared later. This plan does not rewrite that frozen roadmap. It follows the Product Owner's later approved ordering and the current Project Dashboard.

The current executable application is presumed valid unless an active, user-visible surface can be shown to conflict with the frozen product identity or language standards. Historical audit findings are not accepted automatically. They must be verified against current code before any implementation change.

**Copy preservation rule:** Preserve all effective copy. Only rewrite text that conflicts with the Product Identity, Language Guide, UX Specification, or creates measurable confusion for a first-time visitor.

Reliance is not a booking product. Existing contact, service-request, scheduling, and operational work-record capabilities may remain as supporting functions. Epic 2 will not make them the primary product promise, remove them, or redesign them.

## 1. Success Definition

Epic 2 succeeds only when all of the following are true:

1. A first-time visitor can identify Reliance as a proof-of-service platform from the first viewport.
2. Public and signed-in navigation consistently leads with proof, completed work, Service Videos, reviews, Trust Score, and service history according to the user's role.
3. Service and contact capabilities remain available as supporting actions without becoming the main product identity.
4. Customer-facing copy uses **Service Video**, **Public Service Video**, **Private Service Video**, **Completed Service**, **Services Offered**, and **View Proof** where those terms accurately describe the object or action.
5. Vendor, employee, and admin surfaces use the role-specific terminology defined by the frozen Language Guide.
6. Internal model, API, storage, token, enum, and engineering names do not appear in ordinary UI, errors, loading states, or empty states.
7. Stable route paths remain unchanged unless implementation inspection proves a change is necessary for correctness. Cosmetic route renaming is out of scope.
8. Existing authentication, role boundaries, private/public filtering, Service Video visibility, recording gates, permission decisions, reviews, Trust Score calculations, and publication behavior remain unchanged.
9. Public, customer, vendor, employee, and admin shells work at supported mobile, tablet, laptop, and desktop viewports with no hidden primary actions, overlapping text, inaccessible controls, or broken navigation.
10. The required content, route, authorization, responsive, accessibility, and Epic 1 regression tests pass.
11. The screenshot package and four-role UX review show that the implemented shell is understandable without training.
12. Every primary public page passes the First-Time Visitor evaluation defined in Section 8.1.
13. After thirty seconds on the homepage, a first-time visitor can explain: **Reliance lets me see real completed work before deciding who to trust.**
14. The implemented experience communicates trustworthiness, not merely technical usability.

## 2. Scope Confirmation

### Included work

- Revalidate and correct active proof-of-service terminology and hierarchy.
- Homepage first-viewport positioning and supporting proof sections.
- Signed-out header, footer, public navigation, and Help entry points.
- Public `/browse` experience and signed-in `/discover` experience.
- Public vendor credibility profile at `/vendors/[vendorId]`.
- Service/work-type detail experience at `/service/[serviceId]`.
- Customer shell and navigation.
- Vendor shell and navigation.
- Employee work-view shell and orientation.
- Admin shell and navigation language.
- Login, customer registration, and vendor registration positioning copy.
- Loading, empty, failure, blocked, and success-state language on affected surfaces.
- Responsive navigation and page hierarchy on affected surfaces.
- Keyboard, focus, screen-reader, contrast, status, and long-text behavior.
- Targeted shared components and tests needed to deliver a complete shell experience.
- Epic 2 engineering, UX, screenshot, demo, checklist, lessons, technical-debt, and Git records after implementation.

### Explicitly excluded work

- Changing the meaning or behavior of Epic 1 permission requests.
- Consent architecture, permission links, OTP behavior, recording gates, location checks, or media-session creation.
- Review eligibility, review submission, review moderation, review visibility, or optional-review behavior.
- Trust Score inputs, calculation, maturity rules, or presentation semantics beyond shell placement and existing verified values.
- Public/private Service Video eligibility or filtering.
- Manager approval, exact-media approval, admin moderation, publication, withdrawal, disputes, retention, or deletion behavior.
- Notification delivery rules or templates, except links or shell labels that are directly affected by navigation.
- Removing or redesigning the supporting service-request/contact/booking implementation.
- New search ranking, recommendation, availability, scheduling, payment, or marketplace behavior.
- New database models or migrations.
- Epic 3 account/session and role-isolation redesign.
- Rewriting frozen governing documents.

### Preserved behavior

- Current stable URLs and inbound links.
- Existing public access rules and published-content filtering.
- Existing signed-in role checks.
- Customer, vendor, employee, and admin permissions.
- Current service discovery data source and filtering behavior unless an additive proof-summary field is proven necessary.
- Existing vendor profile and public review APIs.
- Existing Service Video playback controls and access checks.
- Existing contact and service-request pathways as secondary actions.
- Existing genuine reviews and Trust Score values.
- All Epic 1 canonical permission decisions, status states, audit evidence, notification safety, and recording locks.

### User-visible result

Users will encounter one coherent product: Reliance helps people review real completed work and trust signals before deciding whether to contact a provider. Customers will see proof first, vendors will see how completed work builds credibility, employees will see clear assigned-recording tasks, and admins will see operationally precise review tools. Existing working capabilities remain available and unchanged beneath that clearer hierarchy.

## 3. Checklist Items Included

| Checklist row | Epic 2 responsibility | Completion evidence |
|---|---|---|
| PROD-01 | Remove verified active marketplace, directory, or booking-first identity conflicts. | Active-code string scan, route screenshots, first-time UX review. |
| PROD-02 | Make proof primary and keep Services Offered as supporting context. | Homepage, Browse, Discover, vendor, and service-page tests. |
| PROD-03 | Apply role-appropriate labels while preserving route compatibility. | Link audit, active-state tests, desktop/mobile navigation. |
| PROD-04 | Apply the Language Guide to every shell surface changed by this epic. | Terminology scan, snapshots, human language review. |
| PROD-05 | Apply universal orientation and state patterns to shell-level affected screens only. | Screen mapping and state evidence; later workflow screens remain in their approved epics. |
| PROD-06 | Resolve Critical/High accessibility issues in the affected shell. | Automated checks plus keyboard and screen-reader-oriented review. |
| PROD-07 | Verify affected routes at supported mobile, tablet, laptop, and wide desktop widths. | Playwright viewport matrix and screenshots. |
| PROD-08 | Correct unreadable or inconsistent affected shell surfaces without redesigning unrelated workflows. | Contrast review and visual regression evidence. |
| PROD-09 | Deliver a first viewport that communicates Reliance and its proof value. | Homepage desktop/mobile screenshots and first-time comprehension review. |
| HELP-05 | Align Help entry points and affected topic labels with proof-first language. | Link tests and Help entry-point screenshots. |
| TEST-03 | Add affected public and role-shell journey coverage in beta-like fixtures. | Independent role E2E results. |
| TEST-05 | Test accessibility of affected public and role-shell paths. | Axe-equivalent, keyboard, focus, zoom, and contrast results. |
| TEST-11 | Prove approved existing journeys and Epic 1 have not regressed. | Full applicable regression/build results. |
| SHOT-05 | Capture the supported viewport matrix for affected routes. | Screenshot index by route, role, viewport, and state. |
| SHOT-06 | Capture visual accessibility evidence where meaningful. | Focus, zoom, contrast, and validation captures. |
| SHOT-07 | Capture loading, empty, failure, and blocked states. | State matrix and non-applicability notes. |
| SHOT-08 | Provide comparable before/after images where the same state can be recreated. | Build, route, state, and viewport metadata for each pair. |
| DOC-01 | Produce the Epic 2 engineering report. | Final report tied to implementation commit and actual commands. |
| DOC-02 | Produce an indexed and redacted screenshot package. | Screenshot manifest and review. |
| DOC-03 | Produce an honest four-role UX review. | Findings, severity, evidence, and disposition. |
| DOC-04 | Update the affected customer journey summary. | Tested signed-out and signed-in paths. |
| DOC-05 | Update the affected vendor journey summary. | Tested vendor shell and public credibility profile. |
| DOC-06 | Update the affected employee journey summary. | Tested employee shell/orientation without recording changes. |
| DOC-07 | Update the affected admin journey summary. | Tested admin navigation and operational labels. |

Rows are updated only after implementation evidence exists. Planning does not move checklist status.

## 4. Dependencies

### Epic 1

- Epic 1 is complete and frozen except for genuine beta defects.
- All permission states and canonical recording-gate decisions must remain behaviorally identical.
- Epic 2 tests must replay at least pending, declined, allowed, superseded, wrong-recipient, and no-channel shell/status access where relevant.

### Authentication and roles

- Current signed-out, customer, vendor, employee, and admin route guards remain the authority.
- Epic 2 may change labels, hierarchy, and responsive presentation, but not session storage, account switching, authentication, or role resolution.
- Any need for account/session redesign is a stop condition requiring Product Owner approval and Epic 3 planning.

### Public/private media filtering

- Current server-side public eligibility remains the only source for public Service Videos.
- UI changes must never infer Public status from the presence of media.
- Private Service Videos and customer records must remain inaccessible from public Browse, Discover, vendor profile, and service detail routes.

### Current public APIs

- `/api/services/discover` remains the initial source for Browse and Discover.
- `/api/vendors/[vendorId]/public` remains the public vendor-profile source.
- `/api/vendors/[vendorId]/reviews/public`, `/api/services/[id]/reviews/public`, and `/api/vendors/[vendorId]/trust-score` retain their current authorization and visibility behavior.
- Existing media/public eligibility services remain authoritative.

### Shared layouts

- `PublicSiteHeader`, `PublicSiteFooter`, `UserSidebar`, vendor layout, admin `SidebarLayout`, auth shell, and employee work view are shared blast-radius components. Their changes require route-wide regression coverage.

### Frozen standards

- `RELIANCE_PRODUCT_IDENTITY.md`
- `RELIANCE_PRODUCT_IDENTITY_ALIGNMENT_AUDIT.md`, used as a historical finding list that must be reverified
- `RELIANCE_PLATFORM_LANGUAGE_GUIDE.md`
- `docs/legal-consent-audit/RELIANCE_CONSENT_UX_SPECIFICATION_V1.md`
- `Project Management/RELIANCE_IMPLEMENTATION_ROADMAP_V2.md`
- `Project Management/RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md`
- `Project Management/PROJECT_DASHBOARD.md`

## 5. Current-State Audit

### Audit method

The active repository was searched for visible and internal uses of `marketplace`, booking terms, Browse labels, listing terms, availability, scheduling, Public/Private proof, Discover, proof-of-service, Service Video, and Services Offered. Public pages, role layouts, navigation components, auth surfaces, Help, APIs, and shared proof components were inspected. Matches are classified below so implementation does not perform unsafe global replacement.

### Already aligned and to be preserved

- The homepage already presents customer reviews, Public Service Videos, and Trust Score as separate trust signals.
- The homepage already limits its recent-post preview to manager-completed, publicly approved Service Video posts.
- Existing proof cards and public-media previews already distinguish Service Videos from reviews and Trust Score.
- Vendor navigation already includes Analytics & Trust, Reviews, Service Video Activity, Services Offered, and Manage Jobs.
- Employee recording stages already use Starting Condition, Work in Progress, and Final Result.
- Customer navigation already uses My Service Records rather than exposing an internal booking model.
- The service page already includes a proof-review area and `View Proof` behavior in relevant components.
- Epic 1 customer, vendor, employee, and admin permission language is governed separately and is not an Epic 2 rewrite target.

### Confirmed active user-facing gaps to plan for

| Surface | Verified current wording or hierarchy | Planned treatment |
|---|---|---|
| Public header/footer | `Browse Services` | Evaluate `Explore Proof` or `Explore Public Proof` while keeping `/browse`. Use one approved label consistently. |
| Homepage recent section | `Recent posts`, `Approved service posts`, `package`, and fallback to `Browse Services` | Use Service Video and completed-service language; keep publication checks unchanged. |
| Public Browse hero | Leads with browsing vendor services and service counts. | Lead with public proof and providers with proof; Services Offered remain filters/context. |
| Public Browse sections | `Available Vendor Services`, `Service Categories`, `Ready to contact a provider?` | Reorder to proof-first cards and evidence context; keep contact as a secondary next step. |
| Signed-in Discover | `Browse Vendor Services`, `Vendor Services Near You`, service-count framing. | Lead with proof and provider credibility; preserve filters, location behavior, and `/discover`. |
| Customer navigation | `Browse Services` and `Back to Browse Services`. | Use the approved proof-exploration label; keep route targets. |
| Vendor public profile | Services Offered currently precede recent public Service Videos. | Reorder credibility summary, Trust Score, public Service Videos, reviews, then Services Offered where data supports it. |
| Service/work-type page | `Reliance Listing: Public`, booking-card comments, proof below operational/service context in places. | Remove visible listing terminology, elevate verified proof, retain request/contact as secondary actions. |
| Admin navigation | `Promoted Listings` and `Publish Management` can imply marketplace objects. | Use precise admin terms such as featured proof placement or public-content management only where they match actual function. Preserve routes and capabilities. |
| Help entry points | Some task framing still emphasizes service discovery/booking. | Reframe entry labels around reviewing proof and contacting a provider after review; do not rewrite policy or workflow guidance. |

### Context-dependent terms that must not be globally replaced

- **Availability** is valid when it means actual business hours, employee assignment availability, or channel availability. It conflicts only when used as the primary product promise.
- **Scheduling** is valid inside an actual scheduling or operational context. It must not define Reliance's identity.
- **Booking** may remain an internal model/route and may remain supporting customer functionality. Ordinary customer copy should prefer service request or service record where accurate.
- **Job** is valid in vendor/admin operations and ordinary work language. Customer-facing surfaces should prefer Service Record, Work Record, Service Timeline, or Completed Service.
- **Moderation** is valid for admin operations. Customer/vendor surfaces should use Reliance review.
- **Public proof** may appear in brand or policy explanations but not as the customer-facing object label. The object is Public Service Video.
- **Private proof** should not appear as a customer-facing object. Use Private Service Video or private service history.

### Internal engineering terminology that may remain in code but never in ordinary UI

- Internal variables such as `HOME_MARKETPLACE_PREVIEW_LIMIT`, `marketplaceData`, and `reliance-marketplace-shell`.
- Existing `/booking` routes and booking identifiers required for compatibility.
- API names, payload fields, Prisma models, enum values, media identifiers, storage references, tokens, and audit internals.
- Test fixture and migration names that accurately describe historical implementation.

These internal names are not a user-facing defect by themselves. Renaming them would add risk without improving the experience and is not planned unless they leak into rendered output, API error copy shown to users, accessibility names, or logs exposed in UI.

### Implementation-time revalidation rule

Before changing each surface, the engineer must reproduce its current desktop/mobile state and confirm the wording is still active. A historical audit item that is already corrected must be marked **preserved** and left unchanged.

## 6. Expected Files Affected

This is an expected impact map, not permission to edit every file listed. Only files proven necessary during implementation should change.

### Routes and public pages

- `src/app/page.tsx`
- `src/app/browse/page.tsx`
- `src/app/vendors/[vendorId]/page.tsx`
- `src/app/(user)/service/[serviceId]/page.tsx`
- `src/app/help/page.tsx`

### Layouts and navigation

- `src/components/public/PublicSiteHeader.tsx`
- `src/components/public/PublicSiteFooter.tsx`
- `src/components/UserSidebar.tsx`
- `src/app/(user)/layout.tsx`
- `src/app/vendor/layout.tsx`
- `src/app/SidebarLayout.tsx`
- `src/app/admin/layout.tsx`
- `src/app/layout.tsx`, only if shared metadata or accessibility structure requires it

### Shared proof and service components

- `src/components/public/ProofFirstCard.tsx`
- `src/components/public/PublicMediaPreview.tsx`
- `src/components/public/PublicTrustScorePanel.tsx`
- `src/components/public/CustomerTrustSignalCard.tsx`
- `src/components/public/HomeStageVideoShowcase.tsx`
- `src/components/ServiceImage.tsx`, only if accessibility or stable sizing requires it
- Existing shared service-result/card component located during implementation
- Shared loading, empty, banner, and status components only where already established

### Customer pages

- `src/app/(user)/discover/page.tsx`
- Customer dashboard route under `src/app/(user)`
- Affected customer profile/favorites/service-record return labels only where shared navigation changes require them

### Vendor pages

- `src/app/vendor/dashboard/page.tsx`, shell/header only
- Vendor Help/support entry points
- Vendor public-profile links and Services Offered labels where affected by shared terminology

### Employee pages

- `src/app/employee/jobs/page.tsx`, shell/orientation and state language only
- `src/app/employee/mobile/page.tsx` only if redirect metadata or stable mobile entry behavior needs coverage

### Admin pages

- `src/app/SidebarLayout.tsx`
- `src/app/admin/dashboard/page.tsx`, shell/header only
- Admin page headings whose visible terminology is verified to conflict, without changing operational meaning

### Auth pages

- `src/components/auth/AuthExperienceShell.tsx`
- `src/app/auth/login/page.tsx`
- `src/app/auth/register/page.tsx`
- Password and verification pages only if shared shell copy changes them

### APIs

- Prefer no API changes.
- Potential additive-only changes, if the UI cannot accurately show existing public proof from current payloads:
  - `src/app/api/services/discover/route.ts`
  - `src/app/api/vendors/[vendorId]/public/route.ts`
- Public review and Trust Score routes should remain unchanged unless a response field is already available but omitted from an established safe public projection.

### Tests

- Existing homepage, Browse/Discover, vendor-profile, service-page, navigation, role-layout, and authorization tests found during implementation.
- New Epic 2 content/terminology tests.
- New or expanded Playwright public and role-shell journeys.
- Epic 1 canonical recording-permission regression tests.
- Accessibility and viewport tests for affected screens.

### Documentation and evidence after implementation

- `Project Management/RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md`
- `Project Management/PROJECT_DASHBOARD.md`
- All standard Epic 2 files in `Project Management/Epic 2 - Proof-First Platform Shell/`
- `08_Screenshots/` index and approved screenshot evidence

Frozen governing documents will not change.

## 7. API And Data Impact

### Expected API changes

The preferred implementation uses current API payloads and changes presentation only. No response contract change is assumed.

If current Browse/Discover results cannot distinguish an approved Public Service Video from a service with no public video, an additive proof-summary projection may be proposed only after tracing the existing server-side eligibility source. Any such addition must:

- be computed server-side from existing public eligibility;
- expose no private identifiers or records;
- not infer public status from media presence alone;
- remain backward compatible;
- have explicit public-filtering and authorization tests.

No API field may be removed or repurposed in Epic 2.

### Database impact

- No migration is expected.
- No model, enum, index, seed, or persisted status change is planned.
- No production data backfill is planned.

Discovery of a required data-model change is a scope conflict and approval gate, not an automatic implementation decision.

### Authorization and filtering preservation

- Public routes continue using current server-side public projections.
- Signed-in customer routes continue using customer authorization.
- Vendor, employee, and admin routes retain current role gates.
- Private Service Videos never enter public card props or client payloads.
- Trust Score and review visibility use existing finalized/public states.
- Epic 1 permission state never controls or implies public visibility.

## 8. UX Hierarchy

The following defines direction, not final pixel design. Every page must answer why the user is there, what is happening, what to do, what happens if they do nothing, what happens next, and what stays private when privacy is relevant.

| Page | Purpose and primary message | Actions | States and mobile behavior |
|---|---|---|---|
| Homepage | Explain that Reliance helps people review completed work and distinct trust signals. | Primary: Explore Proof. Secondary: Sign In/Create Account. Escape: Help. | Loading recent proof must preserve the hero. Empty explains proof is still building. Failure keeps navigation usable. Mobile shows brand, one primary CTA, and next section hint. |
| Public Browse | Let signed-out visitors explore Public Service Videos and provider credibility. | Primary: View Proof. Secondary: View provider/Services Offered. Escape: clear filters/Home. | Loading uses stable proof-card skeletons. Empty explains no matching public proof and offers wider filters. Failure preserves filters and retry. No private data. |
| Discover | Give signed-in customers proof-first exploration with account context. | Primary: View Proof. Secondary: save/view provider/contact. Escape: customer Home. | Nearby/location failures must not fabricate results. Mobile filters use a controlled sheet/drawer, not horizontal overflow. |
| Vendor profile | Present the business as a credibility profile. | Primary: View Public Service Video or relevant proof. Secondary: Contact provider/view Services Offered. Escape: return to exploration. | No-proof state distinguishes no public video from loading/error. Long names and service areas wrap cleanly. |
| Service/work-type detail | Explain the work type and show verified proof connected to it. | Primary: View Proof when available. Secondary: Contact/request service. Escape: return to prior exploration route. | No-public-video state remains truthful. Video loading/failure does not expose hidden URLs. Mobile proof precedes request action. |
| Customer shell | Center service history, Service Videos, optional reviews, and proof exploration. | Primary depends on page; navigation remains task-based. Escape: Support/Log Out. | Mobile nav exposes all critical destinations with accessible labels and visible active state. Blocked states identify account/permission issue without vendor tools. |
| Vendor shell | Show what helps the business build customer trust and what action is next. | Primary: current work/credibility action. Secondary: Services Offered/team/settings. Escape: Support/Log Out. | Existing operational states remain. Mobile navigation avoids hidden Manage Jobs or permission actions. |
| Employee shell | Orient the employee to the assigned service and approved recording scope. | Primary: current allowed recording action. Secondary: contact manager/change stage where allowed. Escape: stop/back safely. | Camera/permission blocked states remain canonical. Epic 2 changes shell clarity only. Mobile is the primary viewport. |
| Admin shell | Give operationally precise access to moderation, permissions, reports, and audits. | Primary: current admin task. Secondary: related evidence. Escape: Dashboard/Log Out. | Do not simplify away role/evidence detail. Mobile nav remains usable but desktop is primary. |
| Login/register | Explain account purpose without presenting booking as the product. | Primary: Sign In/Create account. Secondary: correct account type/help. Escape: Home. | Validation is field-specific; policy links preserve form progress; mobile keyboard does not hide primary action. |
| Help | Route users to proof, account, Service Video, permission, and support tasks. | Primary: open task help. Secondary: contact support. Escape: return to previous/account surface. | Empty search offers categories; failure retains support contact. Mobile links remain readable and tappable. |

### 8.1 First-Time Visitor Evaluation Requirement

Epic 2 is not complete until the implemented experience receives a documented first-time visitor comprehension review. This is an evaluation gate, not permission to redesign the approved workflow.

The review applies to the homepage, Explore Proof/Browse, vendor profile, service/work-type detail, login, and customer registration. Signed-in role shells receive the same five-second and cognitive-load review using their intended role perspective.

#### Five-Second Test

Show the page for five seconds, then remove it. Evaluate whether the reviewer can answer:

1. What page was that?
2. What could I do there?
3. What appeared to be the primary action?

If the page purpose or action cannot be identified, rate the page **Needs Improvement** or **Poor** and simplify its hierarchy before Epic 2 closes.

#### Thirty-Second Test

After thirty seconds on a primary public page, evaluate whether a first-time visitor can answer:

1. What is Reliance?
2. Why is Reliance different?
3. What should I do next?
4. What happens after that action?
5. What information remains separate or private?

The homepage passes only when the visitor can express the core idea without coaching: Reliance lets people see real completed work before deciding whom to trust.

#### Proof-Signal Comprehension

The reviewer must be able to distinguish:

- **Service Videos:** approved videos showing completed service stages.
- **Reviews:** genuine customer feedback tied to a service.
- **Reliance Trust Score:** a separate Reliance trust signal based on verified platform activity.
- **Services Offered:** supporting information describing the work a provider performs.

The page fails if these appear to be one combined rating, a marketplace listing, or interchangeable claims.

#### Cognitive Load Review

For each page, record:

- the number of visible primary decisions;
- the number of competing calls to action above the fold;
- whether the user must understand internal terminology;
- whether supporting information competes with the next action;
- whether progressive disclosure would reduce overload.

The target is one obvious primary action and no more than roughly three meaningful top-level choices at a time. More than three is not automatically a defect, but requires a written justification or simplification.

#### Trust Impression

For every reviewed page, answer: **Does this page leave the intended user feeling that Reliance and the represented business are trustworthy without making unsupported claims?**

Trust must come from clear provenance, distinct proof signals, restrained language, privacy boundaries, and predictable actions. It must not come from pressure, synthetic activity, exaggerated metrics, or visual decoration alone.

#### Ratings And Evidence

Rate every reviewed page:

- **Excellent:** purpose, difference, primary action, next step, and proof signals are immediately understood.
- **Good:** core purpose and action are clear; minor hierarchy or wording friction remains.
- **Needs Improvement:** a first-time user may misunderstand the page, proof signals, or next action.
- **Poor:** the page communicates the wrong product model, obscures the primary action, or undermines trust.

The Epic 2 UX Review must include the rating, evidence, cognitive-load count, confusion found, and disposition for every primary page.

Codex will perform a structured heuristic and browser-based replay and will report it honestly. A five-person comprehension study must use actual independent participants and may not be simulated or fabricated. The Product Owner Demo will include a short test script so Cesar can run that field validation. Any page that fails the field test remains open for an evidence-based correction before final Epic acceptance.

## 9. Page-By-Page Language Plan

Final copy will be concise and reviewed against the Language Guide. This section specifies direction, not long legal text.

### Homepage hero and supporting sections

- Brand promise: see real completed work before deciding whom to trust.
- Explain the three signals separately: Public Service Videos, customer reviews, and Reliance Trust Score.
- Primary CTA: **Explore Proof**.
- Supporting CTA: **Create Account** or **Sign In**.
- Replace `posts`, `package`, or marketplace-style count copy with completed-service and Public Service Video language when accurate.
- Preserve the current verified-public filtering and proof-stage showcase.

### Browse / Explore Proof

- Visible page label may become **Explore Proof** while route `/browse` remains stable.
- Lead with Public Service Videos and providers with visible trust information.
- Services Offered are filter/context, not the main object.
- Cards use **View Proof** only when public proof actually exists; otherwise use **View Provider** or **View Services Offered**.
- Empty copy must not imply that private or pending videos should be public.

### Discover

- Treat Discover as the signed-in version of proof exploration.
- Use **Explore Proof** as the visible task label if approved during implementation review, while preserving `/discover`.
- Keep saved preferences, favorites, and genuine location context.
- Do not claim nearby results when location is unavailable.

### Vendor profile

- Present provider identity and public status first.
- Then show distinct proof summary, Trust Score maturity, recent Public Service Videos, customer reviews, and Services Offered.
- Never blend provider claims, reviews, and Trust Score into one vague rating.
- Contact remains available after trust context.

### Service/work-type page

- Frame the service as a work type connected to completed examples.
- Use **Public Service Video** and **View Proof** where a verified public video exists.
- Remove visible `listing` language.
- Keep request/contact features secondary and do not remove routes.
- Avoid urgency or activity claims unless values are real and correctly scoped.

### Customer dashboard shell

- Lead with service records, Service Videos, review availability, and proof exploration.
- Use **My Service Records**, **Service Videos**, and **Explore Proof**.
- Do not expose `booking`, model IDs, or internal permission terms.

### Vendor dashboard shell

- Lead with trust-building state: active work, Service Videos needing action, approved public content, reviews, and verified metrics.
- Keep **Manage Jobs** where it is the vendor's ordinary operational language.
- Keep **Services Offered** as the service-menu concept.

### Employee dashboard shell

- Lead with the assigned service, current approved stage, and whether recording is ready or blocked.
- Use **Assigned service**, **approved recording area**, **Audio is off**, and exact stage names.
- Never expose media-session, geofence, token, or enum terminology.

### Admin dashboard shell

- Keep precise operational language: Permission Audit, Media Moderation, Review Moderation, Reports, Audit Logs.
- Replace only verified marketplace/listing labels with terms matching actual admin function.
- Do not reduce evidence detail or role specificity.

### Login

- Position sign-in as returning to Service Videos, service history, and account tools.
- Do not promise bookings as the primary benefit.
- Keep account security behavior unchanged.

### Customer registration

- Explain a free customer account as the place to view service history, Service Videos, optional reviews, and explore public proof.
- Keep policy acceptance and SMS choices behaviorally unchanged.

### Vendor registration

- Explain that vendors turn completed work into customer-visible credibility through approved Service Videos, genuine reviews, and Trust Score evidence.
- Do not promise leads, bookings, or ranking outcomes.

### Footer

- Replace the visible Browse label with the approved proof-exploration label.
- Keep Help, Sign In, customer/vendor registration, policies, and support email available.
- Preserve direct policy routes and registration-safe return behavior.

### Help Center entry points

- Use task questions: viewing proof, finding Service Videos, understanding Trust Score, contacting a provider, managing a Service Record, and getting account help.
- Do not rewrite detailed consent/legal guidance in this epic.

## 10. Navigation Plan

### Signed-out

Proposed visible order:

1. Home
2. Explore Proof, route `/browse`
3. Help
4. Sign In
5. Create Account

### Customer

Proposed visible order:

1. Home
2. Explore Proof, route `/discover`
3. My Service Records
4. Favorites
5. Reviews
6. Profile & Settings
7. Secure Account
8. Support & Help

### Vendor

Preserve the current operational order unless usability testing shows a clear issue:

1. Dashboard
2. Analytics & Trust
3. Reviews
4. Service Video Activity
5. Services Offered
6. Profile & Settings
7. Manage Jobs
8. Employees
9. Support & Help

The visible labels already largely fit the vendor audience. Epic 2 should focus on mobile completeness, active states, and header hierarchy rather than unnecessary renaming.

### Employee

The employee experience is a focused work link rather than a broad administrative dashboard. Its shell should expose only:

1. Assigned service/current stage
2. Recording status and approved scope
3. Safe exit/back action
4. Contact manager/help where supported

Epic 2 must not add vendor or customer navigation to the employee link.

### Admin

Preserve role-specific operational destinations. Candidate terminology correction:

- `Promoted Listings` may become **Featured Proof Placements** if the current route truly manages proof placements.
- `Publish Management` may become **Public Content Management** if that accurately names its current function.

No route or admin capability changes. Labels must be decided only after reading the page behavior.

### Navigation behaviors that remain unchanged

- Stable hrefs and inbound deep links.
- Authentication and role guards.
- Account switching behavior.
- Back-link query compatibility.
- Legal/support destinations.
- Log-out behavior.

## 11. Accessibility And Responsive Plan

### Keyboard and focus

- Every header, footer, sidebar, mobile-navigation, filter, tab, and CTA is keyboard reachable in logical order.
- Visible focus meets contrast requirements and is not clipped.
- Route changes and dynamic results provide a useful focus destination.
- No keyboard trap in mobile filters, menus, or media controls.

### Screen-reader names and state

- Icon buttons have explicit accessible names.
- Navigation landmarks are distinct by role and viewport.
- Active navigation uses both visual and programmatic state.
- Loading, error, empty, and status changes use appropriate live announcements without repeating whole pages.
- Images and Service Video previews use specific alt/labels; decorative assets remain hidden.

### Contrast and theme

- Text, chips, cards, inputs, focus rings, and banners meet WCAG AA on affected surfaces.
- Status color is never the sole carrier of meaning.
- Existing dark signed-in theme remains coherent; public light/dark sections remain readable.

### Responsive behavior

- Verify at narrow mobile, standard mobile, tablet, laptop, desktop, and wide desktop widths.
- Replace horizontal decision/navigation overflow where it hides destinations.
- Use a drawer, compact menu, or established mobile bar based on existing component patterns.
- Fixed-format proof cards, media previews, and icon buttons use stable dimensions and responsive constraints.
- Long business names, service names, support text, and status labels wrap without overlap.
- Primary actions remain visible above or near the relevant decision content.

### Empty/failure/blocked states

- Stable dimensions prevent layout jumps between loading and loaded states.
- Failure text names what could not load, preserves known state, and offers a real recovery action.
- Blocked states name the role/account requirement without showing another role's controls.
- Empty states do not fabricate proof or imply that private content is missing public content.

## 12. Security And Regression Considerations

Epic 2 must not:

- broaden anonymous or signed-in access;
- send private Service Video data to public clients;
- weaken customer, vendor, employee, or admin authorization;
- alter permission lifecycle or recording eligibility;
- infer permission from UI metadata;
- alter recording gates or media-session creation;
- create, edit, moderate, or infer reviews;
- change Trust Score values or inputs;
- change publication approval or moderation decisions;
- make any media Public;
- undo Epic 1 canonical server-side recording decisions;
- expose internal IDs, raw tokens, OTPs, schema names, or diagnostics.

### Primary regression risks

1. Shared navigation changes can break back links or active states.
2. Proof-first card changes can accidentally treat any media as Public.
3. Reordering page sections can change lazy-loading or interaction timing.
4. Mobile navigation can hide role-critical actions.
5. Terminology replacement can corrupt legitimate operational meanings such as employee availability or business schedules.
6. Service-page CTA hierarchy changes can break existing service-request links.
7. Additive API projections can expose private fields if not built from established public selectors.

Each risk requires a named regression test and screenshot or trace where applicable.

## 13. Test Plan

### Repository and content checks

- Targeted scan of active rendered strings for marketplace, booking-first, listing, Public/Private proof object labels, internal model terms, raw errors, and conflicting Browse labels.
- Classify every remaining match as internal, legitimate operational context, test/history, or unresolved visible issue.
- Snapshot/content tests for public header/footer and role navigation.

### Route and interaction tests

- Homepage links and first-viewport content.
- Signed-out Explore Proof to Browse, proof card, vendor profile, service/work-type page, Help, auth, and back navigation.
- Signed-in customer Explore Proof, favorites, Service Records, vendor/profile links, and log out.
- Vendor sidebar/mobile navigation and unchanged Manage Jobs/permission access.
- Employee secure-link shell and unchanged blocked/allowed recording status.
- Admin sidebar/mobile navigation and unchanged role protection.

### Authorization and privacy regression

- Anonymous user cannot receive Private Service Video or private service-record fields.
- Customer cannot access another customer's private record.
- Vendor cannot access another vendor's operational data.
- Employee link remains limited to the assigned work record.
- Non-admin cannot access admin routes.
- Public cards display only server-approved Public Service Videos/reviews/Trust Score information.

### Responsive and accessibility

- Playwright viewport suite for all affected routes.
- Automated accessibility checks on representative public and role pages.
- Manual keyboard path for headers, menus, filters, cards, and auth.
- Focus visibility, zoom, long-text, reduced-motion, and status-announcement review.

### First-time visitor comprehension

- Five-second evaluation for every primary public page and each role shell.
- Thirty-second evaluation for homepage, Explore Proof/Browse, vendor profile, and service/work-type detail.
- Proof-signal comprehension check for Service Videos, reviews, Trust Score, and Services Offered.
- Cognitive-load count and primary-action review.
- Trust-impression assessment grounded in visible evidence and privacy clarity.
- Product Owner five-person field-test script; do not fabricate participant results.

### Epic 1 regression

- Vendor permission request remains available and canonical.
- Pending, declined, expired, wrong-recipient, superseded, and no-channel states remain locked.
- Allowed permission does not bypass unrelated assignment/location gates.
- Employee camera and media-session APIs still use canonical server decision.
- Admin Permission Audit remains accessible and accurate.
- No review, rating, Trust Score input, publication approval, or Public Service Video is created from permission events.

### Quality gates

- Relevant unit/component tests.
- Relevant integration tests.
- Public and four-role Playwright tests.
- Type checking.
- Linting.
- Production build.
- Security/authorization tests.
- Full applicable golden-journey regression.

Only executed commands and actual results may be reported.

## 14. Screenshot Plan

Every image must be indexed by commit, route, role, state, viewport, fixture, and whether data is synthetic/redacted.

### Before/after pairs

- Homepage first viewport.
- Public header/footer.
- Browse/Explore Proof.
- Signed-in Discover.
- Vendor credibility profile.
- Service/work-type detail.
- Any role navigation with a material label or mobile behavior correction.

Pairs are included only when the same state and viewport can be reproduced reliably.

### Desktop and mobile happy paths

- Homepage.
- Browse/Explore Proof.
- Discover.
- Vendor profile.
- Service/work-type detail.
- Customer shell.
- Vendor shell.
- Employee shell.
- Admin shell.
- Login and both registration modes.
- Help entry point and footer.
- Mobile navigation open and active.

### Non-happy states

- Loading proof cards.
- Empty Browse/Discover result.
- Public data failure with recovery.
- Customer/vendor/admin access blocked.
- Employee recording blocked, without changing Epic 1.
- Long-text and narrow-mobile state.
- Focus-visible and zoom evidence where a screenshot adds value.

Screenshots are evidence, not a substitute for accessibility or authorization tests.

## 15. Product Owner Demo Checklist

### Signed-out visitor

1. Open the homepage in a signed-out browser.
2. Confirm the first viewport says what Reliance is, what proof can be reviewed, and the next action.
3. Open the public navigation on desktop and mobile.
4. Select **Explore Proof** and confirm the URL remains compatible with `/browse`.
5. Open a result with a real approved Public Service Video and select **View Proof**.
6. Confirm the Service Video, review context, Trust Score, provider information, and Services Offered remain distinct.
7. Open the vendor profile and confirm credibility/proof appears before the service menu when proof exists.
8. Open a service/work-type page and confirm proof is primary while contact/request remains available as a secondary action.
9. Test Home, Help, Sign In, Create Account, policy, support, and back links.

### Customer

1. Sign in with the controlled beta customer account.
2. Confirm customer navigation contains no vendor/admin destinations.
3. Open Explore Proof, a vendor, and a service/work-type page.
4. Confirm private records never appear in public exploration.
5. Open My Service Records, Reviews, Profile & Settings, Secure Account, and Support.
6. Confirm current service-request and Service Record behavior still works.

### Vendor

1. Sign in with the controlled beta vendor account.
2. Confirm Dashboard, Analytics & Trust, Reviews, Service Video Activity, Services Offered, Manage Jobs, Employees, and Support remain available.
3. Confirm the shell explains trust-building state without promising bookings or leads.
4. Open Manage Jobs and confirm Epic 1 permission states/actions are unchanged.
5. Open the public vendor profile and compare it with the vendor's Public content.

### Employee

1. Open a controlled assigned-service link on mobile.
2. Confirm the employee sees only assigned-service, scope, stage, and safe help/exit information.
3. Replay one blocked and one allowed Epic 1 state.
4. Confirm shell changes do not unlock recording or expose other role navigation.

### Admin

1. Sign in with the controlled admin account.
2. Confirm operational navigation labels accurately describe their current pages.
3. Open Permission Audit, Media Moderation, Review Moderation, Reports, and Audit Logs.
4. Confirm no operational evidence or controls were removed by shell changes.
5. Confirm a non-admin still receives an admin-access block.

### Expected system evidence

- **Notifications:** No new notification trigger or content behavior from Epic 2.
- **Dashboard updates:** Presentation/navigation only; values and calculations remain the same.
- **Database state:** No schema or data migration and no new persisted activity from navigation alone.
- **Admin state:** Same permissions and evidence, clearer labels only.
- **Customer state:** Same account and Service Records; proof exploration is clearer.
- **Vendor state:** Same work, services, employees, permissions, and metrics.
- **Employee state:** Same assignment and recording gates.
- **Trust Score:** No value or input changes.
- **Reviews:** No creation, eligibility, visibility, or moderation changes.
- **Audit history:** Navigation/content viewing creates no fabricated consequential decision.
- **Screenshots:** Verify every route/state listed in Section 14.

### First-time visitor field test

1. Recruit five people who have not been trained on Reliance.
2. Show each person the homepage for thirty seconds without explanation.
3. Ask: **What does Reliance do? Why is it different? What would you do next?**
4. Show Explore Proof, a vendor profile, and a service/work-type page for five seconds each.
5. Ask what each page was and what action was available.
6. Ask the participant to distinguish Service Videos, reviews, Reliance Trust Score, and Services Offered.
7. Record the participant's words without prompting or correcting them.
8. The homepage does not pass if participants primarily describe Reliance as a booking site, marketplace, or service directory.
9. Store only anonymous summarized findings; do not collect unnecessary personal data.

## 16. Regression Statement Plan

The final Engineering Report must include the required `REGRESSION STATEMENT` with these subsections:

### Existing functionality intentionally preserved

- Public/private filtering.
- Existing service-request/contact pathways.
- Role-specific navigation destinations and deep links.
- Service Video playback and access.
- Genuine reviews and Trust Score displays.
- Epic 1 permission and recording-gate behavior.

### Existing functionality intentionally unchanged

- Authentication/session architecture.
- Database schema and stored records.
- Permission, recording, review, notification, publication, retention, and deletion workflows.
- Trust Score calculation and moderation decisions.

### Areas verified unaffected

- Public APIs and filtering.
- Customer, vendor, employee, and admin authorization.
- Back/return links.
- Mobile employee recording flow.
- Admin Permission Audit.

### Potential regression risks reviewed

- Shared layout blast radius.
- Public proof eligibility leakage.
- Broken route compatibility.
- Mobile hidden controls.
- Incorrect global terminology replacement.
- Service-request CTA breakage.

### Known unrelated issues

List only issues observed and proven unrelated. Do not silently fix or fold them into Epic 2.

## 17. Business Value Delivered

### Customers

- Understand that Reliance helps them review completed work before deciding whom to trust.
- Can distinguish Public Service Videos, customer reviews, Trust Score, and provider information.
- Can still contact or request service after reviewing proof.
- See that private account records remain separate from public exploration.

### Vendors

- Understand how completed work, approved Service Videos, genuine reviews, and Trust Score build credibility.
- Retain current operational tools without marketplace-style promises.
- Present a public credibility profile rather than only a service catalog.

### Employees

- See the assigned service, approved scope, current recording status, and next safe action without unrelated product navigation.
- Experience no change to recording authority or work behavior.

### Admins

- Navigate operational tools with labels that match their actual purpose.
- Retain complete evidence, moderation, audit, and reporting capabilities.

## 18. Technical Debt Risk

| Likely compromise | Why it may remain | Risk | Treatment |
|---|---|---|---|
| `/browse`, `/discover`, and `/booking` route names | Stable links and compatibility are more important than cosmetic URLs. | Low if labels are clear; medium if internal names leak. | Keep routes; test labels and deep links. |
| Internal marketplace variable/CSS/test names | Renaming adds broad churn with no user value. | Low. | Leave unless rendered or blocking maintenance. |
| Separate public Browse and signed-in Discover implementations | Current product supports different contexts. | Duplicate copy/component drift. | Share components only when it removes real duplication without changing behavior. |
| Employee lacks a conventional full dashboard layout | Current experience is a focused secure work link. | First-time orientation may be weaker. | Improve focused shell only; do not invent employee account architecture. |
| Public service payload may be service-first | Existing API may not expose enough approved proof summary. | UI cannot truthfully lead with proof. | Prefer existing safe fields; propose additive projection only if proven necessary. |
| Legacy oversized radii/marketing composition | Current visual system is established. | Inconsistent operational feel or mobile density. | Correct only affected shell usability; avoid unrelated redesign. |
| Admin marketplace-oriented labels | Some may reflect real legacy functions. | Misleading admin mental model. | Inspect function before renaming; preserve routes/capabilities. |

Any debt accepted at completion must be recorded in `05_Technical_Debt.md` with target epic and consequence.

## 19. Estimated Implementation Sequence

1. **Baseline checkpoint**  
   Record branch, commit, worktree, deployment baseline, and unrelated changes to preserve.

2. **Rendered-language inventory**  
   Reproduce all affected routes in current beta/local build, classify visible conflicts, and save before captures. Do not edit internal-only terms.

3. **Shared terminology and navigation contract**  
   Finalize the small approved label map by role, route destination, active-state rule, mobile behavior, and Help destination.

4. **Public shell**  
   Update header, footer, homepage, auth shell, and Help entry points. Verify signed-out links before moving on.

5. **Browse and Discover complete experience**  
   Reframe hierarchy and cards around existing public proof. Reuse existing APIs unless a narrowly additive safe field is proven necessary.

6. **Vendor and service/work-type public pages**  
   Reorder credibility/proof and keep Services Offered/contact as supporting context. Verify public filtering after each route.

7. **Customer shell**  
   Apply the approved proof-exploration label, responsive navigation, return labels, and affected states without changing account behavior.

8. **Vendor shell**  
   Correct hierarchy and responsive navigation only where verified necessary. Replay Epic 1 Manage Jobs states immediately.

9. **Employee shell**  
   Improve focused orientation, mobile behavior, and blocked-state readability without altering recording logic.

10. **Admin shell**  
    Correct only labels proven inconsistent with actual page function. Preserve every role gate and operational control.

11. **Accessibility and responsive hardening**  
    Run automated and manual checks, then fix affected Critical/High issues without unrelated refactors.

12. **Regression and privacy validation**  
    Run route, authorization, public/private, role, Epic 1, Trust Score, review, type, lint, build, and golden-journey tests.

13. **Evidence and honest UX review**  
    Capture screenshot matrix, complete the four-role critique and journey summaries, and identify any first-time-user confusion.

14. **Documentation and checklist**  
    Update only affected checklist rows based on evidence; complete all Epic 2 Project Management records and Dashboard.

15. **Scoped Git checkpoint**  
    Review diff/status, commit only Epic 2 implementation and approved documentation, push current branch, and report actual results.

Estimated complexity: **Large**.  
Estimated risk: **Medium**, primarily from shared layouts and public filtering.  
Expected migration count: **0**.  
Expected file impact: approximately **25-45 files**, reduced when current surfaces already conform.  
Expected screenshot count: approximately **20-30 indexed captures**, plus only practical comparable before/after pairs.

## 20. Approval Gate

This document authorizes no implementation by itself.

Before code changes begin, the Product Owner must approve:

1. The preserve-first scope.
2. The visible navigation direction, especially **Explore Proof** versus **Explore Public Proof**.
3. The rule that stable `/browse`, `/discover`, and `/booking` routes remain unchanged.
4. The proof-first hierarchy while keeping contact/service-request functions secondary and intact.
5. The zero-migration expectation and stop condition for any discovered data-model need.
6. The planned tests, screenshot package, Product Owner Demo, and regression evidence.

Until approval is received:

- do not implement code;
- do not create migrations;
- do not update checklist status;
- do not deploy;
- do not begin Epic 3;
- do not modify frozen governing documents.

After approval, implementation must follow the sequence in Section 19 and stop if a requirement conflicts with a frozen document, requires broader account/session redesign, or could broaden access to private content.
