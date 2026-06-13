import { z } from "zod";
import { runStructuredAiTask } from "./client";
import { VENDOR_COPY_ASSISTANT_PROMPT_VERSION } from "./prompt-registry";
import {
  vendorCopyAssistantResultSchema,
  type VendorCopyAssistantResult,
} from "./schemas";

export const vendorCopyAssistantRequestSchema = z.object({
  vendorId: z.string().min(1),
  mode: z.enum(["profile_bio", "service_draft"]),
  businessName: z.string().min(1).max(180),
  category: z.string().max(120).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  state: z.string().max(120).nullable().optional(),
  currentHeadline: z.string().max(180).nullable().optional(),
  currentDescription: z.string().max(2000),
  currentBullets: z.array(z.string().min(1).max(180)).max(8).default([]),
  trustSignals: z.array(z.string().min(1).max(220)).max(8).default([]),
});

export type VendorCopyAssistantRequest = z.infer<
  typeof vendorCopyAssistantRequestSchema
>;

function buildInput(context: VendorCopyAssistantRequest): string {
  return [
    "Reliance vendor copy improvement request.",
    "Important scope: improve clarity, trust, and customer understanding using the supplied draft only.",
    "Do not invent licenses, years, certifications, guarantees, prices, or service areas that were not supplied.",
    "",
    `Vendor ID: ${context.vendorId}`,
    `Mode: ${context.mode}`,
    `Business name: ${context.businessName}`,
    `Category: ${context.category || "Unknown"}`,
    `City/state: ${context.city || "Unknown"}, ${context.state || "Unknown"}`,
    `Current headline: ${context.currentHeadline || "None"}`,
    `Current description: ${context.currentDescription}`,
    `Current bullets: ${context.currentBullets.length ? context.currentBullets.join(" | ") : "None"}`,
    `Available trust signals: ${context.trustSignals.length ? context.trustSignals.join(" | ") : "None supplied"}`,
  ].join("\n");
}

const INSTRUCTIONS = `
You are the Reliance AI Vendor Copy Assistant.

Your job is to rewrite vendor-facing public copy so first-time customers understand what the business does and why it feels trustworthy.

Constraints:
- Use plain customer language.
- Do not invent proof or guarantees.
- Keep recommendations grounded in the current draft and supplied trust signals only.
- Trust gaps should point out what a customer might still question.
- Risky claims should flag copy that sounds unverifiable, exaggerated, or vague.

Output requirements:
- Return valid JSON only.
- Recommended description should be customer-ready, concise, and believable.
`.trim();

export async function getVendorCopyAssistantSuggestion(
  context: VendorCopyAssistantRequest,
  actorUserId: string
) {
  const result = await runStructuredAiTask({
    feature: "vendor_copy_assistant",
    operation: "improve_vendor_copy",
    schema: vendorCopyAssistantResultSchema,
    instructions: INSTRUCTIONS,
    input: buildInput(context),
    promptVersion: VENDOR_COPY_ASSISTANT_PROMPT_VERSION,
    actorUserId,
    entityId: context.vendorId,
    metadata: {
      analysisScope: "vendor_copy",
      vendorId: context.vendorId,
      mode: context.mode,
      businessName: context.businessName,
    },
    maxOutputTokens: 700,
    reasoningEffort: "low",
  });

  return {
    ...result,
    data: normalizeVendorCopyAssistantResult(result.data),
  };
}

function normalizeVendorCopyAssistantResult(
  result: VendorCopyAssistantResult
): VendorCopyAssistantResult {
  if (result.confidence === "high") {
    return {
      ...result,
      confidence: "medium",
    };
  }
  return result;
}
