import { describe, expect, it } from "vitest";
import { resolveManagerStageAssetState } from "./service-video-manager-stage-state";

describe("manager Service Video stage state", () => {
  it("counts only the latest explicitly saved asset as ready for Manager review", () => {
    expect(resolveManagerStageAssetState({
      mediaAssets: [{ id: "saved-asset", uploadState: "SAVED" }],
    })).toMatchObject({ saved: true, correctionRequested: false });
  });

  it("does not count a preserved rejected asset as a current uploaded stage", () => {
    expect(resolveManagerStageAssetState({
      mediaAssets: [
        { id: "rejected-current", uploadState: "REJECTED" },
        { id: "saved-history", uploadState: "SAVED" },
      ],
    })).toMatchObject({
      asset: { id: "rejected-current" },
      saved: false,
      correctionRequested: true,
    });
  });

  it("fails closed when the current asset has no authoritative upload state", () => {
    expect(resolveManagerStageAssetState({
      mediaAssets: [{ id: "unknown-state" }],
    })).toMatchObject({ saved: false, correctionRequested: false });
  });
});
