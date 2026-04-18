import type { IdGeneratorPort } from '../ports/id-generator-port.js';
import {
  computeBoltzmannSelections,
  computeGlobalEntropy,
  computeValidationPressure,
} from '../../domain/planning/brhp-formalism.js';
import type { FrontierCandidate, FrontierSnapshot } from '../../domain/planning/frontier.js';
import type { PlanNode } from '../../domain/planning/plan-node.js';
import type { PlanningEventPayloadByType } from '../../domain/planning/planning-event.js';
import type { PlanningState } from '../../domain/planning/planning-session.js';

export interface RecomputeActiveFrontierInput {
  readonly ids: IdGeneratorPort;
  readonly state: Pick<PlanningState, 'session' | 'frontier' | 'validation'>;
  readonly nodes: readonly PlanNode[];
  readonly occurredAt: string;
}

export interface RecomputedActiveFrontier {
  readonly nodes: readonly PlanNode[];
  readonly frontier: FrontierSnapshot;
  readonly summary: Pick<
    PlanningState['session']['summary'],
    'globalEntropy' | 'entropyDrift' | 'frontierStability' | 'lastFrontierUpdatedAt'
  >;
}

export function recomputeActiveFrontier(
  input: RecomputeActiveFrontierInput
): RecomputedActiveFrontier {
  const nodes = input.nodes.map(node => applyValidationPressure(node, input));
  const candidates: FrontierCandidate[] = nodes
    .filter(node => node.scopeId === input.state.session.activeScopeId)
    .filter(node => isSelectableNodeStatus(node.status))
    .map(node => ({
      nodeId: node.id,
      scopeId: node.scopeId,
      utility: node.scores.utility,
      localEntropy: node.scores.localEntropy,
      validationPressure: node.scores.validationPressure,
      depth: node.depth,
    }));
  const selections = computeBoltzmannSelections(
    candidates,
    input.state.session.controls.temperature,
    input.state.session.controls.depthClamp
  );
  const globalEntropy = computeGlobalEntropy(selections);
  const frontier = {
    id: input.ids.nextId(),
    sessionId: input.state.session.id,
    scopeId: input.state.session.activeScopeId,
    temperature: input.state.session.controls.temperature,
    globalEntropy,
    depthClamp: input.state.session.controls.depthClamp,
    selections,
    createdAt: input.occurredAt,
  } satisfies FrontierSnapshot;

  return {
    nodes,
    frontier,
    summary: {
      globalEntropy,
      entropyDrift: globalEntropy - input.state.session.summary.globalEntropy,
      frontierStability: computeFrontierStability(
        input.state.frontier?.selections.map(selection => selection.nodeId) ?? [],
        selections.map(selection => selection.nodeId)
      ),
      lastFrontierUpdatedAt: input.occurredAt,
    },
  };
}

export function createFrontierSnapshotPayload(
  frontier: FrontierSnapshot,
  reason: PlanningEventPayloadByType['frontier-snapshotted']['reason']
): PlanningEventPayloadByType['frontier-snapshotted'] {
  return {
    frontierId: frontier.id,
    temperature: frontier.temperature,
    depthClamp: frontier.depthClamp,
    globalEntropy: frontier.globalEntropy,
    reason,
  };
}

export function isSelectableNodeStatus(status: PlanNode['status']): boolean {
  return status === 'active' || status === 'proposed' || status === 'leaf' || status === 'blocked';
}

function applyValidationPressure(
  node: PlanNode,
  input: RecomputeActiveFrontierInput
): PlanNode {
  if (node.scopeId !== input.state.session.activeScopeId || !input.state.validation) {
    return node;
  }

  const validationPressure = computeValidationPressure({
    verdict: input.state.validation,
    status: node.status,
    depth: node.depth,
  });

  if (validationPressure === node.scores.validationPressure) {
    return node;
  }

  return {
    ...node,
    scores: {
      ...node.scores,
      validationPressure,
    },
    updatedAt: input.occurredAt,
  };
}

function computeFrontierStability(
  previousNodeIds: readonly string[],
  nextNodeIds: readonly string[]
): number {
  const previous = new Set(previousNodeIds);
  const next = new Set(nextNodeIds);
  const union = new Set([...previous, ...next]);

  if (union.size === 0) {
    return 1;
  }

  let shared = 0;
  for (const nodeId of union) {
    if (previous.has(nodeId) && next.has(nodeId)) {
      shared += 1;
    }
  }

  return shared / union.size;
}
