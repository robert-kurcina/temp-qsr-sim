// /src/ai/PlayerStrategems.js
/**
 * Player-level strategic AI with coordination strategems
 */
export class PlayerStrategems {
  constructor() {
    this.strategems = {
      outnumber: this.createOutnumberStrategem(),
      opportune: this.createOpportuneStrategem(),
      rush: this.createRushStrategem(),
      defensive: this.createDefensiveStrategem(),
      flanking: this.createFlankingStrategem(),
      preserve: this.createPreserveStrategem()
    };
  }
  
  /**
   * Outnumber Strategem - Coordinate to overwhelm enemies
   */
  createOutnumberStrategem() {
    return {
      name: 'outnumber',
      description: 'Coordinate models to outnumber enemy positions',
      
      coordinateTurn(models, gameState) {
        const actions = new Map();
        const enemies = gameState.enemies.filter(e => this.isThreatening(e, gameState));
        
        // Group models by target priority
        const targetAssignments = this.assignTargetsByPriority(models, enemies);
        
        // Coordinate movement to achieve outnumbering
        models.forEach(model => {
          const target = targetAssignments.get(model.id);
          if (target) {
            // Check if we can achieve outnumbering
            const currentEngaged = this.getModelsEngaging(target, gameState);
            const ourModels = currentEngaged.filter(m => m.side === model.side);
            const enemyModels = currentEngaged.filter(m => m.side !== model.side);
            
            if (ourModels.length <= enemyModels.length) {
              // Move to engage and outnumber
              actions.set(model.id, { type: 'move', target: target.position });
            } else {
              // We have numerical advantage, attack
              actions.set(model.id, { type: 'closeCombat', target: target });
            }
          } else {
            // No immediate targets, hold position or support
            actions.set(model.id, { type: 'wait' });
          }
        });
        
        return actions;
      },
      
      assignTargetsByPriority(models, enemies) {
        const assignments = new Map();
        const unassignedModels = [...models];
        const unassignedEnemies = [...enemies];
        
        // Sort enemies by threat level
        unassignedEnemies.sort((a, b) => this.calculateThreatLevel(b, enemies) - this.calculateThreatLevel(a, enemies));
        
        // Assign models to highest priority targets
        unassignedEnemies.forEach(enemy => {
          const neededModels = Math.max(1, Math.ceil(this.calculateThreatLevel(enemy, enemies) / 2));
          const availableModels = unassignedModels.splice(0, neededModels);
          
          availableModels.forEach(model => {
            assignments.set(model.id, enemy);
          });
        });
        
        return assignments;
      },
      
      getModelsEngaging(target, gameState) {
        return gameState.allModels.filter(model => {
          const distance = this.calculateDistance(model.position, target.position);
          return distance <= 1;
        });
      }
    };
  }
  
  /**
   * Opportune Strategem - Wait for perfect moments
   */
  createOpportuneStrategem() {
    return {
      name: 'opportune',
      description: 'Wait for optimal attack opportunities',
      
      coordinateTurn(models, gameState) {
        const actions = new Map();
        const highValueTargets = this.identifyHighValueTargets(gameState.enemies);
        
        models.forEach(model => {
          const bestOpportunity = this.findBestOpportunity(model, highValueTargets, gameState);
          
          if (bestOpportunity && bestOpportunity.score > 0.7) {
            // Execute the opportunity
            actions.set(model.id, bestOpportunity.action);
          } else {
            // Wait for better opportunity
            actions.set(model.id, { type: 'wait' });
          }
        });
        
        return actions;
      },
      
      findBestOpportunity(model, targets, gameState) {
        let bestOpportunity = null;
        let bestScore = 0;
        
        targets.forEach(target => {
          // Calculate opportunity score
          const distance = this.calculateDistance(model.position, target.position);
          const cover = this.getTargetCover(target, gameState);
          const isolation = this.isTargetIsolated(target, gameState);
          const vulnerability = this.getTargetVulnerability(target);
          
          let score = 0;
          if (distance <= this.getWeaponRange(model)) {
            score += 0.3; // In range
            if (cover === 'none') score += 0.2; // No cover
            if (isolation) score += 0.3; // Isolated
            if (vulnerability > 0.5) score += 0.2; // Vulnerable
          }
          
          if (score > bestScore) {
            bestScore = score;
            bestOpportunity = {
              score: score,
              action: distance <= 1 ? 
                { type: 'closeCombat', target: target } : 
                { type: 'rangedCombat', target: target }
            };
          }
        });
        
        return bestOpportunity;
      }
    };
  }
  
