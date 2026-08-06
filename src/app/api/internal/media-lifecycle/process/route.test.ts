import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  processDueRetentionSchedules: vi.fn(),
  processMediaDeletionJobs: vi.fn(),
}));
vi.mock("@/lib/media-lifecycle", () => ({
  processDueRetentionSchedules: hoisted.processDueRetentionSchedules,
  processMediaDeletionJobs: hoisted.processMediaDeletionJobs,
}));

import { POST } from "./route";

describe("media lifecycle worker", () => {
  beforeEach(() => {
    process.env.INTERNAL_NOTIFICATION_WORKER_SECRET = "worker-secret";
    hoisted.processDueRetentionSchedules.mockReset();
    hoisted.processMediaDeletionJobs.mockReset();
    hoisted.processDueRetentionSchedules.mockResolvedValue([]);
    hoisted.processMediaDeletionJobs.mockResolvedValue([]);
  });
  afterEach(() => delete process.env.INTERNAL_NOTIFICATION_WORKER_SECRET);

  it("rejects an unauthorized worker request", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/media-lifecycle/process", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(401);
    expect(hoisted.processDueRetentionSchedules).not.toHaveBeenCalled();
    expect(hoisted.processMediaDeletionJobs).not.toHaveBeenCalled();
  });

  it("processes jobs with the configured shared worker secret", async () => {
    hoisted.processDueRetentionSchedules.mockResolvedValue([
      { scheduleId: "schedule-1", status: "DELETION_QUEUED" },
    ]);
    hoisted.processMediaDeletionJobs.mockResolvedValue([
      { jobId: "job-1", status: "RETRY_REQUIRED" },
    ]);
    const response = await POST(
      new Request("http://localhost/api/internal/media-lifecycle/process", {
        method: "POST",
        headers: { "x-internal-notification-secret": "worker-secret" },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      processed: 2,
    });
  });
});
