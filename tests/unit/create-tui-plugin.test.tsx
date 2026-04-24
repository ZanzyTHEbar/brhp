/** @jsxImportSource @opentui/solid */
import { describe, expect, it } from 'vitest';

import { createTuiPlugin } from '../../src/composition/create-tui-plugin.js';

describe('createTuiPlugin', () => {
  it('closes planner handle and unregisters registrations on dispose', async () => {
    const events: string[] = [];
    const plugin = createTuiPlugin({
      createOwner: () => ({
        async getRuntime() {
          events.push('getRuntime');
          return {
            async getActive() {
              return null;
            },
          } as never;
        },
        async dispose() {
          events.push('disposeRuntime');
        },
      }),
    });
    let disposeHandler: (() => void) | undefined;
    const api = {
      state: {
        path: {
          worktree: '/repo',
          directory: '/repo',
        },
      },
      slots: {
        register() {
          events.push('registerSlots');
          return () => {
            events.push('unregisterSlots');
          };
        },
      },
      command: {
        register() {
          events.push('registerCommand');
          return () => {
            events.push('unregisterCommand');
          };
        },
      },
      lifecycle: {
        onDispose(handler: () => void) {
          disposeHandler = handler;
        },
      },
      ui: {
        toast() {},
      },
    } as never;

    await plugin(api, undefined, { id: 'brhp' } as never);
    expect(disposeHandler).toBeTypeOf('function');

    disposeHandler?.();
    await Promise.resolve();

    expect(events).toEqual([
      'registerSlots',
      'registerCommand',
      'disposeRuntime',
      'unregisterCommand',
      'unregisterSlots',
    ]);
  });

  it('disposes planner runtime if slot registration fails after owner creation', async () => {
    const events: string[] = [];
    const plugin = createTuiPlugin({
      createOwner: () => ({
        async getRuntime() {
          events.push('getRuntime');
          return {
            async getActive() {
              return null;
            },
          } as never;
        },
        async dispose() {
          events.push('disposeRuntime');
        },
      }),
    });
    const api = {
      state: {
        path: {
          worktree: '/repo',
          directory: '/repo',
        },
      },
      slots: {
        register() {
          throw new Error('slot registration failed');
        },
      },
      command: {
        register() {
          events.push('registerCommand');
          return () => {
            events.push('unregisterCommand');
          };
        },
      },
      lifecycle: {
        onDispose() {},
      },
      ui: {
        toast() {},
      },
    } as never;

    await expect(plugin(api, undefined, { id: 'brhp' } as never)).rejects.toThrow(
      'slot registration failed'
    );
    expect(events).toEqual(['disposeRuntime']);
  });

  it('unregisters slots and disposes planner runtime if command registration fails', async () => {
    const events: string[] = [];
    const plugin = createTuiPlugin({
      createOwner: () => ({
        async getRuntime() {
          events.push('getRuntime');
          return {
            async getActive() {
              return null;
            },
          } as never;
        },
        async dispose() {
          events.push('disposeRuntime');
        },
      }),
    });
    const api = {
      state: {
        path: {
          worktree: '/repo',
          directory: '/repo',
        },
      },
      slots: {
        register() {
          events.push('registerSlots');
          return () => {
            events.push('unregisterSlots');
          };
        },
      },
      command: {
        register() {
          throw new Error('command registration failed');
        },
      },
      lifecycle: {
        onDispose() {},
      },
      ui: {
        toast() {},
      },
    } as never;

    await expect(plugin(api, undefined, { id: 'brhp' } as never)).rejects.toThrow(
      'command registration failed'
    );
    expect(events).toEqual(['registerSlots', 'unregisterSlots', 'disposeRuntime']);
  });

  it('resolves a root-like TUI worktree to the concrete directory before creating the owner', async () => {
    let observedPath = '';
    const plugin = createTuiPlugin({
      createOwner: worktreePath => {
        observedPath = worktreePath;
        return {
          async getRuntime() {
            return {
              async getActive() {
                return null;
              },
            } as never;
          },
          async dispose() {},
        };
      },
    });
    const api = {
      state: {
        path: {
          worktree: '/',
          directory: '/tmp/brhp-integration-project',
        },
      },
      slots: {
        register() {
          return () => {};
        },
      },
      command: {
        register() {
          return () => {};
        },
      },
      lifecycle: {
        onDispose() {},
      },
      ui: {
        toast() {},
      },
    } as never;

    await plugin(api, undefined, { id: 'brhp' } as never);

    expect(observedPath).toBe('/tmp/brhp-integration-project');
  });
});
