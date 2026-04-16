import type {
  InstructionDocument,
  InstructionSource,
  SkippedInstructionReason,
} from '../../domain/instructions/instruction.js';

export interface ParseInstructionDocumentInput {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly source: InstructionSource;
  readonly content: string;
}

export type ParseInstructionDocumentResult =
  | {
      readonly kind: 'loaded';
      readonly instruction: InstructionDocument;
    }
  | {
      readonly kind: 'skipped';
      readonly reason: SkippedInstructionReason;
    };

export interface InstructionParserPort {
  parseInstructionDocument(
    input: ParseInstructionDocumentInput
  ): ParseInstructionDocumentResult;
}
