import type { PlanningState } from '../../domain/planning/planning-session.js';

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
  readonly invariants: readonly string[];
}

export function buildPlanningSessionSummary(
  state: PlanningState
): PlanningSessionSummary {
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
    invariants: state.session.policy.invariants,
  };
}
