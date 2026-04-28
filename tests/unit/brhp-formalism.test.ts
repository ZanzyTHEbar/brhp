import { describe, expect, it } from 'vitest';

import {
  computeBoltzmannSelections,
  computeDepthClamp,
  computeEntropy,
  computeGlobalEntropy,
  computeValidationPressure,
  evaluateCoverageClosure,
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

  it('uses validation pressure to break ties and increase selection probability', () => {
    const selections = computeBoltzmannSelections(
      [
        {
          nodeId: 'low-pressure',
          scopeId: 'scope',
          utility: 1,
          localEntropy: 0.2,
          validationPressure: 0,
          depth: 1,
        },
        {
          nodeId: 'high-pressure',
          scopeId: 'scope',
          utility: 1,
          localEntropy: 0.2,
          validationPressure: 0.5,
          depth: 1,
        },
      ],
      0.5,
      4
    );

    expect(selections[0]?.nodeId).toBe('high-pressure');
    expect(selections[0]?.probability ?? 0).toBeGreaterThan(selections[1]?.probability ?? 0);
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

  it('requires at least one blocking coverage clause and all such clauses passed for coverage closure', () => {
    expect(
      evaluateCoverageClosure([
        {
          kind: 'schema',
          blocking: true,
          status: 'passed',
        },
      ])
    ).toBe(false);

    expect(
      evaluateCoverageClosure([
        {
          kind: 'coverage',
          blocking: true,
          status: 'pending',
        },
      ])
    ).toBe(false);

    expect(
      evaluateCoverageClosure([
        {
          kind: 'coverage',
          blocking: true,
          status: 'passed',
        },
        {
          kind: 'coverage',
          blocking: true,
          status: 'passed',
        },
      ])
    ).toBe(true);
  });

  it('computes validation pressure from verdict severity, status, and depth', () => {
    const verdict = evaluateValidationFormula({
      scopeId: 'scope-1',
      clauses: [
        {
          id: 'a',
          kind: 'conflict',
          blocking: true,
          description: 'A blocking conflict remains.',
          status: 'failed',
        },
      ],
    });

    expect(
      computeValidationPressure({
        verdict,
        status: 'active',
        depth: 0,
      })
    ).toBe(1);
    expect(
      computeValidationPressure({
        verdict,
        status: 'blocked',
        depth: 1,
      })
    ).toBeCloseTo(0.625, 10);
    expect(
      computeValidationPressure({
        verdict: {
          ...verdict,
          satisfiable: true,
          blockingFindings: 0,
          pendingBlockingClauses: 0,
        },
        status: 'active',
        depth: 0,
      })
    ).toBe(0);
  });

  it('requires entropy, stability, and validation thresholds for convergence', () => {
    expect(
      evaluateConvergence({
        globalEntropy: 0.1,
        entropyDrift: 0.01,
        frontierStability: 0.95,
        blockingFindings: 0,
        pendingBlockingClauses: 0,
        hasStructuralRefinement: true,
        hasCoverageClosure: true,
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
        hasStructuralRefinement: true,
        hasCoverageClosure: true,
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
        hasStructuralRefinement: true,
        hasCoverageClosure: true,
        entropyThreshold: 0.2,
        driftThreshold: 0.05,
        stabilityThreshold: 0.9,
      })
    ).toEqual({
      converged: false,
      reasons: ['entropy drift exceeds threshold'],
    });

    expect(
      evaluateConvergence({
        globalEntropy: 0.1,
        entropyDrift: 0.01,
        frontierStability: 0.95,
        blockingFindings: 0,
        pendingBlockingClauses: 0,
        hasStructuralRefinement: false,
        hasCoverageClosure: true,
        entropyThreshold: 0.2,
        driftThreshold: 0.05,
        stabilityThreshold: 0.9,
      })
    ).toEqual({
      converged: false,
      reasons: ['no structural refinement has been recorded'],
    });

    expect(
      evaluateConvergence({
        globalEntropy: 0.1,
        entropyDrift: 0.01,
        frontierStability: 0.95,
        blockingFindings: 0,
        pendingBlockingClauses: 0,
        hasStructuralRefinement: true,
        hasCoverageClosure: false,
        entropyThreshold: 0.2,
        driftThreshold: 0.05,
        stabilityThreshold: 0.9,
      })
    ).toEqual({
      converged: false,
      reasons: ['coverage closure has not been established'],
    });
  });
});
