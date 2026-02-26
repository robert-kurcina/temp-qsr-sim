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
