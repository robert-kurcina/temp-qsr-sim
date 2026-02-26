import { Position } from '../battlefield/Position';
import { ModelSlotStatus, MissionSide, updatePredictedScoring, createKeyScore } from '../mission/MissionSide';
import { AssemblyRoster } from '../mission/assembly-builder';
import {
  ObjectiveMarker,
  ObjectiveMarkerManager,
  ObjectiveMarkerKind,
  ObjectiveMarkerType,
  MarkerAcquireResult,
  MarkerShareResult,
  MarkerState,
  MarkerTransferOptions,
  SwitchState,
  createObjectiveMarker,
  isIdeaMarker,
  isPhysicalMarker,
  isSwitchMarker,
} from '../mission/objective-markers';
import {
  MissionModel,
  MissionScoreDelta,
  addDelta,
  applyCollectionScores,
  applyFlawless,
  createEmptyDelta,
} from './mission-keys';
import { createEliminationMission, EliminationMissionManager } from './elimination-manager';
import { createConvergenceMission, ConvergenceMissionManager } from './convergence-manager';
import { AssaultMarkerType, createAssaultMission, AssaultMissionManager } from './assault-manager';
import { createDominionMission, DominionMissionManager } from './dominion-manager';
import { createRecoveryMission, RecoveryMissionManager } from './recovery-manager';
import { createEscortMission, EscortMissionManager } from './escort-manager';
import { createTriumvirateMission, TriumvirateMissionManager } from './triumvirate-manager';
import { createStealthMission, StealthMissionManager } from './stealth-manager';
import { createDefianceMission, DefianceMissionManager } from './defiance-manager';
import { createBreachMission, BreachMissionManager } from './breach-manager';

type AnyMissionManager =
  | EliminationMissionManager
  | ConvergenceMissionManager
  | AssaultMissionManager
  | DominionMissionManager
  | RecoveryMissionManager
  | EscortMissionManager
  | TriumvirateMissionManager
  | StealthMissionManager
  | DefianceMissionManager
  | BreachMissionManager;

interface MissionManagerWithVp {
  getVictoryPoints(sideId: string): number;
  hasEnded(): boolean;
  getWinner(): string | undefined;
}

export interface MissionRuntimeUpdate {
  delta: MissionScoreDelta;
  firstBloodSideId?: string;
  immediateWinnerSideId?: string;
}

export interface TransferMarkerResult {
  success: boolean;
  apCost: number;
  marker?: ObjectiveMarker;
  reason?: string;
}

export interface DestroyMarkerResult {
  success: boolean;
  apCost: number;
  marker?: ObjectiveMarker;
  reason?: string;
}

interface ProjectedObjectiveMarkerSpec {
  id: string;
  name: string;
  type: ObjectiveMarkerType;
  omTypes: ObjectiveMarkerKind[];
  state: MarkerState;
  position?: Position;
  controlledBy?: string;
  scoringSideId?: string;
  switchState?: SwitchState;
  isNeutral?: boolean;
  metadata: Record<string, unknown>;
}

function mergeDelta(target: MissionScoreDelta, source: MissionScoreDelta): MissionScoreDelta {
  for (const [sideId, vp] of Object.entries(source.vpBySide)) {
    addDelta(target, sideId, vp, 0);
  }
  for (const [sideId, rp] of Object.entries(source.rpBySide)) {
    addDelta(target, sideId, 0, rp);
  }
  if (source.immediateWinnerSideId) {
    target.immediateWinnerSideId = source.immediateWinnerSideId;
  }
  return target;
}

function getModelStatus(model: MissionModel): ModelSlotStatus {
  if (model.isEliminated) return ModelSlotStatus.Eliminated;
  if (model.isKOd) return ModelSlotStatus.KO;
  return ModelSlotStatus.Ready;
}

function buildReinforcementRoster(side: MissionSide): AssemblyRoster {
  return {
    assembly: side.assemblies[0] ?? {
      name: `${side.id}-reinforcements`,
      characters: side.members.map(member => member.id),
      totalBP: side.totalBP,
      totalCharacters: side.members.length,
    },
    characters: side.members.map(member => member.character),
    profiles: side.members.map(member => member.profile),
  };
}

function pickVipMemberId(side: MissionSide): string | undefined {
  const sorted = [...side.members].sort((a, b) => {
    const aBp = a.profile.totalBp ?? 0;
    const bBp = b.profile.totalBp ?? 0;
    return bBp - aBp;
  });
  return sorted[0]?.id;
}

export class MissionRuntimeAdapter {
  readonly missionId: string;
  readonly objectiveMarkers = new ObjectiveMarkerManager();

  private readonly sides: MissionSide[];
  private readonly sideIds: string[];
  private readonly characterToSide = new Map<string, string>();
  private readonly targetedModelBySide = new Map<string, string>();
  private readonly targetedAwardedForModel = new Set<string>();
  private readonly vipMemberIdsBySide = new Map<string, string>();
  private readonly memberIdByCharacterId = new Map<string, string>();
  private readonly projectedMarkerIds = new Set<string>();
  private readonly assaultMarkersInteractedThisTurn = new Set<string>();
  private manager: AnyMissionManager | null = null;
  private managerVpBySide: Record<string, number> = {};
  private firstBloodSideId?: string;
  private collectionScored = false;

