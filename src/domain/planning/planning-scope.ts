export const PLANNING_SCOPE_STATUSES = ['active', 'completed', 'archived'] as const;

export type PlanningScopeStatus = (typeof PLANNING_SCOPE_STATUSES)[number];

export interface ScopeTransferSummary {
  readonly graphDeltaSummary: string;
  readonly scopeSummary: string;
  readonly confidence: number;
}

export interface PlanningScope {
  readonly id: string;
  readonly sessionId: string;
  readonly parentScopeId?: string;
  readonly rootNodeId: string;
  readonly title: string;
  readonly question: string;
  readonly depth: number;
  readonly status: PlanningScopeStatus;
  readonly transferSummary?: ScopeTransferSummary;
  readonly createdAt: string;
  readonly updatedAt: string;
}
