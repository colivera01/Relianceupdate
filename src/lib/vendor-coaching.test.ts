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
        totalScorePct: 92,
        components: {
          workflowCompletion: { pct: 100, numerator: 23, denominator: 23, weightPct: 30 },
          videoVerification: { pct: 100, numerator: 24, denominator: 24, weightPct: 25 },
          disputeFree: { pct: 100, numerator: 23, denominator: 23, weightPct: 30 },
          operationalReliability: { pct: 86.96, numerator: 20, denominator: 23, weightPct: 15 },
        },
      },
      dashboard
    );

    expect(plan.summary).toContain("Operational reliability");
    expect(plan.priorityActions[0]).toContain("Operational reliability");
    expect(plan.strengths.some((item) => item.includes("Workflow completion is perfect"))).toBe(true);
    expect(plan.operationalNotes.some((item) => item.includes("Storage is 82% full"))).toBe(true);
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

    expect(plan.summary).toContain("does not have enough finalized Reliance activity");
    expect(plan.priorityActions[0]).toContain("Finish more jobs");
    expect(plan.strengths[0]).toContain("approved");
  });

  it("returns a maintenance-style plan when no major weakness stands out", () => {
    const plan = buildVendorCoachingPlan(
      {
        scored: true,
        totalScorePct: 100,
        components: {
          workflowCompletion: { pct: 100, numerator: 5, denominator: 5, weightPct: 30 },
          videoVerification: { pct: 100, numerator: 5, denominator: 5, weightPct: 25 },
          disputeFree: { pct: 100, numerator: 5, denominator: 5, weightPct: 30 },
          operationalReliability: { pct: 100, numerator: 5, denominator: 5, weightPct: 15 },
        },
      },
      {
        ...dashboard,
        pendingModerationProofs: 0,
        storagePercentUsed: 45,
      }
    );

    expect(plan.priorityActions[0]).toContain("No major score weak point");
    expect(plan.strengths.some((item) => item.includes("strong at 100%"))).toBe(true);
  });
});
