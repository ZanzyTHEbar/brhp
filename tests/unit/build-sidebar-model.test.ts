import { describe, expect, it } from 'vitest';

import { buildSidebarModel } from '../../src/application/use-cases/build-sidebar-model.js';
import type { PlanningState } from '../../src/domain/planning/planning-session.js';

describe('buildSidebarModel', () => {
  it('exposes lightweight loaded and skipped instruction diagnostics', () => {
    const model = buildSidebarModel({
      directories: {
        global: '/global/brhp/instructions',
        project: '/repo/.opencode/brhp/instructions',
      },
      instructions: [
        {
          id: 'project:local.md',
          title: 'Local guidance',
          description: 'Prefer small changes.',
          body: 'Body',
          source: 'project',
          absolutePath: '/repo/.opencode/brhp/instructions/local.md',
          relativePath: 'local.md',
          extension: '.md',
          order: 0,
        },
      ],
      counts: {
        global: 0,
        project: 1,
        total: 1,
        skipped: 1,
      },
      skippedFiles: [
        {
          absolutePath: '/repo/.opencode/brhp/instructions/disabled.md',
          relativePath: 'disabled.md',
          source: 'project',
          reason: 'disabled',
        },
      ],
    });

    expect(model).toEqual({
      pluginName: 'brhp',
      status: 'ready',
      slashCommands: ['/brhp'],
      globalDirectory: '/global/brhp/instructions',
      projectDirectory: '/repo/.opencode/brhp/instructions',
      instructionCount: 1,
      skippedCount: 1,
      instructions: [
        {
          title: 'Local guidance',
          source: 'project',
          relativePath: 'local.md',
          description: 'Prefer small changes.',
        },
      ],
      skippedFiles: [
        {
          source: 'project',
          relativePath: 'disabled.md',
          reason: 'disabled',
        },
      ],
      planning: {
        active: false,
      },
    });
  });

  it('includes bounded read-only graph preview details for an active planning state', () => {
    const model = buildSidebarModel(emptyInventory(), createPlanningState());

    expect(model.planning).toMatchObject({
      active: true,
      sessionId: 'session-1',
      status: 'exploring',
      problem: 'Formalize BRHP',
      scopeCount: 1,
      nodeCount: 7,
      edgeCount: 6,
      validation: {
        satisfiable: false,
        blockingFindings: 0,
        pendingBlockingClauses: 1,
        clauseCount: 4,
      },
      frontier: {
        selectionCount: 4,
        topNodeId: 'node-active',
        topNodeTitle: 'Active graph slice',
        topProbability: 0.7,
        maxValidationPressure: 0.8,
        pressuredSelectionCount: 3,
        globalEntropy: 0.8,
        entropyDrift: 0.3,
        frontierStability: 0.5,
      },
      recentActivity: [
        {
          occurredAt: '2026-04-17T12:06:00.000Z',
          label: 'Node decomposed into 1 children',
        },
      ],
    });

    expect(model.planning?.graphPreview).toEqual({
      activeScope: {
        id: 'scope-1',
        title: 'Current graph scope',
        question: 'Which graph details should the sidebar expose?',
        status: 'active',
        depth: 0,
        rootNodeId: 'node-root',
        rootNodeTitle: 'Root planning node',
      },
      focusNodes: [
        {
          id: 'node-active',
          title: 'Active graph slice',
          status: 'active',
          category: 'cross-cutting',
          depth: 1,
          validationPressure: 0.8,
        },
        {
          id: 'node-blocked',
          title: 'Blocked validation branch',
          status: 'blocked',
          category: 'dependent',
          depth: 1,
          validationPressure: 0.7,
        },
        {
          id: 'node-proposed',
          title: 'Proposed follow-up branch',
          status: 'proposed',
          category: 'parallelizable',
          depth: 1,
          validationPressure: 0.2,
        },
        {
          id: 'node-leaf',
          title: 'Leaf publication branch',
          status: 'leaf',
          category: 'isolated',
          depth: 2,
          validationPressure: 0,
        },
        {
          id: 'node-decomposed',
          title: 'Decomposed implementation branch',
          status: 'decomposed',
          category: 'dependent',
          depth: 2,
          validationPressure: 0.1,
        },
      ],
      edges: [
        {
          id: 'edge-1',
          kind: 'decomposes-to',
          fromNodeId: 'node-root',
          fromNodeTitle: 'Root planning node',
          toNodeId: 'node-active',
          toNodeTitle: 'Active graph slice',
        },
        {
          id: 'edge-2',
          kind: 'depends-on',
          fromNodeId: 'node-active',
          fromNodeTitle: 'Active graph slice',
          toNodeId: 'node-blocked',
          toNodeTitle: 'Blocked validation branch',
        },
        {
          id: 'edge-3',
          kind: 'parallelizes-with',
          fromNodeId: 'node-active',
          fromNodeTitle: 'Active graph slice',
          toNodeId: 'node-proposed',
          toNodeTitle: 'Proposed follow-up branch',
        },
        {
          id: 'edge-4',
          kind: 'cross-cuts',
          fromNodeId: 'node-proposed',
          fromNodeTitle: 'Proposed follow-up branch',
          toNodeId: 'node-leaf',
          toNodeTitle: 'Leaf publication branch',
        },
        {
          id: 'edge-5',
          kind: 'blocks',
          fromNodeId: 'node-blocked',
          fromNodeTitle: 'Blocked validation branch',
          toNodeId: 'node-pruned',
          toNodeTitle: 'Pruned old branch',
        },
      ],
      frontierSelections: [
        {
          rank: 1,
          nodeId: 'node-active',
          nodeTitle: 'Active graph slice',
          probability: 0.7,
          validationPressure: 0.8,
        },
        {
          rank: 2,
          nodeId: 'node-blocked',
          nodeTitle: 'Blocked validation branch',
          probability: 0.2,
          validationPressure: 0.7,
        },
        {
          rank: 3,
          nodeId: 'node-proposed',
          nodeTitle: 'Proposed follow-up branch',
          probability: 0.1,
          validationPressure: 0.2,
        },
      ],
      validationClauses: [
        {
          id: 'clause-1',
          kind: 'coverage',
          status: 'pending',
          blocking: true,
          description: 'The active scope must be fully decomposed.',
        },
        {
          id: 'clause-2',
          kind: 'dependency',
          status: 'failed',
          blocking: true,
          description: 'Blocked branch must explain dependency ordering.',
        },
        {
          id: 'clause-3',
          kind: 'structure',
          status: 'passed',
          blocking: false,
          description: 'Graph structure has a root node.',
        },
      ],
    });
  });

  it('falls back to session-level validation counters when the active scope has no validation snapshot', () => {
    const { validation: _validation, ...baseState } = createPlanningState();
    const state: PlanningState = {
      ...baseState,
      session: {
        ...baseState.session,
        id: 'session-2',
        status: 'validating',
        summary: {
          ...baseState.session.summary,
          blockingFindings: 0,
          pendingBlockingClauses: 2,
        },
      },
    };

    const model = buildSidebarModel(emptyInventory(), state);

    expect(model.planning?.validation).toEqual({
      satisfiable: false,
      blockingFindings: 0,
      pendingBlockingClauses: 2,
      clauseCount: 0,
    });
    expect(model.planning?.graphPreview?.validationClauses).toEqual([]);
  });

  it('truncates sidebar graph preview text and omits missing endpoint titles', () => {
    const longText = 'Very long sidebar graph label '.repeat(8);
    const baseState = createPlanningState();
    const state: PlanningState = {
      ...baseState,
      graph: {
        ...baseState.graph,
        scopes: [
          {
            ...baseState.graph.scopes[0]!,
            title: longText,
            question: longText,
            rootNodeId: 'missing-root',
          },
        ],
        nodes: [
          {
            ...baseState.graph.nodes[0]!,
            id: 'node-long',
            title: longText,
          },
        ],
        edges: [
          {
            ...baseState.graph.edges[0]!,
            fromNodeId: 'node-long',
            toNodeId: 'missing-target',
          },
        ],
      },
      frontier: {
        ...baseState.frontier!,
        selections: [
          {
            ...baseState.frontier!.selections[0]!,
            nodeId: 'missing-frontier-node',
          },
        ],
      },
      validation: {
        ...baseState.validation!,
        formula: {
          ...baseState.validation!.formula,
          clauses: [
            {
              ...baseState.validation!.formula.clauses[0]!,
              description: longText,
            },
          ],
        },
      },
    };

    const graphPreview = buildSidebarModel(emptyInventory(), state).planning?.graphPreview;

    expect(graphPreview?.activeScope?.title).toHaveLength(48);
    expect(graphPreview?.activeScope?.title.endsWith('...')).toBe(true);
    expect(graphPreview?.activeScope).not.toHaveProperty('rootNodeTitle');
    expect(graphPreview?.focusNodes[0]?.title).toHaveLength(48);
    expect(graphPreview?.focusNodes[0]?.title.endsWith('...')).toBe(true);
    expect(graphPreview?.edges[0]).toMatchObject({
      fromNodeId: 'node-long',
      toNodeId: 'missing-target',
    });
    expect(graphPreview?.edges[0]).not.toHaveProperty('toNodeTitle');
    expect(graphPreview?.frontierSelections[0]).not.toHaveProperty('nodeTitle');
    expect(graphPreview?.validationClauses[0]?.description).toHaveLength(48);
    expect(graphPreview?.validationClauses[0]?.description.endsWith('...')).toBe(true);
  });
});

