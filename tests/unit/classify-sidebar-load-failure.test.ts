import { describe, expect, it } from 'vitest';

import { classifySidebarLoadFailure } from '../../src/application/use-cases/classify-sidebar-load-failure.js';

describe('classifySidebarLoadFailure', () => {
  it('maps instruction inventory failures to BRHP instruction wording', () => {
    expect(classifySidebarLoadFailure('instructions')).toEqual({
      kind: 'instructions',
      message: 'Unable to load BRHP instructions',
    });
  });

  it('maps planner runtime failures to BRHP planning wording', () => {
    expect(classifySidebarLoadFailure('planner-runtime')).toEqual({
      kind: 'planner-runtime',
      message: 'Unable to load BRHP planner runtime',
    });
  });

  it('maps unknown failures to generic BRHP sidebar wording', () => {
    expect(classifySidebarLoadFailure('unknown')).toEqual({
      kind: 'unknown',
      message: 'Unable to load BRHP sidebar state',
    });
  });
});
