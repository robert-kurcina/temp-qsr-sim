import { MissionDefinition, VictoryConditionType, ScoringType, ScoringTiming } from './mission-definitions';

/**
 * QAI Mission 16: Exfil
 * 
 * Extract VIPs via reinforcements while enemy tries to stop the exfil.
 * VIPs must reach extraction zones and spend turns extracting.
 * Reinforcements arrive to help with extraction or defend.
 * First to extract VIP OR most VP at game end wins.
 */
export const ExfilMission: MissionDefinition = {
  id: 'QAI_16',
  name: 'Exfil',
  description: 'Extract VIPs via reinforcements while enemy tries to stop the exfil. VIPs must reach extraction zones and spend turns extracting.',
  minSides: 2,
  maxSides: 4,
  defaultGameSize: 'MEDIUM',
  victoryConditions: [
    {
      type: VictoryConditionType.VIPExtracted,
      side: 'any',
      instantWin: true,
      description: 'Successfully extract your VIP via reinforcements',
    },
    {
      type: VictoryConditionType.VIPEliminated,
      side: 'any',
      instantWin: true,
      description: 'Enemy VIP is eliminated',
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
      value: 10,
      target: 'vip_exfil',
      description: 'Score 10 VP for successful VIP exfiltration',
    },
    {
      type: ScoringType.Bonus,
      timing: ScoringTiming.Immediate,
      value: 5,
      target: 'reinforce_arrival',
      description: 'Score 5 VP when reinforcements arrive successfully',
    },
    {
      type: ScoringType.Bonus,
      timing: ScoringTiming.EndTurn,
      value: 2,
      target: 'vip_alive',
      description: 'Score 2 VP per turn if VIP is alive',
    },
  ],
  specialRules: [
    {
      id: 'vip_exfil',
      name: 'VIP Exfiltration',
      description: 'VIPs must reach extraction zone and spend 2 turns extracting. Reinforcements can assist.',
      effect: 'Exfil takes 2 turns, VIP vulnerable during exfil',
    },
    {
      id: 'reinforcement_arrival',
      name: 'Reinforcement Arrival',
      description: 'Reinforcements arrive on turn 4-6 (random). They can help secure exfil zone.',
      effect: 'Reinforcements provide additional models for zone control',
    },
    {
      id: 'vip_death',
      name: 'VIP Death',
      description: 'If VIP is eliminated, that side loses instantly.',
      effect: 'VIP death = instant loss',
    },
    {
      id: 'exfil_zone',
      name: 'Exfil Zone',
      description: 'Single exfil zone in center of battlefield. Must be controlled for exfil.',
      effect: 'Zone control required for exfil action',
    },
  ],
  turnLimit: 12,
  endGameDieRoll: true,
  endGameDieStart: 8,
  keys: ['Exit', 'VIP', 'Reinforcements'], // Uses VIP + Reinforcements + extraction
  sizes: {
    VERY_SMALL: {
      vipExfilVP: 10,
      reinforceVP: 5,
      vipAliveVP: 2,
      reinforcementTurnMin: 3,
      reinforcementTurnMax: 5,
    },
    SMALL: {
      vipExfilVP: 10,
      reinforceVP: 5,
      vipAliveVP: 2,
      reinforcementTurnMin: 4,
      reinforcementTurnMax: 6,
    },
    MEDIUM: {
      vipExfilVP: 10,
      reinforceVP: 5,
      vipAliveVP: 2,
      reinforcementTurnMin: 4,
      reinforcementTurnMax: 7,
    },
    LARGE: {
      vipExfilVP: 10,
      reinforceVP: 5,
      vipAliveVP: 2,
      reinforcementTurnMin: 5,
      reinforcementTurnMax: 7,
    },
    VERY_LARGE: {
      vipExfilVP: 10,
      reinforceVP: 5,
      vipAliveVP: 2,
      reinforcementTurnMin: 5,
      reinforcementTurnMax: 8,
    },
    Small: {
      vipExfilVP: 10,
      reinforceVP: 5,
      vipAliveVP: 2,
      reinforcementTurnMin: 4,
      reinforcementTurnMax: 6,
    },
  },
};

/**
 * Get the Exfil mission definition
 */
export function getExfilMission(): MissionDefinition {
  return ExfilMission;
}

/**
 * Check if a mission is the Exfil mission
 */
export function isExfilMission(missionId: string): boolean {
  return missionId === 'QAI_16';
}
