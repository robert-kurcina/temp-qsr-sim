import { MissionDefinition, VictoryConditionType, ScoringType, ScoringTiming } from '../mission-definitions';

/**
 * QAI Mission 18: Stealth
 *
 * Infiltrate enemy territory and extract intelligence (VIP) without being detected.
 * VIP starts hidden and must reach extraction point.
 * Detection triggers enemy reinforcements.
 * Stealth and timing are key to success.
 */
export const StealthMission: MissionDefinition = {
  id: 'QAI_18',
  name: 'Stealth',
  description: 'Infiltrate enemy territory and extract intelligence (VIP) without being detected. VIP starts hidden and must reach extraction point.',
  minSides: 2,
  maxSides: 2,
  defaultGameSize: 'MEDIUM',
  victoryConditions: [
    {
      type: VictoryConditionType.VIPExtracted,
      side: 'any',
      instantWin: true,
      description: 'Successfully extract your VIP via stealth',
    },
    {
      type: VictoryConditionType.VIPEliminated,
      side: 'any',
      instantWin: true,
      description: 'Enemy VIP is eliminated or captured',
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
      value: 15,
      target: 'ghost_exfil',
      description: 'Score 15 VP for successful ghost exfiltration (VIP never detected)',
    },
    {
      type: ScoringType.Bonus,
      timing: ScoringTiming.Immediate,
      value: 8,
      target: 'vip_exfil',
      description: 'Score 8 VP for VIP exfiltration (after detection)',
    },
    {
      type: ScoringType.Bonus,
      timing: ScoringTiming.Immediate,
      value: 5,
      target: 'vip_detected',
      description: 'Score 5 VP for detecting enemy VIP',
    },
    {
      type: ScoringType.PerZoneControlled,
      timing: ScoringTiming.EndTurn,
      value: 2,
      description: 'Score 2 VP for each stealth zone controlled at end of turn',
    },
  ],
  specialRules: [
    {
      id: 'ghost_vip',
      name: 'Ghost VIP',
      description: 'VIP starts hidden (undetected). Moving or engaging reveals VIP.',
      effect: 'VIP is Hidden until they take aggressive action',
    },
    {
      id: 'detection_trigger',
      name: 'Detection Trigger',
      description: 'When VIP is detected, enemy reinforcements arrive.',
      effect: 'Detection = enemy reinforcements on next turn',
    },
    {
      id: 'stealth_zones',
      name: 'Stealth Zones',
      description: 'Certain zones provide concealment. VIP in these zones cannot be detected.',
      effect: 'Zones grant Hidden status to VIP',
    },
    {
      id: 'ghost_bonus',
      name: 'Ghost Bonus',
      description: 'Extracting VIP without ever being detected grants bonus VP.',
      effect: 'Never detected = 15 VP instead of 8 VP',
    },
  ],
  turnLimit: 12,
  endGameDieRoll: true,
  endGameDieStart: 8,
  keys: ['VIP', 'Reinforcements', 'POI'], // Uses VIP + Reinforcements + stealth zones
  sizes: {
    VERY_SMALL: {
      ghostExfilVP: 15,
      vipExfilVP: 8,
      detectVIPVP: 5,
      stealthZoneVP: 2,
      stealthZoneCount: 2,
    },
    SMALL: {
      ghostExfilVP: 15,
      vipExfilVP: 8,
      detectVIPVP: 5,
      stealthZoneVP: 2,
      stealthZoneCount: 3,
    },
    MEDIUM: {
      ghostExfilVP: 15,
      vipExfilVP: 8,
      detectVIPVP: 5,
      stealthZoneVP: 2,
      stealthZoneCount: 3,
    },
    LARGE: {
      ghostExfilVP: 15,
      vipExfilVP: 8,
      detectVIPVP: 5,
      stealthZoneVP: 2,
      stealthZoneCount: 4,
    },
    VERY_LARGE: {
      ghostExfilVP: 15,
      vipExfilVP: 8,
      detectVIPVP: 5,
      stealthZoneVP: 2,
      stealthZoneCount: 4,
    },
    Small: {
      ghostExfilVP: 15,
      vipExfilVP: 8,
      detectVIPVP: 5,
      stealthZoneVP: 2,
      stealthZoneCount: 3,
    },
  },
};

/**
 * Get the Stealth mission definition
 */
export function getStealthMission(): MissionDefinition {
  return StealthMission;
}

/**
 * Check if a mission is the Stealth mission
 */
export function isStealthMission(missionId: string): boolean {
  return missionId === 'QAI_18';
}
