import type { Client } from '@libsql/client';

import type {
  PlanningNodeDecompositionPatch,
  PlanningValidationRecordPatch,
  PlanningLeafCompletionPatch,
  PlanningSessionContext,
  PlanningSessionQueryPort,
  PlanningSessionSeed,
  PlanningSessionStorePort,
} from '../../application/ports/planning-session-store-port.js';
import type { FrontierSnapshot, FrontierSelection } from '../../domain/planning/frontier.js';
import type { PlanEdge } from '../../domain/planning/plan-edge.js';
import type { PlanNode, PlanNodeCategory, PlanNodeStatus } from '../../domain/planning/plan-node.js';
import {
  RECENT_PLANNING_EVENTS_LIMIT,
  type PlanningEvent,
  type PlanningEventPayloadByType,
  type PlanningEventType,
} from '../../domain/planning/planning-event.js';
import type { PlanningSession, PlanningSessionStatus, PlanningState } from '../../domain/planning/planning-session.js';
import type { PlanningScope, PlanningScopeStatus } from '../../domain/planning/planning-scope.js';
import type {
  ValidationClause,
  ValidationClauseKind,
  ValidationClauseStatus,
  ValidationSnapshot,
} from '../../domain/planning/validation.js';
import {
  executePlannerQuery,
  executePlannerQueryWithRowsAffected,
  fetchPlannerQueryMany,
  fetchPlannerQueryOne,
  type LibsqlQueryRow,
} from './libsql-query-runtime.js';
import { loadPlannerQueryCatalog } from './planner-query-loader.js';

