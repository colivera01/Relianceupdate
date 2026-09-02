import { describe, expect, it } from "vitest";
import { getForwardPlaybackStages, getNextPlaybackStage } from "./customer-service-video-playback";

const allStages = ["before", "during", "after"] as const;

describe("customer Service Video playback", () => {
  it("plays the complete sequence from Starting Condition", () => {
    expect(getForwardPlaybackStages("before", allStages)).toEqual(["before", "during", "after"]);
  });

  it("plays forward from Work in Progress", () => {
    expect(getForwardPlaybackStages("during", allStages)).toEqual(["during", "after"]);
  });

  it("plays only Final Result when started there", () => {
    expect(getForwardPlaybackStages("after", allStages)).toEqual(["after"]);
  });

  it("skips an unavailable later stage without going backward", () => {
    expect(getForwardPlaybackStages("during", ["before", "after"])).toEqual(["after"]);
  });

  it("resolves the next stage only from the active queue", () => {
    expect(getNextPlaybackStage("during", ["during", "after"])).toBe("after");
    expect(getNextPlaybackStage("after", ["during", "after"])).toBeNull();
  });
});
