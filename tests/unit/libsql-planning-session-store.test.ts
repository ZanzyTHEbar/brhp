import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { openPlanningDatabase } from '../../src/adapters/libsql/planning-database.js';
import { LibsqlPlanningSessionStore } from '../../src/adapters/libsql/libsql-planning-session-store.js';
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
});

function createIdGenerator() {
  let index = 0;

  return {
    nextId() {
      index += 1;
      return `id-${index}`;
    },
  };
}
