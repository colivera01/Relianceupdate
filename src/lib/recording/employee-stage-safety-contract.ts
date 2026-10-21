export const EMPLOYEE_STAGE_SAFETY_ACKNOWLEDGMENTS = [
  {
    id: "approved_people_only",
    text: "Only the approved assigned service professional will be intentionally visible or heard. No minors, unrelated adults, or bystanders are included.",
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
