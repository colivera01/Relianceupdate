import { describe, expect, it, vi } from "vitest";
import {
  BOOKING_SERVICE_ISSUE_TYPES,
  TRUST_OUTCOME_TYPES,
  isServiceIssuePending,
  isServiceIssueScoreAffecting,
  recordBookingServiceIssue,
  recordFinalizedOperationalOutcome,
  tryRecordBookingServiceIssue,
  tryRecordFinalizedOperationalOutcome,
} from "./trust-score-outcome-foundation";

/**
 * A Prisma-like test double that ALSO exposes a `review` delegate whose methods are
 * spies. Trust Score outcome storage must never create or mutate Customer Rating
 * reviews, so every test asserts these spies stay untouched.
 */
function makeDb(overrides?: {
  outcome?: Record<string, any>;
  issue?: Record<string, any>;
}) {
  const reviewSpies = {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  };
  const db = {
    vendorOperationalOutcome: {
      findFirst: vi.fn(),
      create: vi.fn(async (args: any) => ({ id: "outcome-1", ...args.data })),
      update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
      ...(overrides?.outcome || {}),
    },
    bookingServiceIssue: {
      findFirst: vi.fn(),
      create: vi.fn(async (args: any) => ({ id: "issue-1", ...args.data })),
      update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
      ...(overrides?.issue || {}),
    },
    review: reviewSpies,
  };
  return { db, reviewSpies };
}

function expectReviewUntouched(reviewSpies: Record<string, ReturnType<typeof vi.fn>>) {
  for (const spy of Object.values(reviewSpies)) {
    expect(spy).not.toHaveBeenCalled();
  }
}

describe("service issue classification (finalized vs pending)", () => {
  it("treats only validated/refund-approved issues as score-affecting", () => {
    expect(isServiceIssueScoreAffecting({ status: "VALIDATED" })).toBe(true);
    expect(isServiceIssueScoreAffecting({ status: "REFUND_APPROVED" })).toBe(true);
    expect(isServiceIssueScoreAffecting({ status: "refund_approved" })).toBe(true);
    expect(isServiceIssueScoreAffecting({ status: "PENDING" })).toBe(false);
    expect(isServiceIssueScoreAffecting({ status: "REJECTED" })).toBe(false);
    expect(isServiceIssueScoreAffecting({ status: "" })).toBe(false);
  });

  it("identifies pending (not-yet-finalized) issues", () => {
    expect(isServiceIssuePending({ status: "PENDING" })).toBe(true);
    expect(isServiceIssuePending({ status: "pending" })).toBe(true);
    expect(isServiceIssuePending({ status: "VALIDATED" })).toBe(false);
  });
});

describe("recordFinalizedOperationalOutcome", () => {
  const finalizedAt = new Date("2026-05-28T12:00:00.000Z");

  it("rejects outcomes that are not finalized", async () => {
    const { db, reviewSpies } = makeDb();
    await expect(
      recordFinalizedOperationalOutcome(db as any, {
        vendorId: "v1",
        outcomeType: TRUST_OUTCOME_TYPES.WORKFLOW_COMPLETED,
        status: "PENDING",
        finalizedAt,
      })
    ).rejects.toThrow(/finalized/i);
    expect(db.vendorOperationalOutcome.create).not.toHaveBeenCalled();
    expectReviewUntouched(reviewSpies);
  });

  it("requires a finalizedAt Date", async () => {
    const { db } = makeDb();
    await expect(
      recordFinalizedOperationalOutcome(db as any, {
        vendorId: "v1",
        outcomeType: TRUST_OUTCOME_TYPES.WORKFLOW_COMPLETED,
        // @ts-expect-error intentional bad input
        finalizedAt: "2026-05-28",
      })
    ).rejects.toThrow(/finalizedAt is required/i);
  });

  it("creates a finalized outcome with serialized metadata", async () => {
    const { db, reviewSpies } = makeDb();
    await recordFinalizedOperationalOutcome(db as any, {
      vendorId: "v1",
      bookingId: "b1",
      outcomeType: TRUST_OUTCOME_TYPES.BOOKING_CANCELED,
      sourceEntityType: "booking",
      sourceEntityId: "b1",
      finalizedAt,
      finalizedByUserId: "u1",
      metadata: { previousStatus: "PENDING", refundRequested: true },
    });
    expect(db.vendorOperationalOutcome.create).toHaveBeenCalledTimes(1);
    const arg = db.vendorOperationalOutcome.create.mock.calls[0][0];
    expect(arg.data).toMatchObject({
      vendorId: "v1",
      bookingId: "b1",
      outcomeType: "BOOKING_CANCELED",
      status: "FINALIZED",
      finalizedAt,
      finalizedByUserId: "u1",
    });
    expect(arg.data.metadata).toBe(
      JSON.stringify({ previousStatus: "PENDING", refundRequested: true })
    );
    expectReviewUntouched(reviewSpies);
  });

  it("updates instead of inserting when a matching source row already exists (dedupe)", async () => {
    const { db, reviewSpies } = makeDb();
    db.vendorOperationalOutcome.findFirst.mockResolvedValueOnce({ id: "existing-outcome" });
    await recordFinalizedOperationalOutcome(db as any, {
      vendorId: "v1",
      bookingId: "b1",
      outcomeType: TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_APPROVED,
      sourceEntityType: "media_package",
      sourceEntityId: "b1",
      finalizedAt,
    });
    expect(db.vendorOperationalOutcome.update).toHaveBeenCalledTimes(1);
    expect(db.vendorOperationalOutcome.update.mock.calls[0][0].where).toEqual({
      id: "existing-outcome",
    });
    expect(db.vendorOperationalOutcome.create).not.toHaveBeenCalled();
    expectReviewUntouched(reviewSpies);
  });

  it("skips gracefully when the delegate is unavailable", async () => {
    const result = await recordFinalizedOperationalOutcome({ review: {} } as any, {
      vendorId: "v1",
      outcomeType: TRUST_OUTCOME_TYPES.WORKFLOW_COMPLETED,
      finalizedAt,
    });
    expect(result).toMatchObject({ skipped: true });
  });
});

