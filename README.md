# brhp

`brhp` is a single-package, TypeScript OpenCode plugin for OpenCode `v1.4.0+`.

It ships two real plugin entrypoints:

- **server entry** at the package root
- **TUI entry** at `brhp/tui`

The repository is being built in sequenced batches. The current baseline is buildable, testable, and organized as a documented hexagonal architecture with a formal BRHP planning core.

## Features

- pnpm-managed ESM package
- thin OpenCode entrypoints with default exports only
- `/brhp` slash command scaffold wired through `config` and `command.execute.before`
- instruction ingestion from:
  - global: `~/.config/opencode/brhp/instructions`
  - project: `.opencode/brhp/instructions`
- `.md` and `.mdc` instruction support
- optional YAML frontmatter (`title`, `description`, `order`, `enabled`)
- local planner persistence in `.opencode/brhp/brhp.db`
- system prompt injection through `experimental.chat.system.transform`
- TUI sidebar scaffold on `sidebar_content`
- formal BRHP planning domain model with explicit frontier, entropy, validation, and convergence math
- instruction-derived invariants seeded into planning sessions
- v1 convergence requires explicit decomposition before a session may settle as `converged`
- package sanity check script
- unit tests for instruction loading, prompt building, slash command behavior, and BRHP formalism primitives

## Verification nuance

`pnpm verify:package` verifies the built server entry is importable and exposes the expected plugin shape.

The built TUI bundle is only checked for presence. A direct `node`/`bun` smoke import is intentionally not used as a package verification gate because OpenCode TUI plugins rely on the real OpenCode runtime resolver behavior. In plain Node-style imports, `@opentui/solid/jsx-runtime` currently resolves in a way that is not representative of OpenCode's plugin loader.

## Instruction precedence

Instructions are loaded in this order:

1. global instructions
2. project instructions

Project instructions are appended after global instructions and are therefore the more specific layer when guidance overlaps.

## Directory layout

```text
src/
  adapters/
  application/
  composition/
  domain/
  tui/
tests/unit/
docs/architecture.md
```

## Development

Install dependencies:

```bash
pnpm install
```

Validate the scaffold:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm verify:package
```

Validate the SQLite/sqlc planner contract:

```bash
pnpm db:compile
pnpm db:vet
```

## BRHP commands

`/brhp` supports a small runtime surface:

- `/brhp`
- `/brhp status`
- `/brhp plan <problem statement>`
- `/brhp resume <session-id>`

Planning sessions are persisted to a local libsql database at `.opencode/brhp/brhp.db` inside the worktree.

BRHP v1 intentionally derives planner invariants from loaded instruction content. Explicit policy-document provenance remains formally deferred.

## Plugin installation

Example OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["brhp"]
}
```

Example TUI config:

```json
{
  "plugin": ["brhp"]
}
```

## Architecture

See [docs/architecture.md](./docs/architecture.md).

For the mathematical BRHP model, see [docs/formal-spec.md](./docs/formal-spec.md).

For the curated active backlog and deferred advanced roadmap, see [todo.md](./todo.md).
