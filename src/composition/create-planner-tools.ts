import { tool } from '@opencode-ai/plugin/tool';

import type { PlannerRuntime } from '../application/services/planner-runtime.js';
import { BRHP_TOOL_IDS } from '../domain/planning/planner-tool.js';

type PlannerToolMap = Record<string, ReturnType<typeof tool>>;

export function createPlannerTools(
  withRuntime: <Result>(
    sessionID: string,
    worktreePath: string,
    execute: (runtime: PlannerRuntime) => Promise<Result>
  ) => Promise<Result>,
  resolveProjectPath: (sessionID: string, context: { directory: string; worktree: string }) => Promise<string>
): PlannerToolMap {
  return {
    [BRHP_TOOL_IDS.getActivePlan]: tool({
      description:
        'Read the authoritative active BRHP planning session for the current OpenCode chat before making planner mutations.',
      args: {},
      async execute(_args, context) {
        const projectPath = await resolveProjectPath(context.sessionID, context);
        context.metadata({
          title: 'Read active BRHP plan',
          metadata: {
            tool: BRHP_TOOL_IDS.getActivePlan,
          },
        });

        const state = await withRuntime(
          context.sessionID,
          projectPath,
          runtime =>
            runtime.getActive({
              worktreePath: projectPath,
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
        const projectPath = await resolveProjectPath(context.sessionID, context);
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
          projectPath,
          runtime =>
            runtime.decomposeNode(
              {
                worktreePath: projectPath,
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
        const projectPath = await resolveProjectPath(context.sessionID, context);
        context.metadata({
          title: 'Validate BRHP active scope',
          metadata: {
            tool: BRHP_TOOL_IDS.validateActiveScope,
            clauseCount: args.clauses.length,
          },
        });

        const mutation = await withRuntime(
          context.sessionID,
          projectPath,
          runtime =>
            runtime.recordValidation(
              {
                worktreePath: projectPath,
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
    [BRHP_TOOL_IDS.completeLeaf]: tool({
      description:
        'Mark a leaf node in the active BRHP planning session as complete with a result summary. Read the active plan first.',
      args: {
        nodeId: tool.schema.string().min(1),
        completionSummary: tool.schema.string().min(1),
      },
      async execute(args, context) {
        const projectPath = await resolveProjectPath(context.sessionID, context);
        context.metadata({
          title: `Complete BRHP leaf node ${args.nodeId}`,
          metadata: {
            tool: BRHP_TOOL_IDS.completeLeaf,
            nodeId: args.nodeId,
          },
        });

        const mutation = await withRuntime(
          context.sessionID,
          projectPath,
          runtime =>
            runtime.completeLeafNode(
              {
                worktreePath: projectPath,
                opencodeSessionId: context.sessionID,
              },
              args.nodeId,
              args.completionSummary
            )
        );

        return JSON.stringify(mutation, null, 2);
      },
    }),
    [BRHP_TOOL_IDS.queryNodes]: tool({
      description:
        'Filtered, paginated, read-only query over BRHP planner nodes in the active (or a specified) session. Supports scopeId, parentNodeId, status, category, titleContains, and depth filters with deterministic ordering (title/status/depth). Not capped to a fixed frontier size.',
      args: {
        sessionId: tool.schema.string().min(1).optional(),
        scopeId: tool.schema.string().min(1).optional(),
        parentNodeId: tool.schema.string().min(1).optional(),
        status: tool.schema
          .enum(['proposed', 'active', 'decomposed', 'leaf', 'pruned', 'blocked'])
          .optional(),
        category: tool.schema
          .enum(['dependent', 'isolated', 'parallelizable', 'cross-cutting'])
          .optional(),
        titleContains: tool.schema.string().min(1).optional(),
        depth: tool.schema.number().int().min(0).optional(),
        limit: tool.schema.number().int().min(1).max(200).optional(),
        offset: tool.schema.number().int().min(0).optional(),
      },
      async execute(args, context) {
        const projectPath = await resolveProjectPath(context.sessionID, context);
        context.metadata({
          title: 'Query BRHP planner nodes',
          metadata: {
            tool: BRHP_TOOL_IDS.queryNodes,
            ...(args.titleContains ? { titleContains: args.titleContains } : {}),
            ...(args.status ? { status: args.status } : {}),
          },
        });

        const result = await withRuntime(
          context.sessionID,
          projectPath,
          runtime =>
            runtime.queryNodes(
              {
                worktreePath: projectPath,
                opencodeSessionId: context.sessionID,
              },
              {
                ...(args.sessionId ? { sessionId: args.sessionId } : {}),
                ...(args.scopeId ? { scopeId: args.scopeId } : {}),
                ...(args.parentNodeId ? { parentNodeId: args.parentNodeId } : {}),
                ...(args.status ? { status: args.status } : {}),
                ...(args.category ? { category: args.category } : {}),
                ...(args.titleContains ? { titleContains: args.titleContains } : {}),
                ...(args.depth !== undefined ? { depth: args.depth } : {}),
                ...(args.limit !== undefined ? { limit: args.limit } : {}),
                ...(args.offset !== undefined ? { offset: args.offset } : {}),
              }
            )
        );

        return JSON.stringify(result, null, 2);
      },
    }),
    [BRHP_TOOL_IDS.getNode]: tool({
      description:
        'Read a single BRHP planner node by id, including its direct edges (incoming and outgoing). Read-only.',
      args: {
        id: tool.schema.string().min(1),
        sessionId: tool.schema.string().min(1).optional(),
      },
      async execute(args, context) {
        const projectPath = await resolveProjectPath(context.sessionID, context);
        context.metadata({
          title: `Get BRHP node ${args.id}`,
          metadata: {
            tool: BRHP_TOOL_IDS.getNode,
            nodeId: args.id,
          },
        });

        const result = await withRuntime(
          context.sessionID,
          projectPath,
          runtime =>
            runtime.getNode(
              {
                worktreePath: projectPath,
                opencodeSessionId: context.sessionID,
              },
              args.id,
              args.sessionId
            )
        );

        return JSON.stringify(
          result ?? {
            found: false,
            message: `No BRHP planner node '${args.id}' was found.`,
          },
          null,
          2
        );
      },
    }),
    [BRHP_TOOL_IDS.searchNodes]: tool({
      description:
        'Ranked, read-only search over BRHP planner node titles and problem statements in the active (or a specified) session.',
      args: {
        query: tool.schema.string().min(1),
        limit: tool.schema.number().int().min(1).max(200).optional(),
        sessionId: tool.schema.string().min(1).optional(),
      },
      async execute(args, context) {
        const projectPath = await resolveProjectPath(context.sessionID, context);
        context.metadata({
          title: `Search BRHP planner nodes: ${args.query}`,
          metadata: {
            tool: BRHP_TOOL_IDS.searchNodes,
            query: args.query,
          },
        });

        const nodes = await withRuntime(
          context.sessionID,
          projectPath,
          runtime =>
            runtime.searchNodes(
              {
                worktreePath: projectPath,
                opencodeSessionId: context.sessionID,
              },
              args.query,
              args.limit,
              args.sessionId
            )
        );

        return JSON.stringify({ nodes }, null, 2);
      },
    }),
  };
}
