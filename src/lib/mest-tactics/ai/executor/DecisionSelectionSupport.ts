import { Battlefield } from '../../battlefield/Battlefield';
import { Character } from '../../core/Character';
import { Position } from '../../battlefield/Position';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { ActionDecision } from '../core/AIController';
import { CharacterAI } from '../core/CharacterAI';
import { SideAI } from '../strategic/SideAI';
import { AssemblyAI } from '../strategic/AssemblyAI';
import { runAIDecisionCycle } from './AIDecisionCycle';

interface DecisionSelectionConfig {
  enableStrategic: boolean;
  enableTactical: boolean;
  enableCharacterAI: boolean;
}

interface DecisionSelectionDeps {
  config: DecisionSelectionConfig;
  battlefield: Battlefield;
  characterAIs: Map<string, CharacterAI>;
  sideAIs: Map<string, SideAI>;
  assemblyAIs: Map<string, AssemblyAI>;
  getAIContext: (character: Character) => any;
  findCharacterSide: (character: Character) => string | null;
  findCharacterAssembly: (character: Character) => string | null;
  getEnemyCharacters: (character: Character) => Character[];
  findNearestEnemy: (character: Character) => Character | null;
  isValidDecision: (decision: ActionDecision, character: Character) => boolean;
  isEngagedWithAnyEnemy: (character: Character) => boolean;
  isEngagedWithEnemyTarget: (character: Character, target: Character) => boolean;
  findEngagedEnemy: (character: Character) => Character | null;
  resolveReachableMoveDestination: (character: Character, desired: Position) => Position | null;
  estimateImmediateMoveAllowance: (character: Character) => number;
  hasMeleeWeapon: (character: Character) => boolean;
  hasRangedWeapon: (character: Character) => boolean;
  getApRemaining: (character: Character) => number;
}

export function getAIDecisionForGameLoop(
  character: Character,
  deps: DecisionSelectionDeps
): ActionDecision | null {
  if (deps.config.enableStrategic || deps.config.enableTactical) {
    const strategicDecision = getStrategicDecisionForGameLoop(character, deps);
    if (strategicDecision) {
      return strategicDecision;
    }
  }

  if (deps.config.enableCharacterAI) {
    const charAI = deps.characterAIs.get(character.id);
    if (charAI) {
      const context = deps.getAIContext(character);
      const aiResult = runAIDecisionCycle(context, {
        decideAction: () => charAI.decideAction(context),
      });
      return aiResult.decision;
    }
  }

  return {
    type: 'hold',
    reason: 'No AI decision available',
    priority: 0,
    requiresAP: false,
  };
}

export function getStrategicDecisionForGameLoop(
  character: Character,
  deps: DecisionSelectionDeps
): ActionDecision | null {
  const sideId = deps.findCharacterSide(character);
  if (!sideId) return null;

  const sideAI = deps.sideAIs.get(sideId);
  if (sideAI && deps.config.enableStrategic) {
    const assessment = sideAI.assessSituation();
    const priorities = sideAI.getActionPriorities(assessment);

    const priority = priorities.get(character.id);
    if (priority) {
      if (deps.isValidDecision(priority, character)) {
        return priority;
      }
    }
  }

  const assemblyId = deps.findCharacterAssembly(character);
  if (assemblyId) {
    const assemblyAI = deps.assemblyAIs.get(assemblyId);
    if (assemblyAI && deps.config.enableTactical) {
      const assembly = character.profile ? {
        id: assemblyId,
        name: assemblyId,
        totalBP: 0,
        totalCharacters: 0,
      } : null;

      if (assembly) {
        const characters = [character];
        const enemies = deps.getEnemyCharacters(character);

        const targetAssignments = assemblyAI.coordinateTargets(characters, enemies);
        const decisions = assemblyAI.generateCoordinatedActions(
          characters,
          enemies,
          targetAssignments
        );

        const decision = decisions.get(character.id);
        if (decision) {
          return decision;
        }
      }
    }
  }

  return null;
}

