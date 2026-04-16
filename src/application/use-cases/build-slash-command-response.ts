import type { InstructionInventory } from '../../domain/instructions/instruction.js';
import {
  BRHP_COMMAND_DESCRIPTION,
  BRHP_COMMAND_NAME,
} from '../../domain/slash-command/brhp-command.js';

export function buildSlashCommandResponse(
  inventory: InstructionInventory
): string {
  const commandName = `/${BRHP_COMMAND_NAME}`;
  const instructionLines =
    inventory.instructions.length > 0
      ? inventory.instructions.map(
          instruction =>
            `- [${instruction.source}] ${instruction.title} (${instruction.relativePath})`
        )
      : ['- No enabled instructions found'];
  const skippedLines = inventory.skippedFiles.map(
    skipped => `- [${skipped.source}] ${skipped.relativePath} (${skipped.reason})`
  );

  return [
    '# BRHP Plugin',
    '',
    `Command: ${commandName}`,
    `Description: ${BRHP_COMMAND_DESCRIPTION}`,
    '',
    'Instruction directories:',
    `- Global: ${inventory.directories.global}`,
    `- Project: ${inventory.directories.project}`,
    '',
    'Loaded instructions:',
    ...instructionLines,
    '',
    'Skipped files:',
    ...(skippedLines.length > 0 ? skippedLines : ['- None']),
    '',
    `Totals: ${inventory.counts.total} loaded (${inventory.counts.global} global, ${inventory.counts.project} project, ${inventory.counts.skipped} skipped)`,
  ].join('\n');
}