  /**
   * Rush Strategem - Aggressive assault
   */
  createRushStrategem() {
    return {
      name: 'rush',
      description: 'Aggressive forward assault to eliminate enemies quickly',
      
      coordinateTurn(models, gameState) {
        const actions = new Map();
        const frontline = this.determineFrontline(models, gameState);
        
        models.forEach(model => {
          if (frontline.includes(model)) {
            // Frontline models attack aggressively
            const closestEnemy = this.getClosestEnemy(model, gameState.enemies);
            if (closestEnemy) {
              const distance = this.calculateDistance(model.position, closestEnemy.position);
              if (distance <= 1) {
                actions.set(model.id, { type: 'closeCombat', target: closestEnemy });
              } else {
                actions.set(model.id, { type: 'move', target: closestEnemy.position });
              }
            } else {
              actions.set(model.id, { type: 'move', target: this.getCenterOfBattlefield(gameState) });
            }
          } else {
            // Support models advance to support
            const frontlinePos = this.getAveragePosition(frontline);
            actions.set(model.id, { type: 'move', target: frontlinePos });
          }
        });
        
        return actions;
      }
    };
  }
  
  /**
   * Defensive Strategem - Hold positions
   */
  createDefensiveStrategem() {
    return {
      name: 'defensive',
      description: 'Hold defensive positions and react to threats',
      
      coordinateTurn(models, gameState) {
        const actions = new Map();
        const defensivePositions = this.calculateDefensivePositions(models, gameState);
        
        models.forEach(model => {
          const threats = this.getThreatsToModel(model, gameState);
          
          if (threats.length > 0) {
            // React to immediate threats
            const closestThreat = this.getClosestEnemy(model, threats);
            const distance = this.calculateDistance(model.position, closestThreat.position);
            
            if (distance <= this.getWeaponRange(model)) {
              actions.set(model.id, { 
                type: distance <= 1 ? 'closeCombat' : 'rangedCombat', 
                target: closestThreat 
              });
            } else {
              // Maintain defensive position
              actions.set(model.id, { type: 'wait' });
            }
          } else {
            // Hold defensive position
            const idealPos = defensivePositions.get(model.id);
            const currentDistance = this.calculateDistance(model.position, idealPos);
            
            if (currentDistance > 1) {
              actions.set(model.id, { type: 'move', target: idealPos });
            } else {
              actions.set(model.id, { type: 'wait' });
            }
          }
        });
        
        return actions;
      }
    };
  }
  
  /**
   * Flanking Strategem - Coordinate flanking maneuvers
   */
  createFlankingStrategem() {
    return {
      name: 'flanking',
      description: 'Coordinate flanking attacks from multiple angles',
      
      coordinateTurn(models, gameState) {
        const actions = new Map();
        const enemies = gameState.enemies.filter(e => this.isThreatening(e, gameState));
        
        if (enemies.length === 0) {
          // No enemies, hold formation
          models.forEach(model => actions.set(model.id, { type: 'wait' }));
          return actions;
        }
        
        // Assign flanking roles
        const flankers = this.assignFlankingRoles(models, enemies[0]);
        
        models.forEach(model => {
          const role = flankers.get(model.id);
          const target = enemies[0]; // Focus on primary target
          
          switch(role) {
            case 'main':
              // Main assault force
              const distance = this.calculateDistance(model.position, target.position);
              if (distance <= 1) {
                actions.set(model.id, { type: 'closeCombat', target: target });
              } else {
                actions.set(model.id, { type: 'move', target: target.position });
              }
              break;
              
            case 'flanker':
              // Flank from the side
              const flankPosition = this.calculateFlankPosition(model, target, gameState);
              const flankDistance = this.calculateDistance(model.position, flankPosition);
              
              if (flankDistance <= 1) {
                // In flanking position, attack
                actions.set(model.id, { type: 'closeCombat', target: target });
              } else {
                // Move to flanking position
                actions.set(model.id, { type: 'move', target: flankPosition });
              }
              break;
              
            case 'support':
              // Provide ranged support
              if (this.hasRangedWeapon(model)) {
                actions.set(model.id, { type: 'rangedCombat', target: target });
              } else {
                actions.set(model.id, { type: 'move', target: this.getSupportPosition(model, target, gameState) });
              }
              break;
          }
        });
        
        return actions;
      }
    };
  }
  
