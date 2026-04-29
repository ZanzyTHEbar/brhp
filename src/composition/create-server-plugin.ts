import type { Hooks, PluginInput } from '@opencode-ai/plugin';

import { parseBrhpCommand } from '../application/use-cases/parse-brhp-command.js';
import { buildSlashCommandResponse } from '../application/use-cases/build-slash-command-response.js';
import { buildSystemPromptSection } from '../application/use-cases/build-system-prompt-section.js';
import type { PlannerRuntime } from '../application/services/planner-runtime.js';
import type { PlannerRuntimeMutation } from '../application/services/planner-runtime.js';
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
          break;
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
