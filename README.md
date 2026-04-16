# brhp

`brhp` is a single-package, TypeScript OpenCode plugin scaffold for OpenCode `v1.4.0+`.

It ships two real plugin entrypoints:

- **server entry** at the package root
- **TUI entry** at `brhp/tui`

The scaffold is intentionally minimal, but it is buildable, testable, and organized as a documented hexagonal architecture.

## Features

- pnpm-managed ESM package
- thin OpenCode entrypoints with default exports only
- `/brhp` slash command scaffold wired through `config` and `command.execute.before`
- instruction ingestion from:
  - global: `~/.config/opencode/brhp/instructions`
  - project: `.opencode/brhp/instructions`
- `.md` and `.mdc` instruction support
- optional YAML frontmatter (`title`, `description`, `order`, `enabled`)
- system prompt injection through `experimental.chat.system.transform`
- TUI sidebar scaffold on `sidebar_content`
- package sanity check script
- unit tests for instruction loading, prompt building, and slash command behavior

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
