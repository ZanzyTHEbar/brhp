import { describe, expect, it } from 'vitest';

import { parseBrhpCommand } from '../../src/application/use-cases/parse-brhp-command.js';

describe('parseBrhpCommand', () => {
  it('treats empty args as status', () => {
    expect(parseBrhpCommand('')).toEqual({
      ok: true,
      command: { kind: 'status' },
    });
  });

  it('parses plan, resume, history, and inspect subcommands', () => {
    expect(parseBrhpCommand('plan formalize the planner')).toEqual({
      ok: true,
      command: {
        kind: 'plan',
        problemStatement: 'formalize the planner',
      },
    });

    expect(parseBrhpCommand('resume session-123')).toEqual({
      ok: true,
      command: {
        kind: 'resume',
        sessionId: 'session-123',
      },
    });

    expect(parseBrhpCommand('history')).toEqual({
      ok: true,
      command: {
        kind: 'history',
      },
    });

    expect(parseBrhpCommand('inspect')).toEqual({
      ok: true,
      command: {
        kind: 'inspect',
      },
    });
  });

  it('rejects invalid invocations with user-facing messages', () => {
    expect(parseBrhpCommand('plan')).toEqual({
      ok: false,
      message: 'Usage: /brhp plan <problem statement>',
    });

    expect(parseBrhpCommand('resume')).toEqual({
      ok: false,
      message: 'Usage: /brhp resume <session id>',
    });

    expect(parseBrhpCommand('history later')).toEqual({
      ok: false,
      message: 'Usage: /brhp history',
    });

    expect(parseBrhpCommand('inspect later')).toEqual({
      ok: false,
      message: 'Usage: /brhp inspect',
    });

    expect(parseBrhpCommand('unknown')).toEqual({
      ok: false,
      message: "Unknown BRHP subcommand 'unknown'. Supported: status, plan, resume, history, inspect.",
    });
  });
});
