import path from 'node:path';

import type { Hooks, PluginInput } from '@opencode-ai/plugin';

import { parseBrhpCommand } from '../application/use-cases/parse-brhp-command.js';
import { buildSlashCommandResponse } from '../application/use-cases/build-slash-command-response.js';
import { classifyRuntimeDiagnostic } from '../application/use-cases/classify-runtime-diagnostic.js';
import type { BrhpRuntimeDiagnostic } from '../application/use-cases/classify-runtime-diagnostic.js';
import { buildSystemPromptSection } from '../application/use-cases/build-system-prompt-section.js';
import type { PlannerRuntime } from '../application/services/planner-runtime.js';
import type { PlannerRuntimeMutation } from '../application/services/planner-runtime.js';
import type { InstructionInventory } from '../domain/instructions/instruction.js';
import type { PlanningState } from '../domain/planning/planning-session.js';
import { PLANNING_HISTORY_EVENTS_LIMIT } from '../domain/planning/planning-event.js';
import { withPlannerRuntimeForWorktree } from './create-planner-runtime.js';
import { createPlannerTools } from './create-planner-tools.js';
import { createInstructionInventoryLoader } from './create-instruction-inventory-loader.js';
import {
  resolveServerProjectWorktreePath,
  resolveServerProjectWorktreePathWithoutSession,
} from './resolve-project-worktree-path.js';
import {
  BRHP_COMMAND_DESCRIPTION,
  BRHP_COMMAND_NAME,
} from '../domain/slash-command/brhp-command.js';

export interface ServerPlannerRuntimeAccess {
  withRuntime<Result>(
    sessionID: string,
    worktreePath: string,
    execute: (runtime: PlannerRuntime) => Promise<Result>
  ): Promise<Result>;
}

export async function createServerPluginHooks(
  input: PluginInput
): Promise<Hooks> {
  return createServerPluginHooksWithRuntimeAccess(input, {
    async withRuntime(_sessionID, worktreePath, execute) {
      return withPlannerRuntimeForWorktree(worktreePath, execute);
    },
  });
}

