import type { PlanningEvent } from '../../domain/planning/planning-event.js';

export function buildPlanningHistoryResponse(input: {
  readonly active: boolean;
  readonly sessionId?: string;
  readonly events: readonly PlanningEvent[];
  readonly limit: number;
}): string {
  if (!input.active) {
    return [
      '# BRHP History',
      '',
      'No active BRHP planning session exists for this OpenCode chat.',
    ].join('\n');
  }

  if (input.events.length === 0) {
    return [
      '# BRHP History',
      '',
      `Session: ${input.sessionId ?? 'unknown'}`,
      '',
      'No planner history is available for the active session yet.',
    ].join('\n');
  }

  return [
    '# BRHP History',
    '',
    `Session: ${input.sessionId ?? 'unknown'}`,
    `Events: ${input.events.length} (showing up to ${input.limit}, newest first)`,
    '',
    ...input.events.map(renderHistoryLine),
  ].join('\n');
}

function renderHistoryLine(event: PlanningEvent): string {
  const details = [
    event.occurredAt,
    event.type,
    ...(event.scopeId ? [`scope=${event.scopeId}`] : []),
    ...(event.nodeId ? [`node=${event.nodeId}`] : []),
    summarizeEvent(event),
  ];

  return `- ${details.join(' | ')}`;
}

function summarizeEvent(event: PlanningEvent): string {
  switch (event.type) {
    case 'session-created':
      return `problem=${JSON.stringify(event.payload.initialProblem)}`;
    case 'scope-created':
      return `title=${JSON.stringify(event.payload.title)} depth=${event.payload.depth}`;
    case 'node-created':
      return `title=${JSON.stringify(event.payload.title)} status=${event.payload.status} category=${event.payload.category}`;
    case 'node-decomposed':
      return `children=${event.payload.childNodeIds.length} ${event.payload.previousStatus}->${event.payload.nextStatus}`;
    case 'edge-created':
      return `kind=${event.payload.kind} from=${event.payload.fromNodeId} to=${event.payload.toNodeId}`;
    case 'frontier-snapshotted':
      return `reason=${event.payload.reason} entropy=${event.payload.globalEntropy.toFixed(3)} depthClamp=${event.payload.depthClamp}`;
    case 'validation-recorded':
      return `satisfiable=${event.payload.satisfiable} blocking=${event.payload.blockingFindings} pending=${event.payload.pendingBlockingClauses} clauses=${event.payload.clauseCount}`;
    case 'leaf-completed':
      return `summary=${JSON.stringify(event.payload.completionSummary)}`;
  }
}
