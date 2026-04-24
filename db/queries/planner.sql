-- name: DeactivatePlanningSessionsForContext :exec
UPDATE planner_sessions
SET is_active = 0,
    updated_at = sqlc.arg(updated_at)
WHERE worktree_path = sqlc.arg(worktree_path)
  AND opencode_session_id = sqlc.arg(opencode_session_id)
  AND is_active = 1;

-- name: CreatePlanningSession :exec
INSERT INTO planner_sessions (
    id,
    worktree_path,
    opencode_session_id,
    initial_problem,
    status,
    active_scope_id,
    root_node_id,
    revision,
    temperature,
    top_p,
    temperature_floor,
    temperature_ceiling,
    min_depth_clamp,
    max_depth_clamp,
    depth_clamp,
    global_entropy,
    entropy_drift,
    frontier_stability,
    blocking_findings,
    pending_blocking_clauses,
    converged,
    last_frontier_updated_at,
    is_active,
    created_at,
    updated_at
) VALUES (
    sqlc.arg(id),
    sqlc.arg(worktree_path),
    sqlc.arg(opencode_session_id),
    sqlc.arg(initial_problem),
    sqlc.arg(status),
    sqlc.arg(active_scope_id),
    sqlc.arg(root_node_id),
    sqlc.arg(revision),
    sqlc.arg(temperature),
    sqlc.arg(top_p),
    sqlc.arg(temperature_floor),
    sqlc.arg(temperature_ceiling),
    sqlc.arg(min_depth_clamp),
    sqlc.arg(max_depth_clamp),
    sqlc.arg(depth_clamp),
    sqlc.arg(global_entropy),
    sqlc.arg(entropy_drift),
    sqlc.arg(frontier_stability),
    sqlc.arg(blocking_findings),
    sqlc.arg(pending_blocking_clauses),
    sqlc.arg(converged),
    sqlc.arg(last_frontier_updated_at),
    sqlc.arg(is_active),
    sqlc.arg(created_at),
    sqlc.arg(updated_at)
);

-- name: CreatePlanningSessionDocument :exec
INSERT INTO planner_session_documents (
    session_id,
    document_id,
    kind
) VALUES (
    sqlc.arg(session_id),
    sqlc.arg(document_id),
    sqlc.arg(kind)
);

-- name: CreatePlanningSessionInvariant :exec
INSERT INTO planner_session_invariants (
    session_id,
    ordinal,
    invariant_text
) VALUES (
    sqlc.arg(session_id),
    sqlc.arg(ordinal),
    sqlc.arg(invariant_text)
);

-- name: CreatePlanningScope :exec
INSERT INTO planner_scopes (
    id,
    session_id,
    parent_scope_id,
    root_node_id,
    title,
    question,
    depth,
    status,
    transfer_graph_delta_summary,
    transfer_scope_summary,
    transfer_confidence,
    created_at,
    updated_at
) VALUES (
    sqlc.arg(id),
    sqlc.arg(session_id),
    sqlc.arg(parent_scope_id),
    sqlc.arg(root_node_id),
    sqlc.arg(title),
    sqlc.arg(question),
    sqlc.arg(depth),
    sqlc.arg(status),
    sqlc.arg(transfer_graph_delta_summary),
    sqlc.arg(transfer_scope_summary),
    sqlc.arg(transfer_confidence),
    sqlc.arg(created_at),
    sqlc.arg(updated_at)
);

-- name: CreatePlanningNode :exec
INSERT INTO planner_nodes (
    id,
    session_id,
    scope_id,
    parent_node_id,
    title,
    problem_statement,
    logical_form,
    category,
    status,
    depth,
    rationale,
    utility,
    confidence,
    local_entropy,
    validation_pressure,
    created_at,
    updated_at
) VALUES (
    sqlc.arg(id),
    sqlc.arg(session_id),
    sqlc.arg(scope_id),
    sqlc.arg(parent_node_id),
    sqlc.arg(title),
    sqlc.arg(problem_statement),
    sqlc.arg(logical_form),
    sqlc.arg(category),
    sqlc.arg(status),
    sqlc.arg(depth),
    sqlc.arg(rationale),
    sqlc.arg(utility),
    sqlc.arg(confidence),
    sqlc.arg(local_entropy),
    sqlc.arg(validation_pressure),
    sqlc.arg(created_at),
    sqlc.arg(updated_at)
);

-- name: CreatePlanningEdge :exec
INSERT INTO planner_edges (
    id,
    session_id,
    from_node_id,
    to_node_id,
    kind,
    created_at
) VALUES (
    sqlc.arg(id),
    sqlc.arg(session_id),
    sqlc.arg(from_node_id),
    sqlc.arg(to_node_id),
    sqlc.arg(kind),
    sqlc.arg(created_at)
);