  constructor(missionId: string | undefined, sides: MissionSide[]) {
    this.missionId = missionId ?? 'QAI_11';
    this.sides = sides;
    this.sideIds = sides.map(side => side.id);

    for (const side of sides) {
      for (const member of side.members) {
        this.characterToSide.set(member.id, side.id);
        this.characterToSide.set(member.character.id, side.id);
        this.memberIdByCharacterId.set(member.character.id, member.id);
      }

      const targeted = [...side.members]
        .sort((a, b) => (b.profile.totalBp ?? 0) - (a.profile.totalBp ?? 0))[0];
      if (targeted) {
        this.targetedModelBySide.set(side.id, targeted.character.id);
      }

      const vipMemberId = pickVipMemberId(side);
      if (vipMemberId) {
        this.vipMemberIdsBySide.set(side.id, vipMemberId);
      }
    }

    this.manager = this.createMissionManager();
    if (this.manager) {
      for (const sideId of this.sideIds) {
        this.managerVpBySide[sideId] = this.manager.getVictoryPoints(sideId);
      }
    }
    this.refreshProjectedObjectiveMarkers();
  }

  private getProjectedMarkerId(sourceId: string): string {
    return `mission:${this.missionId}:${sourceId}`;
  }

  private isProjectedMarker(marker: ObjectiveMarker): boolean {
    return marker.metadata['projectedFromMissionManager'] === true;
  }

  private isProjectedMarkerInteractable(marker: ObjectiveMarker): boolean {
    return marker.metadata['aiInteractable'] === true;
  }

  private isReadOnlyProjectedMarker(marker: ObjectiveMarker): boolean {
    return this.isProjectedMarker(marker) && !this.isProjectedMarkerInteractable(marker);
  }

  private getProjectedMarkerSource(marker: ObjectiveMarker): string | undefined {
    const source = marker.metadata['missionSource'];
    return typeof source === 'string' ? source : undefined;
  }

  private getProjectedSourceMarkerId(projectedMarker: ObjectiveMarker, markerId: string): string {
    const sourceMarkerId = projectedMarker.metadata['sourceMarkerId'];
    if (typeof sourceMarkerId === 'string' && sourceMarkerId.length > 0) {
      return sourceMarkerId;
    }
    const prefix = this.getProjectedMarkerId('');
    if (markerId.startsWith(prefix)) {
      return markerId.slice(prefix.length);
    }
    return markerId;
  }

  private updateMissionMemberPosition(modelId: string, position: Position): void {
    const memberId = this.memberIdByCharacterId.get(modelId) ?? modelId;
    for (const side of this.sides) {
      const member = side.members.find(candidate => candidate.id === memberId);
      if (member) {
        member.position = position;

        // Track Aggression (midline crossing) for Elimination mission
        if (this.manager instanceof EliminationMissionManager && this.battlefieldSize) {
          const battlefieldCenter = { x: this.battlefieldSize / 2, y: this.battlefieldSize / 2 };
          this.manager.trackMidlineCross(modelId, side.id, position, battlefieldCenter);
        }

        // Track Encroachment (first to cross midline) for Convergence, Dominion, and Triumvirate missions
        if (this.battlefieldSize) {
          const battlefieldCenter = { x: this.battlefieldSize / 2, y: this.battlefieldSize / 2 };
          if (this.manager instanceof ConvergenceMissionManager) {
            this.manager.trackEncroachment(modelId, side.id, position, battlefieldCenter);
          } else if (this.manager instanceof DominionMissionManager) {
            this.manager.trackEncroachment(modelId, side.id, position, battlefieldCenter);
          } else if (this.manager instanceof TriumvirateMissionManager) {
            this.manager.trackEncroachment(modelId, side.id, position, battlefieldCenter);
          }
        }

        return;
      }
    }
  }

  private performAssaultMarkerInteraction(
    projectedMarker: ObjectiveMarker,
    markerId: string,
    modelId: string,
    actorPosition?: Position
  ): MarkerAcquireResult {
    if (!(this.manager instanceof AssaultMissionManager)) {
      return {
        success: false,
        marker: projectedMarker,
        apCost: 1,
        reason: 'Assault mission manager is not active',
      };
    }
    if (!actorPosition) {
      return {
        success: false,
        marker: projectedMarker,
        apCost: 1,
        reason: 'Actor position required for assault marker interaction',
      };
    }

    const sourceMarkerId = this.getProjectedSourceMarkerId(projectedMarker, markerId);
    const assaultMarker = this.manager.getMarker(sourceMarkerId);
    if (!assaultMarker) {
      return {
        success: false,
        marker: projectedMarker,
        apCost: 1,
        reason: 'Assault marker not found',
      };
    }

    this.updateMissionMemberPosition(modelId, actorPosition);
    const normalizedModelId = this.memberIdByCharacterId.get(modelId) ?? modelId;

    const actionResult = !assaultMarker.assaulted
      ? this.manager.assaultMarker(normalizedModelId, sourceMarkerId)
      : this.manager.harvestMarker(normalizedModelId, sourceMarkerId);

    if (actionResult.success) {
      this.assaultMarkersInteractedThisTurn.add(sourceMarkerId);
      this.manager.checkForVictory();
    }

    this.refreshProjectedObjectiveMarkers();

    return {
      success: actionResult.success,
      marker: this.objectiveMarkers.getMarker(markerId) ?? projectedMarker,
      apCost: 1,
      carried: false,
      switchToggled: actionResult.success,
      reason: actionResult.reason,
    };
  }