  /**
   * Preserve Strategem - Minimize casualties
   */
  createPreserveStrategem() {
    return {
      name: 'preserve',
      description: 'Minimize casualties while achieving objectives',
      
      coordinateTurn(models, gameState) {
        const actions = new Map();
        const highRiskModels = models.filter(m => this.isHighRisk(m, gameState));
        const lowRiskModels = models.filter(m => !this.isHighRisk(m, gameState));
        
        // High-risk models stay safe
        highRiskModels.forEach(model => {
          const safePosition = this.findSafestPosition(model, gameState);
          const currentDistance = this.calculateDistance(model.position, safePosition);
          
          if (currentDistance > 1) {
            actions.set(model.id, { type: 'move', target: safePosition });
          } else {
            actions.set(model.id, { type: 'wait' });
          }
        });
        
        // Low-risk models take the fight
        lowRiskModels.forEach(model => {
          const enemies = gameState.enemies.filter(e => this.isEnemyVisible(model, e));
          if (enemies.length > 0) {
            const target = this.selectSafestTarget(model, enemies, gameState);
            const distance = this.calculateDistance(model.position, target.position);
            
            if (distance <= this.getWeaponRange(model)) {
              actions.set(model.id, { 
                type: distance <= 1 ? 'closeCombat' : 'rangedCombat', 
                target: target 
              });
            } else {
              // Only advance if safe to do so
              const pathSafety = this.calculatePathSafety(model, target.position, gameState);
              if (pathSafety > 0.7) {
                actions.set(model.id, { type: 'move', target: target.position });
              } else {
                actions.set(model.id, { type: 'wait' });
              }
            }
          } else {
            actions.set(model.id, { type: 'wait' });
          }
        });
        
        return actions;
      }
    };
  }
  
  // Utility methods
  isThreatening(enemy, gameState) {
    const distanceToAllies = gameState.allies.map(a => 
      this.calculateDistance(enemy.position, a.position)
    );
    return Math.min(...distanceToAllies) <= 8;
  }
  
  calculateThreatLevel(enemy, allEnemies) {
    // Higher stats = higher threat
    return (enemy.cca + enemy.rca + enemy.ref) / 3;
  }
  
  identifyHighValueTargets(enemies) {
    // Sort by threat level
    return enemies.sort((a, b) => 
      (b.cca + b.rca + b.ref) - (a.cca + a.rca + a.ref)
    );
  }
  
  getTargetCover(target, gameState) {
    // Simplified cover detection
    return 'none'; // Would integrate with terrain system
  }
  
  isTargetIsolated(target, gameState) {
    const nearbyEnemies = gameState.enemies.filter(e => {
      const dist = this.calculateDistance(target.position, e.position);
      return dist <= 3 && e.id !== target.id;
    });
    return nearbyEnemies.length === 0;
  }
  
  getTargetVulnerability(target) {
    const tokens = gameState.tokens.get(target.id) || {};
    const woundLevel = tokens.wound || 0;
    const fearLevel = tokens.fear || 0;
    return (woundLevel + fearLevel) / 10; // Normalize to 0-1
  }
  
  determineFrontline(models, gameState) {
    // Models closest to enemies are frontline
    const enemyCenter = this.getAveragePosition(gameState.enemies);
    return models.sort((a, b) => {
      const distA = this.calculateDistance(a.position, enemyCenter);
      const distB = this.calculateDistance(b.position, enemyCenter);
      return distA - distB;
    }).slice(0, Math.ceil(models.length / 2));
  }
  
  getCenterOfBattlefield(gameState) {
    const allModels = [...gameState.allies, ...gameState.enemies];
    return this.getAveragePosition(allModels);
  }
  
  getAveragePosition(models) {
    if (models.length === 0) return { x: 0, y: 0 };
    
    const sumX = models.reduce((sum, m) => sum + m.position.x, 0);
    const sumY = models.reduce((sum, m) => sum + m.position.y, 0);
    
    return {
      x: sumX / models.length,
      y: sumY / models.length
    };
  }
  
