# Falling Tactics & AI Awareness Audit

**Date:** 2026-02-27  
**Purpose:** Audit Falling Collision implementation and AI tactical awareness of falling-based strategies.

---

## QSR Rules Reference

### Jump Down (QSR Lines 965-970)
- **Max Distance:** Agility in MU
- **Wound:** If within last 0.5 MU of Agility
- **Falling Test:** If > Agility (DR = SIZ + (MU beyond Agility ÷ 4))
- **Falling Collision:** Ignore one miss, targets test

### Falling Collision (QSR Lines 985-990)
- **Falling Model:** May ignore ONE miss on Falling Test
- **Target Models:** Must perform Falling Test using same DR
- **Strategy:** Jump down onto enemies to cause Collision effects

### Push Maneuvers (QSR Lines 1055-1065)
- **Push-back:** Reposition target away up to base-diameter
- **Delay Token:** If pushed into wall, obstacle, degraded terrain, or **across a ledge/off battlefield**
- **Strategy:** Push enemies off precipices to cause falling damage

### Tactical Applications
1. **Jump Down Attack:** Land on enemy to cause Falling Collision
   - Falling character ignores one miss
   - Target must make Falling Test (potential Stun damage)
   - Can eliminate weakened enemies

2. **Push Off Ledge:** Force enemy to fall
   - Costs cascades (Combat Maneuver)
   - Enemy receives Delay token if resists falling
   - Enemy makes Falling Test (potential Stun/Wounds)

3. **Force Delay Token:** Prevent enemy action
   - Push into wall/obstacle/ledge
   - Enemy acquires Delay token
   - Reduces enemy effectiveness next activation

---

## Implementation Status

### ✅ Implemented (Core Mechanics)

| Feature | File | Status | Notes |
|---------|------|--------|-------|
| **Jump Down** | `agility.ts` | ✅ Complete | `jumpDown()` with wound check |
| **Falling Test** | `agility.ts` | ✅ Complete | `resolveFallingTest()` - DR = SIZ + (beyond ÷ 4) |
| **Falling Collision** | `agility.ts` | ✅ Complete | `resolveFallingCollision()` - ignore one miss, targets test |
| **Push-back Maneuver** | `pushing-and-maneuvers.ts` | ✅ Complete | `performPushBack()` with Delay token note |
| **Ledge Grab** | `agility.ts` | ✅ Complete | Jump across with ledge grab (adds Delay) |

### ⚠️ Partial Implementation

| Feature | File | Issue | Fix Required |
|---------|------|-------|--------------|
| **Push Off Precipice** | `pushing-and-maneuvers.ts` | Delay token noted but not enforced | Add terrain height check, enforce Delay |
| **Falling Collision in Combat** | `combat-actions.ts` | Not integrated into combat flow | Add collision check after push/jump |
| **Height/Elevation Tracking** | `Battlefield.ts` | No terrain height data | Add height map or precipice markers |

### ❌ Missing (AI Tactical Awareness)

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| **AI: Evaluate Jump Down Attack** | ❌ Missing | P2-MEDIUM | Score jumping onto weakened enemies |
| **AI: Evaluate Push Off Ledge** | ❌ Missing | P2-MEDIUM | Score pushing enemies off precipices |
| **AI: Evaluate Force Delay Token** | ⚠️ Partial | P2-MEDIUM | One comment reference, no scoring |
| **AI: Terrain Height Awareness** | ❌ Missing | P2-MEDIUM | No elevation data in AI evaluation |
| **AI: Falling Damage Prediction** | ❌ Missing | P3-LOW | Calculate expected Stun/Wounds from fall |

---

## Code Review: AI Tactical Gap

### Current AI Evaluation (UtilityScorer.ts)

```typescript
// Line 2191: Only mention of "precipice" in AI code
// 1. Check for Delay token (push into wall/impassable/precipice)
const terrainAtNewPos = battlefield.getTerrainAt(newPos);
if (terrainAtNewPos?.movement === 'Impassable' || terrainAtNewPos?.movement === 'Blocking') {
  score += 8; // High value for causing Delay
  reasons.push('Delay token (wall)');
}
```

**Issues:**
1. **No height data:** `getTerrainAt()` returns terrain type, not height/elevation
2. **No falling calculation:** Doesn't calculate potential Falling Test DR
3. **No collision scoring:** Doesn't evaluate jumping onto enemies
4. **Comment only:** "precipice" mentioned in comment but not implemented

### Missing AI Scoring Functions

