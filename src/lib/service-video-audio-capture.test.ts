import { describe, expect, it } from "vitest";
import {
  serviceVideoAudioConstraint,
  serviceVideoAudioLabel,
  serviceVideoDevicePermissionMessage,
} from "./service-video-audio-capture";

describe("employee Service Video package audio capture", () => {
  it("does not request the microphone for a Video-only package", () => {
    expect(serviceVideoAudioConstraint(false)).toBe(false);
    expect(serviceVideoAudioLabel(false)).toBe("Audio: Off");
    expect(serviceVideoDevicePermissionMessage(false)).not.toContain("microphone");
  });

  it("requests the microphone for an approved Video-and-audio package", () => {
    expect(serviceVideoAudioConstraint(true)).toBe(true);
    expect(serviceVideoAudioLabel(true)).toBe("Audio: On - Approved for this Service Video");
    expect(serviceVideoAudioLabel(true, true)).toBe("Audio: On - Customer approved");
  });

  it("fails closed with a truthful retry instruction when microphone access is denied", () => {
    expect(serviceVideoDevicePermissionMessage(true)).toContain("Camera and microphone access are required");
    expect(serviceVideoDevicePermissionMessage(true)).toContain("approved to include audio");
  });
});
