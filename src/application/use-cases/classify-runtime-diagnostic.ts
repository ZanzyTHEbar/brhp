export type BrhpRuntimeDiagnosticKind = 'instructions' | 'planner-runtime' | 'unknown';

export interface BrhpRuntimeDiagnostic {
  readonly kind: BrhpRuntimeDiagnosticKind;
  readonly message: string;
  readonly cause?: unknown;
}

export function classifyRuntimeDiagnostic(
  kind: BrhpRuntimeDiagnosticKind,
  cause?: unknown
): BrhpRuntimeDiagnostic {
  const diagnostic = {
    kind,
    message: getRuntimeDiagnosticMessage(kind),
  };

  return cause === undefined ? diagnostic : { ...diagnostic, cause };
}

function getRuntimeDiagnosticMessage(kind: BrhpRuntimeDiagnosticKind): string {
  switch (kind) {
    case 'instructions':
      return 'Unable to load BRHP instructions';
    case 'planner-runtime':
      return 'Unable to load BRHP planner runtime';
    case 'unknown':
      return 'Unable to load BRHP runtime state';
  }
}
