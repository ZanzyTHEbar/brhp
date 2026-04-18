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
            pendingBlockingClauses: 0,
            converged: false,
            lastFrontierUpdatedAt: '2026-04-17T12:00:00.000Z',
          },
          createdAt: '2026-04-17T12:00:00.000Z',
          updatedAt: '2026-04-17T12:00:00.000Z',
        },
        graph: {
          scopes: [{ id: 'scope-1' }],
          nodes: [{ id: 'node-1' }, { id: 'node-2' }],
          edges: [{ id: 'edge-1' }],
        },
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
    });
  });
});
