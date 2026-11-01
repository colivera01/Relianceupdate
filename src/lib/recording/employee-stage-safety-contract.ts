export const EMPLOYEE_STAGE_SAFETY_ACKNOWLEDGMENTS = [
  {
    id: "approved_people_only",
    text: "Only the people named in the approved recording scope will be intentionally identifiable. No minors, unrelated adults, or bystanders are included.",
  },
  {
    id: "approved_area_only",
    text: "The camera will stay within the approved service area and show only the service area, equipment, item, or work described in this Service Order.",
  },
  {
    id: "private_information_clear",
    text: "Private documents, screens, personal information, credentials, access codes, keys, and security details are outside the frame.",
  },
  {
    id: "audio_scope_clear",
    text: "No unrelated private conversation will be captured, and the recording will follow the audio setting shown for this Service Order.",
  },
  {
    id: "stop_if_conditions_change",
    text: "If any condition changes, I will stop and complete a fresh safety and location check before recording.",
  },
] as const;

type EmployeeStageSafetyScope = {
  intentionalParticipantPlan?: string | null;
  audioAllowed?: boolean;
};

function approvedPeopleAcknowledgment(intentionalParticipantPlan: string): string {
  if (intentionalParticipantPlan === "none") {
    return "No person is approved to be intentionally identifiable. Keep the assigned service professional, customer, minors, unrelated adults, and bystanders from being intentionally identifiable in the recording.";
  }
  if (intentionalParticipantPlan === "customer") {
    return "Only the customer is approved to be intentionally identifiable. Keep the assigned service professional, minors, unrelated adults, and bystanders from being intentionally identifiable in the recording.";
  }
  if (intentionalParticipantPlan === "assigned_service_professional") {
    return "Only the assigned service professional is approved to be intentionally identifiable. Keep the customer, minors, unrelated adults, and bystanders from being intentionally identifiable in the recording.";
  }
  if (intentionalParticipantPlan === "customer_and_assigned_service_professional") {
    return "Only the customer and assigned service professional are approved to be intentionally identifiable. No minors, unrelated adults, or bystanders are included.";
  }
  return EMPLOYEE_STAGE_SAFETY_ACKNOWLEDGMENTS[0].text;
}

export function employeeStageSafetyAcknowledgmentsForScope(
  scope: EmployeeStageSafetyScope,
): Array<{ id: EmployeeStageSafetyAcknowledgmentId; text: string }> {
  const intentionalParticipantPlan = String(scope.intentionalParticipantPlan || "")
    .trim()
    .toLowerCase();
  return EMPLOYEE_STAGE_SAFETY_ACKNOWLEDGMENTS.map((item) => {
    if (item.id === "approved_people_only") {
      return { ...item, text: approvedPeopleAcknowledgment(intentionalParticipantPlan) };
    }
    if (item.id === "audio_scope_clear") {
      return {
        ...item,
        text: scope.audioAllowed
          ? "Audio is enabled only within the approved recording scope. No unrelated or private conversation will be captured."
          : "Audio is disabled for this Service Order. No voices or other identifying audio will be captured.",
      };
    }
    return item;
  });
}

export type EmployeeStageSafetyAcknowledgmentId =
  (typeof EMPLOYEE_STAGE_SAFETY_ACKNOWLEDGMENTS)[number]["id"];

export const EMPLOYEE_STAGE_SAFETY_RESOLVABLE_BLOCK_CODES = [
  "V2_RUNTIME_SAFETY_CHECK_REQUIRED",
  "V2_RUNTIME_SAFETY_BLOCKED",
  "V2_RUNTIME_SAFETY_BINDING_STALE",
  "V2_RUNTIME_SAFETY_LOCATION_BINDING_STALE",
] as const;

export function hasAllEmployeeStageSafetyAcknowledgments(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  const allowed = new Set<string>(
    EMPLOYEE_STAGE_SAFETY_ACKNOWLEDGMENTS.map((item) => item.id),
  );
  if (Object.keys(source).some((key) => !allowed.has(key))) return false;
  return EMPLOYEE_STAGE_SAFETY_ACKNOWLEDGMENTS.every(
    (item) => source[item.id] === true,
  );
}

export function isEmployeeStageSafetyResolvableBlock(code: string | null | undefined): boolean {
  return EMPLOYEE_STAGE_SAFETY_RESOLVABLE_BLOCK_CODES.includes(
    String(code || "") as (typeof EMPLOYEE_STAGE_SAFETY_RESOLVABLE_BLOCK_CODES)[number],
  );
}
