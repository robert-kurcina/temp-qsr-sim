import { GameSize } from './mission-scoring';

export type MissionKey =
  | 'Elimination'
  | 'Bottled'
  | 'Outnumbered'
  | 'Dominance'
  | 'FirstBlood'
  | 'Courier'
  | 'Sanctuary'
  | 'Sabotage'
  | 'Harvest'
  | 'POI'
  | 'Catalyst'
  | 'VIP'
  | 'Targeted'
  | 'Collection'
  | 'Acquisition'
  | 'Encroachment'
  | 'Exit'
  | 'Flawless';

export interface MissionSizeConfig {
  endGameTurn: number;
  dominanceWinVp?: number;
  courierWinVp?: number;
  sanctuaryWinVp?: number;
  objectiveWinVp?: number;
}

export interface MissionDefinition {
  id: string;
  name: string;
  sidesMin: number;
  sidesMax: number;
  keys: MissionKey[];
  sizes: Record<GameSize, MissionSizeConfig>;
  notes?: string[];
}

export const MISSION_DEFINITIONS: Record<string, MissionDefinition> = {
  QAI_1: {
    id: 'QAI_1',
    name: 'Elimination',
    sidesMin: 2,
    sidesMax: 2,
    keys: ['Elimination', 'Bottled', 'Outnumbered'],
    sizes: {
      Small: { endGameTurn: 4 },
      Medium: { endGameTurn: 6 },
      Large: { endGameTurn: 8 },
    },
  },
  QAI_12: {
    id: 'QAI_12',
    name: 'Engagement',
    sidesMin: 2,
    sidesMax: 4,
    keys: ['Dominance', 'Elimination', 'Bottled', 'FirstBlood'],
    sizes: {
      Small: { endGameTurn: 4, dominanceWinVp: 3 },
      Medium: { endGameTurn: 6, dominanceWinVp: 4 },
      Large: { endGameTurn: 8, dominanceWinVp: 5 },
    },
    notes: [
      'Power Nodes (POI) at center with cover nearby.',
      'Reinforcements: groups A/B/C by BP with reinforcement dice.',
      'Anti-kingmaking targeting restriction.',
      'Early elimination bonus when a third side is eliminated.',
    ],
  },
  QAI_13: {
    id: 'QAI_13',
    name: 'Sabotage',
    sidesMin: 2,
    sidesMax: 2,
    keys: ['Sabotage', 'Elimination', 'POI', 'Bottled'],
    sizes: {
      Small: { endGameTurn: 4 },
      Medium: { endGameTurn: 6 },
      Large: { endGameTurn: 8 },
    },
    notes: [
      'Sabotage Points (POI) with cover nearby.',
      'Attacker reinforcements and defender reinforcements.',
      'Time pressure end condition.',
    ],
  },
  QAI_14: {
    id: 'QAI_14',
    name: 'Beacon',
    sidesMin: 2,
    sidesMax: 2,
    keys: ['Dominance', 'Courier', 'Sanctuary', 'Elimination', 'Bottled'],
    sizes: {
      Small: { endGameTurn: 4, dominanceWinVp: 3 },
      Medium: { endGameTurn: 6, dominanceWinVp: 4 },
      Large: { endGameTurn: 8, dominanceWinVp: 5 },
    },
    notes: [
      'Beacon zones at center.',
      'Courier designation with sustained VP.',
      'Sanctuary zone scoring.',
    ],
  },
  QAI_15: {
    id: 'QAI_15',
    name: 'Extraction Point',
    sidesMin: 2,
    sidesMax: 2,
    keys: ['Harvest', 'Sanctuary', 'Catalyst', 'Elimination'],
    sizes: {
      Small: { endGameTurn: 4 },
      Medium: { endGameTurn: 6 },
      Large: { endGameTurn: 8 },
    },
    notes: [
      'Intelligence Caches (OM) with hidden starts.',
      'Security level escalation and extraction thresholds.',
    ],
  },
  QAI_16: {
    id: 'QAI_16',
    name: 'Exfil',
    sidesMin: 2,
    sidesMax: 2,
    keys: ['Courier', 'Sanctuary', 'VIP', 'Dominance'],
    sizes: {
      Small: { endGameTurn: 4, sanctuaryWinVp: 3 },
      Medium: { endGameTurn: 6, sanctuaryWinVp: 4 },
      Large: { endGameTurn: 8, sanctuaryWinVp: 5 },
    },
    notes: [
      'VIP extraction zone and VIP abilities.',
      'Catalyst reinforcement timing for defender.',
    ],
  },
  QAI_17: {
    id: 'QAI_17',
    name: 'Triad',
    sidesMin: 3,
    sidesMax: 3,
    keys: ['Dominance', 'Harvest', 'Targeted', 'Sanctuary', 'Bottled'],
    sizes: {
      Small: { endGameTurn: 4, dominanceWinVp: 4 },
      Medium: { endGameTurn: 6, dominanceWinVp: 4 },
      Large: { endGameTurn: 8, dominanceWinVp: 4 },
    },
    notes: [
      'Power Nodes (POI), Neutral Assets, and Commander abilities.',
      'Anti-kingmaking and early elimination bonus.',
    ],
  },
  QAI_18: {
    id: 'QAI_18',
    name: 'Ghost Protocol',
    sidesMin: 2,
    sidesMax: 2,
    keys: ['Courier', 'Elimination', 'Catalyst'],
    sizes: {
      Small: { endGameTurn: 4 },
      Medium: { endGameTurn: 6 },
      Large: { endGameTurn: 8 },
    },
    notes: [
      'Data Core OM, alarm level, lockdown threshold.',
      'Specialist action and decoy outcome.',
    ],
  },
  QAI_19: {
    id: 'QAI_19',
    name: 'Last Stand',
    sidesMin: 2,
    sidesMax: 2,
    keys: ['Dominance', 'Elimination'],
    sizes: {
      Small: { endGameTurn: 4, dominanceWinVp: 3 },
      Medium: { endGameTurn: 6, dominanceWinVp: 4 },
      Large: { endGameTurn: 8, dominanceWinVp: 5 },
    },
    notes: [
      'Sanctum zone, reinforcement lanes, breakthrough markers, Sally Forth.',
    ],
  },
  QAI_20: {
    id: 'QAI_20',
    name: 'Switchback',
    sidesMin: 2,
    sidesMax: 2,
    keys: ['Courier', 'Dominance', 'Elimination'],
    sizes: {
      Small: { endGameTurn: 4, dominanceWinVp: 3 },
      Medium: { endGameTurn: 6, dominanceWinVp: 4 },
      Large: { endGameTurn: 8, dominanceWinVp: 5 },
    },
    notes: [
      'Switch OMs and exit corridor gating.',
      'Wait status visibility boost and reposition action.',
    ],
  },
};

export function getMissionDefinition(id: string): MissionDefinition | null {
  return MISSION_DEFINITIONS[id] ?? null;
}
