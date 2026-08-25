import { describe, expect, it } from "vitest";
import { permissionContentForAudio } from "./content-version";

describe("versioned recording-permission audio disclosure", () => {
  it("binds Video-only permission to a distinct disclosure and hash", () => {
    const videoOnly = permissionContentForAudio(false);

    expect(videoOnly.version).toBe("recording-permission-v3-video-only");
    expect(videoOnly.content.audio).toBe("Audio will not be recorded.");
    expect(videoOnly.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("binds Video-and-audio permission to an explicit sound disclosure", () => {
    const videoOnly = permissionContentForAudio(false);
    const withAudio = permissionContentForAudio(true);

    expect(withAudio.version).toBe("recording-permission-v3-video-audio");
    expect(withAudio.content.audio).toContain("will include sound");
    expect(withAudio.content.audio).toContain("unrelated private information should not be intentionally recorded");
    expect(withAudio.contentHash).not.toBe(videoOnly.contentHash);
  });
});