-- name: CreatePlanningFrontierSnapshot :exec
INSERT INTO planner_frontier_snapshots (
    id,
    session_id,
    scope_id,
    temperature,
    global_entropy,
    depth_clamp,
    created_at
) VALUES (
    sqlc.arg(id),
    sqlc.arg(session_id),
    sqlc.arg(scope_id),
    sqlc.arg(temperature),
    sqlc.arg(global_entropy),
    sqlc.arg(depth_clamp),
    sqlc.arg(created_at)
);

-- name: CreatePlanningFrontierSelection :exec
INSERT INTO planner_frontier_selections (
    snapshot_id,
    node_id,
    scope_id,
    utility,
    local_entropy,
    validation_pressure,
    probability,
    rank,
    depth_clamp
) VALUES (
    sqlc.arg(snapshot_id),
    sqlc.arg(node_id),
    sqlc.arg(scope_id),
    sqlc.arg(utility),
    sqlc.arg(local_entropy),
    sqlc.arg(validation_pressure),
    sqlc.arg(probability),
    sqlc.arg(rank),
    sqlc.arg(depth_clamp)
);

-- name: CreatePlanningEvent :exec
INSERT INTO planner_events (
    id,
    session_id,
    scope_id,
    node_id,
    type,
    payload_json,
    occurred_at
) VALUES (
    sqlc.arg(id),
    sqlc.arg(session_id),
    sqlc.arg(scope_id),
    sqlc.arg(node_id),
    sqlc.arg(type),
    sqlc.arg(payload_json),
    sqlc.arg(occurred_at)
);

-- name: CreatePlanningValidationSnapshot :exec
INSERT INTO planner_validation_snapshots (
    id,
    session_id,
    scope_id,
    satisfiable,
    blocking_findings,
    pending_blocking_clauses,
    created_at
) VALUES (
    sqlc.arg(id),
    sqlc.arg(session_id),
    sqlc.arg(scope_id),
    sqlc.arg(satisfiable),
    sqlc.arg(blocking_findings),
    sqlc.arg(pending_blocking_clauses),
    sqlc.arg(created_at)
);

-- name: CreatePlanningValidationClause :exec
INSERT INTO planner_validation_clauses (
    snapshot_id,
    ordinal,
    clause_id,
    kind,
    blocking,
    description,
    status,
    message
) VALUES (
    sqlc.arg(snapshot_id),
    sqlc.arg(ordinal),
    sqlc.arg(clause_id),
    sqlc.arg(kind),
    sqlc.arg(blocking),
    sqlc.arg(description),
    sqlc.arg(status),
    sqlc.arg(message)
);

-- name: UpdatePlanningNodeStatus :exec
UPDATE planner_nodes
SET status = sqlc.arg(status),
    validation_pressure = sqlc.arg(validation_pressure),
    updated_at = sqlc.arg(updated_at)
WHERE session_id = sqlc.arg(session_id)
  AND id = sqlc.arg(id)
  AND status = sqlc.arg(expected_status)
  AND updated_at = sqlc.arg(expected_updated_at);

-- name: UpdatePlanningNodeValidationPressure :exec
UPDATE planner_nodes
SET validation_pressure = sqlc.arg(validation_pressure),
    updated_at = sqlc.arg(updated_at)
WHERE session_id = sqlc.arg(session_id)
  AND id = sqlc.arg(id);

-- name: UpdatePlanningSessionSummary :exec
UPDATE planner_sessions
SET revision = sqlc.arg(next_revision),
    status = sqlc.arg(status),
    global_entropy = sqlc.arg(global_entropy),
    entropy_drift = sqlc.arg(entropy_drift),
    frontier_stability = sqlc.arg(frontier_stability),
    blocking_findings = sqlc.arg(blocking_findings),
    pending_blocking_clauses = sqlc.arg(pending_blocking_clauses),
    converged = sqlc.arg(converged),
    last_frontier_updated_at = sqlc.arg(last_frontier_updated_at),
    updated_at = sqlc.arg(updated_at)
WHERE id = sqlc.arg(id)
  AND revision = sqlc.arg(expected_revision);

-- name: ListPlanningSessionsByWorktree :many
SELECT id,
       worktree_path,
       opencode_session_id,
       initial_problem,
       status,
       active_scope_id,
       root_node_id,
       revision,
       temperature,
       top_p,
       temperature_floor,
       temperature_ceiling,
       min_depth_clamp,
       max_depth_clamp,
       depth_clamp,
       global_entropy,
       entropy_drift,
       frontier_stability,
       blocking_findings,
       pending_blocking_clauses,
       converged,
       last_frontier_updated_at,
       is_active,
       created_at,
       updated_at
FROM planner_sessions
WHERE worktree_path = sqlc.arg(worktree_path)
ORDER BY updated_at DESC, id DESC;

-- name: GetActivePlanningSessionByContext :one
SELECT id,
       worktree_path,
       opencode_session_id,
       initial_problem,
       status,
       active_scope_id,
       root_node_id,
       revision,
       temperature,
       top_p,
       temperature_floor,
       temperature_ceiling,
       min_depth_clamp,
       max_depth_clamp,
       depth_clamp,
       global_entropy,
       entropy_drift,
       frontier_stability,
       blocking_findings,
       pending_blocking_clauses,
       converged,
       last_frontier_updated_at,
       is_active,
       created_at,
       updated_at
