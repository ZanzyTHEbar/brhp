import { describe, expect, it } from 'vitest';

import { createPlannerRuntimeOwner } from '../../src/composition/create-planner-runtime-owner.js';

describe('createPlannerRuntimeOwner', () => {
  it('creates the runtime once for concurrent callers and closes once on dispose', async () => {
    const events: string[] = [];
    let factoryCalls = 0;
    let closeCalls = 0;
    const runtime = { marker: 'runtime' };
    const owner = createPlannerRuntimeOwner({
      async createHandle() {
        factoryCalls += 1;
        events.push('open');
        return {
          runtime: runtime as never,
          close() {
            closeCalls += 1;
            events.push('close');
          },
        };
      },
    });

    const [left, right] = await Promise.all([owner.getRuntime(), owner.getRuntime()]);

    expect(left).toBe(runtime);
    expect(right).toBe(runtime);
    expect(factoryCalls).toBe(1);

    await owner.dispose();
    await owner.dispose();

    expect(closeCalls).toBe(1);
    expect(events).toEqual(['open', 'close']);
  });

  it('resets failed initialization so the next caller retries successfully', async () => {
    let factoryCalls = 0;
    const runtime = { marker: 'runtime' };
    const owner = createPlannerRuntimeOwner({
      async createHandle() {
        factoryCalls += 1;
        if (factoryCalls === 1) {
          throw new Error('open failed');
        }
        return {
          runtime: runtime as never,
          close() {},
        };
      },
    });

    await expect(owner.getRuntime()).rejects.toThrow('open failed');
    await expect(owner.getRuntime()).resolves.toBe(runtime);
    expect(factoryCalls).toBe(2);
  });

  it('disposes a runtime that finishes opening after dispose was requested', async () => {
    let closeCalls = 0;
    let resolveHandle!: (value: { runtime: never; close(): void }) => void;
    const runtime = { marker: 'runtime' };
    const owner = createPlannerRuntimeOwner({
      createHandle() {
        return new Promise(resolve => {
          resolveHandle = resolve;
        });
      },
    });

    const pendingRuntime = owner.getRuntime();
    const pendingDispose = owner.dispose();

    resolveHandle({
      runtime: runtime as never,
      close() {
        closeCalls += 1;
      },
    });

    await expect(pendingRuntime).rejects.toThrow('disposed during initialization');
    await pendingDispose;
    expect(closeCalls).toBe(1);
    await expect(owner.getRuntime()).rejects.toThrow('disposed');
  });

  it('marks the owner disposed even if close throws for an open runtime', async () => {
    const owner = createPlannerRuntimeOwner({
      async createHandle() {
        return {
          runtime: { marker: 'runtime' } as never,
          close() {
            throw new Error('close failed');
          },
        };
      },
    });

    await owner.getRuntime();
    await expect(owner.dispose()).rejects.toThrow('close failed');
    await expect(owner.getRuntime()).rejects.toThrow('disposed');
  });

  it('marks the owner disposed even if close throws after dispose during opening', async () => {
    let resolveHandle!: (value: { runtime: never; close(): void }) => void;
    const owner = createPlannerRuntimeOwner({
      createHandle() {
        return new Promise(resolve => {
          resolveHandle = resolve;
        });
      },
    });

    const pendingRuntime = owner.getRuntime();
    const pendingDispose = owner.dispose();

    resolveHandle({
      runtime: { marker: 'runtime' } as never,
      close() {
        throw new Error('close failed during opening');
      },
    });

    await expect(pendingRuntime).rejects.toThrow('disposed during initialization');
    await expect(pendingDispose).rejects.toThrow('close failed during opening');
    await expect(owner.getRuntime()).rejects.toThrow('disposed');
  });
});
