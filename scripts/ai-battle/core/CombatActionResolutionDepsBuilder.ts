import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import type { CombatActionResolutionDeps } from './CombatActionResolution';
import { applyEliminationScoringForRunner } from './EliminationScoring';
import {
  normalizeAttackResultForRunner,
  pickMeleeWeaponForRunner,
  pickRangedWeaponForRunner,
} from './CombatRuntimeSupport';

interface BuildCombatActionResolutionDepsParams {
  getDoctrineForCharacter: CombatActionResolutionDeps['getDoctrineForCharacter'];
  inspectPassiveOptions: CombatActionResolutionDeps['inspectPassiveOptions'];
  trackPassiveUsage: CombatActionResolutionDeps['trackPassiveUsage'];
  executeFailedHitPassiveResponse: CombatActionResolutionDeps['executeFailedHitPassiveResponse'];
  snapshotModelState: CombatActionResolutionDeps['snapshotModelState'];
  sanitizeForAudit: CombatActionResolutionDeps['sanitizeForAudit'];
  syncMissionRuntimeForAttack: CombatActionResolutionDeps['syncMissionRuntimeForAttack'];
  extractDamageResolutionFromUnknown: CombatActionResolutionDeps['extractDamageResolutionFromUnknown'];
  applyAutoBonusActionIfPossible: CombatActionResolutionDeps['applyAutoBonusActionIfPossible'];
  trackCombatExtras: CombatActionResolutionDeps['trackCombatExtras'];
  trackKO: () => void;
  trackElimination: () => void;
  missionSideIds: string[];
  eliminatedBPBySide: Record<string, number>;
  missionRpBySide: Record<string, number>;
  firstBloodAwarded: boolean;
  setFirstBloodAwarded: (value: boolean) => void;
  toOpposedTestAudit: CombatActionResolutionDeps['toOpposedTestAudit'];
  findTakeCoverPosition: (
    defender: Character,
    attacker: Character,
    battlefield: Battlefield
  ) => Position | undefined;
  trackLOSCheck: () => void;
  trackLOFCheck: () => void;
}

export function buildCombatActionResolutionDepsForRunner(
  params: BuildCombatActionResolutionDepsParams
): CombatActionResolutionDeps {
  return {
    pickMeleeWeapon: model => pickMeleeWeaponForRunner(model),
    pickRangedWeapon: model => pickRangedWeaponForRunner(model),
    getDoctrineForCharacter: (model, fallback) => params.getDoctrineForCharacter(model, fallback),
    inspectPassiveOptions: (manager, event) => params.inspectPassiveOptions(manager, event),
    trackPassiveUsage: type => params.trackPassiveUsage(type),
    executeFailedHitPassiveResponse: value => params.executeFailedHitPassiveResponse(value),
    snapshotModelState: model => params.snapshotModelState(model),
    sanitizeForAudit: value => params.sanitizeForAudit(value),
    syncMissionRuntimeForAttack: (
      attackingModel,
      targetModel,
      targetStateBefore,
      targetStateAfter,
      damageResolution
    ) => params.syncMissionRuntimeForAttack(
      attackingModel,
      targetModel,
      targetStateBefore,
      targetStateAfter,
      damageResolution
    ),
    extractDamageResolutionFromUnknown: result => params.extractDamageResolutionFromUnknown(result),
    applyAutoBonusActionIfPossible: value => params.applyAutoBonusActionIfPossible(value),
    trackCombatExtras: result => params.trackCombatExtras(result),
    normalizeAttackResult: result => normalizeAttackResultForRunner(result),
    trackKO: () => params.trackKO(),
    trackElimination: () => params.trackElimination(),
    applyEliminationScoring: ({ defender, sideIndex, verbose, casualty }) => {
      const scoringUpdate = applyEliminationScoringForRunner({
        casualty,
        defender,
        sideIndex,
        missionSideIds: params.missionSideIds,
        eliminatedBPBySide: params.eliminatedBPBySide,
        missionRpBySide: params.missionRpBySide,
        firstBloodAwarded: params.firstBloodAwarded,
        verbose,
        log: message => console.log(message),
      });
      params.setFirstBloodAwarded(scoringUpdate.firstBloodAwarded);
    },
    toOpposedTestAudit: rawResult => params.toOpposedTestAudit(rawResult),
    findTakeCoverPosition: (defender, attacker, battlefield) =>
      params.findTakeCoverPosition(defender, attacker, battlefield),
    trackLOSCheck: () => params.trackLOSCheck(),
    trackLOFCheck: () => params.trackLOFCheck(),
  };
}
