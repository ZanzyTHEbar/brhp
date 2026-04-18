import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
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

const rootEntry = path.join(fileURLToPath(root), 'dist', 'src', 'index.js');
const tuiEntry = path.join(fileURLToPath(root), 'dist', 'src', 'tui', 'index.js');

await access(rootEntry);
await access(tuiEntry);

const serverModule = await import(pathToFileURL(rootEntry).href);

assert(serverModule.default?.id === 'brhp', 'server default export must expose plugin id');
assert(
  typeof serverModule.default?.server === 'function',
  'server default export must expose server function'
);

const hooks = await serverModule.default.server({
  client: {},
  project: {},
  directory: fileURLToPath(root),
  worktree: fileURLToPath(root),
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

console.log('Package verification passed');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
