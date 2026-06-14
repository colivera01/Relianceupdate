# Reliance Product Identity

This document is the source of truth for Reliance product language, public positioning, onboarding, tutorials, UI decisions, and future development planning.

Reliance should be designed, described, and evaluated as a proof-of-service, transparency, and trust platform.

## The Core Statement

**Reliance is a proof-of-service platform that helps customers see real completed work, public service videos, customer reviews, and Reliance Trust Score evidence before deciding whether to trust a provider.**

**Reliance is not a general service marketplace, scheduling app, lead marketplace, payment platform, or service catalog directory.**

## What Reliance Is

Reliance is a trust layer for local service work.

It exists to make service quality more visible by connecting real work records to public proof:

1. Vendor performs work.
2. A job or service record exists.
3. Service video stages document the work.
4. Completed work can become public proof after approval.
5. Customers can leave reviews when eligible.
6. Reliance Trust Score summarizes verified operational signals.
7. Future customers can review public proof before choosing a provider.

Reliance helps answer:

- Has this provider completed real work?
- Can I see examples of the work?
- What do customers say?
- What verified signals does Reliance have?
- Is this provider transparent enough for me to trust?

## What Reliance Is Not

Reliance is not primarily:

- A marketplace where services are the main product.
- A scheduling-first booking platform.
- A payment or checkout platform.
- A lead-selling platform.
- A vendor advertising directory.
- A replacement for vendor business operations.
- A place where providers self-award credibility.

Services, booking, scheduling, and vendor contact can exist inside Reliance, but they must support the proof-of-service mission instead of becoming the main product identity.

## Primary Customer Value

Customers use Reliance to make more confident service decisions.

The customer value is not simply "find a service." The customer value is:

- See real completed work before choosing.
- Compare public service videos, reviews, and Trust Score separately.
- Understand what is verified, what is customer feedback, and what is only provider information.
- Know whether a provider has enough public proof to feel credible.
- Review their own service records, videos, and review eligibility in one place.

Customer-facing pages should answer this first:

**What proof can I see before I trust this provider?**

## Primary Vendor Value

Vendors use Reliance to turn real work into public credibility.

The vendor value is not simply "get listed." The vendor value is:

- Build public proof from completed jobs.
- Show customers real work through approved service videos.
- Earn customer reviews tied to actual service records.
- Build Reliance Trust Score from verified operational history.
- Help future customers understand why the business is credible.
- Improve visibility when the business has proof worth showing.

Vendor-facing pages should answer this first:

**What helps me earn customer trust and grow my business?**

## What Appears Publicly

Public Reliance content should prioritize proof.

Public content may include:

- Public vendor profile.
- Public completed-work examples.
- Approved public service videos.
- Public customer reviews.
- Reliance Trust Score and maturity context.
- Trust evidence summaries.
- Services Offered / Work Types.
- Public service areas and provider details.
- Public promotion placements, when eligible.

Public pages should clearly separate:

- Customer reviews.
- Public service videos.
- Reliance Trust Score.
- Provider-supplied business information.

These should not be blended into one vague trust claim.

## What Remains Private

Private information must stay private unless the user, workflow, and moderation rules explicitly make it public.

Private information includes:

- Customer personal details.
- Customer addresses.
- Customer phone numbers and emails.
- Internal job notes.
- Internal admin review notes.
- Pending, rejected, or private media.
- Consent records.
- Unpublished service videos.
- Non-public service records.
- Admin AI recommendations and red flags.
- Internal Trust Score calculation details that are not intended for public display.
- Payment, billing, or account security information.

Reliance should never imply private work is public proof until the correct approval and visibility steps are complete.

## What Creates Trust Score

Reliance Trust Score is created by verified operational signals, not by provider self-promotion.

Trust Score should be presented as based on existing verified activity such as:

- Verified completed work records.
- Approved service videos.
- Workflow completion signals.
- Video verification signals.
- Validated disputes or issue outcomes.
- Operational history Reliance can verify.

