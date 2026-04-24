/** @jsxImportSource @opentui/solid */
import type { TuiPlugin } from '@opencode-ai/plugin/tui';

import { buildSidebarModel } from '../application/use-cases/build-sidebar-model.js';
import { createPlannerRuntimeForWorktree } from './create-planner-runtime.js';
import { createPlannerRuntimeOwner } from './create-planner-runtime-owner.js';
import { createInstructionInventoryLoader } from './create-instruction-inventory-loader.js';
import { emitSidebarRefresh } from '../tui/state/sidebar-refresh.js';
import { SidebarContent } from '../tui/components/sidebar-content.js';
import type { PlannerRuntimeOwner } from './create-planner-runtime-owner.js';
import { resolveRuntimeProjectPath } from './resolve-project-worktree-path.js';

export interface CreateTuiPluginOptions {
  readonly createOwner?: (worktreePath: string) => PlannerRuntimeOwner;
}

export const createTuiPlugin = (options: CreateTuiPluginOptions = {}): TuiPlugin => {
  return async api => {
    const projectDirectory = resolveRuntimeProjectPath(
      api.state.path.worktree,
      api.state.path.directory
    );
    const owner =
      options.createOwner?.(projectDirectory) ??
      createPlannerRuntimeOwner({
        createHandle: () => createPlannerRuntimeForWorktree(projectDirectory),
      });

    const loadModel = async (sessionId: string) => {
      const inventory = await createInstructionInventoryLoader(projectDirectory)();
      const planningState = await (await owner.getRuntime()).getActive({
        worktreePath: projectDirectory,
        opencodeSessionId: sessionId,
      });

      return buildSidebarModel(inventory, planningState);
    };

    let unregisterSlots: unknown;
    let unregisterCommand: unknown;

    try {
      unregisterSlots = api.slots.register({
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

      unregisterCommand = api.command.register(() => [
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
        void owner.dispose().catch(() => {
          api.ui.toast({
            variant: 'warning',
            message: 'BRHP planner runtime failed to close cleanly',
          });
        });
        maybeDispose(unregisterCommand);
        maybeDispose(unregisterSlots);
      });
    } catch (error) {
      maybeDispose(unregisterCommand);
      maybeDispose(unregisterSlots);
      await owner.dispose();
      throw error;
    }
  };
};

function maybeDispose(registration: unknown): void {
  if (typeof registration === 'function') {
    registration();
  }
}
