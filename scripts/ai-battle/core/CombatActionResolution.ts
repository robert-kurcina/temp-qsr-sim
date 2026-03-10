import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import type { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import { LOFOperations } from '../../../src/lib/mest-tactics/battlefield/los/LOFOperations';
import type {
  ActionStepAudit,
  AuditVector,
  GameConfig,
  ModelStateAudit,
  OpposedTestAudit,
} from '../../shared/BattleReportTypes';
import type { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type { PassiveOption, PassiveOptionType } from '../../../src/lib/mest-tactics/status/passive-options';
import {
  evaluateRangeWithVisibility,
  parseWeaponOptimalRangeMu,
} from '../../../src/lib/mest-tactics/utils/visibility';
import {
  shouldUseDefendDeclaredForDoctrine,
  shouldUseLeanForRangedWithCover,
  shouldUseTakeCoverDeclaredForDoctrine,
} from './AIDecisionSupport';
import { hasLineOfSightForRunner } from './MovementPlanningSupport';

export interface CloseCombatActionResult {
  executed: boolean;
  resultCode: string;
  opposedTest?: OpposedTestAudit;
  details?: Record<string, unknown>;
}

export interface RangedCombatActionResult {
  executed: boolean;
  result: string;
  opposedTest?: OpposedTestAudit;
  rangeCheck?: ActionStepAudit['rangeCheck'];
  vectors: AuditVector[];
  details?: Record<string, unknown>;
}

export interface DisengageActionResult {
  executed: boolean;
  resultCode: string;
  opposedTest?: OpposedTestAudit;
  details?: Record<string, unknown>;
}

export interface CombatActionResolutionDeps {
  pickMeleeWeapon: (character: Character) => any | null;
  pickRangedWeapon: (character: Character) => any | null;
  getDoctrineForCharacter: (
    character: Character,
    fallback?: TacticalDoctrine
  ) => TacticalDoctrine;
  inspectPassiveOptions: (gameManager: GameManager, event: unknown) => PassiveOption[];
  trackPassiveUsage: (type: PassiveOptionType) => void;
  executeFailedHitPassiveResponse: (params: {
    gameManager: GameManager;
    attacker: Character;
    defender: Character;
    hitTestResult: any;
    attackType: 'melee' | 'ranged';
    options: PassiveOption[];
    doctrine: TacticalDoctrine;
    visibilityOrMu: number;
  }) => { type?: PassiveOptionType; result?: unknown };
  snapshotModelState: (character: Character) => ModelStateAudit;
  sanitizeForAudit: (value: unknown) => unknown;
  syncMissionRuntimeForAttack: (
    attacker: Character,
    target: Character,
    targetStateBefore: ModelStateAudit,
    targetStateAfter: ModelStateAudit,
    damageResolution: unknown
  ) => void;
  extractDamageResolutionFromUnknown: (result: unknown) => unknown;
  applyAutoBonusActionIfPossible: (params: {
    result: any;
    attacker: Character;
    target: Character;
    battlefield: Battlefield;
    allies: Character[];
    opponents: Character[];
    isCloseCombat: boolean;
    doctrine: TacticalDoctrine;
    isCharge?: boolean;
  }) => void;
  trackCombatExtras: (result: unknown) => void;
  normalizeAttackResult: (result: any) => {
    hit?: boolean;
    ko: boolean;
    eliminated: boolean;
  };
  trackKO: () => void;
  trackElimination: () => void;
  applyEliminationScoring: (params: {
    defender: Character;
    sideIndex: number;
    verbose: boolean;
    casualty: 'ko' | 'eliminated';
  }) => void;
  toOpposedTestAudit: (rawResult: any) => OpposedTestAudit | undefined;
  findTakeCoverPosition: (
    defender: Character,
    attacker: Character,
    battlefield: Battlefield
  ) => Position | undefined;
  trackLOSCheck: () => void;
  trackLOFCheck: () => void;
}

export async function executeCloseCombatActionForRunner(params: {
  attacker: Character;
  defender: Character;
  battlefield: Battlefield;
  gameManager: GameManager;
  config: GameConfig;
  sideIndex: number;
  allies: Character[];
  opponents: Character[];
  isCharge: boolean;
  isOverreach?: boolean;
  deps: CombatActionResolutionDeps;
}): Promise<CloseCombatActionResult> {
  const {
    attacker,
    defender,
    battlefield,
    gameManager,
    config,
    sideIndex,
    allies,
    opponents,
    isCharge,
    isOverreach = false,
    deps,
  } = params;
  const weapon = deps.pickMeleeWeapon(attacker);

  if (!weapon) {
    if (config.verbose) console.log('    → No weapon available');
    return { executed: false, resultCode: 'close_combat=false:no-weapon' };
  }

  try {
    const defenderStateBeforeAttack = deps.snapshotModelState(defender);
    const attackerDoctrine = config.sides[sideIndex]?.tacticalDoctrine ?? deps.getDoctrineForCharacter(attacker);
    const defenderDoctrine = deps.getDoctrineForCharacter(defender);
    const declaredOptions = deps.inspectPassiveOptions(gameManager, {
      kind: 'CloseCombatAttackDeclared',
      attacker,
      defender,
      battlefield,
      weapon: weapon as any,
    });
    const defendAvailable = declaredOptions.some(option => option.type === 'Defend' && option.available);
    const useDefend = defendAvailable && shouldUseDefendDeclaredForDoctrine(defenderDoctrine, 'melee', defender);
    if (useDefend) {
      deps.trackPassiveUsage('Defend');
    }

    const result = gameManager.executeCloseCombatAttack(attacker, defender, weapon, {
      isDefending: false,
      defend: useDefend,
      context: isOverreach ? { isOverreach: true } : undefined,
    } as any);

    const hitTestResult = (result as any)?.hitTestResult ?? (result as any)?.result?.hitTestResult;
    if (hitTestResult && hitTestResult.pass === false) {
      const attackerStateBeforePassive = deps.snapshotModelState(attacker);
      const failedOptions = deps.inspectPassiveOptions(gameManager, {
        kind: 'HitTestFailed',
        attacker,
        defender,
        battlefield,
        attackType: 'melee',
        hitTestResult,
        visibilityOrMu: config.visibilityOrMu,
      });
      const passiveResponse = deps.executeFailedHitPassiveResponse({
        gameManager,
        attacker,
        defender,
        hitTestResult,
        attackType: 'melee',
        options: failedOptions,
        doctrine: defenderDoctrine,
        visibilityOrMu: config.visibilityOrMu,
      });
      if (passiveResponse.result) {
        (result as any).passiveResponse = deps.sanitizeForAudit(passiveResponse.result) as Record<string, unknown>;
        const attackerStateAfterPassive = deps.snapshotModelState(attacker);
        deps.syncMissionRuntimeForAttack(
          defender,
          attacker,
          attackerStateBeforePassive,
          attackerStateAfterPassive,
          deps.extractDamageResolutionFromUnknown(passiveResponse.result)
        );
      }
    }

    deps.applyAutoBonusActionIfPossible({
      result,
      attacker,
      target: defender,
      battlefield,
      allies,
      opponents,
      isCloseCombat: true,
      doctrine: attackerDoctrine,
      isCharge,
    });

    deps.trackCombatExtras(result as any);
    const normalized = deps.normalizeAttackResult(result);
    const defenderStateAfterAttack = deps.snapshotModelState(defender);
    const becameKOd = !defenderStateBeforeAttack.isKOd && defenderStateAfterAttack.isKOd;
    const becameEliminated =
      !defenderStateBeforeAttack.isEliminated && defenderStateAfterAttack.isEliminated;
    const becameCasualty = !defenderStateBeforeAttack.isKOd
      && !defenderStateBeforeAttack.isEliminated
      && (becameKOd || becameEliminated);

    if (config.verbose) {
      const koStatus = normalized.ko ? 'KO' : 'OK';
      const elimStatus = normalized.eliminated ? 'Elim' : 'Active';
      console.log(`    → Hit: ${normalized.hit}, KO: ${koStatus}, Elim: ${elimStatus}`);
    }

    if (normalized.ko || becameKOd) {
      deps.trackKO();
    }
    if (normalized.eliminated || becameEliminated) {
      deps.trackElimination();
    }
    if (becameCasualty) {
      deps.applyEliminationScoring({
        defender,
        sideIndex,
        verbose: config.verbose,
        casualty: becameEliminated ? 'eliminated' : 'ko',
      });
    }

    return {
      executed: true,
      resultCode: 'close_combat=true',
      opposedTest: deps.toOpposedTestAudit(result),
      details: {
        weaponName: (weapon as any).name ?? (weapon as any).id ?? 'weapon',
        normalized,
        attackResult: deps.sanitizeForAudit(result) as Record<string, unknown>,
        isCharge,
        isOverreach,
      },
    };
  } catch (error) {
    if (config.verbose) {
      console.error(`    Combat error: ${error}`);
    }
    return { executed: false, resultCode: 'close_combat=false:error' };
  }
}

export async function executeRangedCombatActionForRunner(params: {
  attacker: Character;
  defender: Character;
  battlefield: Battlefield;
  gameManager: GameManager;
  config: GameConfig;
  sideIndex: number;
  allies: Character[];
  opponents: Character[];
  deps: CombatActionResolutionDeps;
}): Promise<RangedCombatActionResult> {
  const { attacker, defender, battlefield, gameManager, config, sideIndex, allies, opponents, deps } = params;
  const vectors: AuditVector[] = [];
  const weapon = deps.pickRangedWeapon(attacker);
  if (!weapon) {
    if (config.verbose) console.log('    → No ranged weapon available');
    return { executed: false, result: 'ranged=false:no-weapon', vectors };
  }

  try {
    const defenderStateBeforeAttack = deps.snapshotModelState(defender);
    const attackerDoctrine = config.sides[sideIndex]?.tacticalDoctrine ?? deps.getDoctrineForCharacter(attacker);
    const defenderDoctrine = deps.getDoctrineForCharacter(defender);
    const attackerPos = battlefield.getCharacterPosition(attacker);
    const defenderPos = battlefield.getCharacterPosition(defender);
    if (!attackerPos || !defenderPos) {
      if (config.verbose) console.log('    → Invalid positions');
      return { executed: false, result: 'ranged=false:invalid-position', vectors };
    }

    const losCapture = { vectors: [] as any[] };
    if (config.perCharacterFovLos && !hasLineOfSightForRunner(attacker, defender, battlefield, losCapture)) {
      return { executed: false, result: 'ranged=false:no-los', vectors: losCapture.vectors };
    }
    vectors.push(...losCapture.vectors);

    const distance = Math.hypot(attackerPos.x - defenderPos.x, attackerPos.y - defenderPos.y);
    const weaponOrMu = parseWeaponOptimalRangeMu(attacker, weapon as any);
    const rangeCheck = evaluateRangeWithVisibility(distance, weaponOrMu, {
      visibilityOrMu: config.visibilityOrMu,
      maxOrm: config.maxOrm,
      allowConcentrateRangeExtension: config.allowConcentrateRangeExtension,
    });
    if (!rangeCheck.inRange) {
      return { executed: false, result: 'ranged=false:out-of-range', vectors };
    }

    const declaredOptions = deps.inspectPassiveOptions(gameManager, {
      kind: 'RangedAttackDeclared',
      attacker,
      defender,
      battlefield,
      weapon: weapon as any,
    });
    const defendAvailable = declaredOptions.some(option => option.type === 'Defend' && option.available);
    const canTakeCover = declaredOptions.some(option => option.type === 'TakeCover' && option.available);
    const useDefend = defendAvailable && shouldUseDefendDeclaredForDoctrine(defenderDoctrine, 'ranged', defender);
    const useTakeCover = canTakeCover && shouldUseTakeCoverDeclaredForDoctrine(defenderDoctrine, defender);
    const takeCoverPosition = canTakeCover
      ? (useTakeCover ? deps.findTakeCoverPosition(defender, attacker, battlefield) : undefined)
      : undefined;
    if (useDefend) {
      deps.trackPassiveUsage('Defend');
    }
    if (takeCoverPosition) {
      deps.trackPassiveUsage('TakeCover');
    }

    let orm = rangeCheck.orm;
    let context = undefined as ReturnType<GameManager['buildConcentrateContext']> | undefined;
    let usedConcentrate = false;
    if (rangeCheck.requiresConcentrate) {
      if (!gameManager.spendAp(attacker, 1)) {
        return { executed: false, result: 'ranged=false:not-enough-ap-concentrate', vectors };
      }
      orm = rangeCheck.concentratedOrm;
      context = gameManager.buildConcentrateContext('hit');
      usedConcentrate = true;
    }
    const useLean = shouldUseLeanForRangedWithCover(attacker, defender, battlefield);
    if (useLean) {
      context = { ...(context ?? {}), isLeaning: true };
    }

    const attackCost = gameManager.getAttackApCost(attacker, weapon as any);
    if (!gameManager.spendAp(attacker, attackCost)) {
      return { executed: false, result: `ranged=false:not-enough-ap(${attackCost})`, vectors };
    }

    deps.trackLOSCheck();
    battlefield.hasLineOfSight(attackerPos, defenderPos);
    deps.trackLOFCheck();
    LOFOperations.getModelsAlongLOF(
      attackerPos,
      defenderPos,
      battlefield.getModelBlockers([attacker.id, defender.id]).map(model => ({
        id: model.id,
        position: model.position,
        baseDiameter: model.baseDiameter,
      })),
      { lofWidth: 1 }
    );
    vectors.push({
      kind: 'los',
      from: attackerPos,
      to: defenderPos,
      distanceMu: distance,
    });
    vectors.push({
      kind: 'lof',
      from: attackerPos,
      to: defenderPos,
      distanceMu: distance,
      widthMu: 1,
    });

    const result = gameManager.executeRangedAttack(attacker, defender, weapon, {
      orm,
      context,
      optimalRangeMu: rangeCheck.requiresConcentrate ? rangeCheck.concentratedOrMu : rangeCheck.effectiveOrMu,
      defend: useDefend,
      allowTakeCover: Boolean(takeCoverPosition),
      takeCoverPosition,
    });

    const hitTestResult = (result as any)?.result?.hitTestResult ?? (result as any)?.hitTestResult;
    if (hitTestResult && hitTestResult.pass === false) {
      const attackerStateBeforePassive = deps.snapshotModelState(attacker);
      const failedOptions = deps.inspectPassiveOptions(gameManager, {
        kind: 'HitTestFailed',
        attacker,
        defender,
        battlefield,
        attackType: 'ranged',
        hitTestResult,
        visibilityOrMu: config.visibilityOrMu,
      });
      const passiveResponse = deps.executeFailedHitPassiveResponse({
        gameManager,
        attacker,
        defender,
        hitTestResult,
        attackType: 'ranged',
        options: failedOptions,
        doctrine: defenderDoctrine,
        visibilityOrMu: config.visibilityOrMu,
      });
      if (passiveResponse.result) {
        (result as any).passiveResponse = deps.sanitizeForAudit(passiveResponse.result) as Record<string, unknown>;
        const attackerStateAfterPassive = deps.snapshotModelState(attacker);
        deps.syncMissionRuntimeForAttack(
          defender,
          attacker,
          attackerStateBeforePassive,
          attackerStateAfterPassive,
          deps.extractDamageResolutionFromUnknown(passiveResponse.result)
        );
      }
    }

    deps.applyAutoBonusActionIfPossible({
      result,
      attacker,
      target: defender,
      battlefield,
      allies,
      opponents,
      isCloseCombat: false,
      doctrine: attackerDoctrine,
    });

    deps.trackCombatExtras(result as any);
    const normalized = deps.normalizeAttackResult(result);
    const defenderStateAfterAttack = deps.snapshotModelState(defender);
    const becameKOd = !defenderStateBeforeAttack.isKOd && defenderStateAfterAttack.isKOd;
    const becameEliminated =
      !defenderStateBeforeAttack.isEliminated && defenderStateAfterAttack.isEliminated;
    const becameCasualty = !defenderStateBeforeAttack.isKOd
      && !defenderStateBeforeAttack.isEliminated
      && (becameKOd || becameEliminated);
    if (config.verbose) {
      console.log(`    → Hit: ${normalized.hit}, KO: ${normalized.ko}, Elim: ${normalized.eliminated}`);
    }

    if (normalized.ko || becameKOd) {
      deps.trackKO();
    }
    if (normalized.eliminated || becameEliminated) {
      deps.trackElimination();
    }
    if (becameCasualty) {
      deps.applyEliminationScoring({
        defender,
        sideIndex,
        verbose: config.verbose,
        casualty: becameEliminated ? 'eliminated' : 'ko',
      });
    }

    return {
      executed: true,
      result: `ranged=true:orm=${orm}${rangeCheck.requiresConcentrate ? ':concentrate' : ''}`,
      opposedTest: deps.toOpposedTestAudit(result),
      rangeCheck: {
        distanceMu: distance,
        weaponOrMu,
        visibilityOrMu: config.visibilityOrMu,
        orm: rangeCheck.orm,
        effectiveOrMu: rangeCheck.effectiveOrMu,
        concentratedOrm: rangeCheck.concentratedOrm,
        concentratedOrMu: rangeCheck.concentratedOrMu,
        requiresConcentrate: rangeCheck.requiresConcentrate,
      },
      vectors,
      details: {
        weaponName: (weapon as any).name ?? (weapon as any).id ?? 'weapon',
        normalized,
        attackResult: deps.sanitizeForAudit(result) as Record<string, unknown>,
        ormUsed: orm,
        usedConcentrate,
        usedLean: useLean,
        usedDefend: useDefend,
        takeCoverApplied: Boolean(takeCoverPosition),
      },
    };
  } catch (error) {
    if (config.verbose) {
      console.error(`    Ranged combat error: ${error}`);
    }
    return { executed: false, result: 'ranged=false:error', vectors };
  }
}

export async function executeDisengageActionForRunner(params: {
  disengager: Character;
  defender: Character;
  battlefield: Battlefield;
  gameManager: GameManager;
  config: GameConfig;
  sideIndex: number;
  allies: Character[];
  opponents: Character[];
  deps: CombatActionResolutionDeps;
}): Promise<DisengageActionResult> {
  const { disengager, defender, battlefield, gameManager, config, sideIndex, allies, opponents, deps } = params;

  try {
    const weapon = deps.pickMeleeWeapon(defender);
    if (!weapon) {
      if (config.verbose) console.log('    → No weapon for disengage');
      return { executed: false, resultCode: 'disengage=false:no-weapon' };
    }

    const result = gameManager.executeDisengage(disengager, defender, weapon);
    const disengagerDoctrine = config.sides[sideIndex]?.tacticalDoctrine ?? deps.getDoctrineForCharacter(disengager);
    deps.applyAutoBonusActionIfPossible({
      result,
      attacker: disengager,
      target: defender,
      battlefield,
      allies,
      opponents,
      isCloseCombat: true,
      doctrine: disengagerDoctrine,
    });
    deps.trackCombatExtras(result as any);

    if (config.verbose) {
      const moved = result.pass && 'moved' in result && result.moved ? ', moved' : '';
      console.log(`    → Disengage: ${result.pass ? `Success${moved}` : 'Failed'}`);
    }
    return {
      executed: result.pass,
      resultCode: result.pass ? 'disengage=true' : 'disengage=false',
      opposedTest: deps.toOpposedTestAudit(result),
      details: {
        defenderWeaponName: (weapon as any).name ?? (weapon as any).id ?? 'weapon',
        disengageResult: deps.sanitizeForAudit(result) as Record<string, unknown>,
      },
    };
  } catch (error) {
    if (config.verbose) {
      console.error(`    Disengage error: ${error}`);
    }
    return { executed: false, resultCode: 'disengage=false:error' };
  }
}
