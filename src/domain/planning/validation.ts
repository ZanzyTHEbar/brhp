export const VALIDATION_CLAUSE_KINDS = [
  'schema',
  'structure',
  'dependency',
  'conflict',
  'coverage',
] as const;

export type ValidationClauseKind = (typeof VALIDATION_CLAUSE_KINDS)[number];

export const VALIDATION_CLAUSE_STATUSES = [
  'pending',
  'passed',
  'failed',
  'skipped',
] as const;

export type ValidationClauseStatus = (typeof VALIDATION_CLAUSE_STATUSES)[number];

export interface ValidationClause {
  readonly id: string;
  readonly kind: ValidationClauseKind;
  readonly blocking: boolean;
  readonly description: string;
  readonly status: ValidationClauseStatus;
  readonly message?: string;
}

export interface ValidationFormula {
  readonly scopeId: string;
  readonly clauses: readonly ValidationClause[];
}

export interface ValidationVerdict {
  readonly formula: ValidationFormula;
  readonly satisfiable: boolean;
  readonly blockingFindings: number;
  readonly pendingBlockingClauses: number;
}
