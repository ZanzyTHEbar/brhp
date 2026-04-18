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

- `src/composition/create-planner-runtime.ts` creates one planner runtime per plugin instance/worktree
- the server hook and TUI hook reuse that runtime instead of reopening the DB on every operation
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

Those types and pure functions are intentionally isolated so they can be reused by the upcoming `libsql` + `sqlc` persistence layer and the OpenCode server/TUI integration work.

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
2. `command.execute.before` parses `/brhp` into `status`, `plan`, or `resume`.
3. The plugin uses the shared planner runtime plus the local libsql store to load or mutate the active session for the current OpenCode chat.
4. The plugin clears the output parts and writes a text response with planning state and instruction diagnostics.

## TUI flow

1. `src/tui/index.tsx` registers `sidebar_content`.
2. The sidebar loads instruction inventory and the active planning session for the current OpenCode chat.
3. A command-palette action emits an in-process refresh event and reloads the sidebar view.
4. Plugin lifecycle disposal closes the shared planner runtime for the TUI instance.
