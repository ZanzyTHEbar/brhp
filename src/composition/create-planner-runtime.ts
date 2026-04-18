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
  };
}

interface PlannerRuntimeHandle {
  readonly runtime: ReturnType<typeof createPlannerRuntime>;
  close(): void;
}
