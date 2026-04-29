import { describe, expect, it } from 'vitest';

import type { PlanningState } from '../../src/domain/planning/planning-session.js';
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
    expect(
      mutation.state.graph.nodes
        .filter(node => node.parentNodeId === rootNodeId)
        .every(node => node.scores.localEntropy === 0)
    ).toBe(true);
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

  it('records validation on the active scope and reloads state with the persisted verdict', async () => {
    const store = createInMemoryStore();
    const ids = createIdGenerator();
    const runtime = createPlannerRuntime({
      clock: { now: () => new Date('2026-04-18T10:10:00.000Z') },
      ids,
      store,
    });
    const context = { worktreePath: '/repo', opencodeSessionId: 'chat-2' };

    await runtime.create(
      context,
      {
        directories: { global: '/global', project: '/repo/.opencode/brhp/instructions' },
        instructions: [],
        counts: { global: 0, project: 0, total: 0, skipped: 0 },
        skippedFiles: [],
      },
      'Validate BRHP planning state'
    );

    const mutation = await runtime.recordValidation(context, {
      clauses: [
        {
          kind: 'schema',
          blocking: true,
          description: 'Planner session must have an active scope.',
          status: 'passed',
        },
        {
          kind: 'coverage',
          blocking: true,
          description: 'The active scope must be fully decomposed.',
          status: 'pending',
          message: 'More work remains.',
        },
      ],
    });

    expect(mutation.kind).toBe('validation-recorded');
    if (mutation.kind !== 'validation-recorded') {
      throw new Error('Expected validation mutation');
    }

    expect(mutation.state.validation?.pendingBlockingClauses).toBe(1);
    expect(mutation.state.validation?.formula.clauses).toHaveLength(2);
    expect(mutation.state.session.status).toBe('validating');
    expect(mutation.state.frontier?.selections.length).toBeGreaterThan(0);
    expect(
      mutation.state.graph.nodes.some(node => node.scores.validationPressure > 0)
    ).toBe(true);

    const reloaded = await runtime.getActive(context);
    expect(reloaded?.frontier?.selections[0]?.validationPressure ?? 0).toBeGreaterThan(0);
  });

  it('does not converge on a satisfiable single-node session without decomposition evidence', async () => {
    const store = createInMemoryStore();
    const ids = createIdGenerator();
    const runtime = createPlannerRuntime({
      clock: { now: () => new Date('2026-04-18T10:12:00.000Z') },
      ids,
      store,
    });
    const context = { worktreePath: '/repo', opencodeSessionId: 'chat-5' };

    await runtime.create(
      context,
      {
        directories: { global: '/global', project: '/repo/.opencode/brhp/instructions' },
        instructions: [],
        counts: { global: 0, project: 0, total: 0, skipped: 0 },
        skippedFiles: [],
      },
      'Reach BRHP convergence'
    );

    const mutation = await runtime.recordValidation(context, {
      clauses: [
        {
          kind: 'schema',
          blocking: true,
          description: 'Planner session must have an active scope.',
          status: 'passed',
        },
      ],
    });

    expect(mutation.kind).toBe('validation-recorded');
    if (mutation.kind !== 'validation-recorded') {
      throw new Error('Expected validation mutation');
    }

    expect(mutation.state.session.status).toBe('validating');
    expect(mutation.state.session.summary.converged).toBe(false);
  });

  it('converges after decomposition followed by satisfiable validation', async () => {
    const store = createInMemoryStore();
    const ids = createIdGenerator();
    const runtime = createPlannerRuntime({
      clock: { now: () => new Date('2026-04-18T10:12:00.000Z') },
      ids,
      store,
    });
    const context = { worktreePath: '/repo', opencodeSessionId: 'chat-5b' };

    await runtime.create(
      context,
      {
        directories: { global: '/global', project: '/repo/.opencode/brhp/instructions' },
        instructions: [],
        counts: { global: 0, project: 0, total: 0, skipped: 0 },
        skippedFiles: [],
      },
      'Reach BRHP convergence after decomposition'
    );

    const initial = await runtime.getActive(context);

    await runtime.decomposeNode(context, {
      nodeId: initial?.session.rootNodeId ?? '',
      children: [
        {
          title: 'Explicit refinement',
          problemStatement: 'Provide decomposition evidence before convergence.',
          category: 'dependent',
        },
      ],
    });

    const mutation = await runtime.recordValidation(context, {
      clauses: [
        {
          kind: 'schema',
          blocking: true,
          description: 'Planner session must have an active scope.',
          status: 'passed',
        },
        {
          kind: 'coverage',
          blocking: true,
          description: 'The active scope is fully covered after decomposition.',
          status: 'passed',
        },
      ],
    });

    expect(mutation.kind).toBe('validation-recorded');
    if (mutation.kind !== 'validation-recorded') {
      throw new Error('Expected validation mutation');
    }

    expect(mutation.state.session.status).toBe('converged');
    expect(mutation.state.session.summary.converged).toBe(true);
  });

  it('stays validating after decomposition when validation is satisfiable but lacks coverage closure', async () => {
    const store = createInMemoryStore();
    const ids = createIdGenerator();
    const runtime = createPlannerRuntime({
      clock: { now: () => new Date('2026-04-18T10:12:00.000Z') },
      ids,
      store,
    });
    const context = { worktreePath: '/repo', opencodeSessionId: 'chat-5c' };

    await runtime.create(
      context,
      {
        directories: { global: '/global', project: '/repo/.opencode/brhp/instructions' },
        instructions: [],
        counts: { global: 0, project: 0, total: 0, skipped: 0 },
        skippedFiles: [],
      },
      'Reach BRHP convergence after decomposition'
    );

    const initial = await runtime.getActive(context);

    await runtime.decomposeNode(context, {
      nodeId: initial?.session.rootNodeId ?? '',
      children: [
        {
          title: 'Explicit refinement',
          problemStatement: 'Provide decomposition evidence before convergence.',
          category: 'dependent',
        },
      ],
    });

    const mutation = await runtime.recordValidation(context, {
      clauses: [
        {
          kind: 'schema',
          blocking: true,
          description: 'Planner session must have an active scope.',
          status: 'passed',
        },
      ],
    });

    expect(mutation.kind).toBe('validation-recorded');
    if (mutation.kind !== 'validation-recorded') {
      throw new Error('Expected validation mutation');
    }

    expect(mutation.state.session.status).toBe('validating');
    expect(mutation.state.session.summary.converged).toBe(false);
  });

  it('preserves validation pressure after decomposing within an unsatisfied active scope', async () => {
    const store = createInMemoryStore();
    const ids = createIdGenerator();
    const runtime = createPlannerRuntime({
      clock: { now: () => new Date('2026-04-18T10:15:00.000Z') },
      ids,
      store,
    });
    const context = { worktreePath: '/repo', opencodeSessionId: 'chat-4' };

    await runtime.create(
      context,
      {
        directories: { global: '/global', project: '/repo/.opencode/brhp/instructions' },
        instructions: [],
        counts: { global: 0, project: 0, total: 0, skipped: 0 },
        skippedFiles: [],
      },
      'Preserve validation pressure after decomposition'
    );

    await runtime.recordValidation(context, {
      clauses: [
        {
          kind: 'coverage',
          blocking: true,
          description: 'The active scope must still be decomposed further.',
          status: 'pending',
        },
      ],
    });

    const validated = await runtime.getActive(context);
    const rootNodeId = validated?.session.rootNodeId ?? '';

    const mutation = await runtime.decomposeNode(context, {
      nodeId: rootNodeId,
      children: [
        {
          title: 'Keep frontier pressure on follow-up work',
          problemStatement: 'The new child should inherit scope pressure while validation remains pending.',
          category: 'dependent',
        },
      ],
    });

    expect(mutation.kind).toBe('decomposed');
    if (mutation.kind !== 'decomposed') {
      throw new Error('Expected decomposition mutation');
    }

    expect(
      mutation.state.graph.nodes
        .filter(node => node.parentNodeId === rootNodeId)
        .some(node => node.scores.validationPressure > 0)
    ).toBe(true);
    expect(mutation.state.frontier?.selections.some(selection => selection.validationPressure > 0)).toBe(
      true
    );
  });

  it('returns to exploring when a converged session is decomposed', async () => {
    const store = createInMemoryStore();
    const ids = createIdGenerator();
    const runtime = createPlannerRuntime({
      clock: { now: () => new Date('2026-04-18T10:20:00.000Z') },
      ids,
      store,
    });
    const context = { worktreePath: '/repo', opencodeSessionId: 'chat-6' };

    await runtime.create(
      context,
      {
        directories: { global: '/global', project: '/repo/.opencode/brhp/instructions' },
        instructions: [],
        counts: { global: 0, project: 0, total: 0, skipped: 0 },
        skippedFiles: [],
      },
      'Invalidate convergence by decomposing'
    );

    const initial = await runtime.getActive(context);

    await runtime.decomposeNode(context, {
      nodeId: initial?.session.rootNodeId ?? '',
      children: [
        {
          title: 'Establish convergence precondition',
          problemStatement: 'Provide structural refinement before convergence.',
          category: 'dependent',
        },
      ],
    });

    await runtime.recordValidation(context, {
      clauses: [
        {
          kind: 'schema',
          blocking: true,
          description: 'Planner session must have an active scope.',
          status: 'passed',
        },
        {
          kind: 'coverage',
          blocking: true,
          description: 'The active scope is fully covered after decomposition.',
          status: 'passed',
        },
      ],
    });

    const converged = await runtime.getActive(context);
    expect(converged?.session.status).toBe('converged');
    expect(converged?.session.summary.converged).toBe(true);
    const frontierNodeId = converged?.frontier?.selections[0]?.nodeId ?? '';

    const mutation = await runtime.decomposeNode(context, {
      nodeId: frontierNodeId,
      children: [
        {
          title: 'Invalidate the converged frontier',
          problemStatement: 'Any decomposition should return the session to exploring.',
          category: 'dependent',
        },
      ],
    });

    expect(mutation.kind).toBe('decomposed');
    if (mutation.kind !== 'decomposed') {
      throw new Error('Expected decomposition mutation');
    }

    expect(mutation.state.session.status).toBe('exploring');
    expect(mutation.state.session.summary.converged).toBe(false);
  });

  it('rejects validation when no active session exists', async () => {
    const store = createInMemoryStore();
    const runtime = createPlannerRuntime({
      clock: { now: () => new Date('2026-04-18T10:00:00.000Z') },
      ids: createIdGenerator(),
      store,
    });

    await expect(
      runtime.recordValidation(
        { worktreePath: '/repo', opencodeSessionId: 'chat-3' },
        {
          clauses: [
            {
              kind: 'schema',
              blocking: true,
              description: 'x',
              status: 'passed',
            },
          ],
        }
      )
    ).rejects.toThrow('No active BRHP planning session exists');
  });

  it('rejects validation and decomposition when the active session is archived', async () => {
    const store = createInMemoryStore();
    const ids = createIdGenerator();
    const runtime = createPlannerRuntime({
      clock: { now: () => new Date('2026-04-18T10:25:00.000Z') },
      ids,
      store,
    });
    const context = { worktreePath: '/repo', opencodeSessionId: 'chat-7' };

    await runtime.create(
      context,
      {
        directories: { global: '/global', project: '/repo/.opencode/brhp/instructions' },
        instructions: [],
        counts: { global: 0, project: 0, total: 0, skipped: 0 },
        skippedFiles: [],
      },
      'Archive guardrails'
    );

    const active = await runtime.getActive(context);
    if (!active) {
      throw new Error('Expected active session');
    }

    store.forceSessionStatus(active.session.id, 'archived');

    await expect(
      runtime.recordValidation(context, {
        clauses: [
          {
            kind: 'schema',
            blocking: true,
            description: 'Archived sessions must reject validation.',
            status: 'passed',
          },
        ],
      })
    ).rejects.toThrow('Archived BRHP planning sessions cannot be validated');

    await expect(
      runtime.decomposeNode(context, {
        nodeId: active.session.rootNodeId,
        children: [
          {
            title: 'Should not decompose',
            problemStatement: 'Archived sessions must reject decomposition.',
            category: 'dependent',
          },
        ],
      })
    ).rejects.toThrow('Archived BRHP planning sessions cannot be decomposed');
  });
});

