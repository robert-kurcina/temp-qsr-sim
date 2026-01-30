// /src/ai/CharacterBehaviorProfiles.js
/**
 * Character-level AI behavior profiles
 */
export class CharacterBehaviorProfiles {
  constructor() {
    this.profiles = {
      aggressive: this.createAggressiveProfile(),
      melee: this.createMeleeProfile(),
      ranged: this.createRangedProfile(),
      moveFirst: this.createMoveFirstProfile(),
      healer: this.createHealerProfile(),
      counterStrike: this.createCounterStrikeProfile(),
      waitMode: this.createWaitModeProfile(),
      balanced: this.createBalancedProfile()
    };
  }

  /**
   * Aggressive Profile - Always attack if possible
   */
  createAggressiveProfile() {
    return {
      name: 'aggressive',
      priority: ['closeCombat', 'rangedCombat', 'move', 'wait'],
      combatPreference: 'attack',
      movementStyle: 'direct',

      evaluateAction(model, gameState) {
        const actions = this.getAvailableActions(model, gameState);

        // Always prefer combat over movement
        if (actions.closeCombat) return 'closeCombat';
        if (actions.rangedCombat) return 'rangedCombat';

        // Move toward enemies if no combat available
        if (actions.move) return 'move';

        return 'wait';
      },

      getAvailableActions(model, gameState) {
        const enemies = gameState.enemies.filter(e => this.isEnemyVisible(model, e));
        const closestEnemy = this.getClosestEnemy(model, enemies);
        const distance = closestEnemy ? this.calculateDistance(model.position, closestEnemy.position) : Infinity;

        return {
          closeCombat: distance <= 1,
          rangedCombat: distance > 1 && distance <= this.getWeaponRange(model),
          move: distance > 1,
          wait: true
        };
      }
    };
  }

  /**
   * Melee Profile - Focus on close combat
   */
  createMeleeProfile() {
    return {
      name: 'melee',
      priority: ['closeCombat', 'move', 'rangedCombat', 'wait'],

      evaluateAction(model, gameState) {
        const actions = this.getAvailableActions(model, gameState);

        // If in melee range, always fight
        if (actions.closeCombat) return 'closeCombat';

        // Move to engage enemies
        if (actions.move) return 'move';

        // Only use ranged as last resort
        if (actions.rangedCombat) return 'rangedCombat';

        return 'wait';
      },

      getAvailableActions(model, gameState) {
        const enemies = gameState.enemies.filter(e => this.isEnemyVisible(model, e));
        const hasMeleeWeapon = this.hasMeleeWeapon(model);
        const closestEnemy = this.getClosestEnemy(model, enemies);
        const distance = closestEnemy ? this.calculateDistance(model.position, closestEnemy.position) : Infinity;

        return {
          closeCombat: distance <= 1 && hasMeleeWeapon,
          rangedCombat: distance > 1 && distance <= this.getWeaponRange(model) && this.hasRangedWeapon(model),
          move: distance > 1 && hasMeleeWeapon,
          wait: true
        };
      }
    };
  }

  /**
   * Ranged Profile - Stay at distance
   */
  // Enhanced Ranged Profile with Fiddle support
  createRangedProfile() {
    return {
      name: 'ranged',
      priority: ['rangedCombat', 'fiddle', 'move', 'closeCombat', 'wait'],

      evaluateAction(model, gameState) {
        const enemies = gameState.enemies.filter(e => this.isEnemyVisible(model, e));
        const closestEnemy = this.getClosestEnemy(model, enemies);
        const distance = closestEnemy ? this.calculateDistance(model.position, closestEnemy.position) : Infinity;

        // Get optimal weapon configuration for current situation
        const optimalConfig = this.fiddleSystem.getOptimalConfiguration(model, enemies, distance);
        const currentConfig = this.fiddleSystem.getCurrentConfiguration(model);

        // Check if weapon switch is needed
        if (this.configsDiffer(optimalConfig, currentConfig)) {
          const fiddleCost = this.fiddleSystem.getFiddleCost(model, optimalConfig, gameState);

          // Only switch if we can afford the AP cost
          const apAvailable = 2 - (model.apSpent || 0);
          if (fiddleCost.cost <= apAvailable) {
            return {
              type: 'fiddle',
              target: optimalConfig,
              cost: fiddleCost.cost,
              switches: fiddleCost.switches
            };
          }
        }

        // Normal combat behavior
        const hasRangedWeapon = this.hasRangedWeaponEquipped(model);
        const hasMeleeWeapon = this.hasMeleeWeaponEquipped(model);

        if (distance <= 1 && hasMeleeWeapon) {
          return 'closeCombat';
        } else if (distance > 1 && distance <= this.getWeaponRange(model) && hasRangedWeapon) {
          return 'rangedCombat';
        } else if (distance > 1) {
          return 'move';
        }

        return 'wait';
      },

      configsDiffer(config1, config2) {
        return config1.primary !== config2.primary || config1.secondary !== config2.secondary;
      },

      hasRangedWeaponEquipped(model) {
        const config = this.fiddleSystem.getCurrentConfiguration(model);
        return config.primary && ['Bow', 'Range', 'Thrown'].includes(config.primary.class);
      },

      hasMeleeWeaponEquipped(model) {
        const config = this.fiddleSystem.getCurrentConfiguration(model);
        return config.primary && config.primary.class === 'Melee';
      }
    };
  }