Customer reviews should remain visually and conceptually separate from Trust Score unless the scoring system intentionally includes a review signal later.

Trust Score should never be presented as:

- A star rating.
- A customer popularity score.
- A paid placement score.
- A self-awarded badge.
- A guarantee.

For new or low-history vendors, the public UI should use maturity language such as:

- Early Stage Trust Score.
- Emerging Trust Score.
- Reliance Trust Score.

The score should always include context about how much verified history exists.

## What Creates Reviews

Reviews are created by customer feedback tied to real service activity.

A review should come from:

- A customer associated with a service record or job.
- A completed service flow.
- A review-eligible moment.
- Preferably an approved final-result service video or approved customer-visible proof.

Reviews should communicate customer experience, not operational score math.

Reviews should answer:

- What did the customer experience?
- Was the customer satisfied?
- What feedback did the customer leave?
- Is this review connected to verified work?

Reviews should not be confused with Reliance Trust Score.

## What Creates Public Proof

Public Proof is created when verified work becomes visible to future customers.

Public Proof can include:

- A completed job or service record.
- Approved public service video stages.
- A final-result video or approved media package.
- A customer review tied to eligible work.
- Vendor Trust Score evidence.
- A credibility profile that explains the provider's verified history.

Public Proof requires more than a vendor saying they do good work. It requires evidence that Reliance can display responsibly.

## How Discover Should Work

Discover should be the signed-in customer's proof-first exploration experience.

Discover should help customers:

- Explore providers with public proof.
- See completed work examples.
- Compare service videos, reviews, and Trust Score.
- Save providers or proof examples for later.
- Move toward contact or service request only after trust context is visible.

Discover may use customer context, such as location or saved account details, but it should not fake nearby proof when location or address is unavailable.

Discover should prioritize:

1. Public proof.
2. Vendor credibility.
3. Services Offered as supporting context.
4. Contact or request actions.

Discover should not feel like a generic service catalog.

## How Browse Should Work

Browse should be the public visitor version of proof discovery.

Browse should help signed-out visitors:

- Understand Reliance quickly.
- See public proof examples.
- Compare vendors by proof, not just service category.
- Understand which trust signals exist and which are still building.
- Choose whether to create an account, contact a vendor, or continue exploring.

Browse should eventually default to proof-first cards:

- Completed work.
- Approved public service video.
- Vendor name.
- Service or work type.
- Customer review context.
- Trust Score maturity.
- CTA to view proof or vendor profile.

Services can remain filterable, but services should not be the main public object.

## How Vendor Profiles Should Work

Vendor profiles should be credibility profiles.

A vendor profile should answer:

- Who is this provider?
- What public proof exists?
- What work has been completed?
- What videos can customers see?
- What reviews exist?
- What does Reliance Trust Score say?
- What services or work types does this provider offer?
- What should a customer do next if they are interested?

The recommended profile order is:

1. Vendor identity and public status.
2. Public proof summary.
3. Trust Score maturity and evidence.
4. Recent completed work / public videos.
5. Customer reviews.
6. Services Offered.
7. Contact or request action.

Vendor profiles should not lead with a generic service catalog if proof exists.

## How Services Offered Should Work

Services Offered are supporting context.

They explain what kind of work a vendor performs. They should not be treated as the main product unless Reliance intentionally becomes a marketplace later.

Services Offered should help customers understand:

- What the vendor can do.
- What kind of completed work they should expect to see.
- Which proof examples relate to which type of work.
- Whether the provider's services match the customer's need.

Vendor-facing language should favor:

- Services Offered.
- Work Types.
- Service Menu.
- Public Service Menu.

Avoid making vendors feel like they are managing a complicated marketplace catalog.

## How Jobs Should Work

Jobs are the operational backbone of Reliance.

A job is the record that connects:

- Vendor.
- Customer or client context.
- Employee assignment.
- Service or work type.
- Consent.
- Video stages.
- Review eligibility.
- Moderation.
- Public proof.
- Trust Score evidence.

