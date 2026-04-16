import type { InstructionSource } from '../instructions/instruction.js';

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
}
