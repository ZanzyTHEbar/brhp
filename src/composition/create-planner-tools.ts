import { tool } from '@opencode-ai/plugin/tool';

import type { PlannerRuntime } from '../application/services/planner-runtime.js';
import { BRHP_TOOL_IDS } from '../domain/planning/planner-tool.js';

type PlannerToolMap = Record<string, ReturnType<typeof tool>>;

export function createPlannerTools(
  getRuntime: (sessionID: string, worktreePath: string) => Promise<PlannerRuntime>
): PlannerToolMap {
  return {
    [BRHP_TOOL_IDS.getActivePlan]: tool({
      description:
        'Read the authoritative active BRHP planning session for the current OpenCode chat before making planner mutations.',
      args: {},
      async execute(_args, context) {
        context.metadata({
          title: 'Read active BRHP plan',
          metadata: {
            tool: BRHP_TOOL_IDS.getActivePlan,
          },
        });

        const runtime = await getRuntime(context.sessionID, context.worktree || context.directory);
        const state = await runtime.getActive({
          worktreePath: context.worktree || context.directory,
          opencodeSessionId: context.sessionID,
        });

        return JSON.stringify(
          state ?? {
            active: false,
            message: 'No active BRHP planning session exists for this OpenCode chat.',
          },
          null,
          2
        );
      },
    }),
    [BRHP_TOOL_IDS.decomposeNode]: tool({
      description:
        'Decompose one node in the active BRHP planning session into child nodes and refresh the frontier. Read the active plan first.',
      args: {
        nodeId: tool.schema.string().min(1),
        children: tool.schema
          .array(
            tool.schema.object({
              title: tool.schema.string().min(1),
              problemStatement: tool.schema.string().min(1),
              category: tool.schema.enum([
                'dependent',
                'isolated',
                'parallelizable',
                'cross-cutting',
              ]),
              rationale: tool.schema.string().min(1).optional(),
            })
          )
          .min(1),
      },
      async execute(args, context) {
        context.metadata({
          title: `Decompose BRHP node ${args.nodeId}`,
          metadata: {
            tool: BRHP_TOOL_IDS.decomposeNode,
            nodeId: args.nodeId,
            childCount: args.children.length,
          },
        });

        const runtime = await getRuntime(context.sessionID, context.worktree || context.directory);
        const mutation = await runtime.decomposeNode(
          {
            worktreePath: context.worktree || context.directory,
            opencodeSessionId: context.sessionID,
          },
          {
            nodeId: args.nodeId,
            children: args.children.map(child => ({
              title: child.title,
              problemStatement: child.problemStatement,
              category: child.category,
              ...(child.rationale ? { rationale: child.rationale } : {}),
            })),
          }
        );

        return JSON.stringify(mutation, null, 2);
      },
    }),
  };
}
