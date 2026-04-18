export const BRHP_COMMAND_NAME = 'brhp' as const;

export const BRHP_COMMAND_DESCRIPTION =
  'Inspect or manage the active BRHP planning session for this OpenCode chat.';

export const BRHP_COMMAND_SUBCOMMANDS = ['status', 'plan', 'resume'] as const;

export type BrhpCommandSubcommand = (typeof BRHP_COMMAND_SUBCOMMANDS)[number];
