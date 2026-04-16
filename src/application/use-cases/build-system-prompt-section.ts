import type { InstructionInventory } from '../../domain/instructions/instruction.js';

export function buildSystemPromptSection(
  inventory: InstructionInventory
): string | null {
  if (inventory.instructions.length === 0) {
    return null;
  }

  const sections = inventory.instructions.map(instruction => {
    const sourceLabel = instruction.source === 'global' ? 'Global' : 'Project';

    return [
      `## ${sourceLabel}: ${instruction.title}`,
      `Path: ${instruction.relativePath}`,
      instruction.body,
    ].join('\n');
  });

  return [
    '# BRHP Instructions',
    'These instructions were loaded by the BRHP plugin from the configured global and project instruction directories.',
    ...sections,
  ].join('\n\n');
}