describe("recordBookingServiceIssue", () => {
  it("requires a status", async () => {
    const { db } = makeDb();
    await expect(
      recordBookingServiceIssue(db as any, {
        bookingId: "b1",
        vendorId: "v1",
        issueType: BOOKING_SERVICE_ISSUE_TYPES.REFUND_REQUEST,
        status: "",
      })
    ).rejects.toThrow(/status is required/i);
  });

  it("persists a pending refund request without finalized timestamps", async () => {
    const { db, reviewSpies } = makeDb();
    await recordBookingServiceIssue(db as any, {
      bookingId: "b1",
      vendorId: "v1",
      issueType: BOOKING_SERVICE_ISSUE_TYPES.REFUND_REQUEST,
      status: "PENDING",
      sourceEntityType: "booking_cancellation",
      sourceEntityId: "b1",
      reportedByUserId: "u1",
    });
    const arg = db.bookingServiceIssue.create.mock.calls[0][0];
    expect(arg.data).toMatchObject({
      bookingId: "b1",
      vendorId: "v1",
      issueType: "REFUND_REQUEST",
      status: "PENDING",
    });
    expect(arg.data.finalizedAt).toBeNull();
    expect(arg.data.validatedAt).toBeNull();
    expectReviewUntouched(reviewSpies);
  });

  it("defaults finalizedAt from validatedAt for a validated issue", async () => {
    const { db, reviewSpies } = makeDb();
    const validatedAt = new Date("2026-05-28T15:00:00.000Z");
    await recordBookingServiceIssue(db as any, {
      bookingId: "b1",
      vendorId: "v1",
      issueType: BOOKING_SERVICE_ISSUE_TYPES.VALIDATED_DISPUTE,
      status: "VALIDATED",
      validatedAt,
    });
    const arg = db.bookingServiceIssue.create.mock.calls[0][0];
    expect(arg.data.status).toBe("VALIDATED");
    expect(arg.data.validatedAt).toEqual(validatedAt);
    expect(arg.data.finalizedAt).toEqual(validatedAt);
    expectReviewUntouched(reviewSpies);
  });

  it("updates the existing issue when a matching source row exists (dedupe)", async () => {
    const { db } = makeDb();
    db.bookingServiceIssue.findFirst.mockResolvedValueOnce({ id: "existing-issue" });
    await recordBookingServiceIssue(db as any, {
      bookingId: "b1",
      vendorId: "v1",
      issueType: BOOKING_SERVICE_ISSUE_TYPES.VALIDATED_DISPUTE,
      status: "VALIDATED",
      sourceEntityType: "content_report",
      sourceEntityId: "report-1",
      validatedAt: new Date("2026-05-28T15:00:00.000Z"),
    });
    expect(db.bookingServiceIssue.update).toHaveBeenCalledTimes(1);
    expect(db.bookingServiceIssue.create).not.toHaveBeenCalled();
  });
});

describe("best-effort wrappers swallow failures (non-fatal hooks)", () => {
  it("tryRecordFinalizedOperationalOutcome returns skipped instead of throwing", async () => {
    const { db, reviewSpies } = makeDb({
      outcome: {
        create: vi.fn(async () => {
          throw new Error("db unavailable");
        }),
      },
    });
    const result = await tryRecordFinalizedOperationalOutcome(db as any, {
      vendorId: "v1",
      outcomeType: TRUST_OUTCOME_TYPES.WORKFLOW_COMPLETED,
      finalizedAt: new Date("2026-05-28T12:00:00.000Z"),
    });
    expect(result).toMatchObject({ skipped: true });
    expectReviewUntouched(reviewSpies);
  });

  it("tryRecordBookingServiceIssue returns skipped instead of throwing", async () => {
    const { db, reviewSpies } = makeDb({
      issue: {
        create: vi.fn(async () => {
          throw new Error("db unavailable");
        }),
      },
    });
    const result = await tryRecordBookingServiceIssue(db as any, {
      bookingId: "b1",
      vendorId: "v1",
      issueType: BOOKING_SERVICE_ISSUE_TYPES.SERVICE_FAILURE,
      status: "VALIDATED",
      validatedAt: new Date("2026-05-28T12:00:00.000Z"),
    });
    expect(result).toMatchObject({ skipped: true });
    expectReviewUntouched(reviewSpies);
  });
});