export class LibsqlPlanningSessionStore
  implements PlanningSessionStorePort, PlanningSessionQueryPort
{
  readonly #client: Client;
  readonly #queryCatalogPromise = loadPlannerQueryCatalog();

  constructor(client: Client) {
    this.#client = client;
  }

  async createSession(seed: PlanningSessionSeed): Promise<void> {
    validatePlanningSessionSeed(seed);

    const queries = await this.#queryCatalogPromise;
    const transaction = await this.#client.transaction('write');

    try {
      await executePlannerQuery(transaction, queries.DeactivatePlanningSessionsForContext, {
        updated_at: seed.session.updatedAt,
        worktree_path: seed.session.worktreePath,
        opencode_session_id: seed.session.opencodeSessionId,
      });

      await executePlannerQuery(transaction, queries.CreatePlanningSession, {
        id: seed.session.id,
        worktree_path: seed.session.worktreePath,
        opencode_session_id: seed.session.opencodeSessionId,
        initial_problem: seed.session.initialProblem,
        status: seed.session.status,
        active_scope_id: seed.session.activeScopeId,
        root_node_id: seed.session.rootNodeId,
        revision: seed.session.revision,
        temperature: seed.session.controls.temperature,
        top_p: seed.session.controls.topP,
        temperature_floor: seed.session.controls.temperatureFloor,
        temperature_ceiling: seed.session.controls.temperatureCeiling,
        min_depth_clamp: seed.session.controls.minDepthClamp,
        max_depth_clamp: seed.session.controls.maxDepthClamp,
        depth_clamp: seed.session.controls.depthClamp,
        global_entropy: seed.session.summary.globalEntropy,
        entropy_drift: seed.session.summary.entropyDrift,
        frontier_stability: seed.session.summary.frontierStability,
        blocking_findings: seed.session.summary.blockingFindings,
        pending_blocking_clauses: seed.session.summary.pendingBlockingClauses,
        converged: seed.session.summary.converged ? 1 : 0,
        last_frontier_updated_at: seed.session.summary.lastFrontierUpdatedAt,
        is_active: 1,
        created_at: seed.session.createdAt,
        updated_at: seed.session.updatedAt,
      });

      for (const documentId of seed.session.policy.policyDocumentIds) {
        await executePlannerQuery(transaction, queries.CreatePlanningSessionDocument, {
          session_id: seed.session.id,
          document_id: documentId,
          kind: 'policy',
        });
      }

      for (const documentId of seed.session.policy.instructionDocumentIds) {
        await executePlannerQuery(transaction, queries.CreatePlanningSessionDocument, {
          session_id: seed.session.id,
          document_id: documentId,
          kind: 'instruction',
        });
      }

      for (const [index, invariant] of seed.session.policy.invariants.entries()) {
        await executePlannerQuery(transaction, queries.CreatePlanningSessionInvariant, {
          session_id: seed.session.id,
          ordinal: index,
          invariant_text: invariant,
        });
      }

      for (const scope of seed.scopes) {
        await executePlannerQuery(transaction, queries.CreatePlanningScope, mapScopeArgs(scope));
      }

      for (const node of seed.nodes) {
        await executePlannerQuery(transaction, queries.CreatePlanningNode, mapNodeArgs(node));
      }

      for (const edge of seed.edges) {
        await executePlannerQuery(transaction, queries.CreatePlanningEdge, mapEdgeArgs(edge));
      }

      await executePlannerQuery(
        transaction,
        queries.CreatePlanningFrontierSnapshot,
        mapFrontierSnapshotArgs(seed.frontier)
      );

      for (const selection of seed.frontier.selections) {
        await executePlannerQuery(
          transaction,
          queries.CreatePlanningFrontierSelection,
          mapFrontierSelectionArgs(seed.frontier.id, selection)
        );
      }

      for (const event of seed.events) {
        await executePlannerQuery(transaction, queries.CreatePlanningEvent, {
          id: event.id,
          session_id: event.sessionId,
          scope_id: event.scopeId ?? null,
          node_id: event.nodeId ?? null,
          type: event.type,
          payload_json: JSON.stringify(event.payload),
          occurred_at: event.occurredAt,
        });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async activateSession(
    context: PlanningSessionContext,
    sessionId: string
  ): Promise<boolean> {
    const queries = await this.#queryCatalogPromise;
    const sessionRow = await fetchPlannerQueryOne(this.#client, queries.GetPlanningSessionByID, {
      worktree_path: context.worktreePath,
      id: sessionId,
    });

    if (!sessionRow) {
      return false;
    }

    const transaction = await this.#client.transaction('write');

    try {
      await executePlannerQuery(transaction, queries.DeactivatePlanningSessionsForContext, {
        updated_at: new Date().toISOString(),
        worktree_path: context.worktreePath,
        opencode_session_id: context.opencodeSessionId,
      });
      await executePlannerQuery(transaction, queries.ActivatePlanningSessionByID, {
        worktree_path: context.worktreePath,
        opencode_session_id: context.opencodeSessionId,
        updated_at: new Date().toISOString(),
        id: sessionId,
      });
      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async applyNodeDecomposition(patch: PlanningNodeDecompositionPatch): Promise<void> {
    const queries = await this.#queryCatalogPromise;
    const transaction = await this.#client.transaction('write');

    try {
      const updatedRows = await executePlannerQueryWithRowsAffected(
        transaction,
        queries.UpdatePlanningNodeStatus,
        {
        session_id: patch.session.id,
        id: patch.updatedParentNode.id,
        status: patch.updatedParentNode.status,
        validation_pressure: patch.updatedParentNode.scores.validationPressure,
        updated_at: patch.updatedParentNode.updatedAt,
          expected_status: patch.originalParentNode.status,
          expected_updated_at: patch.originalParentNode.updatedAt,
        }
      );

      if (updatedRows !== 1) {
        throw new Error(
          `Planning node '${patch.updatedParentNode.id}' could not be decomposed because it changed concurrently`
        );
      }

      for (const node of patch.childNodes) {
        await executePlannerQuery(transaction, queries.CreatePlanningNode, mapNodeArgs(node));
      }

      for (const edge of patch.edges) {
        await executePlannerQuery(transaction, queries.CreatePlanningEdge, mapEdgeArgs(edge));
      }

      await executePlannerQuery(
        transaction,
        queries.CreatePlanningFrontierSnapshot,
        mapFrontierSnapshotArgs(patch.frontier)
      );

      for (const selection of patch.frontier.selections) {
        await executePlannerQuery(
          transaction,
          queries.CreatePlanningFrontierSelection,
          mapFrontierSelectionArgs(patch.frontier.id, selection)
        );
      }

      for (const event of patch.events) {
        await executePlannerQuery(transaction, queries.CreatePlanningEvent, {
          id: event.id,
          session_id: event.sessionId,
          scope_id: event.scopeId ?? null,
          node_id: event.nodeId ?? null,
          type: event.type,
          payload_json: JSON.stringify(event.payload),
          occurred_at: event.occurredAt,
        });
      }

      const updatedSessionRows = await executePlannerQueryWithRowsAffected(
        transaction,
        queries.UpdatePlanningSessionSummary,
        {
          id: patch.session.id,
          next_revision: patch.session.revision,
          expected_revision: patch.previousSessionRevision,
          status: patch.session.status,
          global_entropy: patch.session.summary.globalEntropy,
          entropy_drift: patch.session.summary.entropyDrift,
          frontier_stability: patch.session.summary.frontierStability,
          blocking_findings: patch.session.summary.blockingFindings,
          pending_blocking_clauses: patch.session.summary.pendingBlockingClauses,
          converged: patch.session.summary.converged ? 1 : 0,
          last_frontier_updated_at: patch.session.summary.lastFrontierUpdatedAt,
          updated_at: patch.session.updatedAt,
        }
      );

      if (updatedSessionRows !== 1) {
        throw new Error(
          `Planning session '${patch.session.id}' changed concurrently while updating the summary`
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async applyValidationRecord(patch: PlanningValidationRecordPatch): Promise<void> {
    const queries = await this.#queryCatalogPromise;
    const transaction = await this.#client.transaction('write');

    try {
      await executePlannerQuery(transaction, queries.CreatePlanningValidationSnapshot, {
        id: patch.validation.id,
        session_id: patch.validation.sessionId,
        scope_id: patch.validation.scopeId,
        satisfiable: patch.validation.satisfiable ? 1 : 0,
        blocking_findings: patch.validation.blockingFindings,
        pending_blocking_clauses: patch.validation.pendingBlockingClauses,
        created_at: patch.validation.createdAt,
      });

      for (const [index, clause] of patch.validation.formula.clauses.entries()) {
        await executePlannerQuery(transaction, queries.CreatePlanningValidationClause, {
          snapshot_id: patch.validation.id,
          ordinal: index,
          clause_id: clause.id,
          kind: clause.kind,
          blocking: clause.blocking ? 1 : 0,
          description: clause.description,
          status: clause.status,
          message: clause.message ?? null,
        });
      }

      for (const node of patch.updatedNodes) {
        await executePlannerQuery(transaction, queries.UpdatePlanningNodeValidationPressure, {
          session_id: patch.session.id,
          id: node.id,
          validation_pressure: node.scores.validationPressure,
          updated_at: node.updatedAt,
        });
      }

      await executePlannerQuery(
        transaction,
        queries.CreatePlanningFrontierSnapshot,
        mapFrontierSnapshotArgs(patch.frontier)
      );

      for (const selection of patch.frontier.selections) {
        await executePlannerQuery(
          transaction,
          queries.CreatePlanningFrontierSelection,
          mapFrontierSelectionArgs(patch.frontier.id, selection)
        );
      }

      for (const event of patch.events) {
        await executePlannerQuery(transaction, queries.CreatePlanningEvent, {
          id: event.id,
          session_id: event.sessionId,
          scope_id: event.scopeId ?? null,
          node_id: event.nodeId ?? null,
          type: event.type,
          payload_json: JSON.stringify(event.payload),
          occurred_at: event.occurredAt,
        });
      }

      const updatedSessionRows = await executePlannerQueryWithRowsAffected(
        transaction,
        queries.UpdatePlanningSessionSummary,
        {
          id: patch.session.id,
          next_revision: patch.session.revision,
          expected_revision: patch.previousSessionRevision,
          status: patch.session.status,
          global_entropy: patch.session.summary.globalEntropy,
          entropy_drift: patch.session.summary.entropyDrift,
          frontier_stability: patch.session.summary.frontierStability,
          blocking_findings: patch.session.summary.blockingFindings,
          pending_blocking_clauses: patch.session.summary.pendingBlockingClauses,
          converged: patch.session.summary.converged ? 1 : 0,
          last_frontier_updated_at: patch.session.summary.lastFrontierUpdatedAt,
          updated_at: patch.session.updatedAt,
        }
      );

      if (updatedSessionRows !== 1) {
        throw new Error(
          `Planning session '${patch.session.id}' changed concurrently while recording validation`
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async applyLeafCompletion(patch: PlanningLeafCompletionPatch): Promise<void> {
    const queries = await this.#queryCatalogPromise;
    const transaction = await this.#client.transaction('write');

    try {
      for (const event of patch.events) {
        await executePlannerQuery(transaction, queries.CreatePlanningEvent, {
          id: event.id,
          session_id: event.sessionId,
          scope_id: event.scopeId ?? null,
          node_id: event.nodeId ?? null,
          type: event.type,
          payload_json: JSON.stringify(event.payload),
          occurred_at: event.occurredAt,
        });
      }

      const updatedSessionRows = await executePlannerQueryWithRowsAffected(
        transaction,
        queries.UpdatePlanningSessionSummary,
        {
          id: patch.session.id,
          next_revision: patch.session.revision,
          expected_revision: patch.previousSessionRevision,
          status: patch.session.status,
          global_entropy: patch.session.summary.globalEntropy,
          entropy_drift: patch.session.summary.entropyDrift,
          frontier_stability: patch.session.summary.frontierStability,
          blocking_findings: patch.session.summary.blockingFindings,
          pending_blocking_clauses: patch.session.summary.pendingBlockingClauses,
          converged: patch.session.summary.converged ? 1 : 0,
          last_frontier_updated_at: patch.session.summary.lastFrontierUpdatedAt,
          updated_at: patch.session.updatedAt,
        }
      );

      if (updatedSessionRows !== 1) {
        throw new Error(
          `Planning session '${patch.session.id}' changed concurrently while completing leaf node`
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getActiveSession(context: PlanningSessionContext): Promise<PlanningState | null> {
    const queries = await this.#queryCatalogPromise;
    const sessionRow = await fetchPlannerQueryOne(
      this.#client,
      queries.GetActivePlanningSessionByContext,
      {
        worktree_path: context.worktreePath,
        opencode_session_id: context.opencodeSessionId,
      }
    );

    if (!sessionRow) {
      return null;
    }

    return this.#hydratePlanningState(sessionRow);
  }

  async getSessionById(
    worktreePath: string,
    sessionId: string
  ): Promise<PlanningState | null> {
    const queries = await this.#queryCatalogPromise;
    const sessionRow = await fetchPlannerQueryOne(this.#client, queries.GetPlanningSessionByID, {
      worktree_path: worktreePath,
      id: sessionId,
    });

    if (!sessionRow) {
      return null;
    }

    return this.#hydratePlanningState(sessionRow);
  }

  async listSessions(worktreePath: string): Promise<readonly PlanningSession[]> {
    const queries = await this.#queryCatalogPromise;
    const sessionRows = await fetchPlannerQueryMany(
      this.#client,
      queries.ListPlanningSessionsByWorktree,
      {
        worktree_path: worktreePath,
      }
    );

    return Promise.all(sessionRows.map(row => this.#hydratePlanningSession(row)));
  }

  async listRecentEvents(sessionId: string, limit: number): Promise<readonly PlanningEvent[]> {
    const queries = await this.#queryCatalogPromise;
    const eventRows = await fetchPlannerQueryMany(this.#client, queries.ListRecentPlanningEventsBySession, {
      session_id: sessionId,
      limit_count: limit,
    });

    return eventRows.map(mapPlanningEventRow);
  }

  async #hydratePlanningState(sessionRow: LibsqlQueryRow): Promise<PlanningState> {
    const queries = await this.#queryCatalogPromise;
    const session = await this.#hydratePlanningSession(sessionRow);
    const [scopeRows, nodeRows, edgeRows, eventRows, frontierRow, validationRow] = await Promise.all([
      fetchPlannerQueryMany(this.#client, queries.ListPlanningScopesBySession, {
        session_id: session.id,
      }),
      fetchPlannerQueryMany(this.#client, queries.ListPlanningNodesBySession, {
        session_id: session.id,
      }),
      fetchPlannerQueryMany(this.#client, queries.ListPlanningEdgesBySession, {
        session_id: session.id,
      }),
      fetchPlannerQueryMany(this.#client, queries.ListRecentPlanningEventsBySession, {
        session_id: session.id,
        limit_count: RECENT_PLANNING_EVENTS_LIMIT,
      }),
      fetchPlannerQueryOne(this.#client, queries.GetLatestPlanningFrontierSnapshotBySession, {
        session_id: session.id,
      }),
      fetchPlannerQueryOne(this.#client, queries.GetLatestPlanningValidationSnapshotByScope, {
        scope_id: session.activeScopeId,
      }),
    ]);

    const frontier = frontierRow
      ? await this.#hydrateFrontierSnapshot(session.id, frontierRow)
      : undefined;
    const validation = validationRow
      ? await this.#hydrateValidationSnapshot(validationRow)
      : undefined;
    const recentEvents = eventRows.map(mapPlanningEventRow);

    return {
      session,
      graph: {
        scopes: scopeRows.map(mapScopeRow),
        nodes: nodeRows.map(mapNodeRow),
        edges: edgeRows.map(mapEdgeRow),
      },
      ...(recentEvents.length > 0 ? { recentEvents } : {}),
      ...(frontier ? { frontier } : {}),
      ...(validation ? { validation } : {}),
    };
  }

  async #hydratePlanningSession(sessionRow: LibsqlQueryRow): Promise<PlanningSession> {
    const queries = await this.#queryCatalogPromise;
    const [documentRows, invariantRows] = await Promise.all([
      fetchPlannerQueryMany(this.#client, queries.ListPlanningSessionDocuments, {
        session_id: readString(sessionRow, 'id'),
      }),
      fetchPlannerQueryMany(this.#client, queries.ListPlanningSessionInvariants, {
        session_id: readString(sessionRow, 'id'),
      }),
    ]);

    return mapSessionRow(sessionRow, documentRows, invariantRows);
  }

  async #hydrateFrontierSnapshot(
    sessionId: string,
    frontierRow: LibsqlQueryRow
  ): Promise<FrontierSnapshot> {
    const queries = await this.#queryCatalogPromise;
    const selectionRows = await fetchPlannerQueryMany(
      this.#client,
      queries.ListPlanningFrontierSelectionsBySnapshot,
      {
        snapshot_id: readString(frontierRow, 'id'),
      }
    );

    return {
      id: readString(frontierRow, 'id'),
      sessionId,
      scopeId: readString(frontierRow, 'scope_id'),
      temperature: readNumber(frontierRow, 'temperature'),
      globalEntropy: readNumber(frontierRow, 'global_entropy'),
      depthClamp: readNumber(frontierRow, 'depth_clamp'),
      selections: selectionRows.map(mapFrontierSelectionRow),
      createdAt: readString(frontierRow, 'created_at'),
    };
  }

  async #hydrateValidationSnapshot(validationRow: LibsqlQueryRow): Promise<ValidationSnapshot> {
    const queries = await this.#queryCatalogPromise;
    const clauseRows = await fetchPlannerQueryMany(
      this.#client,
      queries.ListPlanningValidationClausesBySnapshot,
      {
        snapshot_id: readString(validationRow, 'id'),
      }
    );

    return {
      id: readString(validationRow, 'id'),
      sessionId: readString(validationRow, 'session_id'),
      scopeId: readString(validationRow, 'scope_id'),
      formula: {
        scopeId: readString(validationRow, 'scope_id'),
        clauses: clauseRows.map(mapValidationClauseRow),
      },
      satisfiable: readBoolean(validationRow, 'satisfiable'),
      blockingFindings: readNumber(validationRow, 'blocking_findings'),
      pendingBlockingClauses: readNumber(validationRow, 'pending_blocking_clauses'),
      createdAt: readString(validationRow, 'created_at'),
    };
  }
}

function mapSessionArgs(session: PlanningSession) {
  return {
    id: session.id,
    worktree_path: session.worktreePath,
    initial_problem: session.initialProblem,
    status: session.status,
    active_scope_id: session.activeScopeId,
    root_node_id: session.rootNodeId,
    temperature: session.controls.temperature,
    top_p: session.controls.topP,
    temperature_floor: session.controls.temperatureFloor,
    temperature_ceiling: session.controls.temperatureCeiling,
    min_depth_clamp: session.controls.minDepthClamp,
    max_depth_clamp: session.controls.maxDepthClamp,
    depth_clamp: session.controls.depthClamp,
    global_entropy: session.summary.globalEntropy,
    entropy_drift: session.summary.entropyDrift,
    frontier_stability: session.summary.frontierStability,
    blocking_findings: session.summary.blockingFindings,
    pending_blocking_clauses: session.summary.pendingBlockingClauses,
    converged: session.summary.converged ? 1 : 0,
    last_frontier_updated_at: session.summary.lastFrontierUpdatedAt,
    is_active: 1,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

function mapScopeArgs(scope: PlanningScope) {
  return {
    id: scope.id,
    session_id: scope.sessionId,
    parent_scope_id: scope.parentScopeId ?? null,
    root_node_id: scope.rootNodeId,
    title: scope.title,
    question: scope.question,
    depth: scope.depth,
    status: scope.status,
    transfer_graph_delta_summary: scope.transferSummary?.graphDeltaSummary ?? null,
    transfer_scope_summary: scope.transferSummary?.scopeSummary ?? null,
    transfer_confidence: scope.transferSummary?.confidence ?? null,
    created_at: scope.createdAt,
    updated_at: scope.updatedAt,
  };
}

function mapNodeArgs(node: PlanNode) {
  return {
    id: node.id,
    session_id: node.sessionId,
    scope_id: node.scopeId,
    parent_node_id: node.parentNodeId ?? null,
    title: node.title,
    problem_statement: node.problemStatement,
    logical_form: node.logicalForm ?? null,
    category: node.category,
    status: node.status,
    depth: node.depth,
    rationale: node.rationale ?? null,
    utility: node.scores.utility,
    confidence: node.scores.confidence,
    local_entropy: node.scores.localEntropy,
    validation_pressure: node.scores.validationPressure,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
  };
}

function mapEdgeArgs(edge: PlanEdge) {
  return {
    id: edge.id,
    session_id: edge.sessionId,
    from_node_id: edge.fromNodeId,
    to_node_id: edge.toNodeId,
    kind: edge.kind,
    created_at: edge.createdAt,
  };
}

function mapFrontierSnapshotArgs(frontier: FrontierSnapshot) {
  return {
    id: frontier.id,
    session_id: frontier.sessionId,
    scope_id: frontier.scopeId,
    temperature: frontier.temperature,
    global_entropy: frontier.globalEntropy,
    depth_clamp: frontier.depthClamp,
    created_at: frontier.createdAt,
  };
}

function mapFrontierSelectionArgs(snapshotId: string, selection: FrontierSelection) {
  return {
    snapshot_id: snapshotId,
    node_id: selection.nodeId,
    scope_id: selection.scopeId,
    utility: selection.utility,
    local_entropy: selection.localEntropy,
    validation_pressure: selection.validationPressure,
    probability: selection.probability,
    rank: selection.rank,
    depth_clamp: selection.depthClamp,
  };
}

function mapSessionRow(
  row: LibsqlQueryRow,
  documentRows: readonly LibsqlQueryRow[],
  invariantRows: readonly LibsqlQueryRow[]
): PlanningSession {
  return {
    id: readString(row, 'id'),
    worktreePath: readString(row, 'worktree_path'),
    opencodeSessionId: readString(row, 'opencode_session_id'),
    initialProblem: readString(row, 'initial_problem'),
    status: readString(row, 'status') as PlanningSessionStatus,
    activeScopeId: readString(row, 'active_scope_id'),
    rootNodeId: readString(row, 'root_node_id'),
    revision: readNumber(row, 'revision'),
    controls: {
      temperature: readNumber(row, 'temperature'),
      topP: readNumber(row, 'top_p'),
      temperatureFloor: readNumber(row, 'temperature_floor'),
      temperatureCeiling: readNumber(row, 'temperature_ceiling'),
      minDepthClamp: readNumber(row, 'min_depth_clamp'),
      maxDepthClamp: readNumber(row, 'max_depth_clamp'),
      depthClamp: readNumber(row, 'depth_clamp'),
    },
    policy: {
      policyDocumentIds: documentRows
        .filter(document => readString(document, 'kind') === 'policy')
        .map(document => readString(document, 'document_id')),
      instructionDocumentIds: documentRows
        .filter(document => readString(document, 'kind') === 'instruction')
        .map(document => readString(document, 'document_id')),
      invariants: [...invariantRows]
        .sort(
          (left: LibsqlQueryRow, right: LibsqlQueryRow) =>
            readNumber(left, 'ordinal') - readNumber(right, 'ordinal')
        )
        .map(invariant => readString(invariant, 'invariant_text')),
    },
    summary: {
      globalEntropy: readNumber(row, 'global_entropy'),
      entropyDrift: readNumber(row, 'entropy_drift'),
      frontierStability: readNumber(row, 'frontier_stability'),
      blockingFindings: readNumber(row, 'blocking_findings'),
      pendingBlockingClauses: readNumber(row, 'pending_blocking_clauses'),
      converged: readBoolean(row, 'converged'),
      lastFrontierUpdatedAt: readString(row, 'last_frontier_updated_at'),
    },
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
  };
}

function mapScopeRow(row: LibsqlQueryRow): PlanningScope {
  const graphDeltaSummary = readNullableString(row, 'transfer_graph_delta_summary');
  const scopeSummary = readNullableString(row, 'transfer_scope_summary');
  const transferConfidence = readNullableNumber(row, 'transfer_confidence');
  const hasTransferSummary =
    graphDeltaSummary !== null || scopeSummary !== null || transferConfidence !== null;

  return {
    id: readString(row, 'id'),
    sessionId: readString(row, 'session_id'),
    rootNodeId: readString(row, 'root_node_id'),
    title: readString(row, 'title'),
    question: readString(row, 'question'),
    depth: readNumber(row, 'depth'),
    status: readString(row, 'status') as PlanningScopeStatus,
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
    ...(readNullableString(row, 'parent_scope_id') !== null
      ? { parentScopeId: readString(row, 'parent_scope_id') }
      : {}),
    ...(hasTransferSummary
      ? {
          transferSummary: {
            graphDeltaSummary: graphDeltaSummary ?? '',
            scopeSummary: scopeSummary ?? '',
            confidence: transferConfidence ?? 0,
          },
        }
      : {}),
  };
}

function mapNodeRow(row: LibsqlQueryRow): PlanNode {
  return {
    id: readString(row, 'id'),
    sessionId: readString(row, 'session_id'),
    scopeId: readString(row, 'scope_id'),
    title: readString(row, 'title'),
    problemStatement: readString(row, 'problem_statement'),
    category: readString(row, 'category') as PlanNodeCategory,
    status: readString(row, 'status') as PlanNodeStatus,
    depth: readNumber(row, 'depth'),
    scores: {
      utility: readNumber(row, 'utility'),
      confidence: readNumber(row, 'confidence'),
      localEntropy: readNumber(row, 'local_entropy'),
      validationPressure: readNumber(row, 'validation_pressure'),
    },
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
    ...(readNullableString(row, 'parent_node_id') !== null
      ? { parentNodeId: readString(row, 'parent_node_id') }
      : {}),
    ...(readNullableString(row, 'logical_form') !== null
      ? { logicalForm: readString(row, 'logical_form') }
      : {}),
    ...(readNullableString(row, 'rationale') !== null
      ? { rationale: readString(row, 'rationale') }
      : {}),
  };
}

function mapEdgeRow(row: LibsqlQueryRow): PlanEdge {
  return {
    id: readString(row, 'id'),
    sessionId: readString(row, 'session_id'),
    fromNodeId: readString(row, 'from_node_id'),
    toNodeId: readString(row, 'to_node_id'),
    kind: readString(row, 'kind') as PlanEdge['kind'],
    createdAt: readString(row, 'created_at'),
  };
}

function mapFrontierSelectionRow(row: LibsqlQueryRow): FrontierSelection {
  return {
    nodeId: readString(row, 'node_id'),
    scopeId: readString(row, 'scope_id'),
    utility: readNumber(row, 'utility'),
    localEntropy: readNumber(row, 'local_entropy'),
    validationPressure: readNumber(row, 'validation_pressure'),
    probability: readNumber(row, 'probability'),
    rank: readNumber(row, 'rank'),
    depthClamp: readNumber(row, 'depth_clamp'),
  };
}

function mapPlanningEventRow(row: LibsqlQueryRow): PlanningEvent {
  const type = readString(row, 'type') as PlanningEventType;
  const scopeId = readNullableString(row, 'scope_id');
  const nodeId = readNullableString(row, 'node_id');

  return {
    id: readString(row, 'id'),
    sessionId: readString(row, 'session_id'),
    ...(scopeId ? { scopeId } : {}),
    ...(nodeId ? { nodeId } : {}),
    type,
    payload: parsePlanningEventPayload(type, readString(row, 'payload_json')),
    occurredAt: readString(row, 'occurred_at'),
  } as PlanningEvent;
}

function mapValidationClauseRow(row: LibsqlQueryRow): ValidationClause {
  return {
    id: readString(row, 'clause_id'),
    kind: readString(row, 'kind') as ValidationClauseKind,
    blocking: readBoolean(row, 'blocking'),
    description: readString(row, 'description'),
    status: readString(row, 'status') as ValidationClauseStatus,
    ...(readNullableString(row, 'message') !== null
      ? { message: readString(row, 'message') }
      : {}),
  };
}

function readString(row: LibsqlQueryRow, key: string): string {
  const value = row[key];

  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    throw new Error(`Expected '${key}' to be a string but received nullish value`);
  }

  return String(value);
}

function readNullableString(row: LibsqlQueryRow, key: string): string | null {
  const value = row[key];

  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' ? value : String(value);
}

function readNumber(row: LibsqlQueryRow, key: string): number {
  const value = row[key];

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`Expected '${key}' to be numeric`);
}

function readNullableNumber(row: LibsqlQueryRow, key: string): number | null {
  const value = row[key];

  if (value === null || value === undefined) {
    return null;
  }

  return readNumber(row, key);
}

function readBoolean(row: LibsqlQueryRow, key: string): boolean {
  const value = row[key];

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'bigint') {
    return value !== 0n;
  }

  if (typeof value === 'string') {
    if (value === '0' || value.toLowerCase() === 'false') {
      return false;
    }

    if (value === '1' || value.toLowerCase() === 'true') {
      return true;
    }
  }

  throw new Error(`Expected '${key}' to be boolean-like`);
}

export function parsePlanningEventPayload<Type extends PlanningEventType>(
  type: Type,
  payloadJson: string
): PlanningEventPayloadByType[Type] {
  const payload = JSON.parse(payloadJson) as PlanningEvent['payload'];

  return payload as PlanningEventPayloadByType[Type];
}

function validatePlanningSessionSeed(seed: PlanningSessionSeed): void {
  const sessionId = seed.session.id;
  const scopeIds = new Set(seed.scopes.map(scope => scope.id));
  const nodeIds = new Set(seed.nodes.map(node => node.id));

  if (!scopeIds.has(seed.session.activeScopeId)) {
    throw new Error('Planning session seed activeScopeId does not reference an existing scope');
  }

  if (!nodeIds.has(seed.session.rootNodeId)) {
    throw new Error('Planning session seed rootNodeId does not reference an existing node');
  }

  for (const scope of seed.scopes) {
    if (scope.sessionId !== sessionId) {
      throw new Error('Planning scope sessionId does not match the seed session');
    }

    if (!nodeIds.has(scope.rootNodeId)) {
      throw new Error('Planning scope rootNodeId does not reference an existing node');
    }

    if (scope.parentScopeId && !scopeIds.has(scope.parentScopeId)) {
      throw new Error('Planning scope parentScopeId does not reference an existing scope');
    }
  }

  for (const node of seed.nodes) {
    if (node.sessionId !== sessionId) {
      throw new Error('Planning node sessionId does not match the seed session');
    }

    if (!scopeIds.has(node.scopeId)) {
      throw new Error('Planning node scopeId does not reference an existing scope');
    }

    if (node.parentNodeId && !nodeIds.has(node.parentNodeId)) {
      throw new Error('Planning node parentNodeId does not reference an existing node');
    }
  }

  for (const edge of seed.edges) {
    if (edge.sessionId !== sessionId) {
      throw new Error('Planning edge sessionId does not match the seed session');
    }

    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      throw new Error('Planning edge references a node that does not exist');
    }
  }

  if (seed.frontier.sessionId !== sessionId) {
    throw new Error('Planning frontier sessionId does not match the seed session');
  }

  if (!scopeIds.has(seed.frontier.scopeId)) {
    throw new Error('Planning frontier scopeId does not reference an existing scope');
  }

  for (const selection of seed.frontier.selections) {
    if (!nodeIds.has(selection.nodeId)) {
      throw new Error('Planning frontier selection nodeId does not reference an existing node');
    }

    if (!scopeIds.has(selection.scopeId)) {
      throw new Error('Planning frontier selection scopeId does not reference an existing scope');
    }
  }

  for (const event of seed.events) {
    if (event.sessionId !== sessionId) {
      throw new Error('Planning event sessionId does not match the seed session');
    }

    if (event.scopeId && !scopeIds.has(event.scopeId)) {
      throw new Error('Planning event scopeId does not reference an existing scope');
    }

    if (event.nodeId && !nodeIds.has(event.nodeId)) {
      throw new Error('Planning event nodeId does not reference an existing node');
    }
  }
}
