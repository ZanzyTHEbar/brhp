import type { InstructionInventory } from '../../domain/instructions/instruction.js';
import { BRHP_TOOL_IDS } from '../../domain/planning/planner-tool.js';
import type { PlanningState } from '../../domain/planning/planning-session.js';
import { buildPlanningSessionSummary } from './build-planning-session-summary.js';

export function buildSystemPromptSection(
  inventory: InstructionInventory,
  planningState?: PlanningState | null
): string | null {
  if (inventory.instructions.length === 0 && !planningState) {
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

  const planningSummary = planningState
    ? buildPlanningSessionSummary(planningState)
    : null;
  const instructionSection =
    inventory.instructions.length > 0
      ? [
          '# BRHP Instructions',
          'These instructions were loaded by the BRHP plugin from the configured global and project instruction directories.',
          ...sections,
        ]
      : [];
  const planningSection = planningSummary
    ? [
        '# Active BRHP Planning Session',
        'This OpenCode chat currently has an active BRHP planning session persisted to the local planner database.',
        `Session ID: ${planningSummary.id}`,
        `Status: ${planningSummary.status}`,
        `Problem: ${planningSummary.initialProblem}`,
        `Active scope: ${planningSummary.activeScopeId}`,
        `Graph counts: ${planningSummary.scopeCount} scopes, ${planningSummary.nodeCount} nodes, ${planningSummary.edgeCount} edges`,
        'Use the BRHP tool flow when planning in this chat:',
        `- First call ${BRHP_TOOL_IDS.getActivePlan} to inspect the authoritative state.`,
        `- Then call ${BRHP_TOOL_IDS.decomposeNode} only when you need to decompose one existing node into explicit child nodes.`,
        '- Do not invent planner state outside the tool results.',
        ...(planningSummary.invariants.length > 0
          ? ['Invariants:', ...planningSummary.invariants.map(invariant => `- ${invariant}`)]
          : []),
      ]
    : [];

  return [...instructionSection, ...planningSection].join('\n\n');
}
