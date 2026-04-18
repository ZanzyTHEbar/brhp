import type { ClockPort } from '../ports/clock-port.js';
import type { IdGeneratorPort } from '../ports/id-generator-port.js';
import type { PlanningNodeDecompositionPatch } from '../ports/planning-session-store-port.js';
import {
  computeBoltzmannSelections,
  computeGlobalEntropy,
} from '../../domain/planning/brhp-formalism.js';
import type { FrontierCandidate } from '../../domain/planning/frontier.js';
import type {
  PlanningEvent,
  PlanningEventPayloadByType,
  PlanningEventType,
} from '../../domain/planning/planning-event.js';
import type { PlanningState } from '../../domain/planning/planning-session.js';

export interface DecomposePlanningNodeInput {
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
  readonly state: PlanningState;
  readonly nodeId: string;
  readonly children: readonly DecomposePlanningNodeChildInput[];
}

export interface DecomposePlanningNodeChildInput {
  readonly title: string;
  readonly problemStatement: string;
  readonly category: PlanningState['graph']['nodes'][number]['category'];
  readonly rationale?: string;
}

export function decomposePlanningNode(
  input: DecomposePlanningNodeInput
): PlanningNodeDecompositionPatch {
  const trimmedNodeId = input.nodeId.trim();

  if (trimmedNodeId.length === 0) {
    throw new RangeError('nodeId must not be empty');
  }

  if (input.children.length === 0) {
    throw new RangeError('children must contain at least one child node');
  }

  const parentNode = input.state.graph.nodes.find(node => node.id === trimmedNodeId);

  if (!parentNode) {
    throw new Error(`Planning node '${trimmedNodeId}' does not exist in the active session`);
  }

  if (parentNode.sessionId !== input.state.session.id) {
    throw new Error(`Planning node '${trimmedNodeId}' does not belong to the active session`);
  }

  if (parentNode.status === 'decomposed') {
    throw new Error(`Planning node '${trimmedNodeId}' has already been decomposed`);
  }

  const timestamp = input.clock.now().toISOString();
  const sanitizedChildren = input.children.map((child, index) => sanitizeChildInput(child, index));
  const updatedParentNode = {
    ...parentNode,
    status: 'decomposed' as const,
    updatedAt: timestamp,
  };
  const childNodes = sanitizedChildren.map(child => ({
    id: input.ids.nextId(),
    sessionId: input.state.session.id,
    scopeId: parentNode.scopeId,
    parentNodeId: parentNode.id,
    title: child.title,
    problemStatement: child.problemStatement,
    category: child.category,
    status: 'proposed' as const,
    depth: parentNode.depth + 1,
    ...(child.rationale ? { rationale: child.rationale } : {}),
    scores: {
      utility: 0.5,
      confidence: 0,
      localEntropy: 1,
      validationPressure: 0,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  const edges = childNodes.map(childNode => ({
    id: input.ids.nextId(),
    sessionId: input.state.session.id,
    fromNodeId: parentNode.id,
    toNodeId: childNode.id,
    kind: 'decomposes-to' as const,
    createdAt: timestamp,
  }));
  const candidateNodes = input.state.graph.nodes
    .filter(node => node.id !== parentNode.id)
    .map(node => (node.id === updatedParentNode.id ? updatedParentNode : node))
    .filter(node => isSelectableNode(node.status))
    .concat(childNodes)
    .filter(node => node.scopeId === input.state.session.activeScopeId);
  const candidates: FrontierCandidate[] = candidateNodes.map(node => ({
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
  const nextBlockingFindings = input.state.validation?.blockingFindings ?? input.state.session.summary.blockingFindings;
  const nextPendingBlockingClauses =
    input.state.validation?.pendingBlockingClauses ?? input.state.session.summary.pendingBlockingClauses;
  const frontier = {
    id: input.ids.nextId(),
    sessionId: input.state.session.id,
    scopeId: input.state.session.activeScopeId,
    temperature: input.state.session.controls.temperature,
    globalEntropy,
    depthClamp: input.state.session.controls.depthClamp,
    selections,
    createdAt: timestamp,
  };
  const updatedSession = {
    ...input.state.session,
    revision: input.state.session.revision + 1,
    status: 'exploring' as const,
    summary: {
      ...input.state.session.summary,
      globalEntropy,
      entropyDrift: globalEntropy - input.state.session.summary.globalEntropy,
      frontierStability: computeFrontierStability(
        input.state.frontier?.selections.map(selection => selection.nodeId) ?? [],
        selections.map(selection => selection.nodeId)
      ),
      blockingFindings: nextBlockingFindings,
      pendingBlockingClauses: nextPendingBlockingClauses,
      converged: false,
      lastFrontierUpdatedAt: timestamp,
    },
    updatedAt: timestamp,
  };
  const events: PlanningEvent[] = [
    createEvent(input.ids, {
      sessionId: input.state.session.id,
      scopeId: parentNode.scopeId,
      nodeId: parentNode.id,
      type: 'node-decomposed',
      occurredAt: timestamp,
      payload: {
        childNodeIds: childNodes.map(child => child.id),
        previousStatus: parentNode.status,
        nextStatus: updatedParentNode.status,
      },
    }),
    ...childNodes.map(childNode =>
      createEvent(input.ids, {
        sessionId: input.state.session.id,
        scopeId: childNode.scopeId,
        nodeId: childNode.id,
        type: 'node-created',
        occurredAt: timestamp,
        payload: {
          title: childNode.title,
          problemStatement: childNode.problemStatement,
          category: childNode.category,
          status: childNode.status,
        },
      })
    ),
    ...edges.map(edge =>
      createEvent(input.ids, {
        sessionId: input.state.session.id,
        scopeId: parentNode.scopeId,
        type: 'edge-created',
        occurredAt: timestamp,
        payload: {
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId,
          kind: edge.kind,
        },
      })
    ),
    createEvent(input.ids, {
      sessionId: input.state.session.id,
      scopeId: input.state.session.activeScopeId,
      type: 'frontier-snapshotted',
      occurredAt: timestamp,
      payload: {
        frontierId: frontier.id,
        temperature: frontier.temperature,
        depthClamp: frontier.depthClamp,
        globalEntropy,
      },
    }),
  ];

  return {
    session: updatedSession,
    previousSessionRevision: input.state.session.revision,
    originalParentNode: parentNode,
    updatedParentNode,
    childNodes,
    edges,
    frontier,
    events,
  };
}

function sanitizeChildInput(
  child: DecomposePlanningNodeChildInput,
  index: number
): DecomposePlanningNodeChildInput {
  const title = child.title.trim();
  const problemStatement = child.problemStatement.trim();
  const rationale = child.rationale?.trim();

  if (title.length === 0) {
    throw new RangeError(`children[${index}] title must not be empty`);
  }

  if (problemStatement.length === 0) {
    throw new RangeError(`children[${index}] problemStatement must not be empty`);
  }

  return {
    title,
    problemStatement,
    category: child.category,
    ...(rationale ? { rationale } : {}),
  };
}

function isSelectableNode(status: PlanningState['graph']['nodes'][number]['status']): boolean {
  return status === 'active' || status === 'proposed' || status === 'leaf' || status === 'blocked';
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
