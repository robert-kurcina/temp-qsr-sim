// Example mission configuration
export const AMBUSH_AT_DAWN = {
  name: "Ambush at Dawn",
  description: "Veteran strike team must eliminate enemy commander",
  gameSize: "medium",
  battlefield: "36x36",
  
  sideA: {
    name: "Strike Team Alpha",
    bp: 750,
    assembly: "veteran-squad",
    models: ["A-1", "A-2", "A-3", "A-4"],
    deployment: "infiltration",
    initialPosition: { x: -15, y: 0 },
    ai: true,
    aiProfile: "objective-focused"
  },
  
  sideB: {
    name: "Militia Defenders", 
    bp: 750,
    assembly: "militia-platoon",
    models: ["B-1", "B-2", "B-3", "B-4", "B-5", "B-6"],
    deployment: "standard",
    initialPosition: { x: 15, y: 0 },
    ai: true,
    aiProfile: "defensive"
  },
  
  terrain: {
    preset: "urban-outpost"
  },
  
  objectives: [
    {
      type: "eliminate",
      target: "B-1",
      points: 10,
      description: "Eliminate enemy commander",
      side: "side-a"
    },
    {
      type: "control", 
      location: { x: 0, y: 0, radius: 3 },
      duration: 2,
      points: 5,
      description: "Secure command building",
      side: "side-a"
    },
    {
      type: "survive",
      turns: 6,
      points: 8,
      description: "Survive 6 turns",
      side: "side-b"
    }
  ],
  
  victoryConditions: {
    sideA: {
      primary: ["eliminate-B-1"],
      secondary: ["control-building"],
      minimumPoints: 8
    },
    sideB: {
      primary: ["survive-turns"],
      secondary: ["eliminate-A-1"],
      minimumPoints: 6
    }
  },
  
  specialRules: {
    turnLimit: 8,
    weather: "clear",
    timeOfDay: "dawn"
  }
};