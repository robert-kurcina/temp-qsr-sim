/**
 * QSR-Compliant React System Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ReactEvaluator,
  ReactOpportunity,
  DEFAULT_REACT_CONFIG,
} from '../tactical/ReactsQSR';
import { Character } from '../../core/Character';
import { Profile } from '../../core/Profile';
import { Battlefield } from '../../battlefield/Battlefield';

function makeTestProfile(name: string, ref: number = 2, mov: number = 4): Profile {
  return {
    name,
    archetype: { attributes: { cca: 2, rca: 3, ref, int: 2, pow: 2, str: 2, for: 2, mov, siz: 3 } },
    items: [
      { name: 'Bow', classification: 'Bow', dmg: 'STR', impact: 0, accuracy: '', traits: [], range: 12 },
    ],
    totalBp: 30,
    adjustedBp: 0,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: 3,
    adjPhysicality: 3,
    durability: 3,
    adjDurability: 3,
    burden: { totalLaden: 0, totalBurden: 0 },
    totalHands: 2,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
}

function makeTestCharacter(name: string, ref: number = 2, mov: number = 4): Character {
  const character = new Character(makeTestProfile(name, ref, mov));
  character.finalAttributes = character.attributes;
  return character;
}

function makeTestContext(): { character: Character; allies: Character[]; enemies: Character[]; battlefield: Battlefield } {
  const character = makeTestCharacter('test');
  const ally = makeTestCharacter('ally');
  const enemy = makeTestCharacter('enemy');
  const battlefield = new Battlefield(24, 24);
  
  battlefield.placeCharacter(character, { x: 12, y: 12 });
  battlefield.placeCharacter(ally, { x: 10, y: 12 });
  battlefield.placeCharacter(enemy, { x: 16, y: 12 });
  
  return { character, allies: [ally], enemies: [enemy], battlefield };
}

function makeTestOpportunity(
  trigger: ReactOpportunity['trigger'],
  actor: Character,
  actorPosition: { x: number; y: number }
): ReactOpportunity {
  return {
    trigger,
    actor,
    actorPosition,
    isZeroAPAction: false,
    isReposition: false,
    usedAgility: false,
    isLeaning: false,
  };
}

describe('ReactEvaluator QSR', () => {
  it('should require Wait status to react (QSR p.1115)', () => {
    const evaluator = new ReactEvaluator();
    const context = makeTestContext();
    
    // Character not in Wait status
    context.character.state.isWaiting = false;
    
    const opportunity = makeTestOpportunity('move-only', context.enemies[0], { x: 14, y: 12 });
    
    const canReact = evaluator.canReact(context.character, opportunity, {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {} as any,
      config: {} as any,
    });
    
    expect(canReact.canReact).toBe(false);
    expect(canReact.reason).toBe('Character not in Wait status');
  });

  it('should allow react when in Wait status', () => {
    const evaluator = new ReactEvaluator();
    const context = makeTestContext();
    
    // Character in Wait status
    context.character.state.isWaiting = true;
    
    const opportunity = makeTestOpportunity('move-only', context.enemies[0], { x: 14, y: 12 });
    
    const canReact = evaluator.canReact(context.character, opportunity, {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {} as any,
      config: {} as any,
    });
    
    expect(canReact.canReact).toBe(true);
  });

  it('should block react if already reacted this initiative (QSR p.1115)', () => {
    const evaluator = new ReactEvaluator();
    const context = makeTestContext();
    
    context.character.state.isWaiting = true;
    
    const aiContext = {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {} as any,
      config: {} as any,
    };
    
    // Mark as already reacted
    evaluator.startNewInitiative(1);
    evaluator.markReacted(context.character, aiContext);
    
    const opportunity = makeTestOpportunity('move-only', context.enemies[0], { x: 14, y: 12 });
    
    const result = evaluator.evaluateReacts(
      context.character,
      opportunity,
      aiContext
    );
    
    expect(result.shouldReact).toBe(false);
    expect(result.reason).toContain('Already reacted');
  });

  it('should block react for zero AP actions (QSR p.1115)', () => {
    const evaluator = new ReactEvaluator();
    const context = makeTestContext();
    
    context.character.state.isWaiting = true;
    
    const opportunity: ReactOpportunity = {
      ...makeTestOpportunity('move-only', context.enemies[0], { x: 14, y: 12 }),
      isZeroAPAction: true,
    };
    
    const canReact = evaluator.canReact(context.character, opportunity, {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {} as any,
      config: {} as any,
    });
    
    expect(canReact.canReact).toBe(false);
    expect(canReact.reason).toContain('Zero AP');
  });

  it('should block react to reposition without base-contact (QSR p.1117)', () => {
    const evaluator = new ReactEvaluator();
    const context = makeTestContext();
    
    context.character.state.isWaiting = true;
    
    // Position far from character
    const opportunity: ReactOpportunity = {
      ...makeTestOpportunity('move-only', context.enemies[0], { x: 20, y: 12 }),
      isReposition: true,
    };
    
    const canReact = evaluator.canReact(context.character, opportunity, {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {} as any,
      config: {} as any,
    });
    
    expect(canReact.canReact).toBe(false);
    expect(canReact.reason).toContain('Reposition');
  });

  it('should check REF requirement for abrupt actions (QSR p.1117)', () => {
    const evaluator = new ReactEvaluator();
    const context = makeTestContext();
    
    // Actor has REF 4, reactor has REF 2
    const actor = makeTestCharacter('actor', 4, 4);
    const reactor = makeTestCharacter('reactor', 2, 4);
    reactor.state.isWaiting = true;
    
    const battlefield = new Battlefield(24, 24);
    battlefield.placeCharacter(reactor, { x: 12, y: 12 });
    battlefield.placeCharacter(actor, { x: 13, y: 12 }); // In melee
    
    const opportunity = makeTestOpportunity('abrupt-non-move', actor, { x: 13, y: 12 });
    
    const result = evaluator.evaluateReacts(
      reactor,
      opportunity,
      {
        character: reactor,
        allies: [],
        enemies: [actor],
        battlefield,
        currentTurn: 1,
        currentRound: 1,
        apRemaining: 2,
        knowledge: {} as any,
        config: {} as any,
      }
    );
    
    // REF 2 (reactor) < REF 4 (actor), should fail
    expect(result.meetsREFRequirement).toBe(false);
    expect(result.reason).toContain('REF');
  });

  it('should apply +1 REF for Waiting (QSR p.1119)', () => {
    const evaluator = new ReactEvaluator();
    
    const actor = makeTestCharacter('actor', 3, 4);
    const reactor = makeTestCharacter('reactor', 2, 4);
    reactor.state.isWaiting = true;
    
    const refCheck = evaluator.checkREFRequirement(
      reactor,
      actor,
      'abrupt-non-move',
      false,
      false
    );
    
    // REF 2 + 1 (Waiting) = 3 >= REF 3 (actor)
    expect(refCheck.meets).toBe(true);
    expect(refCheck.actualREF).toBe(3); // 2 + 1 for Waiting
  });

  it('should require +1 REF for reacting to being Engaged (QSR p.1117)', () => {
    const evaluator = new ReactEvaluator();
    
    const actor = makeTestCharacter('actor', 3, 4);
    const reactor = makeTestCharacter('reactor', 3, 4);
    
    const refCheck = evaluator.checkREFRequirement(
      reactor,
      actor,
      'abrupt-non-move',
      true, // Is engaged
      false
    );
    
    // REF 3 >= REF 3 + 1 (engaged) = 4? No, should fail
    expect(refCheck.meets).toBe(false);
    expect(refCheck.requiredREF).toBe(4); // 3 + 1 for engaged
  });

  it('should require +1 REF for reacting to another React (QSR p.1117)', () => {
    const evaluator = new ReactEvaluator();
    
    const actor = makeTestCharacter('actor', 3, 4);
    const reactor = makeTestCharacter('reactor', 3, 4);
    
    const refCheck = evaluator.checkREFRequirement(
      reactor,
      actor,
      'abrupt-non-move',
      false,
      true // Reacting to another react
    );
    
    expect(refCheck.meets).toBe(false);
    expect(refCheck.requiredREF).toBe(4); // 3 + 1 for reacting to react
  });

  it('should track side react usage per action (QSR p.1115)', () => {
    const evaluator = new ReactEvaluator();
    const context = makeTestContext();
    
    context.character.state.isWaiting = true;
    context.allies[0].state.isWaiting = true;
    
    evaluator.startNewInitiative(1);
    evaluator.startNewAction();
    
    const opportunity = makeTestOpportunity('move-only', context.enemies[0], { x: 14, y: 12 });
    
    const aiContext = {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {} as any,
      config: {} as any,
    };
    
    // First ally reacts
    const result1 = evaluator.evaluateReacts(
      context.allies[0],
      opportunity,
      aiContext
    );
    
    // Mark as reacted
    evaluator.markReacted(context.allies[0], aiContext);
    
    // Second ally on same side should be blocked
    const result2 = evaluator.evaluateReacts(
      context.character,
      opportunity,
      aiContext
    );
    
    expect(result2.reason).toContain('Side already reacted');
  });

  it('should reset react state for new initiative', () => {
    const evaluator = new ReactEvaluator();
    const context = makeTestContext();
    
    context.character.state.isWaiting = true;
    
    const aiContext = {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {} as any,
      config: {} as any,
    };
    
    evaluator.startNewInitiative(1);
    evaluator.markReacted(context.character, aiContext);
    
    const opportunity = makeTestOpportunity('move-only', context.enemies[0], { x: 14, y: 12 });
    
    // Should be blocked in initiative 1
    const result1 = evaluator.evaluateReacts(
      context.character,
      opportunity,
      aiContext
    );
    expect(result1.shouldReact).toBe(false);
    
    // Start new initiative - should be allowed again
    evaluator.startNewInitiative(2);
    const result2 = evaluator.evaluateReacts(
      context.character,
      opportunity,
      aiContext
    );
    
    // Should be allowed in new initiative (may still fail other checks)
    expect(result2.reason).not.toContain('Already reacted');
  });
});
