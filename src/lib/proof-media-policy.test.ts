import { describe, expect, it } from "vitest";

import { groupCompletePublicProofPackagesByService } from "./proof-media-policy";

function stageAsset(stage: "INTRO" | "IN_PROGRESS" | "COMPLETED", bookingId: string) {
  return {
    id: `${bookingId}-${stage}`,
    mimeType: "video/mp4",
    mediaSession: {
      bookingId,
      serviceId: "service-1",
      vendorJobVideoStage: stage,
      sessionType: "JOB_SERVICE_VIDEO",
    },
  };
}

describe("groupCompletePublicProofPackagesByService", () => {
  it("returns one exact three-stage package from one work record", () => {
    const assets = [
      stageAsset("COMPLETED", "booking-1"),
      stageAsset("INTRO", "booking-1"),
      stageAsset("IN_PROGRESS", "booking-1"),
    ];

    const grouped = groupCompletePublicProofPackagesByService(assets);

    expect(grouped.get("service-1")?.map((asset) => asset.id)).toEqual([
      "booking-1-INTRO",
      "booking-1-IN_PROGRESS",
      "booking-1-COMPLETED",
    ]);
  });

  it("does not assemble a package from unrelated work records", () => {
    const grouped = groupCompletePublicProofPackagesByService([
      stageAsset("INTRO", "booking-1"),
      stageAsset("IN_PROGRESS", "booking-2"),
      stageAsset("COMPLETED", "booking-3"),
    ]);

    expect(grouped.has("service-1")).toBe(false);
  });

  it("fails closed when a canonical stage is duplicated or its booking identity is absent", () => {
    const duplicate = groupCompletePublicProofPackagesByService([
      stageAsset("INTRO", "booking-1"),
      stageAsset("INTRO", "booking-1"),
      stageAsset("IN_PROGRESS", "booking-1"),
      stageAsset("COMPLETED", "booking-1"),
    ]);
    const missingBooking = groupCompletePublicProofPackagesByService([
      { ...stageAsset("INTRO", "booking-1"), mediaSession: { ...stageAsset("INTRO", "booking-1").mediaSession, bookingId: null } },
      stageAsset("IN_PROGRESS", "booking-1"),
      stageAsset("COMPLETED", "booking-1"),
    ]);

    expect(duplicate.has("service-1")).toBe(false);
    expect(missingBooking.has("service-1")).toBe(false);
  });
});
