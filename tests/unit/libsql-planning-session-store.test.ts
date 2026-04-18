import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createClient } from '@libsql/client';

import { openPlanningDatabase } from '../../src/adapters/libsql/planning-database.js';
import { LibsqlPlanningSessionStore } from '../../src/adapters/libsql/libsql-planning-session-store.js';
import { createPlannerRuntime } from '../../src/application/services/planner-runtime.js';
import { decomposePlanningNode } from '../../src/application/use-cases/decompose-planning-node.js';
import { createPlanningSessionSeed } from '../../src/application/use-cases/create-planning-session-seed.js';

describe('LibsqlPlanningSessionStore', () => {
  it('persists and reloads an active planning session from libsql', async () => {
    const worktreePath = await mkdtemp(path.join(os.tmpdir(), 'brhp-libsql-store-'));
    const database = await openPlanningDatabase({ worktreePath });

    try {
      const store = new LibsqlPlanningSessionStore(database.client);
      const seed = createPlanningSessionSeed({
        clock: { now: () => new Date('2026-04-17T12:00:00.000Z') },
        ids: createIdGenerator(),
        worktreePath,
        opencodeSessionId: 'oc-session-1',
        problemStatement: 'Build BRHP as an OpenCode-native planning harness.',
        policyDocumentIds: ['policy-1'],
        instructionDocumentIds: ['instruction-1'],
        invariants: ['All graph changes are persisted.'],
      });

      await store.createSession(seed);

      const active = await store.getActiveSession({
        worktreePath,
        opencodeSessionId: 'oc-session-1',
      });
      const sessions = await store.listSessions(worktreePath);

      expect(active?.session.id).toBe(seed.session.id);
      expect(active?.session.policy.policyDocumentIds).toEqual(['policy-1']);
      expect(active?.session.policy.instructionDocumentIds).toEqual(['instruction-1']);
      expect(active?.session.policy.invariants).toEqual(['All graph changes are persisted.']);
      expect(active?.graph.scopes).toHaveLength(1);
      expect(active?.graph.nodes).toHaveLength(1);
      expect(active?.graph.edges).toHaveLength(0);
      expect(active?.frontier?.selections).toHaveLength(1);
      expect(active?.frontier?.selections[0]?.nodeId).toBe(seed.nodes[0]?.id);
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.id).toBe(seed.session.id);
    } finally {
      database.close();
      await rm(worktreePath, { recursive: true, force: true });
    }
  });

  it('deactivates the previous active session when a new session is created for the same worktree', async () => {
    const worktreePath = await mkdtemp(path.join(os.tmpdir(), 'brhp-libsql-active-'));
    const database = await openPlanningDatabase({ worktreePath });

    try {
      const store = new LibsqlPlanningSessionStore(database.client);
      const ids = createIdGenerator();
      const clock = { now: () => new Date('2026-04-17T12:00:00.000Z') };

      const first = createPlanningSessionSeed({
        clock,
        ids,
        worktreePath,
        opencodeSessionId: 'oc-session-a',
        problemStatement: 'First planner run.',
      });
      const second = createPlanningSessionSeed({
        clock,
        ids,
        worktreePath,
        opencodeSessionId: 'oc-session-a',
        problemStatement: 'Second planner run.',
      });

      await store.createSession(first);
      await store.createSession(second);

      const active = await store.getActiveSession({
        worktreePath,
        opencodeSessionId: 'oc-session-a',
      });
      const sessions = await store.listSessions(worktreePath);

      expect(active?.session.id).toBe(second.session.id);
      expect(sessions).toHaveLength(2);
      expect(sessions[0]?.id).toBe(second.session.id);
      expect(sessions[1]?.id).toBe(first.session.id);
    } finally {
      database.close();
      await rm(worktreePath, { recursive: true, force: true });
    }
  });

  it('rejects seeds with dangling root references before writing to libsql', async () => {
    const worktreePath = await mkdtemp(path.join(os.tmpdir(), 'brhp-libsql-invalid-'));
    const database = await openPlanningDatabase({ worktreePath });

    try {
      const store = new LibsqlPlanningSessionStore(database.client);
      const seed = createPlanningSessionSeed({
        clock: { now: () => new Date('2026-04-17T12:00:00.000Z') },
        ids: createIdGenerator(),
        worktreePath,
        opencodeSessionId: 'oc-session-invalid',
        problemStatement: 'Invalid session root test.',
      });
      const invalidSeed = {
        ...seed,
        session: {
          ...seed.session,
          rootNodeId: 'missing-node',
        },
      };

      await expect(store.createSession(invalidSeed)).rejects.toThrow(
        'rootNodeId does not reference an existing node'
      );
    } finally {
      database.close();
      await rm(worktreePath, { recursive: true, force: true });
    }
  });

  it('isolates active sessions per OpenCode session context and allows activation by id', async () => {
    const worktreePath = await mkdtemp(path.join(os.tmpdir(), 'brhp-libsql-context-'));
    const database = await openPlanningDatabase({ worktreePath });

    try {
      const store = new LibsqlPlanningSessionStore(database.client);
      const ids = createIdGenerator();
      const clock = { now: () => new Date('2026-04-17T12:00:00.000Z') };
      const first = createPlanningSessionSeed({
        clock,
        ids,
        worktreePath,
        opencodeSessionId: 'chat-a',
        problemStatement: 'Chat A session.',
      });
      const second = createPlanningSessionSeed({
        clock,
        ids,
        worktreePath,
        opencodeSessionId: 'chat-b',
        problemStatement: 'Chat B session.',
      });

      await store.createSession(first);
      await store.createSession(second);

      expect(
        (await store.getActiveSession({ worktreePath, opencodeSessionId: 'chat-a' }))?.session.id
      ).toBe(first.session.id);
      expect(
        (await store.getActiveSession({ worktreePath, opencodeSessionId: 'chat-b' }))?.session.id
      ).toBe(second.session.id);

      const activated = await store.activateSession(
        { worktreePath, opencodeSessionId: 'chat-a' },
        second.session.id
      );

      expect(activated).toBe(true);
      expect(
        (await store.getActiveSession({ worktreePath, opencodeSessionId: 'chat-a' }))?.session.id
      ).toBe(second.session.id);
      expect(
        (await store.getActiveSession({ worktreePath, opencodeSessionId: 'chat-b' }))?.session.id
      ).toBeUndefined();
      expect((await store.getSessionById(worktreePath, first.session.id))?.session.id).toBe(
        first.session.id
      );
    } finally {
      database.close();
      await rm(worktreePath, { recursive: true, force: true });
    }
  });

  it('persists node decomposition and refreshed frontier state', async () => {
    const worktreePath = await mkdtemp(path.join(os.tmpdir(), 'brhp-libsql-decompose-'));
    const database = await openPlanningDatabase({ worktreePath });

    try {
      const store = new LibsqlPlanningSessionStore(database.client);
      const ids = createIdGenerator();
      const runtime = createPlannerRuntime({
        clock: { now: () => new Date('2026-04-18T12:00:00.000Z') },
        ids,
        store,
      });
      const context = { worktreePath, opencodeSessionId: 'chat-decompose' };

      await runtime.create(
        context,
        {
          directories: { global: '/global', project: `${worktreePath}/.opencode/brhp/instructions` },
          instructions: [],
          counts: { global: 0, project: 0, total: 0, skipped: 0 },
          skippedFiles: [],
        },
        'Formalize BRHP as an OpenCode-native planner'
      );

      const initialState = await runtime.getActive(context);
      const rootNodeId = initialState?.session.rootNodeId;

      const mutation = await runtime.decomposeNode(context, {
        nodeId: rootNodeId!,
        children: [
          {
            title: 'Read current graph',
            problemStatement: 'Inspect the authoritative BRHP state first.',
            category: 'dependent',
          },
          {
            title: 'Apply graph decomposition',
            problemStatement: 'Persist the child nodes and updated frontier.',
            category: 'cross-cutting',
          },
        ],
      });

      expect(mutation.kind).toBe('decomposed');

      const reloaded = await store.getActiveSession(context);

      expect(reloaded?.graph.nodes).toHaveLength(3);
      expect(reloaded?.graph.edges).toHaveLength(2);
      expect(reloaded?.graph.nodes.find(node => node.id === rootNodeId)?.status).toBe('decomposed');
      expect(reloaded?.frontier?.selections.length).toBeGreaterThan(0);
      expect(reloaded?.session.summary.lastFrontierUpdatedAt).toBe('2026-04-18T12:00:00.000Z');
    } finally {
      database.close();
      await rm(worktreePath, { recursive: true, force: true });
    }
  });

  it('rejects a second decomposition after the parent node has changed and leaves graph counts unchanged', async () => {
    const worktreePath = await mkdtemp(path.join(os.tmpdir(), 'brhp-libsql-conflict-'));
    const database = await openPlanningDatabase({ worktreePath });

    try {
      const store = new LibsqlPlanningSessionStore(database.client);
      const ids = createIdGenerator();
      const runtime = createPlannerRuntime({
        clock: { now: () => new Date('2026-04-18T12:30:00.000Z') },
        ids,
        store,
      });
      const context = { worktreePath, opencodeSessionId: 'chat-conflict' };

      await runtime.create(
        context,
        {
          directories: { global: '/global', project: `${worktreePath}/.opencode/brhp/instructions` },
          instructions: [],
          counts: { global: 0, project: 0, total: 0, skipped: 0 },
          skippedFiles: [],
        },
        'Formalize BRHP as an OpenCode-native planner'
      );

      const state = await runtime.getActive(context);
      const staleState = await store.getSessionById(worktreePath, state!.session.id);
      const rootNodeId = state?.session.rootNodeId!;

      await runtime.decomposeNode(context, {
        nodeId: rootNodeId,
        children: [
          {
            title: 'First child',
            problemStatement: 'Create the first decomposition branch.',
            category: 'dependent',
          },
        ],
      });

      const stalePatch = decomposePlanningNode({
        clock: { now: () => new Date('2026-04-18T12:30:01.000Z') },
        ids: createIdGenerator(100),
        state: {
          ...staleState!,
          graph: {
            ...staleState!.graph,
            nodes: staleState!.graph.nodes.map(node =>
              node.id === rootNodeId ? { ...node, status: 'active' as const } : node
            ),
          },
        },
        nodeId: rootNodeId,
        children: [
          {
            title: 'Conflicting child',
            problemStatement: 'Attempt a stale decomposition write.',
            category: 'dependent',
          },
        ],
      });

      await expect(store.applyNodeDecomposition(stalePatch)).rejects.toThrow('changed concurrently');

      const reloaded = await store.getActiveSession(context);

      expect(reloaded?.graph.nodes).toHaveLength(2);
      expect(reloaded?.graph.edges).toHaveLength(1);
    } finally {
      database.close();
      await rm(worktreePath, { recursive: true, force: true });
    }
  });

  it('rolls back a stale decomposition when another node already advanced the session revision', async () => {
    const worktreePath = await mkdtemp(path.join(os.tmpdir(), 'brhp-libsql-revision-conflict-'));
    const database = await openPlanningDatabase({ worktreePath });

    try {
      const store = new LibsqlPlanningSessionStore(database.client);
      const ids = createIdGenerator();
      const runtime = createPlannerRuntime({
        clock: { now: () => new Date('2026-04-18T12:45:00.000Z') },
        ids,
        store,
      });
      const context = { worktreePath, opencodeSessionId: 'chat-revision' };

      await runtime.create(
        context,
        {
          directories: { global: '/global', project: `${worktreePath}/.opencode/brhp/instructions` },
          instructions: [],
          counts: { global: 0, project: 0, total: 0, skipped: 0 },
          skippedFiles: [],
        },
        'Formalize BRHP as an OpenCode-native planner'
      );

      const initialState = await runtime.getActive(context);
      const rootNodeId = initialState?.session.rootNodeId!;

      await runtime.decomposeNode(context, {
        nodeId: rootNodeId,
        children: [
          {
            title: 'Plan tool surface',
            problemStatement: 'Define planner tool responsibilities.',
            category: 'cross-cutting',
          },
          {
            title: 'Plan persistence semantics',
            problemStatement: 'Define transactional update semantics.',
            category: 'dependent',
          },
        ],
      });

      const branchedState = await runtime.getActive(context);
      const firstChild = branchedState?.graph.nodes.find(node => node.parentNodeId === rootNodeId);
      const secondChild = branchedState?.graph.nodes.find(
        node => node.parentNodeId === rootNodeId && node.id !== firstChild?.id
      );

      const stalePatch = decomposePlanningNode({
        clock: { now: () => new Date('2026-04-18T12:45:01.000Z') },
        ids: createIdGenerator(200),
        state: branchedState!,
        nodeId: firstChild!.id,
        children: [
          {
            title: 'Stale decomposition branch',
            problemStatement: 'This write should roll back on revision conflict.',
            category: 'dependent',
          },
        ],
      });

      await runtime.decomposeNode(context, {
        nodeId: secondChild!.id,
        children: [
          {
            title: 'Winning decomposition branch',
            problemStatement: 'Advance the session revision on another node.',
            category: 'dependent',
          },
        ],
      });

      await expect(store.applyNodeDecomposition(stalePatch)).rejects.toThrow(
        'changed concurrently while updating the summary'
      );

      const reloaded = await store.getActiveSession(context);

      expect(reloaded?.graph.nodes.map(node => node.title)).not.toContain('Stale decomposition branch');
      expect(reloaded?.graph.edges).toHaveLength(3);
      expect(reloaded?.session.revision).toBe(2);
    } finally {
      database.close();
      await rm(worktreePath, { recursive: true, force: true });
    }
  });

  it('applies the event-type expansion migration to an existing planner database', async () => {
    const worktreePath = await mkdtemp(path.join(os.tmpdir(), 'brhp-libsql-migration-'));
    const databasePath = path.join(worktreePath, '.opencode', 'brhp', 'brhp.db');

    await mkdir(path.dirname(databasePath), { recursive: true });

    const client = createClient({
      url: `file:${databasePath}`,
      intMode: 'number',
    });

    try {
      const initialMigration = await readFile(
        new URL('../../db/migrations/0001_planning_kernel.sql', import.meta.url),
        'utf8'
      );

      await client.executeMultiple(initialMigration);
      await client.execute({
        sql: `
          CREATE TABLE brhp_schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at DATETIME NOT NULL
          )
        `,
      });
      await client.execute({
        sql: `
          INSERT INTO brhp_schema_migrations (version, applied_at)
          VALUES (:version, :applied_at)
        `,
        args: {
          version: '0001_planning_kernel.sql',
          applied_at: '2026-04-18T00:00:00.000Z',
        },
      });
      await client.execute({
        sql: `
          INSERT INTO planner_sessions (
            id,
            worktree_path,
            opencode_session_id,
            initial_problem,
            status,
            active_scope_id,
            root_node_id,
            temperature,
            top_p,
            temperature_floor,
            temperature_ceiling,
            min_depth_clamp,
            max_depth_clamp,
            depth_clamp,
            global_entropy,
            entropy_drift,
            frontier_stability,
            blocking_findings,
            pending_blocking_clauses,
            converged,
            last_frontier_updated_at,
            is_active,
            created_at,
            updated_at
          ) VALUES (
            :id,
            :worktree_path,
            :opencode_session_id,
            :initial_problem,
            :status,
            :active_scope_id,
            :root_node_id,
            :temperature,
            :top_p,
            :temperature_floor,
            :temperature_ceiling,
            :min_depth_clamp,
            :max_depth_clamp,
            :depth_clamp,
            :global_entropy,
            :entropy_drift,
            :frontier_stability,
            :blocking_findings,
            :pending_blocking_clauses,
            :converged,
            :last_frontier_updated_at,
            :is_active,
            :created_at,
            :updated_at
          )
        `,
        args: {
          id: 'session-1',
          worktree_path: worktreePath,
          opencode_session_id: 'chat-old',
          initial_problem: 'Legacy planner session',
          status: 'exploring',
          active_scope_id: 'scope-1',
          root_node_id: 'node-1',
          temperature: 0.35,
          top_p: 0.9,
          temperature_floor: 0.1,
          temperature_ceiling: 1,
          min_depth_clamp: 1,
          max_depth_clamp: 5,
          depth_clamp: 4,
          global_entropy: 0,
          entropy_drift: 0,
          frontier_stability: 1,
          blocking_findings: 0,
          pending_blocking_clauses: 0,
          converged: 0,
          last_frontier_updated_at: '2026-04-18T00:00:00.000Z',
          is_active: 1,
          created_at: '2026-04-18T00:00:00.000Z',
          updated_at: '2026-04-18T00:00:00.000Z',
        },
      });
      await client.execute({
        sql: `
          INSERT INTO planner_events (id, session_id, scope_id, node_id, type, payload_json, occurred_at)
          VALUES (:id, :session_id, :scope_id, :node_id, :type, :payload_json, :occurred_at)
        `,
        args: {
          id: 'event-1',
          session_id: 'session-1',
          scope_id: null,
          node_id: null,
          type: 'node-created',
          payload_json: '{}',
          occurred_at: '2026-04-18T00:00:00.000Z',
        },
      });

      client.close();

      const upgraded = await openPlanningDatabase({ worktreePath });

      try {
        const revisionRow = await upgraded.client.execute({
          sql: `
            SELECT revision
            FROM planner_sessions
            WHERE id = :id
            LIMIT 1
          `,
          args: {
            id: 'session-1',
          },
        });
        const existingEvents = await upgraded.client.execute({
          sql: `
            SELECT id, type
            FROM planner_events
            ORDER BY occurred_at ASC, id ASC
          `,
        });
        const result = await upgraded.client.execute({
          sql: `
            INSERT INTO planner_events (id, session_id, scope_id, node_id, type, payload_json, occurred_at)
            VALUES (:id, :session_id, :scope_id, :node_id, :type, :payload_json, :occurred_at)
          `,
          args: {
            id: 'event-2',
            session_id: 'session-1',
            scope_id: null,
            node_id: null,
            type: 'node-decomposed',
            payload_json: '{}',
            occurred_at: '2026-04-18T00:00:01.000Z',
          },
        });

        expect(revisionRow.rows[0]?.revision).toBe(0);
        expect(existingEvents.rows.map(row => row.id)).toEqual(['event-1']);
        expect(result.rowsAffected).toBe(1);
      } finally {
        upgraded.close();
      }
    } finally {
      client.close();
      await rm(worktreePath, { recursive: true, force: true });
    }
  });
});

function createIdGenerator(start = 0) {
  let index = start;

  return {
    nextId() {
      index += 1;
      return `id-${index}`;
    },
  };
}
