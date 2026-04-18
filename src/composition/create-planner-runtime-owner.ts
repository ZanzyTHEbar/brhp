import type { PlannerRuntime } from '../application/services/planner-runtime.js';
import type { PlannerRuntimeHandle } from './create-planner-runtime.js';

export interface PlannerRuntimeOwner {
  getRuntime(): Promise<PlannerRuntime>;
  dispose(): Promise<void>;
}

export interface CreatePlannerRuntimeOwnerInput {
  readonly createHandle: () => Promise<PlannerRuntimeHandle>;
}

type OwnerState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'opening';
      readonly handlePromise: Promise<PlannerRuntimeHandle>;
      readonly runtimePromise: Promise<PlannerRuntime>;
    }
  | { readonly kind: 'open'; readonly handle: PlannerRuntimeHandle }
  | { readonly kind: 'disposed' };

export function createPlannerRuntimeOwner(
  input: CreatePlannerRuntimeOwnerInput
): PlannerRuntimeOwner {
  let state: OwnerState = { kind: 'idle' };
  let disposeRequested = false;
  let disposePromise: Promise<void> | null = null;

  return {
    async getRuntime() {
      if (state.kind === 'disposed') {
        throw new Error('Planner runtime owner has been disposed');
      }

      if (state.kind === 'open') {
        return state.handle.runtime;
      }

      if (state.kind === 'opening') {
        return state.runtimePromise;
      }

      const handlePromise = input
        .createHandle()
        .then(handle => {
          if (!disposeRequested) {
            state = { kind: 'open', handle };
          }
          return handle;
        })
        .catch(async error => {
          if (state.kind !== 'disposed') {
            state = { kind: 'idle' };
          }
          throw error;
        });
      const runtimePromise = handlePromise.then(handle => {
        if (disposeRequested) {
          throw new Error('Planner runtime owner was disposed during initialization');
        }

        return handle.runtime;
      });

      state = { kind: 'opening', handlePromise, runtimePromise };
      return runtimePromise;
    },

    async dispose() {
      disposeRequested = true;

      if (disposePromise) {
        return disposePromise;
      }

      disposePromise = (async () => {
        if (state.kind === 'disposed') {
          return;
        }

        if (state.kind === 'idle') {
          state = { kind: 'disposed' };
          return;
        }

        if (state.kind === 'opening') {
          let closeError: unknown;
          try {
            const handle = await state.handlePromise;
            await Promise.resolve(handle.close());
          } catch (error) {
            if (!(error instanceof Error && error.message === 'Planner runtime owner was disposed during initialization')) {
              closeError = error;
            }
          } finally {
            state = { kind: 'disposed' };
          }
          if (closeError) {
            throw closeError;
          }
          return;
        }

        let closeError: unknown;
        try {
          await Promise.resolve(state.handle.close());
        } catch (error) {
          closeError = error;
        } finally {
          state = { kind: 'disposed' };
        }
        if (closeError) {
          throw closeError;
        }
      })();

      return disposePromise;
    },
  };
}
