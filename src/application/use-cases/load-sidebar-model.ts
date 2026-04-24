import type { InstructionInventory } from '../../domain/instructions/instruction.js';
import type { SidebarModel } from '../../domain/sidebar/sidebar-model.js';
import type { PlanningState } from '../../domain/planning/planning-session.js';
import { buildSidebarModel } from './build-sidebar-model.js';
import {
  classifySidebarLoadFailure,
  type SidebarLoadFailure,
} from './classify-sidebar-load-failure.js';

export type { SidebarLoadFailure } from './classify-sidebar-load-failure.js';

export type SidebarLoadResult =
  | {
      readonly ok: true;
      readonly model: SidebarModel;
    }
  | {
      readonly ok: false;
      readonly failure: SidebarLoadFailure;
    };

export async function loadSidebarModel(input: {
  readonly loadInventory: () => Promise<InstructionInventory>;
  readonly loadPlanningState: () => Promise<PlanningState | null>;
}): Promise<SidebarLoadResult> {
  let inventory: InstructionInventory;
  let planningState: PlanningState | null;

  try {
    inventory = await input.loadInventory();
  } catch {
    return {
      ok: false,
      failure: classifySidebarLoadFailure('instructions'),
    };
  }

  try {
    planningState = await input.loadPlanningState();
  } catch {
    return {
      ok: false,
      failure: classifySidebarLoadFailure('planner-runtime'),
    };
  }

  return {
    ok: true,
    model: buildSidebarModel(inventory, planningState),
  };
}