function emptyInventory() {
  return {
    directories: {
      global: '/global/brhp/instructions',
      project: '/repo/.opencode/brhp/instructions',
    },
    instructions: [],
    counts: {
      global: 0,
      project: 0,
      total: 0,
      skipped: 0,
    },
    skippedFiles: [],
  };
}

function createPlanningState(overrides: Partial<PlanningState> = {}): PlanningState {
  const state: PlanningState = {
    session: {
      id: 'session-1',
      worktreePath: '/repo',
      opencodeSessionId: 'chat-1',
      initialProblem: 'Formalize BRHP',
      status: 'exploring',
      activeScopeId: 'scope-1',
      rootNodeId: 'node-root',
      revision: 0,
      controls: {
        temperature: 0.3,
        topP: 0.9,
        temperatureFloor: 0.1,
        temperatureCeiling: 1,
        minDepthClamp: 1,
        maxDepthClamp: 5,
        depthClamp: 4,
      },
      policy: {
        policyDocumentIds: [],
        instructionDocumentIds: [],
        invariants: [],
      },
      summary: {
        globalEntropy: 0.8,
        entropyDrift: 0.3,
        frontierStability: 0.5,
        blockingFindings: 0,
        pendingBlockingClauses: 0,
        converged: false,
        lastFrontierUpdatedAt: '2026-04-17T12:00:00.000Z',
      },
      createdAt: '2026-04-17T12:00:00.000Z',
      updatedAt: '2026-04-17T12:00:00.000Z',
    },
    graph: {
      scopes: [
        {
          id: 'scope-1',
          sessionId: 'session-1',
          rootNodeId: 'node-root',
          title: 'Current graph scope',
          question: 'Which graph details should the sidebar expose?',
          depth: 0,
          status: 'active',
          createdAt: '2026-04-17T12:00:00.000Z',
          updatedAt: '2026-04-17T12:00:00.000Z',
        },
      ],
      nodes: [
        createNode('node-root', 'Root planning node', 'proposed', 0, 0.1, 'dependent'),
        createNode('node-active', 'Active graph slice', 'active', 1, 0.8, 'cross-cutting'),
        createNode('node-blocked', 'Blocked validation branch', 'blocked', 1, 0.7, 'dependent'),
        createNode('node-proposed', 'Proposed follow-up branch', 'proposed', 1, 0.2, 'parallelizable'),
        createNode('node-leaf', 'Leaf publication branch', 'leaf', 2, 0, 'isolated'),
        createNode('node-decomposed', 'Decomposed implementation branch', 'decomposed', 2, 0.1, 'dependent'),
        createNode('node-pruned', 'Pruned old branch', 'pruned', 3, 0, 'isolated'),
      ],
      edges: [
        createEdge('edge-1', 'node-root', 'node-active', 'decomposes-to'),
        createEdge('edge-2', 'node-active', 'node-blocked', 'depends-on'),
        createEdge('edge-3', 'node-active', 'node-proposed', 'parallelizes-with'),
        createEdge('edge-4', 'node-proposed', 'node-leaf', 'cross-cuts'),
        createEdge('edge-5', 'node-blocked', 'node-pruned', 'blocks'),
        createEdge('edge-6', 'node-active', 'node-decomposed', 'decomposes-to'),
      ],
    },
    frontier: {
      id: 'frontier-1',
      sessionId: 'session-1',
      scopeId: 'scope-1',
      temperature: 0.3,
      globalEntropy: 0.8,
      depthClamp: 4,
      selections: [
        createSelection('node-active', 1, 0.7, 0.8),
        createSelection('node-blocked', 2, 0.2, 0.7),
        createSelection('node-proposed', 3, 0.1, 0.2),
        createSelection('node-leaf', 4, 0.05, 0),
      ],
      createdAt: '2026-04-17T12:05:00.000Z',
    },
    validation: {
      id: 'validation-1',
      sessionId: 'session-1',
      scopeId: 'scope-1',
      formula: {
        scopeId: 'scope-1',
        clauses: [
          {
            id: 'clause-1',
            kind: 'coverage',
            blocking: true,
            description: 'The active scope must be fully decomposed.',
            status: 'pending',
          },
          {
            id: 'clause-2',
            kind: 'dependency',
            blocking: true,
            description: 'Blocked branch must explain dependency ordering.',
            status: 'failed',
          },
          {
            id: 'clause-3',
            kind: 'structure',
            blocking: false,
            description: 'Graph structure has a root node.',
            status: 'passed',
          },
          {
            id: 'clause-4',
            kind: 'conflict',
            blocking: false,
            description: 'This clause is outside the sidebar preview limit.',
            status: 'skipped',
          },
        ],
      },
      satisfiable: false,
      blockingFindings: 0,
      pendingBlockingClauses: 1,
      createdAt: '2026-04-17T12:05:00.000Z',
    },
    recentEvents: [
      {
        id: 'event-1',
        sessionId: 'session-1',
        type: 'node-decomposed',
        occurredAt: '2026-04-17T12:06:00.000Z',
        payload: {
          childNodeIds: ['node-active'],
          previousStatus: 'active',
          nextStatus: 'decomposed',
        },
      },
    ],
  };

  return {
    ...state,
    ...overrides,
  };
}

