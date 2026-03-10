import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { getBaseDiameterFromSiz } from '../../../src/lib/mest-tactics/battlefield/spatial/size-utils';
import { MissionSide, ModelSlotStatus } from '../../../src/lib/mest-tactics/mission/MissionSide';
import { ObjectiveMarkerManager } from '../../../src/lib/mest-tactics/mission/objective-markers';
import type { GameConfig } from '../../shared/AIBattleConfig';
import type { ModelStateAudit } from '../../shared/BattleReportTypes';
import type { MissionRuntimeUpdate } from '../../../src/lib/mest-tactics/missions/mission-runtime-adapter';

export function createMissionSidesForRunner(
  config: GameConfig,
  sides: Array<{ characters: Character[]; totalBP: number }>
): MissionSide[] {
  return sides.map((sideRoster, sideIndex) => {
    const sideName = config.sides[sideIndex]?.name ?? `Side ${sideIndex + 1}`;
    return {
      id: sideName,
      name: sideName,
      assemblies: [],
      members: sideRoster.characters.map((character, modelIndex) => ({
        id: character.id,
        character,
        profile: character.profile,
        assembly: {
          name: `${sideName}-assembly`,
          characters: [character.id],
          totalBP: character.profile.totalBp ?? 0,
          totalCharacters: 1,
        },
        portrait: {
          sheet: 'default',
          column: modelIndex,
          row: sideIndex,
          name: `${sideName}-${modelIndex + 1}`,
        } as any,
        position: undefined,
        status: ModelSlotStatus.Ready,
        isVIP: false,
        objectiveMarkers: [],
      })),
      totalBP: sideRoster.totalBP ?? 0,
      deploymentZones: [],
      state: {
        currentTurn: 0,
        activatedModels: new Set<string>(),
        readyModels: new Set<string>(sideRoster.characters.map(character => character.id)),
        woundsThisTurn: 0,
        eliminatedModels: [],
        victoryPoints: 0,
        resourcePoints: 0,
        predictedVp: 0,
        predictedRp: 0,
        keyScores: {},
        initiativePoints: 0,
        missionState: {},
      },
      objectiveMarkerManager: new ObjectiveMarkerManager(),
    };
  });
}

export function buildMissionModelsForRunner(
  battlefield: Battlefield,
  missionSides: MissionSide[]
): any[] {
  const models: any[] = [];
  for (const side of missionSides) {
    for (const member of side.members) {
      const character = member.character;
      const position = battlefield.getCharacterPosition(character);
      if (!position) continue;
      const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
      models.push({
        id: member.id,
        sideId: side.id,
        position,
        baseDiameter: getBaseDiameterFromSiz(siz),
        bp: member.profile?.totalBp ?? 0,
        isKOd: character.state.isKOd,
        isEliminated: character.state.isEliminated,
        isOrdered: character.state.isOrdered,
        isAttentive: character.state.isAttentive,
      });
    }
  }
  return models;
}

export function applyMissionRuntimeUpdateForRunner(params: {
  update: MissionRuntimeUpdate | null | undefined;
  missionSideIds: string[];
  missionVpBySide: Record<string, number>;
  missionRpBySide: Record<string, number>;
  missionImmediateWinnerSideId: string | null;
}): {
  missionVpBySide: Record<string, number>;
  missionRpBySide: Record<string, number>;
  missionImmediateWinnerSideId: string | null;
} {
  const {
    update,
    missionSideIds,
    missionVpBySide,
    missionRpBySide,
    missionImmediateWinnerSideId,
  } = params;
  if (!update) {
    return { missionVpBySide, missionRpBySide, missionImmediateWinnerSideId };
  }

  const nextVpBySide = { ...missionVpBySide };
  const nextRpBySide = { ...missionRpBySide };
  let nextWinner = missionImmediateWinnerSideId;

  if (missionSideIds.length > 0) {
    for (const sideId of missionSideIds) {
      if (nextVpBySide[sideId] === undefined) {
        nextVpBySide[sideId] = 0;
      }
      if (nextRpBySide[sideId] === undefined) {
        nextRpBySide[sideId] = 0;
      }
    }
  }
  const delta = update.delta;
  for (const [sideId, vp] of Object.entries(delta.vpBySide ?? {})) {
    nextVpBySide[sideId] = (nextVpBySide[sideId] ?? 0) + vp;
  }
  for (const [sideId, rp] of Object.entries(delta.rpBySide ?? {})) {
    nextRpBySide[sideId] = (nextRpBySide[sideId] ?? 0) + rp;
  }
  if (update.immediateWinnerSideId) {
    nextWinner = update.immediateWinnerSideId;
  }
  return {
    missionVpBySide: nextVpBySide,
    missionRpBySide: nextRpBySide,
    missionImmediateWinnerSideId: nextWinner,
  };
}

