import { MissionDefinition } from './mission-definitions';
import { getMissionDefinition } from './mission-registry';
import {
  MissionZone,
  MissionModel,
  MissionScoreDelta,
  DominanceState,
  SanctuaryState,
  CourierState,
  KeyEventState,
  ExitState,
  computeZoneControl,
  applyDominanceTurn,
  applySanctuaryTurn,
  applyCourierTurn,
  applyCollectionScores,
  applyPoiMajority,
  applyFlawless,
  applyAcquisition,
  applyCatalyst,
  applyEncroachment,
  applyTargeted,
  applySabotage,
  applyHarvest,
  applyVipResult,
  applyExitResult,
  addDelta,
  createEmptyDelta,
} from './mission-keys';
import { ObjectiveMarker } from './mission-objectives';
import { MissionSide } from './MissionSide';
import { GameSize } from './mission-scoring';

export interface MissionEngineConfig {
  missionId: string;
  gameSize: GameSize;
  sides: MissionSide[];
  dominanceZones?: MissionZone[];
  sanctuaryZones?: MissionZone[];
  poiZones?: MissionZone[];
  courierZoneBySide?: Record<string, MissionZone>;
  startingBpBySide?: Record<string, number>;
  objectiveMarkers?: ObjectiveMarker[];
}

export interface MissionEngineState {
  mission: MissionDefinition;
  gameSize: GameSize;
  dominance?: DominanceState;
  sanctuary?: SanctuaryState;
  courier?: CourierState;
  keyEvents: KeyEventState;
  exit: ExitState;
  objectiveMarkers: ObjectiveMarker[];
  dominanceZones: MissionZone[];
  sanctuaryZones: MissionZone[];
  poiZones: MissionZone[];
  courierZoneBySide: Record<string, MissionZone>;
  startingBpBySide: Record<string, number>;
  vpBySide: Record<string, number>;
  rpBySide: Record<string, number>;
  immediateWinnerSideId?: string;
}

export interface MissionTurnInput {
  models: MissionModel[];
  courierInfos?: { sideId: string; inZone: boolean; eliminated: boolean }[];
}

export interface MissionEventInput {
  sideId: string;
  amount?: number;
}

export interface MissionVipEventInput {
  protectorSideId?: string | null;
  eliminatedBySideId?: string;
}

export function initMissionEngine(config: MissionEngineConfig): MissionEngineState {
  const mission = getMissionDefinition(config.missionId);
  if (!mission) {
    throw new Error(`Unknown mission: ${config.missionId}`);
  }

  const startingBpBySide = config.startingBpBySide ?? config.sides.reduce((acc, side) => {
    acc[side.id] = side.totalBP;
    return acc;
  }, {} as Record<string, number>);

  return {
    mission,
    gameSize: config.gameSize,
    dominance: mission.keys.includes('Dominance') ? { vpBySide: {} } : undefined,
    sanctuary: mission.keys.includes('Sanctuary') ? { vpBySide: {} } : undefined,
    courier: mission.keys.includes('Courier') ? { vpBySide: {}, deliveredBySide: {}, revokedBySide: {} } : undefined,
    keyEvents: {},
    exit: { exitedCountBySide: {}, startingCountBySide: config.sides.reduce((acc, side) => {
      acc[side.id] = side.members.length;
      return acc;
    }, {} as Record<string, number>) },
    objectiveMarkers: config.objectiveMarkers ?? [],
    dominanceZones: config.dominanceZones ?? [],
    sanctuaryZones: config.sanctuaryZones ?? [],
    poiZones: config.poiZones ?? [],
    courierZoneBySide: config.courierZoneBySide ?? {},
    startingBpBySide,
    vpBySide: {},
    rpBySide: {},
  };
}

function applyDelta(state: MissionEngineState, delta: MissionScoreDelta): void {
  for (const [sideId, vp] of Object.entries(delta.vpBySide)) {
    state.vpBySide[sideId] = (state.vpBySide[sideId] || 0) + vp;
  }
  for (const [sideId, rp] of Object.entries(delta.rpBySide)) {
    state.rpBySide[sideId] = (state.rpBySide[sideId] || 0) + rp;
  }
  if (delta.immediateWinnerSideId) {
    state.immediateWinnerSideId = delta.immediateWinnerSideId;
  }
}

