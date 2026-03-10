import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { InstrumentationGrade } from '../../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { LIGHTING_PRESETS } from '../lighting-presets';
import type { AITacticalDoctrine, BattleRunnerConfig, SideConfig } from '../types';

interface SymmetricEliminationConfigOptions {
  gameSize: GameSize;
  modelCount: number;
  archetypeName: string;
  itemNames: string[];
  doctrine?: AITacticalDoctrine;
}

export interface PresetSideTemplate {
  id: string;
  name: string;
  assemblyName: string;
  archetypeName: string;
  modelCount: number;
  itemNames: string[];
  doctrine?: AITacticalDoctrine;
  aiCount?: 0 | 1 | 2;
}

export interface PresetBattleConfigOptions {
  gameSize: GameSize;
  missionId: string;
  sideTemplates: PresetSideTemplate[];
  instrumentationGrade?: InstrumentationGrade;
  terrainDensity?: number;
}

function createSideConfig(
  template: PresetSideTemplate
): SideConfig {
  return {
    id: template.id,
    name: template.name,
    assemblies: [
      {
        name: template.assemblyName,
        archetypeName: template.archetypeName,
        count: template.modelCount,
        itemNames: template.itemNames,
      },
    ],
    ai: {
      count: template.aiCount ?? 1,
      doctrine: template.doctrine ?? 'Balanced',
    },
  };
}

export function createPresetBattleConfig(
  options: PresetBattleConfigOptions
): BattleRunnerConfig {
  return {
    gameSize: options.gameSize,
    terrainDensity: options.terrainDensity ?? 0.50,
    lighting: LIGHTING_PRESETS['Day, Clear'],
    missionId: options.missionId,
    allowWaitAction: false,
    allowHideAction: false,
    sides: options.sideTemplates.map(createSideConfig),
    instrumentationGrade: options.instrumentationGrade ?? InstrumentationGrade.BY_ACTION_WITH_TESTS,
  };
}

export function createSymmetricEliminationConfig(
  options: SymmetricEliminationConfigOptions
): BattleRunnerConfig {
  return createPresetBattleConfig({
    gameSize: options.gameSize,
    missionId: 'QAI_11',
    sideTemplates: [
      {
        id: 'side-a',
        name: 'Side A',
        assemblyName: 'Assembly A',
        archetypeName: options.archetypeName,
        modelCount: options.modelCount,
        itemNames: options.itemNames,
        doctrine: options.doctrine,
      },
      {
        id: 'side-b',
        name: 'Side B',
        assemblyName: 'Assembly B',
        archetypeName: options.archetypeName,
        modelCount: options.modelCount,
        itemNames: options.itemNames,
        doctrine: options.doctrine,
      },
    ],
  });
}
