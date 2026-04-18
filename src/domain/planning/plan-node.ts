export const PLAN_NODE_CATEGORIES = [
  'dependent',
  'isolated',
  'parallelizable',
  'cross-cutting',
] as const;

export type PlanNodeCategory = (typeof PLAN_NODE_CATEGORIES)[number];

export const PLAN_NODE_STATUSES = [
  'proposed',
  'active',
  'decomposed',
  'leaf',
  'pruned',
  'blocked',
] as const;

export type PlanNodeStatus = (typeof PLAN_NODE_STATUSES)[number];

export interface PlanNodeScores {
  readonly utility: number;
  readonly confidence: number;
  readonly localEntropy: number;
  readonly validationPressure: number;
}

export interface PlanNode {
  readonly id: string;
  readonly sessionId: string;
  readonly scopeId: string;
  readonly parentNodeId?: string;
  readonly title: string;
  readonly problemStatement: string;
  readonly logicalForm?: string;
  readonly category: PlanNodeCategory;
  readonly status: PlanNodeStatus;
  readonly depth: number;
  readonly rationale?: string;
  readonly scores: PlanNodeScores;
  readonly createdAt: string;
  readonly updatedAt: string;
}
