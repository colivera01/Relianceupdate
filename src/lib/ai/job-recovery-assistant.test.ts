import { describe, expect, it, vi } from "vitest";
import { getJobRecoveryAssistantSuggestion } from "./job-recovery-assistant";
import { runStructuredAiTask } from "./client";

vi.mock("./client", () => ({
  runStructuredAiTask: vi.fn(),
}));

describe("getJobRecoveryAssistantSuggestion", () => {
  it("uses the rejection reason as authoritative correction guidance", async () => {
    vi.mocked(runStructuredAiTask).mockResolvedValue({
      model: "test-model",
      requestId: "req-1",
      responseId: "res-1",
      usage: null,
      data: {
        summary: "There is no rejection reason present.",
        decision: "continue_current_step",
        confidence: "high",
        blockers: [],
        recommendedActions: ["Continue waiting."],
        explainWhy: ["No rejection was found."],
      },
    } as any);

    const result = await getJobRecoveryAssistantSuggestion(
      {
        jobId: "job-1",
        role: "vendor",
        title: "Outlet Installation",
        status: "IN_PROGRESS",
        operationalPhase: "IN_PROGRESS",
        clientName: "Brandon Sims",
        assignedEmployeeNames: ["Bradley Coopers"],
        stageProgress: { INTRO: true, IN_PROGRESS: true, COMPLETED: true },
        consentStatus: "accepted",
        rejectionReason: "Redo stage 3",
        currentWorkflowLabel: "Pending employee corrections",
        currentWorkflowDetail: "Changes requested: Redo stage 3",
      },
      "manager-1"
    );

    expect(result.data.summary).toContain("Redo stage 3");
    expect(result.data.summary).not.toContain("no rejection reason");
    expect(result.data.blockers).toContain("Manager requested changes: Redo stage 3");
    expect(result.data.recommendedActions[0]).toContain("assigned employee");
    expect(result.data.confidence).toBe("medium");
  });
});
