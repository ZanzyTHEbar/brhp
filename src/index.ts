import type { Plugin } from '@opencode-ai/plugin';

import { createServerPluginHooks } from './composition/create-server-plugin.js';

const id = 'brhp' as const;

const server = (async input => {
  return createServerPluginHooks(input);
}) satisfies Plugin;

export default {
  id,
  server,
};
