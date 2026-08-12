import { describe, expect, it } from 'vitest';

import { completeLeafNode } from '../../src/application/use-cases/complete-leaf-node.js';
import { createPlanningSessionSeed } from '../../src/application/use-cases/create-planning-session-seed.js';
import { decomposePlanningNode } from '../../src/application/use-cases/decompose-planning-node.js';

function createIdGenerator(start = 0) {
  let index = start;

  return {
    nextId() {
      index += 1;
      return `id-${index}`;
    },
  };
}

function seedSession() {
  return createPlanningSessionSeed({
    clock: { now: () => new Date('2026-04-19T10:00:00.000Z') },
    ids: createIdGenerator(),
    worktreePath: '/repo',
    opencodeSessionId: 'chat-1',
    problemStatement: 'Formalize BRHP leaf completion.',
  });
}

describe('completeLeafNode', () => {
  it('completes an active (root) node and transitions its status to leaf', () => {
    const seed = seedSession();
    const rootNode = seed.nodes[0];

    expect(rootNode?.status).toBe('active');

    const patch = completeLeafNode({
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
      nodeId: rootNode!.id,
      completionSummary: 'Root work is done.',
    });

    expect(patch.updatedNode.status).toBe('leaf');
    expect(patch.originalNode.status).toBe('active');
    expect(patch.session.revision).toBe(seed.session.revision + 1);
    expect(patch.events.map(event => event.type)).toEqual(['leaf-completed']);
    expect(patch.events[0]?.payload).toMatchObject({
      nodeId: rootNode!.id,
      completionSummary: 'Root work is done.',
    });
  });

  it('completes a proposed (decomposed child) node and transitions its status to leaf', () => {
    const seed = seedSession();
    const rootNode = seed.nodes[0]!;

    const decomposition = decomposePlanningNode({
      clock: { now: () => new Date('2026-04-19T10:02:00.000Z') },
      ids: createIdGenerator(50),
      state: {
        session: seed.session,
        graph: {
          scopes: seed.scopes,
          nodes: seed.nodes,
          edges: seed.edges,
        },
        frontier: seed.frontier,
      },
      nodeId: rootNode.id,
      children: [
        {
          title: 'Child A',
          problemStatement: 'Do part A.',
          category: 'isolated',
        },
      ],
    });

    const childNode = decomposition.childNodes[0]!;
    expect(childNode.status).toBe('proposed');

    const patch = completeLeafNode({
      clock: { now: () => new Date('2026-04-19T10:10:00.000Z') },
      ids: createIdGenerator(200),
      state: {
        session: decomposition.session,
        graph: {
          scopes: seed.scopes,
          nodes: [decomposition.updatedParentNode, ...decomposition.childNodes],
          edges: decomposition.edges,
        },
        frontier: decomposition.frontier,
      },
      nodeId: childNode.id,
      completionSummary: 'Child A finished.',
    });

    expect(patch.updatedNode.status).toBe('leaf');
    expect(patch.originalNode.status).toBe('proposed');
  });

  it('rejects completing a node that has already been decomposed', () => {
    const seed = seedSession();
    const rootNode = seed.nodes[0]!;

    const decomposition = decomposePlanningNode({
      clock: { now: () => new Date('2026-04-19T10:02:00.000Z') },
      ids: createIdGenerator(50),
      state: {
        session: seed.session,
        graph: {
          scopes: seed.scopes,
          nodes: seed.nodes,
          edges: seed.edges,
        },
        frontier: seed.frontier,
      },
      nodeId: rootNode.id,
      children: [
        {
          title: 'Child A',
          problemStatement: 'Do part A.',
          category: 'isolated',
        },
      ],
    });

    expect(() =>
      completeLeafNode({
        clock: { now: () => new Date('2026-04-19T10:10:00.000Z') },
        ids: createIdGenerator(200),
        state: {
          session: decomposition.session,
          graph: {
            scopes: seed.scopes,
            nodes: [decomposition.updatedParentNode, ...decomposition.childNodes],
            edges: decomposition.edges,
          },
          frontier: decomposition.frontier,
        },
        nodeId: decomposition.updatedParentNode.id,
        completionSummary: 'Should fail.',
      })
    ).toThrowError(/already been decomposed/);
  });

  it('rejects completing a node that has already been completed as a leaf', () => {
    const seed = seedSession();
    const rootNode = seed.nodes[0]!;

    const patch = completeLeafNode({
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
      nodeId: rootNode.id,
      completionSummary: 'Root work is done.',
    });

    expect(() =>
      completeLeafNode({
        clock: { now: () => new Date('2026-04-19T10:06:00.000Z') },
        ids: createIdGenerator(300),
        state: {
          session: patch.session,
          graph: {
            scopes: seed.scopes,
            nodes: [patch.updatedNode],
            edges: seed.edges,
          },
          frontier: seed.frontier,
        },
        nodeId: rootNode.id,
        completionSummary: 'Second attempt.',
      })
    ).toThrowError(/already been completed/);
  });

  it('rejects an unknown nodeId', () => {
    const seed = seedSession();

    expect(() =>
      completeLeafNode({
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
        nodeId: 'missing-node',
        completionSummary: 'Should fail.',
      })
    ).toThrowError(/does not exist/);
  });
});
