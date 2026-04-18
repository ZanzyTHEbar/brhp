import type { Hooks, PluginInput } from '@opencode-ai/plugin';

import { parseBrhpCommand } from '../application/use-cases/parse-brhp-command.js';
import { buildSlashCommandResponse } from '../application/use-cases/build-slash-command-response.js';
import { buildSystemPromptSection } from '../application/use-cases/build-system-prompt-section.js';
import type { PlannerRuntimeMutation } from '../application/services/planner-runtime.js';
import { createPlannerRuntimeForWorktree } from './create-planner-runtime.js';
import { createInstructionInventoryLoader } from './create-instruction-inventory-loader.js';
import {
  BRHP_COMMAND_DESCRIPTION,
  BRHP_COMMAND_NAME,
} from '../domain/slash-command/brhp-command.js';

export async function createServerPluginHooks(
  input: PluginInput
): Promise<Hooks> {
  const projectDirectory = input.worktree || input.directory;
  const loadInventory = createInstructionInventoryLoader(projectDirectory);
  let plannerPromise:
    | Promise<Awaited<ReturnType<typeof createPlannerRuntimeForWorktree>>>
    | undefined;

  const getPlanner = async () => {
    plannerPromise ??= createPlannerRuntimeForWorktree(projectDirectory);
    return plannerPromise;
  };

  return {
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

      const inventory = await loadInventory();
      const parsed = parseBrhpCommand(commandInput.arguments);
      const context = {
        worktreePath: projectDirectory,
        opencodeSessionId: commandInput.sessionID,
      };
      let mutation: PlannerRuntimeMutation = { kind: 'none' };

      if (!parsed.ok) {
        output.parts.length = 0;
        output.parts.push({
          type: 'text',
          text: parsed.message,
        } as (typeof output.parts)[number]);
        return;
      }

      const planner = await getPlanner();
      switch (parsed.command.kind) {
        case 'status':
          break;
        case 'plan':
          mutation = await planner.runtime.create(
            context,
            inventory,
            parsed.command.problemStatement
          );
          break;
        case 'resume':
          mutation = await planner.runtime.resume(context, parsed.command.sessionId);
          break;
      }

      const activePlanningState = await planner.runtime.getActive(context);

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
      const inventory = await loadInventory();
      const planningState = transformInput.sessionID
        ? await (await getPlanner()).runtime.getActive({
            worktreePath: projectDirectory,
            opencodeSessionId: transformInput.sessionID,
          })
        : null;
      const section = buildSystemPromptSection(inventory, planningState);

      if (section) {
        output.system.push(section);
      }
    },
  };
}
