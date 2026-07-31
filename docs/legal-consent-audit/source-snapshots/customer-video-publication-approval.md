# Customer Video and Publication Approval Snapshot

- Original repository paths:
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\consent\[token]\page.tsx`, lines 227-333 and 396-407
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\api\consent\accept\route.ts`, lines 53-221
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\api\admin\media\packages\[bookingId]\moderate\route.ts`, lines 159-238
- Snapshot type: Carefully labeled excerpt
- Production data included: No

## Current customer choice

The consent page identifies the vendor and service request and explains that approval permits the provider to record and share staged service videos.

The customer chooses one of two visibility options:

- **Private**: the current default.
- **Public**: the completed service proof may become public after Reliance moderation.

For a customer-business recording location, the customer must provide a complete business address, which is geocoded and saved as the recording-location snapshot.

The customer must check a box agreeing to the Terms of Service and Privacy Policy before approving. The customer may decline instead.

The accept API stores accepted status/time, policy version strings, IP address, user agent, a document hash, and public/private choice. It also updates the work-record metadata.

Admin package approval applies the customer choice when it is present:

- customer choice `public` produces public visibility;
- customer choice `private` produces private visibility;
- otherwise the admin-selected visibility applies.

## Material limitations

The choice is made before the customer sees the completed recording. It is therefore advance authorization, not final approval of the actual media. Possession of the raw email/SMS link is the only identity proof in the consent action. There is no login, email OTP, signature, verified phone challenge, guardian flow, or later self-service withdrawal/unpublish control.
