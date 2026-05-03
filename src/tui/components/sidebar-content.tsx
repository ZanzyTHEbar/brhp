/** @jsxImportSource @opentui/solid */
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import type { TuiPluginApi, TuiTheme } from '@opencode-ai/plugin/tui';

import type {
  SidebarLoadFailure,
  SidebarLoadResult,
} from '../../application/use-cases/load-sidebar-model.js';
import type { SidebarGraphPreview, SidebarModel } from '../../domain/sidebar/sidebar-model.js';
import { subscribeToSidebarRefresh } from '../state/sidebar-refresh.js';

interface SidebarContentProps {
  readonly api: TuiPluginApi;
  readonly theme: TuiTheme;
  readonly sessionId: string;
  readonly loadModel: (sessionId: string) => Promise<SidebarLoadResult>;
}

type LoadState = 'loading' | 'ready' | 'error';

const EMPTY_GRAPH_PREVIEW: SidebarGraphPreview = {
  focusNodes: [],
  edges: [],
  frontierSelections: [],
  validationClauses: [],
};

export function SidebarContent(props: SidebarContentProps) {
  const [state, setState] = createSignal<LoadState>('loading');
  const [model, setModel] = createSignal<SidebarModel | null>(null);
  const [failure, setFailure] = createSignal<SidebarLoadFailure | null>(null);

  const load = async (): Promise<void> => {
    setState('loading');

    try {
      const result = await props.loadModel(props.sessionId);

      if (result.ok) {
        setModel(result.model);
        setFailure(null);
        setState('ready');
        return;
      }

      setModel(null);
      setFailure(result.failure);
      setState('error');
    } catch {
      setModel(null);
      setFailure({
        kind: 'unknown',
        message: 'Unable to load BRHP sidebar state',
      });
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
        <text fg={colors().error}>{failure()?.message ?? 'Unable to load BRHP sidebar state'}</text>
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
                  when={currentModel.planning?.active}
                  fallback={<text fg={colors().textMuted}>Planning: No active planning session</text>}
                >
                  <box flexDirection="column">
                    <text fg={colors().textMuted}>
                      Planning session: {currentModel.planning?.sessionId}
                    </text>
                    <text fg={colors().textMuted}>
                      Planning status: {currentModel.planning?.status}
                    </text>
                    <Show when={currentModel.planning?.problem}>
                      <text fg={colors().textMuted}>
                        Problem: {currentModel.planning?.problem}
                      </text>
                    </Show>
                    <Show when={currentModel.planning?.scopeCount !== undefined}>
                      <text fg={colors().textMuted}>
                        Graph: {currentModel.planning?.scopeCount} scopes,{' '}
                        {currentModel.planning?.nodeCount} nodes, {currentModel.planning?.edgeCount}{' '}
                        edges
                      </text>
                    </Show>
                    <Show when={currentModel.planning?.validation}>
                      <text fg={colors().textMuted}>
                        Validation: {currentModel.planning?.validation?.satisfiable ? 'satisfiable' : 'unsatisfied'} ({currentModel.planning?.validation?.blockingFindings} blocking, {currentModel.planning?.validation?.pendingBlockingClauses} pending, {currentModel.planning?.validation?.clauseCount} clauses)
                      </text>
                    </Show>
                    <Show when={currentModel.planning?.frontier}>
                      <text fg={colors().textMuted}>
                        Frontier: {currentModel.planning?.frontier?.selectionCount} selections, top {currentModel.planning?.frontier?.topNodeTitle ?? currentModel.planning?.frontier?.topNodeId ?? 'n/a'}{currentModel.planning?.frontier?.topProbability !== undefined ? ` (p=${currentModel.planning?.frontier?.topProbability?.toFixed(3)})` : ''}
                      </text>
                    </Show>
                    <Show when={currentModel.planning?.frontier}>
                      <text fg={colors().textMuted}>
                        Pressure: max {currentModel.planning?.frontier?.maxValidationPressure.toFixed(3)}, {currentModel.planning?.frontier?.pressuredSelectionCount}/{currentModel.planning?.frontier?.selectionCount} pressured, entropy {currentModel.planning?.frontier?.globalEntropy.toFixed(3)}, drift {currentModel.planning?.frontier?.entropyDrift.toFixed(3)}, stability {currentModel.planning?.frontier?.frontierStability.toFixed(3)}
                      </text>
                    </Show>
                    <Show when={currentModel.planning?.recentActivity?.length}> 
                      <box flexDirection="column">
                        <text fg={colors().textMuted}>Recent activity:</text>
                        <For each={currentModel.planning?.recentActivity}>
                          {activity => (
                            <text fg={colors().textMuted}>• {activity.label}</text>
                          )}
                        </For>
                      </box>
                    </Show>
                    <Show when={currentModel.planning?.graphPreview}>
                      <SidebarGraphPreviewContent
                        colors={colors()}
                        graphPreview={currentModel.planning?.graphPreview ?? EMPTY_GRAPH_PREVIEW}
                      />
                    </Show>
                  </box>
                </Show>

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

export function SidebarGraphPreviewContent(props: {
  readonly colors: TuiTheme['current'];
  readonly graphPreview: SidebarGraphPreview;
}) {
  return (
    <box flexDirection="column">
      <text fg={props.colors.textMuted}>Graph preview:</text>
      <Show when={props.graphPreview.activeScope}>
        <box flexDirection="column">
          <text fg={props.colors.textMuted}>
            Scope: {props.graphPreview.activeScope?.title} ({props.graphPreview.activeScope?.status}, depth {props.graphPreview.activeScope?.depth})
          </text>
          <text fg={props.colors.textMuted}>
            Root: {props.graphPreview.activeScope?.rootNodeTitle ?? props.graphPreview.activeScope?.rootNodeId}
          </text>
        </box>
      </Show>
      <Show when={props.graphPreview.frontierSelections.length > 0}>
        <box flexDirection="column">
          <text fg={props.colors.textMuted}>Frontier:</text>
          <For each={props.graphPreview.frontierSelections}>
            {selection => (
              <text fg={props.colors.textMuted}>
                • #{selection.rank} {selection.nodeTitle ?? selection.nodeId} p={selection.probability.toFixed(3)} pressure={selection.validationPressure.toFixed(3)}
              </text>
            )}
          </For>
        </box>
      </Show>
      <Show when={props.graphPreview.focusNodes.length > 0}>
        <box flexDirection="column">
          <text fg={props.colors.textMuted}>Focus nodes:</text>
          <For each={props.graphPreview.focusNodes}>
            {node => (
              <text fg={props.colors.textMuted}>
                • [{node.status}] {node.title} d={node.depth} pressure={node.validationPressure.toFixed(3)}
              </text>
            )}
          </For>
        </box>
      </Show>
      <Show when={props.graphPreview.validationClauses.length > 0}>
        <box flexDirection="column">
          <text fg={props.colors.textMuted}>Validation clauses:</text>
          <For each={props.graphPreview.validationClauses}>
            {clause => (
              <text fg={props.colors.textMuted}>
                • [{clause.status}] {clause.kind}{clause.blocking ? ' blocking' : ''}: {clause.description}
              </text>
            )}
          </For>
        </box>
      </Show>
      <Show when={props.graphPreview.edges.length > 0}>
        <box flexDirection="column">
          <text fg={props.colors.textMuted}>Edges:</text>
          <For each={props.graphPreview.edges}>
            {edge => (
              <box flexDirection="column">
                <text fg={props.colors.textMuted}>
                  • {edge.kind}: {edge.fromNodeTitle ?? edge.fromNodeId}
                </text>
                <text fg={props.colors.textMuted}>{'  -> '}{edge.toNodeTitle ?? edge.toNodeId}</text>
              </box>
            )}
          </For>
        </box>
      </Show>
    </box>
  );
}
