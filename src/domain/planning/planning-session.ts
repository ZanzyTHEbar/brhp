import type { FrontierSnapshot } from './frontier.js';
import type { PlanEdge } from './plan-edge.js';
import type { PlanningEvent } from './planning-event.js';
import type { PlanNode } from './plan-node.js';
import type { PlanningScope } from './planning-scope.js';
import type { ValidationSnapshot } from './validation.js';

export const PLANNING_SESSION_STATUSES = [
  'draft',
  'exploring',
  'validating',
  'converged',
  'archived',
] as const;

export type PlanningSessionStatus = (typeof PLANNING_SESSION_STATUSES)[number];

export interface PlanningModelControls {
  readonly temperature: number;
  readonly topP: number;
  readonly temperatureFloor: number;
  readonly temperatureCeiling: number;
  readonly minDepthClamp: number;
  readonly maxDepthClamp: number;
  readonly depthClamp: number;
}

export interface PlanningPolicyState {
  readonly policyDocumentIds: readonly string[];
  readonly instructionDocumentIds: readonly string[];
  readonly invariants: readonly string[];
}

export interface PlanningSummaryState {
  readonly globalEntropy: number;
  readonly entropyDrift: number;
  readonly frontierStability: number;
  readonly blockingFindings: number;
  readonly pendingBlockingClauses: number;
  readonly converged: boolean;
  readonly lastFrontierUpdatedAt: string;
}

export interface PlanningSession {
  readonly id: string;
  readonly worktreePath: string;
  readonly opencodeSessionId: string;
  readonly initialProblem: string;
  readonly status: PlanningSessionStatus;
  readonly activeScopeId: string;
  readonly rootNodeId: string;
  readonly revision: number;
  readonly controls: PlanningModelControls;
  readonly policy: PlanningPolicyState;
  readonly summary: PlanningSummaryState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlanningGraph {
  readonly scopes: readonly PlanningScope[];
  readonly nodes: readonly PlanNode[];
  readonly edges: readonly PlanEdge[];
}

export interface PlanningState {
  readonly session: PlanningSession;
  readonly graph: PlanningGraph;
  readonly frontier?: FrontierSnapshot;
  readonly validation?: ValidationSnapshot;
  readonly recentEvents?: readonly PlanningEvent[];
}
