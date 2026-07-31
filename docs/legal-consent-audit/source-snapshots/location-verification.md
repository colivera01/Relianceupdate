# Location Verification Logic Snapshot

- Original repository paths:
  - `C:\Users\Cesar Olivera\Project Reliance\src\lib\job-recording-location.ts`, lines 1-205
  - `C:\Users\Cesar Olivera\Project Reliance\src\lib\geocoding.ts`, lines 1-221
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\api\employee\jobs\[jobId]\verify-location\route.ts`, full file
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\media\sessions\route.ts`, lines 210-300
- Snapshot type: Carefully labeled excerpts
- Production data included: No

## Current server rules

```text
Verification radius: 150 meters
Maximum accepted device accuracy: 500 meters
Distance test: max(0, measured distance - reported accuracy) <= 150 meters
```

For vendor-business and customer-business paths, the server requires numeric latitude, longitude, and accuracy. It resolves the immutable work-order location snapshot first. If no usable snapshot exists, it falls back to current vendor/customer-business coordinates where supported.

Vendor addresses may be geocoded through Mapbox or the U.S. Census geocoder, depending on environment configuration. Customer-business addresses are supplied during consent, geocoded, and saved to the work-order snapshot.

The residence path requires accepted customer consent but does not enforce device proximity. The customer-business path enforces both accepted consent and proximity. The vendor-business path enforces proximity without customer consent.

## Evidence and privacy limitations

- The work-order metadata stores the target address/coordinates and verification-related state.
- The session-creation route evaluates the submitted device coordinates server-side.
- No standalone immutable location-proof model, cryptographic device attestation, spoof-detection service, or complete history of every rejected location attempt was found.
- The current Privacy Policy does not separately identify precise location collection or the address-geocoding providers.