FROM planner_sessions
WHERE worktree_path = sqlc.arg(worktree_path)
  AND opencode_session_id = sqlc.arg(opencode_session_id)
  AND is_active = 1
ORDER BY updated_at DESC, id DESC
LIMIT 1;

-- name: GetPlanningSessionByID :one
SELECT id,
       worktree_path,
       opencode_session_id,
       initial_problem,
       status,
       active_scope_id,
       root_node_id,
       revision,
       temperature,
       top_p,
       temperature_floor,
       temperature_ceiling,
       min_depth_clamp,
       max_depth_clamp,
       depth_clamp,
       global_entropy,
       entropy_drift,
       frontier_stability,
       blocking_findings,
       pending_blocking_clauses,
       converged,
       last_frontier_updated_at,
       is_active,
       created_at,
       updated_at
FROM planner_sessions
WHERE worktree_path = sqlc.arg(worktree_path)
  AND id = sqlc.arg(id)
LIMIT 1;

-- name: ActivatePlanningSessionByID :exec
UPDATE planner_sessions
SET opencode_session_id = sqlc.arg(opencode_session_id),
    is_active = 1,
    updated_at = sqlc.arg(updated_at)
WHERE worktree_path = sqlc.arg(worktree_path)
  AND id = sqlc.arg(id);

-- name: ListPlanningSessionDocuments :many
SELECT session_id,
       document_id,
       kind
FROM planner_session_documents
WHERE session_id = sqlc.arg(session_id)
ORDER BY kind ASC, document_id ASC;

-- name: ListPlanningSessionInvariants :many
SELECT session_id,
       ordinal,
       invariant_text
FROM planner_session_invariants
WHERE session_id = sqlc.arg(session_id)
ORDER BY ordinal ASC;

-- name: ListPlanningScopesBySession :many
SELECT id,
       session_id,
       parent_scope_id,
       root_node_id,
       title,
       question,
       depth,
       status,
       transfer_graph_delta_summary,
       transfer_scope_summary,
       transfer_confidence,
       created_at,
       updated_at
FROM planner_scopes
WHERE session_id = sqlc.arg(session_id)
ORDER BY depth ASC, created_at ASC, id ASC;

-- name: ListPlanningNodesBySession :many
SELECT id,
       session_id,
       scope_id,
       parent_node_id,
       title,
       problem_statement,
       logical_form,
       category,
       status,
       depth,
       rationale,
       utility,
       confidence,
       local_entropy,
       validation_pressure,
       created_at,
       updated_at
FROM planner_nodes
WHERE session_id = sqlc.arg(session_id)
ORDER BY depth ASC, created_at ASC, id ASC;

-- name: ListPlanningEdgesBySession :many
SELECT id,
       session_id,
       from_node_id,
       to_node_id,
       kind,
       created_at
FROM planner_edges
WHERE session_id = sqlc.arg(session_id)
ORDER BY created_at ASC, id ASC;

-- name: ListRecentPlanningEventsBySession :many
SELECT id,
       session_id,
       scope_id,
       node_id,
       type,
       payload_json,
       occurred_at
FROM planner_events
WHERE session_id = sqlc.arg(session_id)
ORDER BY occurred_at DESC, rowid DESC
LIMIT sqlc.arg(limit_count);

-- name: GetLatestPlanningFrontierSnapshotBySession :one
SELECT id,
       session_id,
       scope_id,
       temperature,
       global_entropy,
       depth_clamp,
       created_at
FROM planner_frontier_snapshots
WHERE session_id = sqlc.arg(session_id)
ORDER BY created_at DESC, rowid DESC
LIMIT 1;

-- name: ListPlanningFrontierSelectionsBySnapshot :many
SELECT snapshot_id,
       node_id,
       scope_id,
       utility,
       local_entropy,
       validation_pressure,
       probability,
       rank,
       depth_clamp
FROM planner_frontier_selections
WHERE snapshot_id = sqlc.arg(snapshot_id)
ORDER BY rank ASC;

-- name: GetLatestPlanningValidationSnapshotByScope :one
SELECT id,
       session_id,
       scope_id,
       satisfiable,
       blocking_findings,
       pending_blocking_clauses,
       created_at
FROM planner_validation_snapshots
WHERE scope_id = sqlc.arg(scope_id)
ORDER BY created_at DESC, rowid DESC
LIMIT 1;

-- name: ListPlanningValidationClausesBySnapshot :many
SELECT snapshot_id,
       ordinal,
       clause_id,
       kind,
       blocking,
       description,
       status,
       message
FROM planner_validation_clauses
WHERE snapshot_id = sqlc.arg(snapshot_id)
ORDER BY ordinal ASC;
