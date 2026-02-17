import { Character } from './Character';
import { GameManager } from './GameManager';
import { Battlefield } from './battlefield/Battlefield';
import { Position } from './battlefield/Position';
import { Item } from './Item';
import { getBaseDiameterFromSiz } from './battlefield/size-utils';
import { buildLOSResultContext, ActionContextInput } from './battlefield/action-context';
import { TurnPhase } from './types';
import { getCharacterTraitLevel } from './status-system';

export interface ControllerLogEntry {
  turn: number;
  round: number;
  actor: string;
  action: string;
  detail?: string;
}

export interface SkirmishConfig {
  maxTurns?: number;
  rng?: () => number;
  roundsPerTurn?: number;
  enableTransfix?: boolean;
  enableTakeCover?: boolean;
}

export class GameController {
  private manager: GameManager;
  private battlefield: Battlefield;
  private log: ControllerLogEntry[] = [];

  constructor(manager: GameManager, battlefield: Battlefield) {
    this.manager = manager;
    this.battlefield = battlefield;
  }

  runSkirmish(sideA: Character[], sideB: Character[], config: SkirmishConfig = {}): ControllerLogEntry[] {
    const maxTurns = config.maxTurns ?? 3;
    const rng = config.rng ?? Math.random;
    const enableTransfix = config.enableTransfix ?? false;
    const enableTakeCover = config.enableTakeCover ?? false;
    this.manager.roundsPerTurn = config.roundsPerTurn ?? this.manager.roundsPerTurn;
    this.manager.phase = TurnPhase.Setup;

    while (this.manager.currentTurn <= maxTurns) {
      if (this.manager.phase === TurnPhase.Setup || this.manager.phase === TurnPhase.TurnEnd) {
        this.manager.advancePhase({ roller: rng, roundsPerTurn: this.manager.roundsPerTurn });
        if (this.manager.currentTurn > maxTurns) break;
        this.log.push({ turn: this.manager.currentTurn, round: this.manager.currentRound, actor: '-', action: 'TurnStart' });
      }

      if (this.manager.phase !== TurnPhase.Activation) {
        this.manager.advancePhase({ roller: rng, roundsPerTurn: this.manager.roundsPerTurn });
        continue;
      }

      while (!this.manager.isTurnOver()) {
        const active = this.manager.getNextToActivate();
        if (!active) break;
        if (active.state.isEliminated) {
          this.manager.endActivation(active);
          continue;
        }

        const ap = this.manager.beginActivation(active);
        if (ap <= 0) {
          this.manager.endActivation(active);
          continue;
        }

        const sideEnemies = sideA.some(member => member.id === active.id) ? sideB : sideA;
        const activePos = this.manager.getCharacterPosition(active);
        if (!activePos) {
          this.manager.endActivation(active);
          continue;
        }

        const targetInfo = this.pickClosestTarget(activePos, sideEnemies);
        if (!targetInfo) {
          this.manager.endActivation(active);
          continue;
        }

        if (enableTransfix) {
          const transfixLevel = getCharacterTraitLevel(active, 'Transfix');
          if (transfixLevel > 0) {
            const results = this.manager.executeTransfixAction(active, sideEnemies, { rating: transfixLevel });
            const applied = results.filter(result => result.misses > 0);
            if (applied.length > 0) {
              const detail = applied.map(result => `${result.targetId} misses=${result.misses}`).join(', ');
              this.log.push({
                turn: this.manager.currentTurn,
                round: this.manager.currentRound,
                actor: active.name,
                action: 'Transfix',
                detail,
              });
            }
          }
        }

        const { target, position: targetPos } = targetInfo;
        const rangedWeapon = this.findWeapon(active, 'ranged');
        const meleeWeapon = this.findWeapon(active, 'melee');

        const spatial = this.buildActionInput(active, target, activePos, targetPos);
        const los = buildLOSResultContext(spatial);

        if (rangedWeapon && los.hasLOS && this.manager.spendAp(active, 1)) {
          const takeCoverPosition = enableTakeCover
            ? this.findTakeCoverPosition(target, active, targetPos, spatial)
            : null;
          const result = this.manager.executeRangedAttack(active, target, rangedWeapon, {
            ...spatial,
            allowTakeCover: Boolean(takeCoverPosition),
            takeCoverPosition: takeCoverPosition ?? undefined,
          });
          this.log.push({
            turn: this.manager.currentTurn,
            round: this.manager.currentRound,
            actor: active.name,
            action: 'RangedAttack',
            detail: `${active.name} -> ${target.name} hit=${result.result.hit}`,
          });
        } else if (meleeWeapon && this.isInBaseContact(active, target, activePos, targetPos) && this.manager.spendAp(active, 1)) {
          const result = this.manager.executeCloseCombatAttack(active, target, meleeWeapon, {
            ...spatial,
            moveStart: activePos,
            moveEnd: activePos,
            movedOverClear: false,
            wasFreeAtStart: true,
            opposingModels: sideEnemies.map(enemy => {
              const pos = this.manager.getCharacterPosition(enemy);
              return pos ? this.buildSpatialModel(enemy, pos) : null;
            }).filter(Boolean) as any,
          });
          this.log.push({
            turn: this.manager.currentTurn,
            round: this.manager.currentRound,
            actor: active.name,
            action: 'CloseCombat',
            detail: `${active.name} -> ${target.name} hit=${result.hit}`,
          });
        } else if (this.manager.spendAp(active, 1)) {
          const step = this.stepToward(activePos, targetPos);
          const moved = this.manager.moveCharacter(active, step);
          this.log.push({
            turn: this.manager.currentTurn,
            round: this.manager.currentRound,
            actor: active.name,
            action: 'Move',
            detail: `${active.name} to (${step.x}, ${step.y}) ${moved ? '' : '(blocked)'}`,
          });
        }

        this.manager.endActivation(active);
      }

      const bottleResults = this.manager.resolveBottleTests([
        {
          id: 'SideA',
          characters: sideA,
          orderedCandidate: this.pickOrderedCandidate(sideA),
          opposingCount: this.countRemaining(sideB),
        },
        {
          id: 'SideB',
          characters: sideB,
          orderedCandidate: this.pickOrderedCandidate(sideB),
          opposingCount: this.countRemaining(sideA),
        },
      ]);
      for (const [sideId, result] of Object.entries(bottleResults)) {
        if (result.bottledOut) {
          this.log.push({ turn: this.manager.currentTurn, round: this.manager.currentRound, actor: sideId, action: 'BottleOut' });
        }
      }

      this.manager.advancePhase({ roller: rng, roundsPerTurn: this.manager.roundsPerTurn });
    }

    return this.log;
  }

