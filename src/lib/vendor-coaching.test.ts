import { describe, expect, it } from "vitest";
import { buildVendorCoachingPlan } from "./vendor-coaching";
import type { VendorDashboardResponse } from "@/types/vendor";

const dashboard: VendorDashboardResponse = {
  profile: {
    firstName: "",
    lastName: "",
    businessName: "Metro Home Care Pros",
    businessType: "Home Care",
    category: "Home Care",
    foundedYear: 2024,
    email: "metro@example.com",
    phone: "555-0100",
    city: "Orlando",
    state: "FL",
    serviceTypes: [],
    specializations: [],
    serviceAreas: [],
  },
  stats: {
    totalBookings: 16,
    totalEarnings: 0,
    totalClients: 3,
    rating: 4.8,
    ratingCount: 5,
  },
  recentJobs: [
    { id: "1", title: "A", client: "Client A", amount: 100, status: "completed", date: "2026-06-02T10:00:00.000Z" },
    { id: "2", title: "B", client: "Client B", amount: 120, status: "in progress", date: "2026-06-02T11:00:00.000Z" },
  ],
  recentReviews: [
    { id: "r1", client: "Client A", rating: 5, comment: "Great", date: "2026-06-02T12:00:00.000Z", jobType: "Cleaning" },
  ],
  insights: [],
  notifications: [],
  pendingModerationProofs: 2,
  approvedProofs: 7,
  pendingModerationServiceOrderCount: 1,
  approvedServiceOrderCount: 3,
  archivedProofs: 1,
  totalProofAssets: 10,
  storageUsedBytes: "1000",
  storageLimitBytes: "10000",
  storagePercentUsed: 82,
};

describe("buildVendorCoachingPlan", () => {
  it("prioritizes the weakest measurable trust-score component first", () => {
    const plan = buildVendorCoachingPlan(
      {
        scored: true,
        totalScorePct: 88,
        components: {
          workflowCompletion: { pct: 95, numerator: 22, denominator: 23, weightPct: 35 },
          videoVerification: { pct: 72, numerator: 18, denominator: 25, weightPct: 30 },
          disputeFree: { pct: 100, numerator: 23, denominator: 23, weightPct: 35 },
          operationalReliability: { pct: 0, numerator: 0, denominator: 23, weightPct: 0 },
        },
      },
      dashboard
    );

    expect(plan.summary).toContain("video verification at 72%");
    expect(plan.priorityActions[0]).toContain("Video verification is 72%");
    expect(plan.priorityActions.some((item) => item.includes("Operational reliability"))).toBe(false);
    expect(plan.strengths.some((item) => item.includes("Dispute-free completion"))).toBe(true);
    expect(plan.operationalNotes.some((item) => item.includes("Storage is 82% full"))).toBe(true);
    expect(plan.operationalNotes.some((item) => item.includes("1 Service Order video package is awaiting Reliance Audit"))).toBe(true);
    expect(plan.priorityActions.some((item) => item.includes("awaits Reliance Audit"))).toBe(false);
    expect(plan.priorityActions.some((item) => item.includes("2 service video packages"))).toBe(false);
  });

  it("falls back to coverage-building guidance when trust score is not yet meaningful", () => {
    const plan = buildVendorCoachingPlan(
      {
        scored: false,
        totalScorePct: null,
        components: null,
      },
      dashboard
    );

    expect(plan.summary).toContain("does not yet have complete finalized evidence");
    expect(plan.priorityActions[0]).toContain("Finish more jobs");
    expect(plan.strengths[0]).toBe("3 Service Order video packages are already approved.");
  });

  it("returns a maintenance-style plan when no major weakness stands out", () => {
    const plan = buildVendorCoachingPlan(
      {
        scored: true,
        totalScorePct: 100,
        components: {
          workflowCompletion: { pct: 100, numerator: 5, denominator: 5, weightPct: 35 },
          videoVerification: { pct: 100, numerator: 5, denominator: 5, weightPct: 30 },
          disputeFree: { pct: 100, numerator: 5, denominator: 5, weightPct: 35 },
          operationalReliability: { pct: null, numerator: 0, denominator: 0, weightPct: 0 },
        },
      },
      {
        ...dashboard,
        pendingModerationProofs: 0,
        pendingModerationServiceOrderCount: 0,
        storagePercentUsed: 45,
      }
    );

    expect(plan.priorityActions[0]).toContain("No corrective score action");
    expect(plan.summary).toContain("100/100");
    expect(plan.strengths.some((item) => item.includes("Reliance Trust Score is 100/100"))).toBe(true);
  });
});
