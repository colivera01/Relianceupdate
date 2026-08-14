import { describe, expect, it } from "vitest";
import { recordingRequirementFields, recordingRequirementSelection } from "./recording-scope-presentation";

describe("recording requirement presentation mapping", () => {
  it("maps Yes to the existing canonical required-recording fields", () => {
    const fields = recordingRequirementFields(true);
    expect(fields).toEqual({
      serviceCanContinueWithoutRecording: false,
      essentialPrivateRecording: true,
    });
    expect(recordingRequirementSelection(fields)).toBe("required");
  });

  it("maps No to the existing canonical optional-recording fields", () => {
    const fields = recordingRequirementFields(false);
    expect(fields).toEqual({
      serviceCanContinueWithoutRecording: true,
      essentialPrivateRecording: false,
    });
    expect(recordingRequirementSelection(fields)).toBe("optional");
  });

  it("does not translate contradictory legacy field combinations into a customer-facing answer", () => {
    expect(
      recordingRequirementSelection({
        serviceCanContinueWithoutRecording: true,
        essentialPrivateRecording: true,
      }),
    ).toBeNull();
  });
});
