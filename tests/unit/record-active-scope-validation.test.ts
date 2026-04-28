import { describe, expect, it } from 'vitest';

import { createPlanningSessionSeed } from '../../src/application/use-cases/create-planning-session-seed.js';
import { recordActiveScopeValidation } from '../../src/application/use-cases/record-active-scope-validation.js';
import { DEFAULT_CONVERGENCE_THRESHOLDS } from '../../src/domain/planning/brhp-formalism.js';

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
        session: {
          ...seed.session,
          summary: {
            ...seed.session.summary,
            globalEntropy: 0.1,
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

  it('stays validating for a satisfiable single-node session without decomposition evidence', () => {
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
          kind: 'schema',
          blocking: true,
          description: 'The root scope still exists.',
          status: 'passed',
        },
      ],
    });

    expect(patch.validation.satisfiable).toBe(true);
    expect(patch.session.status).toBe('validating');
    expect(patch.session.summary.converged).toBe(false);
  });

  it('newly converges after structural refinement and satisfiable validation', () => {
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
            frontierStability: 1,
          },
        },
        graph: {
          scopes: seed.scopes,
          nodes: [
            {
              ...seed.nodes[0]!,
              status: 'decomposed',
            },
            {
              id: 'node-2',
              sessionId: seed.session.id,
              scopeId: seed.session.activeScopeId,
              parentNodeId: seed.session.rootNodeId,
              title: 'Refined child node',
              problemStatement: 'Demonstrate explicit decomposition evidence.',
              category: 'dependent',
              status: 'proposed',
              depth: 1,
              scores: {
                utility: 1,
                confidence: 0,
                localEntropy: 0,
                validationPressure: 0,
              },
              createdAt: seed.session.createdAt,
              updatedAt: seed.session.updatedAt,
            },
          ],
          edges: [
            {
              id: 'edge-1',
              sessionId: seed.session.id,
              fromNodeId: seed.session.rootNodeId,
              toNodeId: 'node-2',
              kind: 'decomposes-to',
              createdAt: seed.session.createdAt,
            },
          ],
        },
        frontier: {
          ...seed.frontier,
          createdAt: '2026-04-19T10:04:00.000Z',
          selections: [
            {
              nodeId: 'node-2',
              scopeId: seed.session.activeScopeId,
              utility: 1,
              localEntropy: 0,
              validationPressure: 0,
              probability: 1,
              rank: 1,
              depthClamp: seed.frontier.depthClamp,
            },
          ],
        },
      },
      clauses: [
        {
          kind: 'schema',
          blocking: true,
          description: 'The decomposed scope still exists.',
          status: 'passed',
        },
        {
          kind: 'coverage',
          blocking: true,
          description: 'The active scope has complete decomposition coverage.',
          status: 'passed',
        },
      ],
    });

    expect(patch.validation.satisfiable).toBe(true);
    expect(patch.session.status).toBe('converged');
    expect(patch.session.summary.converged).toBe(true);
  });

  it('stays validating after structural refinement when coverage closure is missing', () => {
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
            frontierStability: 1,
          },
        },
        graph: {
          scopes: seed.scopes,
          nodes: [
            {
              ...seed.nodes[0]!,
              status: 'decomposed',
            },
            {
              id: 'node-2',
              sessionId: seed.session.id,
              scopeId: seed.session.activeScopeId,
              parentNodeId: seed.session.rootNodeId,
              title: 'Refined child node',
              problemStatement: 'Demonstrate explicit decomposition evidence.',
              category: 'dependent',
              status: 'proposed',
              depth: 1,
              scores: {
                utility: 1,
                confidence: 0,
                localEntropy: 0,
                validationPressure: 0,
              },
              createdAt: seed.session.createdAt,
              updatedAt: seed.session.updatedAt,
            },
          ],
          edges: [
            {
              id: 'edge-1',
              sessionId: seed.session.id,
              fromNodeId: seed.session.rootNodeId,
              toNodeId: 'node-2',
              kind: 'decomposes-to',
              createdAt: seed.session.createdAt,
            },
          ],
        },
        frontier: {
          ...seed.frontier,
          createdAt: '2026-04-19T10:04:00.000Z',
          selections: [
            {
              nodeId: 'node-2',
              scopeId: seed.session.activeScopeId,
              utility: 1,
              localEntropy: 0,
              validationPressure: 0,
              probability: 1,
              rank: 1,
              depthClamp: seed.frontier.depthClamp,
            },
          ],
        },
      },
      clauses: [
        {
          kind: 'schema',
          blocking: true,
          description: 'The decomposed scope still exists.',
          status: 'passed',
        },
      ],
    });

    expect(patch.validation.satisfiable).toBe(true);
    expect(patch.session.status).toBe('validating');
    expect(patch.session.summary.converged).toBe(false);
  });

  it('stays validating when only an inactive scope has structural refinement', () => {
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
            frontierStability: 1,
          },
        },
        graph: {
          scopes: [...seed.scopes, { ...seed.scopes[0]!, id: 'scope-2', title: 'Inactive scope' }],
          nodes: [
            ...seed.nodes,
            {
              id: 'node-x',
              sessionId: seed.session.id,
              scopeId: 'scope-2',
              title: 'Inactive parent',
              problemStatement: 'This refinement belongs to another scope.',
              category: 'dependent',
              status: 'decomposed',
              depth: 0,
              scores: {
                utility: 0.5,
                confidence: 0,
                localEntropy: 0,
                validationPressure: 0,
              },
              createdAt: seed.session.createdAt,
              updatedAt: seed.session.updatedAt,
            },
            {
              id: 'node-y',
              sessionId: seed.session.id,
              scopeId: 'scope-2',
              parentNodeId: 'node-x',
              title: 'Inactive child',
              problemStatement: 'This should not satisfy the active scope refinement gate.',
              category: 'dependent',
              status: 'proposed',
              depth: 1,
              scores: {
                utility: 1,
                confidence: 0,
                localEntropy: 0,
                validationPressure: 0,
              },
              createdAt: seed.session.createdAt,
              updatedAt: seed.session.updatedAt,
            },
          ],
          edges: [
            {
              id: 'edge-inactive',
              sessionId: seed.session.id,
              fromNodeId: 'node-x',
              toNodeId: 'node-y',
              kind: 'decomposes-to',
              createdAt: seed.session.createdAt,
            },
          ],
        },
        frontier: seed.frontier,
      },
      clauses: [
        {
          kind: 'schema',
          blocking: true,
          description: 'The active scope still exists.',
          status: 'passed',
        },
      ],
    });

    expect(patch.validation.satisfiable).toBe(true);
    expect(patch.session.status).toBe('validating');
    expect(patch.session.summary.converged).toBe(false);
  });

  it('stays validating when validation is satisfiable but entropy exceeds the threshold', () => {
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
            globalEntropy: 0,
          },
        },
        graph: {
          scopes: seed.scopes,
          nodes: seed.nodes.map(node =>
            node.id === seed.session.rootNodeId
              ? {
                  ...node,
                  scores: {
                    ...node.scores,
                    localEntropy: DEFAULT_CONVERGENCE_THRESHOLDS.entropyThreshold + 0.1,
                  },
                }
              : node
          ),
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
    expect(patch.session.status).toBe('validating');
    expect(patch.session.summary.converged).toBe(false);
  });

  it('stays validating when validation is satisfiable but frontier stability is below the threshold', () => {
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
            globalEntropy: DEFAULT_CONVERGENCE_THRESHOLDS.entropyThreshold,
          },
        },
        graph: {
          scopes: seed.scopes,
          nodes: [
            ...seed.nodes,
            {
              id: 'node-2',
              sessionId: seed.session.id,
              scopeId: seed.session.activeScopeId,
              parentNodeId: seed.session.rootNodeId,
              title: 'Alternative frontier branch',
              problemStatement: 'Create instability in the active frontier.',
              category: 'dependent',
              status: 'proposed',
              depth: 1,
              scores: {
                utility: 0.8,
                confidence: 0,
                localEntropy: 0.1,
                validationPressure: 0,
              },
              createdAt: seed.session.createdAt,
              updatedAt: seed.session.updatedAt,
            },
          ],
          edges: seed.edges,
        },
        frontier: {
          ...seed.frontier,
          selections: [],
        },
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
    expect(patch.session.status).toBe('validating');
    expect(patch.session.summary.converged).toBe(false);
    expect(patch.session.summary.frontierStability).toBeLessThan(
      DEFAULT_CONVERGENCE_THRESHOLDS.stabilityThreshold
    );
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

  it('de-converges to validating when the new validation verdict is unsatisfied', () => {
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
          description: 'The root scope no longer satisfies a blocking clause.',
          status: 'failed',
        },
      ],
    });

    expect(patch.validation.satisfiable).toBe(false);
    expect(patch.session.status).toBe('validating');
    expect(patch.session.summary.converged).toBe(false);
  });

  it('rejects validation when the active session is archived', () => {
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
          session: {
            ...seed.session,
            status: 'archived',
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
      })
    ).toThrow('Archived BRHP planning sessions cannot be validated');
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
