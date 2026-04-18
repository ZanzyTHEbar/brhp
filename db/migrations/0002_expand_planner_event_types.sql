CREATE TABLE planner_events_v2 (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES planner_sessions(id) ON DELETE CASCADE,
  scope_id TEXT REFERENCES planner_scopes(id) ON DELETE SET NULL,
  node_id TEXT REFERENCES planner_nodes(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('session-created', 'scope-created', 'node-created', 'node-decomposed', 'edge-created', 'frontier-snapshotted', 'validation-recorded')),
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

INSERT INTO planner_events_v2 (id, session_id, scope_id, node_id, type, payload_json, occurred_at)
SELECT id, session_id, scope_id, node_id, type, payload_json, occurred_at
FROM planner_events;

DROP TABLE planner_events;

ALTER TABLE planner_events_v2 RENAME TO planner_events;

CREATE INDEX IF NOT EXISTS planner_events_session_idx
  ON planner_events(session_id, occurred_at, id);
