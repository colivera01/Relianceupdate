import { describe, expect, it } from "vitest";

import { employeeStageSafetyAcknowledgmentsForScope } from "./employee-stage-safety-contract";

function textFor(
  id: "approved_people_only" | "audio_scope_clear",
  input: Parameters<typeof employeeStageSafetyAcknowledgmentsForScope>[0],
) {
  return employeeStageSafetyAcknowledgmentsForScope(input).find((item) => item.id === id)?.text;
}

describe("employee stage safety acknowledgments", () => {
  it("keeps every identifiable person and all audio outside a none/audio-off scope", () => {
    expect(
      textFor("approved_people_only", {
        intentionalParticipantPlan: "none",
        audioAllowed: false,
      }),
    ).toContain("No person is approved to be intentionally identifiable");
    expect(
      textFor("approved_people_only", {
        intentionalParticipantPlan: "none",
        audioAllowed: false,
      }),
    ).toContain("assigned service professional");
    expect(
      textFor("audio_scope_clear", {
        intentionalParticipantPlan: "none",
        audioAllowed: false,
      }),
    ).toBe(
      "Audio is disabled for this Service Order. No voices or other identifying audio will be captured.",
    );
  });

  it("names only the assigned service professional when that is the approved scope", () => {
    expect(
      textFor("approved_people_only", {
        intentionalParticipantPlan: "assigned_service_professional",
        audioAllowed: true,
      }),
    ).toContain("Only the assigned service professional is approved");
    expect(
      textFor("audio_scope_clear", {
        intentionalParticipantPlan: "assigned_service_professional",
        audioAllowed: true,
      }),
    ).toContain("Audio is enabled only within the approved recording scope");
  });
});
