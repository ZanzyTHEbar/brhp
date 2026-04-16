import path from 'node:path';

import type { EnvironmentPort } from '../ports/environment-port.js';
import type { FileSystemPort } from '../ports/file-system-port.js';
import type { InstructionParserPort } from '../ports/instruction-parser-port.js';
import type {
  InstructionDocument,
  InstructionInventory,
  SkippedInstructionFile,
  InstructionSource,
} from '../../domain/instructions/instruction.js';

export interface LoadInstructionInventoryInput {
  readonly fileSystem: FileSystemPort;
  readonly environment: EnvironmentPort;
  readonly parser: InstructionParserPort;
  readonly projectDirectory: string;
}

export async function loadInstructionInventory(
  input: LoadInstructionInventoryInput
): Promise<InstructionInventory> {
  const directories = resolveInstructionDirectories(
    input.environment,
    input.projectDirectory
  );

  const globalResult = await loadInstructionsFromDirectory({
    fileSystem: input.fileSystem,
    parser: input.parser,
    directory: directories.global,
    source: 'global',
  });

  const projectResult = await loadInstructionsFromDirectory({
    fileSystem: input.fileSystem,
    parser: input.parser,
    directory: directories.project,
    source: 'project',
  });

  const instructions = [...globalResult.instructions, ...projectResult.instructions].sort(
    compareInstructions
  );
  const skippedFiles = [...globalResult.skippedFiles, ...projectResult.skippedFiles];

  return {
    directories,
    instructions,
    counts: {
      global: globalResult.instructions.length,
      project: projectResult.instructions.length,
      total: instructions.length,
      skipped: skippedFiles.length,
    },
    skippedFiles,
  };
}

export function resolveInstructionDirectories(
  environment: EnvironmentPort,
  projectDirectory: string
): InstructionInventory['directories'] {
  const explicitConfigDirectory = environment.get('OPENCODE_CONFIG_DIR');
  const xdgConfigDirectory = environment.get('XDG_CONFIG_HOME');
  const globalRoot = explicitConfigDirectory
    ? explicitConfigDirectory
    : xdgConfigDirectory
      ? path.join(xdgConfigDirectory, 'opencode')
      : path.join(environment.homeDirectory(), '.config', 'opencode');

  return {
    global: path.join(globalRoot, 'brhp', 'instructions'),
    project: path.join(projectDirectory, '.opencode', 'brhp', 'instructions'),
  };
}

async function loadInstructionsFromDirectory(input: {
  readonly fileSystem: FileSystemPort;
  readonly parser: InstructionParserPort;
  readonly directory: string;
  readonly source: InstructionSource;
}): Promise<{
  instructions: InstructionDocument[];
  skippedFiles: SkippedInstructionFile[];
}> {
  const exists = await input.fileSystem.exists(input.directory);

  if (!exists) {
    return { instructions: [], skippedFiles: [] };
  }

  const filePaths = await collectInstructionFiles(input.fileSystem, input.directory);
  const instructions: InstructionDocument[] = [];
  const skippedFiles: SkippedInstructionFile[] = [];

  for (const filePath of filePaths) {
    const relativePath = path.relative(input.directory, filePath);
    let content: string;

    try {
      content = await input.fileSystem.readTextFile(filePath);
    } catch {
      skippedFiles.push({
        absolutePath: filePath,
        relativePath,
        source: input.source,
        reason: 'read error',
      });

      continue;
    }

    try {
      const result = input.parser.parseInstructionDocument({
        absolutePath: filePath,
        relativePath,
        source: input.source,
        content,
      });

      if (result.kind === 'loaded') {
        instructions.push(result.instruction);
      } else {
        skippedFiles.push({
          absolutePath: filePath,
          relativePath,
          source: input.source,
          reason: result.reason,
        });
      }
    } catch {
      skippedFiles.push({
        absolutePath: filePath,
        relativePath,
        source: input.source,
        reason: 'parse error',
      });
    }
  }

  return { instructions, skippedFiles };
}

async function collectInstructionFiles(
  fileSystem: FileSystemPort,
  directory: string
): Promise<string[]> {
  const entries = await fileSystem.readDirectory(directory);
  const results: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) {
      results.push(...(await collectInstructionFiles(fileSystem, entry.path)));
      continue;
    }

    if (!entry.isFile) {
      continue;
    }

    if (entry.name.endsWith('.md') || entry.name.endsWith('.mdc')) {
      results.push(entry.path);
    }
  }

  return results.sort((left, right) => left.localeCompare(right));
}

function compareInstructions(left: InstructionDocument, right: InstructionDocument): number {
  const sourceComparison = sourceOrder(left.source) - sourceOrder(right.source);

  if (sourceComparison !== 0) {
    return sourceComparison;
  }

  const orderComparison = left.order - right.order;

  if (orderComparison !== 0) {
    return orderComparison;
  }

  return left.relativePath.localeCompare(right.relativePath);
}

function sourceOrder(source: InstructionSource): number {
  return source === 'global' ? 0 : 1;
}
