import { describe, expect, it } from 'vitest';

import { createPlannerRuntime } from '../../src/application/services/planner-runtime.js';
import { createPlanningSessionSeed } from '../../src/application/use-cases/create-planning-session-seed.js';

describe('createPlannerRuntime', () => {
  it('returns null when no active session exists', async () => {
    const store = createInMemoryStore();
    const runtime = createPlannerRuntime({
      clock: { now: () => new Date('2026-04-18T10:00:00.000Z') },
      ids: createIdGenerator(),
      store,
    });

    await expect(
      runtime.getActive({ worktreePath: '/repo', opencodeSessionId: 'chat-1' })
    ).resolves.toBeNull();
  });

  it('decomposes an active node into child nodes and refreshes frontier state', async () => {
    const store = createInMemoryStore();
    const ids = createIdGenerator();
    const runtime = createPlannerRuntime({
      clock: { now: () => new Date('2026-04-18T10:00:00.000Z') },
      ids,
      store,
    });
    const inventory = {
      directories: { global: '/global', project: '/repo/.opencode/brhp/instructions' },
      instructions: [],
      counts: { global: 0, project: 0, total: 0, skipped: 0 },
      skippedFiles: [],
    };
    const context = { worktreePath: '/repo', opencodeSessionId: 'chat-1' };

    await runtime.create(context, inventory, 'Formalize BRHP runtime');
    const created = await runtime.getActive(context);
    const rootNodeId = created?.session.rootNodeId;

    const mutation = await runtime.decomposeNode(context, {
      nodeId: rootNodeId!,
      children: [
        {
          title: 'Define tool contract',
          problemStatement: 'Specify the minimal BRHP planner tool API.',
          category: 'cross-cutting',
        },
        {
          title: 'Add transactional mutation path',
          problemStatement: 'Persist decomposition and frontier updates atomically.',
          category: 'dependent',
        },
      ],
    });

    expect(mutation.kind).toBe('decomposed');
    if (mutation.kind !== 'decomposed') {
      throw new Error('Expected decomposition mutation');
    }

    expect(mutation.state.graph.nodes).toHaveLength(3);
    expect(mutation.state.graph.edges).toHaveLength(2);
    expect(mutation.state.graph.nodes.find(node => node.id === rootNodeId)?.status).toBe('decomposed');
    expect(mutation.state.frontier?.selections.length).toBeGreaterThan(0);
    expect(mutation.state.session.summary.lastFrontierUpdatedAt).toBe('2026-04-18T10:00:00.000Z');
  });

  it('rejects decomposition when the target node is missing, already decomposed, or child list is empty', async () => {
    const store = createInMemoryStore();
    const ids = createIdGenerator();
    const runtime = createPlannerRuntime({
      clock: { now: () => new Date('2026-04-18T10:00:00.000Z') },
      ids,
      store,
    });
    const context = { worktreePath: '/repo', opencodeSessionId: 'chat-1' };

    await expect(
      runtime.decomposeNode(context, {
        nodeId: 'missing-node',
        children: [
          {
            title: 'Child',
            problemStatement: 'x',
            category: 'dependent',
          },
        ],
      })
    ).rejects.toThrow('No active BRHP planning session exists');

    await runtime.create(
      context,
      {
        directories: { global: '/global', project: '/repo/.opencode/brhp/instructions' },
        instructions: [],
        counts: { global: 0, project: 0, total: 0, skipped: 0 },
        skippedFiles: [],
      },
      'Formalize BRHP runtime'
    );

    await expect(
      runtime.decomposeNode(context, {
        nodeId: 'missing-node',
        children: [
          {
            title: 'Child',
            problemStatement: 'x',
            category: 'dependent',
          },
        ],
      })
    ).rejects.toThrow("Planning node 'missing-node' does not exist");

    const state = await runtime.getActive(context);
    const rootNodeId = state?.session.rootNodeId!;

    await expect(
      runtime.decomposeNode(context, {
        nodeId: rootNodeId,
        children: [],
      })
    ).rejects.toThrow('children must contain at least one child node');

    await runtime.decomposeNode(context, {
      nodeId: rootNodeId,
      children: [
        {
          title: 'Child',
          problemStatement: 'x',
          category: 'dependent',
        },
      ],
    });

    await expect(
      runtime.decomposeNode(context, {
        nodeId: rootNodeId,
        children: [
          {
            title: 'Child 2',
            problemStatement: 'y',
            category: 'dependent',
          },
        ],
      })
    ).rejects.toThrow('has already been decomposed');
  });
});

function createInMemoryStore() {
  const states = new Map<string, ReturnType<typeof createPlanningSessionSeed>>();
  const activeByContext = new Map<string, string>();

  return {
    async createSession(seed: ReturnType<typeof createPlanningSessionSeed>) {
      states.set(seed.session.id, seed);
      activeByContext.set(contextKey(seed.session.worktreePath, seed.session.opencodeSessionId), seed.session.id);
    },
    async activateSession(context: { worktreePath: string; opencodeSessionId: string }, sessionId: string) {
      const state = states.get(sessionId);
      if (!state || state.session.worktreePath !== context.worktreePath) {
        return false;
      }
      const nextState = {
        ...state,
        session: {
          ...state.session,
          opencodeSessionId: context.opencodeSessionId,
        },
      };
      states.set(sessionId, nextState);
      activeByContext.set(contextKey(context.worktreePath, context.opencodeSessionId), sessionId);
      return true;
    },
    async applyNodeDecomposition(patch: any) {
      const existing = states.get(patch.session.id);
      if (!existing) {
        throw new Error('Missing session');
      }
      states.set(patch.session.id, {
        session: patch.session,
        scopes: existing.scopes,
        nodes: existing.nodes
          .map(node => (node.id === patch.updatedParentNode.id ? patch.updatedParentNode : node))
          .concat(patch.childNodes),
        edges: existing.edges.concat(patch.edges),
        events: existing.events.concat(patch.events),
        frontier: patch.frontier,
      });
    },
    async getActiveSession(context: { worktreePath: string; opencodeSessionId: string }) {
      const activeId = activeByContext.get(contextKey(context.worktreePath, context.opencodeSessionId));
      const state = activeId ? states.get(activeId) : undefined;
      if (!state) {
        return null;
      }
      return {
        session: state.session,
        graph: {
          scopes: state.scopes,
          nodes: state.nodes,
          edges: state.edges,
        },
        frontier: state.frontier,
      };
    },
    async getSessionById(worktreePath: string, sessionId: string) {
      const state = states.get(sessionId);
      if (!state || state.session.worktreePath !== worktreePath) {
        return null;
      }
      return {
        session: state.session,
        graph: {
          scopes: state.scopes,
          nodes: state.nodes,
          edges: state.edges,
        },
        frontier: state.frontier,
      };
    },
    async listSessions(worktreePath: string) {
      return [...states.values()]
        .filter(state => state.session.worktreePath === worktreePath)
        .map(state => state.session);
    },
  };
}

function contextKey(worktreePath: string, opencodeSessionId: string) {
  return `${worktreePath}::${opencodeSessionId}`;
}

function createIdGenerator() {
  let index = 0;

  return {
    nextId() {
      index += 1;
      return `id-${index}`;
    },
  };
}