export function applyTurnEnd(state: MissionEngineState, input: MissionTurnInput): MissionScoreDelta {
  const delta = createEmptyDelta();
  const sizeConfig = state.mission.sizes[state.gameSize];

  if (state.dominance && state.dominanceZones.length > 0) {
    const control = computeZoneControl(input.models, state.dominanceZones);
    const dominanceDelta = applyDominanceTurn(state.dominance, control, sizeConfig.dominanceWinVp);
    applyDeltaTo(delta, dominanceDelta);
  }

  if (state.sanctuary && state.sanctuaryZones.length > 0) {
    const sanctuaryDelta = applySanctuaryTurn(
      state.sanctuary,
      input.models,
      state.sanctuaryZones,
      state.startingBpBySide,
      0.25,
      sizeConfig.sanctuaryWinVp
    );
    applyDeltaTo(delta, sanctuaryDelta);
  }

  if (state.courier && input.courierInfos?.length) {
    const courierDelta = applyCourierTurn(state.courier, input.courierInfos, { revokeOnElimination: true });
    applyDeltaTo(delta, courierDelta);
  }

  applyDelta(state, delta);
  return delta;
}

export function applyObjectiveMarkerScoring(state: MissionEngineState): MissionScoreDelta {
  const delta = applyCollectionScores(state.objectiveMarkers);
  applyDelta(state, delta);
  return delta;
}

export function applyPoiMajorityScoring(state: MissionEngineState, models: MissionModel[]): MissionScoreDelta {
  if (state.poiZones.length === 0) return createEmptyDelta();
  const control = computeZoneControl(models, state.poiZones);
  const delta = applyPoiMajority(control);
  applyDelta(state, delta);
  return delta;
}

export function applyFlawlessScoring(state: MissionEngineState, models: MissionModel[]): MissionScoreDelta {
  const delta = applyFlawless(models);
  applyDelta(state, delta);
  return delta;
}

export function applyFirstBloodEvent(state: MissionEngineState, sideId: string): MissionScoreDelta {
  const delta = createEmptyDelta();
  if (state.keyEvents.firstBloodSideId) return delta;
  state.keyEvents.firstBloodSideId = sideId;
  addDelta(delta, sideId, 1, 0);
  applyDelta(state, delta);
  return delta;
}

export function applyCatalystEvent(state: MissionEngineState, input: MissionEventInput): MissionScoreDelta {
  const delta = applyCatalyst(state.keyEvents, input.sideId);
  applyDelta(state, delta);
  return delta;
}

export function applyEncroachmentEvent(state: MissionEngineState, input: MissionEventInput): MissionScoreDelta {
  const delta = applyEncroachment(state.keyEvents, input.sideId);
  applyDelta(state, delta);
  return delta;
}

export function applyTargetedEvent(state: MissionEngineState, input: MissionEventInput): MissionScoreDelta {
  const delta = applyTargeted(state.keyEvents, input.sideId);
  applyDelta(state, delta);
  return delta;
}

export function applyAcquisitionEvent(state: MissionEngineState, input: MissionEventInput): MissionScoreDelta {
  const delta = applyAcquisition(state.keyEvents, input.sideId);
  applyDelta(state, delta);
  return delta;
}

export function applySabotageEvent(state: MissionEngineState, input: MissionEventInput): MissionScoreDelta {
  const delta = applySabotage(input.sideId, input.amount ?? 2);
  applyDelta(state, delta);
  return delta;
}

export function applyHarvestEvent(state: MissionEngineState, input: MissionEventInput): MissionScoreDelta {
  const delta = applyHarvest(input.sideId, input.amount ?? 1);
  applyDelta(state, delta);
  return delta;
}

export function applyVipEvent(state: MissionEngineState, input: MissionVipEventInput): MissionScoreDelta {
  const delta = applyVipResult(input.protectorSideId ?? null, input.eliminatedBySideId);
  applyDelta(state, delta);
  return delta;
}

export function applyExitEvent(state: MissionEngineState, sideId: string, exitedCount = 1): MissionScoreDelta {
  const delta = applyExitResult(state.exit, sideId, exitedCount);
  applyDelta(state, delta);
  return delta;
}

export function applyAcquisitionOnMarkerExit(
  state: MissionEngineState,
  marker: ObjectiveMarker,
  sideId: string
): MissionScoreDelta {
  if (!state.mission.keys.includes('Acquisition')) return createEmptyDelta();
  if (!marker.scoringSideId || marker.scoringSideId !== sideId) return createEmptyDelta();
  return applyAcquisitionEvent(state, { sideId });
}

function applyDeltaTo(target: MissionScoreDelta, delta: MissionScoreDelta): void {
  for (const [sideId, vp] of Object.entries(delta.vpBySide)) {
    target.vpBySide[sideId] = (target.vpBySide[sideId] || 0) + vp;
  }
  for (const [sideId, rp] of Object.entries(delta.rpBySide)) {
    target.rpBySide[sideId] = (target.rpBySide[sideId] || 0) + rp;
  }
  if (delta.immediateWinnerSideId) {
    target.immediateWinnerSideId = delta.immediateWinnerSideId;
  }
}
