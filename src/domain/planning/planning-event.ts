export interface PlanningEventPayloadByType {
  'session-created': {
    readonly initialProblem: string;
    readonly temperature: number;
    readonly topP: number;
  };
  'scope-created': {
    readonly title: string;
    readonly question: string;
    readonly depth: number;
  };
  'node-created': {
    readonly title: string;
    readonly problemStatement: string;
    readonly category: string;
    readonly status: string;
  };
  'node-decomposed': {
    readonly childNodeIds: readonly string[];
    readonly previousStatus: string;
    readonly nextStatus: string;
  };
  'edge-created': {
    readonly fromNodeId: string;
    readonly toNodeId: string;
    readonly kind: string;
  };
  'frontier-snapshotted': {
    readonly frontierId: string;
    readonly temperature: number;
    readonly depthClamp: number;
    readonly globalEntropy: number;
    readonly reason: 'seed' | 'decomposition' | 'validation';
  };
  'validation-recorded': {
    readonly validationId: string;
    readonly scopeId: string;
    readonly satisfiable: boolean;
    readonly blockingFindings: number;
    readonly pendingBlockingClauses: number;
    readonly clauseCount: number;
  };
  'leaf-completed': {
    readonly nodeId: string;
    readonly completionSummary: string;
  };
}

export const PLANNING_EVENT_TYPES = Object.freeze(
  Object.keys({
    'session-created': true,
    'scope-created': true,
    'node-created': true,
    'node-decomposed': true,
    'edge-created': true,
    'frontier-snapshotted': true,
    'validation-recorded': true,
    'leaf-completed': true,
  }) as (keyof PlanningEventPayloadByType)[]
);

export type PlanningEventType = keyof PlanningEventPayloadByType;

export const RECENT_PLANNING_EVENTS_LIMIT = 10;
export const PLANNING_HISTORY_EVENTS_LIMIT = 25;

export interface PlanningEventBase<Type extends PlanningEventType> {
  readonly id: string;
  readonly sessionId: string;
  readonly scopeId?: string;
  readonly nodeId?: string;
  readonly type: Type;
  readonly payload: PlanningEventPayloadByType[Type];
  readonly occurredAt: string;
}

export type PlanningEvent = {
  [Type in PlanningEventType]: PlanningEventBase<Type>;
}[PlanningEventType];
