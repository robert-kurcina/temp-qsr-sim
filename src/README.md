# Example daata

```json
{
  id: "sergeant-alpha",
  identifier: "A-1",
  side: "side-a",
  profile: {
    // Base Veteran stats (Page 39)
    CCA: 3,
    RCA: 3, 
    REF: 3,
    INT: 2,
    POW: 3,
    STR: 2,
    FOR: 2,
    MOV: 2,
    SIZ: 3,
    
    // Grit trait (Page 40)
    traits: ["Grit"],
    
    // Equipment
    weapon: "Sword, Broad",
    armor: {
      suit: "Medium",
      shield: "Medium"
    },
    
    // Calculated BP cost
    bpCost: 61
  }
}
```

example game setup
```json
// Large game setup
const largeGameConfig = {
  gameSize: 'large',
  battlefieldSizeMU: 48,
  bpLimit: 1000,
  modelCount: { min: 8, max: 16 }
};

// Initialize battlefield engine
const battlefieldEngine = new BattlefieldEngine({
  scene: scene,
  battlefieldSizeMU: 48, // 48×48 MU battlefield
  MU_TO_METERS: 0.03175
});
```

ideal written form for a Profile
```json
{ ID }
{ Archetype }
{ CCA }{ RCA }{ REF } | { INT }{ POW }{ STR } | { FOR }{ MOV }{ SIZ }
Humanoid. { BP }
[{ Trait }, .. ]
{ Weapons }
{ Armors }
{ Equipment }
```
```json
A-1
Wise Veteran
3 3 3 | 2 3 2 | 2 2 3
Humanoid. 61 BP
[Grit]. Leadership.
Broad Sword
Medium Armor
Medium Shield
```

## Modes
**headless mode**
```js
// Automated tournament simulation
const simulator = new HeadlessBattleSimulator();
const result = simulator.simulateBattle(missionConfig);
```

**three.js mode**
```js
// AI opponent in human vs AI game
const aiIntegration = new AIIntegration(battlefieldEngine);
await aiIntegration.executeAITurn('side-b');

// AI suggestions for human players
const suggestions = aiIntegration.getAISuggestions('side-a');
```

## Tests Framework
run the tests with
```node src/main.js```

The output should look similar to this:
```txt
⚔️  Spear vs Sword Balance Test
=============================
Testing: Average models with Spear, Medium vs Veteran models with Sword, (Broad)
BP Limit: 350 per side

📋 Test Configuration:
Side A: 4 × Average + Spear, Medium + Shield, Medium
  Cost per model: 30 + 30 + 10 = 80 BP
  Total BP used: 320 BP

Side B: 3 × Veteran + Sword, (Broad) + Shield, Medium  
  Cost per model: 61 + 17 + 10 = 88 BP
  Total BP used: 264 BP

🚀 Running Balance Test: Spear vs Sword (350 BP)
Iterations: 100
Progress: 20.0% | ETA: 45s
...

📊 Spear vs Sword (350 BP) Results:
   Iterations: 100
   Win Rates - Side A: 42.0%, Side B: 53.0%
   Draw Rate: 5.0%
   Average Turns: 6.2
   Survival Rates - Side A: 68.5%, Side B: 72.3%
   BP Efficiency - Side A: 1.20e-3, Side B: 1.51e-3
   Balance Assessment: slightly_imbalanced
   Recommendations:
     • Side B appears slightly overpowered
     • Consider if Veteran + Sword combination is properly balanced for BP cost
```

## Optimized Headless Simulator
executes AI-driven analysis of various test configurations more efficiently.

- `200 iterations`: ~4-6 seconds on modern hardware
- `Memory usage`: < 50MB
- `Statistical confidence`: ±7% margin of error at 95% confidence


| Optimization      | Gain |
| ----------- | ----------- |
| Flat arrays instead of objects | ~30% faster model access |
| Combat result caching | ~40% reduction in combat calculations |
| Early termination logic | ~25% fewer turns simulated |
| Parallel processing | ~3-4x faster total execution |
| Simplified tactical AI | ~50% faster decision making |
| No logging overhead | ~15% faster execution |

