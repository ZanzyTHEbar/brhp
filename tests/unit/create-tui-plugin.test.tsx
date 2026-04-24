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

  it('shows a planner-state warning toast when runtime disposal fails on TUI shutdown', async () => {
    const toasts: Array<{ variant: string; message: string }> = [];
    let disposeHandler: (() => void) | undefined;
    const plugin = createTuiPlugin({
      createOwner: () => ({
        async getRuntime() {
          return {
            async getActive() {
              return null;
            },
          } as never;
        },
        async dispose() {
          throw new Error('close failed');
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
          return () => {};
        },
      },
      command: {
        register() {
          return () => {};
        },
      },
      lifecycle: {
        onDispose(handler: () => void) {
          disposeHandler = handler;
        },
      },
      ui: {
        toast(toast: { variant: string; message: string }) {
          toasts.push(toast);
        },
      },
    } as never;

    await plugin(api, undefined, { id: 'brhp' } as never);
    disposeHandler?.();
    await Promise.resolve();

    expect(toasts).toContainEqual({
      variant: 'warning',
      message: 'BRHP planner runtime failed to close cleanly',
    });
  });

  it('registers sidebar lazily without opening planner runtime during startup', async () => {
    const plugin = createTuiPlugin({
      createOwner: () => ({
        async getRuntime() {
          throw new Error('planner runtime should not be opened');
        },
        async dispose() {},
      }),
    });
    let rendered: unknown;
    const api = {
      state: {
        path: {
          worktree: '/',
          directory: '/tmp/does-not-exist',
        },
      },
      slots: {
        register(config: { slots: { sidebar_content: unknown } }) {
          rendered = config.slots.sidebar_content;
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

    expect(rendered).toBeTypeOf('function');
  });
});
