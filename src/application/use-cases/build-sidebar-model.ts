import type { SidebarModel } from '../../domain/sidebar/sidebar-model.js';
import { BRHP_COMMAND_NAME } from '../../domain/slash-command/brhp-command.js';
import type { InstructionInventory } from '../../domain/instructions/instruction.js';
import type { PlanningState } from '../../domain/planning/planning-session.js';
import { buildPlanningSessionSummary } from './build-planning-session-summary.js';

export function buildSidebarModel(
  inventory: InstructionInventory,
  planningState?: PlanningState | null
): SidebarModel {
  const planningSummary = planningState
    ? buildPlanningSessionSummary(planningState)
    : null;

  return {
    pluginName: 'brhp',
    status:
      inventory.instructions.length > 0 || planningSummary
        ? 'ready'
        : 'empty',
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
    planning: planningSummary
      ? {
          active: true,
          sessionId: planningSummary.id,
          status: planningSummary.status,
          problem: planningSummary.initialProblem,
          scopeCount: planningSummary.scopeCount,
          nodeCount: planningSummary.nodeCount,
          edgeCount: planningSummary.edgeCount,
          ...(planningSummary.validation
            ? {
                validation: planningSummary.validation,
              }
            : {}),
          ...(planningSummary.frontier
            ? {
                frontier: planningSummary.frontier,
              }
            : {}),
          ...(planningSummary.recentActivity
            ? {
                recentActivity: planningSummary.recentActivity,
              }
            : {}),
        }
      : {
          active: false,
        },
  };
}
