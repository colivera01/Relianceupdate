/**
 * Trust Score Phase 1C — read/shaping layer.
 *
 * Pure, snapshot-based formatting helpers for the read-only Trust Score APIs. These
 * functions NEVER recalculate and NEVER read from or write to `Review`; they only shape
 * an already-computed `VendorTrustScoreSnapshot` row into audience-safe payloads.
 *
 * Three audiences with strict field separation:
 *   - public  : total + active component pcts/counts + computedAt + explanation only.
 *               Excludes inputHash, recalc trigger/source, detailJson, visibility, ids.
 *   - vendor  : public-safe fields + improvement hints for the vendor's own score.
 *   - admin   : full snapshot incl. inputHash, recalc trigger/source, parsed detail.
 */

import { TRUST_SCORE_VERSION, TRUST_SCORE_WEIGHTS } from "@/lib/trust-score-calculator";
import {
  buildPublicTrustEvidenceSummary,
  buildPublicTrustPresentationSummary,
} from "@/lib/public-trust-score-presentation";

export const TRUST_SCORE_PUBLIC_EXPLAINER =
  "The Reliance Trust Score is a platform-generated verified reliability index based " +
  "on finalized workflow completion, video verification, and dispute-free completion. It is " +
  "calculated by Reliance and remains separate from voluntary Customer Ratings and reviews.";