export async function createServerPluginHooksWithRuntimeAccess(
  input: PluginInput,
  runtimeAccess: ServerPlannerRuntimeAccess
): Promise<Hooks> {
  const resolveProjectDirectory = async (
    sessionID: string,
    runtimeCandidates?: {
      readonly worktree?: string | null;
      readonly directory?: string | null;
    }
  ) => {
    return resolveServerProjectWorktreePath(
      input,
      sessionID,
      runtimeCandidates
    );
  };

  return {
    tool: createPlannerTools(
      (sessionID, worktreePath, execute) => runtimeAccess.withRuntime(sessionID, worktreePath, execute),
      (sessionID, context) =>
        resolveProjectDirectory(sessionID, {
          worktree: context.worktree,
          directory: context.directory,
        })
    ),
    config: async opencodeConfig => {
      opencodeConfig.command ??= {};
      opencodeConfig.command[BRHP_COMMAND_NAME] = {
        template: '',
        description: BRHP_COMMAND_DESCRIPTION,
      };
    },
    'command.execute.before': async (commandInput, output) => {
      if (commandInput.command !== BRHP_COMMAND_NAME) {
        return;
      }
      const parsed = parseBrhpCommand(commandInput.arguments);

      if (!parsed.ok) {
        output.parts.length = 0;
        output.parts.push({
          type: 'text',
          text: parsed.message,
        } as (typeof output.parts)[number]);
        return;
      }

      const projectDirectory = await resolveProjectDirectory(commandInput.sessionID);
      const context = {
        worktreePath: projectDirectory,
        opencodeSessionId: commandInput.sessionID,
      };
      let mutation: PlannerRuntimeMutation = { kind: 'none' };

      switch (parsed.command.kind) {
        case 'status':
          await renderStatusResponse({
            output,
            runtimeAccess,
            sessionID: commandInput.sessionID,
            projectDirectory,
            context,
          });
          return;
        case 'history': {
          const history = await runtimeAccess.withRuntime(
            commandInput.sessionID,
            projectDirectory,
            runtime => runtime.getActiveSessionHistory(context, PLANNING_HISTORY_EVENTS_LIMIT)
          );

          output.parts.length = 0;
          output.parts.push({
            type: 'text',
            text: buildSlashCommandResponse(
              {
                directories: {
                  global: 'n/a',
                  project: projectDirectory,
                },
                instructions: [],
                counts: {
                  global: 0,
                  project: 0,
                  total: 0,
                  skipped: 0,
                },
                skippedFiles: [],
              },
              {
                history: {
                  ...history,
                  limit: PLANNING_HISTORY_EVENTS_LIMIT,
                },
              }
            ),
          } as (typeof output.parts)[number]);
          return;
        }
        case 'plan': {
          const inventory = await createInstructionInventoryLoader(projectDirectory)();
          const { problemStatement } = parsed.command;
          mutation = await runtimeAccess.withRuntime(commandInput.sessionID, projectDirectory, runtime =>
            runtime.create(context, inventory, problemStatement)
          );
          break;
        }
        case 'resume': {
          const { sessionId } = parsed.command;
          mutation = await runtimeAccess.withRuntime(commandInput.sessionID, projectDirectory, runtime =>
            runtime.resume(context, sessionId)
          );
          break;
        }
      }

      const inventory = await createInstructionInventoryLoader(projectDirectory)();

      const activePlanningState = await runtimeAccess.withRuntime(
        commandInput.sessionID,
        projectDirectory,
        runtime => runtime.getActive(context)
      );

      output.parts.length = 0;
      output.parts.push({
        type: 'text',
        text: buildSlashCommandResponse(inventory, {
          activePlanningState,
          mutation,
        }),
      } as (typeof output.parts)[number]);
    },
    'experimental.chat.system.transform': async (transformInput, output) => {
      const sessionID = transformInput.sessionID;
      const projectDirectory = sessionID
        ? await resolveProjectDirectory(sessionID)
        : await resolveServerProjectWorktreePathWithoutSession(input);
      const inventory = await createInstructionInventoryLoader(projectDirectory)();
      const planningState = sessionID
        ? await runtimeAccess.withRuntime(sessionID, projectDirectory, runtime =>
            runtime.getActive({
              worktreePath: projectDirectory,
              opencodeSessionId: sessionID,
            })
          )
        : null;
      const section = buildSystemPromptSection(inventory, planningState);

      if (section) {
        output.system.push(section);
      }
    },
  };
}

async function renderStatusResponse(input: {
  readonly output: Parameters<NonNullable<Hooks['command.execute.before']>>[1];
  readonly runtimeAccess: ServerPlannerRuntimeAccess;
  readonly sessionID: string;
  readonly projectDirectory: string;
  readonly context: {
    readonly worktreePath: string;
    readonly opencodeSessionId: string;
  };
}): Promise<void> {
  const diagnostics: BrhpRuntimeDiagnostic[] = [];
  let inventory: InstructionInventory;

  try {
    inventory = await createInstructionInventoryLoader(input.projectDirectory)();
  } catch (cause) {
    diagnostics.push(classifyRuntimeDiagnostic('instructions', cause));
    inventory = createUnavailableInstructionInventory(input.projectDirectory);
  }

  let activePlanningState: PlanningState | null = null;

  try {
    activePlanningState = await input.runtimeAccess.withRuntime(
      input.sessionID,
      input.projectDirectory,
      runtime => runtime.getActive(input.context)
    );
  } catch (cause) {
    diagnostics.push(classifyRuntimeDiagnostic('planner-runtime', cause));
  }

  input.output.parts.length = 0;
  input.output.parts.push({
    type: 'text',
    text: buildSlashCommandResponse(inventory, {
      activePlanningState,
      mutation: { kind: 'none' },
      diagnostics,
    }),
  } as (typeof input.output.parts)[number]);
}

function createUnavailableInstructionInventory(projectDirectory: string): InstructionInventory {
  return {
    directories: {
      global: 'unavailable',
      project: path.join(projectDirectory, '.opencode', 'brhp', 'instructions'),
    },
    instructions: [],
    counts: {
      global: 0,
      project: 0,
      total: 0,
      skipped: 0,
    },
    skippedFiles: [],
  };
}
