# BRHP operator contract

This document freezes the current BRHP operator and read-model contract. It defines what users and future BRHP features can rely on, and it also names what remains internal so later work does not accidentally treat implementation details as public API.

The freeze applies to the current single-active-session runtime after `/brhp history`, `/brhp status` diagnostics, and `/brhp inspect` landed.

## Stable operator surfaces

The supported slash-command surface is:

| Surface | Contract |
| --- | --- |
| `/brhp` | Alias for `/brhp status`. |
| `/brhp status` | Compact active-session summary, instruction inventory, skipped-file summary, and stack-free runtime diagnostics. |
| `/brhp history` | Newest-first active-session event history, bounded to 25 planner events. |
| `/brhp inspect` | Bounded active-session drill-down over graph, active scope, frontier, validation, focus nodes, edges, and recent activity. |
| `/brhp plan <problem statement>` | Creates a planning session for the current OpenCode chat and worktree. |
| `/brhp resume <session id>` | Activates an existing session in the current worktree for the current OpenCode chat. |

The TUI sidebar is a compact read-only summary surface. It is stable as a summary, not as a route-heavy navigation contract.

## Stable read-model concepts

Operator read surfaces expose read-only projections of the active planning state. These concepts are stable enough for docs, tests, and future feature design:

- session identity, status, revision, active scope, root node, and initial problem
- graph counts for scopes, nodes, and edges
- active-scope title, question, depth, status, and root-node reference
- frontier selection count, top selections, probabilities, utility, entropy, and validation pressure
- validation satisfiability, blocking findings, pending blocking clauses, and bounded clause detail
- focus-node summaries with status, title, category, scope, depth, utility, confidence, and validation pressure
- edge summaries with kind and endpoint references
- recent activity labels and newest-first event history
- runtime diagnostic categories for instruction loading, planner runtime loading, and unknown runtime state

Current bounds:

| Surface | Bound |
| --- | --- |
| `/brhp history` | 25 newest planner events. |
| `/brhp inspect` frontier selections | 5 selections. |
| `/brhp inspect` validation clauses | 10 clauses. |
| `/brhp inspect` focus nodes | 10 nodes. |
| `/brhp inspect` edge samples | 10 edges. |
| `/brhp inspect` recent activity | 10 events already carried by the active planning state. |

These are the current default maximum display bounds. Operator output must stay bounded and no less informative without an explicit contract update. Exact Markdown formatting is not a machine API and may change as long as the same concepts remain visible and stack-free.

## Stable planner tool surface

The planner tool surface remains intentionally narrow:

| Tool | Contract |
| --- | --- |
| `brhp_get_active_plan` | Reads the authoritative active planning state for the current OpenCode chat/worktree. |
| `brhp_decompose_node` | Decomposes one active-session node into child nodes and refreshes the frontier. |
| `brhp_validate_active_scope` | Persists a deterministic validation verdict for the active scope and refreshes planner state. |

`brhp_get_active_plan` is stable as a read capability, not as a versioned JSON schema. Until a versioned machine-readable schema exists, only the read-model concepts listed above are stable.

Do not add aggregated mutation tools until the current mutation contracts have stopped moving and there is clear operator/tooling pain that justifies consolidation.

## Internal surfaces

The following are not public contracts:

- SQLite/libsql table and column shape
- `PlanningState`, `PlanningSession`, and graph TypeScript interface details beyond the read concepts listed above
- exact Markdown line ordering or punctuation in slash-command output
- event payload JSON shape beyond the stable event categories shown by `/brhp history`
- frontier scoring and ranking implementation details
- runtime lifecycle ownership for server and TUI plugin internals
- OpenCode worktree/session resolution internals
- policy-document provenance, which remains deferred for BRHP v1
- recursive scope mutation semantics beyond the currently surfaced graph/read model
- multi-session concurrency behavior beyond the current single-active-session model

## Promotion gates

Near-term work can move only when its prerequisites are met.

### Graph visualization UI

Promote after the current read-model contract is stable in practice. The first graph UI should be read-only and should mirror `/brhp inspect` concepts: scopes, nodes, edges, frontier overlays, validation overlays, and diagnostics. Do not start route-heavy TUI navigation first.

### Aggregated tool entries

Promote only after the three-tool surface demonstrates real friction. Consolidation must preserve auditability: operation kind, target node or scope, resulting revision, and frontier/validation effects.

### Config DSL

Promote after diagnostics, history, and inspect expose enough provenance to explain configuration effects. Initial config should cover safe operator/runtime preferences before provider routing, solver settings, or agent orchestration.

### Provider and model routing

Promote after a config DSL exists and diagnostics can explain selected provider/model, fallback behavior, and operation-level routing decisions.

### Multi-session concurrent editing

Promote after session selection, session listing, revision/conflict semantics, stale mutation handling, and operator-visible conflict diagnostics are explicit and tested.

## Deferred work

The following remain blocked until stronger orchestration, provenance, safety, and lifecycle contracts exist:

- recursive language-model agents
- plugin-internal job scheduler
- SAT/SMT/Z3 integration
- route-heavy TUI
- automatic code/action agent spawning
