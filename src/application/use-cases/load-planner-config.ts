import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

import { plannerConfigSchema, type PlannerConfig } from '../../domain/planning/planner-config.js';

const CONFIG_FILENAME = 'config.yaml';

export async function loadPlannerConfig(projectDirectory: string): Promise<PlannerConfig> {
  const configPath = path.join(projectDirectory, '.opencode', 'brhp', CONFIG_FILENAME);
  let raw: string;

  try {
    raw = await fs.readFile(configPath, 'utf-8');
  } catch {
    return {};
  }

  if (raw.trim().length === 0) {
    return {};
  }

  const parsed = parseYaml(raw);

  if (parsed === null || parsed === undefined) {
    return {};
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  const result = plannerConfigSchema.safeParse(parsed);

  if (!result.success) {
    const messages = result.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid planner configuration in ${configPath}: ${messages}`);
  }

  return result.data;
}