export function resolveMissionWinnerNameForRunner(params: {
  missionImmediateWinnerSideId: string | null;
  missionVpBySide: Record<string, number>;
}): string | null {
  if (params.missionImmediateWinnerSideId) {
    return params.missionImmediateWinnerSideId;
  }
  const entries = Object.entries(params.missionVpBySide);
  if (entries.length === 0) {
    return null;
  }
  entries.sort((a, b) => b[1] - a[1]);
  if (entries.length > 1 && entries[0][1] === entries[1][1]) {
    return null;
  }
  return entries[0][0];
}

export function applyMissionStartOverridesForRunner(
  config: GameConfig,
  sides: Array<{ characters: Character[] }>,
  setWaiting: (character: Character) => void
): void {
  const defenderStartsInWait = new Set(['QAI_13', 'QAI_16', 'QAI_18', 'QAI_19', 'QAI_20']);
  if (!defenderStartsInWait.has(config.missionId)) {
    return;
  }
  const defenderSide = sides[0];
  if (!defenderSide) {
    return;
  }
  for (const character of defenderSide.characters) {
    if (character.state.isEliminated || character.state.isKOd) continue;
    setWaiting(character);
  }
}

export function findCharacterPositionForRunner(params: {
  character: Character;
  currentBattlefield: Battlefield | null;
  missionSides: MissionSide[];
}): { x: number; y: number } | undefined {
  const { character, currentBattlefield, missionSides } = params;
  if (currentBattlefield) {
    const directPosition = currentBattlefield.getCharacterPosition(character);
    if (directPosition) {
      return directPosition;
    }
  }
  for (const side of missionSides) {
    const member = side.members.find(
      candidate =>
        candidate.character.id === character.id || candidate.id === character.id
    );
    if (member?.position) {
      return member.position;
    }
  }
  return undefined;
}

export function syncMissionRuntimeForAttackForRunner(params: {
  missionRuntimeAdapter: {
    recordAttack: (attackerSideId: string | undefined, woundsAdded: number) => MissionRuntimeUpdate;
    onCarrierDown: (targetId: string, position: { x: number; y: number }, becameEliminated: boolean) => MissionRuntimeUpdate;
    onModelEliminated: (targetId: string, attackerId?: string) => MissionRuntimeUpdate;
  } | null;
  attacker: Character | undefined;
  target: Character;
  targetStateBefore: ModelStateAudit;
  targetStateAfter: ModelStateAudit;
  damageResolution: unknown;
  sideNameByCharacterId: Map<string, string>;
  extractWoundsAddedFromDamageResolution: (
    damageResolution: unknown,
    targetStateBefore: ModelStateAudit,
    targetStateAfter: ModelStateAudit
  ) => number;
  applyMissionRuntimeUpdate: (update: MissionRuntimeUpdate | null | undefined) => void;
  findCharacterPosition: (character: Character) => { x: number; y: number } | undefined;
}): void {
  const { missionRuntimeAdapter } = params;
  if (!missionRuntimeAdapter) return;

  const attackerSideId = params.attacker
    ? params.sideNameByCharacterId.get(params.attacker.id)
    : undefined;
  const woundsAdded = params.extractWoundsAddedFromDamageResolution(
    params.damageResolution,
    params.targetStateBefore,
    params.targetStateAfter
  );
  params.applyMissionRuntimeUpdate(
    missionRuntimeAdapter.recordAttack(attackerSideId, woundsAdded)
  );

  const becameKOd = !params.targetStateBefore.isKOd && params.targetStateAfter.isKOd;
  const becameEliminated =
    !params.targetStateBefore.isEliminated && params.targetStateAfter.isEliminated;

  if (becameKOd || becameEliminated) {
    const targetPosition = params.findCharacterPosition(params.target);
    if (targetPosition) {
      params.applyMissionRuntimeUpdate(
        missionRuntimeAdapter.onCarrierDown(
          params.target.id,
          targetPosition,
          becameEliminated
        )
      );
    }
  }

  if (becameEliminated) {
    params.applyMissionRuntimeUpdate(
      missionRuntimeAdapter.onModelEliminated(params.target.id, params.attacker?.id)
    );
  }
}
