import type { ClockPort } from '../ports/clock-port.js';
import type { IdGeneratorPort } from '../ports/id-generator-port.js';
import type {
  PlanningNodeDecompositionPatch,
  PlanningValidationRecordPatch,
  PlanningSessionContext,
  PlanningSessionQueryPort,
  PlanningSessionStorePort,
  PlanNodeQueryFilter,
  PlanNodeQueryResult,
  PlanNodeWithEdges,
} from '../ports/planning-session-store-port.js';
import { decomposePlanningNode, type DecomposePlanningNodeChildInput } from '../use-cases/decompose-planning-node.js';
import { createPlanningSessionSeed } from '../use-cases/create-planning-session-seed.js';
import {
  recordActiveScopeValidation,
  type RecordActiveScopeValidationClauseInput,
} from '../use-cases/record-active-scope-validation.js';
import { completeLeafNode } from '../use-cases/complete-leaf-node.js';
import type { InstructionInventory } from '../../domain/instructions/instruction.js';
import type { PlanningEvent } from '../../domain/planning/planning-event.js';
import type { PlanningState } from '../../domain/planning/planning-session.js';
import type { PlannerConfig } from '../../domain/planning/planner-config.js';
import type { PlanNode, PlanNodeCategory, PlanNodeStatus } from '../../domain/planning/plan-node.js';

export type PlannerRuntimeMutation =
  | { readonly kind: 'none' }
  | { readonly kind: 'created'; readonly state: PlanningState }
  | { readonly kind: 'resumed'; readonly state: PlanningState }
  | { readonly kind: 'resume-not-found'; readonly sessionId: string }
  | { readonly kind: 'decomposed'; readonly state: PlanningState; readonly nodeId: string }
  | { readonly kind: 'validation-recorded'; readonly state: PlanningState; readonly validationId: string }
  | { readonly kind: 'leaf-completed'; readonly state: PlanningState; readonly nodeId: string };

export interface DecomposePlanningNodeRequest {
  readonly nodeId: string;
  readonly children: readonly DecomposePlanningNodeChildInput[];
}

export interface RecordActiveScopeValidationRequest {
  readonly clauses: readonly RecordActiveScopeValidationClauseInput[];
}

export interface QueryPlannerNodesRequest {
  readonly sessionId?: string;
  readonly scopeId?: string;
  readonly parentNodeId?: string;
  readonly status?: PlanNodeStatus;
  readonly category?: PlanNodeCategory;
  readonly titleContains?: string;
  readonly depth?: number;
  readonly limit?: number;
  readonly offset?: number;
}

export interface PlannerRuntime {
  getActive(context: PlanningSessionContext): Promise<PlanningState | null>;
  getActiveSessionHistory(
    context: PlanningSessionContext,
    limit: number
  ): Promise<
    | {
        readonly active: false;
        readonly events: readonly PlanningEvent[];
      }
    | {
        readonly active: true;
        readonly sessionId: string;
        readonly events: readonly PlanningEvent[];
      }
  >;
  create(
    context: PlanningSessionContext,
    inventory: InstructionInventory,
    problemStatement: string
  ): Promise<PlannerRuntimeMutation>;
  resume(
    context: PlanningSessionContext,
    sessionId: string
  ): Promise<PlannerRuntimeMutation>;
  decomposeNode(
    context: PlanningSessionContext,
    request: DecomposePlanningNodeRequest
  ): Promise<PlannerRuntimeMutation>;
  recordValidation(
    context: PlanningSessionContext,
    request: RecordActiveScopeValidationRequest
  ): Promise<PlannerRuntimeMutation>;
  completeLeafNode(
    context: PlanningSessionContext,
    nodeId: string,
    completionSummary: string
  ): Promise<PlannerRuntimeMutation>;
  queryNodes(
    context: PlanningSessionContext,
    request: QueryPlannerNodesRequest
  ): Promise<PlanNodeQueryResult>;
  getNode(
    context: PlanningSessionContext,
    nodeId: string,
    sessionId?: string
  ): Promise<PlanNodeWithEdges | null>;
  searchNodes(
    context: PlanningSessionContext,
    query: string,
    limit?: number,
    sessionId?: string
  ): Promise<readonly PlanNode[]>;
}

export const DEFAULT_QUERY_NODES_LIMIT = 20;
export const DEFAULT_SEARCH_NODES_LIMIT = 20;

export interface CreatePlannerRuntimeInput {
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
  readonly store: PlanningSessionStorePort & PlanningSessionQueryPort;
  readonly config?: PlannerConfig;
}

