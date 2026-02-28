---
title: "Rules: Overrides"
description: "Temporary rules overrides that supersede legacy source instructions in docs/*.txt."
status: "Active"
---

## Purpose

This file is the authoritative list of **approved rules overrides**.

When an override here conflicts with `docs/*.txt`, this file takes precedence until the source text is updated.

## Override Precedence

Use this precedence order when implementing or validating rules:

1. `src/guides/docs/rules-overrides.md` (highest priority)
2. `src/guides/docs/rules*.md`
3. `docs/*.txt` (legacy source instructions)

---

## OVR-001: Wait Action (Revised)

Status: **Active**

### Acquisition

- Cost: **2 AP**
- Requirement: character must be **not Outnumbered** when acquiring Wait
- Effect: gain **Wait** status and marker

### Start Of Next Initiative

- Wait upkeep is resolved at the start of the character's next Initiative, after AP is set and Delay upkeep is paid.
- If character is **Free**, Wait is maintained at **0 AP**.
- If character is **not Free**, the character may pay **1 AP** to maintain Wait.
- If the character cannot pay, or does not pay, Wait is removed.

### Delay Interaction

- Delay tokens are paid first at **1 AP per token**.
- Remaining AP (if any) is then used for Wait upkeep when not Free.

### React Utility

- While in Wait, character may remove Wait to perform **React**, including while in **Done** status
- While in Wait, effective Visibility OR is doubled for React/Wait sensing windows

### Hidden-Reveal Utility

- While in Wait, hidden opposing models that are:
  - in LOS,
  - not in Cover,
  - and inside current Wait visibility window
  are immediately revealed

---

## OVR-002: Game Size Configurations

Status: **Active**

### Purpose

This override defines the complete Game Size configurations for MEST Tactics, including the extended VERY_SMALL and VERY_LARGE sizes used for testing and simulation.

### Game Size Table

| Game Size | Models per Side | BP per Side | End-Game Trigger | Battlefield Size | Use Case |
|-----------|-----------------|-------------|------------------|------------------|----------|
| **VERY_SMALL** | 2-4 | 125-250 | Turn 3 | 24"×24" | Quick tests, skirmishes, tutorials |
| **SMALL** | 4-8 | 250-500 | Turn 4 | 36"×36" | Standard QSR games, learning games |
| **MEDIUM** | 6-12 | 500-750 | Turn 6 | 48"×48" | Standard competitive games |
| **LARGE** | 8-16 | 750-1000 | Turn 8 | 60"×60" | Extended battles, campaigns |
| **VERY_LARGE** | 16-24 | 1000-1250 | Turn 10 | 72"×72" | Epic battles, AI validation, stress tests |

### End-Game Trigger Rules

Per QSR Line 744-750:

> "Use the Game Size per the total BP and adjust one row toward the total Models used to determine after which Turn the End-game Triggers are to be placed."

**Implementation:**
- At the end of each turn starting from the End-Game Trigger turn, roll 1d6
- On a result of **1-3** (a "miss"), the game ends immediately
- Each turn after the trigger turn, add **1 additional die** (cumulative)
- Example: Turn 4 = 1d6, Turn 5 = 2d6, Turn 6 = 3d6, etc.

**Probability by Turn:**
| Turn | Dice | P(Game Ends) | P(Game Continues) |
|------|------|--------------|-------------------|
| Trigger | 1d6 | 50% | 50% |
| Trigger+1 | 2d6 | 75% | 25% |
| Trigger+2 | 3d6 | 87.5% | 12.5% |
| Trigger+3 | 4d6 | 93.75% | 6.25% |

### VERY_SMALL Configuration

**Purpose:** Quick testing, tutorials, and skirmish-scale games

**Assembly Building:**
- BP Limit: 125-250 BP
- Model Count: 2-4 models
- Typical Profile: Average (30 BP) with 30-50 BP equipment = 60-80 BP per model
- Example: 4 models × 65 BP = 260 BP (slightly over, acceptable)

**Battlefield:**
- Size: 24"×24" (minimum playable area)
- Terrain: 2-4 elements (10-15% density)
- Deployment: 3" from edges, 6" separation

**End-Game:**
- Trigger Turn: **3**
- Expected Battle Length: 3-5 turns
- Typical Duration: 15-30 minutes

**Recommended For:**
- Rules testing and validation
- New player tutorials
- Quick skirmish games
- AI behavior testing

### VERY_LARGE Configuration

**Purpose:** Epic battles, AI validation, and stress testing

**Assembly Building:**
- BP Limit: 1000-1250 BP
- Model Count: 16-24 models
- Typical Profile: Mix of Elite (129 BP), Veteran (61 BP), Average (30 BP)
- Example: 8 Elite (1032 BP) + 4 Veteran (244 BP) = 1276 BP

