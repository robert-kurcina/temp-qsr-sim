import { MissionDefinition, VictoryConditionType, ScoringType, ScoringTiming } from './mission-definitions';

/**
 * QAI Mission 19: Defiance
 *
 * Defend your VIP against overwhelming enemy forces until reinforcements arrive.
 * VIP must survive for a set number of turns.
 * Reinforcements arrive mid-game to turn the tide.
 * Last VIP standing wins.
 */
export const DefianceMission: MissionDefinition = {
  id: 'QAI_19',
  name: 'Defiance',
  description: 'Defend your VIP against overwhelming enemy forces until reinforcements arrive. VIP must survive for a set number of turns.',
  minSides: 2,
  maxSides: 4,
  defaultGameSize: 'LARGE',
  victoryConditions: [
    {
      type: VictoryConditionType.VIPExtracted,
      side: 'any',
      instantWin: true,
      description: 'VIP survives until reinforcements arrive',
    },
    {
      type: VictoryConditionType.VIPEliminated,
      side: 'any',
      instantWin: true,
      description: 'All enemy VIPs are eliminated',
    },
    {
      type: VictoryConditionType.MostPoints,
      side: 'any',
      description: 'Most victory points at game end',
    },
  ],
  scoring: [
    {
      type: ScoringType.Bonus,
      timing: ScoringTiming.Immediate,
      value: 20,
      target: 'vip_survival',
      description: 'Score 20 VP if VIP survives until reinforcements',
    },
    {
      type: ScoringType.Bonus,
      timing: ScoringTiming.Immediate,
      value: 10,
      target: 'vip_defense',
      description: 'Score 10 VP for each turn VIP survives',
    },
    {
      type: ScoringType.Bonus,
      timing: ScoringTiming.Immediate,
      value: 5,
      target: 'enemy_vip_eliminated',
      description: 'Score 5 VP for eliminating enemy VIP',
    },
    {
      type: ScoringType.PerZoneControlled,
      timing: ScoringTiming.EndTurn,
      value: 2,
      description: 'Score 2 VP for each defense zone controlled at end of turn',
    },
  ],
  specialRules: [
    {
      id: 'vip_defense',
      name: 'VIP Defense',
      description: 'VIP starts in a fortified position. Defend until reinforcements arrive on turn 6.',
      effect: 'VIP gains 10 VP per turn survived',
    },
    {
      id: 'reinforcement_arrival',
      name: 'Reinforcement Arrival',
      description: 'Reinforcements arrive on turn 6 for all sides. VIP survival until then grants bonus VP.',
      effect: 'Turn 6 = reinforcements + 20 VP bonus if VIP alive',
    },
    {
      id: 'last_vip_standing',
      name: 'Last VIP Standing',
      description: 'If only one VIP remains alive, that side wins instantly.',
      effect: 'Last VIP = instant win',
    },
    {
      id: 'defense_zones',
      name: 'Defense Zones',
      description: 'Control defense zones around VIP position for VP and tactical advantage.',
      effect: 'Zones worth 2 VP per turn',
    },
  ],
  turnLimit: 12,
  endGameDieRoll: true,
  endGameDieStart: 8,
  keys: ['VIP', 'Reinforcements', 'POI'], // Uses VIP + Reinforcements + defense zones
  sizes: {
    VERY_SMALL: {
      vipSurvivalVP: 20,
      vipPerTurnVP: 10,
      enemyVipElimVP: 5,
      defenseZoneVP: 2,
      reinforcementTurn: 5,
      defenseZoneCount: 2,
    },
    SMALL: {
      vipSurvivalVP: 20,
      vipPerTurnVP: 10,
      enemyVipElimVP: 5,
      defenseZoneVP: 2,
      reinforcementTurn: 6,
      defenseZoneCount: 3,
    },
    MEDIUM: {
      vipSurvivalVP: 20,
      vipPerTurnVP: 10,
      enemyVipElimVP: 5,
      defenseZoneVP: 2,
      reinforcementTurn: 6,
      defenseZoneCount: 4,
    },
    LARGE: {
      vipSurvivalVP: 20,
      vipPerTurnVP: 10,
      enemyVipElimVP: 5,
      defenseZoneVP: 2,
      reinforcementTurn: 6,
      defenseZoneCount: 4,
    },
    VERY_LARGE: {
      vipSurvivalVP: 20,
      vipPerTurnVP: 10,
      enemyVipElimVP: 5,
      defenseZoneVP: 2,
      reinforcementTurn: 7,
      defenseZoneCount: 5,
    },
    Small: {
      vipSurvivalVP: 20,
      vipPerTurnVP: 10,
      enemyVipElimVP: 5,
      defenseZoneVP: 2,
      reinforcementTurn: 6,
      defenseZoneCount: 3,
    },
  },
};

/**
 * Get the Defiance mission definition
 */
export function getDefianceMission(): MissionDefinition {
  return DefianceMission;
}

/**
 * Check if a mission is the Defiance mission
 */
export function isDefianceMission(missionId: string): boolean {
  return missionId === 'QAI_19';
}
