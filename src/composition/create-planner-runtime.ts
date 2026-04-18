import { randomUUID } from 'node:crypto';

import { LibsqlPlanningSessionStore } from '../adapters/libsql/libsql-planning-session-store.js';
import { openPlanningDatabase } from '../adapters/libsql/planning-database.js';
import { createPlannerRuntime } from '../application/services/planner-runtime.js';

class SystemClock {
  now(): Date {
    return new Date();
  }
}

class UuidIdGenerator {
  nextId(): string {
    return randomUUID();
  }
}

export interface PlannerRuntimeHandle {
  readonly runtime: ReturnType<typeof createPlannerRuntime>;
  close(): void;
}

export async function createPlannerRuntimeForWorktree(worktreePath: string) {
  const database = await openPlanningDatabase({ worktreePath });
  const store = new LibsqlPlanningSessionStore(database.client);
  const runtime = createPlannerRuntime({
    clock: new SystemClock(),
    ids: new UuidIdGenerator(),
    store,
  });

  return {
    runtime,
    close() {
      database.close();
    },
  } satisfies PlannerRuntimeHandle;
}

export async function withPlannerRuntimeForWorktree<Result>(
  worktreePath: string,
  execute: (runtime: ReturnType<typeof createPlannerRuntime>) => Promise<Result>
): Promise<Result> {
  const handle = await createPlannerRuntimeForWorktree(worktreePath);

  try {
    return await execute(handle.runtime);
  } finally {
    handle.close();
  }
}
