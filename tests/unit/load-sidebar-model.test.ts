import { describe, expect, it } from 'vitest';

import { loadSidebarModel } from '../../src/application/use-cases/load-sidebar-model.js';

const baseInventory = {
  directories: {
    global: '/global',
    project: '/project/.opencode/brhp/instructions',
  },
  instructions: [],
  skippedFiles: [],
  counts: {
    global: 0,
    project: 0,
    total: 0,
    skipped: 0,
  },
} as const;

describe('loadSidebarModel', () => {
  it('returns an instruction failure when inventory loading fails', async () => {
    await expect(
      loadSidebarModel({
        loadInventory: async () => {
          throw new Error('inventory failed');
        },
        loadPlanningState: async () => {
          throw new Error('planning should not run');
        },
      })
    ).resolves.toEqual({
      ok: false,
      failure: {
        kind: 'instructions',
        message: 'Unable to load BRHP instructions',
      },
    });
  });

  it('returns a planning failure when runtime loading fails after inventory succeeds', async () => {
    await expect(
      loadSidebarModel({
        loadInventory: async () => baseInventory,
        loadPlanningState: async () => {
          throw new Error('planning failed');
        },
      })
    ).resolves.toEqual({
      ok: false,
      failure: {
        kind: 'planner-runtime',
        message: 'Unable to load BRHP planner runtime',
      },
    });
  });

  it('returns a built sidebar model on the happy path', async () => {
    const result = await loadSidebarModel({
      loadInventory: async () => baseInventory,
      loadPlanningState: async () => null,
    });

    expect(result).toEqual({
      ok: true,
      model: {
        pluginName: 'brhp',
        status: 'empty',
        slashCommands: ['/brhp'],
        globalDirectory: '/global',
        projectDirectory: '/project/.opencode/brhp/instructions',
        instructionCount: 0,
        skippedCount: 0,
        instructions: [],
        skippedFiles: [],
        planning: {
          active: false,
        },
      },
    });
  });
});
