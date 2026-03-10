import type { GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';
import type { InstrumentationGrade } from '../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';

export type AITacticalDoctrine = 'Aggressive' | 'Defensive' | 'Balanced' | 'Objective' | 'Opportunistic';

export interface SideAIConfig {
  count: 0 | 1 | 2;
  doctrine: AITacticalDoctrine;
}

export interface AssemblyConfig {
  name: string;
  archetypeName: string;
  count: number;
  itemNames: string[];
}

export interface SideConfig {
  id: string;
  name: string;
  assemblies: AssemblyConfig[];
  ai: SideAIConfig;
}

export interface LightingPreset {
  name: string;
  visibilityOR: number;
  description: string;
}

export interface BattleRunnerConfig {
  missionId: string;
  gameSize: GameSize;
  sides: SideConfig[];
  terrainDensity: number;
  battlefieldPath?: string;
  lighting: LightingPreset;
  seed?: number;
  instrumentationGrade: InstrumentationGrade;
  allowWaitAction?: boolean;
  allowHideAction?: boolean;
  audit?: boolean;
  viewer?: boolean;
}
