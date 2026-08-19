export type MaterialWorkRecordEdit = {
  title?: unknown;
  client?: unknown;
  serviceId?: unknown;
  recordingLocation?: unknown;
  propertyScope?: unknown;
  peopleScope?: unknown;
  frameControl?: unknown;
  minorMayAppear?: unknown;
  protectedNonParticipantMayAppear?: unknown;
  sensitiveInformationMayAppear?: unknown;
  identifiersMayAppear?: unknown;
  serviceCanContinueWithoutRecording?: unknown;
  essentialPrivateRecording?: unknown;
};

const MATERIAL_FIELDS: Array<keyof MaterialWorkRecordEdit> = [
  "title",
  "client",
  "serviceId",
  "recordingLocation",
  "propertyScope",
  "peopleScope",
  "frameControl",
  "minorMayAppear",
  "protectedNonParticipantMayAppear",
  "sensitiveInformationMayAppear",
  "identifiersMayAppear",
  "serviceCanContinueWithoutRecording",
  "essentialPrivateRecording",
];

function comparable(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function getMaterialWorkRecordEditFields(
  before: MaterialWorkRecordEdit | null | undefined,
  after: MaterialWorkRecordEdit,
): string[] {
  if (!before) return [];
  return MATERIAL_FIELDS.filter((field) => comparable(before[field]) !== comparable(after[field]));
}