  private performBreachMarkerInteraction(
    projectedMarker: ObjectiveMarker,
    markerId: string,
    modelId: string,
    actorPosition?: Position,
    modelPositions?: Array<{ id: string; position: Position }>
  ): MarkerAcquireResult {
    if (!(this.manager instanceof BreachMissionManager)) {
      return {
        success: false,
        marker: projectedMarker,
        apCost: 1,
        reason: 'Breach mission manager is not active',
      };
    }
    if (!actorPosition) {
      return {
        success: false,
        marker: projectedMarker,
        apCost: 1,
        reason: 'Actor position required for breach marker interaction',
      };
    }

    const sourceMarkerId = this.getProjectedSourceMarkerId(projectedMarker, markerId);
    for (const model of modelPositions ?? []) {
      this.updateMissionMemberPosition(model.id, model.position);
    }
    this.updateMissionMemberPosition(modelId, actorPosition);
    const normalizedModelId = this.memberIdByCharacterId.get(modelId) ?? modelId;
    const controlResult = this.manager.attemptControlMarker(normalizedModelId, sourceMarkerId);

    this.refreshProjectedObjectiveMarkers();

    return {
      success: controlResult.success,
      marker: this.objectiveMarkers.getMarker(markerId) ?? projectedMarker,
      apCost: 1,
      carried: false,
      switchToggled: controlResult.newController !== controlResult.previousController,
      reason: controlResult.reason,
    };
  }

  private buildZoneProjectionSpecs(
    source: string,
    zones: Array<{ id: string; name: string; position: Position; radius?: number }>,
    controllerByZone: Map<string, string | null>
  ): ProjectedObjectiveMarkerSpec[] {
    return zones.map(zone => {
      const controller = controllerByZone.get(zone.id) ?? undefined;
      return {
        id: zone.id,
        name: zone.name,
        type: ObjectiveMarkerType.Special,
        omTypes: [ObjectiveMarkerKind.Switch],
        state: MarkerState.Available,
        position: zone.position,
        controlledBy: controller ?? undefined,
        scoringSideId: controller ?? undefined,
        switchState: controller ? SwitchState.On : SwitchState.Off,
        metadata: {
          projectedFromMissionManager: true,
          aiInteractable: true, // Zone markers are interactable for AI movement scoring
          missionSource: source,
          zoneRadius: zone.radius,
        },
      };
    });
  }

  private buildProjectedMarkerSpecs(): ProjectedObjectiveMarkerSpec[] {
    if (!this.manager) return [];

    if (this.manager instanceof AssaultMissionManager) {
      return this.manager.getAllMarkers().map(marker => {
        const resourceDepleted = marker.type === AssaultMarkerType.Resource &&
          marker.maxHarvests > 0 &&
          marker.harvestCount >= marker.maxHarvests;
        const isResolved = marker.assaulted && (marker.type !== AssaultMarkerType.Resource || resourceDepleted);
        return {
          id: marker.id,
          name: marker.id,
          type: ObjectiveMarkerType.Special,
          omTypes: [ObjectiveMarkerKind.Switch],
          state: isResolved ? MarkerState.Scored : MarkerState.Available,
          position: marker.position,
          controlledBy: marker.assaultedBy,
          scoringSideId: marker.assaultedBy,
          switchState: marker.assaulted ? SwitchState.On : SwitchState.Off,
          metadata: {
            projectedFromMissionManager: true,
            aiInteractable: !isResolved,
            missionSource: 'assault',
            sourceMarkerId: marker.id,
            markerType: marker.type,
            harvestCount: marker.harvestCount,
            maxHarvests: marker.maxHarvests,
          },
        };
      });
    }

    if (this.manager instanceof BreachMissionManager) {
      const controllerByMarker = this.manager.getMarkerControllers();
      return this.manager.getMarkers().map(marker => {
        const controller = controllerByMarker.get(marker.id) ?? undefined;
        return {
          id: marker.id,
          name: marker.name,
          type: ObjectiveMarkerType.Special,
          omTypes: [ObjectiveMarkerKind.Switch],
          state: MarkerState.Available,
          position: marker.position,
          controlledBy: controller ?? undefined,
          scoringSideId: controller ?? undefined,
          switchState: controller ? SwitchState.On : SwitchState.Off,
          metadata: {
            projectedFromMissionManager: true,
            aiInteractable: true,
            missionSource: 'breach',
            sourceMarkerId: marker.id,
          },
        };
      });
    }

    if (this.manager instanceof ConvergenceMissionManager) {
      return this.buildZoneProjectionSpecs(
        'convergence',
        this.manager.getZones(),
        this.manager.getZoneControllers()
      );
    }

    if (this.manager instanceof DominionMissionManager) {
      return this.buildZoneProjectionSpecs(
        'dominion',
        this.manager.getZones(),
        this.manager.getZoneControllers()
      );
    }

    if (this.manager instanceof TriumvirateMissionManager) {
      return this.buildZoneProjectionSpecs(
        'triumvirate',
        this.manager.getZones(),
        this.manager.getZoneControllers()
      );
    }

    if (this.manager instanceof RecoveryMissionManager) {
      const state = this.manager.getState();
      return this.buildZoneProjectionSpecs(
        'recovery',
        this.manager.getZones(),
        state.zoneControl
      );
    }

    if (this.manager instanceof EscortMissionManager) {
      const escortZone = this.manager.getEscortZone();
      const controllerByZone = new Map<string, string | null>();
      if (escortZone) {
        controllerByZone.set(escortZone.id, this.manager.getEscortZoneController());
        return this.buildZoneProjectionSpecs('escort', [escortZone], controllerByZone);
      }
      return [];
    }

    if (this.manager instanceof StealthMissionManager) {
      const state = this.manager.getState();
      const controllerByZone = new Map<string, string | null>(state.zoneControl);
      controllerByZone.set('extraction-zone', state.extractionZoneControl);
      return this.buildZoneProjectionSpecs(
        'stealth',
        this.manager.getZones(),
        controllerByZone
      );
    }

    if (this.manager instanceof DefianceMissionManager) {
      const state = this.manager.getState();
      return this.buildZoneProjectionSpecs(
        'defiance',
        this.manager.getZones(),
        state.zoneControl
      );
    }

    return [];
  }

