// /src/data/missionSchema.js
/**
 * MEST Tactics Mission Definition Schema
 */
export const MISSION_SCHEMA = {
  type: 'object',
  required: ['name', 'sideA', 'sideB', 'objectives', 'victoryConditions'],
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    gameSize: { 
      type: 'string', 
      enum: ['small', 'medium', 'large'] 
    },
    battlefield: { 
      type: 'string',
      pattern: '^\\d+x\\d+$' // e.g., "36x36"
    },
    
    sideA: {
      type: 'object',
      required: ['name', 'bp', 'models', 'deployment', 'ai'],
      properties: {
        name: { type: 'string' },
        bp: { type: 'integer', minimum: 500, maximum: 1000 },
        assembly: { type: 'string' },
        models: { 
          type: 'array', 
          items: { type: 'string' },
          minItems: 4,
          maxItems: 16
        },
        deployment: { 
          type: 'string', 
          enum: ['infiltration', 'standard', 'reinforcements', 'custom'] 
        },
        initialPosition: { 
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' }
          }
        },
        ai: { type: 'boolean' },
        aiProfile: { 
          type: 'string',
          enum: ['aggressive', 'defensive', 'cautious', 'objective-focused']
        }
      }
    },
    
    sideB: {
      type: 'object',
      required: ['name', 'bp', 'models', 'deployment', 'ai'],
      properties: {
        name: { type: 'string' },
        bp: { type: 'integer', minimum: 500, maximum: 1000 },
        assembly: { type: 'string' },
        models: { 
          type: 'array', 
          items: { type: 'string' },
          minItems: 4,
          maxItems: 16
        },
        deployment: { 
          type: 'string', 
          enum: ['infiltration', 'standard', 'reinforcements', 'custom'] 
        },
        initialPosition: { 
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' }
          }
        },
        ai: { type: 'boolean' },
        aiProfile: { 
          type: 'string',
          enum: ['aggressive', 'defensive', 'cautious', 'objective-focused']
        }
      }
    },
    
    terrain: {
      type: 'object',
      properties: {
        preset: { type: 'string' },
        custom: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'x', 'y'],
            properties: {
              type: { 
                type: 'string',
                enum: ['building', 'wall', 'hill', 'tree_single', 'tree_cluster', 'tree_stand', 'debris']
              },
              x: { type: 'number' },
              y: { type: 'number' },
              rotation: { type: 'number' },
              size: { 
                type: 'object',
                properties: {
                  width: { type: 'number' },
                  depth: { type: 'number' }
                }
              },
              plateauRadiusMU: { type: 'number' },
              totalRadiusMU: { type: 'number' }
            }
          }
        }
      }
    },
    
    objectives: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'points'],
        properties: {
          type: { 
            type: 'string',
            enum: ['eliminate', 'control', 'destroy', 'escort', 'survive', 'capture', 'intercept']
          },
          target: { type: 'string' },
          location: { 
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
              radius: { type: 'number' }
            }
          },
          duration: { type: 'integer' },
          points: { type: 'integer', minimum: 1 },
          description: { type: 'string' },
          side: { type: 'string', enum: ['side-a', 'side-b', 'both'] }
        }
      }
    },
    
    victoryConditions: {
      type: 'object',
      required: ['sideA', 'sideB'],
      properties: {
        sideA: {
          type: 'object',
          properties: {
            primary: { 
              type: 'array',
              items: { type: 'string' }
            },
            secondary: { 
              type: 'array',
              items: { type: 'string' }
            },
            minimumPoints: { type: 'integer' }
          }
        },
        sideB: {
          type: 'object',
          properties: {
            primary: { 
              type: 'array',
              items: { type: 'string' }
            },
            secondary: { 
              type: 'array',
              items: { type: 'string' }
            },
            minimumPoints: { type: 'integer' }
          }
        }
      }
    },
    
    specialRules: {
      type: 'object',
      properties: {
        turnLimit: { type: 'integer', minimum: 1, maximum: 20 },
        reinforcementTurns: {
          type: 'array',
          items: { type: 'integer' }
        },
        weather: { 
          type: 'string',
          enum: ['clear', 'fog', 'rain'] 
        },
        timeOfDay: { 
          type: 'string',
          enum: ['dawn', 'day', 'dusk', 'night'] 
        },
        customRules: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  }
};