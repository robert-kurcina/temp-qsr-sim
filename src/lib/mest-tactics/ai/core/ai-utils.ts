import { Character } from '../core/Character';
import { AIControllerConfig } from './AIController';
import { canAttackKOdTarget } from '../../status/kod-rules';

export function isAttackableEnemy(
  attacker: Character,
  enemy: Character,
  config: AIControllerConfig
): boolean {
  if (enemy.state.isEliminated) {
    return false;
  }
  if (!enemy.state.isKOd) {
    return true;
  }
  return canAttackKOdTarget(attacker, enemy, {
    enabled: config.allowKOdAttacks ?? false,
    controllerTraits: config.kodControllerTraitsByCharacterId?.[attacker.id],
    coordinatorTraits: config.kodCoordinatorTraitsByCharacterId?.[attacker.id],
  }).allowed;
}
