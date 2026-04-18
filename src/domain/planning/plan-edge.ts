export const PLAN_EDGE_KINDS = [
  'decomposes-to',
  'depends-on',
  'blocks',
  'parallelizes-with',
  'cross-cuts',
] as const;

export type PlanEdgeKind = (typeof PLAN_EDGE_KINDS)[number];

export interface PlanEdge {
  readonly id: string;
  readonly sessionId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly kind: PlanEdgeKind;
  readonly createdAt: string;
}
