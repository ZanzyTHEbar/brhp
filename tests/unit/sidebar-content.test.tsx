/** @jsxImportSource @opentui/solid */
import { describe, expect, it, vi } from 'vitest';

import {
  SidebarContent,
  SidebarGraphPreviewContent,
} from '../../src/tui/components/sidebar-content.js';
import type { SidebarModel } from '../../src/domain/sidebar/sidebar-model.js';

vi.mock('solid-js', () => ({
  createSignal: <Value,>(initial: Value) => {
    let value = initial;

    return [
      () => value,
      (next: Value) => {
        value = next;
      },
    ];
  },
  createEffect: (effect: () => void) => {
    effect();
  },
  onCleanup: () => {},
  Show: (props: { when?: unknown; fallback?: unknown; children?: unknown }) =>
    props.when ? props.children : props.fallback,
  For: <Item,>(props: { each?: readonly Item[]; children: (item: Item) => unknown }) =>
    props.each?.map(item => props.children(item)) ?? [],
}));

vi.mock('@opentui/solid/jsx-dev-runtime', () => ({
  Fragment: (props: { children?: unknown }) => props.children,
  jsxDEV: (type: unknown, props: Record<string, unknown>) => {
    if (typeof type === 'function') {
      return type(props);
    }

    return { type, props };
  },
}));

describe('SidebarContent', () => {
  it('loads a graph-preview-capable sidebar model without throwing', async () => {
    let loadCount = 0;

    const rendered = SidebarContent({
      api: {} as never,
      theme: {
        current: {
          text: '#ffffff',
          textMuted: '#999999',
          error: '#ff0000',
        },
      } as never,
      sessionId: 'chat-1',
      loadModel: async () => {
        loadCount += 1;

        return {
          ok: true,
          model: createSidebarModel(),
        };
      },
    });

    await Promise.resolve();

    expect(rendered).toBeTruthy();
    expect(loadCount).toBe(1);
  });

  it('renders the graph preview subtree with bounded graph concepts', () => {
    const model = createSidebarModel();
    const rendered = SidebarGraphPreviewContent({
      colors: {
        text: '#ffffff',
        textMuted: '#999999',
        error: '#ff0000',
      } as never,
      graphPreview: model.planning?.graphPreview ?? {
        focusNodes: [],
        edges: [],
        frontierSelections: [],
        validationClauses: [],
      },
    });
    const serialized = JSON.stringify(rendered);

    expect(serialized).toContain('Graph preview:');
    expect(serialized).toContain('Scope: ');
    expect(serialized).toContain('Frontier:');
    expect(serialized).toContain('Focus nodes:');
    expect(serialized).toContain('Validation clauses:');
    expect(serialized).toContain('Edges:');
    expect(serialized).toContain('  -> ');
  });
});

function createSidebarModel(): SidebarModel {
  return {
    pluginName: 'brhp',
    status: 'ready',
    slashCommands: ['/brhp'],
    globalDirectory: '/global/brhp/instructions',
    projectDirectory: '/repo/.opencode/brhp/instructions',
    instructionCount: 0,
    skippedCount: 0,
    instructions: [],
    skippedFiles: [],
    planning: {
      active: true,
      sessionId: 'session-1',
      status: 'exploring',
      problem: 'Formalize BRHP',
      scopeCount: 1,
      nodeCount: 2,
      edgeCount: 1,
      graphPreview: {
        activeScope: {
          id: 'scope-1',
          title: 'Current graph scope',
          question: 'Which graph details should the sidebar expose?',
          status: 'active',
          depth: 0,
          rootNodeId: 'node-root',
          rootNodeTitle: 'Root planning node',
        },
        frontierSelections: [
          {
            rank: 1,
            nodeId: 'node-active',
            nodeTitle: 'Active graph slice',
            probability: 0.7,
            validationPressure: 0.8,
          },
        ],
        focusNodes: [
          {
            id: 'node-active',
            title: 'Active graph slice',
            status: 'active',
            category: 'cross-cutting',
            depth: 1,
            validationPressure: 0.8,
          },
        ],
        validationClauses: [
          {
            id: 'clause-1',
            kind: 'coverage',
            status: 'pending',
            blocking: true,
            description: 'Active scope needs full coverage.',
          },
        ],
        edges: [
          {
            id: 'edge-1',
            kind: 'decomposes-to',
            fromNodeId: 'node-root',
            fromNodeTitle: 'Root planning node',
            toNodeId: 'node-active',
            toNodeTitle: 'Active graph slice',
          },
        ],
      },
    },
  };
}
