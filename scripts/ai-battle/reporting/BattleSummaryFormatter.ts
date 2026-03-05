/**
 * Battle Summary Formatter
 *
 * Generates human-readable summaries from battle audit data.
 * Creates executive summaries, key statistics, and turn-by-turn highlights.
 */

import type { BattleReport, BattleAuditTrace, TurnAudit, ActivationAudit } from '../../shared/BattleReportTypes';

export interface BattleSummary {
  executiveSummary: string;
  keyStatistics: KeyStatistics;
  turnHighlights: TurnHighlight[];
  mvp: MvpInfo | null;
  turningPoint: TurningPoint | null;
}

export interface KeyStatistics {
  winner: string;
  turnsCompleted: number;
  totalActions: number;
  totalEliminations: number;
  totalKOs: number;
  averageActionsPerTurn: number;
  mostActiveModel: string | null;
  longestTurn: number;
}

export interface TurnHighlight {
  turn: number;
  description: string;
  importance: 'critical' | 'significant' | 'notable';
}

export interface MvpInfo {
  modelName: string;
  side: string;
  reason: string;
  stats: {
    actions: number;
    hits: number;
    eliminations: number;
  };
}

export interface TurningPoint {
  turn: number;
  description: string;
  impact: string;
}

/**
 * Generate human-readable battle summary from audit data
 */
export function generateBattleSummary(report: BattleReport): BattleSummary {
  const audit = report.audit;
  const stats = report.stats as any;
  
  return {
    executiveSummary: generateExecutiveSummary(report),
    keyStatistics: generateKeyStatistics(report),
    turnHighlights: generateTurnHighlights(audit),
    mvp: findMVP(audit, report),
    turningPoint: findTurningPoint(audit),
  };
}

/**
 * Generate executive summary (1-2 paragraphs)
 */
function generateExecutiveSummary(report: BattleReport): string {
  const { config, winner, stats } = report;
  const statsAny = stats as any;
  const turnsCompleted = statsAny.turnsCompleted || 0;
  const totalActions = statsAny.totalActions || 0;
  
  const missionType = config.missionName || 'Elimination';
  const gameSize = config.gameSize || 'Unknown';
  const battlefieldSize = config.battlefieldSize || 24;
  
  // Count eliminations and KOs
  let eliminations = 0;
  let kos = 0;
  
  if (report.audit?.turns) {
    report.audit.turns.forEach(turn => {
      turn.activations.forEach(act => {
        act.steps.forEach(step => {
          if (step.details?.eliminated) eliminations++;
          if (step.details?.ko) kos++;
        });
      });
    });
  }
  
  const actionRate = turnsCompleted > 0 ? (totalActions / turnsCompleted).toFixed(1) : '0';
  
  let summary = `In this ${gameSize} ${missionType} battle on a ${battlefieldSize}×${battlefieldSize} MU battlefield, `;
  
  if (winner === 'Draw') {
    summary += `both sides fought to a stalemate after ${turnsCompleted} turns of intense combat. `;
  } else {
    summary += `${winner} emerged victorious after ${turnsCompleted} turns of fierce fighting. `;
  }
  
  summary += `A total of ${totalActions} actions were executed (${actionRate} per turn on average), `;
  summary += `resulting in ${eliminations} eliminations and ${kos} knockouts. `;
  
  // Add flavor based on action count
  if (totalActions > 150) {
    summary += 'The battle was characterized by aggressive maneuvering and frequent engagements.';
  } else if (totalActions < 50) {
    summary += 'Both sides exercised caution, with limited direct confrontations.';
  } else {
    summary += 'The pace of combat was moderate, with both sides trading blows strategically.';
  }
  
  return summary;
}

/**
 * Generate key statistics table
 */
