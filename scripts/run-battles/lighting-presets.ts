/**
 * Lighting Presets for Battle Configuration
 * 
 * Per MEST.Tactics.Advanced-Lighting.txt
 */

export interface LightingPreset {
  name: string;
  visibilityOR: number; // in MU
  description: string;
}

export const LIGHTING_PRESETS: Record<string, LightingPreset> = {
  'Day, Clear': { 
    name: 'Day, Clear', 
    visibilityOR: 16, 
    description: 'Full daylight, clear skies' 
  },
  'Day, Hazy': { 
    name: 'Day, Hazy', 
    visibilityOR: 14, 
    description: 'Daylight with haze or fog' 
  },
  'Day, Overcast': { 
    name: 'Day, Overcast', 
    visibilityOR: 14, 
    description: 'Overcast daylight' 
  },
  'Twilight, Clear': { 
    name: 'Twilight, Clear', 
    visibilityOR: 8, 
    description: 'Dawn or dusk, clear' 
  },
  'Twilight, Overcast': { 
    name: 'Twilight, Overcast', 
    visibilityOR: 6, 
    description: 'Dawn or dusk, overcast' 
  },
  'Night, Full Moon': { 
    name: 'Night, Full Moon', 
    visibilityOR: 4, 
    description: 'Night with full moon' 
  },
  'Night, Half Moon': { 
    name: 'Night, Half Moon', 
    visibilityOR: 2, 
    description: 'Night with half moon' 
  },
  'Night, New Moon': { 
    name: 'Night, New Moon', 
    visibilityOR: 1, 
    description: 'Night with new moon (dark)' 
  },
  'Pitch-black': { 
    name: 'Pitch-black', 
    visibilityOR: 0, 
    description: 'Complete darkness' 
  },
};

/**
 * Get visibility OR for a lighting preset name
 */
export function getVisibilityOrForLighting(presetName: string): number {
  const preset = LIGHTING_PRESETS[presetName];
  return preset?.visibilityOR ?? 16; // Default to Day, Clear
}

/**
 * Get lighting preset by name
 */
export function getLightingPreset(name: string): LightingPreset | undefined {
  return LIGHTING_PRESETS[name];
}
