# AI VP/RP Scoring Incentivization - Root Cause Analysis & Fix

**Date:** 2026-03-02  
**Issue:** AI System defaults to passive Hide/Detect cycles instead of pursuing VP/RP accumulation  
**Status:** 🔴 **CRITICAL GAP IDENTIFIED**

---

## Root Cause Analysis

### Problem Statement

The battle report shows:
- **Winner:** Draw
- **VP by Side:** Alpha=0, Bravo=0
- **RP by Side:** Alpha=0, Bravo=0
- **Primary Actions:** Hide (10), Detect (64), Move (7)
- **Combat Actions:** 0

**Expected:** AI should aggressively pursue elimination for VP/RP in QAI_11 (Elimination mission)

**Actual:** AI adopted passive defensive posture with no engagement

---

## Gap 1: Default Doctrine Too Passive

### Current Default

**File:** `scripts/ai-battle/AIBattleConfig.ts:136-143`

```typescript
sides: [
  {
    name: 'Alpha',
    tacticalDoctrine: TacticalDoctrine.Operative,  // ← PASSIVE DEFAULT
  },
  {
    name: 'Bravo',
    tacticalDoctrine: TacticalDoctrine.Operative,  // ← PASSIVE DEFAULT
  },
]
```

**Operative Doctrine Profile:**
- Aggression: 0.5
- Caution: 0.5
- Objective Rush: 0.5

**Impact:** Both sides play defensively, resulting in Hide/Detect cycles with no combat.

### Blueprint Evidence

From `docs/blueprint/phases/phase-2-ai-foundation.md`:

> **2.3: Tactical Doctrine (27 Doctrines) ✅**
> - ✅ 27 doctrines (Aggressive/Defensive/Balanced × Melee/Ranged/Objective)
> - ✅ Stratagem modifiers (action preferences)
> - ✅ Doctrine engagement (melee/ranged/balanced)

**The doctrine system exists but is not being leveraged for mission-appropriate defaults.**

---

## Gap 2: VP/RP Prediction Not Wired to Utility Scoring

### Current Implementation

**File:** `scripts/ai-battle/core/AIDecisionSupport.ts:46-88`

```typescript
export function buildPredictedScoring(sides: MissionSide[]): PredictedScoringResult {
  const predictedScores: Record<string, number> = {};
  const targetPriorities: Record<string, number> = {};

  for (const side of sides) {
    for (const member of side.members) {
      const character = member.character;
      
      // Score based on wounds (lower health = higher priority target)
      const healthRatio = character.state.wounds / character.profile.siz;
      targetPriorities[key] += (1 - healthRatio) * 10;

      // Score based on engagement status
      // ... engagement scoring
    }
  }

  return { predictedScores, targetPriorities };
}
```

**Missing:**
- ❌ No mission VP key scoring (elimination, bottled, first_blood)
- ❌ No RP key scoring
- ❌ No VP lead/lag pressure
- ❌ No turn-based urgency (end game approaching)

### Blueprint Evidence

From `docs/blueprint/phases/phase-3-ai-tactical.md`:

> **3.1: Mission-Aware Scoring ✅ (Partial)**
> - ✅ VP/RP prediction and pursuit - `buildScoringContext()`, `calculateScoringModifiers()`
> - ✅ Objective Marker handling (acquire/share/transfer/drop/score)
> - ⏳ **Tactical Objective Denial** - Prevent opponent from scoring (NEW)

**The functions `buildScoringContext()` and `calculateScoringModifiers()` are referenced but NOT found in current codebase search.**

---

## Gap 3: Mission Keys Not Driving AI Behavior

### Current Mission Runtime

**File:** `scripts/ai-battle/core/MissionRuntimeIntegration.ts:21-47`

```typescript
export interface MissionRuntimeState {
  vpBySide: Record<string, number>;
  rpBySide: Record<string, number>;
  predictedScoring: {
    bySide: Record<string, {
      predictedVp: number;
      predictedRp: number;
      keyScores: Record<string, number>;
    }>;
  };
}
```

**VP/RP tracking exists BUT is not consumed by AI utility scoring.**

### Blueprint Evidence

From `docs/blueprint/03-current-task.md`:

> **Mission AI objective behavior:** Mission runtime scoring now updates in AI validation runs, but AI action-selection remains mostly objective-agnostic in several missions (e.g., QAI_12/14/15/17 showed QAI_11-like action profiles under identical seed/loadout).
>
> **Mission scoring parity:** Current mission scan shows empty mission VP payloads for QAI_11 and QAI_13 (`vp: {}`), which must be resolved by rule-confirmed scoring semantics or explicit mission-level no-VP documentation.

**This gap was documented but not fixed.**

---

## Gap 4: Elimination Mission Keys Not Defined

### QSR Elimination Rules (MEST.Tactics.Missions.txt)