  private upsertProjectedObjectiveMarker(spec: ProjectedObjectiveMarkerSpec): void {
    const markerId = this.getProjectedMarkerId(spec.id);
    const existing = this.objectiveMarkers.getMarker(markerId);
    if (existing) {
      existing.name = spec.name;
      existing.type = spec.type;
      existing.omTypes = [...spec.omTypes];
      existing.state = spec.state;
      existing.position = spec.position;
      existing.carriedBy = undefined;
      existing.controlledBy = spec.controlledBy;
      existing.scoringSideId = spec.scoringSideId;
      existing.switchState = spec.switchState;
      existing.isNeutral = spec.isNeutral;
      existing.metadata = { ...spec.metadata };
      this.projectedMarkerIds.add(markerId);
      return;
    }

    const created = createObjectiveMarker({
      id: markerId,
      name: spec.name,
      type: spec.type,
      omTypes: [...spec.omTypes],
      position: spec.position,
      scoringSideId: spec.scoringSideId,
      isNeutral: spec.isNeutral,
      metadata: { ...spec.metadata },
    });
    created.state = spec.state;
    created.carriedBy = undefined;
    created.controlledBy = spec.controlledBy;
    created.switchState = spec.switchState;
    this.objectiveMarkers.addMarker(created);
    this.projectedMarkerIds.add(markerId);
  }

  private refreshProjectedObjectiveMarkers(): void {
    const projectedSpecs = this.buildProjectedMarkerSpecs();
    const activeProjectedIds = new Set<string>();

    for (const spec of projectedSpecs) {
      const markerId = this.getProjectedMarkerId(spec.id);
      activeProjectedIds.add(markerId);
      this.upsertProjectedObjectiveMarker(spec);
    }

    for (const markerId of this.projectedMarkerIds) {
      if (activeProjectedIds.has(markerId)) continue;
      this.objectiveMarkers.removeMarker(markerId);
    }

    this.projectedMarkerIds.clear();
    for (const markerId of activeProjectedIds) {
      this.projectedMarkerIds.add(markerId);
    }
  }

  private createMissionManager(): AnyMissionManager | null {
    const vipBySide = new Map<string, string>();
    const reinforcementBySide = new Map<string, AssemblyRoster>();

    for (const side of this.sides) {
      const vipMemberId = this.vipMemberIdsBySide.get(side.id);
      if (vipMemberId) {
        vipBySide.set(side.id, vipMemberId);
      }
      reinforcementBySide.set(side.id, buildReinforcementRoster(side));
    }

    switch (this.missionId) {
      case 'QAI_11':
        return createEliminationMission(this.sides);
      case 'QAI_12':
        return createConvergenceMission(this.sides, undefined, 3);
      case 'QAI_13':
        return createAssaultMission(this.sides);
      case 'QAI_14':
        return createDominionMission(this.sides, undefined, 4);
      case 'QAI_15':
        return createRecoveryMission(this.sides, vipBySide);
      case 'QAI_16':
        return createEscortMission(this.sides, vipBySide, reinforcementBySide);
      case 'QAI_17':
        return createTriumvirateMission(this.sides);
      case 'QAI_18':
        return createStealthMission(this.sides, vipBySide, reinforcementBySide);
      case 'QAI_19':
        return createDefianceMission(this.sides, vipBySide, reinforcementBySide);
      case 'QAI_20':
        return createBreachMission(this.sides);
      default:
        return null;
    }
  }

