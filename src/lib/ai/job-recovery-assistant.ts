import { z } from "zod";
import { runStructuredAiTask } from "./client";
import { JOB_RECOVERY_ASSISTANT_PROMPT_VERSION } from "./prompt-registry";
import {
  jobRecoveryAssistantResultSchema,
  type JobRecoveryAssistantResult,
} from "./schemas";

export const jobRecoveryAssistantRequestSchema = z.object({
  jobId: z.string().min(1),
  role: z.enum(["vendor", "employee"]),
  title: z.string().min(1).max(180),
  status: z.string().min(1).max(80),
  operationalPhase: z.string().max(80).nullable().optional(),
  clientName: z.string().max(180).nullable().optional(),
  assignedEmployeeNames: z.array(z.string().min(1).max(160)).max(8).default([]),
  stageProgress: z
    .object({
      INTRO: z.boolean(),
      IN_PROGRESS: z.boolean(),
      COMPLETED: z.boolean(),
    })
    .nullable()
    .optional(),
  consentStatus: z.string().max(80).nullable().optional(),
  rejectionReason: z.string().max(600).nullable().optional(),
  currentWorkflowLabel: z.string().max(180).nullable().optional(),
  currentWorkflowDetail: z.string().max(500).nullable().optional(),
});

export type JobRecoveryAssistantRequest = z.infer<
  typeof jobRecoveryAssistantRequestSchema
>;

function buildInput(context: JobRecoveryAssistantRequest): string {
  return [
    "Reliance job recovery guidance request.",
    "Important scope: help the current vendor or employee understand the next safest workflow step.",
    "Do not invent permissions, backend changes, or hidden approvals.",
    "",
    `Job ID: ${context.jobId}`,
    `Viewer role: ${context.role}`,
    `Job title: ${context.title}`,
    `Status: ${context.status}`,
    `Operational phase: ${context.operationalPhase || "Unknown"}`,
    `Client name: ${context.clientName || "Unknown"}`,
    `Assigned employees: ${context.assignedEmployeeNames.length ? context.assignedEmployeeNames.join(", ") : "None"}`,
    `Consent status: ${context.consentStatus || "Unknown"}`,
    `Current workflow label: ${context.currentWorkflowLabel || "Unknown"}`,
    `Current workflow detail: ${context.currentWorkflowDetail || "Unknown"}`,
    `Rejection reason: ${context.rejectionReason || "None"}`,
    `Stage progress: ${
      context.stageProgress
        ? `before=${context.stageProgress.INTRO ? "yes" : "no"}, during=${context.stageProgress.IN_PROGRESS ? "yes" : "no"}, completed=${context.stageProgress.COMPLETED ? "yes" : "no"}`
        : "Unavailable"
    }`,
  ].join("\n");
}

const INSTRUCTIONS = `
You are the Reliance AI Job Recovery Assistant.

Your job is to explain the next best recovery step when a vendor or employee is blocked, unsure, or rejected inside the job workflow.

Constraints:
- Recommendation only.
- Stay grounded in the supplied workflow status.
- Prefer one clear next action over a long checklist.
- If the workflow is awaiting review or manager/admin action, explain that plainly instead of pretending the user can bypass it.
- If a rejection reason exists, use it directly.

Output requirements:
- Return valid JSON only.
- Explain why should reduce confusion, not restate internal system language.
`.trim();

export async function getJobRecoveryAssistantSuggestion(
  context: JobRecoveryAssistantRequest,
  actorUserId: string
) {
  const result = await runStructuredAiTask({
    feature: "job_recovery_assistant",
    operation: "suggest_job_recovery_steps",
    schema: jobRecoveryAssistantResultSchema,
    instructions: INSTRUCTIONS,
    input: buildInput(context),
    promptVersion: JOB_RECOVERY_ASSISTANT_PROMPT_VERSION,
    actorUserId,
    entityId: context.jobId,
    metadata: {
      analysisScope: "job_recovery",
      jobId: context.jobId,
      role: context.role,
      status: context.status,
      operationalPhase: context.operationalPhase || null,
    },
    maxOutputTokens: 650,
    reasoningEffort: "low",
  });

  return {
    ...result,
    data: normalizeJobRecoveryAssistantResult(result.data),
  };
}

function normalizeJobRecoveryAssistantResult(
  result: JobRecoveryAssistantResult
): JobRecoveryAssistantResult {
  if (result.confidence === "high") {
    return {
      ...result,
      confidence: "medium",
    };
  }
  return result;
}
