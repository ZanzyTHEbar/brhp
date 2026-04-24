import type { PluginInput } from '@opencode-ai/plugin';
import path from 'node:path';

type ServerSessionLookupClient = {
  readonly path: {
    get(options: {
      responseStyle: 'data';
      throwOnError: true;
    }): Promise<
      | {
          directory: string;
          worktree: string;
        }
      | {
          data: {
            directory: string;
            worktree: string;
          };
        }
    >;
  };
  readonly session: {
    get(options: {
      path: { id: string };
      responseStyle: 'data';
      throwOnError: true;
    }): Promise<
      | {
          directory: string;
        }
      | {
          data: {
            directory: string;
          };
        }
    >;
  };
  readonly project: {
    current(
      options:
        | {
            query: { directory: string };
            responseStyle: 'data';
            throwOnError: true;
          }
        | {
            responseStyle: 'data';
            throwOnError: true;
          }
    ): Promise<
      | {
          worktree: string;
        }
      | {
          data: {
            worktree: string;
          };
        }
    >;
  };
};

export function resolveProjectWorktreePath(input: Pick<PluginInput, 'project' | 'worktree' | 'directory'>): string {
  return resolveRuntimeProjectPath(input.project.worktree, input.worktree, input.directory);
}

export interface ServerProjectPathResolverInput {
  readonly client: Partial<ServerSessionLookupClient>;
  readonly project: Pick<PluginInput['project'], 'worktree'>;
  readonly worktree: string;
  readonly directory: string;
}

export async function resolveServerProjectWorktreePath(
  input: ServerProjectPathResolverInput,
  sessionID: string,
  runtimeCandidates?: {
    readonly worktree?: string | null;
    readonly directory?: string | null;
  }
): Promise<string> {
  const fromPath = await resolveProjectPathFromClientPath(input);
  const fromSession = await resolveProjectPathFromSession(input, sessionID);
  return resolveRuntimeProjectPath(
    fromSession?.worktree,
    fromSession?.directory,
    runtimeCandidates?.worktree,
    runtimeCandidates?.directory,
    fromPath?.worktree,
    fromPath?.directory,
    input.project.worktree,
    input.worktree,
    input.directory
  );
}

export async function resolveServerProjectWorktreePathWithoutSession(
  input: ServerProjectPathResolverInput,
  runtimeCandidates?: {
    readonly worktree?: string | null;
    readonly directory?: string | null;
  }
): Promise<string> {
  const fromPath = await resolveProjectPathFromClientPath(input);

  return resolveRuntimeProjectPath(
    fromPath?.worktree,
    fromPath?.directory,
    runtimeCandidates?.worktree,
    runtimeCandidates?.directory,
    input.project.worktree,
    input.worktree,
    input.directory
  );
}

export function resolveRuntimeProjectPath(...candidates: Array<string | null | undefined>): string {
  const normalized = candidates
    .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
    .map(candidate => path.resolve(candidate));
  const nonRoot = normalized.find(candidate => !isFilesystemRoot(candidate));

  if (nonRoot) {
    return nonRoot;
  }

  const fallback = normalized[0];
  if (fallback) {
    return fallback;
  }

  throw new Error('Unable to resolve a runtime project path from the current OpenCode context');
}

function isFilesystemRoot(candidate: string): boolean {
  return path.parse(candidate).root === candidate;
}

async function resolveProjectPathFromSession(
  input: ServerProjectPathResolverInput,
  sessionID: string
): Promise<{ worktree?: string; directory?: string } | null> {
  const getSession = input.client.session?.get;
  const getProject = input.client.project?.current;

  if (typeof getSession !== 'function') {
    return null;
  }

  try {
    const sessionResult = await getSession({
      path: { id: sessionID },
      responseStyle: 'data',
      throwOnError: true,
    });
    const session = unwrapDataResult(sessionResult);
    const directory = session.directory;

    if (typeof getProject !== 'function') {
      return { directory };
    }

    try {
      const projectResult = directory
        ? await getProject({
            query: { directory },
            responseStyle: 'data',
            throwOnError: true,
          })
        : await getProject({
            responseStyle: 'data',
            throwOnError: true,
          });
      const project = unwrapDataResult(projectResult);

      return {
        directory,
        worktree: project.worktree,
      };
    } catch {
      return { directory };
    }
  } catch {
    return null;
  }
}

async function resolveProjectPathFromClientPath(
  input: ServerProjectPathResolverInput
): Promise<{ worktree?: string; directory?: string } | null> {
  const getPath = input.client.path?.get;

  if (typeof getPath !== 'function') {
    return null;
  }

  try {
    const pathResult = await getPath({
      responseStyle: 'data',
      throwOnError: true,
    });
    const currentPath = unwrapDataResult(pathResult);

    return {
      directory: currentPath.directory,
      worktree: currentPath.worktree,
    };
  } catch {
    return null;
  }
}

function unwrapDataResult<Result extends object>(
  result: Result | { data: Result }
): Result {
  return 'data' in result ? result.data : result;
}