export interface SnapshotRow {
  id?: string;
  vendorId?: string;
  scoreVersion?: number | null;
  totalScorePct?: number | null;
  workflowCompletionPct?: number | null;
  videoVerificationPct?: number | null;
  disputeFreePct?: number | null;
  operationalReliabilityPct?: number | null;
  workflowCompletionNumerator?: number | null;
  workflowCompletionDenominator?: number | null;
  videoVerificationNumerator?: number | null;
  videoVerificationDenominator?: number | null;
  disputeFreeNumerator?: number | null;
  disputeFreeDenominator?: number | null;
  operationalReliabilityNumerator?: number | null;
  operationalReliabilityDenominator?: number | null;
  computedAt?: Date | string | null;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
  inputHash?: string | null;
  isCurrent?: boolean | null;
  visibilityStatus?: string | null;
  recalcReason?: string | null;
  recalcSource?: string | null;
  detailJson?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

interface PublicComponent {
  pct: number | null;
  numerator: number;
  denominator: number;
  weightPct: number;
}

export interface TrustScoreExplanationDetails {
  overview: string;
  coverageSummary: string;
  strongestSignals: string[];
  watchItems: string[];
  methodology: string[];
}

function num(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  return Number.isFinite(t) ? d.toISOString() : null;
}

function publicComponents(snapshot: SnapshotRow) {
  return {
    workflowCompletion: {
      pct: snapshot.workflowCompletionPct ?? null,
      numerator: num(snapshot.workflowCompletionNumerator),
      denominator: num(snapshot.workflowCompletionDenominator),
      weightPct: Math.round(TRUST_SCORE_WEIGHTS.workflowCompletion * 100),
    } as PublicComponent,
    videoVerification: {
      pct: snapshot.videoVerificationPct ?? null,
      numerator: num(snapshot.videoVerificationNumerator),
      denominator: num(snapshot.videoVerificationDenominator),
      weightPct: Math.round(TRUST_SCORE_WEIGHTS.videoVerification * 100),
    } as PublicComponent,
    disputeFree: {
      pct: snapshot.disputeFreePct ?? null,
      numerator: num(snapshot.disputeFreeNumerator),
      denominator: num(snapshot.disputeFreeDenominator),
      weightPct: Math.round(TRUST_SCORE_WEIGHTS.disputeFree * 100),
    } as PublicComponent,
    operationalReliability: {
      pct: snapshot.operationalReliabilityPct ?? null,
      numerator: num(snapshot.operationalReliabilityNumerator),
      denominator: num(snapshot.operationalReliabilityDenominator),
      weightPct: Math.round(TRUST_SCORE_WEIGHTS.operationalReliability * 100),
    } as PublicComponent,
  };
}

const COMPONENT_LABELS: Record<string, string> = {
  workflowCompletion: "Verified workflow completion",
  videoVerification: "Video verification success",
  disputeFree: "Dispute-free completion",
  operationalReliability: "Operational reliability",
};

const ACTIVE_COMPONENT_ORDER = [
  "workflowCompletion",
  "videoVerification",
  "disputeFree",
] as const;

type ComponentKey = (typeof ACTIVE_COMPONENT_ORDER)[number];

const TRUST_SCORE_METHODOLOGY = [
  "Only finalized Reliance workflow, video-verification, and validated service-issue outcomes are counted.",
  "All three active components must be measurable before a score is shown.",
  "Customer Ratings and review sentiment do not change the Reliance Trust Score.",
  "The current score covers all finalized Reliance activity on record; no rolling time window is implied.",
];

function componentLabel(key: ComponentKey): string {
  return COMPONENT_LABELS[key] || key;
}

function formatComponentStatus(key: ComponentKey, component: PublicComponent): string {
  if (component.pct === null || component.denominator <= 0) {
    return `${componentLabel(key)} is not yet measurable because there are no finalized qualifying records for that component.`;
  }
  return `${componentLabel(key)} is ${component.pct}% (${component.numerator} of ${component.denominator} finalized).`;
}

export function buildTrustScoreExplanationDetails(
  snapshot: SnapshotRow | null | undefined
): TrustScoreExplanationDetails {
  if (!snapshot) {
    return {
      overview:
        "Reliance has not recorded a current Trust Score snapshot for this vendor yet.",
      coverageSummary:
        "No finalized reliability snapshot is available yet, so there are no measurable score components to explain.",
      strongestSignals: [],
      watchItems: [
        "A vendor needs finalized Reliance activity before the reliability score becomes explainable.",
      ],
      methodology: TRUST_SCORE_METHODOLOGY,
    };
  }

  const components = publicComponents(snapshot);
  const measurable = ACTIVE_COMPONENT_ORDER
    .map((key) => ({ key, component: components[key] }))
    .filter(({ component }) => component.pct !== null && component.denominator > 0);
  const unmeasurable = ACTIVE_COMPONENT_ORDER
    .map((key) => ({ key, component: components[key] }))
    .filter(({ component }) => component.pct === null || component.denominator <= 0);
  const measurableWeightPct = measurable.reduce((sum, { component }) => sum + component.weightPct, 0);

  const strongestSignals = [...measurable]
    .sort((a, b) => {
      const pctDiff = (b.component.pct as number) - (a.component.pct as number);
      if (pctDiff !== 0) return pctDiff;
      return b.component.weightPct - a.component.weightPct;
    })
    .slice(0, 2)
    .map(({ key, component }) => formatComponentStatus(key, component));

  const watchItems = [
    ...[...measurable]
      .filter(({ component }) => (component.pct as number) < 100)
      .sort((a, b) => {
        const pctDiff = (a.component.pct as number) - (b.component.pct as number);
        if (pctDiff !== 0) return pctDiff;
        return b.component.weightPct - a.component.weightPct;
      })
      .slice(0, 3)
      .map(({ key, component }) => formatComponentStatus(key, component)),
    ...unmeasurable.map(({ key, component }) => formatComponentStatus(key, component)),
  ];

  if (snapshot.totalScorePct === null || snapshot.totalScorePct === undefined) {
    return {
      overview:
        "A reliability snapshot exists, but the required score components are not all measurable from finalized Reliance activity yet.",
      coverageSummary: `${measurable.length} of ${ACTIVE_COMPONENT_ORDER.length} required components are measurable. A score stays in Building status until every active component has finalized qualifying records.`,
      strongestSignals,
      watchItems:
        watchItems.length > 0
          ? watchItems
          : ["More finalized Reliance activity is needed before a meaningful score can be explained."],
      methodology: TRUST_SCORE_METHODOLOGY,
    };
  }

  return {
    overview: `This vendor's current Reliance Trust Score is ${snapshot.totalScorePct}/100. ${measurable.length} of ${ACTIVE_COMPONENT_ORDER.length} required components are measurable from finalized Reliance activity.`,
    coverageSummary: `Measured components cover ${measurableWeightPct}% of the Version ${TRUST_SCORE_VERSION} score weight. The score uses all finalized Reliance activity on record.`,
    strongestSignals,
    watchItems,
    methodology: TRUST_SCORE_METHODOLOGY,
  };
}

/**
 * Generates non-sensitive, vendor-facing improvement hints from measurable components
 * scoring below 100%, lowest first. Returns an empty list when nothing is measurable.
 */
export function buildImprovementHints(snapshot: SnapshotRow): string[] {
  const components = publicComponents(snapshot);
  const measurable = ACTIVE_COMPONENT_ORDER.map((key) => [key, components[key]] as const)
    .filter(([, c]) => c.pct !== null && c.denominator > 0)
    .map(([key, c]) => ({ key, pct: c.pct as number, c }));

  measurable.sort((a, b) => a.pct - b.pct);

  const hints: string[] = [];
  for (const { key, pct, c } of measurable) {
    if (pct >= 100) continue;
    const label = COMPONENT_LABELS[key] || key;
    hints.push(
      `${label}: ${c.numerator} of ${c.denominator} finalized (${pct}%). ` +
        `This metric carries ${c.weightPct}% of the Reliance Trust Score.`
    );
  }
  return hints;
}

/**
 * PUBLIC-SAFE shape. No internal incident detail, no recalc trigger/source, no inputHash,
 * no visibility state, no reviewer/private data. Returns a "not yet scored" shape when no
 * current snapshot exists.
 */
export function toPublicTrustScore(snapshot: SnapshotRow | null | undefined) {
  const isCurrentVersion = Number(snapshot?.scoreVersion || 0) === TRUST_SCORE_VERSION;
  if (!snapshot || !isCurrentVersion) {
    const unscoredSnapshot = snapshot ? { ...snapshot, totalScorePct: null } : null;
    return {
      scored: false,
      scoreVersion: TRUST_SCORE_VERSION,
      totalScorePct: null,
      components: null,
      computedAt: null,
      explanation: TRUST_SCORE_PUBLIC_EXPLAINER,
      explanationDetails: buildTrustScoreExplanationDetails(unscoredSnapshot),
      evidence: buildPublicTrustEvidenceSummary(snapshot),
      presentation: buildPublicTrustPresentationSummary(unscoredSnapshot),
      separation:
        "The Reliance Trust Score is a verified reliability measure separate from Customer Ratings; it does not use reviews.",
    };
  }
  return {
    scored: snapshot.totalScorePct !== null && snapshot.totalScorePct !== undefined,
    scoreVersion: snapshot.scoreVersion ?? TRUST_SCORE_VERSION,
    totalScorePct: snapshot.totalScorePct ?? null,
    components: publicComponents(snapshot),
    computedAt: iso(snapshot.computedAt),
    explanation: TRUST_SCORE_PUBLIC_EXPLAINER,
    explanationDetails: buildTrustScoreExplanationDetails(snapshot),
    evidence: buildPublicTrustEvidenceSummary(snapshot),
    presentation: buildPublicTrustPresentationSummary(snapshot),
    separation:
      "The Reliance Trust Score is a verified reliability measure separate from Customer Ratings; it does not use reviews.",
  };
}

/**
 * VENDOR-SAFE shape (vendor viewing their OWN score). Public-safe fields plus improvement
 * hints. Still excludes admin-only internals (inputHash, recalc trigger/source, detail).
 */
export function toVendorTrustScore(snapshot: SnapshotRow | null | undefined) {
  const base = toPublicTrustScore(snapshot);
  return {
    ...base,
    improvementHints: snapshot && base.scored ? buildImprovementHints(snapshot) : [],
  };
}

function parseDetail(detailJson: string | null | undefined): unknown {
  if (!detailJson) return null;
  try {
    return JSON.parse(detailJson);
  } catch {
    return null;
  }
}

/**
 * ADMIN-SAFE shape. Full snapshot including internal inputs and last recalc trigger/source.
 * Still NEVER includes any `Review`/reviewer data — Trust Score and Customer Rating remain
 * separate systems.
 */
export function toAdminTrustScore(snapshot: SnapshotRow | null | undefined) {
  if (!snapshot) {
    return {
      scored: false,
      snapshot: null,
      explanation: TRUST_SCORE_PUBLIC_EXPLAINER,
      explanationDetails: buildTrustScoreExplanationDetails(snapshot),
    };
  }
  return {
    scored: true,
    snapshot: {
      id: snapshot.id ?? null,
      vendorId: snapshot.vendorId ?? null,
      scoreVersion: snapshot.scoreVersion ?? TRUST_SCORE_VERSION,
      totalScorePct: snapshot.totalScorePct ?? null,
      components: publicComponents(snapshot),
      computedAt: iso(snapshot.computedAt),
      periodStart: iso(snapshot.periodStart),
      periodEnd: iso(snapshot.periodEnd),
      isCurrent: snapshot.isCurrent ?? null,
      visibilityStatus: snapshot.visibilityStatus ?? null,
      inputHash: snapshot.inputHash ?? null,
      lastRecalcReason: snapshot.recalcReason ?? null,
      lastRecalcSource: snapshot.recalcSource ?? null,
      detail: parseDetail(snapshot.detailJson),
      createdAt: iso(snapshot.createdAt),
      updatedAt: iso(snapshot.updatedAt),
    },
    improvementHints: buildImprovementHints(snapshot),
    explanation: TRUST_SCORE_PUBLIC_EXPLAINER,
    explanationDetails: buildTrustScoreExplanationDetails(snapshot),
  };
}

type SnapshotReadDb = {
  vendorTrustScoreSnapshot?: { findFirst?: (args: any) => Promise<any> };
};

/** Distinguishes a genuine empty snapshot from a stale Prisma client missing the delegate. */
export type TrustScoreSnapshotReadCapability = "ok" | "delegate_unavailable";

/**
 * Whether this process can read `VendorTrustScoreSnapshot` rows. When `delegate_unavailable`,
 * restart the dev server after `prisma generate` / schema changes — Next.js hot reload does not
 * reload `@prisma/client`.
 */
export function getTrustScoreSnapshotReadCapability(
  db: SnapshotReadDb
): TrustScoreSnapshotReadCapability {
  const delegate = db.vendorTrustScoreSnapshot;
  return delegate?.findFirst ? "ok" : "delegate_unavailable";
}

/**
 * Reads the current snapshot for a vendor. Snapshot-based only — never recalculates.
 */
export async function getCurrentVendorTrustScoreSnapshot(
  db: SnapshotReadDb,
  vendorId: string
): Promise<SnapshotRow | null> {
  if (!vendorId) return null;
  const delegate = db.vendorTrustScoreSnapshot;
  if (!delegate?.findFirst) return null;
  const row = await delegate.findFirst({
    where: { vendorId, isCurrent: true },
    orderBy: { computedAt: "desc" },
  });
  return (row as SnapshotRow) || null;
}
