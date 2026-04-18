import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { resolveRuntimeAssetPath } from '../../src/adapters/libsql/runtime-asset-path.js';

describe('resolveRuntimeAssetPath', () => {
  it('finds package-root assets from source-like module paths', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'brhp-runtime-asset-source-'));

    try {
      const sourceModulePath = path.join(root, 'src', 'adapters', 'libsql', 'module.js');
      const assetPath = path.join(root, 'db', 'queries', 'planner.sql');

      await mkdir(path.dirname(sourceModulePath), { recursive: true });
      await mkdir(path.dirname(assetPath), { recursive: true });
      await writeFile(sourceModulePath, '// source module');
      await writeFile(assetPath, '-- planner sql');

      await expect(
        resolveRuntimeAssetPath(pathToFileURL(sourceModulePath).href, 'db', 'queries', 'planner.sql')
      ).resolves.toBe(assetPath);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('finds package-root assets from built dist module paths', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'brhp-runtime-asset-dist-'));

    try {
      const builtModulePath = path.join(root, 'dist', 'src', 'adapters', 'libsql', 'module.js');
      const assetPath = path.join(root, 'db', 'migrations', '0001_planning_kernel.sql');

      await mkdir(path.dirname(builtModulePath), { recursive: true });
      await mkdir(path.dirname(assetPath), { recursive: true });
      await writeFile(builtModulePath, '// built module');
      await writeFile(assetPath, '-- migration sql');

      await expect(
        resolveRuntimeAssetPath(
          pathToFileURL(builtModulePath).href,
          'db',
          'migrations',
          '0001_planning_kernel.sql'
        )
      ).resolves.toBe(assetPath);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
