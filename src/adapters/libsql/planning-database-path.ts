import path from 'node:path';

export function resolvePlanningDatabasePath(worktreePath: string): string {
  return path.join(worktreePath, '.opencode', 'brhp', 'brhp.db');
}
