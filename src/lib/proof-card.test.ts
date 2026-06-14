import { describe, expect, it } from "vitest";
import { buildProofCard } from "./proof-card";
import { buildProofCardDemoDiscoverResponse } from "./proof-card-demo-fixtures";

describe("buildProofCard", () => {
  it("classifies approved completed-stage public video proof as public_proof", () => {
    const card = buildProofCard({
      serviceName: "Outlet Installation",
      stageAvailability: {
        startingCondition: true,
        workInProgress: true,
        finalResult: true,
      },
      hasPublicMedia: true,
      reviewCount: 1,
      trustScore: {
        scored: true,
        totalScorePct: 94,
        maturityLabel: "Early-Stage Trust Score",
        evidence: {
          verifiedBookings: 3,
          approvedServiceVideos: 3,
          validatedDisputes: 0,
        },
      },
    });

    expect(card.kind).toBe("public_proof");
    expect(card.statusLabel).toBe("Completed Service");
    expect(card.primaryCta).toBe("View Proof");
    expect(card.stageAvailability.finalResult).toBe(true);
    expect(card.reviewLabel).toBe("Review Available");
  });

  it("classifies review or Trust Score evidence without complete public video as partial_proof", () => {
    const card = buildProofCard({
      serviceName: "Panel Inspection",
      stageAvailability: {
        startingCondition: true,
        workInProgress: false,
        finalResult: false,
      },
      reviewCount: 2,
      trustScore: {
        scored: true,
        totalScorePct: 88,
        maturityLabel: "Emerging Trust Score",
        evidence: {
          verifiedBookings: 4,
          approvedServiceVideos: 1,
          validatedDisputes: 0,
        },
      },
    });

    expect(card.kind).toBe("partial_proof");
    expect(card.statusLabel).toBe("Proof Building");
    expect(card.primaryCta).toBe("View Proof");
    expect(card.trustLabel).toBe("Emerging Trust Score: 88%");
  });

  it("classifies service/work type with no public proof as service_offered_only", () => {
    const card = buildProofCard({
      serviceName: "Emergency Electrical Repair",
      stageAvailability: {
        startingCondition: false,
        workInProgress: false,
        finalResult: false,
      },
      hasPublicMedia: false,
      reviewCount: 0,
      trustScore: {
        scored: false,
        totalScorePct: null,
        maturityLabel: "Building",
        evidence: {
          verifiedBookings: 0,
          approvedServiceVideos: 0,
          validatedDisputes: 0,
        },
      },
    });

    expect(card.kind).toBe("service_offered_only");
    expect(card.statusLabel).toBe("Service Offered");
    expect(card.primaryCta).toBe("View Service Offered");
    expect(card.evidenceSummary).toBe("This work type is listed, but public proof is still building.");
  });

  it("provides dev demo fixtures for all three proof-card states", () => {
    const response = buildProofCardDemoDiscoverResponse({ limit: 10 });
    const states = response.results.map((result) => result.proofCard?.kind);

    expect(states).toContain("public_proof");
    expect(states).toContain("partial_proof");
    expect(states).toContain("service_offered_only");
    expect(response.results.find((result) => result.proofCard?.kind === "public_proof")?.proofCard?.primaryCta).toBe(
      "View Proof"
    );
    expect(
      response.results.find((result) => result.proofCard?.kind === "service_offered_only")?.proofCard?.primaryCta
    ).toBe("View Service Offered");
  });
});
