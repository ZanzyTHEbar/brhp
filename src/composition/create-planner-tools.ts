import { tool } from '@opencode-ai/plugin/tool';

import type { PlannerRuntime } from '../application/services/planner-runtime.js';
import { BRHP_TOOL_IDS } from '../domain/planning/planner-tool.js';

type PlannerToolMap = Record<string, ReturnType<typeof tool>>;

export function createPlannerTools(
  withRuntime: <Result>(
    sessionID: string,
    worktreePath: string,
    execute: (runtime: PlannerRuntime) => Promise<Result>
  ) => Promise<Result>
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

        const state = await withRuntime(
          context.sessionID,
          context.worktree || context.directory,
          runtime =>
            runtime.getActive({
              worktreePath: context.worktree || context.directory,
              opencodeSessionId: context.sessionID,
            })
        );

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

        const mutation = await withRuntime(
          context.sessionID,
          context.worktree || context.directory,
          runtime =>
            runtime.decomposeNode(
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
            )
        );

        return JSON.stringify(mutation, null, 2);
      },
    }),
    [BRHP_TOOL_IDS.validateActiveScope]: tool({
      description:
        'Persist a deterministic validation verdict for the active BRHP scope in the current OpenCode chat. Read the active plan first.',
      args: {
        clauses: tool.schema
          .array(
            tool.schema.object({
              id: tool.schema.string().min(1).optional(),
              kind: tool.schema.enum(['schema', 'structure', 'dependency', 'conflict', 'coverage']),
              blocking: tool.schema.boolean(),
              description: tool.schema.string().min(1),
              status: tool.schema.enum(['pending', 'passed', 'failed', 'skipped']),
              message: tool.schema.string().min(1).optional(),
            })
          )
          .min(1),
      },
      async execute(args, context) {
        context.metadata({
          title: 'Validate BRHP active scope',
          metadata: {
            tool: BRHP_TOOL_IDS.validateActiveScope,
            clauseCount: args.clauses.length,
          },
        });

        const mutation = await withRuntime(
          context.sessionID,
          context.worktree || context.directory,
          runtime =>
            runtime.recordValidation(
              {
                worktreePath: context.worktree || context.directory,
                opencodeSessionId: context.sessionID,
              },
              {
                clauses: args.clauses.map(clause => ({
                  ...(clause.id ? { id: clause.id } : {}),
                  kind: clause.kind,
                  blocking: clause.blocking,
                  description: clause.description,
                  status: clause.status,
                  ...(clause.message ? { message: clause.message } : {}),
                })),
              }
            )
        );

        return JSON.stringify(mutation, null, 2);
      },
    }),
  };
}
