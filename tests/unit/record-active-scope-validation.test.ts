import { describe, expect, it } from 'vitest';

import { createPlanningSessionSeed } from '../../src/application/use-cases/create-planning-session-seed.js';
import { recordActiveScopeValidation } from '../../src/application/use-cases/record-active-scope-validation.js';

describe('recordActiveScopeValidation', () => {
  it('records a deterministic validation verdict and updates session summary counts', () => {
    const seed = createPlanningSessionSeed({
      clock: { now: () => new Date('2026-04-19T10:00:00.000Z') },
      ids: createIdGenerator(),
      worktreePath: '/repo',
      opencodeSessionId: 'chat-1',
      problemStatement: 'Formalize BRHP validation persistence.',
    });

    const patch = recordActiveScopeValidation({
      clock: { now: () => new Date('2026-04-19T10:05:00.000Z') },
      ids: createIdGenerator(100),
      state: {
        session: seed.session,
        graph: {
          scopes: seed.scopes,
          nodes: seed.nodes,
          edges: seed.edges,
        },
        frontier: seed.frontier,
      },
      clauses: [
        {
          kind: 'structure',
          blocking: true,
          description: 'The active scope must contain a root node.',
          status: 'passed',
        },
        {
          kind: 'coverage',
          blocking: true,
          description: 'The active scope must have complete decomposition coverage.',
          status: 'pending',
          message: 'Decomposition is still incomplete.',
        },
      ],
    });

    expect(patch.validation.formula.clauses).toHaveLength(2);
    expect(patch.validation.satisfiable).toBe(false);
    expect(patch.validation.blockingFindings).toBe(0);
    expect(patch.validation.pendingBlockingClauses).toBe(1);
    expect(patch.session.status).toBe('validating');
    expect(patch.session.summary.pendingBlockingClauses).toBe(1);
    expect(patch.updatedNodes.some(node => node.scores.validationPressure > 0)).toBe(true);
    expect(patch.frontier.selections.length).toBeGreaterThan(0);
    expect(patch.frontier.selections.some(selection => selection.validationPressure > 0)).toBe(true);
    expect(patch.session.revision).toBe(seed.session.revision + 1);
    expect(patch.events.map(event => event.type)).toEqual([
      'validation-recorded',
      'frontier-snapshotted',
    ]);
    expect(patch.events[1]?.payload).toMatchObject({ reason: 'validation' });
  });

  it('preserves signed entropy drift when validation reduces frontier entropy', () => {
    const seed = createPlanningSessionSeed({
      clock: { now: () => new Date('2026-04-19T10:00:00.000Z') },
      ids: createIdGenerator(),
      worktreePath: '/repo',
      opencodeSessionId: 'chat-1',
      problemStatement: 'Formalize BRHP validation persistence.',
    });

    const patch = recordActiveScopeValidation({
      clock: { now: () => new Date('2026-04-19T10:05:00.000Z') },
      ids: createIdGenerator(100),
      state: {
        session: {
          ...seed.session,
          summary: {
            ...seed.session.summary,
            globalEntropy: 0.9,
          },
        },
        graph: {
          scopes: seed.scopes,
          nodes: seed.nodes,
          edges: seed.edges,
        },
        frontier: seed.frontier,
      },
      clauses: [
        {
          kind: 'schema',
          blocking: true,
          description: 'The root scope still exists.',
          status: 'passed',
        },
      ],
    });

    expect(patch.validation.satisfiable).toBe(true);
    expect(patch.session.summary.entropyDrift).toBeLessThan(0);
  });

  it('rejects empty validation clause lists', () => {
    const seed = createPlanningSessionSeed({
      clock: { now: () => new Date('2026-04-19T10:00:00.000Z') },
      ids: createIdGenerator(),
      worktreePath: '/repo',
      opencodeSessionId: 'chat-1',
      problemStatement: 'Formalize BRHP validation persistence.',
    });

    expect(() =>
      recordActiveScopeValidation({
        clock: { now: () => new Date('2026-04-19T10:05:00.000Z') },
        ids: createIdGenerator(100),
        state: {
          session: seed.session,
          graph: {
            scopes: seed.scopes,
            nodes: seed.nodes,
            edges: seed.edges,
          },
          frontier: seed.frontier,
        },
        clauses: [],
      })
    ).toThrow('clauses must contain at least one validation clause');
  });

  it('preserves a converged session when the new validation verdict is satisfiable', () => {
    const seed = createPlanningSessionSeed({
      clock: { now: () => new Date('2026-04-19T10:00:00.000Z') },
      ids: createIdGenerator(),
      worktreePath: '/repo',
      opencodeSessionId: 'chat-1',
      problemStatement: 'Formalize BRHP validation persistence.',
    });

    const patch = recordActiveScopeValidation({
      clock: { now: () => new Date('2026-04-19T10:05:00.000Z') },
      ids: createIdGenerator(100),
      state: {
        session: {
          ...seed.session,
          status: 'converged',
          summary: {
            ...seed.session.summary,
            converged: true,
          },
        },
        graph: {
          scopes: seed.scopes,
          nodes: seed.nodes,
          edges: seed.edges,
        },
        frontier: seed.frontier,
      },
      clauses: [
        {
          kind: 'schema',
          blocking: true,
          description: 'The root scope still exists.',
          status: 'passed',
        },
      ],
    });

    expect(patch.validation.satisfiable).toBe(true);
    expect(patch.session.status).toBe('converged');
    expect(patch.session.summary.converged).toBe(true);
    expect(patch.updatedNodes.every(node => node.scores.validationPressure === 0)).toBe(true);
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
