# BRHP curated backlog

## Active next batches

This file is a curated engineering backlog, not a release promise. Deferred roadmap items below are intentionally out of current scope.

1. Active local batch: read-only graph visualization UI scoping
   - tracked in saga task `40`
   - first slice must mirror `/brhp inspect` concepts: scopes, nodes, edges, frontier overlays, validation overlays, and diagnostics
   - keep the UI read-only; do not add route-heavy navigation, planner mutations, or new planner tools
   - first sidebar graph preview slice is in review/validation; finish hardening before checkpointing

2. Passive external follow-ups
   - official OpenCode PR `anomalyco/opencode#25109` and `awesome-opencode#327` only need action if reviewer feedback arrives
   - opencode.cafe submission is complete
   - npm publication is explicitly deferred; clean npm-install smoke and README npm-install guidance remain deferred until publication resumes

## Landed foundation

- scaffolded OpenCode `v1.4.0+` server + TUI plugin baseline
- BRHP formal planning domain and math primitives
- local libsql planner persistence with sqlc-validated SQLite contract files
- `/brhp` runtime wiring for `status`, `plan`, and `resume`
- narrow planner tool surface:
  - `brhp_get_active_plan`
  - `brhp_decompose_node`
  - `brhp_validate_active_scope`
- deterministic validation snapshot persistence
- frontier recomputation and validation-aware selection pressure
- runtime convergence derived from current planner state plus explicit decomposition evidence and passed blocking coverage closure
- server runtime access hardened with per-operation lifecycle management
- TUI runtime ownership hardened with explicit disposal and failure-path cleanup
- recent planner activity surfaced in `/brhp`, active-plan JSON, and the sidebar
- `/brhp history` now exposes a deeper bounded recent event log for the active session while summary surfaces remain compact
- sidebar load diagnostics now distinguish BRHP instruction-load failures from planner-runtime failures
- `/brhp status` now mirrors instruction-load vs planner-runtime diagnostics, preserves internal causes for future operator inspection, and keeps user-facing output stack-free
- `/brhp inspect` now exposes bounded graph, frontier, validation, focus-node, edge, and recent-activity drill-down for the active session without widening planner tools
- `docs/operator-contract.md` freezes the current read-model and operator-surface contract, including non-contract internals and promotion gates for deferred work
- state-contract freeze / backlog checkpoint completed after launch publication was deferred or handed off
- package readiness is hardened with server/TUI export verification, packed-artifact smoke tests, local `file://` install guidance, and prerelease npm-publish guardrails
- official OpenCode ecosystem PR and `awesome-opencode` listing PR are passive external follow-ups; opencode.cafe submission is complete and npm publication is deferred

## Near-term promotion candidates

These items can move forward only after the state-contract checkpoint closes and the prerequisites in `docs/operator-contract.md` are satisfied.

- aggregated tool entries / multi-operation tool consolidation
  - promote only after planner mutation contracts stop moving and operator pain justifies consolidation
- config DSL
  - promote only after diagnostics/history/provenance surfaces stabilize into a real configuration contract
- provider/model routing
  - promote only after config DSL exists and runtime diagnostics provide enough signal to justify routing
- multi-session concurrent editing
  - promote only after session ownership, conflict-resolution, and operator drill-down/session-selection contracts are explicit

## Deferred advanced roadmap

These items remain intentionally out of scope until stronger orchestration, provenance, and concurrency contracts exist.

- recursive language model agents
- plugin-internal job scheduler
- SAT/SMT/Z3 integration
- route-heavy TUI
- automatic code/action agent spawning

## Guardrails

- keep the planner tool surface narrow unless `docs/operator-contract.md` promotion gates justify expansion
- do not collapse the current tools into one aggregated mutation tool yet
- do not start scheduler or agent-spawning work before stronger orchestration semantics exist beyond the current per-operation/TUI lifecycle model
- keep the graph visualization slice read-only and bounded to the operator-contract concepts before considering graph-heavy TUI work
- do not promote near-term candidates before the state-contract checkpoint closes and the operator-contract promotion gates are satisfied
- do not resume npm-publication-dependent work until npm publication is explicitly reactivated
- do not promote multi-session editing before session selection, history, and conflict semantics are operator-visible and tested
