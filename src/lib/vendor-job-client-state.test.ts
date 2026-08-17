import { describe, expect, it } from "vitest";

import { mergeAuthoritativeVendorJobState } from "./vendor-job-client-state";

describe("authoritative vendor job refresh", () => {
  it("does not let optimistic lifecycle fields overwrite the server response", () => {
    const merged = mergeAuthoritativeVendorJobState(
      {
        id: "job-1",
        status: "scheduled",
        consentStatus: "not_requested",
        recordingCompliance: { serviceOrderReleasedAt: null },
        videos: [{ id: "local-preview" }],
      },
      {
        id: "job-1",
        status: "in progress",
        consentStatus: "accepted",
        recordingCompliance: { serviceOrderReleasedAt: "2026-08-17T10:00:00.000Z" },
      },
    );

    expect(merged).toMatchObject({
      status: "in progress",
      consentStatus: "accepted",
      recordingCompliance: { serviceOrderReleasedAt: "2026-08-17T10:00:00.000Z" },
      videos: [{ id: "local-preview" }],
    });
  });
});
