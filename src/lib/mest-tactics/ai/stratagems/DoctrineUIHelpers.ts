/**
 * Tactical Doctrine UI Helpers
 * 
 * Helpers for displaying and selecting Tactical Doctrines in the game setup UI.
 */

import { TacticalDoctrine, TACTICAL_DOCTRINE_INFO, getDoctrinesByEngagement, calculateStratagemModifiers } from './AIStratagems';

/**
 * UI display option for a Tactical Doctrine
 */
export interface DoctrineUIOption {
  doctrine: TacticalDoctrine;
  name: string;
  description: string;
  icon: string;
  engagement: 'Melee' | 'Ranged' | 'Balanced';
  modifiers: {
    meleePref: string;
    rangePref: string;
    objectiveVal: string;
    riskTol: string;
  };
}

/**
 * Get all doctrines as UI options, grouped by engagement style
 */
export function getDoctrineUIOptions(): Record<string, DoctrineUIOption[]> {
  const groups = getDoctrinesByEngagement();
  const result: Record<string, DoctrineUIOption[]> = {};

  for (const [engagement, doctrines] of Object.entries(groups)) {
    result[engagement] = doctrines.map((doctrine) => {
      const info = TACTICAL_DOCTRINE_INFO[doctrine];
      const modifiers = calculateStratagemModifiers(doctrine);

      return {
        doctrine,
        name: info.name,
        description: info.description,
        icon: info.icon,
        engagement: engagement as 'Melee' | 'Ranged' | 'Balanced',
        modifiers: {
          meleePref: formatModifier(modifiers.meleePreference),
          rangePref: formatModifier(modifiers.rangePreference),
          objectiveVal: formatModifier(modifiers.objectiveValue),
          riskTol: formatModifier(modifiers.riskTolerance),
        },
      };
    });
  }

  return result;
}

/**
 * Get a single doctrine's UI option
 */
export function getDoctrineUIOption(doctrine: TacticalDoctrine): DoctrineUIOption {
  const info = TACTICAL_DOCTRINE_INFO[doctrine];
  const modifiers = calculateStratagemModifiers(doctrine);
  
  // Determine engagement style
  const groups = getDoctrinesByEngagement();
  let engagement: 'Melee' | 'Ranged' | 'Balanced' = 'Balanced';
  if (groups.Melee.includes(doctrine)) engagement = 'Melee';
  else if (groups.Ranged.includes(doctrine)) engagement = 'Ranged';

  return {
    doctrine,
    name: info.name,
    description: info.description,
    icon: info.icon,
    engagement,
    modifiers: {
      meleePref: formatModifier(modifiers.meleePreference),
      rangePref: formatModifier(modifiers.rangePreference),
      objectiveVal: formatModifier(modifiers.objectiveValue),
      riskTol: formatModifier(modifiers.riskTolerance),
    },
  };
}

/**
 * Format modifier value for display
 */
function formatModifier(value: number): string {
  if (value > 1) return `+${Math.round((value - 1) * 100)}%`;
  if (value < 1) return `${Math.round((value - 1) * 100)}%`;
  return '—';
}

/**
 * Compare two doctrines for similarity
 */
export function compareDoctrines(a: TacticalDoctrine, b: TacticalDoctrine): {
  sameEngagement: boolean;
  samePlanning: boolean;
  sameAggression: boolean;
  similarity: number; // 0-1
} {
  const groups = getDoctrinesByEngagement();
  
  const aEngagement = groups.Melee.includes(a) ? 'Melee' : groups.Ranged.includes(a) ? 'Ranged' : 'Balanced';
  const bEngagement = groups.Melee.includes(b) ? 'Melee' : groups.Ranged.includes(b) ? 'Ranged' : 'Balanced';
  
  // For planning and aggression, we'd need to decompose further
  // For now, just compare engagement
  const sameEngagement = aEngagement === bEngagement;
  
  // Calculate similarity based on modifier overlap
  const modifiersA = calculateStratagemModifiers(a);
  const modifiersB = calculateStratagemModifiers(b);
  
  const diff = (
    Math.abs(modifiersA.meleePreference - modifiersB.meleePreference) +
    Math.abs(modifiersA.rangePreference - modifiersB.rangePreference) +
    Math.abs(modifiersA.objectiveValue - modifiersB.objectiveValue) +
    Math.abs(modifiersA.riskTolerance - modifiersB.riskTolerance)
  ) / 4;
  
  const similarity = 1 - diff;
  
  return {
    sameEngagement,
    samePlanning: similarity > 0.8, // Approximate
    sameAggression: similarity > 0.8, // Approximate
    similarity,
  };
}

/**
 * Get recommended doctrines based on playstyle preferences
 */
export function getRecommendedDoctrines(preferences: {
  preferMelee: boolean;
  preferRanged: boolean;
  preferObjectives: boolean;
  preferAggressive: boolean;
  preferDefensive: boolean;
}): TacticalDoctrine[] {
  const recommendations: TacticalDoctrine[] = [];
  const allDoctrines = Object.values(TacticalDoctrine);

  for (const doctrine of allDoctrines) {
    const modifiers = calculateStratagemModifiers(doctrine);
    let score = 0;

    // Score based on preferences
    if (preferences.preferMelee && modifiers.meleePreference > 1) score += 2;
    if (preferences.preferRanged && modifiers.rangePreference > 1) score += 2;
    if (preferences.preferObjectives && modifiers.objectiveValue > 1) score += 2;
    if (preferences.preferAggressive && modifiers.riskTolerance > 1) score += 2;
    if (preferences.preferDefensive && modifiers.survivalValue > 1) score += 2;

    if (score > 0) {
      recommendations.push({ doctrine, score } as any);
    }
  }

  // Sort by score and return top doctrines
  return recommendations
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 3)
    .map((r: any) => r.doctrine);
}
