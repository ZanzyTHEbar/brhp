import type { ClockPort } from '../ports/clock-port.js';
import type { IdGeneratorPort } from '../ports/id-generator-port.js';
import type {
  PlanningNodeDecompositionPatch,
  PlanningValidationRecordPatch,
  PlanningSessionContext,
  PlanningSessionQueryPort,
  PlanningSessionStorePort,
} from '../ports/planning-session-store-port.js';
import { decomposePlanningNode, type DecomposePlanningNodeChildInput } from '../use-cases/decompose-planning-node.js';
import { createPlanningSessionSeed } from '../use-cases/create-planning-session-seed.js';
import {
  recordActiveScopeValidation,
  type RecordActiveScopeValidationClauseInput,
} from '../use-cases/record-active-scope-validation.js';
import type { InstructionInventory } from '../../domain/instructions/instruction.js';
import type { PlanningState } from '../../domain/planning/planning-session.js';

export type PlannerRuntimeMutation =
  | { readonly kind: 'none' }
  | { readonly kind: 'created'; readonly state: PlanningState }
  | { readonly kind: 'resumed'; readonly state: PlanningState }
  | { readonly kind: 'resume-not-found'; readonly sessionId: string }
  | { readonly kind: 'decomposed'; readonly state: PlanningState; readonly nodeId: string }
  | { readonly kind: 'validation-recorded'; readonly state: PlanningState; readonly validationId: string };

export interface DecomposePlanningNodeRequest {
  readonly nodeId: string;
  readonly children: readonly DecomposePlanningNodeChildInput[];
}

export interface RecordActiveScopeValidationRequest {
  readonly clauses: readonly RecordActiveScopeValidationClauseInput[];
}

export interface PlannerRuntime {
  getActive(context: PlanningSessionContext): Promise<PlanningState | null>;
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
}

export interface CreatePlannerRuntimeInput {
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
  readonly store: PlanningSessionStorePort & PlanningSessionQueryPort;
}

export function createPlannerRuntime(input: CreatePlannerRuntimeInput): PlannerRuntime {
  return {
    async getActive(context) {
      return input.store.getActiveSession(context);
    },

    async create(context, inventory, problemStatement) {
      const seed = createPlanningSessionSeed({
        clock: input.clock,
        ids: input.ids,
        worktreePath: context.worktreePath,
        opencodeSessionId: context.opencodeSessionId,
        problemStatement,
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
  };
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
