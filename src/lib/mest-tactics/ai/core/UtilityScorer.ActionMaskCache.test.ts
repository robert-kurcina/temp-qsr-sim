import { describe, it, expect } from 'vitest';
import { UtilityScorer, DEFAULT_WEIGHTS } from './UtilityScorer';
import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { buildProfile } from '../../mission/assembly-builder';
import type { AIContext } from './AIController';

function createFighter(name: string, itemNames: string[] = ['Sword, Broad']): Character {
  const profile = buildProfile('Average', { itemNames });
  const character = new Character(profile);
  character.id = name;
  character.name = name;
  return character;
}

function createContext(params: {
  character: Character;
  allies?: Character[];
  enemies?: Character[];
  battlefield: Battlefield;
  apRemaining?: number;
  gameSize?: string;
  missionId?: string;
  allowWaitAction?: boolean;
  allowHideAction?: boolean;
}): AIContext {
  return {
    character: params.character,
    allies: params.allies ?? [],
    enemies: params.enemies ?? [],
    battlefield: params.battlefield,
    currentTurn: 1,
    currentRound: 1,
    apRemaining: params.apRemaining ?? 2,
    config: {
      aggression: 0.5,
      caution: 0.5,
      gameSize: params.gameSize ?? 'SMALL',
      missionId: params.missionId,
      perCharacterFovLos: false,
      allowWaitAction: params.allowWaitAction ?? true,
      allowHideAction: params.allowHideAction ?? true,
    } as any,
  } as any;
}

