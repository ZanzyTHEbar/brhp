# BRHP curated backlog

## Active next batches

This file is a curated engineering backlog, not a release promise. Deferred roadmap items below are intentionally out of current scope.

1. Batch 8: align docs and spec with current runtime behavior
   - signed entropy drift in the formal spec
   - current policy-state reality: instruction-derived invariants are implemented, explicit policy-document provenance is reserved
   - curate this backlog into active work vs deferred roadmap

2. Batch 9: harden server planner runtime lifecycle
   - explicit ownership/disposal semantics for the server-side planner runtime
   - failure-path coverage for runtime initialization and teardown

3. Batch 10: decide policy provenance scope
   - either implement explicit policy-document provenance or formally defer it
   - keep instruction-derived invariants as the current source of truth until that decision is made

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
- runtime convergence derived from current planner state

## Deferred advanced roadmap

These items are intentionally not current-priority and should remain deferred until the active batches above are closed.

- recursive language model agents
- plugin-internal job scheduler
- graph visualization UI
- SAT/SMT/Z3 integration
- multi-session concurrent editing
- route-heavy TUI
- automatic code/action agent spawning
- config DSL
- provider/model routing
- aggregated tool entries / multi-operation tool consolidation

## Guardrails

- keep the planner tool surface narrow while state contracts are still evolving
- do not collapse the current tools into one aggregated mutation tool yet
- do not start scheduler, agent-spawning, or multi-session work before runtime lifecycle is hardened
- do not start graph-heavy TUI work before planner state and policy provenance stop moving