  private pickClosestTarget(start: Position, enemies: Character[]): { target: Character; position: Position; distance: number } | null {
    let closest: { target: Character; position: Position; distance: number } | null = null;
    for (const enemy of enemies) {
      if (enemy.state.isEliminated) continue;
      const pos = this.manager.getCharacterPosition(enemy);
      if (!pos) continue;
      const distance = Math.hypot(pos.x - start.x, pos.y - start.y);
      if (!closest || distance < closest.distance) {
        closest = { target: enemy, position: pos, distance };
      }
    }
    return closest;
  }

  private findWeapon(character: Character, kind: 'ranged' | 'melee'): Item | null {
    const equipment = character.profile.equipment || character.profile.items || [];
    for (const item of equipment) {
      if (!item) continue;
      const classification = item.classification || item.class || '';
      if (kind === 'melee' && classification.toLowerCase().includes('melee')) {
        return item;
      }
      if (kind === 'ranged' && !classification.toLowerCase().includes('melee') && item.or && item.dmg) {
        return item;
      }
    }
    return null;
  }

  private buildSpatialModel(character: Character, position: Position) {
    const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
    return {
      id: character.id,
      position,
      baseDiameter: getBaseDiameterFromSiz(siz),
      siz,
    };
  }

  private buildActionInput(attacker: Character, target: Character, attackerPos: Position, targetPos: Position): ActionContextInput {
    return {
      battlefield: this.battlefield,
      attacker: this.buildSpatialModel(attacker, attackerPos),
      target: this.buildSpatialModel(target, targetPos),
    };
  }

  private isInBaseContact(a: Character, b: Character, aPos: Position, bPos: Position): boolean {
    const aBase = getBaseDiameterFromSiz(a.finalAttributes.siz ?? a.attributes.siz ?? 3);
    const bBase = getBaseDiameterFromSiz(b.finalAttributes.siz ?? b.attributes.siz ?? 3);
    const distance = Math.hypot(aPos.x - bPos.x, aPos.y - bPos.y);
    return distance <= (aBase + bBase) / 2;
  }

  private stepToward(start: Position, target: Position): Position {
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
    const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;
    return { x: start.x + stepX, y: start.y + stepY };
  }

  private findTakeCoverPosition(
    defender: Character,
    attacker: Character,
    defenderPos: Position,
    spatial: ActionContextInput
  ): Position | null {
    if (!defender.state.isAttentive || !defender.state.isOrdered) return null;
    const moveLimit = defender.finalAttributes.mov ?? defender.attributes.mov ?? 0;
    if (moveLimit <= 0) return null;

    const directions: Position[] = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
      { x: -1, y: -1 },
    ];

    const scale = Math.min(1, moveLimit);
    let best: Position | null = null;
    let bestCover = 0;

    for (const dir of directions) {
      const candidate = {
        x: defenderPos.x + dir.x * scale,
        y: defenderPos.y + dir.y * scale,
      };
      if (candidate.x < 0 || candidate.y < 0 || candidate.x > this.battlefield.width || candidate.y > this.battlefield.height) {
        continue;
      }
      const cover = buildLOSResultContext({
        ...spatial,
        target: {
          ...spatial.target,
          position: candidate,
        },
      });
      const coverScore = (cover.hasDirectCover ? 2 : 0) + (cover.hasInterveningCover ? 1 : 0) + (!cover.hasLOS ? 3 : 0);
      if (coverScore > bestCover) {
        bestCover = coverScore;
        best = candidate;
      }
    }

    return bestCover > 0 ? best : null;
  }

  private countRemaining(characters: Character[]): number {
    return characters.filter(char => !char.state.isEliminated && !char.state.isKOd).length;
  }

  private pickOrderedCandidate(characters: Character[]): Character | null {
    return characters.find(char =>
      !char.state.isEliminated
      && !char.state.isKOd
      && char.state.isOrdered
      && char.state.isAttentive
    ) ?? null;
  }
}
