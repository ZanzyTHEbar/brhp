import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { describe, expect, it } from 'vitest';

import { ProcessEnvironmentAdapter } from '../../src/adapters/environment/process-environment.js';
import { NodeFileSystemAdapter } from '../../src/adapters/filesystem/node-file-system.js';
import { FrontmatterInstructionParserAdapter } from '../../src/adapters/instructions/frontmatter-instruction-parser.js';
import { loadInstructionInventory } from '../../src/application/use-cases/load-instruction-inventory.js';

describe('loadInstructionInventory', () => {
  it('loads global and project instructions with project precedence ordering', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'brhp-load-'));
    const globalDirectory = path.join(tempRoot, 'config', 'brhp', 'instructions');
    const projectDirectory = path.join(tempRoot, 'project');
    const projectInstructionDirectory = path.join(
      projectDirectory,
      '.opencode',
      'brhp',
      'instructions'
    );

    await mkdir(globalDirectory, { recursive: true });
    await mkdir(projectInstructionDirectory, { recursive: true });

    await writeFile(
      path.join(globalDirectory, 'global.md'),
      ['---', 'title: Global baseline', 'order: 10', '---', '', '# Global', '', 'Global guidance.'].join('\n')
    );
    await writeFile(
      path.join(projectInstructionDirectory, 'project.mdc'),
      ['---', 'title: Project override', 'order: 0', '---', '', 'Project guidance.'].join('\n')
    );
    await writeFile(
      path.join(projectInstructionDirectory, 'disabled.md'),
      ['---', 'enabled: false', '---', '', 'Should not load.'].join('\n')
    );

    const originalConfigDirectory = process.env.OPENCODE_CONFIG_DIR;
    process.env.OPENCODE_CONFIG_DIR = path.join(tempRoot, 'config');

    try {
      const inventory = await loadInstructionInventory({
        fileSystem: new NodeFileSystemAdapter(),
        environment: new ProcessEnvironmentAdapter(),
        parser: new FrontmatterInstructionParserAdapter(),
        projectDirectory,
      });

      expect(inventory.instructions).toHaveLength(2);
      expect(inventory.instructions.map(instruction => instruction.title)).toEqual([
        'Global baseline',
        'Project override',
      ]);
      expect(inventory.counts).toEqual({
        global: 1,
        project: 1,
        total: 2,
        skipped: 1,
      });
      expect(inventory.skippedFiles).toEqual([
        {
          absolutePath: path.join(projectInstructionDirectory, 'disabled.md'),
          relativePath: 'disabled.md',
          source: 'project',
          reason: 'disabled',
        },
      ]);
    } finally {
      if (originalConfigDirectory === undefined) {
        delete process.env.OPENCODE_CONFIG_DIR;
      } else {
        process.env.OPENCODE_CONFIG_DIR = originalConfigDirectory;
      }

      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
