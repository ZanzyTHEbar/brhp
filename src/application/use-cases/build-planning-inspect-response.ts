import { PLAN_EDGE_KINDS, type PlanEdge } from '../../domain/planning/plan-edge.js';
import { PLAN_NODE_STATUSES, type PlanNode } from '../../domain/planning/plan-node.js';
import {
  PLANNING_SCOPE_STATUSES,
  type PlanningScope,
} from '../../domain/planning/planning-scope.js';
import type { PlanningEvent } from '../../domain/planning/planning-event.js';
import type { PlanningState } from '../../domain/planning/planning-session.js';
import type { BrhpRuntimeDiagnostic } from './classify-runtime-diagnostic.js';

const DEFAULT_INSPECT_LIMITS = {
  frontierSelections: 5,
  validationClauses: 10,
  focusNodes: 10,
  edges: 10,
  recentEvents: 10,
} as const;

const TEXT_LIMIT = 180;

const FOCUS_NODE_STATUS_ORDER: readonly PlanNode['status'][] = [
  'active',
  'blocked',
  'proposed',
  'leaf',
  'decomposed',
  'pruned',
];

export interface PlanningInspectLimits {
  readonly frontierSelections?: number;
  readonly validationClauses?: number;
  readonly focusNodes?: number;
  readonly edges?: number;
  readonly recentEvents?: number;
}

export function buildPlanningInspectResponse(input: {
  readonly state: PlanningState | null;
  readonly diagnostics?: readonly BrhpRuntimeDiagnostic[];
  readonly limits?: PlanningInspectLimits;
}): string {
  const diagnostics = input.diagnostics ?? [];
  const plannerRuntimeDiagnostic = diagnostics.find(
    diagnostic => diagnostic.kind === 'planner-runtime'
  );

  if (input.state === null) {
    return [
      '# BRHP Inspect',
      '',
      ...(plannerRuntimeDiagnostic !== undefined
        ? ['Planning session:', `- Unavailable: ${plannerRuntimeDiagnostic.message}`]
        : ['No active BRHP planning session exists for this OpenCode chat.']),
      ...renderDiagnostics(diagnostics),
    ].join('\n');
  }

  const limits = normalizeLimits(input.limits);
  const state = input.state;
  const scopeById = new Map(state.graph.scopes.map(scope => [scope.id, scope]));
  const nodeById = new Map(state.graph.nodes.map(node => [node.id, node]));
  const activeScope = scopeById.get(state.session.activeScopeId);
  const rootNode = nodeById.get(state.session.rootNodeId);
  const focusNodes = selectFocusNodes(state.graph.nodes).slice(0, limits.focusNodes);
  const edgeSamples = state.graph.edges.slice(0, limits.edges);
  const frontierSelections = state.frontier?.selections.slice(0, limits.frontierSelections) ?? [];
  const validationClauses = state.validation?.formula.clauses.slice(0, limits.validationClauses) ?? [];
  const recentEvents = (state.recentEvents ?? []).slice(0, limits.recentEvents);

  return [
    '# BRHP Inspect',
    '',
    'Session:',
    `- ID: ${state.session.id}`,
    `- Status: ${state.session.status}`,
    `- Revision: ${state.session.revision}`,
    `- Active scope: ${state.session.activeScopeId}`,
    `- Root node: ${state.session.rootNodeId}`,
    `- Created: ${state.session.createdAt}`,
    `- Updated: ${state.session.updatedAt}`,
    '',
    'Problem:',
    formatText(state.session.initialProblem),
    '',
    'Graph:',
    `- Scopes: ${state.graph.scopes.length} (${formatOrderedCounts(PLANNING_SCOPE_STATUSES, state.graph.scopes, scope => scope.status)})`,
    `- Nodes: ${state.graph.nodes.length} (${formatOrderedCounts(PLAN_NODE_STATUSES, state.graph.nodes, node => node.status)})`,
    `- Edges: ${state.graph.edges.length} (${formatOrderedCounts(PLAN_EDGE_KINDS, state.graph.edges, edge => edge.kind)})`,
    '',
    'Active scope:',
    ...(activeScope ? renderScope(activeScope, rootNode) : [`- Missing: ${state.session.activeScopeId}`]),
    '',
    'Frontier selections:',
    ...(state.frontier
      ? [
          `- Showing ${frontierSelections.length} of ${state.frontier.selections.length} (limit ${limits.frontierSelections})`,
          ...frontierSelections.map(selection => {
            const node = nodeById.get(selection.nodeId);
            return `- #${selection.rank} ${formatNodeReference(selection.nodeId, node)} p=${formatNumber(selection.probability)} utility=${formatNumber(selection.utility)} entropy=${formatNumber(selection.localEntropy)} pressure=${formatNumber(selection.validationPressure)} depth=${node?.depth ?? 'n/a'}`;
          }),
        ]
      : ['- No frontier snapshot is available']),
    '',
    'Validation:',
    ...(state.validation
      ? [
          `- Satisfiable: ${state.validation.satisfiable ? 'yes' : 'no'}`,
          `- Blocking findings: ${state.validation.blockingFindings}`,
          `- Pending blocking clauses: ${state.validation.pendingBlockingClauses}`,
          `- Clauses: ${state.validation.formula.clauses.length} (showing up to ${limits.validationClauses})`,
          ...validationClauses.map(clause =>
            `- [${clause.status}] ${clause.kind}${clause.blocking ? ' blocking' : ''}: ${formatText(clause.description)}${clause.message ? ` -- ${formatText(clause.message)}` : ''}`
          ),
        ]
      : ['- No validation snapshot is available']),
    '',
    'Focus nodes:',
    `- Showing ${focusNodes.length} of ${state.graph.nodes.length} (limit ${limits.focusNodes})`,
    ...focusNodes.map(node => renderNode(node)),
    '',
    'Edges:',
    `- Showing ${edgeSamples.length} of ${state.graph.edges.length} (limit ${limits.edges})`,
    ...edgeSamples.map(edge => renderEdge(edge, nodeById)),
    '',
    'Recent activity:',
    ...(recentEvents.length > 0
      ? [
          `- Showing ${recentEvents.length} of ${state.recentEvents?.length ?? 0} (limit ${limits.recentEvents})`,
          ...recentEvents.map(renderEvent),
        ]
      : ['- No recent activity is available']),
    ...renderDiagnostics(diagnostics),
  ].join('\n');
}