  calculateDefensivePositions(models, gameState) {
    const positions = new Map();
    const center = this.getCenterOfBattlefield(gameState);
    
    models.forEach((model, index) => {
      // Create defensive perimeter
      const angle = (index / models.length) * Math.PI * 2;
      const radius = 5;
      positions.set(model.id, {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      });
    });
    
    return positions;
  }
  
  getThreatsToModel(model, gameState) {
    return gameState.enemies.filter(enemy => {
      const distance = this.calculateDistance(model.position, enemy.position);
      return distance <= this.getWeaponRange(enemy) + 2;
    });
  }
  
  assignFlankingRoles(models, target) {
    const roles = new Map();
    const meleeModels = models.filter(m => this.hasMeleeWeapon(m));
    const rangedModels = models.filter(m => this.hasRangedWeapon(m));
    
    // Assign main assault
    if (meleeModels.length > 0) {
      roles.set(meleeModels[0].id, 'main');
      meleeModels.shift();
    }
    
    // Assign flankers
    meleeModels.slice(0, 2).forEach(model => {
      roles.set(model.id, 'flanker');
    });
    
    // Rest are support
    models.forEach(model => {
      if (!roles.has(model.id)) {
        roles.set(model.id, 'support');
      }
    });
    
    return roles;
  }
  
  calculateFlankPosition(model, target, gameState) {
    // Calculate position 90 degrees from target's facing
    const allies = gameState.allies.filter(a => a.id !== model.id);
    const allyCenter = this.getAveragePosition(allies);
    
    const dx = target.position.x - allyCenter.x;
    const dy = target.position.y - allyCenter.y;
    
    // Perpendicular vector for flanking
    return {
      x: target.position.x - dy,
      y: target.position.y + dx
    };
  }
  
  getSupportPosition(model, target, gameState) {
    const allies = gameState.allies.filter(a => a.id !== model.id);
    const allyCenter = this.getAveragePosition(allies);
    
    // Position behind the main force
    const dx = target.position.x - allyCenter.x;
    const dy = target.position.y - allyCenter.y;
    
    return {
      x: allyCenter.x - dx * 0.5,
      y: allyCenter.y - dy * 0.5
    };
  }
  
  isHighRisk(model, gameState) {
    const tokens = gameState.tokens.get(model.id) || {};
    const woundLevel = tokens.wound || 0;
    const fearLevel = tokens.fear || 0;
    const alliesNearby = gameState.allies.filter(a => {
      const dist = this.calculateDistance(model.position, a.position);
      return dist <= 3;
    }).length;
    
    return woundLevel >= 2 || fearLevel >= 2 || alliesNearby === 0;
  }
  
  findSafestPosition(model, gameState) {
    // Move toward friendly models
    const allies = gameState.allies.filter(a => a.id !== model.id);
    if (alies.length === 0) return model.position;
    
    return this.getAveragePosition(alies);
  }
  
  selectSafestTarget(model, enemies, gameState) {
    return enemies.reduce((safest, current) => {
      const currentRisk = this.calculateAttackRisk(model, current, gameState);
      const safestRisk = this.calculateAttackRisk(model, safest, gameState);
      return currentRisk < safestRisk ? current : safest;
    });
  }
  
  calculateAttackRisk(attacker, target, gameState) {
    const distance = this.calculateDistance(attacker.position, target.position);
    const enemyThreats = gameState.enemies.filter(e => {
      const dist = this.calculateDistance(e.position, attacker.position);
      return dist <= this.getWeaponRange(e);
    }).length;
    
    return enemyThreats + (distance > 1 ? 0.5 : 0); // Melee is riskier
  }
  
  calculatePathSafety(model, target, gameState) {
    // Simplified: safety based on enemy proximity along path
    const midpoint = {
      x: (model.position.x + target.x) / 2,
      y: (model.position.y + target.y) / 2
    };
    
    const nearbyEnemies = gameState.enemies.filter(e => {
      const dist = this.calculateDistance(e.position, midpoint);
      return dist <= 3;
    });
    
    return 1 - (nearbyEnemies.length * 0.3);
  }
  
  // Reuse utility methods from CharacterBehaviorProfiles
  hasMeleeWeapon(model) { /* ... */ }
  hasRangedWeapon(model) { /* ... */ }
  getWeaponRange(model) { /* ... */ }
  calculateDistance(posA, posB) { /* ... */ }
  getClosestEnemy(model, enemies) { /* ... */ }
  isEnemyVisible(model, enemy) { /* ... */ }
}