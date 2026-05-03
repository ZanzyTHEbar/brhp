import { describe, expect, it } from 'vitest';

import { buildSlashCommandResponse } from '../../src/application/use-cases/build-slash-command-response.js';
import { classifyRuntimeDiagnostic } from '../../src/application/use-cases/classify-runtime-diagnostic.js';

describe('buildSlashCommandResponse', () => {
  it('summarizes command identity, directories, and loaded instructions', () => {
    const response = buildSlashCommandResponse({
      directories: {
        global: '/global/brhp/instructions',
        project: '/repo/.opencode/brhp/instructions',
      },
      instructions: [
        {
          id: 'project:local.md',
          title: 'Local guidance',
          body: 'Do the thing.',
          source: 'project',
          absolutePath: '/repo/.opencode/brhp/instructions/local.md',
          relativePath: 'local.md',
          extension: '.md',
          order: 0,
        },
      ],
      counts: {
        global: 0,
        project: 1,
        total: 1,
        skipped: 0,
      },
      skippedFiles: [],
    });

    expect(response).toContain('Command: /brhp');
    expect(response).toContain('Planning session:');
    expect(response).toContain('None active for this OpenCode session');
    expect(response).toContain('Global: /global/brhp/instructions');
    expect(response).toContain('[project] Local guidance (local.md)');
    expect(response).toContain('Skipped files:');
    expect(response).toContain('Totals: 1 loaded');
  });

  it('renders runtime diagnostics without exposing internal causes', () => {
    const cause = new Error('internal path /repo/.opencode/brhp/brhp.db failed');
    const response = buildSlashCommandResponse(
      {
        directories: {
          global: 'unavailable',
          project: '/repo/.opencode/brhp/instructions',
        },
        instructions: [],
        counts: {
          global: 0,
          project: 0,
          total: 0,
          skipped: 0,
        },
        skippedFiles: [],
      },
      {
        diagnostics: [
          classifyRuntimeDiagnostic('instructions', cause),
          classifyRuntimeDiagnostic('planner-runtime', cause),
        ],
      }
    );

    expect(response).toContain('Planning session:\n- Unavailable: Unable to load BRHP planner runtime');
    expect(response).toContain('Runtime diagnostics:');
    expect(response).toContain('- Instructions: Unable to load BRHP instructions');
    expect(response).toContain('- Planner runtime: Unable to load BRHP planner runtime');
    expect(response).toContain('Loaded instructions:\n- Unavailable: Unable to load BRHP instructions');
    expect(response).toContain('Totals: unavailable while BRHP instructions could not be loaded');
    expect(response).not.toContain('internal path');
  });

  it('renders active planning session details and mutation summaries', () => {
    const state = {
      session: {
        id: 'session-1',
        worktreePath: '/repo',
        opencodeSessionId: 'chat-1',
        initialProblem: 'Formalize BRHP',
        status: 'exploring',
        activeScopeId: 'scope-1',
        rootNodeId: 'node-1',
        revision: 0,
        controls: {
          temperature: 0.3,
          topP: 0.9,
          temperatureFloor: 0.1,
          temperatureCeiling: 1,
          minDepthClamp: 1,
          maxDepthClamp: 5,
          depthClamp: 4,
        },
        policy: {
          policyDocumentIds: [],
          instructionDocumentIds: [],
          invariants: ['Keep all changes durable'],
        },
        summary: {
          globalEntropy: 0.8,
          entropyDrift: 0.3,
          frontierStability: 0.5,
          blockingFindings: 0,
          pendingBlockingClauses: 0,
          converged: false,
          lastFrontierUpdatedAt: '2026-04-17T12:00:00.000Z',
        },
        createdAt: '2026-04-17T12:00:00.000Z',
        updatedAt: '2026-04-17T12:00:00.000Z',
      },
      graph: {
        scopes: [{ id: 'scope-1' }],
        nodes: [{ id: 'node-1', title: 'Expand scope coverage' }],
        edges: [],
      },
      frontier: {
        id: 'frontier-1',
        sessionId: 'session-1',
        scopeId: 'scope-1',
        temperature: 0.3,
        globalEntropy: 0.8,
        depthClamp: 4,
        selections: [
          {
            nodeId: 'node-1',
            scopeId: 'scope-1',
            utility: 1,
            localEntropy: 0.5,
            validationPressure: 0.5,
            probability: 0.7,
            rank: 1,
            depthClamp: 4,
          },
        ],
        createdAt: '2026-04-17T12:05:00.000Z',
      },
      validation: {
        id: 'validation-1',
        sessionId: 'session-1',
        scopeId: 'scope-1',
        formula: {
          scopeId: 'scope-1',
          clauses: [
            {
              id: 'clause-1',
              kind: 'schema',
              blocking: true,
              description: 'Root scope must exist.',
              status: 'passed',
            },
          ],
        },
        satisfiable: true,
        blockingFindings: 0,
        pendingBlockingClauses: 0,
        createdAt: '2026-04-17T12:05:00.000Z',
      },
      recentEvents: [
        {
          id: 'event-1',
          sessionId: 'session-1',
          type: 'node-decomposed',
          occurredAt: '2026-04-17T12:06:00.000Z',
          payload: {
            childNodeIds: ['node-2'],
            previousStatus: 'active',
            nextStatus: 'decomposed',
          },
        },
        {
          id: 'event-2',
          sessionId: 'session-1',
          scopeId: 'scope-1',
          type: 'validation-recorded',
          occurredAt: '2026-04-17T12:07:00.000Z',
          payload: {
            validationId: 'validation-1',
            scopeId: 'scope-1',
            satisfiable: true,
            blockingFindings: 0,
            pendingBlockingClauses: 0,
            clauseCount: 1,
          },
        },
      ],
    };
    const response = buildSlashCommandResponse(
      {
        directories: {
          global: '/global/brhp/instructions',
          project: '/repo/.opencode/brhp/instructions',
        },
        instructions: [],
        counts: {
          global: 0,
          project: 0,
          total: 0,
          skipped: 0,
        },
        skippedFiles: [],
      },
      {
        activePlanningState: state as never,
        mutation: {
          kind: 'created',
          state: state as never,
        },
      }
    );

    expect(response).toContain('- Active: session-1');
    expect(response).toContain('- Status: exploring');
    expect(response).toContain('- Problem: Formalize BRHP');
    expect(response).toContain('- Graph: 1 scopes, 1 nodes, 0 edges');
    expect(response).toContain('- Validation: satisfiable (0 blocking, 0 pending, 1 clauses)');
    expect(response).toContain('- Frontier: 1 selections, top Expand scope coverage (p=0.700)');
    expect(response).toContain('- Pressure: max 0.500, 1/1 selections pressured, entropy 0.800, drift 0.300, stability 0.500');
    expect(response).toContain('- Recent activity:');
    expect(response).toContain('Node decomposed into 1 children');
    expect(response).toContain('Validation recorded: satisfiable (0 blocking, 0 pending)');
    expect(response).toContain('- Created session session-1');
  });

  it('renders recent activity in newest-first order', () => {
    const response = buildSlashCommandResponse(
      {
        directories: {
          global: '/global/brhp/instructions',
          project: '/repo/.opencode/brhp/instructions',
        },
        instructions: [],
        counts: {
          global: 0,
          project: 0,
          total: 0,
          skipped: 0,
        },
        skippedFiles: [],
      },
      {
        activePlanningState: {
          session: {
            id: 'session-1',
            worktreePath: '/repo',
            opencodeSessionId: 'chat-1',
            initialProblem: 'Order planner activity',
            status: 'exploring',
            activeScopeId: 'scope-1',
            rootNodeId: 'node-1',
            revision: 0,
            controls: {} as never,
            policy: {
              policyDocumentIds: [],
              instructionDocumentIds: [],
              invariants: [],
            },
            summary: {
              globalEntropy: 0,
              entropyDrift: 0,
              frontierStability: 1,
              blockingFindings: 0,
              pendingBlockingClauses: 0,
              converged: false,
              lastFrontierUpdatedAt: '2026-04-17T12:00:00.000Z',
            },
            createdAt: '2026-04-17T12:00:00.000Z',
            updatedAt: '2026-04-17T12:00:00.000Z',
          },
          graph: {
            scopes: [{ id: 'scope-1' }],
            nodes: [{ id: 'node-1' }],
            edges: [],
          },
          recentEvents: [
            {
              id: 'event-new',
              sessionId: 'session-1',
              type: 'validation-recorded',
              occurredAt: '2026-04-17T12:07:00.000Z',
              payload: {
                validationId: 'validation-1',
                scopeId: 'scope-1',
                satisfiable: false,
                blockingFindings: 0,
                pendingBlockingClauses: 1,
                clauseCount: 1,
              },
            },
            {
              id: 'event-old',
              sessionId: 'session-1',
              type: 'node-decomposed',
              occurredAt: '2026-04-17T12:06:00.000Z',
              payload: {
                childNodeIds: ['node-2'],
                previousStatus: 'active',
                nextStatus: 'decomposed',
              },
            },
          ],
        } as never,
      }
    );

    expect(response.indexOf('Validation recorded: unsatisfied (0 blocking, 1 pending)')).toBeLessThan(
      response.indexOf('Node decomposed into 1 children')
    );
  });

  it('renders a dedicated history response with typed event details', () => {
    const response = buildSlashCommandResponse(
      {
        directories: {
          global: '/global/brhp/instructions',
          project: '/repo/.opencode/brhp/instructions',
        },
        instructions: [],
        counts: {
          global: 0,
          project: 0,
          total: 0,
          skipped: 0,
        },
        skippedFiles: [],
      },
      {
        history: {
          active: true,
          sessionId: 'session-1',
          limit: 25,
          events: [
            {
              id: 'event-new',
              sessionId: 'session-1',
              scopeId: 'scope-1',
              type: 'validation-recorded',
              occurredAt: '2026-04-17T12:07:00.000Z',
              payload: {
                validationId: 'validation-1',
                scopeId: 'scope-1',
                satisfiable: false,
                blockingFindings: 0,
                pendingBlockingClauses: 1,
                clauseCount: 2,
              },
            },
            {
              id: 'event-old',
              sessionId: 'session-1',
              nodeId: 'node-1',
              type: 'node-decomposed',
              occurredAt: '2026-04-17T12:06:00.000Z',
              payload: {
                childNodeIds: ['node-2', 'node-3'],
                previousStatus: 'active',
                nextStatus: 'decomposed',
              },
            },
          ],
        },
      }
    );

    expect(response).toContain('# BRHP History');
    expect(response).toContain('Session: session-1');
    expect(response).toContain('Events: 2 (showing up to 25, newest first)');
    expect(response).toContain(
      '2026-04-17T12:07:00.000Z | validation-recorded | scope=scope-1 | satisfiable=false blocking=0 pending=1 clauses=2'
    );
    expect(response).toContain(
      '2026-04-17T12:06:00.000Z | node-decomposed | node=node-1 | children=2 active->decomposed'
    );
    expect(response.indexOf('validation-recorded')).toBeLessThan(response.indexOf('node-decomposed'));
  });

  it('renders an explicit empty history response', () => {
    const response = buildSlashCommandResponse(
      {
        directories: {
          global: '/global/brhp/instructions',
          project: '/repo/.opencode/brhp/instructions',
        },
        instructions: [],
        counts: {
          global: 0,
          project: 0,
          total: 0,
          skipped: 0,
        },
        skippedFiles: [],
      },
      {
        history: {
          active: false,
          limit: 25,
          events: [],
        },
      }
    );

    expect(response).toContain('# BRHP History');
    expect(response).toContain('No active BRHP planning session exists for this OpenCode chat.');
  });

  it('renders an explicit empty history for an active session with no events', () => {
    const response = buildSlashCommandResponse(
      {
        directories: {
          global: '/global/brhp/instructions',
          project: '/repo/.opencode/brhp/instructions',
        },
        instructions: [],
        counts: {
          global: 0,
          project: 0,
          total: 0,
          skipped: 0,
        },
        skippedFiles: [],
      },
      {
        history: {
          active: true,
          sessionId: 'session-1',
          limit: 25,
          events: [],
        },
      }
    );

    expect(response).toContain('# BRHP History');
    expect(response).toContain('Session: session-1');
    expect(response).toContain('No planner history is available for the active session yet.');
  });

  it('renders planner config when temperature or maxDepth are set', () => {
    const response = buildSlashCommandResponse(
      {
        directories: {
          global: '/global/brhp/instructions',
          project: '/repo/.opencode/brhp/instructions',
        },
        instructions: [],
        counts: {
          global: 0,
          project: 0,
          total: 0,
          skipped: 0,
        },
        skippedFiles: [],
      },
      {
        config: { temperature: 0.3, maxDepth: 4 },
      }
    );

    expect(response).toContain('Planner config:');
    expect(response).toContain('- Temperature: 0.300');
    expect(response).toContain('- Max depth: 4');
  });

  it('does not render planner config when config is empty', () => {
    const response = buildSlashCommandResponse(
      {
        directories: {
          global: '/global/brhp/instructions',
          project: '/repo/.opencode/brhp/instructions',
        },
        instructions: [],
        counts: {
          global: 0,
          project: 0,
          total: 0,
          skipped: 0,
        },
        skippedFiles: [],
      },
      {
        config: {},
      }
    );

    expect(response).not.toContain('Planner config:');
  });

  it('renders config alongside active planning session summary', () => {
    const response = buildSlashCommandResponse(
      {
        directories: {
          global: '/global/brhp/instructions',
          project: '/repo/.opencode/brhp/instructions',
        },
        instructions: [],
        counts: {
          global: 0,
          project: 0,
          total: 0,
          skipped: 0,
        },
        skippedFiles: [],
      },
      {
        config: { maxDepth: 3 },
        activePlanningState: {
          session: {
            id: 's-1',
            worktreePath: '/repo',
            opencodeSessionId: 'c-1',
            initialProblem: 'Test',
            status: 'validating',
            activeScopeId: 'scope-1',
            rootNodeId: 'node-1',
            revision: 1,
            controls: {
              temperature: 0.35,
              topP: 0.9,
              temperatureFloor: 0.1,
              temperatureCeiling: 1,
              minDepthClamp: 1,
              maxDepthClamp: 5,
              depthClamp: 4,
            },
            policy: {
              policyDocumentIds: [],
              instructionDocumentIds: [],
              invariants: [],
            },
            summary: {
              globalEntropy: 0.3,
              entropyDrift: 0.01,
              frontierStability: 0.95,
              blockingFindings: 0,
              pendingBlockingClauses: 0,
              converged: false,
              lastFrontierUpdatedAt: '2026-01-01T00:00:00.000Z',
            },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          graph: {
            scopes: [],
            nodes: [],
            edges: [],
          },
        },
      }
    );

    expect(response).toContain('Planner config:');
    expect(response).toContain('- Max depth: 3');
    expect(response).not.toContain('Temperature');
    expect(response).toContain('Planning session:');
    expect(response).toContain('- Active: s-1');
  });
});
