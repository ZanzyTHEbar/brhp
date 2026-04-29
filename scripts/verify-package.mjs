import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, access, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const packageJsonPath = new URL('../package.json', import.meta.url);
const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

assert(packageJson.type === 'module', 'package.json must declare type=module');
assert(
  Array.isArray(packageJson['oc-plugin']) &&
    packageJson['oc-plugin'].includes('server') &&
    packageJson['oc-plugin'].includes('tui'),
  'oc-plugin must include server and tui'
);
assert(packageJson.exports?.['.']?.import, 'root import export is missing');
assert(packageJson.exports?.['./tui']?.import, 'tui import export is missing');
assert(
  packageJson.exports['./tui'].import === './dist/tui/index.js',
  'tui import export must reference Bun-built artifact'
);

const rootEntry = path.join(rootPath, 'dist', 'src', 'index.js');
const rootTypes = path.join(rootPath, 'dist', 'src', 'index.d.ts');
const tuiEntry = path.join(rootPath, 'dist', 'tui', 'index.js');
const tuiTypes = path.join(rootPath, 'dist', 'src', 'tui', 'index.d.ts');

await access(rootEntry);
await access(rootTypes);
await access(tuiEntry);
await access(tuiTypes);

const serverModule = await import(pathToFileURL(rootEntry).href);
const tuiModule = await import(pathToFileURL(tuiEntry).href);

assertServerModule(serverModule, 'server default export');
assertTuiModule(tuiModule, 'tui default export');

const hooks = await serverModule.default.server({
  client: {},
  project: {},
  directory: rootPath,
  worktree: rootPath,
  serverUrl: new URL('https://example.com'),
  $: {},
});

assert(typeof hooks.config === 'function', 'server hooks must expose config registration');
assert(
  typeof hooks['command.execute.before'] === 'function',
  'server hooks must expose slash command handler'
);
assert(
  typeof hooks['experimental.chat.system.transform'] === 'function',
  'server hooks must expose system prompt transform'
);
assert(hooks.tool?.brhp_get_active_plan, 'server hooks must expose brhp_get_active_plan');
assert(hooks.tool?.brhp_decompose_node, 'server hooks must expose brhp_decompose_node');
assert(hooks.tool?.brhp_validate_active_scope, 'server hooks must expose brhp_validate_active_scope');

await verifyLocalFilePackageSpec();
await verifyPackedArtifact();

console.log('Package verification passed');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertServerModule(module, label) {
  assert(module.default?.id === 'brhp', `${label} must expose plugin id`);
  assert(typeof module.default?.server === 'function', `${label} must expose server function`);
}

function assertTuiModule(module, label) {
  assert(module.default?.id === 'brhp', `${label} must expose plugin id`);
  assert(typeof module.default?.tui === 'function', `${label} must expose tui function`);
}

async function verifyLocalFilePackageSpec() {
  const serverEntry = resolveLocalPackageEntrypoint('server');
  const localTuiEntry = resolveLocalPackageEntrypoint('tui');

  assert(serverEntry, 'local file package spec must resolve a server entrypoint');
  assert(localTuiEntry, 'local file package spec must resolve a tui entrypoint');

  const localServerModule = await import(pathToFileURL(serverEntry).href);
  const localTuiModule = await import(pathToFileURL(localTuiEntry).href);

  assertServerModule(localServerModule, 'local file package server export');
  assertTuiModule(localTuiModule, 'local file package tui export');
  await smokeTuiModule(localTuiModule, rootPath);
}

function resolveLocalPackageEntrypoint(kind) {
  const exported = packageJson.exports?.[`./${kind}`];
  const exportedPath = exportValue(exported);

  if (exportedPath) {
    return resolvePackagePath(exportedPath);
  }

  if (kind === 'server' && typeof packageJson.main === 'string' && packageJson.main.trim()) {
    return resolvePackagePath(packageJson.main);
  }
}

function exportValue(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  for (const key of ['import', 'default']) {
    if (typeof value[key] === 'string' && value[key].trim()) {
      return value[key];
    }
  }
}

function resolvePackagePath(packageRelativePath) {
  const resolved = path.resolve(rootPath, packageRelativePath);
  const root = path.resolve(rootPath);

  assert(
    resolved === root || resolved.startsWith(`${root}${path.sep}`),
    `package entry '${packageRelativePath}' must stay inside package root`
  );

  return resolved;
}

