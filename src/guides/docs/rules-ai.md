---
title: "Rules: AI System"
description: Artificial Intelligence system for autonomous model control
status: "Complete"
---

# AI System

## Overview

The MEST Tactics AI system provides autonomous control for models during gameplay. The AI operates on a **per-Player basis**, meaning each human or AI player controls their own models. Multiple players can exist on the same Side, and each player's models are controlled independently by their assigned AI.

### Player vs. Side Distinction

| Concept | Description |
|---------|-------------|
| **Side** | A faction in the game (e.g., "Alpha", "Bravo"). Multiple players can belong to the same Side. |
| **Player** | An individual controller (human or AI). Each player controls their own Assembly of models. |
| **AI Controller** | Assigned per Player, not per Side. Each AI player has independent decision-making. |

This architecture allows for:
- **Cooperative AI**: Multiple AI players on the same Side working together
- **Mixed Games**: Human and AI players on the same Side
- **Free-for-All**: Each player (AI or human) on their own Side

---

## AI Architecture

The AI system uses a **hybrid hierarchical architecture** combining multiple AI paradigms:

```
┌─────────────────────────────────────────────────────────┐
│                    Strategic Layer                       │
│                     (SideAI.ts)                          │
│  • Mission evaluation & victory tracking                 │
│  • Resource allocation across assemblies                 │
│  • Strategic posture assessment                          │
│  • Priority target identification                        │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    Tactical Layer                        │
│                   (AssemblyAI.ts)                        │
│  • Squad coordination & formation management             │
│  • Focus fire coordination                               │
│  • Character role assignment                             │
│  • Flanking opportunity identification                   │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  Character Layer                         │
│                   (CharacterAI.ts)                       │
│  • Individual decision making                            │
│  • Action selection & execution                          │
│  • React handling                                        │
│  • Tactical pattern recognition                          │
└─────────────────────────────────────────────────────────┘
```

---

## AI Components

### 1. Behavior Trees

**Purpose:** Flexible decision-making with fallback behaviors

**Node Types:**
- **Selector** — Try children in order until one succeeds
- **Sequence** — Execute all children in order
- **Parallel** — Execute multiple children simultaneously
- **Decorator** — Modify child behavior (invert, repeat, etc.)
- **Condition** — Check game state conditions
- **Action** — Execute game actions

**Usage:** High-level decision flow (e.g., "Should I attack or retreat?")

### 2. Hierarchical Finite State Machine (HFSM)

**Purpose:** Structured action execution with clear state transitions

**States:**
- **Idle** — No current action
- **Moving** — Navigating to position
- **Combat** — Engaging in combat (substates: Ranged, Melee)
- **Support** — Rally, revive, etc.
- **Waiting** — Holding position

**Hierarchy:**
```
CombatState
├── RangedAttackState
├── MeleeAttackState
└── ChargeState

SupportState
├── RallyState
├── ReviveState
└── HideState
```

**Usage:** Action execution and state management

### 3. Goal-Oriented Action Planning (GOAP)

**Purpose:** Multi-turn planning to achieve complex goals

**Goals:**
- **Survive** — Stay alive (highest priority)
- **Eliminate** — Destroy enemy models
- **Protect** — Defend VIPs or objectives
- **Disengage** — Break from combat
- **Rally** — Remove Fear tokens
- **Revive** — Revive KO'd allies
- **Reach** — Move to objective/position

**Actions:** (preconditions → effects)
- **Move** — { canMove: true } → { atPosition: true }
- **RangedAttack** — { hasRangedWeapon, inRange, hasLOS } → { targetDamaged: true }
- **CloseCombat** — { engaged, hasMeleeWeapon } → { targetDamaged: true }
- **Disengage** — { engaged } → { engaged: false }
- **Rally** — { hasAllyWithFear } → { allyFearReduced: true }
- **Revive** — { hasAllyKOd, adjacent } → { allyRevived: true }

**Planning:** Backward chaining from goal to current state

**Depth:** Configurable (default 5 actions)

**Usage:** Complex multi-action sequences (e.g., "Move into position, then shoot")

### 4. Utility Scoring

**Purpose:** Continuous action evaluation and selection

