import { describe, expect, it } from 'vitest';

import { buildSystemPromptSection } from '../../src/application/use-cases/build-system-prompt-section.js';

describe('buildSystemPromptSection', () => {
  it('renders a deterministic prompt section for loaded instructions', () => {
    const section = buildSystemPromptSection({
      directories: {
        global: '/global',
        project: '/project/.opencode/brhp/instructions',
      },
      instructions: [
        {
          id: 'global:baseline.md',
          title: 'Baseline',
          body: 'Use concise, explicit reasoning.',
          source: 'global',
          absolutePath: '/global/baseline.md',
          relativePath: 'baseline.md',
          extension: '.md',
          order: 0,
        },
        {
          id: 'project:feature.mdc',
          title: 'Feature work',
          body: 'Prefer small, reversible changes.',
          source: 'project',
          absolutePath: '/project/.opencode/brhp/instructions/feature.mdc',
          relativePath: 'feature.mdc',
          extension: '.mdc',
          order: 0,
        },
      ],
      counts: {
        global: 1,
        project: 1,
        total: 2,
        skipped: 0,
      },
      skippedFiles: [],
    });

    expect(section).toContain('# BRHP Instructions');
    expect(section).toContain('## Global: Baseline');
    expect(section).toContain('## Project: Feature work');
    expect(section).toContain('Prefer small, reversible changes.');
  });

  it('appends a compact active planning section when a session exists', () => {
    const section = buildSystemPromptSection(
      {
        directories: {
          global: '/global',
          project: '/project/.opencode/brhp/instructions',
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
            invariants: ['Keep changes durable'],
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
          nodes: [{ id: 'node-1', title: 'Expand scope coverage' }],
          edges: [],
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
              nodeId: 'node-1',
              scopeId: 'scope-1',
              utility: 1,
              localEntropy: 0.5,
              validationPressure: 0.5,
              probability: 0.7,
              rank: 1,
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
      } as never
    );

    expect(section).toContain('# Active BRHP Planning Session');
    expect(section).toContain(
      'This OpenCode chat currently has an active BRHP planning session persisted to the local planner database.'
    );
    expect(section).toContain('Session ID: session-1');
    expect(section).toContain('Status: exploring');
    expect(section).toContain('Problem: Formalize BRHP');
    expect(section).toContain('brhp_get_active_plan');
    expect(section).toContain('brhp_decompose_node');
    expect(section).toContain('brhp_validate_active_scope');
    expect(section).toContain('First call brhp_get_active_plan');
    expect(section).toContain('Latest validation: unsatisfied (0 blocking, 1 pending, 1 clauses)');
    expect(section).toContain('Current frontier: 1 selections, top Expand scope coverage (p=0.700)');
    expect(section).toContain('Current validation pressure: max 0.500, 1/1 selections pressured.');
    expect(section).toContain('Invariants:');
    expect(section).toContain('- Keep changes durable');
  });
});
