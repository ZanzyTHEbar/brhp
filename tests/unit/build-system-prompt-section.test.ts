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
});
