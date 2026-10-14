---
content_key: reliance.customer-package-visibility
content_class: PUBLIC_CHOICE
audience_role: CUSTOMER
version: reliance-customer-package-visibility-2026-10-13-draft.3
supersedes_version: reliance-customer-package-visibility-2026-10-12-draft.2
governance_status: DRAFT
review_state: PRODUCT_OWNER_REVIEW
runtime_effective: false
counsel_approved: false
language: en-US
---
# DRAFT / PRODUCT OWNER REVIEW

> Not effective. Not counsel-approved. This draft does not change any current visibility decision or Public state.

## PROSPECTIVE USER-FACING COPY
<!-- BEGIN PROSPECTIVE USER-FACING COPY -->
# Customer Service Video visibility choices

## Private

**Status:** Private

Your complete Service Video is not publicly visible. Access is limited to authorized Private Proof surfaces and authorized Reliance operational or administrative access. Starting Condition, Work in Progress, and Final Result stay together as one exact package.

If the exact package is not eligible for Public display:

**Private only:** This Service Video is available as Private Proof but is not eligible for Public display.

## Share Publicly

**Title:** Make this Service Video public?

**Confirmation text:** Your complete Service Video - Starting Condition, Work in Progress, and Final Result - will become publicly viewable on Reliance after you confirm and Reliance verifies every current requirement. People outside Reliance may view, copy, screen-record, download, or redistribute Public content. Reliance cannot guarantee removal of copies made outside its systems.

When the package contains authorized audio:

**Audio warning:** This Service Video contains audio. If you continue, the approved video and its authorized audio will become publicly viewable and may be copied or redistributed outside Reliance.

**Required checkbox:** I understand that I am making the complete exact Service Video Public and that copies made outside Reliance may remain even if I later make it Private.

**Confirmation button:** Confirm Share Publicly

If another required permission is incomplete:

**Status:** Waiting for Public-sharing permission

Your Service Video remains Private until all required permissions are complete.

## Public

**Status:** Public

Your complete Service Video is publicly viewable on Reliance.

## Make Private

**Title:** Make this Service Video private?

**Confirmation text:** Reliance will remove this complete Service Video from its controlled Public surfaces after you confirm and Reliance completes the change. You will keep access through Private Proof. Copies previously made outside Reliance may remain, and Reliance cannot retrieve or delete those outside copies.

**Required checkbox:** I understand that Make Private stops new Public access through Reliance but may not remove copies already made elsewhere.

**Confirmation button:** Confirm Make Private

If you later choose Share Publicly again, Reliance will recheck all current requirements. An earlier authorization or permission is not permanently valid.
<!-- END PROSPECTIVE USER-FACING COPY -->

## INTERNAL ACTIVATION NOTES - NOT USER-FACING
<!-- BEGIN INTERNAL ACTIVATION NOTES -->
- Share Publicly must revalidate the authenticated owning Customer, active Private Proof grant, exact Admin PASS, Public-display eligibility, exact package and all stage identities/hashes, required participant permissions, active media, restrictions, and absence of a superseding package.
- Customer confirmation cannot override another person's required Public permission. Public status appears only after the authoritative server transaction succeeds.
- Make Private must remove controlled Public/Browse visibility while preserving Private Proof and immutable visibility history.
- Each choice must bind Customer, booking, exact package/stage-set identity, audio/outside-copy disclosures, exact publishable snapshot/version/hash, request evidence, timestamp, and immutable evidence hash.
- Preserve historical visibility contracts and all prior decisions. Republish requires fresh current-state validation.
- Counsel review of the Public-display license and outside-copy disclosure remains required.
- This internal section is excluded from the accepted text snapshot. No current visibility state is changed by this draft.
<!-- END INTERNAL ACTIVATION NOTES -->
