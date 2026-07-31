# Recording and Upload API Enforcement Snapshot

- Original repository paths:
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\media\sessions\route.ts`, lines 170-365
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\media\upload\init\route.ts`, lines 15-121
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\media\upload\proxy\route.ts`, lines 10-101
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\media\upload\complete\route.ts`, lines 18-345
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\api\employee\jobs\[jobId]\stage\route.ts`, lines 1-110
- Snapshot type: Carefully labeled excerpts
- Production data included: No

## Enforced controls

- Upload and session APIs require an active vendor membership or a valid employee capture token.
- The capture token is bound to vendor, work record, employee membership, active employee status, and current assignment.
- Staged sessions require a valid work record and assigned employee.
- Residence and customer-business paths require accepted consent.
- Vendor-business and customer-business paths require server-side location verification.
- Upload initialization checks storage quota and returns a time-limited Azure SAS URL.
- The proxy fallback limits payload size to 80 MB, restricts the blob-key namespace, and requires a video MIME type.
- Completion requires staged files to be video, requires a declared duration, downloads the blob, probes duration server-side, and rejects clips longer than 30 seconds or clips whose duration cannot be verified.
- New media defaults to `pending_review`, `private`, `active`, and not deleted.
- Stage completion requires a non-deleted media asset.

## Partial or missing controls

- The browser camera uses `audio: false`; there is no audio recording path in the current employee workflow.
- A native file-input fallback can allow selection of an existing video depending on browser behavior, so all clips are not cryptographically proven to have been captured live.
- No malware scan, content hash, capture-time signature, hardware attestation, watermark, or chain-of-custody signature was found.
- The initial blob-property check can continue with a warning. Staged videos then undergo a required blob download and server-side duration probe, which rejects missing or unreadable staged media. Non-staged completion can still reach metadata creation after the warning.
- A blob uploaded before completion fails can remain without a `MediaAsset` row; no orphan cleanup scheduler was found.
- No offline queue or headset buffer synchronization exists in this web implementation.