  private synchronizeSideMembers(models: MissionModel[]): void {
    const modelById = new Map<string, MissionModel>();
    for (const model of models) {
      modelById.set(model.id, model);
      const mappedMemberId = this.memberIdByCharacterId.get(model.id);
      if (mappedMemberId) {
        modelById.set(mappedMemberId, model);
      }
    }

    for (const side of this.sides) {
      for (const member of side.members) {
        const model = modelById.get(member.id);
        if (!model) continue;
        member.position = model.position;
        member.status = getModelStatus(model);
      }
    }
  }

  private getManagerVpDelta(): MissionScoreDelta {
    const delta = createEmptyDelta();
    if (!this.manager) return delta;

    for (const sideId of this.sideIds) {
      const prev = this.managerVpBySide[sideId] ?? 0;
      const current = this.manager.getVictoryPoints(sideId);
      if (current !== prev) {
        addDelta(delta, sideId, current - prev, 0);
      }
      this.managerVpBySide[sideId] = current;
    }

    if (this.manager.hasEnded()) {
      const winnerSideId = this.manager.getWinner();
      if (winnerSideId) {
        delta.immediateWinnerSideId = winnerSideId;
      }
    }

    return delta;
  }

  private maybeResolveEscortProgress(manager: EscortMissionManager): void {
    for (const vipMemberId of this.vipMemberIdsBySide.values()) {
      const progress = manager.getEscortProgress(vipMemberId);
      if (progress <= 0) {
        manager.startEscort(vipMemberId);
        continue;
      }
      manager.continueEscort(vipMemberId);
    }
  }

  private maybeResolveRecoveryProgress(manager: RecoveryMissionManager): void {
    for (const vipMemberId of this.vipMemberIdsBySide.values()) {
      const progress = manager.getRecoveryProgress(vipMemberId);
      if (progress <= 0) {
        manager.startRecovery(vipMemberId);
        continue;
      }
      manager.continueRecovery(vipMemberId);
    }
  }

  private maybeResolveStealthProgress(manager: StealthMissionManager): void {
    for (const vipMemberId of this.vipMemberIdsBySide.values()) {
      const progress = manager.getExtractionProgress(vipMemberId);
      if (progress <= 0) {
        manager.startExtraction(vipMemberId);
        continue;
      }
      manager.continueExtraction(vipMemberId);
    }
  }

  private runMissionSpecificTurnStart(turn: number): MissionScoreDelta {
    const delta = createEmptyDelta();
    if (!this.manager) return delta;

    if (this.manager instanceof EscortMissionManager) {
      this.manager.checkReinforcements(turn);
    } else if (this.manager instanceof DefianceMissionManager) {
      this.manager.checkReinforcements(turn);
    }

    mergeDelta(delta, this.getManagerVpDelta());
    return delta;
  }

  private runMissionSpecificTurnEnd(turn: number, models: MissionModel[]): MissionScoreDelta {
    const delta = createEmptyDelta();
    if (!this.manager) return delta;

    const modelPositions = models.map(model => ({ id: model.id, position: model.position }));
    const normalizedPositions = modelPositions.map(model => ({
      id: this.memberIdByCharacterId.get(model.id) ?? model.id,
      position: model.position,
    }));
    const spatialModels = models.map(model => ({
      id: this.memberIdByCharacterId.get(model.id) ?? model.id,
      position: model.position,
      baseDiameter: model.baseDiameter ?? 1,
      siz: 3,
    }));

    if (this.manager instanceof ConvergenceMissionManager) {
      this.manager.updateZoneControl(spatialModels);
      this.manager.awardTurnVP();
      this.manager.checkForVictory();
    } else if (this.manager instanceof DominionMissionManager) {
      this.manager.updateZoneControl(spatialModels);
      this.manager.awardTurnVP();
      this.manager.checkForVictory();
    } else if (this.manager instanceof TriumvirateMissionManager) {
      this.manager.updateZoneControl(normalizedPositions);
      this.manager.awardTurnVP();
    } else if (this.manager instanceof BreachMissionManager) {
      this.manager.updateMarkerControl(normalizedPositions);
      this.manager.executeSwitches(turn);
      this.manager.awardTurnVP();
    } else if (this.manager instanceof AssaultMissionManager) {
      this.resolveAssaultMarkers(normalizedPositions);
      this.manager.checkForVictory();
    } else if (this.manager instanceof RecoveryMissionManager) {
      this.manager.updateZoneControl(normalizedPositions);
      this.maybeResolveRecoveryProgress(this.manager);
      this.manager.awardTurnVP();
      this.manager.checkForVIPElimination();
      this.manager.checkForVictory();
    } else if (this.manager instanceof EscortMissionManager) {
      this.manager.updateEscortZoneControl(normalizedPositions);
      this.maybeResolveEscortProgress(this.manager);
      this.manager.awardTurnVP();
      this.manager.checkForVIPElimination();
      this.manager.checkForVictory();
    } else if (this.manager instanceof StealthMissionManager) {
      this.manager.updateStealthZoneControl(normalizedPositions);
      this.maybeResolveStealthProgress(this.manager);
      this.manager.awardTurnVP();
      this.manager.checkForVIPElimination();
      this.manager.checkForVictory();
    } else if (this.manager instanceof DefianceMissionManager) {
      this.manager.updateDefenseZoneControl(normalizedPositions);
      this.manager.endTurn(turn);
      this.manager.awardZoneVP();
      this.manager.checkForVictory();
    } else if (this.manager instanceof EliminationMissionManager) {
      this.manager.checkForVictory();
      // Apply end-game scoring when mission ends
      if (this.manager.hasEnded()) {
        const endGameScoring = this.manager.calculateEndGameScoring();
        for (const [sideId, vp] of Object.entries(endGameScoring.vpBySide)) {
          addDelta(delta, sideId, vp, 0);
        }
        for (const [sideId, rp] of Object.entries(endGameScoring.rpBySide)) {
          addDelta(delta, sideId, 0, rp);
        }
      }
    }

    // Calculate and apply predicted scoring for all mission types (for AI planning)
    this.updatePredictedScoring();

    mergeDelta(delta, this.getManagerVpDelta());
    return delta;
  }

