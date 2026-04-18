import { describe, expect, it } from 'vitest';

import {
  computeBoltzmannSelections,
  computeDepthClamp,
  computeEntropy,
  computeGlobalEntropy,
  evaluateConvergence,
  evaluateValidationFormula,
} from '../../src/domain/planning/brhp-formalism.js';

describe('brhp-formalism', () => {
  it('computes ranked Boltzmann selections that sum to one', () => {
    const selections = computeBoltzmannSelections(
      [
        {
          nodeId: 'a',
          scopeId: 'scope',
          utility: 3,
          localEntropy: 0.2,
          validationPressure: 0,
          depth: 1,
        },
        {
          nodeId: 'b',
          scopeId: 'scope',
          utility: 1,
          localEntropy: 0.6,
          validationPressure: 0.1,
          depth: 2,
        },
      ],
      0.5,
      4
    );

    expect(selections).toHaveLength(2);
    expect(selections[0]?.nodeId).toBe('a');
    expect(selections[0]?.rank).toBe(1);
    expect(selections[0]?.depthClamp).toBe(4);
    expect(
      selections.reduce((sum, selection) => sum + selection.probability, 0)
    ).toBeCloseTo(1, 10);
  });

  it('excludes candidates beyond the active depth clamp', () => {
    const selections = computeBoltzmannSelections(
      [
        {
          nodeId: 'shallow',
          scopeId: 'scope',
          utility: 1,
          localEntropy: 0.2,
          validationPressure: 0,
          depth: 1,
        },
        {
          nodeId: 'deep',
          scopeId: 'scope',
          utility: 100,
          localEntropy: 0.9,
          validationPressure: 0,
          depth: 5,
        },
      ],
      0.5,
      2
    );

    expect(selections).toHaveLength(1);
    expect(selections[0]?.nodeId).toBe('shallow');
  });

  it('clamps depth inversely to normalized temperature', () => {
    expect(
      computeDepthClamp({
        temperature: 0.1,
        minTemperature: 0.1,
        maxTemperature: 1,
        minDepth: 1,
        maxDepth: 5,
      })
    ).toBe(5);

    expect(
      computeDepthClamp({
        temperature: 1,
        minTemperature: 0.1,
        maxTemperature: 1,
        minDepth: 1,
        maxDepth: 5,
      })
    ).toBe(1);
  });

  it('computes Shannon entropy and global frontier entropy', () => {
    expect(computeEntropy([0.5, 0.5])).toBeCloseTo(1, 10);
    expect(
      computeGlobalEntropy([
        { probability: 0.8, localEntropy: 0.5 },
        { probability: 0.2, localEntropy: 1.5 },
      ])
    ).toBeCloseTo(0.7, 10);
  });

  it('marks validation formulas unsatisfied when blocking clauses fail or remain pending', () => {
    const verdict = evaluateValidationFormula({
      scopeId: 'scope-1',
      clauses: [
        {
          id: 'a',
          kind: 'structure',
          blocking: true,
          description: 'graph must be acyclic',
          status: 'passed',
        },
        {
          id: 'b',
          kind: 'dependency',
          blocking: true,
          description: 'dependencies must resolve',
          status: 'pending',
        },
      ],
    });

    expect(verdict.satisfiable).toBe(false);
    expect(verdict.blockingFindings).toBe(0);
    expect(verdict.pendingBlockingClauses).toBe(1);
  });

  it('requires entropy, stability, and validation thresholds for convergence', () => {
    expect(
      evaluateConvergence({
        globalEntropy: 0.1,
        entropyDrift: 0.01,
        frontierStability: 0.95,
        blockingFindings: 0,
        pendingBlockingClauses: 0,
        entropyThreshold: 0.2,
        driftThreshold: 0.05,
        stabilityThreshold: 0.9,
      })
    ).toEqual({ converged: true, reasons: [] });

    expect(
      evaluateConvergence({
        globalEntropy: 0.4,
        entropyDrift: 0.01,
        frontierStability: 0.95,
        blockingFindings: 0,
        pendingBlockingClauses: 0,
        entropyThreshold: 0.2,
        driftThreshold: 0.05,
        stabilityThreshold: 0.9,
      })
    ).toEqual({
      converged: false,
      reasons: ['global entropy exceeds threshold'],
    });

    expect(
      evaluateConvergence({
        globalEntropy: 0.1,
        entropyDrift: -0.2,
        frontierStability: 0.95,
        blockingFindings: 0,
        pendingBlockingClauses: 0,
        entropyThreshold: 0.2,
        driftThreshold: 0.05,
        stabilityThreshold: 0.9,
      })
    ).toEqual({
      converged: false,
      reasons: ['entropy drift exceeds threshold'],
    });
  });
});