**Battlefield:**
- Size: 72"×72" (large play area required)
- Terrain: 20-30 elements (15-20% density)
- Deployment: 6" from edges, 12" separation

**End-Game:**
- Trigger Turn: **10**
- Expected Battle Length: 10-14 turns
- Typical Duration: 2-4 hours

**Recommended For:**
- AI System validation (stress testing)
- Campaign finale battles
- Large-scale scenario testing
- Performance benchmarking

### QSR Default

For Quick Start Rules (QSR) games, the default Game Size is **SMALL**:
- 4-8 models per side
- 250-500 BP per side
- Turn 4 End-Game Trigger
- 36"×36" battlefield

### Implementation Notes

**In Code:**
```typescript
import { GameSize } from './mission/assembly-builder';
import { getEndGameTriggerTurn } from './engine/end-game-trigger';

const gameSize = GameSize.VERY_SMALL;
const triggerTurn = getEndGameTriggerTurn(gameSize);  // Returns 3

// Game size defaults
const defaults = {
  [GameSize.VERY_SMALL]: { bpLimitMin: 125, bpLimitMax: 250, models: 2-4 },
  [GameSize.SMALL]: { bpLimitMin: 250, bpLimitMax: 500, models: 4-8 },
  [GameSize.MEDIUM]: { bpLimitMin: 500, bpLimitMax: 750, models: 6-12 },
  [GameSize.LARGE]: { bpLimitMin: 750, bpLimitMax: 1000, models: 8-16 },
  [GameSize.VERY_LARGE]: { bpLimitMin: 1000, bpLimitMax: 1250, models: 16-24 },
};
```

**Source Reference:**
- QSR Line 744-750: End-Game Trigger table
- QSR Line 63-65: Game Size definitions
- `src/lib/mest-tactics/engine/end-game-trigger.ts`: Implementation
- `src/lib/mest-tactics/mission/assembly-builder.ts`: Game size defaults

---

## OVR-003: Terrain Height Data (2D Placeholder)

Status: **Active** (Temporary until 3D implementation)

### Purpose

This override defines **2D height data** for terrain elements as a placeholder until full 3D terrain implementation is complete.

These heights are used for:
- Climbing requirements (Hands, Agility tests)
- Jump down restrictions
- Line of Sight blocking
- Falling damage calculations
- Movement restrictions

### Terrain Height Table

| Terrain Type | Height (MU) | Large Variant Height | Enterable? | Stand Atop? | Jump Down? | Notes |
|--------------|-------------|---------------------|------------|-------------|------------|-------|
| **Wall** | 1.0 | 1.5 | ✅ (Climb) | ✅ | ✅ | Requires [2H] to climb up, [1H] down. Clear movement atop. |
| **Building** | 3.0 | 4.0 | ❌ | ❌ | ❌ | Blocking terrain. Cannot enter or climb (3D required). |
| **Tree** | 6.0 | N/A | ❌ | ❌ | ❌ | Blocking terrain. Models cannot enter Tree terrain. |
| **Shrub** | 0.5 | N/A | ✅ | ✅ | ❌ | Models can stand atop. Can only move down (no jump). |
| **Rocky** | 0.5 | N/A | ✅ | ✅ | ❌ | Models can stand atop. Climb without Hands. No jump down/across. |

### Movement Rules by Terrain

#### Walls (1.0 MU / 1.5 MU Large)

**Climbing Requirements:**
- **Up:** Requires [2H] commitment (both hands free)
- **Down:** Requires [1H] commitment (one hand free)
- **Agility Cost:** Uses Agility rating for climb distance
- **Test Required:** Difficult climbs may require Unopposed Agility Test

**Atop Wall Movement:**
- Movement treated as **Clear** terrain
- No additional Agility cost
- Can jump down from wall (standard falling rules apply)

**QSR Reference:** Lines 955-960 (Climbing)

#### Buildings (3.0 MU / 4.0 MU Large)

**Restrictions:**
- **Cannot enter** (interior navigation requires 3D implementation)
- **Cannot climb** (too tall for current mechanics)
- **Blocking terrain** for LOS and movement

**Future Implementation (3D):**
- Interior navigation with rooms, corridors
- Staircases, ladders, elevators
- Windows for LOS/LOF
- Rooftop access and movement

#### Trees (6.0 MU)

**Restrictions:**
- **Cannot enter** (dense foliage blocking movement)
- **Cannot climb** (requires advanced climbing rules)
- **Blocking terrain** for LOS and movement

**Future Implementation:**
- Climb rules for trees (Agility test, [1H] or [2H])
- Canopy movement (if large enough)
- Falling from trees (special rules)