```typescript
// ❌ MISSING: Evaluate jump down attack opportunity
function evaluateJumpDownAttack(
  character: Character,
  target: Character,
  battlefield: Battlefield,
  fallDistance: number
): number {
  // Calculate expected damage to target
  const targetDR = calculateFallingDR(fallDistance, target);
  const expectedStun = calculateExpectedStun(target, targetDR);
  
  // Calculate risk to self (also takes Falling Test)
  const selfRisk = calculateFallingRisk(character, fallDistance);
  
  // Score: high if target weakened, low if self at risk
  return (expectedStun * 2) - selfRisk;
}

// ❌ MISSING: Evaluate push off ledge
function evaluatePushOffLedge(
  character: Character,
  target: Character,
  ledgePosition: Position,
  fallDistance: number
): number {
  // Check if target can be pushed to ledge
  const canPushToLedge = canReachLedge(character, target, ledgePosition);
  
  // Calculate expected falling damage
  const expectedDamage = calculateExpectedFallingDamage(target, fallDistance);
  
  // Score: high for large fall, moderate for Delay token
  return canPushToLedge ? expectedDamage * 3 : 0;
}

// ❌ MISSING: Calculate Falling Test DR
function calculateFallingDR(fallDistance: number, agility: number): number {
  const beyondAgility = Math.max(0, fallDistance - agility);
  const siz = 3; // Would need target's SIZ
  return siz + Math.round(beyondAgility / 4);
}
```

---

## Test Coverage

### agility-falling.test.ts (262 lines)

| Test Category | Tests | Status |
|---------------|-------|--------|
| **calculateAgility** | 4 | ✅ Passing |
| **jumpDown** | 4 | ✅ Passing |
| **resolveFallingTest** | 5 | ✅ Passing |
| **resolveFallingCollision** | 4 | ✅ Passing |
| **Total** | 17 | ✅ All Passing |

### Missing AI Tests

| Feature | Test Needed | Priority |
|---------|-------------|----------|
| **AI jump down evaluation** | Test AI chooses jump down vs walk around | P2-MEDIUM |
| **AI push off ledge** | Test AI pushes weakened enemy off cliff | P2-MEDIUM |
| **AI force Delay token** | Test AI pushes enemy into wall for Delay | P2-MEDIUM |
| **AI falling damage prediction** | Test AI calculates expected Stun/Wounds | P3-LOW |

---

## Integration Points

### Files Using Falling Mechanics

| File | Usage | AI Integration |
|------|-------|----------------|
| `agility.ts` | Jump down, Falling Test, Collision | ❌ No AI awareness |
| `combat-actions.ts` | Push-back maneuver | ⚠️ Partial (Delay noted) |
| `pushing-and-maneuvers.ts` | Combat maneuvers | ❌ No height check |
| `ai/core/UtilityScorer.ts` | Target/position scoring | ❌ No falling tactics |
| `ai/tactical/ReactsAndBonusActions.ts` | React evaluation | ❌ No falling reactions |

### Required Integration

1. **Battlefield Height Data**
   - Add `terrainHeight` to `TerrainElement`
   - Add `getTerrainHeight(position)` method
   - Mark precipice/ledge locations

2. **AI Scoring Integration**
   - Add `evaluateJumpDownAttack()` to `UtilityScorer`
   - Add `evaluatePushOffLedge()` to `UtilityScorer`
   - Add falling damage prediction to target scoring

3. **Combat Flow Integration**
   - Call `resolveFallingCollision()` after push-back into precipice
   - Apply Delay tokens for ledge resistance
   - Apply Falling Test results to both parties

---

## Remediation Plan

### Phase 2.3 (P2-MEDIUM): Falling Tactics Implementation

**Estimated Effort:** 2-3 days

**Tasks:**

1. **Terrain Height Data** (`battlefield/terrain/TerrainElement.ts`)
   - Add `height: number` field (MU above base)
   - Add `isPrecipice: boolean` flag
   - Update terrain parsing from JSON
   - **Effort:** 0.5 day

2. **Push Off Ledge Enforcement** (`pushing-and-maneuvers.ts`)
   - Check terrain height at push destination
   - Apply Delay token if pushed off precipice
   - Trigger Falling Test if pushed off battlefield
   - **Effort:** 0.5 day

3. **Falling Collision in Combat** (`combat-actions.ts`)
   - Call `resolveFallingCollision()` after push-back
   - Apply results to both attacker and target
   - Log collision effects
   - **Effort:** 0.5 day

4. **AI: Jump Down Attack Scoring** (`ai/core/UtilityScorer.ts`)
   - Add `evaluateJumpDownAttack()` function
   - Calculate expected Stun/Wounds to target
   - Factor into attack target scoring
   - **Effort:** 0.5 day

5. **AI: Push Off Ledge Scoring** (`ai/core/UtilityScorer.ts`)
   - Add `evaluatePushOffLedge()` function
   - Identify precipice locations
   - Score push maneuvers based on fall damage
   - **Effort:** 0.5 day

6. **Unit Tests** (`ai-falling-tactics.test.ts`)
   - Test AI chooses jump down vs alternatives
   - Test AI pushes weakened enemies off cliffs
   - Test AI avoids falling when self at risk
   - **Effort:** 0.5 day

