// /src/config/AIConfiguration.js
export const AI_CONFIG = {
  // Character behavior profiles
  characterProfiles: {
    aggressive: { enabled: true },
    melee: { enabled: true },
    ranged: { enabled: true },
    moveFirst: { enabled: true },
    healer: { enabled: true },
    counterStrike: { enabled: true },
    waitMode: { enabled: true },
    balanced: { enabled: true }
  },
  
  // Player strategems
  playerStrategems: {
    outnumber: { enabled: true },
    opportune: { enabled: true },
    rush: { enabled: true },
    defensive: { enabled: true },
    flanking: { enabled: true },
    preserve: { enabled: true }
  },
  
  // AI difficulty settings
  difficulty: {
    easy: {
      reactionTime: 2000, // ms
      tacticalDepth: 1,   // Simple decisions
      coordination: 0.5   // Limited coordination
    },
    medium: {
      reactionTime: 1000,
      tacticalDepth: 2,
      coordination: 0.8
    },
    hard: {
      reactionTime: 500,
      tacticalDepth: 3,
      coordination: 1.0
    }
  },
  
  // Environment-specific settings
  environments: {
    headless: {
      logging: true,
      visualization: false
    },
    threejs: {
      logging: false,
      visualization: true,
      animationSpeed: 300
    }
  }
};