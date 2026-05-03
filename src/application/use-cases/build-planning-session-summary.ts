import type { PlanningState } from '../../domain/planning/planning-session.js';
import type { PlanningEvent } from '../../domain/planning/planning-event.js';

export interface PlanningSessionSummary {
  readonly id: string;
  readonly status: PlanningState['session']['status'];
  readonly initialProblem: string;
  readonly activeScopeId: string;
  readonly scopeCount: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly validation?: {
    readonly satisfiable: boolean;
    readonly blockingFindings: number;
    readonly pendingBlockingClauses: number;
    readonly clauseCount: number;
  };
  readonly frontier?: {
    readonly selectionCount: number;
    readonly topNodeId?: string;
    readonly topNodeTitle?: string;
    readonly topProbability?: number;
    readonly maxValidationPressure: number;
    readonly pressuredSelectionCount: number;
    readonly globalEntropy: number;
    readonly entropyDrift: number;
    readonly frontierStability: number;
  };
  readonly recentActivity?: readonly PlanningActivitySummary[];
  readonly invariants: readonly string[];
}

export interface PlanningActivitySummary {
  readonly occurredAt: string;
  readonly label: string;
}

export function buildPlanningSessionSummary(
  state: PlanningState
): PlanningSessionSummary {
  const nodeById = new Map(state.graph.nodes.map(node => [node.id, node]));
  const topSelection = state.frontier?.selections[0];
  const maxValidationPressure =
    state.frontier && state.frontier.selections.length > 0
      ? Math.max(...state.frontier.selections.map(selection => selection.validationPressure))
      : 0;
  const pressuredSelectionCount =
    state.frontier?.selections.filter(selection => selection.validationPressure > 0).length ?? 0;
  const recentActivity = (state.recentEvents ?? []).map(event => summarizePlanningEvent(event));

  return {
    id: state.session.id,
    status: state.session.status,
    initialProblem: state.session.initialProblem,
    activeScopeId: state.session.activeScopeId,
    scopeCount: state.graph.scopes.length,
    nodeCount: state.graph.nodes.length,
    edgeCount: state.graph.edges.length,
    ...(state.validation
      ? {
          validation: {
            satisfiable: state.validation.satisfiable,
            blockingFindings: state.validation.blockingFindings,
            pendingBlockingClauses: state.validation.pendingBlockingClauses,
            clauseCount: state.validation.formula.clauses.length,
          },
        }
      : state.session.summary.blockingFindings > 0 || state.session.summary.pendingBlockingClauses > 0
        ? {
            validation: {
              satisfiable: false,
              blockingFindings: state.session.summary.blockingFindings,
              pendingBlockingClauses: state.session.summary.pendingBlockingClauses,
              clauseCount: 0,
             },
           }
       : {}),
    ...(state.frontier
      ? {
          frontier: {
            selectionCount: state.frontier.selections.length,
            maxValidationPressure,
            pressuredSelectionCount,
            globalEntropy: state.session.summary.globalEntropy,
            entropyDrift: state.session.summary.entropyDrift,
            frontierStability: state.session.summary.frontierStability,
            ...(topSelection ? { topNodeId: topSelection.nodeId } : {}),
            ...(topSelection && nodeById.get(topSelection.nodeId)?.title
              ? { topNodeTitle: nodeById.get(topSelection.nodeId)!.title }
              : {}),
            ...(topSelection ? { topProbability: topSelection.probability } : {}),
          },
        }
      : {}),
    ...(recentActivity.length > 0 ? { recentActivity } : {}),
    invariants: state.session.policy.invariants,
  };
}

function summarizePlanningEvent(event: PlanningEvent): PlanningActivitySummary {
  switch (event.type) {
    case 'session-created':
      return {
        occurredAt: event.occurredAt,
        label: `Session created for "${event.payload.initialProblem}"`,
      };
    case 'scope-created':
      return {
        occurredAt: event.occurredAt,
        label: `Scope created: ${event.payload.title}`,
      };
    case 'node-created':
      return {
        occurredAt: event.occurredAt,
        label: `Node created: ${event.payload.title}`,
      };
    case 'node-decomposed':
      return {
        occurredAt: event.occurredAt,
        label: `Node decomposed into ${event.payload.childNodeIds.length} children`,
      };
    case 'edge-created':
      return {
        occurredAt: event.occurredAt,
        label: `Edge created: ${event.payload.kind}`,
      };
    case 'frontier-snapshotted':
      return {
        occurredAt: event.occurredAt,
        label: `Frontier recomputed after ${event.payload.reason}`,
      };
    case 'validation-recorded':
      return {
        occurredAt: event.occurredAt,
        label: `Validation recorded: ${event.payload.satisfiable ? 'satisfiable' : 'unsatisfied'} (${event.payload.blockingFindings} blocking, ${event.payload.pendingBlockingClauses} pending)`,
      };
    case 'leaf-completed':
      return {
        occurredAt: event.occurredAt,
        label: `Leaf completed: ${event.payload.completionSummary}`,
      };
  }
}
