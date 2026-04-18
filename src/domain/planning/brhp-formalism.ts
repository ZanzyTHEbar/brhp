import type { FrontierCandidate, FrontierSelection } from './frontier.js';
import type { PlanNodeStatus } from './plan-node.js';
import type { ValidationFormula, ValidationVerdict } from './validation.js';

const MIN_TEMPERATURE = 0.001;
const MIN_DISTRIBUTION_SUM = 1e-9;

export interface DepthClampInput {
  readonly temperature: number;
  readonly minTemperature: number;
  readonly maxTemperature: number;
  readonly minDepth: number;
  readonly maxDepth: number;
}

export interface ConvergenceInput {
  readonly globalEntropy: number;
  readonly entropyDrift: number;
  readonly frontierStability: number;
  readonly blockingFindings: number;
  readonly pendingBlockingClauses: number;
  readonly entropyThreshold: number;
  readonly driftThreshold: number;
  readonly stabilityThreshold: number;
}

export interface ConvergenceAssessment {
  readonly converged: boolean;
  readonly reasons: readonly string[];
}

export interface ConvergenceThresholds {
  readonly entropyThreshold: number;
  readonly driftThreshold: number;
  readonly stabilityThreshold: number;
}

export const DEFAULT_CONVERGENCE_THRESHOLDS: ConvergenceThresholds = Object.freeze({
  entropyThreshold: 0.2,
  driftThreshold: 0.05,
  stabilityThreshold: 0.9,
});

export interface ValidationPressureInput {
  readonly verdict: ValidationVerdict;
  readonly status: PlanNodeStatus;
  readonly depth: number;
}

export function computeBoltzmannSelections(
  candidates: readonly FrontierCandidate[],
  temperature: number,
  depthClamp: number
): FrontierSelection[] {
  const eligibleCandidates = candidates.filter(candidate => candidate.depth <= depthClamp);

  if (eligibleCandidates.length === 0) {
    return [];
  }

  const safeTemperature = Math.max(MIN_TEMPERATURE, temperature);
  const effectiveUtilities = eligibleCandidates.map(
    candidate => candidate.utility + candidate.validationPressure
  );
  const maxUtility = Math.max(...effectiveUtilities);
  const weights = eligibleCandidates.map(candidate =>
    Math.exp((candidate.utility + candidate.validationPressure - maxUtility) / safeTemperature)
  );
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  return eligibleCandidates
    .map((candidate, index) => {
      const weight = weights[index] ?? 0;

      return {
        nodeId: candidate.nodeId,
        scopeId: candidate.scopeId,
        utility: candidate.utility,
        localEntropy: candidate.localEntropy,
        validationPressure: candidate.validationPressure,
        probability: weight / weightSum,
        depthClamp,
      };
    })
    .sort(
      (left, right) =>
        right.probability - left.probability ||
        right.validationPressure - left.validationPressure ||
        right.utility - left.utility ||
        left.nodeId.localeCompare(right.nodeId)
    )
    .map((selection, index) => ({
      ...selection,
      rank: index + 1,
    }));
}

export function computeDepthClamp(input: DepthClampInput): number {
  const normalizedTemperature = normalizeTemperature(
    input.temperature,
    input.minTemperature,
    input.maxTemperature
  );
  const depthSpan = input.maxDepth - input.minDepth;
  const unclampedDepth = input.minDepth + Math.round((1 - normalizedTemperature) * depthSpan);

  return clamp(unclampedDepth, input.minDepth, input.maxDepth);
}

export function computeEntropy(probabilities: readonly number[]): number {
  if (probabilities.length === 0) {
    return 0;
  }

  return probabilities.reduce((entropy, probability) => {
    if (probability <= 0) {
      return entropy;
    }

    return entropy - probability * Math.log2(probability);
  }, 0);
}

export function computeGlobalEntropy(
  selections: readonly Pick<FrontierSelection, 'probability' | 'localEntropy'>[]
): number {
  if (selections.length === 0) {
    return 0;
  }

  const probabilitySum = selections.reduce(
    (sum, selection) => sum + selection.probability,
    0
  );
  const normalizationFactor = probabilitySum > MIN_DISTRIBUTION_SUM ? probabilitySum : 1;

  return selections.reduce(
    (sum, selection) =>
      sum + (selection.probability / normalizationFactor) * selection.localEntropy,
    0
  );
}

export function evaluateValidationFormula(
  formula: ValidationFormula
): ValidationVerdict {
  const blockingFindings = formula.clauses.filter(
    clause => clause.blocking && clause.status === 'failed'
  ).length;
  const pendingBlockingClauses = formula.clauses.filter(
    clause => clause.blocking && clause.status !== 'passed'
  ).length;

  return {
    formula,
    satisfiable: blockingFindings === 0 && pendingBlockingClauses === 0,
    blockingFindings,
    pendingBlockingClauses,
  };
}

export function computeValidationPressure(
  input: ValidationPressureInput
): number {
  if (input.verdict.satisfiable) {
    return 0;
  }

  const severity =
    input.verdict.blockingFindings > 0
      ? 1
      : input.verdict.pendingBlockingClauses > 0
        ? 0.5
        : 0;
  const statusWeight = getValidationPressureStatusWeight(input.status);

  if (severity === 0 || statusWeight === 0) {
    return 0;
  }

  const depthFactor = 1 / (input.depth + 1);

  return clamp(severity * statusWeight * depthFactor, 0, 1);
}

export function evaluateConvergence(
  input: ConvergenceInput
): ConvergenceAssessment {
  const reasons: string[] = [];

  if (input.globalEntropy > input.entropyThreshold) {
    reasons.push('global entropy exceeds threshold');
  }

  if (Math.abs(input.entropyDrift) > input.driftThreshold) {
    reasons.push('entropy drift exceeds threshold');
  }

  if (input.frontierStability < input.stabilityThreshold) {
    reasons.push('frontier stability below threshold');
  }

  if (input.blockingFindings > 0) {
    reasons.push('blocking validation findings remain');
  }

  if (input.pendingBlockingClauses > 0) {
    reasons.push('blocking validation clauses are pending');
  }

  return {
    converged: reasons.length === 0,
    reasons,
  };
}

function normalizeTemperature(
  temperature: number,
  minTemperature: number,
  maxTemperature: number
): number {
  if (maxTemperature <= minTemperature) {
    return 0;
  }

  return clamp(
    (temperature - minTemperature) / (maxTemperature - minTemperature),
    0,
    1
  );
}

function getValidationPressureStatusWeight(status: PlanNodeStatus): number {
  switch (status) {
    case 'active':
      return 1;
    case 'blocked':
      return 1.25;
    case 'proposed':
      return 0.9;
    case 'leaf':
      return 0.75;
    case 'decomposed':
    case 'pruned':
      return 0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
