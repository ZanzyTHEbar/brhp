export const BRHP_TOOL_IDS = {
  getActivePlan: 'brhp_get_active_plan',
  decomposeNode: 'brhp_decompose_node',
  validateActiveScope: 'brhp_validate_active_scope',
  completeLeaf: 'brhp_complete_leaf',
} as const;

export type BrhpToolId = (typeof BRHP_TOOL_IDS)[keyof typeof BRHP_TOOL_IDS];
