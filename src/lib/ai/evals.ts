import type {
  DisputeSummaryResult,
  ModerationAssistantResult,
  VendorCoachingSummaryResult,
} from "./schemas";

export type AiEvalSignalGroup = readonly string[];

export type ModerationEvalExpectation = {
  expectedDecision: ModerationAssistantResult["decision"];
  expectedConfidence:
    | ModerationAssistantResult["confidence"]
    | readonly ModerationAssistantResult["confidence"][];
  requiredSignalGroups: readonly AiEvalSignalGroup[];
};

export type DisputeEvalExpectation = {
  expectedNextStep: DisputeSummaryResult["recommendedNextStep"];
  expectedConfidence:
    | DisputeSummaryResult["confidence"]
    | readonly DisputeSummaryResult["confidence"][];
  requiredSignalGroups: readonly AiEvalSignalGroup[];
};

export type VendorCoachingEvalExpectation = {
  expectedConfidence:
    | VendorCoachingSummaryResult["confidence"]
    | readonly VendorCoachingSummaryResult["confidence"][];
  requiredSignalGroups: readonly AiEvalSignalGroup[];
};

export type AiEvalOutcome = {
  passed: boolean;
  failures: string[];
};

function normalizeEvalText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function flattenValue(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenValue(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) => flattenValue(item));
  }
  return [];
}

export function matchesAnySignal(text: string, signals: readonly string[]): boolean {
  const haystack = normalizeEvalText(text);
  return signals.some((signal) => haystack.includes(normalizeEvalText(signal)));
}

export function collectModerationAssistantText(result: ModerationAssistantResult): string {
  return flattenValue([
    result.summary,
    result.policyAreas,
    result.findings,
    result.recommendedActions,
  ]).join("\n");
}

export function collectDisputeSummaryText(result: DisputeSummaryResult): string {
  return flattenValue([
    result.summary,
    result.disputeType,
    result.timeline,
    result.disputedPoints,
    result.riskFlags,
  ]).join("\n");
}

export function collectVendorCoachingSummaryText(
  result: VendorCoachingSummaryResult
): string {
  return flattenValue([
    result.summary,
    result.priorityHeadline,
    result.recommendedFocus,
    result.positiveSignals,
    result.watchouts,
    result.nextCheckIn,
  ]).join("\n");
}

function evaluateSignalGroups(
  text: string,
  requiredSignalGroups: readonly AiEvalSignalGroup[],
  failures: string[]
) {
  for (const group of requiredSignalGroups) {
    if (matchesAnySignal(text, group)) continue;
    failures.push(`Missing expected signal group: ${group.join(" | ")}`);
  }
}

function confidenceMatches(
  actual: string,
  expected: string | readonly string[]
): boolean {
  if (Array.isArray(expected)) {
    return expected.includes(actual);
  }
  return actual === expected;
}

function formatExpectedConfidence(expected: string | readonly string[]) {
  return Array.isArray(expected) ? expected.join(" | ") : expected;
}

export function evaluateModerationAssistantExpectation(
  result: ModerationAssistantResult,
  expectation: ModerationEvalExpectation
): AiEvalOutcome {
  const failures: string[] = [];

  if (result.decision !== expectation.expectedDecision) {
    failures.push(
      `Expected decision "${expectation.expectedDecision}" but received "${result.decision}"`
    );
  }

  if (!confidenceMatches(result.confidence, expectation.expectedConfidence)) {
    failures.push(
      `Expected confidence "${formatExpectedConfidence(expectation.expectedConfidence)}" but received "${result.confidence}"`
    );
  }

  evaluateSignalGroups(
    collectModerationAssistantText(result),
    expectation.requiredSignalGroups,
    failures
  );

  return {
    passed: failures.length === 0,
    failures,
  };
}

export function evaluateDisputeSummaryExpectation(
  result: DisputeSummaryResult,
  expectation: DisputeEvalExpectation
): AiEvalOutcome {
  const failures: string[] = [];

  if (result.recommendedNextStep !== expectation.expectedNextStep) {
    failures.push(
      `Expected next step "${expectation.expectedNextStep}" but received "${result.recommendedNextStep}"`
    );
  }

  if (!confidenceMatches(result.confidence, expectation.expectedConfidence)) {
    failures.push(
      `Expected confidence "${formatExpectedConfidence(expectation.expectedConfidence)}" but received "${result.confidence}"`
    );
  }

  evaluateSignalGroups(
    collectDisputeSummaryText(result),
    expectation.requiredSignalGroups,
    failures
  );

  return {
    passed: failures.length === 0,
    failures,
  };
}

export function evaluateVendorCoachingSummaryExpectation(
  result: VendorCoachingSummaryResult,
  expectation: VendorCoachingEvalExpectation
): AiEvalOutcome {
  const failures: string[] = [];

  if (!confidenceMatches(result.confidence, expectation.expectedConfidence)) {
    failures.push(
      `Expected confidence "${formatExpectedConfidence(expectation.expectedConfidence)}" but received "${result.confidence}"`
    );
  }

  evaluateSignalGroups(
    collectVendorCoachingSummaryText(result),
    expectation.requiredSignalGroups,
    failures
  );

  return {
    passed: failures.length === 0,
    failures,
  };
}
