# VP Scoring System Analysis: Critical AI Planning Failure

**Date:** 2026-03-02  
**Status:** 🔴 **CRITICAL FAILURE IDENTIFIED**

---

## The Masked Failure

### Battle Result Claim
```
Winner: Alpha (VP: 1, RP: 0) - Won via RP Key tiebreaker
```

### Actual Battle State
```
- Turns Completed: 6/6
- Close Combats: 0
- Ranged Combats: 0
- Eliminations: 0
- KOs: 0
- Models Remaining: Alpha 4/4, Bravo 4/4
- Action Breakdown: 76% Detect, 11% Hide, 5% Move, 0% Combat
```

### The Truth

**This is NOT a victory. This is a catastrophic AI planning failure disguised by tiebreaker logic.**

When both sides have:
- **0 VP** (no eliminations)
- **0 RP** (no First Blood, no objective play)

...the "RP Key tiebreaker" is **arbitrary**. It's awarding VP to Alpha because:
1. Both sides tied at 0 RP
2. Tiebreaker logic picks first side (alphabetical? insertion order?)
3. **This is NOT meaningful victory**

---

## Root Cause Analysis

### The AI Planning Stack

```
┌─────────────────────────────────────────────────────────┐
│ SideAI (Strategic)                                      │
│ - Should set VP priorities per mission                  │
│ - Should coordinate squad-level VP pursuit              │
│ CURRENT: Sets doctrine but doesn't enforce VP pursuit   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ AssemblyAI (Tactical)                                   │
│ - Should coordinate multi-model VP actions              │
│ - Should enable focus fire, flanking, objective play    │
│ CURRENT: Not implemented / not connected                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ CharacterAI (Character)                                 │
│ - Should select VP-acquiring actions                    │
│ - Should reject non-VP plans when VP=0                  │
│ CURRENT: Selects highest utility action (Hide=3.3)      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ UtilityScorer                                           │
│ - Should score actions by VP contribution               │
│ - Should penalize 0-VP action loops                     │
│ CURRENT: Hide has higher score than combat              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ GOAP Planner                                            │
│ - Should plan multi-action VP sequences                 │
│ - Should reject plans that don't acquire VP             │
│ CURRENT: Plans Hide→Detect→Hide loops (0 VP)            │
└─────────────────────────────────────────────────────────┘
```

### Layer-by-Layer Failure

| Layer | Expected Behavior | Actual Behavior | Gap |
|-------|-------------------|-----------------|-----|
| **SideAI** | "Acquire VP through Elimination Key" | "Use Operative doctrine" | ❌ No VP directive |
| **AssemblyAI** | "Coordinate focus fire on isolated enemy" | Not connected | ❌ Missing |
| **CharacterAI** | "Select combat action when VP=0" | "Select Hide (priority 3.3)" | ❌ Wrong priority |
| **UtilityScorer** | "Combat score > Hide score when VP=0" | "Hide score (3.3) > Combat score (~2.0)" | ❌ Inverted |
| **GOAP** | "Plan must result in VP or VP position" | "Hide→Detect→Hide (0 VP)" | ❌ No VP constraint |

---

## Why Hide/Detect Dominates

### Action Priority Analysis

**Hide Action:**
```typescript
// From ReactsAndBonusActions.ts
if (canHide && !isHidden) {
  return {
    type: 'hide',
    reason: 'Hide behind cover',
    priority: 3.3,  // ← HIGH BASE PRIORITY
    requiresAP: true,
  };
}
```

**Combat Action:**
```typescript
// From UtilityScorer.evaluateTargets()
const score =
  health * weights.targetHealth +      // ~0.5-1.0
  threat * weights.targetThreat +       // ~0.3-0.5
  distance * weights.distanceToTarget + // ~0.2-0.5
  visibility * 2.0 +                     // ~2.0
  missionPriority * weights.victoryConditionValue + // ~0 (not wired!)
  focusFireBonus +                       // ~0-1.5
  finishOffBonus +                       // ~0-5.0 (only if SIZ-1 wounds)
  threatImmediacyBonus;                  // ~0-1.5

// Typical combat score: 2.0-4.0 (when enemies visible)
// Typical combat score: 0.0-1.0 (when enemies Hidden)
```

