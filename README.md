# BRHP

BRHP is an OpenCode plugin for structured, persistent planning.

Instead of treating planning as a few disposable notes in a chat, BRHP gives planning its own state. You can start from a problem statement, build and revisit a planning session over time, and keep that session grounded in the instructions and constraints that matter for the current project.

BRHP is short for Boltzmann Recursive Hierarchical Planning. At a high level, it models planning as a graph of scopes, nodes, and validation signals rather than a flat checklist, so the system can keep track of what is still unresolved and whether a plan has actually converged.

## What BRHP is for

BRHP is built for work that is too large, too uncertain, or too constrained to handle well with "just start coding."

It is meant to help you:

- turn a vague problem into an explicit planning session
- keep track of the active frontier of unresolved work
- validate whether the current plan is coherent enough to proceed
- resume planning later without losing the thread
- keep project-specific instructions in the loop while planning

## Why this project exists

Most AI-assisted development workflows are very good at moving fast. They are much less reliable at holding a careful plan in memory across multiple turns, especially when the work has dependencies, constraints, or policy-like requirements.

BRHP exists to make planning a first-class activity inside OpenCode. The goal is not only to generate a plan once, but to maintain an explicit planning state that can be inspected, constrained, resumed, and handed off with more confidence.

## What it does today

BRHP currently provides:

- a `/brhp` slash command for inspecting, creating, and resuming planning sessions
- a `/brhp history` view for deeper bounded recent planner history on the active session
- a TUI sidebar for the current planning state
- instruction loading from both user-level and project-level directories
- local persistence so planning sessions survive across turns and restarts

BRHP reads instructions from:

- `~/.config/opencode/brhp/instructions`
- `.opencode/brhp/instructions`

Planning sessions are stored locally at:

- `.opencode/brhp/brhp.db`

## Getting started

Requirements:

- OpenCode `v1.4.0+`
- Node.js `20+`

BRHP is not published on npm yet. Until it is, load it from a local checkout with OpenCode's path-like plugin spec support and a `file://` package path.

Local checkout requirements:

- `pnpm`
- `bun`

Build BRHP locally:

```bash
corepack enable
pnpm install
pnpm build
```

Then add the local package path to your OpenCode runtime config.

`opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///absolute/path/to/brhp"]
}
```

Add the same local package path to your OpenCode TUI config.

`tui.json`

```json
{
  "plugin": ["file:///absolute/path/to/brhp"]
}
```

Restart OpenCode after changing plugin config. Re-run `pnpm build` after local BRHP source changes.

After BRHP is published to npm, replace the `file://` entries with `"brhp"` in both config files.

Common commands:

- `/brhp` or `/brhp status` to inspect the active planning session
- `/brhp history` to inspect the newest 25 planner events for the active session
- `/brhp plan <problem statement>` to start a new planning session
- `/brhp resume <session id>` to resume an existing session

Example:

```text
/brhp plan Design a safe rollout strategy for migrating our job system
```

## Documentation

The README is meant to explain the project at a high level. If you want the internal design and formal model, start here:

- [Architecture](./docs/architecture.md)
- [Formal specification](./docs/formal-spec.md)

## Development

Install dependencies:

```bash
pnpm install
```

Validate the project:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm verify:package
```

`pnpm verify:package` uses Bun to run the verifier, `npm pack` to build the package artifact, and `npm install` inside a temporary project to smoke-test the installed package. It may need npm registry or cache access for dependency resolution.

If you are working on the local planner schema:

```bash
pnpm db:compile
pnpm db:vet
```

## Project status

BRHP is an early public release. The core planning model, OpenCode integration, and local persistence are in place, but the public surface is still intentionally small while the planning kernel hardens.

## License

MIT. See [LICENSE](./LICENSE).
