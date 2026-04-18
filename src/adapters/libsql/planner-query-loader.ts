import { readFile } from 'node:fs/promises';

import { resolveRuntimeAssetPath } from './runtime-asset-path.js';

export const PLANNER_QUERY_NAMES = [
  'DeactivatePlanningSessionsForContext',
  'CreatePlanningSession',
  'CreatePlanningSessionDocument',
  'CreatePlanningSessionInvariant',
  'CreatePlanningScope',
  'CreatePlanningNode',
  'CreatePlanningEdge',
  'CreatePlanningFrontierSnapshot',
  'CreatePlanningFrontierSelection',
  'CreatePlanningEvent',
  'ListPlanningSessionsByWorktree',
  'GetActivePlanningSessionByContext',
  'GetPlanningSessionByID',
  'ActivatePlanningSessionByID',
  'ListPlanningSessionDocuments',
  'ListPlanningSessionInvariants',
  'ListPlanningScopesBySession',
  'ListPlanningNodesBySession',
  'ListPlanningEdgesBySession',
  'ListPlanningEventsBySession',
  'GetLatestPlanningFrontierSnapshotBySession',
  'ListPlanningFrontierSelectionsBySnapshot',
] as const;

export type PlannerQueryName = (typeof PLANNER_QUERY_NAMES)[number];

export type PlannerQueryCommand = 'exec' | 'one' | 'many';

export interface PlannerQueryDefinition {
  readonly name: PlannerQueryName;
  readonly command: PlannerQueryCommand;
  readonly sql: string;
  readonly parameterNames: readonly string[];
}

export type PlannerQueryCatalog = Record<PlannerQueryName, PlannerQueryDefinition>;

const SUPPORTED_COMMANDS: ReadonlySet<string> = new Set(['exec', 'one', 'many']);
const PLANNER_QUERY_NAME_SET = new Set<string>(PLANNER_QUERY_NAMES);

let plannerQueryCatalogPromise: Promise<PlannerQueryCatalog> | undefined;

export async function loadPlannerQueryCatalog(): Promise<PlannerQueryCatalog> {
  plannerQueryCatalogPromise ??= (async () => {
    const queryFilePath = await resolveRuntimeAssetPath(
      import.meta.url,
      'db',
      'queries',
      'planner.sql'
    );
    const content = await readFile(queryFilePath, 'utf8');
    return parsePlannerQueryFile(content);
  })();

  return plannerQueryCatalogPromise;
}

export function parsePlannerQueryFile(content: string): PlannerQueryCatalog {
  const lines = content.split(/\r?\n/u);
  const parsed = new Map<PlannerQueryName, PlannerQueryDefinition>();

  let currentName: PlannerQueryName | undefined;
  let currentCommand: PlannerQueryCommand | undefined;
  let bodyLines: string[] = [];

  const flush = () => {
    if (!currentName || !currentCommand) {
      return;
    }

    const statement = bodyLines.join('\n').trim();

    if (statement.length === 0) {
      throw new Error(`Planner query '${currentName}' does not contain SQL`);
    }

    parsed.set(currentName, {
      name: currentName,
      command: currentCommand,
      ...compilePlannerSql(statement),
    });
  };

  for (const line of lines) {
    const match = /^--\s*name:\s*([A-Za-z0-9_]+)\s*:(exec|one|many)\s*$/u.exec(line);

    if (!match) {
      bodyLines.push(line);
      continue;
    }

    flush();

    const [, queryName, command] = match;

    if (!queryName || !PLANNER_QUERY_NAME_SET.has(queryName)) {
      throw new Error(`Unexpected planner query name '${queryName ?? 'unknown'}'`);
    }

    if (!command || !SUPPORTED_COMMANDS.has(command)) {
      throw new Error(`Unsupported planner query command '${command ?? 'unknown'}'`);
    }

    currentName = queryName as PlannerQueryName;
    currentCommand = command as PlannerQueryCommand;
    bodyLines = [];
  }

  flush();

  for (const requiredName of PLANNER_QUERY_NAMES) {
    if (!parsed.has(requiredName)) {
      throw new Error(`Planner query file is missing '${requiredName}'`);
    }
  }

  return Object.fromEntries(
    [...parsed.entries()].map(([name, definition]) => [name, definition])
  ) as PlannerQueryCatalog;
}

function compilePlannerSql(statement: string): Pick<PlannerQueryDefinition, 'sql' | 'parameterNames'> {
  if (/sqlc\.(?!arg\()/u.test(statement)) {
    throw new Error('Planner SQL uses unsupported sqlc helpers; only sqlc.arg(...) is supported');
  }

  const parameterNames: string[] = [];
  const sql = statement.replace(/sqlc\.arg\(([A-Za-z_][A-Za-z0-9_]*)\)/gu, (_match, name) => {
    parameterNames.push(name);
    return `:${name}`;
  });

  return {
    sql,
    parameterNames,
  };
}
