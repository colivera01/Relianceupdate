export function serviceVideoAudioConstraint(audioAllowed: boolean): boolean {
  return audioAllowed === true;
}

export function serviceVideoDevicePermissionMessage(audioAllowed: boolean): string {
  return audioAllowed
    ? "Camera and microphone access are required because this Service Video was approved to include audio. Allow both and tap the stage again."
    : "Camera access was blocked. Allow camera access in the browser and tap the stage again.";
}

export function serviceVideoAudioLabel(
  audioAllowed: boolean,
  customerPermissionRequired = false,
): string {
  if (!audioAllowed) return "Audio: Off";
  return customerPermissionRequired
    ? "Audio: On - Customer approved"
    : "Audio: On - Approved for this Service Video";
}
