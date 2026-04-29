import { describe, expect, it } from 'vitest';

import { buildPlanningInspectResponse } from '../../src/application/use-cases/build-planning-inspect-response.js';
import { classifyRuntimeDiagnostic } from '../../src/application/use-cases/classify-runtime-diagnostic.js';
import type { PlanningState } from '../../src/domain/planning/planning-session.js';

describe('buildPlanningInspectResponse', () => {
  it('renders an explicit no-active-session response', () => {
    const response = buildPlanningInspectResponse({ state: null });

    expect(response).toContain('# BRHP Inspect');
    expect(response).toContain('No active BRHP planning session exists for this OpenCode chat.');
  });

  it('renders runtime diagnostics without exposing internal causes', () => {
    const response = buildPlanningInspectResponse({
      state: null,
      diagnostics: [classifyRuntimeDiagnostic('planner-runtime', new Error('open failed at /repo/.opencode/brhp/brhp.db'))],
    });

    expect(response).toContain('Planning session:\n- Unavailable: Unable to load BRHP planner runtime');
    expect(response).toContain('Runtime diagnostics:');
    expect(response).toContain('- Planner runtime: Unable to load BRHP planner runtime');
    expect(response).not.toContain('open failed');
    expect(response).not.toContain('/repo/.opencode');
  });

  it('renders bounded graph, frontier, validation, nodes, edges, and activity details', () => {
    const response = buildPlanningInspectResponse({
      state: createPlanningState(),
      limits: {
        frontierSelections: 1,
        validationClauses: 1,
        focusNodes: 2,
        edges: 1,
        recentEvents: 1,
      },
    });

    expect(response).toContain('# BRHP Inspect');
    expect(response).toContain('- ID: session-1');
    expect(response).toContain('- Status: validating');
    expect(response).toContain('- Revision: 4');
    expect(response).toContain('Problem:\nFormalize a safe operator drill-down surface');
    expect(response).toContain('- Scopes: 2 (active 1, completed 1, archived 0)');
    expect(response).toContain('- Nodes: 4 (proposed 1, active 1, decomposed 0, leaf 1, pruned 0, blocked 1)');
    expect(response).toContain('- Edges: 2 (decomposes-to 1, depends-on 1, blocks 0, parallelizes-with 0, cross-cuts 0)');
    expect(response).toContain('Active scope:');
    expect(response).toContain('- Title: Current operator contract');
    expect(response).toContain('- Root node: Root plan (node-root)');
    expect(response).toContain('Frontier selections:\n- Showing 1 of 2 (limit 1)');
    expect(response).toContain('- #1 Active inspection node (node-active) p=0.650 utility=0.900 entropy=0.400 pressure=0.200 depth=1');
    expect(response).not.toContain('#2 Blocked validation node');
    expect(response).toContain('Validation:\n- Satisfiable: no');
    expect(response).toContain('- Clauses: 2 (showing up to 1)');
    expect(response).toContain('- [failed] dependency blocking: Active node needs dependency visibility');
    expect(response).not.toContain('Second validation clause should be hidden by the limit');
    expect(response).toContain('Focus nodes:\n- Showing 2 of 4 (limit 2)');
    expect(response).toContain('[active] Active inspection node');
    expect(response).toContain('[blocked] Blocked validation node');
    expect(response).not.toContain('[leaf] Leaf follow-up node');
    expect(response).toContain('Edges:\n- Showing 1 of 2 (limit 1)');
    expect(response).toContain('decomposes-to: Root plan (node-root) -> Active inspection node (node-active)');
    expect(response).not.toContain('depends-on: Active inspection node');
    expect(response).toContain('Recent activity:\n- Showing 1 of 2 (limit 1)');
    expect(response).toContain('validation-recorded | satisfiable=false blocking=1 pending=1 clauses=2');
    expect(response).not.toContain('node-created');
  });

  it('clamps caller-provided limits to the built-in maxima', () => {
    const response = buildPlanningInspectResponse({
      state: createPlanningState(),
      limits: {
        frontierSelections: 999,
        validationClauses: 999,
        focusNodes: 999,
        edges: 999,
        recentEvents: 999,
      },
    });

    expect(response).toContain('Frontier selections:\n- Showing 2 of 2 (limit 5)');
    expect(response).toContain('- Clauses: 2 (showing up to 10)');
    expect(response).toContain('Focus nodes:\n- Showing 4 of 4 (limit 10)');
    expect(response).toContain('Edges:\n- Showing 2 of 2 (limit 10)');
    expect(response).toContain('Recent activity:\n- Showing 2 of 2 (limit 10)');
  });
});

