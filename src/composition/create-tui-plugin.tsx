/** @jsxImportSource @opentui/solid */
import type { TuiPlugin } from '@opencode-ai/plugin/tui';

import { buildSidebarModel } from '../application/use-cases/build-sidebar-model.js';
import { createInstructionInventoryLoader } from './create-instruction-inventory-loader.js';
import { emitSidebarRefresh } from '../tui/state/sidebar-refresh.js';
import { SidebarContent } from '../tui/components/sidebar-content.js';

export const createTuiPlugin = (): TuiPlugin => {
  return async api => {
    const loadModel = async (projectDirectory: string) => {
      const inventory = await createInstructionInventoryLoader(projectDirectory)();
      return buildSidebarModel(inventory);
    };

    const unregisterSlots = api.slots.register({
      order: 300,
      slots: {
        sidebar_content: (context, props) => (
          <SidebarContent
            api={api}
            theme={context.theme}
            sessionId={props.session_id}
            loadModel={loadModel}
          />
        ),
      },
    });

    const unregisterCommand = api.command.register(() => [
      {
        title: 'Refresh BRHP sidebar',
        value: 'brhp.refresh',
        description: 'Reload instruction inventory from disk',
        category: 'Plugins',
        onSelect: () => {
          emitSidebarRefresh();
          api.ui.toast({
            variant: 'info',
            message: 'BRHP sidebar refresh requested',
          });
        },
      },
    ]);

    api.lifecycle.onDispose(() => {
      maybeDispose(unregisterCommand);
      maybeDispose(unregisterSlots);
    });
  };
};

function maybeDispose(registration: unknown): void {
  if (typeof registration === 'function') {
    registration();
  }
}