  /**
   * Move First Profile - Prioritize positioning
   */
  createMoveFirstProfile() {
    return {
      name: 'moveFirst',
      priority: ['move', 'rangedCombat', 'closeCombat', 'wait'],

      evaluateAction(model, gameState) {
        const actions = this.getAvailableActions(model, gameState);

        // Always move first if possible
        if (actions.move && this.shouldReposition(model, gameState)) {
          return 'move';
        }

        // Then engage
        if (actions.rangedCombat) return 'rangedCombat';
        if (actions.closeCombat) return 'closeCombat';

        return 'wait';
      },

      shouldReposition(model, gameState) {
        // Check if already in optimal position
        const enemies = gameState.enemies.filter(e => this.isEnemyVisible(model, e));
        const optimalRange = this.getOptimalRange(model);
        const closestEnemy = this.getClosestEnemy(model, enemies);

        if (!closestEnemy) return false;

        const currentDistance = this.calculateDistance(model.position, closestEnemy.position);
        return Math.abs(currentDistance - optimalRange) > 2;
      }
    };
  }

  /**
   * Healer Profile - Support focused
   */
  createHealerProfile() {
    return {
      name: 'healer',
      priority: ['support', 'move', 'rangedCombat', 'wait'],

      evaluateAction(model, gameState) {
        const actions = this.getAvailableActions(model, gameState);

        // Check for wounded allies
        const woundedAllies = gameState.allies.filter(a => this.isWounded(a));
        if (woundedAllies.length > 0) {
          const closestWounded = this.getClosestAlly(model, woundedAllies);
          const distance = this.calculateDistance(model.position, closestWounded.position);

          if (distance <= 1) {
            return 'support'; // Heal action
          } else if (actions.move) {
            return 'move'; // Move to wounded ally
          }
        }

        // Fall back to ranged combat
        if (actions.rangedCombat) return 'rangedCombat';
        if (actions.move) return 'move';

        return 'wait';
      },

      isWounded(model) {
        const tokens = gameState.tokens.get(model.id) || {};
        return tokens.wound > 0;
      }
    };
  }

  /**
   * Counter-Strike Profile - Always react
   */
  createCounterStrikeProfile() {
    return {
      name: 'counterStrike',
      priority: ['wait', 'closeCombat', 'rangedCombat', 'move'],

      evaluateAction(model, gameState) {
        const actions = this.getAvailableActions(model, gameState);

        // Always wait to set up counter-strikes
        if (!this.isInDanger(model, gameState)) {
          return 'wait';
        }

        // If threatened, attack
        if (actions.closeCombat) return 'closeCombat';
        if (actions.rangedCombat) return 'rangedCombat';

        // Retreat if overwhelmed
        if (actions.move && this.isOverwhelmed(model, gameState)) {
          return 'move';
        }

        return 'wait';
      },

      isInDanger(model, gameState) {
        const enemies = gameState.enemies.filter(e => this.isEnemyVisible(model, e));
        const closeEnemies = enemies.filter(e => {
          const dist = this.calculateDistance(model.position, e.position);
          return dist <= 2;
        });
        return closeEnemies.length > 0;
      },

      isOverwhelmed(model, gameState) {
        const allies = gameState.allies.filter(a => this.isAllyNearby(model, a));
        const enemies = gameState.enemies.filter(e => {
          const dist = this.calculateDistance(model.position, e.position);
          return dist <= 2;
        });
        return enemies.length > allies.length + 1;
      }
    };
  }

