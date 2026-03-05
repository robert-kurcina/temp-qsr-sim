/**
 * Mission Runtime Integration
 *
 * Mission side creation, runtime updates, and objective marker integration.
 * Extracted from AIBattleRunner.ts to separate mission logic from core battle execution.
 */

import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { ModelSlot } from '../../../src/lib/mest-tactics/mission/MissionSide';
import type { MissionRuntimeUpdate } from '../../../src/lib/mest-tactics/missions/mission-runtime-adapter';
import type { ObjectiveMarkerManager } from '../../../src/lib/mest-tactics/mission/objective-markers';
import type { AIContext } from '../../../src/lib/mest-tactics/ai/core/AIController';
import { MissionRuntimeAdapter, createMissionRuntimeAdapter } from '../../../src/lib/mest-tactics/missions/mission-runtime-adapter';

export interface MissionRuntimeState {
  adapter: MissionRuntimeAdapter | null;
  sides: any[];
  sideIds: string[];
  vpBySide: Record<string, number>;
  rpBySide: Record<string, number>;
  immediateWinnerSideId: string | null;
}

export interface MissionModelsResult {
  models: MissionModel[];
  characterToModel: Map<Character, MissionModel>;
}

export interface MissionModel {
  id: string;
  character: Character;
  sideId: string;
  slot: ModelSlot;
}

/**
 * Create mission runtime state
 */
export function createMissionRuntimeState(): MissionRuntimeState {
  return {
    adapter: null,
    sides: [],
    sideIds: [],
    vpBySide: {},
    rpBySide: {},
    immediateWinnerSideId: null,
  };
}

/**
 * Create mission sides from configuration
 */
export function createMissionSides(
  missionId: string,
  sides: Array<{
    name: string;
    characters: Character[];
    doctrine?: string;
  }>,
  battlefield: Battlefield
): any {
  const missionSides: any[] = [];

  for (let i = 0; i < sides.length; i++) {
    const sideConfig = sides[i];
    // Create side object directly (MissionSide is type-only)
    const side: any = {
      name: sideConfig.name,
      missionId,
      members: [],
      addModel: function(slot: any) {
        this.members.push(slot);
      },
    };

    // Add characters as model slots
    for (const character of sideConfig.characters) {
      side.addModel({
        character,
        status: 'Ready',
        position: character.position || null,
      });
    }

    missionSides.push(side);
  }

  return missionSides;
}

/**
 * Build mission models from sides
 */
export function buildMissionModelsFromSides(
  sides: any[]
): MissionModelsResult {
  const models: MissionModel[] = [];
  const characterToModel = new Map<Character, MissionModel>();

  for (const side of sides) {
    for (const slot of side.members) {
      if (!slot.character) continue;

      const model: MissionModel = {
        id: slot.id || slot.character.id,
        character: slot.character,
        sideId: side.id,
        slot,
      };

      models.push(model);
      characterToModel.set(slot.character, model);
    }
  }

  return { models, characterToModel };
}

/**
 * Apply mission runtime update
 */
export function applyMissionRuntimeUpdate(
  state: MissionRuntimeState,
  update: MissionRuntimeUpdate | null | undefined
): void {
  if (!update || !state.adapter) {
    return;
  }

  // Update VP
  if (update.vpBySide) {
    state.vpBySide = { ...update.vpBySide };
  }

  // Update RP
  if (update.rpBySide) {
    state.rpBySide = { ...update.rpBySide };
  }

  // Update winner
  if (update.immediateWinnerSideId !== undefined) {
    state.immediateWinnerSideId = update.immediateWinnerSideId;
  }

  // Apply any model state updates
  if (update.modelStates) {
    for (const [modelId, modelState] of Object.entries(update.modelStates)) {
      const side = state.sides.find(s => s.members.some((m: any) => m.id === modelId));
      if (side) {
        const slot = side.members.find((m: any) => m.id === modelId);
        if (slot) {
          if (modelState.status) {
            slot.status = modelState.status;
          }
          if (modelState.position) {
            slot.position = modelState.position;
          }
        }
      }
    }
  }
}

/**
 * Resolve mission winner name
 */
export function resolveMissionWinnerName(
  state: MissionRuntimeState
): string | null {
  if (!state.immediateWinnerSideId) {
    return null;
  }

  const side = state.sides.find(s => s.id === state.immediateWinnerSideId);
  return side?.name || null;
}

