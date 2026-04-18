-- BRHP planner sqlc schema (SQLite / libSQL parser contract)
--
-- This file exists for sqlc parsing and query validation.
-- Runtime-specific libsql setup remains outside sqlc and will be handled by
-- handwritten adapters and startup migration logic.

CREATE TABLE IF NOT EXISTS planner_sessions (
    id TEXT PRIMARY KEY,
    worktree_path TEXT NOT NULL,
    opencode_session_id TEXT NOT NULL,
    initial_problem TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'exploring', 'validating', 'converged', 'archived')),
    active_scope_id TEXT NOT NULL,
    root_node_id TEXT NOT NULL,
    temperature REAL NOT NULL,
    top_p REAL NOT NULL,
    temperature_floor REAL NOT NULL,
    temperature_ceiling REAL NOT NULL,
    min_depth_clamp INTEGER NOT NULL,
    max_depth_clamp INTEGER NOT NULL,
    depth_clamp INTEGER NOT NULL,
    global_entropy REAL NOT NULL,
    entropy_drift REAL NOT NULL,
    frontier_stability REAL NOT NULL,
    blocking_findings INTEGER NOT NULL,
    pending_blocking_clauses INTEGER NOT NULL,
    converged BOOLEAN NOT NULL CHECK (converged IN (0, 1)),
    last_frontier_updated_at DATETIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS planner_sessions_one_active_per_worktree
ON planner_sessions(worktree_path, opencode_session_id)
WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS planner_sessions_worktree_updated_idx
ON planner_sessions(worktree_path, updated_at DESC);

CREATE INDEX IF NOT EXISTS planner_sessions_context_updated_idx
ON planner_sessions(worktree_path, opencode_session_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS planner_session_documents (
    session_id TEXT NOT NULL REFERENCES planner_sessions(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('policy', 'instruction')),
    PRIMARY KEY (session_id, kind, document_id)
);

CREATE TABLE IF NOT EXISTS planner_session_invariants (
    session_id TEXT NOT NULL REFERENCES planner_sessions(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    invariant_text TEXT NOT NULL,
    PRIMARY KEY (session_id, ordinal)
);

CREATE TABLE IF NOT EXISTS planner_scopes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES planner_sessions(id) ON DELETE CASCADE,
    parent_scope_id TEXT REFERENCES planner_scopes(id) ON DELETE SET NULL,
    root_node_id TEXT NOT NULL,
    title TEXT NOT NULL,
    question TEXT NOT NULL,
    depth INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'archived')),
    transfer_graph_delta_summary TEXT,
    transfer_scope_summary TEXT,
    transfer_confidence REAL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS planner_scopes_session_depth_idx
ON planner_scopes(session_id, depth, created_at);

CREATE TABLE IF NOT EXISTS planner_nodes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES planner_sessions(id) ON DELETE CASCADE,
    scope_id TEXT NOT NULL REFERENCES planner_scopes(id) ON DELETE CASCADE,
    parent_node_id TEXT REFERENCES planner_nodes(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    problem_statement TEXT NOT NULL,
    logical_form TEXT,
    category TEXT NOT NULL CHECK (category IN ('dependent', 'isolated', 'parallelizable', 'cross-cutting')),
    status TEXT NOT NULL CHECK (status IN ('proposed', 'active', 'decomposed', 'leaf', 'pruned', 'blocked')),
    depth INTEGER NOT NULL,
    rationale TEXT,
    utility REAL NOT NULL,
    confidence REAL NOT NULL,
    local_entropy REAL NOT NULL,
    validation_pressure REAL NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS planner_nodes_session_depth_idx
ON planner_nodes(session_id, depth, created_at);

CREATE INDEX IF NOT EXISTS planner_nodes_scope_status_idx
ON planner_nodes(scope_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS planner_edges (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES planner_sessions(id) ON DELETE CASCADE,
    from_node_id TEXT NOT NULL REFERENCES planner_nodes(id) ON DELETE CASCADE,
    to_node_id TEXT NOT NULL REFERENCES planner_nodes(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('decomposes-to', 'depends-on', 'blocks', 'parallelizes-with', 'cross-cuts')),
    created_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS planner_edges_session_idx
ON planner_edges(session_id, created_at, id);

CREATE TABLE IF NOT EXISTS planner_frontier_snapshots (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES planner_sessions(id) ON DELETE CASCADE,
    scope_id TEXT NOT NULL REFERENCES planner_scopes(id) ON DELETE CASCADE,
    temperature REAL NOT NULL,
    global_entropy REAL NOT NULL,
    depth_clamp INTEGER NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS planner_frontier_snapshots_session_idx
ON planner_frontier_snapshots(session_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS planner_frontier_selections (
    snapshot_id TEXT NOT NULL REFERENCES planner_frontier_snapshots(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL REFERENCES planner_nodes(id) ON DELETE CASCADE,
    scope_id TEXT NOT NULL REFERENCES planner_scopes(id) ON DELETE CASCADE,
    utility REAL NOT NULL,
    local_entropy REAL NOT NULL,
    validation_pressure REAL NOT NULL,
    probability REAL NOT NULL,
    rank INTEGER NOT NULL,
    depth_clamp INTEGER NOT NULL,
    PRIMARY KEY (snapshot_id, rank)
);

CREATE INDEX IF NOT EXISTS planner_frontier_selections_node_idx
ON planner_frontier_selections(node_id, probability DESC);

CREATE TABLE IF NOT EXISTS planner_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES planner_sessions(id) ON DELETE CASCADE,
    scope_id TEXT REFERENCES planner_scopes(id) ON DELETE SET NULL,
    node_id TEXT REFERENCES planner_nodes(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('session-created', 'scope-created', 'node-created', 'edge-created', 'frontier-snapshotted', 'validation-recorded')),
    payload_json JSON NOT NULL,
    occurred_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS planner_events_session_idx
ON planner_events(session_id, occurred_at, id);
