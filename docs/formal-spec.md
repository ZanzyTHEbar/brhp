# BRHP formal specification

## Goal

BRHP is a planning-mode harness that recursively refines a problem into a constrained graph, maintains explicit frontier state, minimizes entropy over time, and validates branches before leaf handoff.

This document formalizes the v1 production model.

## State model

At planning turn `t`, the authoritative state is:

```text
S_t = (G_t, Θ_t, Π_t, Σ_t)
```

- `G_t` is the planning graph.
- `Θ_t` is the runtime control state.
- `Π_t` is the policy state.
- `Σ_t` is the summary and convergence state.

### Graph

The planning graph is:

```text
G_t = (N_t, E_t, Q_t)
```

- `N_t` is the set of plan nodes.
- `E_t` is the set of typed directed edges.
- `Q_t` is the set of recursive scopes.

Each node `n ∈ N_t` carries:

```text
n = (id, scope, parent, ψ, φ, κ, σ, d, ω)
```

- `ψ` is the natural-language problem statement.
- `φ` is the logical form or formal constraint expression.
- `κ` is the node category in `{dependent, isolated, parallelizable, cross-cutting}`.
- `σ` is the lifecycle status in `{proposed, active, decomposed, leaf, pruned, blocked}`.
- `d` is the graph depth.
- `ω` is the score vector `(utility, confidence, localEntropy, validationPressure)`.

### Runtime controls

The runtime control state is:

```text
Θ_t = (T_t, p_t, D_min, D_max, D_t)
```

- `T_t` is temperature.
- `p_t` is top-p. In the current foundation batch it is persisted as part of planner controls and will be wired into OpenCode `chat.params` in the runtime integration batch.
- `D_min` and `D_max` bound recursion depth.
- `D_t` is the active depth clamp derived from `T_t`.

### Policy state

The policy state is:

```text
Π_t = (I_t, P_t, Λ_t)
```

- `I_t` is the active instruction set loaded from the configured global/project instruction directories.
- `P_t` is the explicit policy document set. In BRHP v1 this set is formally deferred and remains empty for runtime-created sessions.
- `Λ_t` is the invariant set that must remain true throughout planning. In the current committed runtime invariants are heuristically derived from loaded instruction content.

### Summary state

The summary state is:

```text
Σ_t = (H_g, ΔH_g, Ξ_t, V_t)
```

- `H_g` is global entropy.
- `ΔH_g` is entropy drift.
- `Ξ_t` is frontier stability.
- `V_t` is the validation status vector.

## Recursive scopes

Each scope `Q_i` is a bounded planning subproblem. Scope-to-parent communication is formalized as:

```text
μ(Q_i) = (ΔG_i, σ_i, c_i)
```

- `ΔG_i` is the graph delta emitted by the scope.
- `σ_i` is the scope summary.
- `c_i` is the confidence score returned to the parent.

## Frontier selection

Let `F_t` be the current frontier set. Each frontier candidate is assigned utility `U_t(x)`.

Selection uses a Boltzmann distribution:

```text
P_t(x | F_t) = exp(U_t(x) / T_t) / Σ_y exp(U_t(y) / T_t)
```

The implementation uses numerically stabilized softmax while preserving the same distribution.

Before probabilities are computed, candidates with `depth > D_t` are excluded from the active frontier.

## Depth clamp

Depth is inversely clamped against normalized temperature:

```text
τ_t = clamp((T_t - T_min) / (T_max - T_min), 0, 1)
D_t = clamp(D_min + round((1 - τ_t) * (D_max - D_min)), D_min, D_max)
```

Lower temperature yields deeper, more deterministic refinement. Higher temperature yields shallower, broader exploration.

## Entropy

Local node entropy is standard Shannon entropy over branch probabilities:

```text
H_n(n) = - Σ_i p_i log2(p_i)
```

Global entropy is the frontier-weighted aggregate:

```text
H_g(F_t) = Σ_x P_t(x | F_t) H_n(x)
```

Entropy drift is stored as a signed delta:

```text
ΔH_g = H_g(t) - H_g(t-1)
```

Positive drift means the frontier became more entropic.
Negative drift means the frontier became less entropic.

Convergence thresholds apply to the magnitude of the drift, not its sign.

## Validation

For a scope `Q`, validation is a conjunction of deterministic checks:

```text
Φ_Q = ∧ c_i
SAT(Φ_Q) = true
```

The initial v1 clause families are:

- schema
- structure
- dependency
- conflict
- coverage

Blocking clauses must be explicitly passed for `SAT(Φ_Q)` to hold.

## Convergence

Planning converges only when entropy, the magnitude of drift, frontier stability, validation, explicit structural refinement, and blocking coverage closure all clear their thresholds:

```text
Converged_t = (H_g ≤ ε_H) ∧ (|ΔH_g| ≤ ε_Δ) ∧ (Ξ_t ≥ ε_Ξ) ∧ (blocking findings = 0) ∧ (pending blocking clauses = 0) ∧ (∃ e ∈ E_t(active scope) : e.kind = decomposes-to) ∧ CoverageClosed_t
```

The structural-refinement predicate is evaluated against the active-scope subgraph, not arbitrary decomposition edges elsewhere in the session.

Coverage closure in BRHP v1 is defined over the latest active-scope validation snapshot:

```text
CoverageClosed_t = (∃ c ∈ Φ_Q : c.kind = coverage ∧ c.blocking = true) ∧ (∀ c ∈ Φ_Q : c.kind = coverage ∧ c.blocking = true => c.status = passed)
```

Leaf completion remains deferred because the current BRHP runtime has no authoritative completion mutation or tool.

## Source-of-truth mapping

These formulas map directly to code in:

- `src/domain/planning/brhp-formalism.ts`
- `src/domain/planning/planning-session.ts`
- `src/domain/planning/planning-scope.ts`
- `src/domain/planning/plan-node.ts`
- `src/domain/planning/plan-edge.ts`
- `src/domain/planning/frontier.ts`
- `src/domain/planning/validation.ts`
- `src/application/use-cases/recompute-active-frontier.ts`
- `src/application/use-cases/record-active-scope-validation.ts`
- `src/application/use-cases/decompose-planning-node.ts`