  /**
   * Update predicted scoring for all sides based on current battlefield state
   * Called at end of each turn to refresh AI planning data
   */
  private updatePredictedScoring(): void {
    if (!this.manager) return;

    // Get predicted scoring from mission manager if it supports it
    let sideScores: Record<string, { predictedVp: number; predictedRp: number; keyScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }> }> = {};

    if (this.manager instanceof EliminationMissionManager) {
      const predicted = this.manager.calculatePredictedScoring();
      sideScores = predicted.sideScores;
    } else if (this.manager instanceof ConvergenceMissionManager) {
      const predicted = this.manager.calculatePredictedScoring();
      sideScores = predicted.sideScores;
    } else if (this.manager instanceof DominionMissionManager) {
      const predicted = this.manager.calculatePredictedScoring();
      sideScores = predicted.sideScores;
    } else if (this.manager instanceof AssaultMissionManager) {
      const predicted = this.manager.calculatePredictedScoring();
      sideScores = predicted.sideScores;
    } else if (this.manager instanceof RecoveryMissionManager) {
      const predicted = this.manager.calculatePredictedScoring();
      sideScores = predicted.sideScores;
    } else if (this.manager instanceof EscortMissionManager) {
      const predicted = this.manager.calculatePredictedScoring();
      sideScores = predicted.sideScores;
    } else if (this.manager instanceof StealthMissionManager) {
      const predicted = this.manager.calculatePredictedScoring();
      sideScores = predicted.sideScores;
    } else if (this.manager instanceof TriumvirateMissionManager) {
      const predicted = this.manager.calculatePredictedScoring();
      sideScores = predicted.sideScores;
    } else if (this.manager instanceof DefianceMissionManager) {
      const predicted = this.manager.calculatePredictedScoring();
      sideScores = predicted.sideScores;
    } else if (this.manager instanceof BreachMissionManager) {
      const predicted = this.manager.calculatePredictedScoring();
      sideScores = predicted.sideScores;
    }
    // All 10 QAI missions now have predicted scoring support!

