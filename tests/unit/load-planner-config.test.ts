import path from 'node:path';
import os from 'node:os';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { loadPlannerConfig } from '../../src/application/use-cases/load-planner-config.js';

describe('loadPlannerConfig', () => {
  it('returns an empty config when the file does not exist', async () => {
    const projectDirectory = await mkdtemp(path.join(os.tmpdir(), 'brhp-config-missing-'));

    try {
      const config = await loadPlannerConfig(projectDirectory);

      expect(config.temperature).toBeUndefined();
      expect(config.maxDepth).toBeUndefined();
    } finally {
      await rm(projectDirectory, { recursive: true, force: true });
    }
  });

  it('returns an empty config when the file is empty', async () => {
    const projectDirectory = await mkdtemp(path.join(os.tmpdir(), 'brhp-config-empty-'));

    try {
      const configDir = path.join(projectDirectory, '.opencode', 'brhp');
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, 'config.yaml'), '');

      const config = await loadPlannerConfig(projectDirectory);

      expect(config.temperature).toBeUndefined();
      expect(config.maxDepth).toBeUndefined();
    } finally {
      await rm(projectDirectory, { recursive: true, force: true });
    }
  });

  it('returns a parsed config for a valid YAML file', async () => {
    const projectDirectory = await mkdtemp(path.join(os.tmpdir(), 'brhp-config-valid-'));

    try {
      const configDir = path.join(projectDirectory, '.opencode', 'brhp');
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, 'config.yaml'),
        'temperature: 0.6\nmaxDepth: 4\n'
      );

      const config = await loadPlannerConfig(projectDirectory);

      expect(config.temperature).toBe(0.6);
      expect(config.maxDepth).toBe(4);
    } finally {
      await rm(projectDirectory, { recursive: true, force: true });
    }
  });

  it('returns a parsed config with temperature only', async () => {
    const projectDirectory = await mkdtemp(path.join(os.tmpdir(), 'brhp-config-temp-'));

    try {
      const configDir = path.join(projectDirectory, '.opencode', 'brhp');
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, 'config.yaml'), 'temperature: 0.33\n');

      const config = await loadPlannerConfig(projectDirectory);

      expect(config.temperature).toBe(0.33);
      expect(config.maxDepth).toBeUndefined();
    } finally {
      await rm(projectDirectory, { recursive: true, force: true });
    }
  });

  it('throws when the YAML contains invalid config values', async () => {
    const projectDirectory = await mkdtemp(path.join(os.tmpdir(), 'brhp-config-invalid-'));

    try {
      const configDir = path.join(projectDirectory, '.opencode', 'brhp');
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, 'config.yaml'), 'temperature: 2\nmaxDepth: 0\n');

      await expect(loadPlannerConfig(projectDirectory)).rejects.toThrow('Invalid planner configuration');
    } finally {
      await rm(projectDirectory, { recursive: true, force: true });
    }
  });
});