export function createPlannerRuntime(input: CreatePlannerRuntimeInput): PlannerRuntime {
  return {
    async getActive(context) {
      return input.store.getActiveSession(context);
    },

    async getActiveSessionHistory(context, limit) {
      const activeState = await input.store.getActiveSession(context);

      if (!activeState) {
        return {
          active: false,
          events: [],
        };
      }

      return {
        active: true,
        sessionId: activeState.session.id,
        events: await input.store.listRecentEvents(activeState.session.id, limit),
      };
    },

    async create(context, inventory, problemStatement) {
      const seed = createPlanningSessionSeed({
        clock: input.clock,
        ids: input.ids,
        worktreePath: context.worktreePath,
        opencodeSessionId: context.opencodeSessionId,
        problemStatement,
        ...(input.config?.temperature !== undefined
          ? { temperature: input.config.temperature }
          : {}),
        ...(input.config?.maxDepth !== undefined
          ? { maxDepthClamp: input.config.maxDepth }
          : {}),
        instructionDocumentIds: inventory.instructions.map(instruction => instruction.id),
        invariants: inventory.instructions.flatMap(extractInstructionInvariants),
      });

      await input.store.createSession(seed);

      const state = await input.store.getActiveSession(context);

      if (!state) {
        throw new Error('Planner session was created but could not be reloaded');
      }

      return {
        kind: 'created',
        state,
      };
    },

    async resume(context, sessionId) {
      const activated = await input.store.activateSession(context, sessionId);

      if (!activated) {
        return {
          kind: 'resume-not-found',
          sessionId,
        };
      }

      const state = await input.store.getActiveSession(context);

      if (!state) {
        throw new Error('Planner session was activated but could not be reloaded');
      }

      return {
        kind: 'resumed',
        state,
      };
    },

    async decomposeNode(context, request) {
      const activeState = await input.store.getActiveSession(context);

      if (!activeState) {
        throw new Error('No active BRHP planning session exists for this OpenCode chat');
      }

      const patch = decomposePlanningNode({
        clock: input.clock,
        ids: input.ids,
        state: activeState,
        nodeId: request.nodeId,
        children: request.children,
      });

      await input.store.applyNodeDecomposition(patch);

      const state = await input.store.getActiveSession(context);

      if (!state) {
        throw new Error('Planner decomposition completed but the active session could not be reloaded');
      }

      return {
        kind: 'decomposed',
        state,
        nodeId: patch.updatedParentNode.id,
      };
    },

    async recordValidation(context, request) {
      const activeState = await input.store.getActiveSession(context);

      if (!activeState) {
        throw new Error('No active BRHP planning session exists for this OpenCode chat');
      }

      const patch = recordActiveScopeValidation({
        clock: input.clock,
        ids: input.ids,
        state: activeState,
        clauses: request.clauses,
      });

      await input.store.applyValidationRecord(patch);

      const state = await input.store.getActiveSession(context);

      if (!state) {
        throw new Error('Planner validation completed but the active session could not be reloaded');
      }

      return {
        kind: 'validation-recorded',
        state,
        validationId: patch.validation.id,
      };
    },

    async completeLeafNode(context, nodeId, completionSummary) {
      const activeState = await input.store.getActiveSession(context);

      if (!activeState) {
        throw new Error('No active BRHP planning session exists for this OpenCode chat');
      }

      const patch = completeLeafNode({
        clock: input.clock,
        ids: input.ids,
        state: activeState,
        nodeId,
        completionSummary,
      });

      await input.store.applyLeafCompletion(patch);

      const state = await input.store.getActiveSession(context);

      if (!state) {
        throw new Error('Leaf completion succeeded but the active session could not be reloaded');
      }

      return {
        kind: 'leaf-completed',
        state,
        nodeId,
      };
    },

    async queryNodes(context, request) {
      const sessionId = await resolveSessionId(input.store, context, request.sessionId);

      if (!sessionId) {
        return { nodes: [], total: 0 };
      }

      return input.store.queryNodes({
        sessionId,
        ...(request.scopeId ? { scopeId: request.scopeId } : {}),
        ...(request.parentNodeId ? { parentNodeId: request.parentNodeId } : {}),
        ...(request.status ? { status: request.status } : {}),
        ...(request.category ? { category: request.category } : {}),
        ...(request.titleContains ? { titleContains: request.titleContains } : {}),
        ...(request.depth !== undefined ? { depth: request.depth } : {}),
        limit: request.limit ?? DEFAULT_QUERY_NODES_LIMIT,
        offset: request.offset ?? 0,
      });
    },

    async getNode(context, nodeId, sessionId) {
      const resolvedSessionId = await resolveSessionId(input.store, context, sessionId);

      if (!resolvedSessionId) {
        return null;
      }

      return input.store.getNodeById(resolvedSessionId, nodeId);
    },

    async searchNodes(context, query, limit, sessionId) {
      const resolvedSessionId = await resolveSessionId(input.store, context, sessionId);

      if (!resolvedSessionId) {
        return [];
      }

      return input.store.searchNodes(resolvedSessionId, query, limit ?? DEFAULT_SEARCH_NODES_LIMIT);
    },
  };
}

async function resolveSessionId(
  store: CreatePlannerRuntimeInput['store'],
  context: PlanningSessionContext,
  sessionId: string | undefined
): Promise<string | null> {
  if (sessionId) {
    const state = await store.getSessionById(context.worktreePath, sessionId);
    return state ? state.session.id : null;
  }

  const active = await store.getActiveSession(context);
  return active ? active.session.id : null;
}

function extractInstructionInvariants(instruction: InstructionInventory['instructions'][number]): string[] {
  const lines = instruction.body
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean);
  const bulletLines = lines
    .filter(line => line.startsWith('- ') || line.startsWith('* '))
    .map(line => line.slice(2).trim())
    .filter(Boolean);

  if (bulletLines.length > 0) {
    return bulletLines;
  }

  return lines.length > 0 ? [lines[0]!] : [instruction.title];
}