function generateKeyStatistics(report: BattleReport): KeyStatistics {
  const stats = report.stats as any;
  
  // Count eliminations and KOs from audit
  let eliminations = 0;
  let kos = 0;
  
  if (report.audit?.turns) {
    report.audit.turns.forEach(turn => {
      turn.activations.forEach(act => {
        act.steps.forEach(step => {
          if (step.details?.eliminated) eliminations++;
          if (step.details?.ko) kos++;
        });
      });
    });
  }
  
  // Find most active model
  let mostActiveModel: string | null = null;
  let maxActions = 0;
  
  const modelActions = new Map<string, number>();
  if (report.audit?.turns) {
    report.audit.turns.forEach(turn => {
      turn.activations.forEach(act => {
        const key = `${act.sideName} - ${act.modelName}`;
        const count = (modelActions.get(key) || 0) + 1;
        modelActions.set(key, count);
        if (count > maxActions) {
          maxActions = count;
          mostActiveModel = key;
        }
      });
    });
  }
  
  // Find longest turn (by activation count)
  let longestTurn = 1;
  let maxActivations = 0;
  
  if (report.audit?.turns) {
    report.audit.turns.forEach(turn => {
      if (turn.activations.length > maxActivations) {
        maxActivations = turn.activations.length;
        longestTurn = turn.turn;
      }
    });
  }
  
  const turnsCompleted = stats.turnsCompleted || 0;
  const totalActions = stats.totalActions || 0;
  
  return {
    winner: report.winner || 'Unknown',
    turnsCompleted,
    totalActions,
    totalEliminations: eliminations,
    totalKOs: kos,
    averageActionsPerTurn: turnsCompleted > 0 ? Math.round(totalActions / turnsCompleted) : 0,
    mostActiveModel,
    longestTurn,
  };
}

/**
 * Generate turn-by-turn highlights
 */
function generateTurnHighlights(audit: BattleAuditTrace | undefined): TurnHighlight[] {
  if (!audit?.turns) return [];
  
  const highlights: TurnHighlight[] = [];
  
  audit.turns.forEach(turn => {
    const turnHighlights: Array<{ description: string; importance: TurnHighlight['importance'] }> = [];
    
    turn.activations.forEach(act => {
      act.steps.forEach(step => {
        // Critical: Elimination
        if (step.details?.eliminated) {
          turnHighlights.push({
            description: `${act.modelName} eliminated an enemy model`,
            importance: 'critical',
          });
        }
        // Significant: KO
        else if (step.details?.ko) {
          turnHighlights.push({
            description: `${act.modelName} knocked out an enemy`,
            importance: 'significant',
          });
        }
        // Notable: Hit in combat
        else if ((step.actionType === 'CloseCombatAttack' || step.actionType === 'RangedAttack') && 
                 step.details?.hit) {
          turnHighlights.push({
            description: `${act.modelName} landed a ${step.actionType === 'CloseCombatAttack' ? 'melee' : 'ranged'} attack`,
            importance: 'notable',
          });
        }
      });
    });
    
    // Add best highlight for this turn (prioritize critical > significant > notable)
    if (turnHighlights.length > 0) {
      const sorted = turnHighlights.sort((a, b) => {
        const importanceOrder = { critical: 3, significant: 2, notable: 1 };
        return importanceOrder[b.importance] - importanceOrder[a.importance];
      });
      
      // Add top 1-3 highlights per turn
      sorted.slice(0, Math.min(3, turnHighlights.length)).forEach(h => {
        highlights.push({
          turn: turn.turn,
          ...h,
        });
      });
    }
  });
  
  return highlights;
}

/**
 * Find the MVP (Most Valuable Player) of the battle
 */
function findMVP(audit: BattleAuditTrace | undefined, report: BattleReport): MvpInfo | null {
  if (!audit?.turns) return null;
  
  const modelStats = new Map<string, { 
    side: string; 
    actions: number; 
    hits: number; 
    eliminations: number;
  }>();
  
  audit.turns.forEach(turn => {
    turn.activations.forEach(act => {
      const key = act.modelId;
      if (!modelStats.has(key)) {
        modelStats.set(key, {
          side: act.sideName,
          actions: 0,
          hits: 0,
          eliminations: 0,
        });
      }
      
      const stats = modelStats.get(key)!;
      stats.actions++;
      
      act.steps.forEach(step => {
        if (step.details?.hit) stats.hits++;
        if (step.details?.eliminated) stats.eliminations++;
      });
    });
  });
  
  // Find model with highest score (eliminations * 3 + hits * 1 + actions * 0.5)
  let bestModel: { id: string; stats: any } | null = null;
  let bestScore = 0;

  modelStats.forEach((stats: any, id: string) => {
    const score = stats.eliminations * 3 + stats.hits * 1 + stats.actions * 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestModel = { id, stats };
    }
  });

  if (!bestModel) return null;

  // Get model name from ID
  const modelName = (bestModel as any).id.split('-').slice(0, -1).join('-') || (bestModel as any).id;

  let reason = `${(bestModel as any).stats.actions} actions executed`;
  if ((bestModel as any).stats.eliminations > 0) {
    reason = `${(bestModel as any).stats.eliminations} eliminations, ${reason}`;
  }
  if ((bestModel as any).stats.hits > 0) {
    reason = `${(bestModel as any).stats.hits} successful hits, ${reason}`;
  }

  return {
    modelName,
    side: (bestModel as any).stats.side,
    reason,
    stats: {
      actions: (bestModel as any).stats.actions,
      hits: (bestModel as any).stats.hits,
      eliminations: (bestModel as any).stats.eliminations,
    },
  };
}

