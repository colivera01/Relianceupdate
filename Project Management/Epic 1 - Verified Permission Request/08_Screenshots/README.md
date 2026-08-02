# Epic 1 Screenshot Index

Generated binaries remain untracked at:

`C:\Users\Cesar Olivera\Project Reliance\output\epic1-screenshot-package\`

They contain controlled synthetic data and no credentials, raw tokens, OTPs, or real customer data.

| ID  | State                   | Viewport  | Path                                    |
| --- | ----------------------- | --------- | --------------------------------------- |
| D01 | Loading                 | 1440x1000 | `Desktop/01-loading.png`                |
| D02 | Permission education    | 1440x1000 | `Desktop/02-permission-education.png`   |
| D03 | Verification failure    | 1440x1000 | `Desktop/03-verification-failure.png`   |
| D04 | Authority confirmation  | 1440x1000 | `Desktop/04-authority-confirmation.png` |
| D05 | Recording allowed       | 1440x1000 | `Desktop/05-recording-allowed.png`      |
| D06 | Expired / blocked       | 1440x1000 | `Desktop/06-expired-blocked.png`        |
| D07 | Unavailable / empty     | 1440x900  | `Desktop/07-not-available-empty.png`    |
| M01 | Permission education    | 390x844   | `Mobile/01-permission-education.png`    |
| M02 | Wrong-recipient success | 390x844   | `Mobile/02-wrong-recipient-success.png` |

## Visual Review

- Desktop and mobile content is nonblank and correctly framed.
- No incoherent overlap or clipped action text was observed.
- Private starting audience and audio-off status appear before the decision.
- Loading, failure, blocked, empty, success, and recovery states are distinct.
- Mobile is long but scannable; Product Owner should validate copy length on a real phone.

## Live Beta Review - 2026-08-02

The live browser walkthrough reviewed these controlled states without committing screenshot binaries:

- customer authority selection;
- customer recording allowed;
- customer recording declined;
- customer wrong-recipient confirmation;
- vendor cards across Allowed, Declined, Decide later, and Wrong recipient;
- employee recording page for a declined customer-residence record; and
- Admin Permission Audit with masked evidence.

The live review found a critical mismatch not represented by the automated screenshots: a declined customer-residence record could be released and the employee page exposed camera controls. The screenshot package is therefore evidence of individual customer states, not proof that the complete cross-role gate is safe.

## Before/After

No reliable frozen before screenshot of the same legacy request was available. The package avoids a misleading comparison; the engineering report records the verified behavioral difference.
