import type { Client, Transaction } from '@libsql/client';

import type { PlannerQueryDefinition } from './planner-query-loader.js';

export type LibsqlQueryExecutor = Pick<Client, 'execute'> | Pick<Transaction, 'execute'>;
export type LibsqlNamedArgs = Record<string, unknown>;
export type LibsqlQueryRow = Record<string, unknown>;

export async function executePlannerQuery(
  executor: LibsqlQueryExecutor,
  query: PlannerQueryDefinition,
  args: LibsqlNamedArgs = {}
): Promise<void> {
  assertCommand(query, 'exec');
  await executor.execute({ sql: query.sql, args } as never);
}

export async function fetchPlannerQueryOne(
  executor: LibsqlQueryExecutor,
  query: PlannerQueryDefinition,
  args: LibsqlNamedArgs = {}
): Promise<LibsqlQueryRow | null> {
  assertCommand(query, 'one');
  const result = await executor.execute({ sql: query.sql, args } as never);
  const firstRow = result.rows[0];

  return firstRow ? toQueryRow(firstRow) : null;
}

export async function fetchPlannerQueryMany(
  executor: LibsqlQueryExecutor,
  query: PlannerQueryDefinition,
  args: LibsqlNamedArgs = {}
): Promise<LibsqlQueryRow[]> {
  assertCommand(query, 'many');
  const result = await executor.execute({ sql: query.sql, args } as never);

  return result.rows.map(row => toQueryRow(row));
}

function assertCommand(
  query: PlannerQueryDefinition,
  expectedCommand: PlannerQueryDefinition['command']
): void {
  if (query.command !== expectedCommand) {
    throw new Error(
      `Planner query '${query.name}' is '${query.command}', expected '${expectedCommand}'`
    );
  }
}

function toQueryRow(row: unknown): LibsqlQueryRow {
  if (!row || typeof row !== 'object') {
    throw new Error('libsql query row is not an object');
  }

  return row as LibsqlQueryRow;
}
