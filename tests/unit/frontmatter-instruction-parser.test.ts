import { describe, expect, it } from 'vitest';

import { parseInstructionDocument } from '../../src/adapters/instructions/frontmatter-instruction-parser.js';

describe('parseInstructionDocument', () => {
  it('parses UTF-8 BOM and CRLF frontmatter documents', () => {
    const result = parseInstructionDocument({
      absolutePath: '/repo/instructions/windows.md',
      relativePath: 'windows.md',
      source: 'project',
      content: '\uFEFF---\r\ntitle: Windows doc\r\ndescription: Uses CRLF\r\norder: 3\r\n---\r\n\r\n# Heading\r\n\r\nBody text.\r\n',
    });

    expect(result).toEqual({
      kind: 'loaded',
      instruction: {
        id: 'project:windows.md',
        title: 'Windows doc',
        description: 'Uses CRLF',
        body: '# Heading\r\n\r\nBody text.',
        source: 'project',
        absolutePath: '/repo/instructions/windows.md',
        relativePath: 'windows.md',
        extension: '.md',
        order: 3,
      },
    });
  });

  it('reports disabled and empty documents as skipped', () => {
    expect(
      parseInstructionDocument({
        absolutePath: '/repo/instructions/disabled.md',
        relativePath: 'disabled.md',
        source: 'global',
        content: ['---', 'enabled: false', '---', '', '# Hidden', '', 'Ignore this.'].join('\n'),
      })
    ).toEqual({
      kind: 'skipped',
      reason: 'disabled',
    });

    expect(
      parseInstructionDocument({
        absolutePath: '/repo/instructions/empty.mdc',
        relativePath: 'empty.mdc',
        source: 'project',
        content: ['---', 'title: Empty', '---', '', '   '].join('\n'),
      })
    ).toEqual({
      kind: 'skipped',
      reason: 'empty body',
    });
  });

  it('falls back to markdown heading and filename for titles', () => {
    const headingResult = parseInstructionDocument({
      absolutePath: '/repo/instructions/heading.md',
      relativePath: 'heading.md',
      source: 'project',
      content: ['---', 'order: 1', '---', '', '# Derived heading', '', 'Body text.'].join('\n'),
    });

    const filenameResult = parseInstructionDocument({
      absolutePath: '/repo/instructions/fallback.mdc',
      relativePath: 'nested/fallback.mdc',
      source: 'project',
      content: 'Body only.',
    });

    expect(headingResult).toMatchObject({
      kind: 'loaded',
      instruction: {
        title: 'Derived heading',
      },
    });
    expect(filenameResult).toMatchObject({
      kind: 'loaded',
      instruction: {
        title: 'fallback',
      },
    });
  });
});