#### Shrubs (0.5 MU)

**Movement:**
- **Can enter** normally (treated as Rough terrain)
- **Can stand atop** (0.5 MU elevation gain)
- **Cannot jump down** (too low for jump, must move down)

**Moving Down from Shrub:**
- No Agility test required
- No Falling Test required (height < 1 MU)
- Treated as normal movement (1 AP)

#### Rocky (0.5 MU)

**Movement:**
- **Can enter** normally (treated as Rough terrain)
- **Can stand atop** (0.5 MU elevation gain)
- **Can climb** without Hands (natural scrambling)
- **Cannot jump down** (must move down normally)
- **Cannot jump across** from Rocky terrain

**Climbing Requirements:**
- **No Hands required** (natural handholds)
- **Agility Cost:** Uses Agility rating
- **Test Required:** Only for difficult rock faces

**Moving Down from Rocky:**
- No Agility test required
- No Falling Test required (height < 1 MU)
- Treated as normal movement (1 AP)

### Jump Down Rules

**General Rule:**
- **Minimum Height for Jump:** 1.0 MU
- **Below 1.0 MU:** Must move down normally (no jump)
- **1.0 MU or higher:** Can jump down (standard falling rules apply)

**Falling Test:**
- **Trigger:** Fall distance > Agility
- **DR:** SIZ + (MU beyond Agility ÷ 4), rounded
- **Effect:** Failed test = misses as Delay tokens (Stun damage)
- **Wound:** Added if fall >= Agility - 0.5 MU

**Falling Collision:**
- **Falling Model:** May ignore ONE miss on Falling Test
- **Target Models:** Must perform Falling Test using same DR
- **Strategy:** Jump down onto enemies to cause Collision effects

### Implementation Notes

**In Code (Temporary 2D):**
```typescript
// TerrainElement.ts - Temporary 2D height data
interface TerrainElement {
  type: 'wall' | 'building' | 'tree' | 'shrub' | 'rocky' | 'clear' | 'rough';
  height: number;  // MU (2D placeholder)
  isLarge: boolean;
  isBlocking: boolean;
  isEnterable: boolean;
  canStandAtop: boolean;
  canJumpDown: boolean;
  climbHandsRequired?: '1H' | '2H' | 'none';
}

// Height lookup table
const TERRAIN_HEIGHTS = {
  wall: { normal: 1.0, large: 1.5, climb: '2H' },
  building: { normal: 3.0, large: 4.0, enterable: false },
  tree: { normal: 6.0, enterable: false },
  shrub: { normal: 0.5, standAtop: true, jumpDown: false },
  rocky: { normal: 0.5, standAtop: true, climb: 'none', jumpDown: false },
};

// Jump down validation
function canJumpDown(terrain: TerrainElement): boolean {
  if (!terrain.canStandAtop) return false;
  if (!terrain.canJumpDown) return false;
  return terrain.height >= 1.0;  // Minimum height for jump
}

// Climb hand requirements
function getClimbHandRequirement(terrain: TerrainElement, goingUp: boolean): number {
  if (!terrain.climbHandsRequired) return 0;
  if (goingUp && terrain.climbHandsRequired === '2H') return 2;
  if (!goingUp && terrain.climbHandsRequired === '1H') return 1;
  if (terrain.climbHandsRequired === 'none') return 0;
  return goingUp ? 2 : 1;
}
```

**Future Implementation (3D):**
- Full 3D mesh collision detection
- Interior building navigation
- Multi-level terrain (bridges, balconies, towers)
- Vertical combat (ranged attacks between levels)
- Elevation-based LOS/LOF (high ground bonus)

### QSR Compliance

**Implemented:**
- ✅ Climbing hand requirements ([2H] up, [1H] down)
- ✅ Jump down height restrictions (minimum 1.0 MU)
- ✅ Falling Test mechanics (DR calculation)
- ✅ Falling Collision (ignore one miss, targets test)

**Pending (3D Required):**
- ⏳ Building interior navigation
- ⏳ Tree climbing mechanics
- ⏳ Multi-level combat
- ⏳ Elevation-based LOS bonuses

### Source Reference

- QSR Lines 955-960: Climbing rules
- QSR Lines 962-964: Jump Up
- QSR Lines 965-970: Jump Down, Falling Test
- QSR Lines 971-974: Jump Across
- QSR Lines 985-990: Falling Collision
- `src/lib/mest-tactics/actions/agility.ts`: Jump/fall implementation
- `src/lib/mest-tactics/actions/pushing-and-maneuvers.ts`: Push maneuvers
- `docs/falling-tactics-audit.md`: Falling tactics audit
