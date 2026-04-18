import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function resolveRuntimeAssetPath(
  importMetaUrl: string,
  ...assetPathSegments: readonly string[]
): Promise<string> {
  const moduleDirectory = path.dirname(fileURLToPath(importMetaUrl));
  let currentDirectory = moduleDirectory;

  while (true) {
    const candidatePath = path.join(currentDirectory, ...assetPathSegments);

    if (await exists(candidatePath)) {
      return candidatePath;
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      break;
    }

    currentDirectory = parentDirectory;
  }

  throw new Error(
    `Unable to resolve runtime asset '${assetPathSegments.join('/')}' from '${moduleDirectory}'`
  );
}

async function exists(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath);
    return true;
  } catch {
    return false;
  }
}