Customer-facing UI may use softer terms such as:

- Service Record.
- Work Record.
- Service Timeline.
- Completed Work.

Vendor and admin UI can use "Job" because it matches the operational workflow.

Jobs should not be removed. They are central to proof-of-service.

## How Videos Should Work

Videos are proof assets, not social content.

Service videos should show short, approved stages of work so customers can understand what happened without watching an entire job.

Recommended public stage language:

- Starting Condition.
- Work In Progress.
- Final Result.

Videos should be:

- Short.
- Approved when public.
- Muted by default where appropriate.
- Clearly tied to a job or service record.
- Clearly labeled as public, customer-visible, pending approval, rejected, or private.

Videos should answer:

- What was the condition before work?
- What happened during the work?
- What was the final result?

## How Reviews Should Work

Reviews should represent customer feedback connected to real service activity.

Reviews should:

- Open only when the customer is eligible.
- Explain why review access is or is not available.
- Stay separate from Trust Score.
- Be moderated where required.
- Be tied to service records when possible.
- Support customer confidence without pretending to be a mathematical trust score.

Review pages should emphasize:

- Ready to review.
- Waiting for approved proof.
- Submitted reviews.
- Reviews connected to service videos.

## How Trust Score Should Work

Trust Score should communicate verified operational confidence.

Trust Score UI should:

- Show maturity state.
- Show evidence context.
- Explain what signals exist.
- Avoid overemphasizing perfect scores for low-history vendors.
- Separate Trust Score from customer star ratings.
- Explain when more verified work is needed before a public score appears.

Recommended presentation:

- Early Stage Trust Score: limited verified activity.
- Emerging Trust Score: growing verified activity.
- Reliance Trust Score: stronger verified history.

Trust Score should help customers understand reliability, not replace their judgment.

## How Contact Vendor Should Work

Contact Vendor should be a secondary trust-informed action.

Customers should see enough proof context before being pushed to contact a provider.

Contact Vendor should answer:

- Who am I contacting?
- Why might I trust them?
- What public proof have I seen?
- What service or work type am I asking about?
- What happens after I contact them?

Contact Vendor should not feel like a lead-generation trap. It should feel like a clear next step after the customer has reviewed proof.

## Product Language Rules

Use proof-first language:

- Public proof.
- Completed work.
- Service videos.
- Customer reviews.
- Trust Score evidence.
- Services Offered.
- Work Types.
- Service Records.
- Credibility profile.

Use marketplace language carefully:

- Browse.
- Book.
- Booking.
- Marketplace.
- Listings.
- Service catalog.
- Availability.
- Promotions.

These words are allowed only when they accurately describe the current action and do not distract from proof-of-service.

## UI Decision Rule

Every customer-facing page should answer these questions in this order:

1. What can I see?
2. What proof exists?
3. What does Reliance verify?
4. What do customers say?
5. What services does this provider offer?
6. What can I do next?

Every vendor-facing page should answer these questions in this order:

1. Am I visible?
2. What can customers see?
3. What proof have I built?
4. What increases customer trust?
5. What should I do next to grow?

Every admin-facing page should answer these questions in this order:

1. What needs review?
2. What is blocked?
3. What could affect public trust?
4. What requires manual approval?
5. What did AI flag or recommend?

## Development Guardrails

Do not remove current architecture just because the public language changes.

Keep:

- Jobs.
- Services.
- Reviews.
- Trust Score.
- Videos.
- Booking records.
- Consent.
- Moderation.
- Vendor profiles.
- Customer profiles.
- Admin controls.

Reframe before refactoring.

The safest transition path is:

1. Change language and navigation.
2. Make Browse and Discover proof-first.
3. Make service pages supporting context.
4. Make vendor profiles credibility profiles.
5. Later evaluate whether booking and scheduling should remain optional, secondary, or be removed from the customer-facing experience.

## Final Positioning

Reliance exists because customers should not have to choose service providers based only on claims, ads, or star ratings.

Reliance turns completed work into visible proof.

That is the product.