**Scoring Factors:**
- **Target Health** — Prefer wounded targets
- **Target Threat** — Prefer high-threat enemies
- **Distance to Target** — Prefer closer targets
- **Visibility** — Prefer visible targets
- **Mission Priority** — Prefer targets near objectives

**Position Scoring:**
- **Cover** — Value of cover at position
- **Distance to Target** — Optimal engagement range
- **Visibility** — Lines of sight from position
- **Cohesion** — Distance to allies

**Usage:** Fine-grained action and position selection

### 5. Tactical Patterns

**Purpose:** Recognize and apply battlefield patterns

**Patterns:**
- **Flanking** — Attack from multiple angles
- **Focus Fire** — Concentrate fire on single target
- **Defensive Formation** — Group for mutual support
- **Objective Assault** — Coordinated objective capture
- **Retreat/Regroup** — Organized withdrawal

**Recognition:** Pattern matching against current battlefield state

**Application:** Execute pattern-specific action sequences

**Usage:** Coordinated squad-level tactics

---

## Tactical Doctrine (Stratagems)

**Tactical Doctrine** encompasses the player's strategic choices for AI behavior. Players select one option from each of three orthogonal axes, creating **27 unique combinations**.

### Three Axes

| Axis | Options | Description |
|------|---------|-------------|
| **Engagement** | Melee-Centric, Ranged-Centric, Balanced | How to engage enemies |
| **Planning** | Keys to Victory, Aggression, Balanced | What to prioritize |
| **Aggression** | Defensive, Balanced, Aggressive | How hard to push |

### All 27 Combinations

#### Melee-Centric Combinations

| Name | Engagement | Planning | Aggression | Description |
|------|------------|----------|------------|-------------|
| **Juggernaut** | Melee | Aggression | Aggressive | Relentless melee assault |
| **Bulwark** | Melee | Keys to Victory | Defensive | Hold ground, melee defense |
| **Crusader** | Melee | Keys to Victory | Balanced | Objective-focused melee |
| **Berserker** | Melee | Aggression | Balanced | Pure melee destruction |
| **Guardian** | Melee | Keys to Victory | Defensive | Defensive melee protector |
| **Raider** | Melee | Aggression | Balanced | Fast melee strikes |

#### Ranged-Centric Combinations

| Name | Engagement | Planning | Aggression | Description |
|------|------------|----------|------------|-------------|
| **Archer** | Ranged | Keys to Victory | Defensive | Safe ranged support |
| **Sniper** | Ranged | Balanced | Defensive | Precision from distance |
| **Bombard** | Ranged | Aggression | Aggressive | Overwhelming firepower |
| **Gunner** | Ranged | Balanced | Balanced | Consistent ranged fire |
| **Hunter** | Ranged | Aggression | Balanced | Mobile ranged hunter |
| **Sentinel** | Ranged | Keys to Victory | Defensive | Area denial from range |

#### Balanced Combinations

| Name | Engagement | Planning | Aggression | Description |
|------|------------|----------|------------|-------------|
| **Tactician** | Balanced | Keys to Victory | Balanced | Adaptive objective play |
| **Soldier** | Balanced | Balanced | Balanced | Standard infantry tactics |
| **Veteran** | Balanced | Aggression | Balanced | Experienced flexible fighter |
| **Commander** | Balanced | Keys to Victory | Defensive | Strategic defensive play |
| **Assault** | Balanced | Aggression | Aggressive | Aggressive combined arms |
| **Scout** | Balanced | Balanced | Defensive | Cautious reconnaissance |

### Stratagem Effects

Each combination produces unique modifier values:

```typescript
interface StratagemModifiers {
  // Combat preferences
  meleePreference: number;      // >1 favors melee
  rangePreference: number;       // >1 favors ranged
  optimalRangeMod: number;       // Engagement range modifier
  
  // Target priority
  objectiveValue: number;        // Value of objectives
  eliminationValue: number;      // Value of kills
  
  // Risk tolerance
  riskTolerance: number;         // >1 takes more risks
  survivalValue: number;         // Value of survival
  pushAdvantage: boolean;        // Press advantages
  
  // Action scoring
  chargeBonus: number;           // Bonus to charges
  retreatThreshold: number;      // When to retreat
  concentratePreference: number; // Prefer Concentrate action
}
```

### Implementation

