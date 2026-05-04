# Planning with BRHP

BRHP (Boltzmann Recursive Hierarchical Planning) is a structured planning plugin. Use it for work that is too large, too uncertain, or too constrained to handle with ad-hoc reasoning.

## When to plan with BRHP

Start a BRHP session when:
- The task spans multiple sub-problems with dependencies
- The task requires explicit validation or coverage checks
- You need to resume planning later with full context
- The task has policy-like constraints from project instructions

## How to plan

1. **Start a session** with `/brhp plan <problem statement>`.

2. **Inspect state** with `/brhp status` or `/brhp inspect` to see the active graph, frontier, validation, and recent activity.

3. **Read the active plan** with the `brhp_get_active_plan` tool before making mutations.

4. **Decompose nodes** with the `brhp_decompose_node` tool. Break a node into smaller child nodes. Each child needs a title, problem statement, and category (`dependent`, `isolated`, `parallelizable`, or `cross-cutting`).

5. **Validate scopes** with the `brhp_validate_active_scope` tool. For each active scope, provide validation clauses with kind (`schema`, `structure`, `dependency`, `conflict`, `coverage`), blocking flag, description, and status (`pending`, `passed`, `failed`, `skipped`).

6. **Complete leaf nodes** with the `brhp_complete_leaf` tool. When a leaf node's work is done, mark it complete with a summary of results.

7. **Check convergence** — BRHP converges when the frontier entropy is low, drift is stable, coverage is satisfied, and no blocking findings remain. Use `/brhp status` to check convergence status.

## Rules

- Always read the active plan before decomposing, validating, or completing leaves.
- Decompose one node at a time and verify the updated frontier before proceeding.
- Validate after decomposition to keep coverage current.
- Complete leaf nodes when the work is actually done, not preemptively.
- If validation produces blocking findings, address them before further decomposition.
