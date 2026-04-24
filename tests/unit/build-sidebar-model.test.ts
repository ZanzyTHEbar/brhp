import { describe, expect, it } from 'vitest';

import { buildSidebarModel } from '../../src/application/use-cases/build-sidebar-model.js';

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

  it('includes an active planning summary when a planning state is present', () => {
    const model = buildSidebarModel(
      {
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
      },
      {
        session: {
          id: 'session-1',
          worktreePath: '/repo',
          opencodeSessionId: 'chat-1',
          initialProblem: 'Formalize BRHP',
          status: 'exploring',
          activeScopeId: 'scope-1',
          rootNodeId: 'node-1',
          revision: 0,
          controls: {},
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
          scopes: [{ id: 'scope-1' }],
          nodes: [
            { id: 'node-1', title: 'Formalize BRHP root' },
            { id: 'node-2', title: 'Expand scope coverage' },
          ],
          edges: [{ id: 'edge-1' }],
        },
        frontier: {
          id: 'frontier-1',
          sessionId: 'session-1',
          scopeId: 'scope-1',
          temperature: 0.3,
          globalEntropy: 0.8,
          depthClamp: 4,
          selections: [
            {
              nodeId: 'node-2',
              scopeId: 'scope-1',
              utility: 1,
              localEntropy: 0.4,
              validationPressure: 0.5,
              probability: 0.7,
              rank: 1,
              depthClamp: 4,
            },
            {
              nodeId: 'node-1',
              scopeId: 'scope-1',
              utility: 0.5,
              localEntropy: 0.2,
              validationPressure: 0,
              probability: 0.3,
              rank: 2,
              depthClamp: 4,
            },
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
              childNodeIds: ['node-2'],
              previousStatus: 'active',
              nextStatus: 'decomposed',
            },
          },
        ],
      } as never
    );

    expect(model.planning).toEqual({
      active: true,
      sessionId: 'session-1',
      status: 'exploring',
      problem: 'Formalize BRHP',
      scopeCount: 1,
      nodeCount: 2,
      edgeCount: 1,
        validation: {
          satisfiable: false,
          blockingFindings: 0,
          pendingBlockingClauses: 1,
          clauseCount: 1,
        },
        frontier: {
          selectionCount: 2,
          topNodeId: 'node-2',
          topNodeTitle: 'Expand scope coverage',
          topProbability: 0.7,
          maxValidationPressure: 0.5,
          pressuredSelectionCount: 1,
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
  });

  it('falls back to session-level validation counters when the active scope has no validation snapshot', () => {
    const model = buildSidebarModel(
      {
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
      },
      {
        session: {
          id: 'session-2',
          worktreePath: '/repo',
          opencodeSessionId: 'chat-2',
          initialProblem: 'Validate BRHP',
          status: 'validating',
          activeScopeId: 'scope-2',
          rootNodeId: 'node-1',
          revision: 1,
          controls: {},
          policy: {
            policyDocumentIds: [],
            instructionDocumentIds: [],
            invariants: [],
          },
          summary: {
            globalEntropy: 0,
            entropyDrift: 0,
            frontierStability: 1,
            blockingFindings: 0,
            pendingBlockingClauses: 2,
            converged: false,
            lastFrontierUpdatedAt: '2026-04-17T12:00:00.000Z',
          },
          createdAt: '2026-04-17T12:00:00.000Z',
          updatedAt: '2026-04-17T12:00:00.000Z',
        },
        graph: {
          scopes: [{ id: 'scope-2' }],
          nodes: [{ id: 'node-1' }],
          edges: [],
        },
      } as never
    );

    expect(model.planning?.validation).toEqual({
      satisfiable: false,
      blockingFindings: 0,
      pendingBlockingClauses: 2,
      clauseCount: 0,
    });
  });
});
