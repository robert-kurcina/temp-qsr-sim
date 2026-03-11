import type { AIContext } from './AIController';

export interface MissionBias {
  movePressure: number;
  waitPressure: number;
  objectiveActionPressure: number;
  attackPressure: number;
  centerTargetBias: number;
  vipTargetBias: number;
}

export type DoctrinePlanning = 'aggression' | 'keys_to_victory' | 'balanced';
export type DoctrineEngagement = 'melee' | 'ranged' | 'balanced';

export function getDoctrinePlanning(context: AIContext): DoctrinePlanning {
  return context.config.doctrinePlanning ?? 'balanced';
}

export function getDoctrineEngagement(
  context: AIContext,
  loadout: { hasMeleeWeapons: boolean; hasRangedWeapons: boolean }
): DoctrineEngagement {
  if (context.config.doctrineEngagement) {
    return context.config.doctrineEngagement;
  }
  if (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons) return 'melee';
  if (loadout.hasRangedWeapons && !loadout.hasMeleeWeapons) return 'ranged';
  return 'balanced';
}

export function getMissionBias(context: AIContext): MissionBias {
  const missionId = context.config.missionId ?? 'QAI_11';
  const planning = getDoctrinePlanning(context);

  const base: MissionBias = (() => {
    switch (missionId) {
      case 'QAI_12':
        return {
          movePressure: 0.55,
          waitPressure: 0.15,
          objectiveActionPressure: 0.6,
          attackPressure: 0.95,
          centerTargetBias: 0.45,
          vipTargetBias: 0,
        };
      case 'QAI_13':
        return {
          movePressure: 0.75,
          waitPressure: 0.2,
          objectiveActionPressure: 0.8,
          attackPressure: 0.9,
          centerTargetBias: 0.3,
          vipTargetBias: 0,
        };
      case 'QAI_14':
        return {
          movePressure: 0.45,
          waitPressure: 0.5,
          objectiveActionPressure: 0.65,
          attackPressure: 0.95,
          centerTargetBias: 0.55,
          vipTargetBias: 0,
        };
      case 'QAI_15':
        return {
          movePressure: 0.7,
          waitPressure: 0.45,
          objectiveActionPressure: 0.85,
          attackPressure: 0.88,
          centerTargetBias: 0.2,
          vipTargetBias: 0.6,
        };
      case 'QAI_16':
        return {
          movePressure: 0.8,
          waitPressure: 0.35,
          objectiveActionPressure: 0.9,
          attackPressure: 0.86,
          centerTargetBias: 0.2,
          vipTargetBias: 0.7,
        };
      case 'QAI_17':
        return {
          movePressure: 0.6,
          waitPressure: 0.2,
          objectiveActionPressure: 0.75,
          attackPressure: 0.94,
          centerTargetBias: 0.5,
          vipTargetBias: 0,
        };
      case 'QAI_18':
        return {
          movePressure: 0.68,
          waitPressure: 0.48,
          objectiveActionPressure: 0.82,
          attackPressure: 0.9,
          centerTargetBias: 0.3,
          vipTargetBias: 0.55,
        };
      case 'QAI_19':
        return {
          movePressure: 0.58,
          waitPressure: 0.55,
          objectiveActionPressure: 0.72,
          attackPressure: 0.92,
          centerTargetBias: 0.45,
          vipTargetBias: 0.55,
        };
      case 'QAI_20':
        return {
          movePressure: 0.78,
          waitPressure: 0.25,
          objectiveActionPressure: 0.85,
          attackPressure: 0.9,
          centerTargetBias: 0.42,
          vipTargetBias: 0,
        };
      case 'QAI_11':
      default:
        return {
          movePressure: 0.15,
          waitPressure: 0.1,
          objectiveActionPressure: 0.1,
          attackPressure: 1.08,
          centerTargetBias: 0,
          vipTargetBias: 0,
        };
    }
  })();

  if (planning === 'keys_to_victory') {
    return {
      ...base,
      movePressure: base.movePressure + 0.2,
      waitPressure: base.waitPressure + 0.15,
      objectiveActionPressure: base.objectiveActionPressure + 0.25,
      attackPressure: base.attackPressure * 0.94,
    };
  }
  if (planning === 'aggression') {
    return {
      ...base,
      movePressure: base.movePressure + 0.08,
      waitPressure: Math.max(0, base.waitPressure - 0.18),
      objectiveActionPressure: Math.max(0, base.objectiveActionPressure - 0.2),
      attackPressure: base.attackPressure * 1.08,
    };
  }
  return base;
}
