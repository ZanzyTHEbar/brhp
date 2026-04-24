export type SidebarLoadFailureKind = 'instructions' | 'planner-runtime' | 'unknown';

export interface SidebarLoadFailure {
  readonly kind: SidebarLoadFailureKind;
  readonly message: string;
}

export function classifySidebarLoadFailure(kind: SidebarLoadFailureKind): SidebarLoadFailure {
  switch (kind) {
    case 'instructions':
      return {
        kind,
        message: 'Unable to load BRHP instructions',
      };
    case 'planner-runtime':
      return {
        kind,
        message: 'Unable to load BRHP planner runtime',
      };
    case 'unknown':
      return {
        kind,
        message: 'Unable to load BRHP sidebar state',
      };
  }
}