function createInMemoryStore() {
  type TestState = ReturnType<typeof createPlanningSessionSeed> & {
    validation?: PlanningState['validation'];
  };
  const states = new Map<string, TestState>();
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
    async applyValidationRecord(patch: any) {
      const existing = states.get(patch.session.id);
      if (!existing) {
        throw new Error('Missing session');
      }
      states.set(patch.session.id, {
        ...existing,
        session: patch.session,
        nodes: patch.updatedNodes,
        frontier: patch.frontier,
        validation: patch.validation,
        events: existing.events.concat(patch.events),
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
        ...(state.validation ? { validation: state.validation } : {}),
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
        ...(state.validation ? { validation: state.validation } : {}),
      };
    },
    async listSessions(worktreePath: string) {
      return [...states.values()]
        .filter(state => state.session.worktreePath === worktreePath)
        .map(state => state.session);
    },
    async listRecentEvents(sessionId: string, limit: number) {
      const state = states.get(sessionId);
      if (!state) {
        return [];
      }

      return [...state.events]
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id))
        .slice(0, limit);
    },
    forceSessionStatus(sessionId: string, status: PlanningState['session']['status']) {
      const state = states.get(sessionId);
      if (!state) {
        throw new Error('Missing session');
      }
      states.set(sessionId, {
        ...state,
        session: {
          ...state.session,
          status,
        },
      });
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
