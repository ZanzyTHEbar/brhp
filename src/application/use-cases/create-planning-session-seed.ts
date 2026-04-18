import type { ClockPort } from '../ports/clock-port.js';
import type { IdGeneratorPort } from '../ports/id-generator-port.js';
import type { PlanningSessionSeed } from '../ports/planning-session-store-port.js';
import {
  computeBoltzmannSelections,
  computeDepthClamp,
  computeGlobalEntropy,
} from '../../domain/planning/brhp-formalism.js';
import type {
  PlanningEvent,
  PlanningEventBase,
  PlanningEventPayloadByType,
  PlanningEventType,
} from '../../domain/planning/planning-event.js';
import type { FrontierCandidate } from '../../domain/planning/frontier.js';
import type { PlanNode } from '../../domain/planning/plan-node.js';

const DEFAULT_TEMPERATURE = 0.35;
const DEFAULT_TOP_P = 0.9;
const DEFAULT_TEMPERATURE_FLOOR = 0.1;
const DEFAULT_TEMPERATURE_CEILING = 1;
const DEFAULT_MIN_DEPTH_CLAMP = 1;
const DEFAULT_MAX_DEPTH_CLAMP = 5;

export interface CreatePlanningSessionSeedInput {
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
  readonly worktreePath: string;
  readonly opencodeSessionId: string;
  readonly problemStatement: string;
  readonly title?: string;
  readonly temperature?: number;
  readonly topP?: number;
  readonly temperatureFloor?: number;
  readonly temperatureCeiling?: number;
  readonly minDepthClamp?: number;
  readonly maxDepthClamp?: number;
  readonly policyDocumentIds?: readonly string[];
  readonly instructionDocumentIds?: readonly string[];
  readonly invariants?: readonly string[];
}

export function createPlanningSessionSeed(
  input: CreatePlanningSessionSeedInput
): PlanningSessionSeed {
  const problemStatement = input.problemStatement.trim();

  if (problemStatement.length === 0) {
    throw new RangeError('problemStatement must not be empty');
  }

  const temperature = input.temperature ?? DEFAULT_TEMPERATURE;
  const topP = input.topP ?? DEFAULT_TOP_P;
  const temperatureFloor = input.temperatureFloor ?? DEFAULT_TEMPERATURE_FLOOR;
  const temperatureCeiling = input.temperatureCeiling ?? DEFAULT_TEMPERATURE_CEILING;
  const minDepthClamp = input.minDepthClamp ?? DEFAULT_MIN_DEPTH_CLAMP;
  const maxDepthClamp = input.maxDepthClamp ?? DEFAULT_MAX_DEPTH_CLAMP;

  validatePlanningControls({
    temperature,
    topP,
    temperatureFloor,
    temperatureCeiling,
    minDepthClamp,
    maxDepthClamp,
  });

  const createdAt = input.clock.now().toISOString();
  const sessionId = input.ids.nextId();
  const scopeId = input.ids.nextId();
  const nodeId = input.ids.nextId();
  const frontierId = input.ids.nextId();
  const depthClamp = computeDepthClamp({
    temperature,
    minTemperature: temperatureFloor,
    maxTemperature: temperatureCeiling,
    minDepth: minDepthClamp,
    maxDepth: maxDepthClamp,
  });
  const rootNode = createRootNode({
    sessionId,
    scopeId,
    nodeId,
    problemStatement,
    createdAt,
    ...(input.title ? { title: input.title } : {}),
  });
  const frontierCandidates: FrontierCandidate[] = [
    {
      nodeId: rootNode.id,
      scopeId,
      utility: rootNode.scores.utility,
      localEntropy: rootNode.scores.localEntropy,
      validationPressure: rootNode.scores.validationPressure,
      depth: rootNode.depth,
    },
  ];
  const selections = computeBoltzmannSelections(
    frontierCandidates,
    temperature,
    depthClamp
  );
  const globalEntropy = computeGlobalEntropy(selections);
  const session = {
    id: sessionId,
    worktreePath: input.worktreePath,
    opencodeSessionId: input.opencodeSessionId,
    initialProblem: problemStatement,
    status: 'exploring' as const,
    activeScopeId: scopeId,
    rootNodeId: rootNode.id,
    controls: {
      temperature,
      topP,
      temperatureFloor,
      temperatureCeiling,
      minDepthClamp,
      maxDepthClamp,
      depthClamp,
    },
    policy: {
      policyDocumentIds: [...(input.policyDocumentIds ?? [])],
      instructionDocumentIds: [...(input.instructionDocumentIds ?? [])],
      invariants: [...(input.invariants ?? [])],
    },
    summary: {
      globalEntropy,
      entropyDrift: 0,
      frontierStability: 1,
      blockingFindings: 0,
      pendingBlockingClauses: 0,
      converged: false,
      lastFrontierUpdatedAt: createdAt,
    },
    createdAt,
    updatedAt: createdAt,
  };
  const scope = {
    id: scopeId,
    sessionId,
    rootNodeId: rootNode.id,
    title: rootNode.title,
    question: problemStatement,
    depth: 0,
    status: 'active' as const,
    createdAt,
    updatedAt: createdAt,
  };
  const frontier = {
    id: frontierId,
    sessionId,
    scopeId,
    temperature,
    globalEntropy,
    depthClamp,
    selections,
    createdAt,
  };

  return {
    session,
    scopes: [scope],
    nodes: [rootNode],
    edges: [],
    events: [
      createEvent(input.ids, {
        sessionId,
        scopeId,
        type: 'session-created',
        occurredAt: createdAt,
        payload: {
          initialProblem: problemStatement,
          temperature,
          topP,
        },
      }),
      createEvent(input.ids, {
        sessionId,
        scopeId,
        type: 'scope-created',
        occurredAt: createdAt,
        payload: {
          title: scope.title,
          question: scope.question,
          depth: scope.depth,
        },
      }),
      createEvent(input.ids, {
        sessionId,
        scopeId,
        nodeId: rootNode.id,
        type: 'node-created',
        occurredAt: createdAt,
        payload: {
          title: rootNode.title,
          problemStatement: rootNode.problemStatement,
          category: rootNode.category,
          status: rootNode.status,
        },
      }),
      createEvent(input.ids, {
        sessionId,
        scopeId,
        type: 'frontier-snapshotted',
        occurredAt: createdAt,
        payload: {
          frontierId,
          temperature,
          depthClamp,
          globalEntropy,
        },
      }),
    ],
    frontier,
  };
}