export function getAlternativeDecisionForGameLoop(
  character: Character,
  failedDecision: ActionDecision,
  deps: DecisionSelectionDeps
): ActionDecision | null {
  const apRemaining = deps.getApRemaining(character);
  const aggressiveFallback = getAggressiveFallbackDecisionForGameLoop(
    character,
    apRemaining,
    failedDecision.target,
    deps
  );
  if (aggressiveFallback) {
    return aggressiveFallback;
  }

  switch (failedDecision.type) {
    case 'close_combat':
    case 'ranged_combat': {
      const nearestEnemy = deps.findNearestEnemy(character);
      if (nearestEnemy) {
        const startPos = deps.battlefield.getCharacterPosition(character);
        const pos = deps.battlefield.getCharacterPosition(nearestEnemy);
        if (pos && startPos) {
          const dx = pos.x - startPos.x;
          const dy = pos.y - startPos.y;
          const distance = Math.hypot(dx, dy);
          if (distance <= 0.001) {
            break;
          }
          const maxMove = deps.estimateImmediateMoveAllowance(character);
          const step = Math.min(Math.max(1, maxMove * 0.9), Math.max(0, distance - 1.25));
          const targetX = startPos.x + ((dx / distance) * step);
          const targetY = startPos.y + ((dy / distance) * step);
          const reachable = deps.resolveReachableMoveDestination(character, { x: targetX, y: targetY });
          if (!reachable) {
            break;
          }
          return {
            type: 'move',
            position: reachable,
            reason: 'Move toward enemy (fallback)',
            priority: 2,
            requiresAP: true,
          };
        }
      }
      break;
    }
    case 'move': {
      const target = deps.findNearestEnemy(character);
      if (target && deps.hasRangedWeapon(character) && !deps.isEngagedWithAnyEnemy(character)) {
        return {
          type: 'ranged_combat',
          target,
          reason: 'Attack from position (fallback)',
          priority: 2,
          requiresAP: true,
        };
      }
      break;
    }
    default:
      break;
  }

  return {
    type: 'hold',
    reason: 'Hold position (fallback)',
    priority: 0,
    requiresAP: false,
  };
}

export function getAggressiveFallbackDecisionForGameLoop(
  character: Character,
  apRemaining: number,
  preferredTarget: Character | undefined,
  deps: DecisionSelectionDeps
): ActionDecision | null {
  if (apRemaining <= 0) return null;
  const actorPos = deps.battlefield.getCharacterPosition(character);
  if (!actorPos) return null;

  const engagedEnemy = deps.findEngagedEnemy(character);
  if (engagedEnemy) {
    if (deps.hasMeleeWeapon(character)) {
      return {
        type: 'close_combat',
        target: engagedEnemy,
        reason: 'Fallback: spend AP on engaged enemy',
        priority: 2.6,
        requiresAP: true,
      };
    }
    return {
      type: 'disengage',
      target: engagedEnemy,
      reason: 'Fallback: disengage when engaged without melee option',
      priority: 2.4,
      requiresAP: true,
    };
  }

  const target = preferredTarget && !preferredTarget.state.isKOd && !preferredTarget.state.isEliminated
    ? preferredTarget
    : deps.findNearestEnemy(character);
  if (!target) return null;
  const targetPos = deps.battlefield.getCharacterPosition(target);
  if (!targetPos) return null;

  const actorBase = getBaseDiameterFromSiz(character.finalAttributes.siz ?? character.attributes.siz ?? 3);
  const targetBase = getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3);
  const actorModel = {
    id: character.id,
    position: actorPos,
    baseDiameter: actorBase,
    siz: character.finalAttributes.siz ?? character.attributes.siz ?? 3,
  };
  const targetModel = {
    id: target.id,
    position: targetPos,
    baseDiameter: targetBase,
    siz: target.finalAttributes.siz ?? target.attributes.siz ?? 3,
  };

  if (SpatialRules.isEngaged(actorModel, targetModel) && deps.hasMeleeWeapon(character)) {
    return {
      type: 'close_combat',
      target,
      reason: 'Fallback: spend AP on immediate close combat',
      priority: 2.5,
      requiresAP: true,
    };
  }

  const dx = targetPos.x - actorPos.x;
  const dy = targetPos.y - actorPos.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) return null;

  const requiredDistance = (actorBase + targetBase) / 2;
  const distanceToEngage = Math.max(0, distance - requiredDistance);
  const moveAllowance = deps.estimateImmediateMoveAllowance(character);
  const step = Math.min(moveAllowance, distanceToEngage);
  if (step <= 0.001) return null;

  const rawDestination = {
    x: actorPos.x + ((dx / distance) * step),
    y: actorPos.y + ((dy / distance) * step),
  };
  const destination = deps.resolveReachableMoveDestination(character, rawDestination);
  if (!destination) return null;

  if (deps.hasMeleeWeapon(character) && apRemaining >= 2 && distanceToEngage <= moveAllowance + 0.05) {
    const chargeDecision: ActionDecision = {
      type: 'charge',
      target,
      position: destination,
      reason: 'Fallback: charge to base contact',
      priority: 2.8,
      requiresAP: true,
    };
    if (deps.isValidDecision(chargeDecision, character)) {
      return chargeDecision;
    }
  }

  const moveDecision: ActionDecision = {
    type: 'move',
    position: destination,
    reason: 'Fallback: spend AP to close distance',
    priority: 2.2,
    requiresAP: true,
  };
  return deps.isValidDecision(moveDecision, character) ? moveDecision : null;
}

