import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import {
  executeCloseCombatActionForRunner,
  executeDisengageActionForRunner,
  executeRangedCombatActionForRunner,
  type CombatActionResolutionDeps,
} from './CombatActionResolution';

function createCharacter(id: string): Character {
  return {
    id,
    profile: { name: id },
    state: {},
  } as unknown as Character;
}

function createConfig() {
  return {
    missionId: 'QAI_11',
    missionName: 'Elimination',
    gameSize: 'VERY_SMALL',
    battlefieldWidth: 18,
    battlefieldHeight: 24,
    maxTurns: 6,
    endGameTurn: 6,
    sides: [
      { name: 'Alpha', tacticalDoctrine: TacticalDoctrine.Operative },
      { name: 'Bravo', tacticalDoctrine: TacticalDoctrine.Operative },
    ],
    densityRatio: 0,
    lighting: 'DAY_CLEAR',
    visibilityOrMu: 16,
    maxOrm: 2,
    allowConcentrateRangeExtension: true,
    perCharacterFovLos: true,
    verbose: false,
  } as any;
}

function createDeps(overrides: Partial<CombatActionResolutionDeps> = {}): CombatActionResolutionDeps {
  return {
    pickMeleeWeapon: () => null,
    pickRangedWeapon: () => null,
    getDoctrineForCharacter: () => TacticalDoctrine.Operative,
    inspectPassiveOptions: () => [],
    trackPassiveUsage: () => {},
    executeFailedHitPassiveResponse: () => ({}),
    snapshotModelState: () => ({ wounds: 0, delay: 0, fear: 0, hidden: false, waiting: false, attentive: true } as any),
    sanitizeForAudit: value => value,
    syncMissionRuntimeForAttack: () => {},
    extractDamageResolutionFromUnknown: () => undefined,
    applyAutoBonusActionIfPossible: () => {},
    trackCombatExtras: () => {},
    normalizeAttackResult: () => ({ hit: false, ko: false, eliminated: false }),
    trackKO: () => {},
    trackElimination: () => {},
    applyEliminationScoring: () => {},
    toOpposedTestAudit: () => undefined,
    findTakeCoverPosition: () => undefined,
    trackLOSCheck: () => {},
    trackLOFCheck: () => {},
    ...overrides,
  };
}

describe('CombatActionResolution', () => {
  it('returns close-combat no-weapon when attacker cannot equip melee', async () => {
    const result = await executeCloseCombatActionForRunner({
      attacker: createCharacter('a1'),
      defender: createCharacter('b1'),
      battlefield: {} as any,
      gameManager: {} as any,
      config: createConfig(),
      sideIndex: 0,
      allies: [],
      opponents: [],
      isCharge: false,
      deps: createDeps(),
    });

    expect(result.executed).toBe(false);
    expect(result.resultCode).toBe('close_combat=false:no-weapon');
  });

  it('returns ranged no-weapon with empty vectors when attacker has no ranged weapon', async () => {
    const result = await executeRangedCombatActionForRunner({
      attacker: createCharacter('a1'),
      defender: createCharacter('b1'),
      battlefield: {} as any,
      gameManager: {} as any,
      config: createConfig(),
      sideIndex: 0,
      allies: [],
      opponents: [],
      deps: createDeps(),
    });

    expect(result.executed).toBe(false);
    expect(result.result).toBe('ranged=false:no-weapon');
    expect(result.vectors).toEqual([]);
  });

  it('returns disengage no-weapon when defender has no melee weapon', async () => {
    const deps = createDeps({ pickMeleeWeapon: vi.fn(() => null) });
    const result = await executeDisengageActionForRunner({
      disengager: createCharacter('a1'),
      defender: createCharacter('b1'),
      battlefield: {} as any,
      gameManager: {} as any,
      config: createConfig(),
      sideIndex: 0,
      allies: [],
      opponents: [],
      deps,
    });

    expect(result.executed).toBe(false);
    expect(result.resultCode).toBe('disengage=false:no-weapon');
  });
});