function normalizeLimits(limits: PlanningInspectLimits | undefined) {
  return {
    frontierSelections: normalizeLimit(limits?.frontierSelections, DEFAULT_INSPECT_LIMITS.frontierSelections),
    validationClauses: normalizeLimit(limits?.validationClauses, DEFAULT_INSPECT_LIMITS.validationClauses),
    focusNodes: normalizeLimit(limits?.focusNodes, DEFAULT_INSPECT_LIMITS.focusNodes),
    edges: normalizeLimit(limits?.edges, DEFAULT_INSPECT_LIMITS.edges),
    recentEvents: normalizeLimit(limits?.recentEvents, DEFAULT_INSPECT_LIMITS.recentEvents),
  };
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.min(Math.floor(value), fallback);
}

function renderScope(scope: PlanningScope, rootNode: PlanNode | undefined): string[] {
  return [
    `- Title: ${formatText(scope.title)}`,
    `- Question: ${formatText(scope.question)}`,
    `- Depth: ${scope.depth}`,
    `- Status: ${scope.status}`,
    `- Root node: ${formatNodeReference(scope.rootNodeId, rootNode)}`,
  ];
}

function selectFocusNodes(nodes: readonly PlanNode[]): readonly PlanNode[] {
  return [...nodes].sort((left, right) => {
    const statusDelta =
      FOCUS_NODE_STATUS_ORDER.indexOf(left.status) - FOCUS_NODE_STATUS_ORDER.indexOf(right.status);
    if (statusDelta !== 0) {
      return statusDelta;
    }

    if (left.depth !== right.depth) {
      return left.depth - right.depth;
    }

    return left.title.localeCompare(right.title);
  });
}

function renderNode(node: PlanNode): string {
  return `- [${node.status}] ${formatText(node.title)} (${node.id}) depth=${node.depth} category=${node.category} scope=${node.scopeId} utility=${formatNumber(node.scores.utility)} confidence=${formatNumber(node.scores.confidence)} pressure=${formatNumber(node.scores.validationPressure)}`;
}

function renderEdge(edge: PlanEdge, nodeById: ReadonlyMap<string, PlanNode>): string {
  return `- ${edge.kind}: ${formatNodeReference(edge.fromNodeId, nodeById.get(edge.fromNodeId))} -> ${formatNodeReference(edge.toNodeId, nodeById.get(edge.toNodeId))}`;
}

function renderEvent(event: PlanningEvent): string {
  return `- ${event.occurredAt} | ${event.type} | ${summarizeEvent(event)}`;
}

function summarizeEvent(event: PlanningEvent): string {
  switch (event.type) {
    case 'session-created':
      return `problem=${JSON.stringify(formatText(event.payload.initialProblem))}`;
    case 'scope-created':
      return `title=${JSON.stringify(formatText(event.payload.title))} depth=${event.payload.depth}`;
    case 'node-created':
      return `title=${JSON.stringify(formatText(event.payload.title))} status=${event.payload.status} category=${event.payload.category}`;
    case 'node-decomposed':
      return `children=${event.payload.childNodeIds.length} ${event.payload.previousStatus}->${event.payload.nextStatus}`;
    case 'edge-created':
      return `kind=${event.payload.kind} from=${event.payload.fromNodeId} to=${event.payload.toNodeId}`;
    case 'frontier-snapshotted':
      return `reason=${event.payload.reason} entropy=${formatNumber(event.payload.globalEntropy)} depthClamp=${event.payload.depthClamp}`;
    case 'validation-recorded':
      return `satisfiable=${event.payload.satisfiable} blocking=${event.payload.blockingFindings} pending=${event.payload.pendingBlockingClauses} clauses=${event.payload.clauseCount}`;
    case 'leaf-completed':
      return `summary=${JSON.stringify(event.payload.completionSummary)}`;
  }
}

function formatOrderedCounts<Item, Key extends string>(
  orderedKeys: readonly Key[],
  items: readonly Item[],
  getKey: (item: Item) => Key
): string {
  const counts = new Map<Key, number>(orderedKeys.map(key => [key, 0]));

  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return orderedKeys.map(key => `${key} ${counts.get(key) ?? 0}`).join(', ');
}

function formatNodeReference(nodeId: string, node: PlanNode | undefined): string {
  return node ? `${formatText(node.title)} (${nodeId})` : nodeId;
}

function formatNumber(value: number): string {
  return value.toFixed(3);
}

function formatText(value: string): string {
  const compact = value.replace(/\s+/gu, ' ').trim();

  return compact.length > TEXT_LIMIT ? `${compact.slice(0, TEXT_LIMIT - 3)}...` : compact;
}

function renderDiagnostics(diagnostics: readonly BrhpRuntimeDiagnostic[]): string[] {
  return diagnostics.length > 0
    ? [
        '',
        'Runtime diagnostics:',
        ...diagnostics.map(diagnostic => `- ${formatDiagnosticKind(diagnostic.kind)}: ${diagnostic.message}`),
      ]
    : [];
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