function createPlanningState(): PlanningState {
  return {
    session: {
      id: 'session-1',
      worktreePath: '/repo',
      opencodeSessionId: 'chat-1',
      initialProblem: 'Formalize a safe operator drill-down surface',
      status: 'validating',
      activeScopeId: 'scope-active',
      rootNodeId: 'node-root',
      revision: 4,
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
        invariants: [],
      },
      summary: {
        globalEntropy: 0.6,
        entropyDrift: 0.1,
        frontierStability: 0.8,
        blockingFindings: 1,
        pendingBlockingClauses: 1,
        converged: false,
        lastFrontierUpdatedAt: '2026-04-29T10:00:00.000Z',
      },
      createdAt: '2026-04-29T09:00:00.000Z',
      updatedAt: '2026-04-29T10:00:00.000Z',
    },
    graph: {
      scopes: [
        {
          id: 'scope-active',
          sessionId: 'session-1',
          rootNodeId: 'node-root',
          title: 'Current operator contract',
          question: 'What bounded read-only detail should the operator see?',
          depth: 0,
          status: 'active',
          createdAt: '2026-04-29T09:00:00.000Z',
          updatedAt: '2026-04-29T10:00:00.000Z',
        },
        {
          id: 'scope-done',
          sessionId: 'session-1',
          parentScopeId: 'scope-active',
          rootNodeId: 'node-leaf',
          title: 'Completed background',
          question: 'What has already landed?',
          depth: 1,
          status: 'completed',
          createdAt: '2026-04-29T09:10:00.000Z',
          updatedAt: '2026-04-29T09:40:00.000Z',
        },
      ],
      nodes: [
        {
          id: 'node-root',
          sessionId: 'session-1',
          scopeId: 'scope-active',
          title: 'Root plan',
          problemStatement: 'Root problem',
          category: 'dependent',
          status: 'proposed',
          depth: 0,
          scores: {
            utility: 0.5,
            confidence: 0.7,
            localEntropy: 0.4,
            validationPressure: 0,
          },
          createdAt: '2026-04-29T09:00:00.000Z',
          updatedAt: '2026-04-29T09:00:00.000Z',
        },
        {
          id: 'node-active',
          sessionId: 'session-1',
          scopeId: 'scope-active',
          parentNodeId: 'node-root',
          title: 'Active inspection node',
          problemStatement: 'Expose bounded active detail',
          category: 'cross-cutting',
          status: 'active',
          depth: 1,
          scores: {
            utility: 0.9,
            confidence: 0.8,
            localEntropy: 0.4,
            validationPressure: 0.2,
          },
          createdAt: '2026-04-29T09:10:00.000Z',
          updatedAt: '2026-04-29T09:20:00.000Z',
        },
        {
          id: 'node-blocked',
          sessionId: 'session-1',
          scopeId: 'scope-active',
          parentNodeId: 'node-root',
          title: 'Blocked validation node',
          problemStatement: 'Resolve validation blockers',
          category: 'dependent',
          status: 'blocked',
          depth: 1,
          scores: {
            utility: 0.7,
            confidence: 0.4,
            localEntropy: 0.6,
            validationPressure: 0.9,
          },
          createdAt: '2026-04-29T09:15:00.000Z',
          updatedAt: '2026-04-29T09:25:00.000Z',
        },
        {
          id: 'node-leaf',
          sessionId: 'session-1',
          scopeId: 'scope-done',
          title: 'Leaf follow-up node',
          problemStatement: 'Follow up later',
          category: 'isolated',
          status: 'leaf',
          depth: 2,
          scores: {
            utility: 0.3,
            confidence: 0.9,
            localEntropy: 0.2,
            validationPressure: 0,
          },
          createdAt: '2026-04-29T09:30:00.000Z',
          updatedAt: '2026-04-29T09:40:00.000Z',
        },
      ],
      edges: [
        {
          id: 'edge-1',
          sessionId: 'session-1',
          fromNodeId: 'node-root',
          toNodeId: 'node-active',
          kind: 'decomposes-to',
          createdAt: '2026-04-29T09:20:00.000Z',
        },
        {
          id: 'edge-2',
          sessionId: 'session-1',
          fromNodeId: 'node-active',
          toNodeId: 'node-blocked',
          kind: 'depends-on',
          createdAt: '2026-04-29T09:21:00.000Z',
        },
      ],
    },
    frontier: {
      id: 'frontier-1',
      sessionId: 'session-1',
      scopeId: 'scope-active',
      temperature: 0.3,
      globalEntropy: 0.6,
      depthClamp: 4,
      selections: [
        {
          nodeId: 'node-active',
          scopeId: 'scope-active',
          utility: 0.9,
          localEntropy: 0.4,
          validationPressure: 0.2,
          probability: 0.65,
          rank: 1,
          depthClamp: 4,
        },
        {
          nodeId: 'node-blocked',
          scopeId: 'scope-active',
          utility: 0.7,
          localEntropy: 0.6,
          validationPressure: 0.9,
          probability: 0.35,
          rank: 2,
          depthClamp: 4,
        },
      ],
      createdAt: '2026-04-29T09:45:00.000Z',
    },
    validation: {
      id: 'validation-1',
      sessionId: 'session-1',
      scopeId: 'scope-active',
      formula: {
        scopeId: 'scope-active',
        clauses: [
          {
            id: 'clause-1',
            kind: 'dependency',
            blocking: true,
            description: 'Active node needs dependency visibility',
            status: 'failed',
          },
          {
            id: 'clause-2',
            kind: 'coverage',
            blocking: true,
            description: 'Second validation clause should be hidden by the limit',
            status: 'pending',
          },
        ],
      },
      satisfiable: false,
      blockingFindings: 1,
      pendingBlockingClauses: 1,
      createdAt: '2026-04-29T09:50:00.000Z',
    },
    recentEvents: [
      {
        id: 'event-1',
        sessionId: 'session-1',
        scopeId: 'scope-active',
        type: 'validation-recorded',
        occurredAt: '2026-04-29T09:50:00.000Z',
        payload: {
          validationId: 'validation-1',
          scopeId: 'scope-active',
          satisfiable: false,
          blockingFindings: 1,
          pendingBlockingClauses: 1,
          clauseCount: 2,
        },
      },
      {
        id: 'event-2',
        sessionId: 'session-1',
        nodeId: 'node-active',
        type: 'node-created',
        occurredAt: '2026-04-29T09:20:00.000Z',
        payload: {
          title: 'Active inspection node',
          problemStatement: 'Expose bounded active detail',
          category: 'cross-cutting',
          status: 'active',
        },
      },
    ],
  };
}
