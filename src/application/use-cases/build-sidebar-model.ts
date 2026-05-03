import type { SidebarGraphPreview, SidebarModel } from '../../domain/sidebar/sidebar-model.js';
import type { PlanNode } from '../../domain/planning/plan-node.js';
import { BRHP_COMMAND_NAME } from '../../domain/slash-command/brhp-command.js';
import type { InstructionInventory } from '../../domain/instructions/instruction.js';
import type { PlanningState } from '../../domain/planning/planning-session.js';
import { buildPlanningSessionSummary } from './build-planning-session-summary.js';

const SIDEBAR_GRAPH_PREVIEW_LIMITS = {
  frontierSelections: 3,
  validationClauses: 3,
  focusNodes: 5,
  edges: 5,
} as const;

const TEXT_LIMIT = 48;

const FOCUS_NODE_STATUS_ORDER: readonly PlanNode['status'][] = [
  'active',
  'blocked',
  'proposed',
  'leaf',
  'decomposed',
  'pruned',
];

export function buildSidebarModel(
  inventory: InstructionInventory,
  planningState?: PlanningState | null
): SidebarModel {
  const planningSummary = planningState
    ? buildPlanningSessionSummary(planningState)
    : null;
  const graphPreview = planningState ? buildSidebarGraphPreview(planningState) : null;

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
          ...(graphPreview
            ? {
                graphPreview,
              }
            : {}),
        }
      : {
          active: false,
        },
  };
}

function buildSidebarGraphPreview(state: PlanningState): SidebarGraphPreview {
  const nodeById = new Map(state.graph.nodes.map(node => [node.id, node]));
  const formatNodeTitle = (nodeId: string): string | undefined => {
    const title = nodeById.get(nodeId)?.title;

    return title ? formatText(title) : undefined;
  };
  const activeScope = state.graph.scopes.find(scope => scope.id === state.session.activeScopeId);
  const focusNodes = selectFocusNodes(state.graph.nodes, state.session.rootNodeId).slice(
    0,
    SIDEBAR_GRAPH_PREVIEW_LIMITS.focusNodes
  );
  const edges = state.graph.edges.slice(0, SIDEBAR_GRAPH_PREVIEW_LIMITS.edges);
  const frontierSelections =
    state.frontier?.selections.slice(0, SIDEBAR_GRAPH_PREVIEW_LIMITS.frontierSelections) ?? [];
  const validationClauses =
    state.validation?.formula.clauses.slice(0, SIDEBAR_GRAPH_PREVIEW_LIMITS.validationClauses) ?? [];

  return {
    ...(activeScope
      ? (() => {
          const rootNodeTitle = formatNodeTitle(activeScope.rootNodeId);

          return {
            activeScope: {
              id: activeScope.id,
              title: formatText(activeScope.title),
              question: formatText(activeScope.question),
              status: activeScope.status,
              depth: activeScope.depth,
              rootNodeId: activeScope.rootNodeId,
              ...(rootNodeTitle ? { rootNodeTitle } : {}),
            },
          };
        })()
      : {}),
    focusNodes: focusNodes.map(node => ({
      id: node.id,
      title: formatText(node.title),
      status: node.status,
      category: node.category,
      depth: node.depth,
      validationPressure: node.scores.validationPressure,
    })),
    edges: edges.map(edge => {
      const fromNodeTitle = formatNodeTitle(edge.fromNodeId);
      const toNodeTitle = formatNodeTitle(edge.toNodeId);

      return {
        id: edge.id,
        kind: edge.kind,
        fromNodeId: edge.fromNodeId,
        ...(fromNodeTitle ? { fromNodeTitle } : {}),
        toNodeId: edge.toNodeId,
        ...(toNodeTitle ? { toNodeTitle } : {}),
      };
    }),
    frontierSelections: frontierSelections.map(selection => {
      const nodeTitle = formatNodeTitle(selection.nodeId);

      return {
        rank: selection.rank,
        nodeId: selection.nodeId,
        ...(nodeTitle ? { nodeTitle } : {}),
        probability: selection.probability,
        validationPressure: selection.validationPressure,
      };
    }),
    validationClauses: validationClauses.map(clause => ({
      id: clause.id,
      kind: clause.kind,
      status: clause.status,
      blocking: clause.blocking,
      description: formatText(clause.description),
    })),
  };
}

function selectFocusNodes(nodes: readonly PlanNode[], rootNodeId: string): readonly PlanNode[] {
  return nodes.filter(node => node.id !== rootNodeId).sort((left, right) => {
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

function formatText(value: string): string {
  const compact = value.replace(/\s+/gu, ' ').trim();

  return compact.length > TEXT_LIMIT ? `${compact.slice(0, TEXT_LIMIT - 3)}...` : compact;
}
