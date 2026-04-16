export type InstructionSource = 'global' | 'project';

export interface InstructionDocument {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly description?: string;
  readonly source: InstructionSource;
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly extension: '.md' | '.mdc';
  readonly order: number;
}

export interface InstructionDirectories {
  readonly global: string;
  readonly project: string;
}

export interface InstructionCounts {
  readonly global: number;
  readonly project: number;
  readonly total: number;
  readonly skipped: number;
}

export type SkippedInstructionReason =
  | 'disabled'
  | 'empty body'
  | 'invalid frontmatter'
  | 'parse error'
  | 'read error'
  | 'unsupported extension';

export interface SkippedInstructionFile {
  readonly source: InstructionSource;
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly reason: SkippedInstructionReason;
}

export interface InstructionInventory {
  readonly directories: InstructionDirectories;
  readonly instructions: readonly InstructionDocument[];
  readonly counts: InstructionCounts;
  readonly skippedFiles: readonly SkippedInstructionFile[];
}
