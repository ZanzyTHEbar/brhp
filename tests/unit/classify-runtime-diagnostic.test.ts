import { describe, expect, it } from 'vitest';

import { classifyRuntimeDiagnostic } from '../../src/application/use-cases/classify-runtime-diagnostic.js';

describe('classifyRuntimeDiagnostic', () => {
  it('maps instruction failures to stable BRHP wording', () => {
    expect(classifyRuntimeDiagnostic('instructions')).toEqual({
      kind: 'instructions',
      message: 'Unable to load BRHP instructions',
    });
  });

  it('maps planner runtime failures to stable BRHP wording', () => {
    expect(classifyRuntimeDiagnostic('planner-runtime')).toEqual({
      kind: 'planner-runtime',
      message: 'Unable to load BRHP planner runtime',
    });
  });

  it('maps unknown runtime failures to stable BRHP wording', () => {
    expect(classifyRuntimeDiagnostic('unknown')).toEqual({
      kind: 'unknown',
      message: 'Unable to load BRHP runtime state',
    });
  });

  it('preserves causes for later operator inspection without formatting them', () => {
    const cause = new Error('open failed');

    expect(classifyRuntimeDiagnostic('planner-runtime', cause)).toEqual({
      kind: 'planner-runtime',
      message: 'Unable to load BRHP planner runtime',
      cause,
    });
  });
});
