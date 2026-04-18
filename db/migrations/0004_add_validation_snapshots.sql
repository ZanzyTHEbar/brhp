CREATE TABLE IF NOT EXISTS planner_validation_snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES planner_sessions(id) ON DELETE CASCADE,
  scope_id TEXT NOT NULL REFERENCES planner_scopes(id) ON DELETE CASCADE,
  satisfiable INTEGER NOT NULL CHECK (satisfiable IN (0, 1)),
  blocking_findings INTEGER NOT NULL,
  pending_blocking_clauses INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS planner_validation_snapshots_scope_idx
  ON planner_validation_snapshots(scope_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS planner_validation_clauses (
  snapshot_id TEXT NOT NULL REFERENCES planner_validation_snapshots(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  clause_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('schema', 'structure', 'dependency', 'conflict', 'coverage')),
  blocking INTEGER NOT NULL CHECK (blocking IN (0, 1)),
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'passed', 'failed', 'skipped')),
  message TEXT,
  PRIMARY KEY (snapshot_id, ordinal)
);
