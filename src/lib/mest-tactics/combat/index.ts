/**
 * Combat System
 *
 * Close combat, ranged combat, and indirect fire mechanics.
 */

export { makeCloseCombatAttack, resolveCloseCombatHitTest } from './close-combat';
export { makeRangedCombatAttack } from './ranged-combat';
export { makeIndirectRangedAttack } from './indirect-ranged-combat';
export type { AttackResult } from './close-combat';