    // Update each side's state with predicted scores
    for (const side of this.sides) {
      const scores = sideScores[side.id] ?? { predictedVp: 0, predictedRp: 0, keyScores: {} };
      updatePredictedScoring(side, scores.predictedVp, scores.predictedRp, scores.keyScores);
    }
  }

  private resolveAssaultMarkers(models: Array<{ id: string; position: Position }>): void {
    if (!(this.manager instanceof AssaultMissionManager)) return;

    const processedMarkers = new Set<string>();
    const markers = this.manager.getAllMarkers();

    for (const model of models) {
      for (const marker of markers) {
        if (processedMarkers.has(marker.id)) continue;
        if (this.assaultMarkersInteractedThisTurn.has(marker.id)) continue;

        const dx = model.position.x - marker.position.x;
        const dy = model.position.y - marker.position.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 1) continue;

        if (!marker.assaulted) {
          this.manager.assaultMarker(model.id, marker.id);
          processedMarkers.add(marker.id);
          continue;
        }

        if (marker.type === 'Resource') {
          this.manager.harvestMarker(model.id, marker.id);
          processedMarkers.add(marker.id);
        }
      }
    }
  }

  public onTurnStart(turn: number, models: MissionModel[]): MissionRuntimeUpdate {
    this.assaultMarkersInteractedThisTurn.clear();
    this.synchronizeSideMembers(models);
    const delta = this.runMissionSpecificTurnStart(turn);
    this.refreshProjectedObjectiveMarkers();
    return {
      delta,
    };
  }

  public onTurnEnd(turn: number, models: MissionModel[]): MissionRuntimeUpdate {
    this.synchronizeSideMembers(models);
    const delta = this.runMissionSpecificTurnEnd(turn, models);
    this.refreshProjectedObjectiveMarkers();
    return {
      delta,
    };
  }

  public recordAttack(attackerSideId: string | undefined, woundsAdded: number): MissionRuntimeUpdate {
    if (!attackerSideId || woundsAdded <= 0 || this.firstBloodSideId) {
      return { delta: createEmptyDelta() };
    }

    this.firstBloodSideId = attackerSideId;
    return {
      delta: createEmptyDelta(),
      firstBloodSideId: attackerSideId,
    };
  }

  public onModelEliminated(
    eliminatedModelId: string,
    eliminatingModelId?: string
  ): MissionRuntimeUpdate {
    const delta = createEmptyDelta();
    const eliminatedSideId = this.characterToSide.get(eliminatedModelId);
    const eliminatingSideId = eliminatingModelId ? this.characterToSide.get(eliminatingModelId) : undefined;
    const eliminatedMemberId = this.memberIdByCharacterId.get(eliminatedModelId) ?? eliminatedModelId;

    // Get BP of eliminated model
    let eliminatedBp = 0;
    for (const side of this.sides) {
      const member = side.members.find(m => m.id === eliminatedMemberId || m.character.id === eliminatedModelId);
      if (member) {
        eliminatedBp = member.profile?.totalBp ?? 0;
        break;
      }
    }

    if (eliminatingSideId && eliminatedSideId && eliminatingSideId !== eliminatedSideId) {
      for (const [sideId, targetedModelId] of this.targetedModelBySide.entries()) {
        if (targetedModelId !== eliminatedModelId) continue;
        if (this.targetedAwardedForModel.has(targetedModelId)) break;
        addDelta(delta, eliminatingSideId, 1, 0);
        this.targetedAwardedForModel.add(targetedModelId);
        break;
      }
    }

    if (this.manager instanceof EliminationMissionManager && eliminatedSideId) {
      this.manager.processModelElimination(eliminatedMemberId, eliminatedSideId, eliminatingSideId, eliminatedBp);
      // Track Scholar RP loss when Scholar character is eliminated
      this.manager.processScholarElimination(eliminatedMemberId, eliminatedSideId);
    } else if (this.manager instanceof DefianceMissionManager) {
      this.manager.handleVIPElimination(eliminatedMemberId, eliminatingSideId);
    } else if (this.manager instanceof RecoveryMissionManager) {
      this.manager.checkForVIPElimination();
    } else if (this.manager instanceof EscortMissionManager) {
      this.manager.checkForVIPElimination();
    } else if (this.manager instanceof StealthMissionManager) {
      this.manager.checkForVIPElimination();
    }

    mergeDelta(delta, this.getManagerVpDelta());
    return { delta, immediateWinnerSideId: delta.immediateWinnerSideId };
  }

  public onCarrierDown(
    modelId: string,
    position: Position,
    eliminated: boolean
  ): MissionRuntimeUpdate {
    const delta = createEmptyDelta();
    const carriedBeforeDrop = this.objectiveMarkers.getMarkersCarriedBy(modelId);
    const dropped = this.objectiveMarkers.dropAllPhysicalMarkers(modelId, position);

    if (eliminated) {
      for (const marker of carriedBeforeDrop) {
        if (!isPhysicalMarker(marker)) continue;
        marker.scoringSideId = undefined;
      }
      this.removeIdeaHolder(modelId);
    }

    for (const marker of dropped) {
      marker.switchState = marker.switchState ?? SwitchState.Off;
    }

    return { delta };
  }

  private removeIdeaHolder(modelId: string): void {
    for (const marker of this.objectiveMarkers.getAllMarkers()) {
      if (!isIdeaMarker(marker) || !marker.ideaHoldersBySide) continue;

      let hasAnyHolder = false;
      for (const [sideId, holders] of Object.entries(marker.ideaHoldersBySide)) {
        marker.ideaHoldersBySide[sideId] = holders.filter(holderId => holderId !== modelId);
        if (marker.ideaHoldersBySide[sideId].length > 0) {
          hasAnyHolder = true;
        }
      }

      if (!hasAnyHolder) {
        marker.state = MarkerState.Destroyed;
        marker.scoringSideId = undefined;
      }
    }
  }

  public addObjectiveMarker(marker: ObjectiveMarker): void {
    this.objectiveMarkers.addMarker(marker);
  }

  public ensureObjectiveMarker(markerId: string): ObjectiveMarker | undefined {
    return this.objectiveMarkers.getMarker(markerId);
  }

  public getObjectiveMarkers(): ObjectiveMarker[] {
    return this.objectiveMarkers.getAllMarkers();
  }

  public getObjectiveMarkerAcquireApCost(markerId: string): number {
    const marker = this.objectiveMarkers.getMarker(markerId);
    if (!marker) return 0;
    if (this.isReadOnlyProjectedMarker(marker)) return 0;
    if (this.isProjectedMarker(marker) && !this.isProjectedMarkerInteractable(marker)) return 0;

    if (isSwitchMarker(marker)) return 1;
    if (!isPhysicalMarker(marker) && !isIdeaMarker(marker)) return 1;
    if (marker.omTypes.includes(ObjectiveMarkerKind.Tiny)) return 2;
    return 1;
  }

  public acquireObjectiveMarker(
    markerId: string,
    modelId: string,
    sideId: string,
    options: {
      isFree?: boolean;
      opposingInBaseContact?: boolean;
      isAttentive?: boolean;
      isOrdered?: boolean;
      isAnimal?: boolean;
      keyIdsInHand?: string[];
      actorPosition?: Position;
      modelPositions?: Array<{ id: string; position: Position }>;
    } = {}
  ): MarkerAcquireResult {
    const marker = this.objectiveMarkers.getMarker(markerId);
    if (marker && this.isProjectedMarker(marker)) {
      if (!this.isProjectedMarkerInteractable(marker)) {
        return {
          success: false,
          marker,
          apCost: 0,
          reason: 'Mission-projected markers are read-only in objective APIs',
        };
      }
      const source = this.getProjectedMarkerSource(marker);
      if (source === 'assault') {
        return this.performAssaultMarkerInteraction(
          marker,
          markerId,
          modelId,
          options.actorPosition
        );
      }
      if (source === 'breach') {
        return this.performBreachMarkerInteraction(
          marker,
          markerId,
          modelId,
          options.actorPosition,
          options.modelPositions
        );
      }
      // Zone-control missions (convergence, dominion, triumvirate) use automatic zone control
      // based on model positioning at turn end. Acquire action is a no-op but valid for AI planning.
      if (source === 'convergence' || source === 'dominion' || source === 'triumvirate') {
        return {
          success: true,
          marker,
          apCost: options.isFree ? 0 : 1,
          carried: false,
          reason: `Zone control is automatic based on positioning in ${source} mission`,
        };
      }
      return {
        success: false,
        marker,
        apCost: 0,
        reason: 'Projected marker does not support direct interaction',
      };
    }

    const result = this.objectiveMarkers.acquireMarker(markerId, modelId, sideId, options);
    if (!result.success) return result;

    const acquiredMarker = result.marker;
    if (acquiredMarker && !acquiredMarker.scoringSideId) {
      acquiredMarker.scoringSideId = sideId;
    }
    return result;
  }

  public shareIdeaObjectiveMarker(
    markerId: string,
    fromModelId: string,
    toModelId: string,
    sideId: string,
    hindrance = 0
  ): MarkerShareResult {
    const marker = this.objectiveMarkers.getMarker(markerId);
    if (marker && this.isProjectedMarker(marker)) {
      return {
        success: false,
        marker,
        apCost: 0,
        reason: 'Mission-projected markers do not support share interactions',
      };
    }
    return this.objectiveMarkers.shareIdea(markerId, fromModelId, toModelId, sideId, hindrance);
  }

  public transferObjectiveMarker(
    markerId: string,
    newCarrierId: string,
    sideId: string,
    options: MarkerTransferOptions = {}
  ): TransferMarkerResult {
    const marker = this.objectiveMarkers.getMarker(markerId);
    if (marker && this.isProjectedMarker(marker)) {
      return {
        success: false,
        apCost: 0,
        marker,
        reason: 'Mission-projected markers do not support transfer interactions',
      };
    }

    const apCost = options.isStunnedOrDisorderedOrDistracted ? 2 : 1;
    const transfer = this.objectiveMarkers.transferMarker(markerId, newCarrierId, sideId, options);
    return {
      success: transfer.success,
      apCost,
      marker: transfer.marker,
      reason: transfer.reason,
    };
  }

  public destroyObjectiveMarker(
    markerId: string,
    options: { allowDestroySwitch?: boolean } = {}
  ): DestroyMarkerResult {
    const marker = this.objectiveMarkers.getMarker(markerId);
    if (!marker) {
      return { success: false, apCost: 1, reason: 'Marker not found' };
    }
    if (this.isProjectedMarker(marker)) {
      return { success: false, apCost: 0, marker, reason: 'Mission-projected markers do not support destroy interactions' };
    }
    if (isSwitchMarker(marker) && !options.allowDestroySwitch) {
      return { success: false, apCost: 1, marker, reason: 'Switch OMs cannot be destroyed unless mission allows it' };
    }

    const success = this.objectiveMarkers.destroyMarker(markerId);
    return {
      success,
      apCost: 1,
      marker: this.objectiveMarkers.getMarker(markerId),
      reason: success ? undefined : 'Failed to destroy marker',
    };
  }

  public finalize(models: MissionModel[]): MissionRuntimeUpdate {
    this.synchronizeSideMembers(models);

    const delta = createEmptyDelta();

    if (!this.collectionScored) {
      mergeDelta(delta, applyCollectionScores(this.objectiveMarkers.getAllMarkers()));
      this.collectionScored = true;
    }

    mergeDelta(delta, applyFlawless(models));
    mergeDelta(delta, this.getManagerVpDelta());

    const immediateWinnerSideId = delta.immediateWinnerSideId;
    return {
      delta,
      firstBloodSideId: this.firstBloodSideId,
      immediateWinnerSideId,
    };
  }
}

export function createMissionRuntimeAdapter(
  missionId: string | undefined,
  sides: MissionSide[]
): MissionRuntimeAdapter {
  return new MissionRuntimeAdapter(missionId, sides);
}

/**
 * Convenience for quick marker bootstrap in scripts/tests.
 */
export function createDefaultObjectiveMarker(id: string, position: Position): ObjectiveMarker {
  return createObjectiveMarker({
    id,
    name: id,
    position,
  });
}
