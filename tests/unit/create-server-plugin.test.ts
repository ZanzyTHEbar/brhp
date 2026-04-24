import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

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
        return execute(runtime as never);
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

    await expect(
      hooks['command.execute.before']?.(
        {
          command: 'brhp',
          sessionID: 'chat-retry',
          arguments: '',
        },
        { parts: [] } as never
      )
    ).rejects.toThrow('open failed');

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
});

function createPluginInput(projectDirectory: string) {
  return {
    client: {} as never,
    project: {} as never,
    directory: projectDirectory,
    worktree: projectDirectory,
    serverUrl: new URL('https://example.com'),
    $: {} as never,
  };
}
