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
    });
  });
});
