import { ProcessEnvironmentAdapter } from '../adapters/environment/process-environment.js';
import { NodeFileSystemAdapter } from '../adapters/filesystem/node-file-system.js';
import { FrontmatterInstructionParserAdapter } from '../adapters/instructions/frontmatter-instruction-parser.js';
import { loadInstructionInventory } from '../application/use-cases/load-instruction-inventory.js';

export function createInstructionInventoryLoader(projectDirectory: string) {
  const fileSystem = new NodeFileSystemAdapter();
  const environment = new ProcessEnvironmentAdapter();
  const parser = new FrontmatterInstructionParserAdapter();

  return () =>
    loadInstructionInventory({
      fileSystem,
      environment,
      parser,
      projectDirectory,
    });
}
