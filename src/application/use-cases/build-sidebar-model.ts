import type { SidebarModel } from '../../domain/sidebar/sidebar-model.js';
import { BRHP_COMMAND_NAME } from '../../domain/slash-command/brhp-command.js';
import type { InstructionInventory } from '../../domain/instructions/instruction.js';

export function buildSidebarModel(inventory: InstructionInventory): SidebarModel {
  return {
    pluginName: 'brhp',
    status: inventory.instructions.length > 0 ? 'ready' : 'empty',
    slashCommands: [`/${BRHP_COMMAND_NAME}`],
    globalDirectory: inventory.directories.global,
    projectDirectory: inventory.directories.project,
    instructionCount: inventory.counts.total,
    skippedCount: inventory.counts.skipped,
    instructions: inventory.instructions.map(instruction => ({
      title: instruction.title,
      source: instruction.source,
      relativePath: instruction.relativePath,
      ...(instruction.description
        ? { description: instruction.description }
        : {}),
    })),
    skippedFiles: inventory.skippedFiles.map(skipped => ({
      source: skipped.source,
      relativePath: skipped.relativePath,
      reason: skipped.reason,
    })),
  };
}