**Total Effort:** 3 days

---

## Strategic Examples

### Scenario 1: Jump Down Attack
```
Situation:
- Character A (SIZ 3, MOV 4, Agility 2 MU, FOR 2) on ledge 4 MU above
- Enemy B (SIZ 3, FOR 2, 1 Wound already) below
- Jump down distance: 4 MU

Falling Test DR:
- Beyond Agility: 4 - 2 = 2 MU
- DR = SIZ 3 + (2 ÷ 4) = 3 (rounded)

Expected Outcome:
- Character A: Ignores 1 miss, likely takes 0-1 Stun
- Enemy B: Must test vs DR 3, likely takes 1-2 Stun (possibly Eliminated with 1 Wound)

AI Decision:
- ✅ JUMP DOWN if enemy weakened (high value)
- ❌ Walk around if enemy at full strength (risk not worth it)
```

### Scenario 2: Push Off Ledge
```
Situation:
- Character A in close combat with Enemy B
- Enemy B is 1 MU from precipice (10 MU drop)
- Character A has 3 cascades available

Push-back Cost:
- Base: 1 cascade
- Push 1 MU: +3 cascades (total 4, not enough!)

Alternative:
- Use 2 cascades for normal push (no extra MU)
- Enemy B pushed 1 MU off ledge

Falling Test DR:
- DR = SIZ 3 + (10 ÷ 4) = 6 (very hard!)
- Enemy B likely fails, takes 2+ Stun (possibly Eliminated)

AI Decision:
- ✅ PUSH if cascades available and enemy weakened
- ❌ Don't push if cascades needed for defense
```

### Scenario 3: Force Delay Token
```
Situation:
- Character A wants to prevent Enemy B from acting next turn
- Enemy B near wall (not precipice)
- Character A has 1 cascade available

Push-back:
- Cost: 1 cascade
- Push Enemy B into wall
- Enemy B receives Delay token (1 AP lost next turn)

Strategic Value:
- Enemy B loses 50% action economy
- Character A gains tactical advantage
- No falling damage, but denies enemy action

AI Decision:
- ✅ PUSH if enemy is high-value target (shooter, leader)
- ❌ Don't push if enemy already has Delay tokens
```

---

## QSR Compliance Summary

| Category | Compliance | Notes |
|----------|------------|-------|
| **Jump Down Mechanics** | ✅ 100% | Distance, wound, test all correct |
| **Falling Test** | ✅ 100% | DR calculation correct |
| **Falling Collision** | ✅ 100% | Ignore one miss, targets test |
| **Push Maneuvers** | ⚠️ 80% | Delay noted, not enforced |
| **AI Tactical Awareness** | ❌ 10% | One comment, no implementation |

**Overall Compliance:** **58%** (AI tactics prevent full compliance)

---

## Recommendations

1. **Immediate (P2-MEDIUM):** Implement terrain height data
   - Foundation for all falling tactics
   - Enables precipice detection
   - Required for AI evaluation

2. **Short-term (P2-MEDIUM):** Add AI falling tactics scoring
   - `evaluateJumpDownAttack()` for offensive jumps
   - `evaluatePushOffLedge()` for environmental kills
   - `evaluateForceDelayToken()` for action denial

3. **Medium-term (P3-LOW):** Integrate falling into combat flow
   - Automatic Falling Collision after push-back
   - Delay token enforcement for ledge resistance
   - Battle log entries for falling events

4. **Testing (P2-MEDIUM):** Add comprehensive AI tests
   - `ai-falling-tactics.test.ts`
   - Test scenarios from strategic examples
   - Verify AI makes correct trade-offs

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `src/lib/mest-tactics/battlefield/terrain/TerrainElement.ts` | Add `height`, `isPrecipice` | P2-MEDIUM |
| `src/lib/mest-tactics/actions/pushing-and-maneuvers.ts` | Enforce Delay for precipice | P2-MEDIUM |
| `src/lib/mest-tactics/actions/combat-actions.ts` | Call `resolveFallingCollision()` | P2-MEDIUM |
| `src/lib/mest-tactics/ai/core/UtilityScorer.ts` | Add falling tactics scoring | P2-MEDIUM |
| `src/lib/mest-tactics/ai/ai-falling-tactics.test.ts` | New test file | P2-MEDIUM |

---

## Summary

**Status:** Falling mechanics **100% implemented**, AI tactical awareness **10%**

**Main Gap:** AI doesn't consider falling-based strategies (jump down attacks, push off ledges, force Delay tokens)

**Fix Complexity:** Medium - requires terrain height data + AI scoring functions

**Priority:** P2-MEDIUM (tactical depth, QSR compliance)

**Estimated Effort:** 3 days

**Strategic Impact:** High - adds environmental tactics, risk/reward decisions