async function smokeTuiModule(module, worktreePath) {
  const events = [];
  let disposeHandler;

  await module.default.tui({
    state: {
      path: {
        worktree: worktreePath,
        directory: worktreePath,
      },
    },
    slots: {
      register() {
        events.push('registerSlots');
        return () => events.push('unregisterSlots');
      },
    },
    command: {
      register() {
        events.push('registerCommand');
        return () => events.push('unregisterCommand');
      },
    },
    lifecycle: {
      onDispose(handler) {
        disposeHandler = handler;
      },
    },
    ui: {
      toast() {},
    },
  });

  assert(events.includes('registerSlots'), 'tui plugin must register sidebar slots');
  assert(events.includes('registerCommand'), 'tui plugin must register commands');
  assert(typeof disposeHandler === 'function', 'tui plugin must register a dispose handler');

  disposeHandler();

  assert(events.includes('unregisterSlots'), 'tui plugin must unregister sidebar slots');
  assert(events.includes('unregisterCommand'), 'tui plugin must unregister commands');
}

async function verifyPackedArtifact() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'brhp-package-'));

  try {
    const packResult = await runCommand(
      'npm',
      ['pack', '--ignore-scripts', '--dry-run=false', '--json', '--pack-destination', tempRoot],
      rootPath
    );
    const [{ filename }] = JSON.parse(packResult.stdout);

    assert(typeof filename === 'string' && filename.length > 0, 'npm pack did not return a filename');

    const tarballPath = path.join(tempRoot, filename);
    await access(tarballPath);

    const installRoot = path.join(tempRoot, 'install');
    await mkdir(installRoot);
    await writeFile(
      path.join(installRoot, 'package.json'),
      JSON.stringify({ name: 'brhp-smoke-test', private: true, type: 'module' }, null, 2)
    );

    await runCommand('npm', ['install', '--ignore-scripts', '--dry-run=false', tarballPath], installRoot);

    const installedPackageRoot = path.join(installRoot, 'node_modules', packageJson.name);
    await access(path.join(installedPackageRoot, 'dist', 'src', 'index.js'));
    await access(path.join(installedPackageRoot, 'dist', 'src', 'index.d.ts'));
    await access(path.join(installedPackageRoot, 'dist', 'tui', 'index.js'));
    await access(path.join(installedPackageRoot, 'dist', 'src', 'tui', 'index.d.ts'));

    const smokeScript = path.join(installRoot, 'smoke.mjs');
    await writeFile(
      smokeScript,
      `import serverModule from 'brhp';
import tuiModule from 'brhp/tui';

const events = [];
let disposeHandler;

if (serverModule?.id !== 'brhp') throw new Error('server export missing id');
if (typeof serverModule?.server !== 'function') throw new Error('server export missing server function');
if (tuiModule?.id !== 'brhp') throw new Error('tui export missing id');
if (typeof tuiModule?.tui !== 'function') throw new Error('tui export missing tui function');

const hooks = await serverModule.server({
  client: {},
  project: {},
  directory: ${JSON.stringify(installRoot)},
  worktree: ${JSON.stringify(installRoot)},
  serverUrl: new URL('https://example.com'),
  $: {},
});

if (typeof hooks.config !== 'function') throw new Error('server hooks missing config registration');
if (typeof hooks['command.execute.before'] !== 'function') throw new Error('server hooks missing slash command handler');
if (typeof hooks['experimental.chat.system.transform'] !== 'function') throw new Error('server hooks missing system prompt transform');
if (!hooks.tool?.brhp_get_active_plan) throw new Error('server hooks missing brhp_get_active_plan');
if (!hooks.tool?.brhp_decompose_node) throw new Error('server hooks missing brhp_decompose_node');
if (!hooks.tool?.brhp_validate_active_scope) throw new Error('server hooks missing brhp_validate_active_scope');

const inspectOutput = { parts: [{ type: 'text', text: 'replace me' }] };
await hooks['command.execute.before']?.(
  {
    command: 'brhp',
    sessionID: 'package-smoke-session',
    arguments: 'inspect',
  },
  inspectOutput
);

if (!String(inspectOutput.parts[0]?.text ?? '').includes('# BRHP Inspect')) {
  throw new Error('server hooks missing inspect command response');
}

await tuiModule.tui({
  state: {
    path: {
      worktree: ${JSON.stringify(installRoot)},
      directory: ${JSON.stringify(installRoot)},
    },
  },
  slots: {
    register() {
      events.push('registerSlots');
      return () => events.push('unregisterSlots');
    },
  },
  command: {
    register() {
      events.push('registerCommand');
      return () => events.push('unregisterCommand');
    },
  },
  lifecycle: {
    onDispose(handler) {
      disposeHandler = handler;
    },
  },
  ui: {
    toast() {},
  },
});

if (!events.includes('registerSlots')) throw new Error('tui plugin did not register slots');
if (!events.includes('registerCommand')) throw new Error('tui plugin did not register commands');
if (typeof disposeHandler !== 'function') throw new Error('tui plugin did not register dispose handler');

disposeHandler();

if (!events.includes('unregisterSlots')) throw new Error('tui plugin did not unregister slots');
if (!events.includes('unregisterCommand')) throw new Error('tui plugin did not unregister commands');
`
    );

    await runCommand('bun', [smokeScript], installRoot);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed\n${stderr || stdout}`));
    });
  });
}
