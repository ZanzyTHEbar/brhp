import { z } from 'zod';

const plannerConfigTemperatureSchema = z
  .number()
  .min(0.001)
  .max(1)
  .describe('Exploration temperature for Boltzmann frontier selection');

const plannerConfigMaxDepthSchema = z
  .number()
  .int()
  .min(1)
  .max(10)
  .describe('Maximum recursion depth for scope decomposition');

export const plannerConfigSchema = z
  .object({
    temperature: plannerConfigTemperatureSchema.optional(),
    maxDepth: plannerConfigMaxDepthSchema.optional(),
  })
  .strict();

export type PlannerConfig = z.infer<typeof plannerConfigSchema>;
