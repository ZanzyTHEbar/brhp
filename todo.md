# BRHP curated backlog

## Active next batches

This file is a curated engineering backlog, not a release promise. Deferred roadmap items below are intentionally out of current scope.

1. Next active batch: richer operator drill-down beyond `/brhp history`
   - decide whether `/brhp` or the TUI needs per-session drill-down beyond the current bounded summaries
   - keep richer operator surfaces behind the existing narrow tool surface

2. Next active batch: state-contract freeze / backlog checkpoint
   - freeze the read-model and operator-surface contract after diagnostics and drill-down settle
   - reconcile repo docs, Memory Bank, Linear, and saga against the stabilized contract

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

## Near-term promotion candidates

These items can move forward once the active batches above are closed and the read-model/operator contract is stable.

- graph visualization UI
  - promote only after diagnostics parity and operator drill-down contracts settle
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

- keep the planner tool surface narrow while state contracts are still evolving
- do not collapse the current tools into one aggregated mutation tool yet
- do not start scheduler or agent-spawning work before stronger orchestration semantics exist beyond the current per-operation/TUI lifecycle model
- do not start graph-heavy TUI work before planner state and policy provenance stop moving
- do not promote near-term candidates before the current active batches plus diagnostics, operator drill-down, and state-contract freeze are complete
- do not promote multi-session editing before session selection, history, and conflict semantics are operator-visible and tested
