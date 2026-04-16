import path from 'node:path';

import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import type {
  SkippedInstructionReason,
} from '../../domain/instructions/instruction.js';
import type {
  InstructionParserPort,
  ParseInstructionDocumentInput,
  ParseInstructionDocumentResult,
} from '../../application/ports/instruction-parser-port.js';

const instructionFrontmatterSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    order: z.coerce.number().int().optional(),
    enabled: z.boolean().optional(),
  })
  .passthrough();

export class FrontmatterInstructionParserAdapter implements InstructionParserPort {
  parseInstructionDocument(
    input: ParseInstructionDocumentInput
  ): ParseInstructionDocumentResult {
    return parseInstructionDocument(input);
  }
}

export function parseInstructionDocument(
  input: ParseInstructionDocumentInput
): ParseInstructionDocumentResult {
  const extension = path.extname(input.absolutePath);

  if (extension !== '.md' && extension !== '.mdc') {
    return skipped('unsupported extension');
  }

  const parsed = splitFrontmatter(input.content);

  if (!parsed.ok) {
    return skipped('invalid frontmatter');
  }

  const metadataResult = instructionFrontmatterSchema.safeParse(parsed.metadata ?? {});

  if (!metadataResult.success) {
    return skipped('invalid frontmatter');
  }

  const metadata = metadataResult.data;

  if (metadata.enabled === false) {
    return skipped('disabled');
  }

  const body = parsed.body.trim();

  if (body.length === 0) {
    return skipped('empty body');
  }

  const title = metadata.title ?? extractMarkdownTitle(body) ?? fallbackTitle(input.relativePath);

  return {
    kind: 'loaded',
    instruction: {
      id: `${input.source}:${input.relativePath}`,
      title,
      body,
      source: input.source,
      absolutePath: input.absolutePath,
      relativePath: input.relativePath,
      extension,
      order: metadata.order ?? 0,
      ...(metadata.description ? { description: metadata.description } : {}),
    },
  };
}

function splitFrontmatter(content: string):
  | {
      readonly ok: true;
      readonly metadata?: Record<string, unknown>;
      readonly body: string;
    }
  | {
      readonly ok: false;
      readonly body: string;
    } {
  const normalizedContent = stripUtf8Bom(content);

  if (!startsWithFrontmatter(normalizedContent)) {
    return { ok: true, body: normalizedContent };
  }

  const lineSeparatorLength = lineSeparatorLengthAt(normalizedContent, 3);
  const contentStart = 3 + lineSeparatorLength;
  const closingMatch = normalizedContent.slice(contentStart).match(/(?:\r\n|\n)---(?:\r\n|\n)/);

  if (!closingMatch || closingMatch.index === undefined) {
    return { ok: true, body: normalizedContent };
  }

  const closingIndex = contentStart + closingMatch.index;
  const rawFrontmatter = normalizedContent.slice(contentStart, closingIndex);
  const body = normalizedContent.slice(closingIndex + closingMatch[0].length);

  let metadata: unknown;

  try {
    metadata = parseYaml(rawFrontmatter);
  } catch {
    return { ok: false, body: normalizedContent };
  }

  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return {
      ok: true,
      metadata: metadata as Record<string, unknown>,
      body,
    };
  }

  return { ok: true, body };
}

function extractMarkdownTitle(body: string): string | undefined {
  const heading = body.match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim();
}

function fallbackTitle(relativePath: string): string {
  return path.basename(relativePath, path.extname(relativePath));
}

function stripUtf8Bom(content: string): string {
  return content.startsWith('\uFEFF') ? content.slice(1) : content;
}

function startsWithFrontmatter(content: string): boolean {
  return content.startsWith('---\n') || content.startsWith('---\r\n');
}

function lineSeparatorLengthAt(content: string, index: number): number {
  return content[index] === '\r' && content[index + 1] === '\n' ? 2 : 1;
}

function skipped(reason: SkippedInstructionReason): ParseInstructionDocumentResult {
  return {
    kind: 'skipped',
    reason,
  };
}
