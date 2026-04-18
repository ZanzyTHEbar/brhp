import { describe, expect, it } from 'vitest';

import { parsePlannerQueryFile } from '../../src/adapters/libsql/planner-query-loader.js';

describe('parsePlannerQueryFile', () => {
  it('parses sqlc named queries and compiles sqlc.arg parameters to libsql placeholders', () => {
    const catalog = parsePlannerQueryFile(`
-- name: DeactivatePlanningSessionsForContext :exec
UPDATE planner_sessions
SET updated_at = sqlc.arg(updated_at)
WHERE worktree_path = sqlc.arg(worktree_path)
  AND opencode_session_id = sqlc.arg(opencode_session_id);

-- name: CreatePlanningSession :exec
INSERT INTO planner_sessions (id, opencode_session_id)
VALUES (sqlc.arg(id), sqlc.arg(opencode_session_id));

-- name: CreatePlanningSessionDocument :exec
INSERT INTO planner_session_documents (session_id, document_id, kind)
VALUES (sqlc.arg(session_id), sqlc.arg(document_id), sqlc.arg(kind));

-- name: CreatePlanningSessionInvariant :exec
INSERT INTO planner_session_invariants (session_id, ordinal, invariant_text)
VALUES (sqlc.arg(session_id), sqlc.arg(ordinal), sqlc.arg(invariant_text));

-- name: CreatePlanningScope :exec
INSERT INTO planner_scopes (id) VALUES (sqlc.arg(id));

-- name: CreatePlanningNode :exec
INSERT INTO planner_nodes (id) VALUES (sqlc.arg(id));

-- name: CreatePlanningEdge :exec
INSERT INTO planner_edges (id) VALUES (sqlc.arg(id));

-- name: CreatePlanningFrontierSnapshot :exec
INSERT INTO planner_frontier_snapshots (id) VALUES (sqlc.arg(id));

-- name: CreatePlanningFrontierSelection :exec
INSERT INTO planner_frontier_selections (snapshot_id, rank)
VALUES (sqlc.arg(snapshot_id), sqlc.arg(rank));

-- name: CreatePlanningEvent :exec
INSERT INTO planner_events (id) VALUES (sqlc.arg(id));

-- name: UpdatePlanningNodeStatus :exec
UPDATE planner_nodes SET status = sqlc.arg(status) WHERE session_id = sqlc.arg(session_id) AND id = sqlc.arg(id);

-- name: UpdatePlanningSessionSummary :exec
UPDATE planner_sessions SET status = sqlc.arg(status) WHERE id = sqlc.arg(id);

-- name: ListPlanningSessionsByWorktree :many
SELECT id FROM planner_sessions WHERE worktree_path = sqlc.arg(worktree_path);

-- name: GetActivePlanningSessionByContext :one
SELECT id FROM planner_sessions
WHERE worktree_path = sqlc.arg(worktree_path)
  AND opencode_session_id = sqlc.arg(opencode_session_id)
LIMIT 1;

-- name: GetPlanningSessionByID :one
SELECT id FROM planner_sessions
WHERE worktree_path = sqlc.arg(worktree_path)
  AND id = sqlc.arg(id)
LIMIT 1;

-- name: ActivatePlanningSessionByID :exec
UPDATE planner_sessions
SET opencode_session_id = sqlc.arg(opencode_session_id)
WHERE worktree_path = sqlc.arg(worktree_path)
  AND id = sqlc.arg(id);

-- name: ListPlanningSessionDocuments :many
SELECT document_id FROM planner_session_documents WHERE session_id = sqlc.arg(session_id);

-- name: ListPlanningSessionInvariants :many
SELECT invariant_text FROM planner_session_invariants WHERE session_id = sqlc.arg(session_id);

-- name: ListPlanningScopesBySession :many
SELECT id FROM planner_scopes WHERE session_id = sqlc.arg(session_id);

-- name: ListPlanningNodesBySession :many
SELECT id FROM planner_nodes WHERE session_id = sqlc.arg(session_id);

-- name: ListPlanningEdgesBySession :many
SELECT id FROM planner_edges WHERE session_id = sqlc.arg(session_id);

-- name: ListPlanningEventsBySession :many
SELECT id FROM planner_events WHERE session_id = sqlc.arg(session_id);

-- name: GetLatestPlanningFrontierSnapshotBySession :one
SELECT id FROM planner_frontier_snapshots WHERE session_id = sqlc.arg(session_id) LIMIT 1;

-- name: ListPlanningFrontierSelectionsBySnapshot :many
SELECT node_id FROM planner_frontier_selections WHERE snapshot_id = sqlc.arg(snapshot_id);
`);

    expect(catalog.GetActivePlanningSessionByContext.command).toBe('one');
    expect(catalog.GetActivePlanningSessionByContext.sql).toContain(
      'worktree_path = :worktree_path'
    );
    expect(catalog.GetActivePlanningSessionByContext.parameterNames).toEqual([
      'worktree_path',
      'opencode_session_id',
    ]);
    expect(catalog.CreatePlanningSessionDocument.sql).toContain(':document_id');
  });

  it('rejects unsupported sqlc helpers', () => {
    expect(() =>
      parsePlannerQueryFile(`
-- name: DeactivatePlanningSessionsForContext :exec
SELECT sqlc.narg(foo);

-- name: CreatePlanningSession :exec
SELECT 1;

-- name: CreatePlanningSessionDocument :exec
SELECT 1;

-- name: CreatePlanningSessionInvariant :exec
SELECT 1;

-- name: CreatePlanningScope :exec
SELECT 1;

-- name: CreatePlanningNode :exec
SELECT 1;

-- name: CreatePlanningEdge :exec
SELECT 1;

-- name: CreatePlanningFrontierSnapshot :exec
SELECT 1;

-- name: CreatePlanningFrontierSelection :exec
SELECT 1;

-- name: CreatePlanningEvent :exec
SELECT 1;

-- name: UpdatePlanningNodeStatus :exec
SELECT 1;

-- name: UpdatePlanningSessionSummary :exec
SELECT 1;

-- name: ListPlanningSessionsByWorktree :many
SELECT 1;

-- name: GetActivePlanningSessionByContext :one
SELECT 1 LIMIT 1;

-- name: GetPlanningSessionByID :one
SELECT 1 LIMIT 1;

-- name: ActivatePlanningSessionByID :exec
SELECT 1 LIMIT 1;

-- name: ListPlanningSessionDocuments :many
SELECT 1;

-- name: ListPlanningSessionInvariants :many
SELECT 1;

-- name: ListPlanningScopesBySession :many
SELECT 1;

-- name: ListPlanningNodesBySession :many
SELECT 1;

-- name: ListPlanningEdgesBySession :many
SELECT 1;

-- name: ListPlanningEventsBySession :many
SELECT 1;

-- name: GetLatestPlanningFrontierSnapshotBySession :one
SELECT 1 LIMIT 1;

-- name: ListPlanningFrontierSelectionsBySnapshot :many
SELECT 1;
`)
    ).toThrow('unsupported sqlc helpers');
  });
});
