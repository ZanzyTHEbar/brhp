# BRHP curated backlog

## Active next batches

This file is a curated engineering backlog, not a release promise. Deferred roadmap items below are intentionally out of current scope.

1. Next candidate batch: richer planning completion semantics
   - decide whether convergence should later require leaf completion, coverage closure, or both
   - keep current v1 rule minimal and explicit until that decision is made

2. Next candidate batch: event history depth and operator drill-down
   - decide whether planner event history should grow beyond the current bounded recent-activity read model
   - decide whether `/brhp` or the TUI needs a deeper operator-facing history surface

3. Next candidate batch: richer runtime diagnostics beyond the sidebar
   - decide whether `/brhp status` should mirror the new planner-runtime vs instruction-load distinction
   - decide whether runtime causes should be preserved internally for later operator inspection

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
- runtime convergence derived from current planner state plus explicit decomposition evidence
- server runtime access hardened with per-operation lifecycle management
- TUI runtime ownership hardened with explicit disposal and failure-path cleanup
- recent planner activity surfaced in `/brhp`, active-plan JSON, and the sidebar
- sidebar load diagnostics now distinguish BRHP instruction-load failures from planner-runtime failures

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
