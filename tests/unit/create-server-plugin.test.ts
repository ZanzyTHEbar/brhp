import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import type { PluginInput } from '@opencode-ai/plugin';

import {
  createServerPluginHooks,
  createServerPluginHooksWithRuntimeAccess,
} from '../../src/composition/create-server-plugin.js';
import type { PlannerRuntime } from '../../src/application/services/planner-runtime.js';

describe('createServerPluginHooks', () => {
  it('registers the /brhp command in config', async () => {
    const hooks = await createServerPluginHooks(createPluginInput('/repo'));
    const config: {
      command: Record<string, { template: string; description: string }>;
    } = { command: { existing: { template: 'x', description: 'y' } } };

    await hooks.config?.(config as never);

    expect(config.command.existing).toEqual({ template: 'x', description: 'y' });
    expect(config.command.brhp).toEqual({
      template: '',
      description: 'Inspect or manage the active BRHP planning session for this OpenCode chat.',
    });
    expect(Object.keys(hooks.tool ?? {})).toEqual([
      'brhp_get_active_plan',
      'brhp_decompose_node',
      'brhp_validate_active_scope',
    ]);
  });

  it('leaves unrelated commands unchanged', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'brhp-server-noop-'));

    try {
      const hooks = await createServerPluginHooks(createPluginInput(tempRoot));
      const output = {
        parts: [{ type: 'text', text: 'keep me' }],
      };

      await hooks['command.execute.before']?.(
        {
          command: 'other',
          sessionID: 'session-1',
          arguments: '',
        },
        output as never
      );

      expect(output.parts).toEqual([{ type: 'text', text: 'keep me' }]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('replaces slash command output with instruction inventory details', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'brhp-server-command-'));
    const configRoot = path.join(tempRoot, 'config');
    const globalDirectory = path.join(configRoot, 'brhp', 'instructions');
    const projectDirectory = path.join(tempRoot, 'project');
    const projectInstructions = path.join(projectDirectory, '.opencode', 'brhp', 'instructions');

    await mkdir(globalDirectory, { recursive: true });
    await mkdir(projectInstructions, { recursive: true });
    await writeFile(path.join(globalDirectory, 'global.md'), '# Global\n\nGlobal body.');
    await writeFile(
      path.join(projectInstructions, 'disabled.md'),
      ['---', 'enabled: false', '---', '', 'Hidden text.'].join('\n')
    );

    const originalConfigDirectory = process.env.OPENCODE_CONFIG_DIR;
    process.env.OPENCODE_CONFIG_DIR = configRoot;

    try {
      const hooks = await createServerPluginHooks(createPluginInput(projectDirectory));
      const output = {
        parts: [{ type: 'text', text: 'replace me' }],
      };

      await hooks['command.execute.before']?.(
        {
          command: 'brhp',
          sessionID: 'session-1',
          arguments: '',
        },
        output as never
      );

      expect(output.parts).toHaveLength(1);
      expect(output.parts[0]).toMatchObject({ type: 'text' });
      expect(output.parts[0]?.text).toContain('# BRHP Plugin');
      expect(output.parts[0]?.text).toContain('[global] Global (global.md)');
      expect(output.parts[0]?.text).toContain('[project] disabled.md (disabled)');
      expect(output.parts[0]?.text).toContain('Totals: 1 loaded (1 global, 0 project, 1 skipped)');
    } finally {
      if (originalConfigDirectory === undefined) {
        delete process.env.OPENCODE_CONFIG_DIR;
      } else {
        process.env.OPENCODE_CONFIG_DIR = originalConfigDirectory;
      }

      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('renders status diagnostics when instruction loading fails', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'brhp-server-instruction-diagnostic-'));
    const projectDirectory = path.join(tempRoot, 'project');
    const projectBrhpDirectory = path.join(projectDirectory, '.opencode', 'brhp');
    let runtimeCalls = 0;

    await mkdir(projectBrhpDirectory, { recursive: true });
    await writeFile(path.join(projectBrhpDirectory, 'instructions'), 'not a directory');

    try {
      const hooks = await createServerPluginHooksWithRuntimeAccess(createPluginInput(projectDirectory), {
        async withRuntime(_sessionID, _worktreePath, execute) {
          runtimeCalls += 1;
          return execute({
            async getActive() {
              return null;
            },
            async getActiveSessionHistory() {
              return {
                active: false as const,
                events: [] as const,
              };
            },
            async create() {
              throw new Error('not used');
            },
            async resume() {
              throw new Error('not used');
            },
            async decomposeNode() {
              throw new Error('not used');
            },
            async recordValidation() {
              throw new Error('not used');
            },
          } as never);
        },
      });
      const output = {
        parts: [{ type: 'text', text: 'replace me' }],
      };

      await hooks['command.execute.before']?.(
        {
          command: 'brhp',
          sessionID: 'chat-instruction-diagnostic',
          arguments: '',
        },
        output as never
      );

      const text = String(output.parts[0]?.text ?? '');
      expect(text).toContain('Runtime diagnostics:');
      expect(text).toContain('- Instructions: Unable to load BRHP instructions');
      expect(text).toContain('Loaded instructions:\n- Unavailable: Unable to load BRHP instructions');
      expect(text).toContain('Totals: unavailable while BRHP instructions could not be loaded');
      expect(text).toContain('- None active for this OpenCode session');
      expect(runtimeCalls).toBe(1);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('renders all status diagnostics when instruction and runtime loading fail', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'brhp-server-all-diagnostics-'));
    const projectDirectory = path.join(tempRoot, 'project');
    const projectBrhpDirectory = path.join(projectDirectory, '.opencode', 'brhp');

    await mkdir(projectBrhpDirectory, { recursive: true });
    await writeFile(path.join(projectBrhpDirectory, 'instructions'), 'not a directory');

    try {
      const hooks = await createServerPluginHooksWithRuntimeAccess(createPluginInput(projectDirectory), {
        async withRuntime() {
          throw new Error('open failed');
        },
      });
      const output = {
        parts: [{ type: 'text', text: 'replace me' }],
      };

      await hooks['command.execute.before']?.(
        {
          command: 'brhp',
          sessionID: 'chat-all-diagnostics',
          arguments: '',
        },
        output as never
      );

      const text = String(output.parts[0]?.text ?? '');
      expect(text).toContain('Planning session:\n- Unavailable: Unable to load BRHP planner runtime');
      expect(text).toContain('- Instructions: Unable to load BRHP instructions');
      expect(text).toContain('- Planner runtime: Unable to load BRHP planner runtime');
      expect(text).not.toContain('open failed');
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('injects a system prompt section when instructions are loaded', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'brhp-server-system-'));
    const configRoot = path.join(tempRoot, 'config');
    const globalDirectory = path.join(configRoot, 'brhp', 'instructions');
    const projectDirectory = path.join(tempRoot, 'project');

    await mkdir(globalDirectory, { recursive: true });
    await mkdir(path.join(projectDirectory, '.opencode', 'brhp', 'instructions'), {
      recursive: true,
    });
    await writeFile(
      path.join(globalDirectory, 'baseline.md'),
      ['---', 'title: Baseline', '---', '', 'Use explicit steps.'].join('\n')
    );

    const originalConfigDirectory = process.env.OPENCODE_CONFIG_DIR;
    process.env.OPENCODE_CONFIG_DIR = configRoot;

    try {
      const hooks = await createServerPluginHooks(createPluginInput(projectDirectory));
      const output = { system: ['existing system text'] };

      await hooks['experimental.chat.system.transform']?.(
        {
          sessionID: 'session-1',
          model: {} as never,
        },
        output as never
      );

      expect(output.system).toHaveLength(2);
      expect(output.system[0]).toBe('existing system text');
      expect(output.system[1]).toContain('# BRHP Instructions');
      expect(output.system[1]).toContain('## Global: Baseline');
      expect(output.system[1]).toContain('Use explicit steps.');
    } finally {
      if (originalConfigDirectory === undefined) {
        delete process.env.OPENCODE_CONFIG_DIR;
      } else {
        process.env.OPENCODE_CONFIG_DIR = originalConfigDirectory;
      }

      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('creates and resumes planning sessions through /brhp subcommands', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'brhp-server-planning-'));
    const configRoot = path.join(tempRoot, 'config');
    const globalDirectory = path.join(configRoot, 'brhp', 'instructions');
    const projectDirectory = path.join(tempRoot, 'project');
    const projectInstructions = path.join(projectDirectory, '.opencode', 'brhp', 'instructions');

    await mkdir(globalDirectory, { recursive: true });
    await mkdir(projectInstructions, { recursive: true });
    await writeFile(
      path.join(globalDirectory, 'invariants.md'),
      ['# BRHP invariants', '', '- Keep all graph changes durable', '- Prefer explicit scopes'].join(
        '\n'
      )
    );

    const originalConfigDirectory = process.env.OPENCODE_CONFIG_DIR;
    process.env.OPENCODE_CONFIG_DIR = configRoot;

    try {
      const hooks = await createServerPluginHooks(createPluginInput(projectDirectory));
      const createOutput = {
        parts: [{ type: 'text', text: 'replace me' }],
      };

      await hooks['command.execute.before']?.(
        {
          command: 'brhp',
          sessionID: 'chat-a',
          arguments: 'plan formalize the BRHP runtime kernel',
        },
        createOutput as never
      );

      const createdText = String(createOutput.parts[0]?.text ?? '');
      const createdIdMatch = createdText.match(/Created session ([0-9a-f-]+)/i);
      const createdSessionId = createdIdMatch?.[1];

      expect(createdText).toContain('Created session');
      expect(createdSessionId).toBeTruthy();

      const systemOutput = { system: [] as string[] };

      await hooks['experimental.chat.system.transform']?.(
        {
          sessionID: 'chat-a',
          model: {} as never,
        },
        systemOutput as never
      );

      expect(systemOutput.system.join('\n')).toContain('Keep all graph changes durable');

      const resumeOutput = {
        parts: [{ type: 'text', text: 'replace me' }],
      };

      await hooks['command.execute.before']?.(
        {
          command: 'brhp',
          sessionID: 'chat-b',
          arguments: `resume ${createdSessionId}`,
        },
        resumeOutput as never
      );

      const resumedText = String(resumeOutput.parts[0]?.text ?? '');

      expect(resumedText).toContain(`Resumed session ${createdSessionId}`);
      expect(resumedText).toContain(`- Active: ${createdSessionId}`);

      const readToolOutput = await hooks.tool?.brhp_get_active_plan?.execute(
        {},
        {
          sessionID: 'chat-b',
          messageID: 'message-1',
          agent: 'assistant',
          directory: projectDirectory,
          worktree: projectDirectory,
          abort: new AbortController().signal,
          metadata() {},
          ask: async () => {},
        } as never
      );

      expect(readToolOutput).toContain(`"id": "${createdSessionId}"`);
      const activePlan = JSON.parse(readToolOutput ?? '{}') as {
        session?: { rootNodeId?: string };
      };

      const decomposeToolOutput = await hooks.tool?.brhp_decompose_node?.execute(
        {
          nodeId: activePlan.session?.rootNodeId ?? '',
          children: [
            {
              title: 'Define graph tools',
              problemStatement: 'Specify the minimal BRHP graph tool API.',
              category: 'cross-cutting',
            },
            {
              title: 'Persist frontier updates',
              problemStatement: 'Refresh the frontier after decomposition.',
              category: 'dependent',
            },
          ],
        },
        {
          sessionID: 'chat-b',
          messageID: 'message-2',
          agent: 'assistant',
          directory: projectDirectory,
          worktree: projectDirectory,
          abort: new AbortController().signal,
          metadata() {},
          ask: async () => {},
        } as never
      );

      expect(decomposeToolOutput).toContain('"kind": "decomposed"');
      expect(decomposeToolOutput).toContain('Define graph tools');

      const validateToolOutput = await hooks.tool?.brhp_validate_active_scope?.execute(
        {
          clauses: [
            {
              kind: 'structure',
              blocking: true,
              description: 'Every decomposed node must have at least one child edge.',
              status: 'passed',
            },
            {
              kind: 'coverage',
              blocking: true,
              description: 'The active scope must still have unresolved work.',
              status: 'pending',
              message: 'Additional child decomposition is still required.',
            },
          ],
        },
        {
          sessionID: 'chat-b',
          messageID: 'message-3',
          agent: 'assistant',
          directory: projectDirectory,
          worktree: projectDirectory,
          abort: new AbortController().signal,
          metadata() {},
          ask: async () => {},
        } as never
      );

      expect(validateToolOutput).toContain('"kind": "validation-recorded"');
      expect(validateToolOutput).toContain('"pendingBlockingClauses": 1');
      expect(validateToolOutput).toContain('"validationPressure"');
      expect(validateToolOutput).toContain('"status": "validating"');

      const validatedPlanOutput = await hooks.tool?.brhp_get_active_plan?.execute(
        {},
        {
          sessionID: 'chat-b',
          messageID: 'message-4',
          agent: 'assistant',
          directory: projectDirectory,
          worktree: projectDirectory,
          abort: new AbortController().signal,
          metadata() {},
          ask: async () => {},
        } as never
      );

      expect(validatedPlanOutput).toContain('"validation"');
      expect(validatedPlanOutput).toContain('"pendingBlockingClauses": 1');
      expect(validatedPlanOutput).toContain('"frontier"');
      expect(validatedPlanOutput).toContain('"validationPressure"');
      expect(validatedPlanOutput).toContain('"recentEvents"');

      const statusOutput = {
        parts: [{ type: 'text', text: 'replace me' }],
      };

      await hooks['command.execute.before']?.(
        {
          command: 'brhp',
          sessionID: 'chat-b',
          arguments: '',
        },
        statusOutput as never
      );

      const statusText = String(statusOutput.parts[0]?.text ?? '');
      expect(statusText).toContain('- Frontier:');
      expect(statusText).toContain('- Pressure:');
      expect(statusText).toContain('- Recent activity:');
      expect(statusText).toContain('Validation recorded: unsatisfied');

      const historyOutput = {
        parts: [{ type: 'text', text: 'replace me' }],
      };

      await hooks['command.execute.before']?.(
        {
          command: 'brhp',
          sessionID: 'chat-b',
          arguments: 'history',
        },
        historyOutput as never
      );

      const historyText = String(historyOutput.parts[0]?.text ?? '');
      expect(historyText).toContain('# BRHP History');
      expect(historyText).toContain(`Session: ${createdSessionId}`);
      expect(historyText).toContain('showing up to 25');
      expect(historyText).toContain('validation-recorded');
      expect(historyText).toContain('node-decomposed');

      const emptyHistoryOutput = {
        parts: [{ type: 'text', text: 'replace me' }],
      };

      await hooks['command.execute.before']?.(
        {
          command: 'brhp',
          sessionID: 'chat-empty',
          arguments: 'history',
        },
        emptyHistoryOutput as never
      );

      const emptyHistoryText = String(emptyHistoryOutput.parts[0]?.text ?? '');
      expect(emptyHistoryText).toContain('# BRHP History');
      expect(emptyHistoryText).toContain('No active BRHP planning session exists for this OpenCode chat.');
    } finally {
      if (originalConfigDirectory === undefined) {
        delete process.env.OPENCODE_CONFIG_DIR;
      } else {
        process.env.OPENCODE_CONFIG_DIR = originalConfigDirectory;
      }

      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('reuses one planner owner across command, tool, and system hooks', async () => {
    let getRuntimeCalls = 0;
    const runtime = {
      async getActive() {
        return null;
      },
      async getActiveSessionHistory() {
        return {
          active: false as const,
          events: [] as const,
        };
      },
      async create() {
        throw new Error('not used');
      },
      async resume() {
        throw new Error('not used');
      },
      async decomposeNode() {
        throw new Error('not used');
      },
      async recordValidation() {
        throw new Error('not used');
      },
    };
    const hooks = await createServerPluginHooksWithRuntimeAccess(createPluginInput('/repo'), {
      async withRuntime(_sessionID, _worktreePath, execute) {
        getRuntimeCalls += 1;
        return execute(runtime satisfies PlannerRuntime as never);
      },
    });

    await hooks['command.execute.before']?.(
      {
        command: 'brhp',
        sessionID: 'chat-owner',
        arguments: '',
      },
      { parts: [] } as never
    );

    await hooks.tool?.brhp_get_active_plan?.execute(
      {},
      {
        sessionID: 'chat-owner',
        messageID: 'message-owner',
        agent: 'assistant',
        directory: '/repo',
        worktree: '/repo',
        abort: new AbortController().signal,
        metadata() {},
        ask: async () => {},
      } as never
    );

    await hooks['experimental.chat.system.transform']?.(
      {
        sessionID: 'chat-owner',
        model: {} as never,
      },
      { system: [] } as never
    );

    expect(getRuntimeCalls).toBe(3);
  });

  it('retries planner initialization after a failed server-side attempt', async () => {
    let factoryCalls = 0;
    const hooks = await createServerPluginHooksWithRuntimeAccess(createPluginInput('/repo'), {
      async withRuntime(_sessionID, _worktreePath, execute) {
        factoryCalls += 1;
        if (factoryCalls === 1) {
          throw new Error('open failed');
        }

        return execute({
          async getActive() {
            return null;
          },
          async getActiveSessionHistory() {
            return {
              active: false as const,
              events: [] as const,
            };
          },
          async create() {
            throw new Error('not used');
          },
          async resume() {
            throw new Error('not used');
          },
          async decomposeNode() {
            throw new Error('not used');
          },
          async recordValidation() {
            throw new Error('not used');
          },
        } as never);
      },
    });

    const failedOutput = {
      parts: [{ type: 'text', text: 'replace me' }],
    };

    await expect(
      hooks['command.execute.before']?.(
        {
          command: 'brhp',
          sessionID: 'chat-retry',
          arguments: '',
        },
        failedOutput as never
      )
    ).resolves.toBeUndefined();

    const failedText = String(failedOutput.parts[0]?.text ?? '');
    expect(failedText).toContain('Runtime diagnostics:');
    expect(failedText).toContain('- Planner runtime: Unable to load BRHP planner runtime');

    await expect(
      hooks['command.execute.before']?.(
        {
          command: 'brhp',
          sessionID: 'chat-retry',
          arguments: '',
        },
        { parts: [] } as never
      )
    ).resolves.toBeUndefined();
    expect(factoryCalls).toBe(2);
  });

  it('closes the server runtime after each operation even when the operation fails', async () => {
    const events: string[] = [];
    const hooks = await createServerPluginHooksWithRuntimeAccess(createPluginInput('/repo'), {
      async withRuntime(_sessionID, _worktreePath, execute) {
        events.push('open');
        try {
          return await execute({
            async getActive() {
              return null;
            },
            async getActiveSessionHistory() {
              return {
                active: false as const,
                events: [] as const,
              };
            },
            async create() {
              throw new Error('mutation failed');
            },
            async resume() {
              throw new Error('not used');
            },
            async decomposeNode() {
              throw new Error('not used');
            },
            async recordValidation() {
              throw new Error('not used');
            },
          } as never);
        } finally {
          events.push('close');
        }
      },
    });

    await expect(
      hooks['command.execute.before']?.(
        {
          command: 'brhp',
          sessionID: 'chat-close',
          arguments: 'plan build server lifecycle tests',
        },
        { parts: [] } as never
      )
    ).rejects.toThrow('mutation failed');

    expect(events).toEqual(['open', 'close']);
  });

  it('resolves the real project worktree from live session metadata when plugin input is root-like', async () => {
    const observedWorktreePaths: string[] = [];
    const hooks = await createServerPluginHooksWithRuntimeAccess(
      createPluginInput('/', {
        project: { id: 'project-root', worktree: '/', time: { created: 0 } } as never,
        client: {
          session: {
            async get(options: {
              path: { id: string };
              responseStyle: 'data';
              throwOnError: true;
            }) {
              expect(options).toMatchObject({
                path: { id: 'chat-rootlike' },
                responseStyle: 'data',
                throwOnError: true,
              });
              return { directory: '/tmp/brhp-integration-project' } as never;
            },
          },
          project: {
            async current(options: {
              query: { directory: string };
              responseStyle: 'data';
              throwOnError: true;
            }) {
              expect(options).toMatchObject({
                query: { directory: '/tmp/brhp-integration-project' },
                responseStyle: 'data',
                throwOnError: true,
              });
              return { worktree: '/tmp/brhp-integration-project' } as never;
            },
          },
        } as never,
      }),
      {
        async withRuntime(_sessionID, worktreePath, execute) {
          observedWorktreePaths.push(worktreePath);
          return execute({
            async getActive() {
              return null;
            },
            async getActiveSessionHistory() {
              return {
                active: false as const,
                events: [] as const,
              };
            },
            async create() {
              throw new Error('not used');
            },
            async resume() {
              throw new Error('not used');
            },
            async decomposeNode() {
              throw new Error('not used');
            },
            async recordValidation() {
              throw new Error('not used');
            },
          } as never);
        },
      }
    );

    await hooks['command.execute.before']?.(
      {
        command: 'brhp',
        sessionID: 'chat-rootlike',
        arguments: '',
      },
      { parts: [] } as never
    );

    expect(observedWorktreePaths).toEqual([
      '/tmp/brhp-integration-project',
    ]);
  });

  it('resolves the real project worktree for tool execution when runtime context is root-like', async () => {
    const observedWorktreePaths: string[] = [];
    const hooks = await createServerPluginHooksWithRuntimeAccess(
      createPluginInput('/', {
        project: { id: 'project-root', worktree: '/', time: { created: 0 } } as never,
        client: {
          session: {
            async get() {
              return { directory: '/tmp/brhp-integration-project' } as never;
            },
          },
          project: {
            async current() {
              return { worktree: '/tmp/brhp-integration-project' } as never;
            },
          },
        } as never,
      }),
      {
        async withRuntime(_sessionID, worktreePath, execute) {
          observedWorktreePaths.push(worktreePath);
          return execute({
            async getActive() {
              return null;
            },
            async getActiveSessionHistory() {
              return {
                active: false as const,
                events: [] as const,
              };
            },
            async create() {
              throw new Error('not used');
            },
            async resume() {
              throw new Error('not used');
            },
            async decomposeNode() {
              throw new Error('not used');
            },
            async recordValidation() {
              throw new Error('not used');
            },
          } as never);
        },
      }
    );

    const output = await hooks.tool?.brhp_get_active_plan?.execute(
      {},
      {
        sessionID: 'chat-rootlike-tool',
        messageID: 'message-1',
        agent: 'assistant',
        directory: '/tmp/brhp-integration-project',
        worktree: '/',
        abort: new AbortController().signal,
        metadata() {},
        ask: async () => {},
      } as never
    );

    expect(output).toContain('No active BRHP planning session exists');
    expect(observedWorktreePaths).toEqual(['/tmp/brhp-integration-project']);
  });

  it('resolves the real project worktree for system prompt injection when plugin input is root-like', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'brhp-server-rootlike-system-'));
    const configRoot = path.join(tempRoot, 'config');
    const globalDirectory = path.join(configRoot, 'brhp', 'instructions');

    await mkdir(globalDirectory, { recursive: true });
    await writeFile(
      path.join(globalDirectory, 'baseline.md'),
      ['---', 'title: Baseline', '---', '', 'Use explicit steps.'].join('\n')
    );

    const originalConfigDirectory = process.env.OPENCODE_CONFIG_DIR;
    process.env.OPENCODE_CONFIG_DIR = configRoot;

    try {
      const hooks = await createServerPluginHooksWithRuntimeAccess(
        createPluginInput('/', {
          project: { id: 'project-root', worktree: '/', time: { created: 0 } } as never,
          client: {
            path: {
              async get() {
                return { directory: tempRoot, worktree: tempRoot } as never;
              },
            },
          } as never,
        }),
        {
          async withRuntime(_sessionID, worktreePath, execute) {
            expect(worktreePath).toBe(tempRoot);
            return execute({
              async getActive() {
                return null;
              },
              async getActiveSessionHistory() {
                return {
                  active: false as const,
                  events: [] as const,
                };
              },
              async create() {
                throw new Error('not used');
              },
              async resume() {
                throw new Error('not used');
              },
              async decomposeNode() {
                throw new Error('not used');
              },
              async recordValidation() {
                throw new Error('not used');
              },
            } as never);
          },
        }
      );

      const output = { system: [] as string[] };

      await hooks['experimental.chat.system.transform']?.(
        {
          sessionID: 'chat-rootlike-system',
          model: {} as never,
        },
        output as never
      );

      expect(output.system.join('\n')).toContain('Use explicit steps.');
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

function createPluginInput(
  projectDirectory: string,
  overrides: Partial<ReturnType<typeof createPluginInputBase>> = {}
) {
  return {
    ...createPluginInputBase(projectDirectory),
    ...overrides,
  };
}

function createPluginInputBase(projectDirectory: string): PluginInput {
  return {
    client: {} as never,
    project: { id: 'project-1', worktree: projectDirectory, time: { created: 0 } } as never,
    directory: projectDirectory,
    worktree: projectDirectory,
    serverUrl: new URL('https://example.com'),
    $: {} as never,
  };
}