```typescript
import { TacticalDoctrine } from './ai/stratagems';

// Select doctrine
const doctrine = TacticalDoctrine.Juggernaut;

// Apply to AI
aiController.setTacticalDoctrine(doctrine);

// Doctrine automatically applies modifiers to:
// - Action selection scores
// - Target priority scores
// - Position evaluation scores
// - Retreat/charge decisions
```

---

## Pathfinding

### Grid-Based A* Pathfinding

**Implementation:** `Grid.ts`, `PathfindingEngine.ts`

**Features:**
- Grid-based navigation (1 MU resolution)
- A* algorithm with heuristic optimization
- Terrain cost consideration
- Dynamic obstacle avoidance
- Model collision avoidance

### Terrain Costs

| Terrain | Movement Cost | Notes |
|---------|---------------|-------|
| **Clear** | 1× | Normal movement |
| **Rough** | 2× | Difficult terrain |
| **Difficult** | 2× | Very difficult |
| **Impassable** | ∞ | Cannot traverse |

### Integration

```typescript
const path = pathfindingEngine.findPath(startPos, endPos, {
  avoidEnemies: true,
  preferCover: true,
  maxDistance: mov * 2,
});
```

---

## Action Prioritization

### Priority Hierarchy

1. **Survival Actions** (highest priority)
   - Disengage when overwhelmed
   - Retreat when heavily wounded
   - Take cover when under fire

2. **Mission Actions**
   - Capture objectives
   - Defend VIPs
   - Complete mission-specific tasks

3. **Combat Actions**
   - Eliminate high-priority targets
   - Support allies
   - Gain advantageous positions

4. **Support Actions** (lowest priority)
   - Rally frightened allies
   - Revive KO'd models
   - Reload weapons

### Utility Scoring Integration

Actions are scored using weighted factors:

```typescript
score = 
  threatFactor * threatWeight +
  healthFactor * healthWeight +
  distanceFactor * distanceWeight +
  objectiveFactor * objectiveWeight +
  coverFactor * coverWeight;
```

Weights are modified by Tactical Doctrine.

---

## React System

### React Types

| React | Trigger | Cost | Source |
|-------|---------|------|--------|
| **Overwatch** | Enemy moves in LOS | Wait status | Wait action |
| **Opportunity Attack** | Engaged enemy acts | 1 AP | Trait or default |
| **Counter-strike!** | Enemy misses CC attack | 1 AP | Counter-strike! trait |

### React Priority

1. **Multiple Reacts** — Player chooses order
2. **Resolution** — Each react fully resolves before continuing
3. **Counter** — If react KO's attacker, original action is cancelled

### AI React Handling

```typescript
// CharacterAI evaluates react opportunities
const reactOptions = evaluateReactOptions(character, trigger);

// Select best react based on utility scoring
const bestReact = selectBestReact(reactOptions, modifiers);

// Execute react
executeReact(bestReact);
```

---

## Mission AI

### Mission-Specific Behavior

Each mission type has specialized AI behavior:

| Mission | AI Focus |
|---------|----------|
| **Elimination** | Focus fire, eliminate all enemies |
| **Convergence** | Zone control, reinforcement timing |
| **Assault** | Marker assault/harvest decisions |
| **Dominion** | Zone defense and capture |
| **Recovery** | VIP extraction, guard roles |
| **Escort** | VIP protection/assassination |
| **Triumvirate** | 3-zone control, instant win rush |
| **Stealth** | Hidden VIP extraction, detection avoidance |
| **Defiance** | VIP perimeter defense |
| **Breach** | Switch turn preparation |

### Implementation

```typescript
import { MissionAI } from './ai/mission/MissionAI';

// Mission AI overrides base behavior
class EliminationAI extends MissionAI {
  evaluateTargets(context) {
    // Prioritize wounded targets for elimination
    return super.evaluateTargets(context).map(target => ({
      ...target,
      score: target.score * (target.isWounded ? 1.5 : 1.0),
    }));
  }
}
```

---

## Configuration

### AI Controller Configuration

