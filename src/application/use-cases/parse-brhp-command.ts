export type ParsedBrhpCommand =
  | { readonly kind: 'status' }
  | { readonly kind: 'plan'; readonly problemStatement: string }
  | { readonly kind: 'resume'; readonly sessionId: string }
  | { readonly kind: 'history' }
  | { readonly kind: 'inspect' };

export type ParsedBrhpCommandResult =
  | { readonly ok: true; readonly command: ParsedBrhpCommand }
  | { readonly ok: false; readonly message: string };

export function parseBrhpCommand(argumentsText: string): ParsedBrhpCommandResult {
  const trimmed = argumentsText.trim();

  if (trimmed.length === 0) {
    return { ok: true, command: { kind: 'status' } };
  }

  const [subcommand, ...rest] = trimmed.split(/\s+/u);
  const payload = rest.join(' ').trim();

  if (!BRHP_COMMAND_SUBCOMMANDS.includes(subcommand as (typeof BRHP_COMMAND_SUBCOMMANDS)[number])) {
    return {
      ok: false,
      message: `Unknown BRHP subcommand '${subcommand}'. Supported: ${BRHP_COMMAND_SUBCOMMANDS.join(', ')}.`,
    };
  }

  switch (subcommand) {
    case 'status':
      return payload.length === 0
        ? { ok: true, command: { kind: 'status' } }
        : { ok: false, message: 'Usage: /brhp or /brhp status' };
    case 'plan':
      return payload.length > 0
        ? { ok: true, command: { kind: 'plan', problemStatement: payload } }
        : { ok: false, message: 'Usage: /brhp plan <problem statement>' };
    case 'resume':
      return payload.length > 0
        ? { ok: true, command: { kind: 'resume', sessionId: payload } }
        : { ok: false, message: 'Usage: /brhp resume <session id>' };
    case 'history':
      return payload.length === 0
        ? { ok: true, command: { kind: 'history' } }
        : { ok: false, message: 'Usage: /brhp history' };
    case 'inspect':
      return payload.length === 0
        ? { ok: true, command: { kind: 'inspect' } }
        : { ok: false, message: 'Usage: /brhp inspect' };
  }

  return {
    ok: false,
    message: `Unknown BRHP subcommand '${subcommand}'. Supported: ${BRHP_COMMAND_SUBCOMMANDS.join(', ')}.`,
  };
}
import { BRHP_COMMAND_SUBCOMMANDS } from '../../domain/slash-command/brhp-command.js';
