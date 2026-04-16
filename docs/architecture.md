# BRHP architecture

## Goal

This scaffold provides a real OpenCode plugin package with thin entrypoints and explicit hexagonal boundaries.

## Layers

### Domain

- `src/domain/instructions/instruction.ts`
- `src/domain/sidebar/sidebar-model.ts`
- `src/domain/slash-command/brhp-command.ts`

The domain layer defines plugin concepts only: instructions, sidebar view data, and slash command identity.

### Application

- `src/application/ports/*`
- `src/application/use-cases/*`

The application layer owns the use cases:

- resolve instruction directories
- load and merge instructions
- build the injected system prompt section
- build slash-command output
- build the TUI sidebar model

It depends on abstractions, not Node or OpenCode APIs directly.

### Adapters

- `src/adapters/filesystem/node-file-system.ts`
- `src/adapters/environment/process-environment.ts`
- `src/adapters/instructions/frontmatter-instruction-parser.ts`

Adapters implement the application ports and convert markdown files into domain objects.

### Composition roots

- `src/composition/create-server-plugin.ts`
- `src/composition/create-tui-plugin.ts`

These files wire adapters to use cases and map them onto the OpenCode server and TUI plugin APIs.

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
2. `command.execute.before` intercepts `/brhp`.
3. The plugin clears the output parts and writes a text response with status and inventory.

## TUI flow

1. `src/tui/index.tsx` registers `sidebar_content`.
2. The sidebar loads the same instruction inventory use case used by the server.
3. A command-palette action emits an in-process refresh event and reloads the sidebar view.