  /**
   * Wait Mode Profile - Defensive
   */
  createWaitModeProfile() {
    return {
      name: 'waitMode',
      priority: ['wait', 'rangedCombat', 'move', 'closeCombat'],

      evaluateAction(model, gameState) {
        // Almost always wait
        if (!this.isCriticalSituation(model, gameState)) {
          return 'wait';
        }

        // Only act in emergencies
        const actions = this.getAvailableActions(model, gameState);
        if (actions.rangedCombat) return 'rangedCombat';
        if (actions.move) return 'move';
        if (actions.closeCombat) return 'closeCombat';

        return 'wait';
      },

      isCriticalSituation(model, gameState) {
        const tokens = gameState.tokens.get(model.id) || {};
        const fearLevel = tokens.fear || 0;
        const woundLevel = tokens.wound || 0;
        const allies = gameState.allies.filter(a => this.isAllyNearby(model, a));

        return fearLevel >= 3 || woundLevel >= 3 || allies.length === 0;
      }
    };
  }

  /**
   * Balanced Profile - Adaptive
   */
  createBalancedProfile() {
    return {
      name: 'balanced',
      priority: ['rangedCombat', 'closeCombat', 'move', 'wait'],

      evaluateAction(model, gameState) {
        const actions = this.getAvailableActions(model, gameState);
        const role = this.determineRole(model);

        switch (role) {
          case 'melee':
            if (actions.closeCombat) return 'closeCombat';
            if (actions.move) return 'move';
            break;
          case 'ranged':
            if (actions.rangedCombat) return 'rangedCombat';
            if (actions.move) return 'move';
            break;
          case 'support':
            if (this.hasSupportAbility(model)) {
              const woundedAllies = gameState.allies.filter(a => this.isWounded(a));
              if (woundedAllies.length > 0) return 'support';
            }
            break;
        }

        // Default behavior
        if (actions.rangedCombat) return 'rangedCombat';
        if (actions.closeCombat) return 'closeCombat';
        if (actions.move) return 'move';

        return 'wait';
      },

      determineRole(model) {
        if (this.hasMeleeWeapon(model) && !this.hasRangedWeapon(model)) return 'melee';
        if (this.hasRangedWeapon(model) && !this.hasMeleeWeapon(model)) return 'ranged';
        if (this.hasSupportEquipment(model)) return 'support';
        return 'hybrid';
      }
    };
  }

  // Utility methods
  hasMeleeWeapon(model) {
    const weapons = model.weapons || [];
    return weapons.some(w => w.class === 'Melee');
  }

  hasRangedWeapon(model) {
    const weapons = model.weapons || [];
    return weapons.some(w => w.class === 'Bow' || w.class === 'Range' || w.class === 'Thrown');
  }

  hasSupportEquipment(model) {
    const equipment = model.equipment || [];
    return equipment.some(e => e.type === 'Advantage');
  }

  getWeaponRange(model) {
    const weapons = model.weapons || [];
    const ranged = weapons.find(w => w.class === 'Bow' || w.class === 'Range');
    return ranged ? parseInt(ranged.or) || 8 : 1;
  }

  getOptimalRange(model) {
    const weapons = model.weapons || [];
    const ranged = weapons.find(w => w.class === 'Bow' || w.class === 'Range');
    return ranged ? (parseInt(ranged.or) || 8) / 2 : 1;
  }

  isEnemyVisible(model, enemy) {
    // Simplified visibility check
    const distance = this.calculateDistance(model.position, enemy.position);
    return distance <= 8;
  }

  calculateDistance(posA, posB) {
    return Math.sqrt(Math.pow(posA.x - posB.x, 2) + Math.pow(posA.y - posB.y, 2));
  }

  getClosestEnemy(model, enemies) {
    if (enemies.length === 0) return null;
    return enemies.reduce((closest, current) => {
      const distCurrent = this.calculateDistance(model.position, current.position);
      const distClosest = this.calculateDistance(model.position, closest.position);
      return distCurrent < distClosest ? current : closest;
    });
  }

  getClosestAlly(model, allies) {
    if (alies.length === 0) return null;
    return allies.reduce((closest, current) => {
      const distCurrent = this.calculateDistance(model.position, current.position);
      const distClosest = this.calculateDistance(model.position, closest.position);
      return distCurrent < distClosest ? current : closest;
    });
  }

  isAllyNearby(model, ally) {
    const distance = this.calculateDistance(model.position, ally.position);
    return distance <= 3;
  }
}