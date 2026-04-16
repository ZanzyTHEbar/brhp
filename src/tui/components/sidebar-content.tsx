/** @jsxImportSource @opentui/solid */
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import type { TuiPluginApi, TuiTheme } from '@opencode-ai/plugin/tui';

import type { SidebarModel } from '../../domain/sidebar/sidebar-model.js';
import { subscribeToSidebarRefresh } from '../state/sidebar-refresh.js';

interface SidebarContentProps {
  readonly api: TuiPluginApi;
  readonly theme: TuiTheme;
  readonly sessionId: string;
  readonly loadModel: (projectDirectory: string) => Promise<SidebarModel>;
}

type LoadState = 'loading' | 'ready' | 'error';

export function SidebarContent(props: SidebarContentProps) {
  const [state, setState] = createSignal<LoadState>('loading');
  const [model, setModel] = createSignal<SidebarModel | null>(null);

  const load = async (): Promise<void> => {
    setState('loading');

    try {
      setModel(
        await props.loadModel(props.api.state.path.worktree || props.api.state.path.directory)
      );
      setState('ready');
    } catch {
      setModel(null);
      setState('error');
    }
  };

  createEffect(() => {
    void props.sessionId;
    void load();
  });

  const unsubscribe = subscribeToSidebarRefresh(() => {
    void load();
  });

  onCleanup(() => {
    unsubscribe();
  });

  const colors = () => props.theme.current;

  return (
    <box flexDirection="column">
      <text fg={colors().text}>
        <b>BRHP</b>
      </text>

      <Show when={state() === 'loading'}>
        <text fg={colors().textMuted}>Loading plugin status…</text>
      </Show>

      <Show when={state() === 'error'}>
        <text fg={colors().error}>Unable to load instructions</text>
      </Show>

      <Show when={state() === 'ready' && model()}>
        <>
          {(() => {
            const currentModel = model();

            if (!currentModel) {
              return null;
            }

            return (
              <box flexDirection="column">
                <text fg={colors().textMuted}>Status: {currentModel.status}</text>
                <text fg={colors().textMuted}>
                  Commands: {currentModel.slashCommands.join(', ')}
                </text>
                <text fg={colors().textMuted}>
                  Instructions: {currentModel.instructionCount}
                </text>
                <text fg={colors().textMuted}>
                  Skipped: {currentModel.skippedCount}
                </text>
                <text fg={colors().textMuted}>Global: {currentModel.globalDirectory}</text>
                <text fg={colors().textMuted}>Project: {currentModel.projectDirectory}</text>

                <Show
                  when={currentModel.instructions.length > 0}
                  fallback={<text fg={colors().textMuted}>No instructions loaded</text>}
                >
                  <For each={currentModel.instructions}>
                    {instruction => (
                      <box flexDirection="column">
                        <text fg={colors().text}>
                          • [{instruction.source}] {instruction.title}
                        </text>
                        <text fg={colors().textMuted}>{instruction.relativePath}</text>
                        <Show when={instruction.description}>
                          <text fg={colors().textMuted}>{instruction.description}</text>
                        </Show>
                      </box>
                    )}
                  </For>
                </Show>

                <Show when={currentModel.skippedFiles.length > 0}>
                  <box flexDirection="column">
                    <text fg={colors().textMuted}>Skipped files:</text>
                    <For each={currentModel.skippedFiles}>
                      {skipped => (
                        <text fg={colors().textMuted}>
                          • [{skipped.source}] {skipped.relativePath} ({skipped.reason})
                        </text>
                      )}
                    </For>
                  </box>
                </Show>
              </box>
            );
          })()}
        </>
      </Show>
    </box>
  );
}