/**
 * Apply mission start overrides
 */
export function applyMissionStartOverrides(
  state: MissionRuntimeState,
  overrides: {
    vpBySide?: Record<string, number>;
    rpBySide?: Record<string, number>;
  }
): void {
  if (overrides.vpBySide) {
    state.vpBySide = { ...overrides.vpBySide };
  }
  if (overrides.rpBySide) {
    state.rpBySide = { ...overrides.rpBySide };
  }
}

/**
 * Sync mission runtime for attack
 */
export function syncMissionRuntimeForAttack(
  state: MissionRuntimeState,
  attacker: Character,
  defender: Character,
  damageResolution: unknown
): void {
  if (!state.adapter) {
    return;
  }

  // Extract wounds from damage resolution
  const woundsInflicted = extractWoundsFromDamageResolution(damageResolution);

  // Update mission state if needed
  // (specific logic depends on mission type)
}

/**
 * Build AI objective marker snapshot
 */
export function buildAiObjectiveMarkerSnapshot(
  markerManager: ObjectiveMarkerManager | null,
  gameManager: any
): any {
  if (!markerManager) {
    return {
      markers: [],
      heldByCharacter: {},
      characterHolding: {},
    } as any;
  }

  const markers = markerManager.getAllMarkers();
  const heldByCharacter: Record<string, string> = {};
  const characterHolding: Record<string, string> = {};

  for (const marker of markers) {
    if (marker.heldBy) {
      heldByCharacter[marker.id] = marker.heldBy;
      characterHolding[marker.heldBy] = marker.id;
    }
  }

  return {
    markers: markers.map(m => ({
      id: m.id,
      kind: m.kind,
      position: m.position,
      heldBy: m.heldBy,
    })),
    heldByCharacter,
    characterHolding,
  } as any;
}

/**
 * Get marker key IDs in hand
 */
export function getMarkerKeyIdsInHand(
  character: Character,
  gameManager: any
): string[] {
  // This would need access to the actual marker manager
  // For now, return empty array
  return [];
}

/**
 * Extract wounds from damage resolution
 */
function extractWoundsFromDamageResolution(damageResolution: unknown): number {
  if (typeof damageResolution === 'number') {
    return damageResolution;
  }

  if (damageResolution && typeof damageResolution === 'object') {
    const obj = damageResolution as Record<string, unknown>;
    return (obj.woundsInflicted as number) ?? (obj.wounds as number) ?? 0;
  }

  return 0;
}

/**
 * Initialize mission runtime adapter
 */
export function initializeMissionRuntimeAdapter(
  missionId: string,
  battlefield: Battlefield
): any {
  return createMissionRuntimeAdapter(missionId, battlefield as any);
}

/**
 * Update mission runtime for turn end
 */
export function updateMissionRuntimeForTurnEnd(
  state: MissionRuntimeState,
  turn: number
): any {
  if (!state.adapter) {
    return null;
  }

  return state.adapter.updateForTurnEnd(turn, [] as any);
}

/**
 * Check mission victory conditions
 */
export function checkMissionVictoryConditions(
  state: MissionRuntimeState
): {
  winner: string | null;
  reason: string;
  vpTie: boolean;
} {
  // Check for immediate winner
  if (state.immediateWinnerSideId) {
    const side = state.sides.find(s => s.id === state.immediateWinnerSideId);
    return {
      winner: side?.name || null,
      reason: 'Mission-specific victory condition',
      vpTie: false,
    };
  }

  // Check VP totals
  const sideIds = Object.keys(state.vpBySide);
  if (sideIds.length === 0) {
    return { winner: null, reason: 'No VP data', vpTie: false };
  }

  let maxVp = -1;
  let leaders: string[] = [];

  for (const [sideId, vp] of Object.entries(state.vpBySide)) {
    if (vp > maxVp) {
      maxVp = vp;
      leaders = [sideId];
    } else if (vp === maxVp) {
      leaders.push(sideId);
    }
  }

  if (leaders.length === 1) {
    const side = state.sides.find(s => s.id === leaders[0]);
    return {
      winner: side?.name || null,
      reason: `Highest VP (${maxVp})`,
      vpTie: false,
    };
  }

  // VP tie
  return {
    winner: null,
    reason: `VP tie at ${maxVp}`,
    vpTie: true,
  };
}
