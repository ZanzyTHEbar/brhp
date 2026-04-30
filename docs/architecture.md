# BRHP architecture

## Goal

This scaffold provides a real OpenCode plugin package with thin entrypoints and explicit hexagonal boundaries.

## Layers

### Domain

- `src/domain/instructions/instruction.ts`
- `src/domain/sidebar/sidebar-model.ts`
- `src/domain/slash-command/brhp-command.ts`
- `src/domain/planning/*`

The domain layer defines plugin concepts only: instructions, sidebar view data, slash command identity, and the formal BRHP planning model.

### Application

- `src/application/ports/*`
- `src/application/use-cases/*`

The application layer owns the use cases:

- resolve instruction directories
- load and merge instructions
- build the injected system prompt section
- build slash-command output
- build the TUI sidebar model
- seed BRHP planning sessions against domain contracts
- parse `/brhp` subcommands and drive planner runtime behavior
- derive frontier updates and runtime convergence from current planner state

It depends on abstractions, not Node or OpenCode APIs directly.

### Adapters

- `src/adapters/filesystem/node-file-system.ts`
- `src/adapters/environment/process-environment.ts`
- `src/adapters/instructions/frontmatter-instruction-parser.ts`

Adapters implement the application ports and convert markdown files into domain objects.

The libsql adapter layer also owns:

- runtime asset lookup for SQL and migrations
- local planner DB bootstrap and migrations
- named-parameter query execution over `@libsql/client`
- persistence and hydration of BRHP planning sessions

### Composition roots

- `src/composition/create-server-plugin.ts`
- `src/composition/create-tui-plugin.ts`

These files wire adapters to use cases and map them onto the OpenCode server and TUI plugin APIs.

For the planner runtime specifically:

- `src/composition/create-planner-runtime.ts` creates planner runtimes on demand for a worktree
- the server hook opens planner runtime access per operation and closes it after the operation completes
- the TUI owns a longer-lived planner runtime through `src/composition/create-planner-runtime-owner.ts`
- plugin lifecycle disposal closes the TUI runtime handle explicitly

## BRHP formal core

The planning kernel is formalized separately in [docs/formal-spec.md](./formal-spec.md).

The current codebase now includes the domain foundations for:

- planning sessions
- recursive scopes
- plan nodes and edges
- Boltzmann frontier selection
- temperature-driven depth clamps
- entropy tracking
- conjunctive validation
- convergence assessment

Those types and pure functions are intentionally isolated so they can be reused by the `libsql` persistence layer and the OpenCode server/TUI integration work.

Current runtime behavior derived from that model:

- validation persists deterministic verdicts for the active scope
- frontier reselection is recomputed after decomposition and validation
- convergence is derived from current frontier entropy, drift magnitude, stability, explicit decomposition evidence, and blocking coverage closure in the active-scope validation snapshot
- decomposition invalidates convergence and returns the session to `exploring`
- loaded instruction content currently seeds planner invariants; explicit policy-document provenance is formally deferred for BRHP v1

## Planner read model and operator surfaces

The authoritative runtime read model is the active `PlanningState` loaded for the current OpenCode chat and worktree. It contains session metadata, graph scopes/nodes/edges, the latest frontier snapshot, the latest validation snapshot, and bounded recent planner events.

BRHP exposes that state through human-facing projections rather than treating the internal TypeScript model or SQLite schema as public API:

| Surface | Projection |
| --- | --- |
| `/brhp status` | Compact active-session summary, instruction inventory, skipped files, and runtime diagnostics. |
| `/brhp history` | Newest-first active-session event history, bounded to 25 planner events. |
| `/brhp inspect` | Bounded graph, active-scope, frontier, validation, focus-node, edge, and recent-activity drill-down. |
| TUI sidebar | Compact read-only summary for the current planning state. |
| `brhp_get_active_plan` | Authoritative active-state read capability for planner agents; not a frozen JSON schema. |

Planner-tool mutation remains limited to `brhp_decompose_node` and `brhp_validate_active_scope`. Slash-command mutation remains limited to `/brhp plan` and `/brhp resume`. The frozen operator boundary is documented in [operator-contract.md](./operator-contract.md).

### Entry modules

- `src/index.ts`
- `src/tui/index.tsx`

Entrypoints are intentionally thin and use default exports only to match observed OpenCode loader behavior.

## Instruction flow

1. Resolve global and project instruction directories.
2. Recursively discover `.md` and `.mdc` files.
3. Parse optional YAML frontmatter.
4. Filter disabled or empty files.
5. Merge global instructions before project instructions.
6. Inject the rendered instruction section through `experimental.chat.system.transform`.

## Slash command flow

1. `config` registers the `brhp` command.
2. `command.execute.before` parses `/brhp` into `status`, `plan`, `resume`, `history`, or `inspect`.
3. Read-only commands load the active planner state or event history and render bounded operator projections.
4. Mutating slash commands open planner runtime access for the operation and use the local libsql store to create or resume state for the current OpenCode chat.
5. The plugin clears the output parts and writes a text response with planning state, instruction details, and stack-free runtime diagnostics where supported.

## TUI flow

1. `src/tui/index.tsx` registers `sidebar_content`.
2. The sidebar loads instruction inventory and the active planning session for the current OpenCode chat.
3. A command-palette action emits an in-process refresh event and reloads the sidebar view.
4. Plugin lifecycle disposal closes the shared planner runtime for the TUI instance.
