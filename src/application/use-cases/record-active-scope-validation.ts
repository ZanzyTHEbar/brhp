import type { ClockPort } from '../ports/clock-port.js';
import type { IdGeneratorPort } from '../ports/id-generator-port.js';
import type { PlanningValidationRecordPatch } from '../ports/planning-session-store-port.js';
import { evaluateValidationFormula } from '../../domain/planning/brhp-formalism.js';
import type {
  PlanningEvent,
  PlanningEventPayloadByType,
  PlanningEventType,
} from '../../domain/planning/planning-event.js';
import type { PlanningState } from '../../domain/planning/planning-session.js';
import type {
  ValidationClause,
  ValidationClauseKind,
  ValidationClauseStatus,
  ValidationSnapshot,
  ValidationFormula,
} from '../../domain/planning/validation.js';
import {
  createFrontierSnapshotPayload,
  recomputeActiveFrontier,
} from './recompute-active-frontier.js';

export interface RecordActiveScopeValidationInput {
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
  readonly state: PlanningState;
  readonly clauses: readonly RecordActiveScopeValidationClauseInput[];
}

export interface RecordActiveScopeValidationClauseInput {
  readonly id?: string;
  readonly kind: ValidationClauseKind;
  readonly blocking: boolean;
  readonly description: string;
  readonly status: ValidationClauseStatus;
  readonly message?: string;
}

export function recordActiveScopeValidation(
  input: RecordActiveScopeValidationInput
): PlanningValidationRecordPatch {
  if (input.clauses.length === 0) {
    throw new RangeError('clauses must contain at least one validation clause');
  }

  const createdAt = input.clock.now().toISOString();
  const clauses = input.clauses.map((clause, index) => sanitizeClauseInput(clause, index, input.ids));
  const formula: ValidationFormula = {
    scopeId: input.state.session.activeScopeId,
    clauses,
  };
  const verdict = evaluateValidationFormula(formula);
  const validation: ValidationSnapshot = {
    id: input.ids.nextId(),
    sessionId: input.state.session.id,
    scopeId: input.state.session.activeScopeId,
    ...verdict,
    createdAt,
  };
  const frontierUpdate = recomputeActiveFrontier({
    ids: input.ids,
    state: {
      ...input.state,
      validation,
    },
    nodes: input.state.graph.nodes,
    occurredAt: createdAt,
  });
  const nextConverged = input.state.session.summary.converged && verdict.satisfiable;
  const nextStatus: PlanningState['session']['status'] =
    input.state.session.status === 'archived'
      ? 'archived'
      : nextConverged
        ? 'converged'
        : 'validating';
  const session = {
    ...input.state.session,
    revision: input.state.session.revision + 1,
    status: nextStatus,
    summary: {
      ...input.state.session.summary,
      globalEntropy: frontierUpdate.summary.globalEntropy,
      entropyDrift: frontierUpdate.summary.entropyDrift,
      frontierStability: frontierUpdate.summary.frontierStability,
      blockingFindings: verdict.blockingFindings,
      pendingBlockingClauses: verdict.pendingBlockingClauses,
      converged: nextConverged,
      lastFrontierUpdatedAt: frontierUpdate.summary.lastFrontierUpdatedAt,
    },
    updatedAt: createdAt,
  };
  const events: PlanningEvent[] = [
    createEvent(input.ids, {
      sessionId: input.state.session.id,
      scopeId: input.state.session.activeScopeId,
      type: 'validation-recorded',
      occurredAt: createdAt,
      payload: {
        validationId: validation.id,
        scopeId: input.state.session.activeScopeId,
        satisfiable: validation.satisfiable,
        blockingFindings: validation.blockingFindings,
        pendingBlockingClauses: validation.pendingBlockingClauses,
        clauseCount: clauses.length,
      },
    }),
    createEvent(input.ids, {
      sessionId: input.state.session.id,
      scopeId: input.state.session.activeScopeId,
      type: 'frontier-snapshotted',
      occurredAt: createdAt,
      payload: createFrontierSnapshotPayload(frontierUpdate.frontier, 'validation'),
    }),
  ];

  return {
    session,
    previousSessionRevision: input.state.session.revision,
    validation,
    updatedNodes: frontierUpdate.nodes.filter(
      node => node.scopeId === input.state.session.activeScopeId
    ),
    frontier: frontierUpdate.frontier,
    events,
  };
}

function sanitizeClauseInput(
  clause: RecordActiveScopeValidationClauseInput,
  index: number,
  ids: IdGeneratorPort
): ValidationClause {
  const description = clause.description.trim();
  const message = clause.message?.trim();

  if (description.length === 0) {
    throw new RangeError(`clauses[${index}] description must not be empty`);
  }

  return {
    id: clause.id?.trim() || ids.nextId(),
    kind: clause.kind,
    blocking: clause.blocking,
    description,
    status: clause.status,
    ...(message ? { message } : {}),
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
