import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createServerPluginHooks } from '../../src/composition/create-server-plugin.js';

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
