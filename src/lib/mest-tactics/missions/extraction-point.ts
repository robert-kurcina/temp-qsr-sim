import { MissionDefinition, VictoryConditionType, ScoringType, ScoringTiming } from '../mission-definitions';

/**
 * QAI Mission 15: Extraction Point
 * 
 * Extract VIPs from designated extraction zones while preventing enemy extraction.
 * VIPs must reach extraction zones and spend actions to extract.
 * Enemy can intercept and eliminate VIPs.
 * First to extract their VIP OR most VP at game end wins.
 */
export const ExtractionPointMission: MissionDefinition = {
  id: 'QAI_15',
  name: 'Extraction Point',
  description: 'Extract VIPs from designated extraction zones while preventing enemy extraction. VIPs must reach extraction zones and spend actions to extract.',
  minSides: 2,
  maxSides: 4,
  defaultGameSize: 'SMALL',
  victoryConditions: [
    {
      type: VictoryConditionType.VIPExtracted,
      side: 'any',
      instantWin: true,
      description: 'Successfully extract your VIP',
    },
    {
      type: VictoryConditionType.VIPEliminated,
      side: 'any',
      instantWin: true,
      description: 'Enemy VIP is eliminated (if you have VIP)',
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
      value: 5,
      target: 'vip_extract',
      description: 'Score 5 VP for each successful VIP extraction',
    },
    {
      type: ScoringType.Bonus,
      timing: ScoringTiming.Immediate,
      value: 3,
      target: 'vip_defense',
      description: 'Score 3 VP if your VIP survives to game end',
    },
    {
      type: ScoringType.PerZoneControlled,
      timing: ScoringTiming.EndTurn,
      value: 1,
      description: 'Score 1 VP for each extraction zone controlled at end of turn',
    },
  ],
  specialRules: [
    {
      id: 'vip_extraction',
      name: 'VIP Extraction',
      description: 'VIPs must be in an extraction zone and spend a full turn extracting (no movement, vulnerable).',
      effect: 'Extraction takes 1 full turn, VIP is stationary and cannot defend',
    },
    {
      id: 'extraction_zones',
      name: 'Extraction Zones',
      description: '2-4 extraction zones are placed around the battlefield. VIPs can extract from any zone.',
      effect: 'Zones can be contested by enemy models',
    },
    {
      id: 'vip_protection',
      name: 'VIP Protection',
      description: 'If VIP is eliminated, that side loses instantly (if enemy has VIP).',
      effect: 'VIP death = instant loss condition',
    },
    {
      id: 'zone_contest',
      name: 'Zone Contest',
      description: 'If enemy models are in extraction zone, VIP cannot extract.',
      effect: 'Zone must be friendly-controlled for extraction',
    },
  ],
  turnLimit: 10,
  endGameDieRoll: true,
  endGameDieStart: 6,
  keys: ['Exit', 'Flawless', 'POI'], // Uses extraction zones + VIP
  sizes: {
    VERY_SMALL: {
      poiVP: 1,
      vipExtractVP: 5,
      vipSurviveVP: 3,
      extractionZoneCount: 2,
      exitVP: 5,
      flawlessVP: 0,
    },
    SMALL: {
      poiVP: 1,
      vipExtractVP: 5,
      vipSurviveVP: 3,
      extractionZoneCount: 3,
      exitVP: 5,
      flawlessVP: 0,
    },
    MEDIUM: {
      poiVP: 1,
      vipExtractVP: 5,
      vipSurviveVP: 3,
      extractionZoneCount: 4,
      exitVP: 5,
      flawlessVP: 0,
    },
    LARGE: {
      poiVP: 1,
      vipExtractVP: 5,
      vipSurviveVP: 3,
      extractionZoneCount: 4,
      exitVP: 5,
      flawlessVP: 0,
    },
    VERY_LARGE: {
      poiVP: 1,
      vipExtractVP: 5,
      vipSurviveVP: 3,
      extractionZoneCount: 4,
      exitVP: 5,
      flawlessVP: 0,
    },
    Small: {
      poiVP: 1,
      vipExtractVP: 5,
      vipSurviveVP: 3,
      extractionZoneCount: 3,
      exitVP: 5,
      flawlessVP: 0,
    },
  },
};

/**
 * Get the Extraction Point mission definition
 */
export function getExtractionPointMission(): MissionDefinition {
  return ExtractionPointMission;
}

/**
 * Check if a mission is the Extraction Point mission
 */
export function isExtractionPointMission(missionId: string): boolean {
  return missionId === 'QAI_15';
}
