import type { Hooks, PluginInput } from '@opencode-ai/plugin';

import { buildSlashCommandResponse } from '../application/use-cases/build-slash-command-response.js';
import { buildSystemPromptSection } from '../application/use-cases/build-system-prompt-section.js';
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
      output.parts.length = 0;
      output.parts.push({
        type: 'text',
        text: buildSlashCommandResponse(inventory),
      } as (typeof output.parts)[number]);
    },
    'experimental.chat.system.transform': async (_transformInput, output) => {
      const inventory = await loadInventory();
      const section = buildSystemPromptSection(inventory);

      if (section) {
        output.system.push(section);
      }
    },
  };
}
