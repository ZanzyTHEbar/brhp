import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { createClient, type Client } from '@libsql/client';

import { resolvePlanningDatabasePath } from './planning-database-path.js';
import { resolveRuntimeAssetPath } from './runtime-asset-path.js';

export interface PlanningDatabaseHandle {
  readonly client: Client;
  readonly databasePath: string;
  close(): void;
}

export interface OpenPlanningDatabaseInput {
  readonly worktreePath: string;
}

export async function openPlanningDatabase(
  input: OpenPlanningDatabaseInput
): Promise<PlanningDatabaseHandle> {
  const databasePath = resolvePlanningDatabasePath(input.worktreePath);
  await mkdir(path.dirname(databasePath), { recursive: true });

  const client = createClient({
    url: `file:${databasePath}`,
    intMode: 'number',
  });

  await applyPlanningMigrations(client);

  return {
    client,
    databasePath,
    close() {
      client.close();
    },
  };
}

export async function applyPlanningMigrations(client: Client): Promise<void> {
  const migrationDirectory = await resolveRuntimeAssetPath(import.meta.url, 'db', 'migrations');
  const entries = await readdir(migrationDirectory, { withFileTypes: true });
  const migrationFiles = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const transaction = await client.transaction('write');

  try {
    await transaction.executeMultiple(`
      CREATE TABLE IF NOT EXISTS brhp_schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at DATETIME NOT NULL
      );
    `);

    for (const fileName of migrationFiles) {
      const applied = await transaction.execute({
        sql: `
          SELECT version
          FROM brhp_schema_migrations
          WHERE version = :version
          LIMIT 1
        `,
        args: { version: fileName },
      });

      if (applied.rows.length === 0) {
        const migrationSql = await readFile(path.join(migrationDirectory, fileName), 'utf8');

        await transaction.executeMultiple(migrationSql);
        await transaction.execute({
          sql: `
            INSERT OR IGNORE INTO brhp_schema_migrations (version, applied_at)
            VALUES (:version, :applied_at)
          `,
          args: {
            version: fileName,
            applied_at: new Date().toISOString(),
          },
        });
      }
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
