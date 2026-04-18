import type { FrontierSnapshot } from '../../domain/planning/frontier.js';
import type { PlanEdge } from '../../domain/planning/plan-edge.js';
import type { PlanNode } from '../../domain/planning/plan-node.js';
import type { PlanningEvent } from '../../domain/planning/planning-event.js';
import type {
  PlanningSession,
  PlanningState,
} from '../../domain/planning/planning-session.js';
import type { PlanningScope } from '../../domain/planning/planning-scope.js';
import type { ValidationSnapshot, ValidationVerdict } from '../../domain/planning/validation.js';

export interface PlanningSessionContext {
  readonly worktreePath: string;
  readonly opencodeSessionId: string;
}

export interface PlanningSessionSeed {
  readonly session: PlanningSession;
  readonly scopes: readonly PlanningScope[];
  readonly nodes: readonly PlanNode[];
  readonly edges: readonly PlanEdge[];
  readonly events: readonly PlanningEvent[];
  readonly frontier: FrontierSnapshot;
}

export interface PlanningNodeDecompositionPatch {
  readonly session: PlanningSession;
  readonly previousSessionRevision: number;
  readonly originalParentNode: PlanNode;
  readonly updatedParentNode: PlanNode;
  readonly childNodes: readonly PlanNode[];
  readonly edges: readonly PlanEdge[];
  readonly frontier: FrontierSnapshot;
  readonly events: readonly PlanningEvent[];
}

export interface PlanningValidationRecordPatch {
  readonly session: PlanningSession;
  readonly previousSessionRevision: number;
  readonly validation: ValidationSnapshot;
  readonly updatedNodes: readonly PlanNode[];
  readonly frontier: FrontierSnapshot;
  readonly events: readonly PlanningEvent[];
}

export interface PlanningSessionStorePort {
  createSession(seed: PlanningSessionSeed): Promise<void>;
  activateSession(context: PlanningSessionContext, sessionId: string): Promise<boolean>;
  applyNodeDecomposition(patch: PlanningNodeDecompositionPatch): Promise<void>;
  applyValidationRecord(patch: PlanningValidationRecordPatch): Promise<void>;
}

export interface PlanningSessionQueryPort {
  getActiveSession(context: PlanningSessionContext): Promise<PlanningState | null>;
  getSessionById(worktreePath: string, sessionId: string): Promise<PlanningState | null>;
  listSessions(worktreePath: string): Promise<readonly PlanningSession[]>;
}
