import type { InstructionInventory } from '../../domain/instructions/instruction.js';
import {
  BRHP_COMMAND_DESCRIPTION,
  BRHP_COMMAND_NAME,
} from '../../domain/slash-command/brhp-command.js';
import type { PlannerRuntimeMutation } from '../services/planner-runtime.js';
import type { PlanningState } from '../../domain/planning/planning-session.js';
import { buildPlanningSessionSummary } from './build-planning-session-summary.js';

export function buildSlashCommandResponse(
  inventory: InstructionInventory,
  options?: {
    readonly activePlanningState?: PlanningState | null;
    readonly mutation?: PlannerRuntimeMutation;
  }
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
  const planningSummary = options?.activePlanningState
    ? buildPlanningSessionSummary(options.activePlanningState)
    : null;
  const mutationLines = options?.mutation ? renderMutation(options.mutation) : [];

  return [
    '# BRHP Plugin',
    '',
    `Command: ${commandName}`,
    `Description: ${BRHP_COMMAND_DESCRIPTION}`,
    '',
    'Planning session:',
    ...(planningSummary
      ? [
          `- Active: ${planningSummary.id}`,
          `- Status: ${planningSummary.status}`,
          `- Problem: ${planningSummary.initialProblem}`,
          `- Graph: ${planningSummary.scopeCount} scopes, ${planningSummary.nodeCount} nodes, ${planningSummary.edgeCount} edges`,
          ...(planningSummary.validation
            ? [
                `- Validation: ${planningSummary.validation.satisfiable ? 'satisfiable' : 'unsatisfied'} (${planningSummary.validation.blockingFindings} blocking, ${planningSummary.validation.pendingBlockingClauses} pending, ${planningSummary.validation.clauseCount} clauses)`,
              ]
            : []),
          ...(planningSummary.frontier
            ? [
                `- Frontier: ${planningSummary.frontier.selectionCount} selections, top ${planningSummary.frontier.topNodeTitle ?? planningSummary.frontier.topNodeId ?? 'n/a'}${planningSummary.frontier.topProbability !== undefined ? ` (p=${planningSummary.frontier.topProbability.toFixed(3)})` : ''}`,
                `- Pressure: max ${planningSummary.frontier.maxValidationPressure.toFixed(3)}, ${planningSummary.frontier.pressuredSelectionCount}/${planningSummary.frontier.selectionCount} selections pressured, entropy ${planningSummary.frontier.globalEntropy.toFixed(3)}, drift ${planningSummary.frontier.entropyDrift.toFixed(3)}, stability ${planningSummary.frontier.frontierStability.toFixed(3)}`,
              ]
            : []),
        ]
      : ['- None active for this OpenCode session']),
    ...(mutationLines.length > 0 ? ['', 'Last action:', ...mutationLines] : []),
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

function renderMutation(mutation: PlannerRuntimeMutation): string[] {
  switch (mutation.kind) {
    case 'none':
      return [];
    case 'created':
      return [`- Created session ${mutation.state.session.id}`];
    case 'resumed':
      return [`- Resumed session ${mutation.state.session.id}`];
    case 'decomposed':
      return [`- Decomposed node ${mutation.nodeId} in session ${mutation.state.session.id}`];
    case 'validation-recorded':
      return [
        `- Recorded validation ${mutation.validationId} for session ${mutation.state.session.id}`,
      ];
    case 'resume-not-found':
      return [`- Session ${mutation.sessionId} was not found in this worktree`];
  }
}
