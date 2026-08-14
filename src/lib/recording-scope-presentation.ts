export function recordingRequirementFields(recordingRequired: boolean) {
  return recordingRequired
    ? { serviceCanContinueWithoutRecording: false, essentialPrivateRecording: true }
    : { serviceCanContinueWithoutRecording: true, essentialPrivateRecording: false };
}

export function recordingRequirementSelection(fields: {
  serviceCanContinueWithoutRecording: boolean;
  essentialPrivateRecording: boolean;
}) {
  if (!fields.serviceCanContinueWithoutRecording && fields.essentialPrivateRecording) return "required";
  if (fields.serviceCanContinueWithoutRecording && !fields.essentialPrivateRecording) return "optional";
  return null;
}
