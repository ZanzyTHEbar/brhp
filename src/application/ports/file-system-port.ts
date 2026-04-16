export interface FileSystemEntry {
  readonly name: string;
  readonly path: string;
  readonly isDirectory: boolean;
  readonly isFile: boolean;
}

export interface FileSystemPort {
  exists(path: string): Promise<boolean>;
  readDirectory(path: string): Promise<readonly FileSystemEntry[]>;
  readTextFile(path: string): Promise<string>;
}