**Elimination Victory Conditions:**
1. **Last Side Standing** - All enemy models eliminated (automatic win)
2. **VP Tie-Break** - If models remain on both sides at game end:
   - **Elimination Key:** 1 VP per enemy model eliminated
   - **Bottled Key:** 1 VP if enemy side broke (failed Bottle Test)
   - **First Blood Key:** 1 VP for first elimination of the game

**Current State:** VP keys tracked but not scored during battle.

---

## Solution: VP/RP-Driven Utility Scoring

### Fix 1: Mission-Appropriate Default Doctrines

**File:** `scripts/ai-battle/AIBattleConfig.ts`

```typescript
export function createDefaultGameConfig(
  gameSize: GameSize = GameSize.VERY_LARGE,
  missionId: string = 'QAI_11'
): GameConfig {
  const sizeConfig = GAME_SIZE_CONFIG[gameSize];
  
  // Select doctrine based on mission type
  const getDoctrineForMission = (missionId: string, sideIndex: number): TacticalDoctrine => {
    switch (missionId) {
      case 'QAI_11': // Elimination - aggressive
        return sideIndex === 0 ? TacticalDoctrine.Aggressive : TacticalDoctrine.Balanced;
      case 'QAI_12': // Convergence - objective-focused
        return TacticalDoctrine.Objective;
      case 'QAI_13': // Assault - defender aggressive, attacker balanced
        return sideIndex === 0 ? TacticalDoctrine.Defensive : TacticalDoctrine.Aggressive;
      default:
        return TacticalDoctrine.Balanced;
    }
  };

  return {
    // ...
    sides: [
      {
        name: 'Alpha',
        bp: sizeConfig.bpPerSide[1],
        modelCount: sizeConfig.modelsPerSide[1],
        tacticalDoctrine: getDoctrineForMission(missionId, 0),  // ← MISSION-APPROPRIATE
        assemblyName: 'Assembly Alpha',
      },
      {
        name: 'Bravo',
        bp: sizeConfig.bpPerSide[1],
        modelCount: sizeConfig.modelsPerSide[1],
        tacticalDoctrine: getDoctrineForMission(missionId, 1),  // ← MISSION-APPROPRIATE
        assemblyName: 'Assembly Bravo',
      },
    ],
  };
}
```

---

### Fix 2: Wire Mission VP/RP into Utility Scoring

**File:** `scripts/ai-battle/core/AIDecisionSupport.ts`

```typescript
export function buildPredictedScoring(
  sides: MissionSide[],
  missionRuntime?: MissionRuntimeState  // ← NEW PARAMETER
): PredictedScoringResult {
  const predictedScores: Record<string, number> = {};
  const targetPriorities: Record<string, number> = {};

  for (const side of sides) {
    for (const member of side.members) {
      const character = member.character;
      if (!character || character.state.isEliminated || character.state.isKOd) {
        continue;
      }

      const key = character.id;
      let score = 0;
      let priority = 0;

      // === EXISTING: Health-based scoring ===
      const healthRatio = character.state.wounds / character.profile.siz;
      priority += (1 - healthRatio) * 10;  // Weakened = priority target

      // === EXISTING: Engagement scoring ===
      const enemies = getEnemies(sides, side.id);
      for (const enemy of enemies) {
        if (enemy && SpatialRules.isEngaged(character, enemy)) {
          score += 5;
        }
      }

      // === NEW: Mission VP/RP pressure ===
      if (missionRuntime) {
        const mySideId = side.id;
        const myVp = missionRuntime.vpBySide[mySideId] ?? 0;
        const enemyVp = Object.entries(missionRuntime.vpBySide)
          .filter(([sid]) => sid !== mySideId)
          .reduce((sum, [, vp]) => sum + vp, 0);
        
        const vpDeficit = enemyVp - myVp;
        
        // VP deficit creates urgency (+0.5 priority per VP behind)
        if (vpDeficit > 0) {
          priority += vpDeficit * 0.5;
        }
        
        // Elimination key: enemy models are VP sources
        const eliminationVpValue = 1;  // 1 VP per elimination
        priority += eliminationVpValue * 2;  // Weight elimination highly
      }

      // === NEW: Turn-based urgency ===
      const turnsRemaining = 6 - currentTurn;  // Assuming 6-turn game
      if (turnsRemaining <= 2 && vpDeficit > 0) {
        priority *= 1.5;  // Desperation mode
      }

      predictedScores[key] = score;
      targetPriorities[key] = priority;
    }
  }

  return { predictedScores, targetPriorities };
}
```

---

### Fix 3: Add VP/RP Scoring Modifiers to Action Selection

**File:** `scripts/ai-battle/AIBattleRunner.ts`

