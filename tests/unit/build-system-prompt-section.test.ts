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
          controls: {},
          policy: {
            policyDocumentIds: [],
            instructionDocumentIds: [],
            invariants: ['Keep changes durable'],
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
      } as never
    );

    expect(section).toContain('# Active BRHP Planning Session');
    expect(section).toContain(
      'This OpenCode chat currently has an active BRHP planning session persisted to the local planner database.'
    );
    expect(section).toContain('Session ID: session-1');
    expect(section).toContain('Status: exploring');
    expect(section).toContain('Problem: Formalize BRHP');
    expect(section).toContain('Invariants:');
    expect(section).toContain('- Keep changes durable');
  });
});
