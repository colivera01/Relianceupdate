import { describe, expect, it } from "vitest";
import { buildProofCard, getProofFirstRankScore, rankProofFirstResults } from "./proof-card";
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

  it("ranks real discover results by public proof before service-only listings", () => {
    const serviceOnly = {
      serviceName: "Lighting Installation",
      reviewCount: 0,
      previewMediaType: null,
      publicListing: { hasPublicMedia: false },
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
      proofCard: buildProofCard({
        serviceName: "Lighting Installation",
        hasPublicMedia: false,
        reviewCount: 0,
      }),
    };
    const partialProof = {
      serviceName: "Panel Inspection",
      reviewCount: 6,
      previewMediaType: null,
      publicListing: { hasPublicMedia: false },
      trustScore: {
        scored: true,
        totalScorePct: 89,
        maturityState: "emerging" as const,
        maturityLabel: "Emerging Trust Score",
        evidence: {
          verifiedBookings: 8,
          approvedServiceVideos: 1,
          validatedDisputes: 0,
        },
      },
      proofCard: buildProofCard({
        serviceName: "Panel Inspection",
        reviewCount: 6,
        trustScore: {
          scored: true,
          totalScorePct: 89,
          maturityLabel: "Emerging Trust Score",
          evidence: {
            verifiedBookings: 8,
            approvedServiceVideos: 1,
            validatedDisputes: 0,
          },
        },
      }),
    };
    const publicProof = {
      serviceName: "Outlet Installation",
      reviewCount: 1,
      previewMediaType: "video" as const,
      publicListing: { hasPublicMedia: true },
      trustScore: {
        scored: true,
        totalScorePct: 96,
        maturityState: "emerging" as const,
        maturityLabel: "Emerging Trust Score",
        evidence: {
          verifiedBookings: 9,
          approvedServiceVideos: 3,
          validatedDisputes: 0,
        },
      },
      proofCard: buildProofCard({
        serviceName: "Outlet Installation",
        stageAvailability: {
          startingCondition: true,
          workInProgress: true,
          finalResult: true,
        },
        hasPublicMedia: true,
        reviewCount: 1,
      }),
    };

    const ranked = rankProofFirstResults([serviceOnly, partialProof, publicProof]);

    expect(ranked.map((result) => result.proofCard.kind)).toEqual([
      "public_proof",
      "partial_proof",
      "service_offered_only",
    ]);
    expect(getProofFirstRankScore(publicProof)).toBeGreaterThan(getProofFirstRankScore(partialProof));
    expect(getProofFirstRankScore(partialProof)).toBeGreaterThan(getProofFirstRankScore(serviceOnly));
  });
});
