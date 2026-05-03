import type { InstructionInventory } from '../../domain/instructions/instruction.js';
import {
  BRHP_COMMAND_DESCRIPTION,
  BRHP_COMMAND_NAME,
} from '../../domain/slash-command/brhp-command.js';
import type { PlannerRuntimeMutation } from '../services/planner-runtime.js';
import type { PlanningState } from '../../domain/planning/planning-session.js';
import type { BrhpRuntimeDiagnostic } from './classify-runtime-diagnostic.js';
import { buildPlanningSessionSummary } from './build-planning-session-summary.js';
import { buildPlanningHistoryResponse } from './build-planning-history-response.js';
import type { PlannerConfig } from '../../domain/planning/planner-config.js';

export function buildSlashCommandResponse(
  inventory: InstructionInventory,
  options?: {
    readonly activePlanningState?: PlanningState | null;
    readonly mutation?: PlannerRuntimeMutation;
    readonly diagnostics?: readonly BrhpRuntimeDiagnostic[];
    readonly config?: PlannerConfig;
    readonly history?: {
      readonly active: boolean;
      readonly sessionId?: string;
      readonly limit: number;
      readonly events: readonly import('../../domain/planning/planning-event.js').PlanningEvent[];
    };
  }
): string {
  if (options?.history !== undefined) {
    return buildPlanningHistoryResponse(options.history);
  }

  const commandName = `/${BRHP_COMMAND_NAME}`;
  const diagnostics = options?.diagnostics ?? [];
  const instructionDiagnostic = diagnostics.find(diagnostic => diagnostic.kind === 'instructions');
  const plannerRuntimeDiagnostic = diagnostics.find(
    diagnostic => diagnostic.kind === 'planner-runtime'
  );
  const instructionLines =
    instructionDiagnostic !== undefined
      ? [`- Unavailable: ${instructionDiagnostic.message}`]
      : inventory.instructions.length > 0
      ? inventory.instructions.map(
          instruction =>
            `- [${instruction.source}] ${instruction.title} (${instruction.relativePath})`
        )
      : ['- No enabled instructions found'];
  const skippedLines =
    instructionDiagnostic !== undefined
      ? []
      : inventory.skippedFiles.map(
          skipped => `- [${skipped.source}] ${skipped.relativePath} (${skipped.reason})`
        );
  const planningSummary = options?.activePlanningState
    ? buildPlanningSessionSummary(options.activePlanningState)
    : null;
  const mutationLines = options?.mutation ? renderMutation(options.mutation) : [];
  const diagnosticLines = renderDiagnostics(diagnostics);

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
          ...(planningSummary.recentActivity && planningSummary.recentActivity.length > 0
            ? [
                '- Recent activity:',
                ...planningSummary.recentActivity.map(activity => `  - ${activity.label}`),
              ]
            : []),
        ]
      : plannerRuntimeDiagnostic !== undefined
        ? [`- Unavailable: ${plannerRuntimeDiagnostic.message}`]
        : ['- None active for this OpenCode session']),
    ...(diagnosticLines.length > 0 ? ['', 'Runtime diagnostics:', ...diagnosticLines] : []),
    ...(mutationLines.length > 0 ? ['', 'Last action:', ...mutationLines] : []),
    ...(options?.config !== undefined && (options.config.temperature !== undefined || options.config.maxDepth !== undefined)
      ? [
          '',
          'Planner config:',
          ...(options.config.temperature !== undefined ? [`- Temperature: ${options.config.temperature.toFixed(3)}`] : []),
          ...(options.config.maxDepth !== undefined ? [`- Max depth: ${options.config.maxDepth}`] : []),
        ]
      : []),
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
    instructionDiagnostic !== undefined
      ? 'Totals: unavailable while BRHP instructions could not be loaded'
      : `Totals: ${inventory.counts.total} loaded (${inventory.counts.global} global, ${inventory.counts.project} project, ${inventory.counts.skipped} skipped)`,
  ].join('\n');
}

function renderDiagnostics(diagnostics: readonly BrhpRuntimeDiagnostic[]): string[] {
  return diagnostics.map(diagnostic =>
    `- ${formatDiagnosticKind(diagnostic.kind)}: ${diagnostic.message}`
  );
}

function formatDiagnosticKind(kind: BrhpRuntimeDiagnostic['kind']): string {
  switch (kind) {
    case 'instructions':
      return 'Instructions';
    case 'planner-runtime':
      return 'Planner runtime';
    case 'unknown':
      return 'Unknown';
  }
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