function createRootNode(input: {
  readonly sessionId: string;
  readonly scopeId: string;
  readonly nodeId: string;
  readonly problemStatement: string;
  readonly title?: string;
  readonly createdAt: string;
}): PlanNode {
  return {
    id: input.nodeId,
    sessionId: input.sessionId,
    scopeId: input.scopeId,
    title: input.title ?? deriveRootTitle(input.problemStatement),
    problemStatement: input.problemStatement,
    category: 'cross-cutting',
    status: 'active',
    depth: 0,
    scores: {
      utility: 1,
      confidence: 0,
      localEntropy: 0,
      validationPressure: 0,
    },
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

function createEvent(
  ids: IdGeneratorPort,
  input: {
    readonly sessionId: string;
    readonly scopeId?: string;
    readonly nodeId?: string;
    readonly type: PlanningEventType;
    readonly occurredAt: string;
    readonly payload: PlanningEventPayloadByType[PlanningEventType];
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

function deriveRootTitle(problemStatement: string): string {
  const firstLine = problemStatement
    .split(/\r?\n/u)
    .map(line => line.trim())
    .find(Boolean);
  const trimmedProblemStatement = problemStatement.trim();
  const titleSource =
    firstLine ??
    (trimmedProblemStatement.length > 0 ? trimmedProblemStatement : 'Untitled BRHP problem');

  return titleSource.length > 72 ? `${titleSource.slice(0, 69).trimEnd()}...` : titleSource;
}

function validatePlanningControls(input: {
  readonly temperature: number;
  readonly topP: number;
  readonly temperatureFloor: number;
  readonly temperatureCeiling: number;
  readonly minDepthClamp: number;
  readonly maxDepthClamp: number;
}): void {
  assertFiniteNumber('temperature', input.temperature);
  assertFiniteNumber('topP', input.topP);
  assertFiniteNumber('temperatureFloor', input.temperatureFloor);
  assertFiniteNumber('temperatureCeiling', input.temperatureCeiling);
  assertInteger('minDepthClamp', input.minDepthClamp);
  assertInteger('maxDepthClamp', input.maxDepthClamp);

  if (input.topP <= 0 || input.topP > 1) {
    throw new RangeError('topP must be greater than 0 and less than or equal to 1');
  }

  if (input.temperatureFloor < 0) {
    throw new RangeError('temperatureFloor must be greater than or equal to 0');
  }

  if (input.temperatureCeiling <= input.temperatureFloor) {
    throw new RangeError('temperatureCeiling must be greater than temperatureFloor');
  }

  if (
    input.temperature < input.temperatureFloor ||
    input.temperature > input.temperatureCeiling
  ) {
    throw new RangeError('temperature must be within the inclusive floor/ceiling range');
  }

  if (input.minDepthClamp < 0) {
    throw new RangeError('minDepthClamp must be greater than or equal to 0');
  }

  if (input.maxDepthClamp < input.minDepthClamp) {
    throw new RangeError('maxDepthClamp must be greater than or equal to minDepthClamp');
  }
}

function assertFiniteNumber(label: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number`);
  }
}

function assertInteger(label: string, value: number): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer`);
  }
}