/**
 * Find the turning point of the battle
 */
function findTurningPoint(audit: BattleAuditTrace | undefined): TurningPoint | null {
  if (!audit?.turns) return null;
  
  // Look for the turn with the most eliminations (likely the turning point)
  const turnEliminations = new Map<number, { count: number; descriptions: string[] }>();
  
  audit.turns.forEach(turn => {
    const elimData = { count: 0, descriptions: [] as string[] };
    
    turn.activations.forEach(act => {
      act.steps.forEach(step => {
        if (step.details?.eliminated) {
          elimData.count++;
          elimData.descriptions.push(`${act.modelName} eliminated an enemy`);
        }
      });
    });
    
    if (elimData.count > 0) {
      turnEliminations.set(turn.turn, elimData);
    }
  });
  
  if (turnEliminations.size === 0) return null;
  
  // Find turn with most eliminations
  let turningTurn = 1;
  let maxElims = 0;
  
  turnEliminations.forEach((data, turn) => {
    if (data.count > maxElims) {
      maxElims = data.count;
      turningTurn = turn;
    }
  });
  
  const elimData = turnEliminations.get(turningTurn)!;
  
  return {
    turn: turningTurn,
    description: `${maxElims} elimination${maxElims > 1 ? 's' : ''} occurred`,
    impact: elimData.descriptions[0] || 'Shift in momentum',
  };
}

/**
 * Format summary as human-readable text
 */
export function formatSummaryAsText(summary: BattleSummary): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('📊 BATTLE SUMMARY');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('📝 EXECUTIVE SUMMARY');
  lines.push(summary.executiveSummary);
  lines.push('');
  
  lines.push('📈 KEY STATISTICS');
  lines.push(`  Winner: ${summary.keyStatistics.winner}`);
  lines.push(`  Turns: ${summary.keyStatistics.turnsCompleted}`);
  lines.push(`  Total Actions: ${summary.keyStatistics.totalActions}`);
  lines.push(`  Eliminations: ${summary.keyStatistics.totalEliminations}`);
  lines.push(`  KOs: ${summary.keyStatistics.totalKOs}`);
  lines.push(`  Avg Actions/Turn: ${summary.keyStatistics.averageActionsPerTurn}`);
  if (summary.keyStatistics.mostActiveModel) {
    lines.push(`  Most Active: ${summary.keyStatistics.mostActiveModel}`);
  }
  lines.push(`  Longest Turn: ${summary.keyStatistics.longestTurn}`);
  lines.push('');
  
  if (summary.mvp) {
    lines.push('🏆 MVP');
    lines.push(`  ${summary.mvp.modelName} (${summary.mvp.side})`);
    lines.push(`  ${summary.mvp.reason}`);
    lines.push(`  Stats: ${summary.mvp.stats.actions} actions, ${summary.mvp.stats.hits} hits, ${summary.mvp.stats.eliminations} eliminations`);
    lines.push('');
  }
  
  if (summary.turningPoint) {
    lines.push('🔄 TURNING POINT');
    lines.push(`  Turn ${summary.turningPoint.turn}: ${summary.turningPoint.description}`);
    lines.push(`  Impact: ${summary.turningPoint.impact}`);
    lines.push('');
  }
  
  if (summary.turnHighlights.length > 0) {
    lines.push('⚡ KEY MOMENTS');
    summary.turnHighlights.slice(0, 10).forEach(h => {
      const icon = h.importance === 'critical' ? '🔴' : h.importance === 'significant' ? '🟡' : '🔵';
      lines.push(`  ${icon} Turn ${h.turn}: ${h.description}`);
    });
    lines.push('');
  }
  
  lines.push('═══════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}
