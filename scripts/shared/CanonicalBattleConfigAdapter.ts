import { TacticalDoctrine } from '../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type { GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';
import { getVisibilityOrForLighting, type LightingCondition } from '../../src/lib/mest-tactics/utils/visibility';
import { GAME_SIZE_CONFIG, type GameConfig, type SideConfig } from './AIBattleConfig';
import type { AuditLevel } from '../ai-battle/AIBattleConfig';
import { MISSION_NAME_BY_ID, resolveMissionName } from './MissionCatalog';

export interface SeededModel {
  archetypeId: string;
  items: string[];
}

export interface LegacyAssemblyInput {
  name?: string;
  archetypeName?: string;
  count?: number;
  itemNames?: string[];
}

export interface LegacySideInput {
  name: string;
  bp?: number;
  modelCount?: number;
  assemblyName?: string;
  tacticalDoctrine?: TacticalDoctrine;
  ai?: { doctrine?: string };
  assemblies?: LegacyAssemblyInput[];
}

export interface CanonicalGameConfigBuildInput {
  missionId?: string;
  missionName?: string;
  gameSize: GameSize;
  sides: SideConfig[];
  densityRatio?: number;
  lighting?: LightingCondition;
  allowWaitAction?: boolean;
  allowHideAction?: boolean;
  verbose?: boolean;
  seed?: number;
  audit?: boolean;
  viewer?: boolean;
  auditLevel?: AuditLevel;
  battlefieldPath?: string;
  initiativeCardTieBreakerOnTie?: boolean;
  initiativeCardHolderSideId?: string;
}

export { MISSION_NAME_BY_ID } from './MissionCatalog';

export function mapDoctrine(doctrine: string | undefined): TacticalDoctrine {
  const normalized = String(doctrine || '').trim().toLowerCase();
  const doctrineValues = new Set<string>(Object.values(TacticalDoctrine));
  if (doctrineValues.has(normalized)) {
    return normalized as TacticalDoctrine;
  }

  switch (normalized) {
    case 'aggressive':
      return TacticalDoctrine.Aggressive;
    case 'defensive':
      return TacticalDoctrine.Defensive;
    case 'objective':
      return TacticalDoctrine.Objective;
    case 'opportunistic':
      return TacticalDoctrine.Opportunistic;
    case 'balanced':
    default:
      return TacticalDoctrine.Balanced;
  }
}

export function buildSeededModels(side: LegacySideInput): SeededModel[] {
  const models: SeededModel[] = [];
  for (const assembly of side.assemblies ?? []) {
    const count = Math.max(0, Number(assembly.count) || 0);
    for (let i = 0; i < count; i++) {
      models.push({
        archetypeId: String(assembly.archetypeName || 'Average'),
        items: Array.isArray(assembly.itemNames) ? assembly.itemNames.filter(Boolean) : [],
      });
    }
  }
  return models;
}

function normalizeDensityRatio(raw: number | undefined): number {
  if (!Number.isFinite(raw)) return 50;
  const asNumber = Number(raw);
  const asPercent = asNumber >= 0 && asNumber <= 1 ? asNumber * 100 : asNumber;
  return Math.max(0, Math.min(100, Math.round(asPercent)));
}

export function toCanonicalSideConfig(side: LegacySideInput, gameSize: GameSize): SideConfig {
  const models = buildSeededModels(side);
  const sizeConfig = GAME_SIZE_CONFIG[gameSize];
  const defaultBp = sizeConfig?.bpPerSide?.[1] ?? 250;
  const baselineCount = Math.max(1, sizeConfig?.modelsPerSide?.[1] ?? 1);
  const fallbackCount = (side.assemblies ?? []).reduce((sum, assembly) => sum + (Number(assembly.count) || 0), 0);
  const resolvedCount = side.modelCount ?? (models.length || fallbackCount || 1);
  const primaryAssemblyName = side.assemblyName ?? side.assemblies?.[0]?.name ?? `${side.name} Assembly`;
  const bp = side.bp ?? Math.round(defaultBp * (resolvedCount / baselineCount));

  return {
    name: side.name,
    bp: Math.max(1, bp),
    modelCount: resolvedCount,
    tacticalDoctrine: side.tacticalDoctrine ?? mapDoctrine(side.ai?.doctrine),
    assemblyName: primaryAssemblyName,
    models,
  };
}

export function createDefaultHeadToHeadSides(
  gameSize: GameSize,
  doctrine: TacticalDoctrine = TacticalDoctrine.Balanced
): SideConfig[] {
  const sizeConfig = GAME_SIZE_CONFIG[gameSize];
  const bp = sizeConfig?.bpPerSide?.[1] ?? 250;
  const modelCount = sizeConfig?.modelsPerSide?.[1] ?? 3;
  return [
    {
      name: 'Alpha',
      bp,
      modelCount,
      tacticalDoctrine: doctrine,
      assemblyName: 'Alpha Assembly',
    },
    {
      name: 'Bravo',
      bp,
      modelCount,
      tacticalDoctrine: doctrine,
      assemblyName: 'Bravo Assembly',
    },
  ];
}

export function buildCanonicalGameConfig(input: CanonicalGameConfigBuildInput): GameConfig {
  const missionId = String(input.missionId || 'QAI_11');
  const lighting = input.lighting ?? 'Day, Clear';
  const sizeConfig = GAME_SIZE_CONFIG[input.gameSize];
  const auditLevel: AuditLevel = input.auditLevel
    ?? ((input.viewer || input.audit) ? 'full' : 'none');

  return {
    missionId,
    missionName: input.missionName ?? resolveMissionName(missionId),
    gameSize: input.gameSize,
    battlefieldWidth: sizeConfig?.battlefieldWidth ?? 24,
    battlefieldHeight: sizeConfig?.battlefieldHeight ?? 24,
    maxTurns: sizeConfig?.maxTurns ?? 8,
    endGameTurn: sizeConfig?.endGameTurn ?? 4,
    sides: input.sides,
    densityRatio: normalizeDensityRatio(input.densityRatio),
    lighting,
    visibilityOrMu: getVisibilityOrForLighting(lighting),
    maxOrm: 3,
    allowConcentrateRangeExtension: true,
    perCharacterFovLos: false,
    allowWaitAction: input.allowWaitAction ?? false,
    allowHideAction: input.allowHideAction ?? false,
    verbose: input.verbose ?? true,
    seed: input.seed,
    audit: input.audit,
    viewer: input.viewer,
    auditLevel,
    battlefieldPath: input.battlefieldPath,
    initiativeCardTieBreakerOnTie: input.initiativeCardTieBreakerOnTie ?? true,
    initiativeCardHolderSideId: input.initiativeCardHolderSideId,
  };
}