```typescript
interface CharacterAIConfig {
  // Personality traits
  aggression: number;    // 0-1, default 0.5
  caution: number;       // 0-1, default 0.5
  accuracy: number;      // 0-1, default 0.5
  
  // Tactical Doctrine
  tacticalDoctrine: TacticalDoctrine;
  
  // Feature flags
  enableGOAP: boolean;      // Enable GOAP planning
  enablePatterns: boolean;  // Enable tactical patterns
  enableReacts: boolean;    // Enable react handling
  enablePathfinding: boolean; // Enable pathfinding
  
  // Difficulty settings
  difficulty: 'easy' | 'medium' | 'hard';
}
```

### Difficulty Settings

| Difficulty | Aggression | Caution | GOAP Depth | React Speed |
|------------|------------|---------|------------|-------------|
| **Easy** | 0.3 | 0.7 | 3 | Slow |
| **Medium** | 0.5 | 0.5 | 5 | Normal |
| **Hard** | 0.7 | 0.3 | 7 | Fast |

---

## Performance

### Optimization Strategies

1. **Spatial Partitioning** — Only evaluate nearby models
2. **Caching** — Cache LOS, path, and utility calculations
3. **Lazy Evaluation** — Only calculate when needed
4. **Priority Culling** — Skip low-priority evaluations
5. **Batch Processing** — Process multiple models together

### Benchmarks

| Game Size | Models | Turn Time | Memory |
|-----------|--------|-----------|--------|
| **Very Small** | 4-8 | <10ms | ~5MB |
| **Small** | 8-16 | <25ms | ~10MB |
| **Medium** | 12-24 | <50ms | ~20MB |
| **Large** | 16-32 | <100ms | ~40MB |
| **Very Large** | 32-64 | <250ms | ~80MB |

---

## Planned Features

### Phase 1: Core AI (Complete ✅)
- [x] Behavior Tree implementation
- [x] HFSM implementation
- [x] GOAP implementation
- [x] Utility Scorer
- [x] Tactical Patterns
- [x] Pathfinding
- [x] React handling

### Phase 2: Strategic Layer (Complete ✅)
- [x] SideAI implementation
- [x] AssemblyAI implementation
- [x] Mission AI specialization
- [x] Target prioritization
- [x] Resource allocation

### Phase 3: Tactical Doctrine (Complete ✅)
- [x] Stratagem system
- [x] 27 doctrine combinations
- [x] Modifier integration
- [x] UI selection helpers

### Phase 4: Advanced Features (Planned)
- [ ] Machine Learning from player behavior
- [ ] Dynamic difficulty adjustment
- [ ] Personality profiles (beyond aggression/caution)
- [ ] Team coordination (multi-player AI on same Side)
- [ ] Spectator mode AI commentary
- [ ] Replay analysis and learning

### Phase 5: Optimization (Planned)
- [ ] Multi-threaded evaluation
- [ ] GPU-accelerated pathfinding
- [ ] Predictive caching
- [ ] LOD for AI evaluation (distant models = simpler AI)

---

## Files

| File | Purpose |
|------|---------|
| `ai/core/CharacterAI.ts` | Individual character AI |
| `ai/core/AIController.ts` | Base AI controller |
| `ai/core/BehaviorTree.ts` | Behavior tree implementation |
| `ai/core/HierarchicalFSM.ts` | HFSM implementation |
| `ai/core/GOAP.ts` | Goal-oriented action planning |
| `ai/core/UtilityScorer.ts` | Utility scoring system |
| `ai/core/KnowledgeBase.ts` | Game state knowledge |
| `ai/strategic/SideAI.ts` | Strategic layer (Side-level) |
| `ai/strategic/AssemblyAI.ts` | Tactical layer (Assembly-level) |
| `ai/tactical/TacticalPatterns.ts` | Pattern recognition |
| `ai/tactical/ReactsAndBonusActions.ts` | React handling |
| `ai/executor/AIActionExecutor.ts` | Action execution |
| `ai/executor/AIGameLoop.ts` | Full AI game loop |
| `ai/stratagems/AIStratagems.ts` | Stratagem definitions |
| `ai/stratagems/StratagemIntegration.ts` | Stratagem integration |
| `battlefield/pathfinding/Grid.ts` | Grid-based pathfinding |
| `battlefield/pathfinding/PathfindingEngine.ts` | Pathfinding engine |

---

## References

- QSR "Initiative" section — AI activation order
- QSR "Actions" section — AI action selection
- QSR "Reacts" section — AI react handling
- QSR "Missions" section — Mission AI behavior