```typescript
private calculateActionScore(
  action: ActionDecision,
  character: Character,
  context: AIContext,
  doctrine: TacticalDoctrine
): number {
  let score = 0;

  // === EXISTING: Doctrine-based scoring ===
  const components = getDoctrineComponents(doctrine);
  if (components.aggression === AggressionLevel.Aggressive) {
    if (action.type === 'close_combat' || action.type === 'ranged_combat') {
      score += 3;
    }
  }

  // === NEW: VP/RP pressure scoring ===
  const myVp = this.missionVpBySide[context.sideId] ?? 0;
  const bestEnemyVp = Math.max(
    ...Object.entries(this.missionVpBySide)
      .filter(([sid]) => sid !== context.sideId)
      .map(([, vp]) => vp)
  );
  const vpDeficit = bestEnemyVp - myVp;

  if (vpDeficit > 0) {
    // Behind on VP: aggressive actions scored higher
    if (action.type === 'close_combat' || action.type === 'ranged_combat') {
      score += vpDeficit * 0.3;  // +0.3 per VP behind
    }
    
    // Behind on VP: passive actions scored lower
    if (action.type === 'hide' || action.type === 'wait') {
      score -= vpDeficit * 0.2;  // -0.2 per VP behind
    }
  }

  // === NEW: Elimination key scoring ===
  if (action.type === 'close_combat' || action.type === 'ranged_combat') {
    const target = action.target;
    if (target && target.state.wounds >= target.profile.siz - 1) {
      score += 5;  // Finish off weakened target (1 VP elimination)
    }
  }

  return score;
}
```

---

### Fix 4: Implement Elimination Mission Key Scoring

**File:** `scripts/ai-battle/core/MissionRuntimeIntegration.ts`

```typescript
export function updateMissionRuntimeForElimination(
  state: MissionRuntimeState,
  eliminatedCharacter: Character,
  eliminatingSideId: string
): MissionRuntimeUpdate {
  const update: MissionRuntimeUpdate = {
    vpBySide: {},
    rpBySide: {},
  };

  // Elimination Key: 1 VP per enemy eliminated
  update.vpBySide[eliminatingSideId] = 1;

  // First Blood Key: 1 VP for first elimination of game
  if (!state.firstBloodAwarded) {
    update.vpBySide[eliminatingSideId] = (update.vpBySide[eliminatingSideId] ?? 0) + 1;
    update.firstBloodAwarded = true;
  }

  // RP for elimination (QSR p.815)
  update.rpBySide[eliminatingSideId] = 1;

  return update;
}
```

---

## Verification Plan

### Test 1: Doctrine Defaults

```bash
# Run battle with new defaults
npm run ai-battle -- VERY_SMALL 50

# Expected: Alpha uses Aggressive, Bravo uses Balanced
# Verify: JSON report shows tacticalDoctrine: "aggressive" / "balanced"
```

### Test 2: VP Scoring

```bash
# Run battle with audit
npm run ai-battle:audit -- VERY_SMALL 50

# Expected: VP awarded for eliminations
# Verify: audit.json shows vpBySide: { Alpha: 1, Bravo: 0 } after first kill
```

### Test 3: Action Selection

```bash
# Analyze action breakdown
cat generated/ai-battle-reports/battle-report-*.json | jq '.stats'

# Expected: Combat actions > 0
# Before: closeCombats: 0, rangedCombats: 0
# After: closeCombats: 2+, rangedCombats: 1+
```

---

## Implementation Priority

| Fix | Priority | Effort | Dependencies |
|-----|----------|--------|--------------|
| **Fix 1:** Mission doctrine defaults | P0-HIGH | 1 hour | None |
| **Fix 2:** VP/RP utility scoring | P0-HIGH | 2 hours | None |
| **Fix 3:** Action selection modifiers | P1-MEDIUM | 2 hours | Fix 2 |
| **Fix 4:** Elimination key scoring | P1-MEDIUM | 1 hour | None |

**Total Effort:** 6 hours

---

## Expected Outcome

After fixes:

| Metric | Before | After |
|--------|--------|-------|
| **Default Doctrine** | Operative (passive) | Aggressive/Balanced |
| **VP Accumulation** | 0 | 1+ VP per elimination |
| **Combat Actions** | 0 | 5+ per battle |
| **Game Result** | Draw | Decisive winner |
| **AI Behavior** | Hide/Detect cycles | Aggressive pursuit |

---

## Conclusion

**The AI System VP/RP incentivization gap is caused by:**

1. ❌ Passive default doctrine (Operative)
2. ❌ VP/RP prediction not wired to utility scoring
3. ❌ Mission keys not driving action selection
4. ❌ Elimination scoring not implemented

**All required code infrastructure exists** (doctrine system, mission runtime, utility scoring). The fix is to **wire existing systems together** rather than create new functionality.

**This is a P0-HIGH gap** because it undermines the core AI behavior validation purpose of the battle simulator.

---

**References:**
- `docs/blueprint/03-current-task.md` - Gap documentation (lines 80-82)
- `docs/blueprint/phases/phase-3-ai-tactical.md` - Mission-aware scoring (line 114)
- `docs/blueprint/phases/phase-2-ai-foundation.md` - Tactical doctrines (lines 38-46)
- `scripts/ai-battle/core/AIDecisionSupport.ts` - Current scoring (needs VP/RP wiring)
- `scripts/ai-battle/AIBattleConfig.ts` - Default doctrine (needs mission-appropriate defaults)
