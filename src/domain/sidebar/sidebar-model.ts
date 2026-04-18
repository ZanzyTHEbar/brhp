import type { InstructionSource } from '../instructions/instruction.js';
import type { PlanningSessionStatus } from '../planning/planning-session.js';

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
}

export interface SidebarValidationSummary {
  readonly satisfiable: boolean;
  readonly blockingFindings: number;
  readonly pendingBlockingClauses: number;
  readonly clauseCount: number;
}
