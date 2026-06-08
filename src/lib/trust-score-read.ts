/**
 * Trust Score Phase 1C — read/shaping layer.
 *
 * Pure, snapshot-based formatting helpers for the read-only Trust Score APIs. These
 * functions NEVER recalculate and NEVER read from or write to `Review`; they only shape
 * an already-computed `VendorTrustScoreSnapshot` row into audience-safe payloads.
 *
 * Three audiences with strict field separation:
 *   - public  : total + four component pcts/counts + computedAt + explanation only.
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
  "The Reliance Trust Score is a platform-generated reliability score based on verified, " +
  "finalized Reliance activity (workflow completion, video verification, dispute-free " +
  "completion, and operational reliability). It is calculated by Reliance and is separate " +
  "from voluntary Customer Ratings/reviews.";

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

const COMPONENT_ORDER = [
  "workflowCompletion",
  "videoVerification",
  "disputeFree",
  "operationalReliability",
] as const;

type ComponentKey = (typeof COMPONENT_ORDER)[number];

const TRUST_SCORE_METHODology = [
  "Only finalized Reliance workflow, verification, dispute, and operational outcomes are counted.",
  "Customer Ratings and review sentiment do not change the Reliance Trust Score.",
  "If a component is not yet measurable, its weight is excluded and the remaining weights are renormalized.",
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
        "No finalized Trust Score snapshot is available yet, so there are no measurable score components to explain.",
      strongestSignals: [],
      watchItems: [
        "A vendor needs finalized Reliance activity before the Trust Score becomes explainable.",
      ],
      methodology: TRUST_SCORE_METHODology,
    };
  }

  const components = publicComponents(snapshot);
  const measurable = COMPONENT_ORDER
    .map((key) => ({ key, component: components[key] }))
    .filter(({ component }) => component.pct !== null && component.denominator > 0);
  const unmeasurable = COMPONENT_ORDER
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
        "A Trust Score snapshot exists, but none of the four score components are measurable from finalized Reliance activity yet.",
      coverageSummary: `Measured components account for ${measurableWeightPct}% of the total Trust Score weight. Until a component has finalized qualifying records, it stays out of the score instead of lowering it.`,
      strongestSignals,
      watchItems:
        watchItems.length > 0
          ? watchItems
          : ["More finalized Reliance activity is needed before a meaningful score can be explained."],
      methodology: TRUST_SCORE_METHODology,
    };
  }

  return {
    overview: `This vendor's current Reliance Trust Score is ${snapshot.totalScorePct}%. ${measurable.length} of 4 weighted components are currently measurable from finalized Reliance activity.`,
    coverageSummary: `Measured components currently cover ${measurableWeightPct}% of the configured Trust Score weight. Any unmeasurable components are excluded and the remaining weights are renormalized.`,
    strongestSignals,
    watchItems,
    methodology: TRUST_SCORE_METHODology,
  };
}

/**
 * Generates non-sensitive, vendor-facing improvement hints from measurable components
 * scoring below 100%, lowest first. Returns an empty list when nothing is measurable.
 */
export function buildImprovementHints(snapshot: SnapshotRow): string[] {
  const components = publicComponents(snapshot);
  const measurable = Object.entries(components)
    .filter(([, c]) => c.pct !== null && c.denominator > 0)
    .map(([key, c]) => ({ key, pct: c.pct as number, c }));

  measurable.sort((a, b) => a.pct - b.pct);

  const hints: string[] = [];
  for (const { key, pct, c } of measurable) {
    if (pct >= 100) continue;
    const label = COMPONENT_LABELS[key] || key;
    hints.push(
      `${label}: ${c.numerator} of ${c.denominator} finalized (${pct}%). ` +
        `This metric carries ${c.weightPct}% of the Trust Score.`
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
  if (!snapshot) {
    return {
      scored: false,
      scoreVersion: TRUST_SCORE_VERSION,
      totalScorePct: null,
      components: null,
      computedAt: null,
      explanation: TRUST_SCORE_PUBLIC_EXPLAINER,
      explanationDetails: buildTrustScoreExplanationDetails(snapshot),
      evidence: buildPublicTrustEvidenceSummary(snapshot),
      presentation: buildPublicTrustPresentationSummary(snapshot),
      separation:
        "Reliance Trust Score is separate from Customer Ratings; it does not use reviews.",
    };
  }
  return {
    scored: true,
    scoreVersion: snapshot.scoreVersion ?? TRUST_SCORE_VERSION,
    totalScorePct: snapshot.totalScorePct ?? null,
    components: publicComponents(snapshot),
    computedAt: iso(snapshot.computedAt),
    explanation: TRUST_SCORE_PUBLIC_EXPLAINER,
    explanationDetails: buildTrustScoreExplanationDetails(snapshot),
    evidence: buildPublicTrustEvidenceSummary(snapshot),
    presentation: buildPublicTrustPresentationSummary(snapshot),
    separation:
      "Reliance Trust Score is separate from Customer Ratings; it does not use reviews.",
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
    improvementHints: snapshot ? buildImprovementHints(snapshot) : [],
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
