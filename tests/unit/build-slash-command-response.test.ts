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
    expect(response).toContain('Global: /global/brhp/instructions');
    expect(response).toContain('[project] Local guidance (local.md)');
    expect(response).toContain('Skipped files:');
    expect(response).toContain('Totals: 1 loaded');
  });
});
