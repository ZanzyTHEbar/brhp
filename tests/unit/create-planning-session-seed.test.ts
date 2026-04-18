import { describe, expect, it } from 'vitest';

import { createPlanningSessionSeed } from '../../src/application/use-cases/create-planning-session-seed.js';

describe('createPlanningSessionSeed', () => {
  it('creates a coherent initial planning session bundle', () => {
    const ids = createIdGenerator();
    const seed = createPlanningSessionSeed({
      clock: { now: () => new Date('2026-04-17T12:00:00.000Z') },
      ids,
      worktreePath: '/repo',
      opencodeSessionId: 'oc-session-1',
      problemStatement: 'Formalize BRHP into a durable OpenCode planning kernel.',
      invariants: ['All graph mutations must be tool-mediated.'],
    });

    expect(seed.session.id).toBe('id-1');
    expect(seed.session.status).toBe('exploring');
    expect(seed.session.opencodeSessionId).toBe('oc-session-1');
    expect(seed.session.activeScopeId).toBe('id-2');
    expect(seed.session.rootNodeId).toBe('id-3');
    expect(seed.session.controls.depthClamp).toBeGreaterThanOrEqual(1);
    expect(seed.session.controls.depthClamp).toBeLessThanOrEqual(5);
    expect(seed.session.policy.invariants).toEqual([
      'All graph mutations must be tool-mediated.',
    ]);
    expect(seed.scopes).toHaveLength(1);
    expect(seed.nodes).toHaveLength(1);
    expect(seed.edges).toHaveLength(0);
    expect(seed.frontier.selections).toHaveLength(1);
    expect(seed.frontier.globalEntropy).toBe(0);
    expect(seed.events.map(event => event.type)).toEqual([
      'session-created',
      'scope-created',
      'node-created',
      'frontier-snapshotted',
    ]);
  });

  it('derives a root title from the first line when no explicit title is provided', () => {
    const seed = createPlanningSessionSeed({
      clock: { now: () => new Date('2026-04-17T12:00:00.000Z') },
      ids: createIdGenerator(),
      worktreePath: '/repo',
      opencodeSessionId: 'oc-session-2',
      problemStatement: ['Design BRHP v1', '', 'with explicit frontier math'].join('\n'),
      temperature: 0.2,
    });

    expect(seed.nodes[0]?.title).toBe('Design BRHP v1');
  });

  it('rejects invalid control inputs before creating session state', () => {
    expect(() =>
      createPlanningSessionSeed({
        clock: { now: () => new Date('2026-04-17T12:00:00.000Z') },
        ids: createIdGenerator(),
        worktreePath: '/repo',
        opencodeSessionId: 'oc-session-3',
        problemStatement: 'x',
        topP: 0,
      })
    ).toThrow('topP must be greater than 0 and less than or equal to 1');

    expect(() =>
      createPlanningSessionSeed({
        clock: { now: () => new Date('2026-04-17T12:00:00.000Z') },
        ids: createIdGenerator(),
        worktreePath: '/repo',
        opencodeSessionId: 'oc-session-4',
        problemStatement: 'x',
        temperatureFloor: 0.8,
        temperatureCeiling: 0.3,
      })
    ).toThrow('temperatureCeiling must be greater than temperatureFloor');

    expect(() =>
      createPlanningSessionSeed({
        clock: { now: () => new Date('2026-04-17T12:00:00.000Z') },
        ids: createIdGenerator(),
        worktreePath: '/repo',
        opencodeSessionId: 'oc-session-5',
        problemStatement: '   ',
      })
    ).toThrow('problemStatement must not be empty');
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
