import { describe, expect, it } from 'vitest';

import {
  resolveProjectWorktreePath,
  resolveRuntimeProjectPath,
  resolveServerProjectWorktreePath,
  resolveServerProjectWorktreePathWithoutSession,
} from '../../src/composition/resolve-project-worktree-path.js';

describe('resolveProjectWorktreePath', () => {
  it('prefers project.worktree over root-like worktree and directory candidates', () => {
    expect(
      resolveProjectWorktreePath({
        project: { worktree: '/tmp/brhp-integration-project' } as never,
        worktree: '/',
        directory: '/',
      })
    ).toBe('/tmp/brhp-integration-project');
  });

  it('falls back to the first non-root runtime path', () => {
    expect(resolveRuntimeProjectPath('/', '/tmp/brhp-integration-project')).toBe(
      '/tmp/brhp-integration-project'
    );
  });

  it('resolves the server project path from live session and project metadata', async () => {
    await expect(
      resolveServerProjectWorktreePath(
        {
          client: {
            session: {
              async get() {
                return { directory: '/tmp/brhp-integration-project' };
              },
            },
            project: {
              async current(options) {
                expect(options).toMatchObject({
                  query: { directory: '/tmp/brhp-integration-project' },
                  responseStyle: 'data',
                  throwOnError: true,
                });
                return { worktree: '/tmp/brhp-integration-project' };
              },
            },
          },
          project: { worktree: '/' } as never,
          worktree: '/',
          directory: '/',
        },
        'session-1'
      )
    ).resolves.toBe('/tmp/brhp-integration-project');
  });

  it('falls back to the live session directory when project lookup fails', async () => {
    await expect(
      resolveServerProjectWorktreePath(
        {
          client: {
            session: {
              async get() {
                return { directory: '/tmp/brhp-integration-project' };
              },
            },
            project: {
              async current() {
                throw new Error('project lookup failed');
              },
            },
          },
          project: { worktree: '/' } as never,
          worktree: '/',
          directory: '/',
        },
        'session-1'
      )
    ).resolves.toBe('/tmp/brhp-integration-project');
  });

  it('falls back to the live instance path when session lookup is unavailable', async () => {
    await expect(
      resolveServerProjectWorktreePath(
        {
          client: {
            path: {
              async get() {
                return {
                  directory: '/tmp/brhp-integration-project',
                  worktree: '/tmp/brhp-integration-project',
                };
              },
            },
          },
          project: { worktree: '/' } as never,
          worktree: '/',
          directory: '/',
        },
        'session-1'
      )
    ).resolves.toBe('/tmp/brhp-integration-project');
  });

  it('prefers runtime candidates over live instance path when session lookup fails', async () => {
    await expect(
      resolveServerProjectWorktreePath(
        {
          client: {
            session: {
              async get() {
                throw new Error('session lookup failed');
              },
            },
            path: {
              async get() {
                return {
                  directory: '/tmp/other-project',
                  worktree: '/tmp/other-project',
                };
              },
            },
          },
          project: { worktree: '/' } as never,
          worktree: '/',
          directory: '/',
        },
        'session-1',
        {
          worktree: '/',
          directory: '/tmp/brhp-integration-project',
        }
      )
    ).resolves.toBe('/tmp/brhp-integration-project');
  });

  it('resolves the server project path without a session from the live instance path', async () => {
    await expect(
      resolveServerProjectWorktreePathWithoutSession({
        client: {
          path: {
            async get() {
              return {
                directory: '/tmp/brhp-integration-project',
                worktree: '/tmp/brhp-integration-project',
              };
            },
          },
        },
        project: { worktree: '/' } as never,
        worktree: '/',
        directory: '/',
      })
    ).resolves.toBe('/tmp/brhp-integration-project');
  });

  it('returns the root path only when every candidate resolves to root', () => {
    expect(resolveRuntimeProjectPath('/', '/')).toBe('/');
  });

  it('throws when no runtime project path can be resolved', () => {
    expect(() => resolveRuntimeProjectPath(undefined, '', null)).toThrow(
      'Unable to resolve a runtime project path from the current OpenCode context'
    );
  });
});
