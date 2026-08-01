# Epic 1 UX Review

**Epic:** Verified Permission Request
**Build reviewed:** Epic 1 working tree at 2026-07-31
**Status:** Reviewed; ready for Product Owner demo after beta deployment prerequisites

## Customer

| Question              | Observation                                                                                                   | Severity | Evidence                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------ |
| Why am I here?        | The title and service/vendor summary explain that the customer controls whether this service may be recorded. | None     | Desktop/mobile education screenshots |
| What is happening?    | Three stages, audio-off state, and Private starting audience appear before any decision.                      | None     | `02-permission-education.png`        |
| What do I need to do? | Verification comes first; authority and Allow/Decline appear only after identity verification.                | None     | `04-authority-confirmation.png`      |
| What if I do nothing? | The request expires and recording remains locked; waiting is not framed as a penalty.                         | Low      | Education screen                     |
| What happens next?    | Success explains that recording may begin and completed proof starts Private.                                 | None     | `05-recording-allowed.png`           |
| What stays private?   | Public sharing is repeatedly identified as a separate later decision.                                         | None     | Education/success screens            |
| Anxiety/recovery      | Decline, later, wrong recipient, expired, and unavailable states are direct and non-accusatory.               | None     | State screenshots                    |

**Honest observation:** The mobile education page is long because it educates before asking. It remains scannable, but a first-time customer must scroll. Product Owner should validate the amount of explanation on a real phone.

## Vendor

- The job card shows canonical permission and delivery state rather than asking a manager to represent the customer.
- Masked recipients protect contact data while permitting correction.
- Delivery failure, wrong recipient, and missing channel identify the next recovery action.
- The vendor cannot see raw action links, OTPs, or decision-session data.
- Remaining risk: real beta data may make the job card dense; a live first-time vendor walkthrough remains required.

## Employee

- Recording is visibly locked when delivery, identity, authority, or permission is uncertain.
- Camera access is withheld rather than failing after capture.
- Copy explains the missing gate without exposing private recipient/evidence details.
- Remaining risk: escalation wording needs validation on the assigned employee's real mobile device.

## Admin

- Permission Audit is read-only and shows actor/authority, content version, decision, lifecycle, and delivery evidence.
- It has no override that substitutes an admin decision for the authority holder.
- Remaining risk: a controlled live record is needed to confirm scanability and provider/timestamp formatting.

## Cross-Role Consistency

- Canonical status is consistent.
- Permission never implies Public.
- Audio remains off.
- Failure locks recording.
- Notifications and dashboards derive from the same state.
- Customer receives service context; vendor sees masks/status; employee sees the gate; admin sees authorized evidence.

## Journey Summaries

### Customer

The customer learns why recording is requested and what remains Private, verifies through a matching account or available channel, confirms authority, and chooses Allow, Decline, Decide later, or Wrong recipient. Uncertainty never unlocks recording.

### Vendor

The vendor creates an eligible work record. Reliance creates one request, attempts available channels, and shows masked delivery/status. The vendor can resend or correct contact information but cannot make the customer's decision.

### Employee

The assigned employee receives camera access only after a current verified Allow decision. Pending, failed, expired, wrong-recipient, superseded, or unsupported authority remains blocked.

### Admin

An authorized admin can inspect durable permission and delivery evidence. Admin cannot change the decision or broaden visibility.

## Blocking UX Findings

No code-level blocking confusion was found in the controlled customer flow. Live vendor, employee, admin, and provider walkthroughs remain Product Owner validation items.

## UX Verdict

**Result:** Controlled flow meets Epic 1 UX intent.
**Blocking confusion remains:** None in automated screenshot states; live-role validation pending.
**Ready for Product Owner demo:** Yes, after migrations and controlled provider configuration.
