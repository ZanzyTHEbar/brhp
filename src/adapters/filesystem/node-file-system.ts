import nodePath from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';

import type {
  FileSystemEntry,
  FileSystemPort,
} from '../../application/ports/file-system-port.js';

export class NodeFileSystemAdapter implements FileSystemPort {
  async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async readDirectory(directoryPath: string): Promise<readonly FileSystemEntry[]> {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    return entries
      .map(entry => ({
        name: entry.name,
        path: nodePath.join(directoryPath, entry.name),
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async readTextFile(path: string): Promise<string> {
    return readFile(path, 'utf8');
  }
}
