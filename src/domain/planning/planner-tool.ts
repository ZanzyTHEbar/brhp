export const BRHP_TOOL_IDS = {
  getActivePlan: 'brhp_get_active_plan',
  decomposeNode: 'brhp_decompose_node',
} as const;

export type BrhpToolId = (typeof BRHP_TOOL_IDS)[keyof typeof BRHP_TOOL_IDS];