**The Problem:**
1. Hide has **fixed priority 3.3** regardless of game state
2. Combat score **depends on visible targets** (enemies are Hidden)
3. Detect has **no VP incentive** (just reveals, doesn't acquire VP)
4. **No penalty for 0-VP action loops**

### The Vicious Cycle

```
Turn 1: Both sides Hide (priority 3.3)
  → All models Hidden
  → No visible targets for combat
  
Turn 2: Both sides Detect (only legal action vs Hidden)
  → Detect rolls fail (all Hidden + cover)
  → Still no visible targets
  
Turn 3: Repeat Turn 2
  → ...
  
Turn 6: Game ends, 0 combat, tiebreaker decides "winner"
```

**This is NOT wargaming. This is two players hiding under blankets for 6 rounds.**

---

## The Core Issue: VP is Not a Planning Constraint

### Current Planning Flow

```
1. Generate all legal actions (Hide, Detect, Move, Wait, etc.)
2. Score each action by utility
3. Select highest score
4. Execute
5. Repeat
```

**VP is NOT in this loop.** VP is tracked but never used to:
- Filter available actions
- Constrain plan generation
- Penalize 0-VP sequences
- Reward VP-acquiring sequences

### Required Planning Flow

```
1. Get current VP state (my VP, enemy VP, turns remaining)
2. Calculate VP deficit and urgency
3. Generate legal actions
4. FILTER: Reject actions that don't contribute to VP (when VP=0, turns≥3)
5. Score remaining actions by utility + VP contribution
6. Select highest score
7. Execute
8. Repeat
```

---

## Proposed Solution: VP-Gated Planning System

### Phase 1: VP Urgency Calculator

**File:** `src/lib/mest-tactics/ai/core/VPUrgencyCalculator.ts` (NEW)

```typescript
export interface VPUrgencyState {
  myVP: number;
  enemyVP: number;
  vpDeficit: number;
  turnsRemaining: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'desperate';
  requiredVPPerTurn: number;
}

export function calculateVPUrgency(
  myVP: number,
  enemyVP: number,
  currentTurn: number,
  maxTurns: number
): VPUrgencyState {
  const vpDeficit = enemyVP - myVP;
  const turnsRemaining = maxTurns - currentTurn + 1;
  const requiredVPPerTurn = (vpDeficit + 1) / turnsRemaining;
  
  let urgencyLevel: VPUrgencyState['urgencyLevel'];
  if (myVP === 0 && currentTurn >= 4) {
    urgencyLevel = 'desperate';
  } else if (vpDeficit >= 2) {
    urgencyLevel = 'high';
  } else if (vpDeficit >= 1) {
    urgencyLevel = 'medium';
  } else {
    urgencyLevel = 'low';
  }
  
  return {
    myVP,
    enemyVP,
    vpDeficit,
    turnsRemaining,
    urgencyLevel,
    requiredVPPerTurn,
  };
}
```

### Phase 2: VP-Gated Action Filter

**File:** `src/lib/mest-tactics/ai/core/ActionFilter.ts` (NEW)

```typescript
export interface ActionVPInfo {
  actionType: ActionType;
  estimatedVPContribution: number;  // 0.0-1.0 (probability of VP gain)
  isDirectVPAction: boolean;         // Combat, objective capture
  isVPEnablingAction: boolean;       // Move to attack position, Detect to reveal
  isPassiveAction: boolean;          // Hide, Wait (no VP contribution)
}

export function filterActionsByVP(
  actions: ActionDecision[],
  urgency: VPUrgencyState
): ActionDecision[] {
  if (urgency.urgencyLevel === 'low') {
    return actions;  // No filtering when VP situation is good
  }
  
  if (urgency.urgencyLevel === 'desperate') {
    // Desperate mode: ONLY allow direct VP actions
    return actions.filter(a => {
      const vpInfo = getActionVPInfo(a);
      return vpInfo.isDirectVPAction || vpInfo.estimatedVPContribution >= 0.5;
    });
  }
  
  if (urgency.urgencyLevel === 'high') {
    // High urgency: Reject purely passive actions
    return actions.filter(a => {
      const vpInfo = getActionVPInfo(a);
      return !vpInfo.isPassiveAction || vpInfo.estimatedVPContribution >= 0.3;
    });
  }
  
  // Medium urgency: Penalize passive actions
  return actions;  // Scoring will handle penalty
}

function getActionVPInfo(action: ActionDecision): ActionVPInfo {
  switch (action.type) {
    case 'close_combat':
    case 'ranged_combat':
      return {
        actionType: action.type,
        estimatedVPContribution: 0.3,  // 30% chance of elimination
        isDirectVPAction: true,
        isVPEnablingAction: false,
        isPassiveAction: false,
      };
    case 'move':
      return {
        actionType: action.type,
        estimatedVPContribution: 0.1,  // Positioning for future VP
        isDirectVPAction: false,
        isVPEnablingAction: true,
        isPassiveAction: false,
      };
    case 'hide':
    case 'wait':
      return {
        actionType: action.type,
        estimatedVPContribution: 0.0,  // No VP contribution
        isDirectVPAction: false,
        isVPEnablingAction: false,
        isPassiveAction: true,
      };
    // ... etc
  }
}
```

### Phase 3: Fractional VP Prediction Cache

**File:** `src/lib/mest-tactics/ai/core/VPPredictionCache.ts` (NEW)

```typescript
export interface VPContributionCache {
  characterId: string;
  turn: number;
  actionType: ActionType;
  predictedVP: number;  // Fractional VP (0.0-1.0)
  confidence: number;   // 0.0-1.0
}

export class VPPredictionCache {
  private cache: Map<string, VPContributionCache> = new Map();
  
  /**
   * Record actual VP contribution after action resolves
   */
  recordVPContribution(
    characterId: string,
    turn: number,
    actionType: ActionType,
    actualVP: number
  ): void {
    const key = `${characterId}:${turn}:${actionType}`;
    this.cache.set(key, {
      characterId,
      turn,
      actionType,
      predictedVP: actualVP,
      confidence: 1.0,  // Actual result
    });
  }
  
  /**
   * Get predicted VP for action type
   */
  getPredictedVP(
    characterId: string,
    actionType: ActionType,
    currentTurn: number
  ): number {
    // Look at recent history for this character + action type
    const recent = Array.from(this.cache.values())
      .filter(c => 
        c.characterId === characterId &&
        c.actionType === actionType &&
        c.turn >= currentTurn - 3
      );
    
    if (recent.length === 0) {
      return this.getDefaultVPContribution(actionType);
    }
    
    const avgVP = recent.reduce((sum, c) => sum + c.predictedVP, 0) / recent.length;
    const avgConfidence = recent.reduce((sum, c) => sum + c.confidence, 0) / recent.length;
    
    return avgVP * avgConfidence;
  }
  
  private getDefaultVPContribution(actionType: ActionType): number {
    const defaults: Record<ActionType, number> = {
      'close_combat': 0.3,
      'ranged_combat': 0.2,
      'move': 0.05,
      'hide': 0.0,
      'wait': 0.0,
      'detect': 0.05,
      // ... etc
    };
    return defaults[actionType] ?? 0.0;
  }
}
```

### Phase 4: Utility Scorer VP Integration

**File:** `src/lib/mest-tactics/ai/core/UtilityScorer.ts` (MODIFY)

```typescript
private scoreActionByVP(
  action: ActionDecision,
  urgency: VPUrgencyState,
  cache: VPPredictionCache
): number {
  const predictedVP = cache.getPredictedVP(
    context.character.id,
    action.type,
    context.currentTurn
  );
  
  // VP urgency multiplier
  let urgencyMultiplier = 1.0;
  switch (urgency.urgencyLevel) {
    case 'desperate':
      urgencyMultiplier = 3.0;  // VP is 3x more valuable
      break;
    case 'high':
      urgencyMultiplier = 2.0;
      break;
    case 'medium':
      urgencyMultiplier = 1.5;
      break;
  }
  
  // Penalty for passive actions when VP=0
  const vpInfo = getActionVPInfo(action);
  let passivePenalty = 0;
  if (vpInfo.isPassiveAction && urgency.myVP === 0 && urgency.currentTurn >= 3) {
    passivePenalty = -2.0 * (urgency.currentTurn - 2);  // -2, -4, -6...
  }
  
  return (predictedVP * urgencyMultiplier) + passivePenalty;
}
```

### Phase 5: GOAP VP Constraint

**File:** `src/lib/mest-tactics/ai/tactical/GOAP.ts` (MODIFY)

```typescript
export function generateValidPlans(
  actions: ActionDecision[],
  urgency: VPUrgencyState,
  maxDepth: number = 3
): ActionPlan[] {
  const plans: ActionPlan[] = [];
  
  // Generate all possible action sequences
  const allSequences = this.generateSequences(actions, maxDepth);
  
  // FILTER: Reject sequences with 0 VP contribution
  for (const sequence of allSequences) {
    const totalPredictedVP = sequence.actions.reduce((sum, action) => {
      return sum + this.getPredictedVPContribution(action);
    }, 0);
    
    // Reject if no VP contribution and urgency is high
    if (totalPredictedVP === 0 && 
        (urgency.urgencyLevel === 'high' || urgency.urgencyLevel === 'desperate')) {
      continue;  // Skip this plan
    }
    
    plans.push(sequence);
  }
  
  return plans;
}
```

---

## Implementation Priority

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|--------------|
| **Phase 1:** VP Urgency Calculator | P0-HIGH | 1 hour | None |
| **Phase 2:** VP-Gated Action Filter | P0-HIGH | 2 hours | Phase 1 |
| **Phase 3:** VP Prediction Cache | P1-MEDIUM | 3 hours | None |
| **Phase 4:** Utility Scorer Integration | P1-MEDIUM | 2 hours | Phase 1, 3 |
| **Phase 5:** GOAP VP Constraint | P2-LOW | 4 hours | Phase 2, 3 |

**Total Effort:** 12 hours

---

## Expected Outcome

After implementation:

| Metric | Before | After |
|--------|--------|-------|
| **Combat Actions** | 0 | 5-10 per battle |
| **Eliminations** | 0 | 1-3 per battle |
| **VP Acquisition** | 0 (tiebreaker) | 1-3 VP per side |
| **Battle Duration** | ~11s | ~15-20s (more computation) |
| **AI Behavior** | Hide/Detect loops | VP-seeking combat |

---

## Verification Test

Run battle with same configuration:

```bash
npm run ai-battle -- VERY_SMALL
```

**Expected:**
- ✅ Combat actions > 0
- ✅ Eliminations > 0
- ✅ VP from eliminations (not tiebreaker)
- ✅ Winner determined by actual VP, not tiebreaker

---

## Notes for Next AI Thread

1. **DO NOT** just tweak Hide priority or add small penalties
2. **DO** implement VP-gated planning as described
3. **Key insight:** VP must be a PLANNING CONSTRAINT, not just a scoring modifier
4. **Test early:** After Phase 2, verify combat actions > 0
5. **Tune gradually:** Start with gentle VP gating, increase urgency over time

---

**This is not a scoring system bug. This is an AI architecture bug.**

The VP/RP tracking works correctly. The failure is that VP is never used to constrain or guide planning.

**Fix the planner, not the scoreboard.**
