import { describe, expect, it } from 'vitest';

import { plannerConfigSchema } from '../../src/domain/planning/planner-config.js';

describe('plannerConfigSchema', () => {
  it('accepts a valid full config', () => {
    const result = plannerConfigSchema.safeParse({
      temperature: 0.5,
      maxDepth: 3,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.temperature).toBe(0.5);
      expect(result.data.maxDepth).toBe(3);
    }
  });

  it('accepts an empty config', () => {
    expect(plannerConfigSchema.safeParse({}).success).toBe(true);
  });

  it('accepts temperature only', () => {
    const result = plannerConfigSchema.safeParse({ temperature: 0.7 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.temperature).toBe(0.7);
      expect(result.data.maxDepth).toBeUndefined();
    }
  });

  it('accepts maxDepth only', () => {
    const result = plannerConfigSchema.safeParse({ maxDepth: 4 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxDepth).toBe(4);
      expect(result.data.temperature).toBeUndefined();
    }
  });

  it('rejects temperature below minimum', () => {
    const result = plannerConfigSchema.safeParse({ temperature: 0 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.path).toEqual(['temperature']);
    }

    const result2 = plannerConfigSchema.safeParse({ temperature: 1.1 });

    expect(result2.success).toBe(false);
    if (!result2.success) {
      expect(result2.error.issues[0]!.path).toEqual(['temperature']);
    }

    const result3 = plannerConfigSchema.safeParse({ maxDepth: 0 });

    expect(result3.success).toBe(false);
    if (!result3.success) {
      expect(result3.error.issues[0]!.path).toEqual(['maxDepth']);
    }
  });

  it('rejects maxDepth above maximum', () => {
    const result = plannerConfigSchema.safeParse({ maxDepth: 11 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.path).toEqual(['maxDepth']);
    }
  });

  it('rejects non-integer maxDepth', () => {
    const result = plannerConfigSchema.safeParse({ maxDepth: 3.5 });

    expect(result.success).toBe(false);
  });

  it('rejects unknown properties', () => {
    const result = plannerConfigSchema.safeParse({ temperature: 0.5, unknown: 'no' });

    expect(result.success).toBe(false);
  });
});