function createNode(
  id: string,
  title: string,
  status: PlanningState['graph']['nodes'][number]['status'],
  depth: number,
  validationPressure: number,
  category: PlanningState['graph']['nodes'][number]['category']
): PlanningState['graph']['nodes'][number] {
  return {
    id,
    sessionId: 'session-1',
    scopeId: 'scope-1',
    title,
    problemStatement: title,
    category,
    status,
    depth,
    scores: {
      utility: 0.5,
      confidence: 0.75,
      localEntropy: 0.2,
      validationPressure,
    },
    createdAt: '2026-04-17T12:00:00.000Z',
    updatedAt: '2026-04-17T12:00:00.000Z',
  };
}

function createEdge(
  id: string,
  fromNodeId: string,
  toNodeId: string,
  kind: PlanningState['graph']['edges'][number]['kind']
): PlanningState['graph']['edges'][number] {
  return {
    id,
    sessionId: 'session-1',
    fromNodeId,
    toNodeId,
    kind,
    createdAt: '2026-04-17T12:00:00.000Z',
  };
}

function createSelection(
  nodeId: string,
  rank: number,
  probability: number,
  validationPressure: number
): NonNullable<PlanningState['frontier']>['selections'][number] {
  return {
    nodeId,
    scopeId: 'scope-1',
    utility: 1,
    localEntropy: 0.4,
    validationPressure,
    probability,
    rank,
    depthClamp: 4,
  };
}
