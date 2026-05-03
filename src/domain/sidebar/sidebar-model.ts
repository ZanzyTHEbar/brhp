import type { InstructionSource } from '../instructions/instruction.js';
import type { PlanEdgeKind } from '../planning/plan-edge.js';
import type { PlanNodeCategory, PlanNodeStatus } from '../planning/plan-node.js';
import type { PlanningScopeStatus } from '../planning/planning-scope.js';
import type { PlanningSessionStatus } from '../planning/planning-session.js';
import type { ValidationClauseKind, ValidationClauseStatus } from '../planning/validation.js';

export interface SidebarInstructionItem {
  readonly title: string;
  readonly source: InstructionSource;
  readonly relativePath: string;
  readonly description?: string;
}

export interface SidebarSkippedInstructionItem {
  readonly source: InstructionSource;
  readonly relativePath: string;
  readonly reason: string;
}

export interface SidebarModel {
  readonly pluginName: string;
  readonly status: 'ready' | 'empty';
  readonly slashCommands: readonly string[];
  readonly globalDirectory: string;
  readonly projectDirectory: string;
  readonly instructionCount: number;
  readonly skippedCount: number;
  readonly instructions: readonly SidebarInstructionItem[];
  readonly skippedFiles: readonly SidebarSkippedInstructionItem[];
  readonly planning?: SidebarPlanningSummary;
}

export interface SidebarPlanningSummary {
  readonly active: boolean;
  readonly sessionId?: string;
  readonly status?: PlanningSessionStatus;
  readonly problem?: string;
  readonly scopeCount?: number;
  readonly nodeCount?: number;
  readonly edgeCount?: number;
  readonly validation?: SidebarValidationSummary;
  readonly frontier?: SidebarFrontierSummary;
  readonly recentActivity?: readonly SidebarPlanningActivityItem[];
  readonly graphPreview?: SidebarGraphPreview;
}

export interface SidebarValidationSummary {
  readonly satisfiable: boolean;
  readonly blockingFindings: number;
  readonly pendingBlockingClauses: number;
  readonly clauseCount: number;
}

export interface SidebarFrontierSummary {
  readonly selectionCount: number;
  readonly topNodeId?: string;
  readonly topNodeTitle?: string;
  readonly topProbability?: number;
  readonly maxValidationPressure: number;
  readonly pressuredSelectionCount: number;
  readonly globalEntropy: number;
  readonly entropyDrift: number;
  readonly frontierStability: number;
}

export interface SidebarPlanningActivityItem {
  readonly occurredAt: string;
  readonly label: string;
}

export interface SidebarGraphPreview {
  readonly activeScope?: SidebarGraphScopePreview;
  readonly focusNodes: readonly SidebarGraphNodePreview[];
  readonly edges: readonly SidebarGraphEdgePreview[];
  readonly frontierSelections: readonly SidebarGraphFrontierSelectionPreview[];
  readonly validationClauses: readonly SidebarGraphValidationClausePreview[];
}

export interface SidebarGraphScopePreview {
  readonly id: string;
  readonly title: string;
  readonly question: string;
  readonly status: PlanningScopeStatus;
  readonly depth: number;
  readonly rootNodeId: string;
  readonly rootNodeTitle?: string;
}

export interface SidebarGraphNodePreview {
  readonly id: string;
  readonly title: string;
  readonly status: PlanNodeStatus;
  readonly category: PlanNodeCategory;
  readonly depth: number;
  readonly validationPressure: number;
}

export interface SidebarGraphEdgePreview {
  readonly id: string;
  readonly kind: PlanEdgeKind;
  readonly fromNodeId: string;
  readonly fromNodeTitle?: string;
  readonly toNodeId: string;
  readonly toNodeTitle?: string;
}

export interface SidebarGraphFrontierSelectionPreview {
  readonly rank: number;
  readonly nodeId: string;
  readonly nodeTitle?: string;
  readonly probability: number;
  readonly validationPressure: number;
}

export interface SidebarGraphValidationClausePreview {
  readonly id: string;
  readonly kind: ValidationClauseKind;
  readonly status: ValidationClauseStatus;
  readonly blocking: boolean;
  readonly description: string;
}
