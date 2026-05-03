import type { ClockPort } from '../ports/clock-port.js';
import type { IdGeneratorPort } from '../ports/id-generator-port.js';
import type { PlanningLeafCompletionPatch } from '../ports/planning-session-store-port.js';
import type { PlanningEvent } from '../../domain/planning/planning-event.js';
import type { PlanningEventPayloadByType, PlanningEventType } from '../../domain/planning/planning-event.js';
import type { PlanningState } from '../../domain/planning/planning-session.js';

export type { PlanningLeafCompletionPatch } from '../ports/planning-session-store-port.js';

export interface CompleteLeafNodeInput {
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
  readonly state: PlanningState;
  readonly nodeId: string;
  readonly completionSummary: string;
}

export function completeLeafNode(
  input: CompleteLeafNodeInput
): PlanningLeafCompletionPatch {
  const trimmedNodeId = input.nodeId.trim();

  if (trimmedNodeId.length === 0) {
    throw new RangeError('nodeId must not be empty');
  }

  const summary = input.completionSummary.trim();

  if (summary.length === 0) {
    throw new RangeError('completionSummary must not be empty');
  }

  if (input.state.session.status === 'archived') {
    throw new Error('Archived BRHP planning sessions cannot complete leaf nodes');
  }

  const node = input.state.graph.nodes.find(
    candidate => candidate.id === trimmedNodeId
  );

  if (!node) {
    throw new Error(`Planning node '${trimmedNodeId}' does not exist in the active session`);
  }

  if (node.sessionId !== input.state.session.id) {
    throw new Error(`Planning node '${trimmedNodeId}' does not belong to the active session`);
  }

  if (node.status !== 'leaf') {
    throw new Error(
      `Planning node '${trimmedNodeId}' has status '${node.status}' and cannot be completed as a leaf`
    );
  }

  const timestamp = input.clock.now().toISOString();

  const updatedSession = {
    ...input.state.session,
    revision: input.state.session.revision + 1,
    updatedAt: timestamp,
  };

  const events: PlanningEvent[] = [
    createEvent(input.ids, {
      sessionId: input.state.session.id,
      scopeId: node.scopeId,
      nodeId: node.id,
      type: 'leaf-completed',
      occurredAt: timestamp,
      payload: {
        nodeId: node.id,
        completionSummary: summary,
      },
    }),
  ];

  return {
    session: updatedSession,
    previousSessionRevision: input.state.session.revision,
    events,
  };
}

function createEvent<Type extends PlanningEventType>(
  ids: IdGeneratorPort,
  input: {
    readonly sessionId: string;
    readonly scopeId?: string;
    readonly nodeId?: string;
    readonly type: Type;
    readonly occurredAt: string;
    readonly payload: PlanningEventPayloadByType[Type];
  }
): PlanningEvent {
  return {
    id: ids.nextId(),
    sessionId: input.sessionId,
    ...(input.scopeId ? { scopeId: input.scopeId } : {}),
    ...(input.nodeId ? { nodeId: input.nodeId } : {}),
    type: input.type,
    payload: input.payload,
    occurredAt: input.occurredAt,
  } as PlanningEvent;
}