describe('UtilityScorer action mask cache', () => {
  it('reuses action mask for identical contexts', () => {
    const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
    const battlefield = new Battlefield(24, 24, []);
    const actor = createFighter('Actor');
    const enemy = createFighter('Enemy');

    battlefield.placeCharacter(actor, { x: 10, y: 10 });
    battlefield.placeCharacter(enemy, { x: 12, y: 10 });

    const context = createContext({
      character: actor,
      enemies: [enemy],
      battlefield,
      apRemaining: 2,
    });

    scorer.evaluateActions(context);
    const afterFirst = scorer.getActionMaskCacheStats();
    scorer.evaluateActions(context);
    const afterSecond = scorer.getActionMaskCacheStats();

    expect(afterFirst.misses).toBeGreaterThan(0);
    expect(afterSecond.hits).toBeGreaterThan(afterFirst.hits);
  });

  it('creates new cache entry when AP changes', () => {
    const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
    const battlefield = new Battlefield(24, 24, []);
    const actor = createFighter('Actor');
    const enemy = createFighter('Enemy');

    battlefield.placeCharacter(actor, { x: 10, y: 10 });
    battlefield.placeCharacter(enemy, { x: 12, y: 10 });

    const ap2Context = createContext({
      character: actor,
      enemies: [enemy],
      battlefield,
      apRemaining: 2,
    });
    scorer.evaluateActions(ap2Context);
    const afterFirst = scorer.getActionMaskCacheStats();

    const ap1Context = createContext({
      character: actor,
      enemies: [enemy],
      battlefield,
      apRemaining: 1,
    });
    scorer.evaluateActions(ap1Context);
    const afterSecond = scorer.getActionMaskCacheStats();

    expect(afterSecond.misses).toBeGreaterThan(afterFirst.misses);
  });

  it('supports explicit cache reset', () => {
    const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
    const battlefield = new Battlefield(24, 24, []);
    const actor = createFighter('Actor');
    const enemy = createFighter('Enemy');

    battlefield.placeCharacter(actor, { x: 10, y: 10 });
    battlefield.placeCharacter(enemy, { x: 12, y: 10 });

    const context = createContext({
      character: actor,
      enemies: [enemy],
      battlefield,
      apRemaining: 2,
    });
    scorer.evaluateActions(context);
    expect(scorer.getActionMaskCacheStats().size).toBeGreaterThan(0);

    scorer.clearActionMaskCache();
    const stats = scorer.getActionMaskCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  it('keeps minimal strategic path probing for very-small elimination missions', () => {
    const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
    const battlefield = new Battlefield(18, 24, []);
    const actor = createFighter('Actor');
    const enemy = createFighter('Enemy');

    battlefield.placeCharacter(actor, { x: 2, y: 12 });
    battlefield.placeCharacter(enemy, { x: 15, y: 12 });

    const context = createContext({
      character: actor,
      enemies: [enemy],
      battlefield,
      gameSize: 'VERY_SMALL',
      missionId: 'Elimination',
    });
    const session = (scorer as any).createEvaluationSession(context);

    expect(session.strategicPathQueryBudget).toBeGreaterThanOrEqual(1);
    expect(session.strategicEnemyLimit).toBeGreaterThanOrEqual(2);
  });

  it('keeps strategic probing disabled for very-small non-elimination missions', () => {
    const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
    const battlefield = new Battlefield(18, 24, []);
    const actor = createFighter('Actor');
    const enemy = createFighter('Enemy');

    battlefield.placeCharacter(actor, { x: 2, y: 12 });
    battlefield.placeCharacter(enemy, { x: 15, y: 12 });

    const context = createContext({
      character: actor,
      enemies: [enemy],
      battlefield,
      gameSize: 'VERY_SMALL',
      missionId: 'QAI_12',
    });
    const session = (scorer as any).createEvaluationSession(context);

    expect(session.strategicPathQueryBudget).toBe(0);
    expect(session.strategicEnemyLimit).toBe(0);
  });

  it('generates charge actions when an enemy is reachable into base contact', () => {
    const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
    const battlefield = new Battlefield(24, 24, []);
    const actor = createFighter('Actor');
    const enemy = createFighter('Enemy');

    battlefield.placeCharacter(actor, { x: 10, y: 12 });
    battlefield.placeCharacter(enemy, { x: 13, y: 12 });

    const context = createContext({
      character: actor,
      enemies: [enemy],
      battlefield,
      apRemaining: 2,
      gameSize: 'SMALL',
      missionId: 'QAI_11',
    });
    const actions = scorer.evaluateActions(context);

    const charge = actions.find(action => action.action === 'charge' && action.target?.id === enemy.id);
    expect(charge).toBeDefined();
    expect(charge?.position).toBeDefined();
  });

  it('does not generate charge actions when AP cannot cover move plus melee attack', () => {
    const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
    const battlefield = new Battlefield(24, 24, []);
    const actor = createFighter('Actor');
    const enemy = createFighter('Enemy');

    battlefield.placeCharacter(actor, { x: 10, y: 12 });
    battlefield.placeCharacter(enemy, { x: 13, y: 12 });

    const context = createContext({
      character: actor,
      enemies: [enemy],
      battlefield,
      apRemaining: 1,
      gameSize: 'SMALL',
      missionId: 'QAI_11',
    });
    const actions = scorer.evaluateActions(context);

    const charge = actions.find(action => action.action === 'charge' && action.target?.id === enemy.id);
    expect(charge).toBeUndefined();
    expect(actions.some(action => action.action === 'move')).toBe(true);
  });

  it('does not generate charge when awkward melee attack would exceed AP budget', () => {
    const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
    const battlefield = new Battlefield(24, 24, []);
    const actor = createFighter('Actor', ['Polearm, Glaive']);
    const enemy = createFighter('Enemy');

    battlefield.placeCharacter(actor, { x: 10, y: 12 });
    battlefield.placeCharacter(enemy, { x: 13, y: 12 });

    const context = createContext({
      character: actor,
      enemies: [enemy],
      battlefield,
      apRemaining: 2,
      gameSize: 'SMALL',
      missionId: 'QAI_11',
    });
    const actions = scorer.evaluateActions(context);
    const charge = actions.find(action => action.action === 'charge' && action.target?.id === enemy.id);
    expect(charge).toBeUndefined();
  });

  it('keeps strategic enemy probes when immediate LOS is unavailable', () => {
    const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
    const battlefield = new Battlefield(24, 24, []);
    const actor = createFighter('Actor');
    const enemy = createFighter('Enemy');

    battlefield.placeCharacter(actor, { x: 2, y: 12 });
    battlefield.placeCharacter(enemy, { x: 20, y: 12 });

    const context = createContext({
      character: actor,
      enemies: [enemy],
      battlefield,
      apRemaining: 2,
      gameSize: 'SMALL',
      missionId: 'QAI_11',
    });
    context.config.perCharacterFovLos = true;

    const scorerAny = scorer as any;
    const originalHasLOS = scorerAny.hasLOS;
    scorerAny.hasLOS = () => false;
    try {
      const strategic = scorerAny.sampleStrategicPositions(context, { x: 2, y: 12 });
      expect(strategic.length).toBeGreaterThan(0);
    } finally {
      scorerAny.hasLOS = originalHasLOS;
    }
  });

  it('disables wait legality when allowWaitAction is false', () => {
    const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
    const battlefield = new Battlefield(24, 24, []);
    const actor = createFighter('Actor', ['Bow, Medium']);
    const enemy = createFighter('Enemy');

    battlefield.placeCharacter(actor, { x: 10, y: 10 });
    battlefield.placeCharacter(enemy, { x: 16, y: 10 });

    const context = createContext({
      character: actor,
      enemies: [enemy],
      battlefield,
      apRemaining: 2,
      allowWaitAction: false,
    });

    const loadout = (scorer as any).getLoadoutProfile(actor);
    const mask = (scorer as any).computeActionLegalityMask(context, loadout);
    expect(mask.canWait).toBe(false);
  });
});
