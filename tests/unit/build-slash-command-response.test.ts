import { describe, expect, it } from 'vitest';

import { buildSlashCommandResponse } from '../../src/application/use-cases/build-slash-command-response.js';

describe('buildSlashCommandResponse', () => {
  it('summarizes command identity, directories, and loaded instructions', () => {
    const response = buildSlashCommandResponse({
      directories: {
        global: '/global/brhp/instructions',
        project: '/repo/.opencode/brhp/instructions',
      },
      instructions: [
        {
          id: 'project:local.md',
          title: 'Local guidance',
          body: 'Do the thing.',
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
        skipped: 0,
      },
      skippedFiles: [],
    });

    expect(response).toContain('Command: /brhp');
    expect(response).toContain('Planning session:');
    expect(response).toContain('None active for this OpenCode session');
    expect(response).toContain('Global: /global/brhp/instructions');
    expect(response).toContain('[project] Local guidance (local.md)');
    expect(response).toContain('Skipped files:');
    expect(response).toContain('Totals: 1 loaded');
  });

  it('renders active planning session details and mutation summaries', () => {
    const state = {
      session: {
        id: 'session-1',
        worktreePath: '/repo',
        opencodeSessionId: 'chat-1',
        initialProblem: 'Formalize BRHP',
        status: 'exploring',
        activeScopeId: 'scope-1',
        rootNodeId: 'node-1',
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
          invariants: ['Keep all changes durable'],
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
        nodes: [{ id: 'node-1' }],
        edges: [],
      },
    };
    const response = buildSlashCommandResponse(
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
        activePlanningState: state as never,
        mutation: {
          kind: 'created',
          state: state as never,
        },
      }
    );

    expect(response).toContain('- Active: session-1');
    expect(response).toContain('- Status: exploring');
    expect(response).toContain('- Problem: Formalize BRHP');
    expect(response).toContain('- Graph: 1 scopes, 1 nodes, 0 edges');
    expect(response).toContain('- Created session session-1');
  });
});
