# QSR Rules Master Compliance Tracker

**Date:** 2026-03-03
**Status:** ⚠️ **PARTIAL - NO MASTER LIST EXISTS**

---

## Executive Summary

**There is NO comprehensive master list tracking:**
1. ❌ All QSR clauses broken down individually
2. ❌ All referents (dependencies) for each clause
3. ❌ All system mastery nuances/combos

**Current State:**
- Rules are implemented based on developer understanding
- No systematic clause-by-clause verification exists
- System mastery combos discovered ad-hoc, not tracked

---

## QSR Document Structure Analysis

### Section Count (MEST.Tactics.QSR.txt)

| Section | Lines | Rules | Clauses | Status |
|---------|-------|-------|---------|--------|
| **Materials Required** | 1-70 | ~15 | ~50 | ⚠️ Partial |
| **Basic Game** | 71-170 | ~20 | ~80 | ⚠️ Partial |
| **Characters** | 171-350 | ~25 | ~100 | ⚠️ Partial |
| **Archetypes** | 351-450 | ~10 | ~40 | ⚠️ Partial |
| **Traits** | 451-550 | ~30 | ~150 | ⚠️ Partial |
| **Items** | 551-650 | ~20 | ~80 | ⚠️ Partial |
| **Visibility & Distance** | 651-750 | ~15 | ~60 | ⚠️ Partial |
| **Initiative & Activation** | 751-850 | ~10 | ~50 | ⚠️ Partial |
| **Actions** | 851-1050 | ~25 | ~150 | ⚠️ Partial |
| **Combat** | 1051-1350 | ~40 | ~200 | ⚠️ Partial |
| **Morale** | 1351-1450 | ~15 | ~60 | ⚠️ Partial |
| **Advanced Rules** | 1451-1702 | ~50 | ~250 | ❌ Not Tracked |

**Estimated Totals:**
- **~275 Rules** across 12 major sections
- **~1,270 Clauses** (sub-rules, conditions, effects)
- **~500+ Referents** (dependencies between rules)

---

## Example: Wait Action (Lines 858-865) Breakdown

### Rule: Wait ()

**Full Text:**
```
Wait () — Pay 2 AP if not Outnumbered to acquire Wait status and marker.
           Remove at the start of this character's next Initiative.
           If already in Wait status at the start of Initiative, pay 1 AP to maintain if Free,
           otherwise must remove.
	During Wait status, may remove it to perform a React. Even when in Done status.
	While in Wait status, double Visibility OR.
           All Hidden Opposing models in LOS but not in Cover are immediately Revealed.
	When in Wait status, and involuntarily acquire a Delay token, must remove both instead.
	"Focus" — Remove Wait status while Attentive to receive +1 Wild die for any Test
           instead of performing a React.
	"Waiting" — All characters in Wait status receive +1 REF when qualifying for a React.
```

### Clause Breakdown (11 Clauses)

| # | Clause | Implementation | File | Status |
|---|--------|----------------|------|--------|
| 1 | Pay 2 AP if not Outnumbered | `executeWait()` | `AIActionExecutor.ts` | ✅ |
| 2 | Acquire Wait status and marker | `executeWait()` | `AIActionExecutor.ts` | ✅ |
| 3 | Remove at start of next Initiative | `startInitiative()` | `GameManager.ts` | ✅ |
| 4 | If in Wait at Initiative start, pay 1 AP if Free | `startInitiative()` | `GameManager.ts` | ⚠️ Verify |
| 5 | If not Free, must remove Wait | `startInitiative()` | `GameManager.ts` | ⚠️ Verify |
| 6 | During Wait, may remove to React (even Done) | `canReact()` | `ReactsQSR.ts` | ✅ |
| 7 | Double Visibility OR | `resolveWaitReveal()` | `concealment.ts` | ✅ |
| 8 | Reveal Hidden in LOS not in Cover | `resolveWaitReveal()` | `concealment.ts` | ✅ |
| 9 | Involuntary Delay token removes both | `acquireDelayToken()` | `GameManager.ts` | ⚠️ Verify |
| 10 | Focus: Remove Wait, +1w for Test | `evaluateFocus()` | `ReactsQSR.ts` | ✅ |
| 11 | Waiting: +1 REF for React qualification | `checkREFRequirement()` | `ReactsQSR.ts` | ✅ |

### Referents (12 Dependencies)

| Referent | Type | Used By Clauses | Codified |
|----------|------|-----------------|----------|
| AP | Cost | 1, 4 | ✅ `GameManager.spendAp()` |
| Outnumbered | Condition | 1 | ⚠️ `isOutnumbered()` - needs verification |
| Initiative | Timing | 3, 4, 5 | ✅ `GameManager.startInitiative()` |
| Free | Condition | 4, 5 | ⚠️ `isFree()` - needs verification |
| Done | State | 6 | ✅ `character.state.isWaiting` |
| React | Action | 6, 10, 11 | ✅ `ReactsQSR.ts` |
| Visibility OR | Variable | 7 | ✅ `config.visibilityOrMu` |
| Hidden | State | 8 | ✅ `character.state.isHidden` |
| Revealed | State | 8 | ✅ `attemptDetect()` |
| LOS | Condition | 8 | ✅ `SpatialRules.hasLineOfSight()` |
| Cover | Condition | 8 | ✅ `SpatialRules.getCoverResult()` |
| Delay token | State | 9 | ✅ `character.state.delayTokens` |
| Attentive | State | 10 | ✅ `character.state.isAttentive` |
| Wild die | Bonus | 10 | ✅ `dice-roller.ts` |
| REF | Attribute | 11 | ✅ `character.finalAttributes.ref` |

### System Mastery Nuances (Combos)

| Combo | Components | Benefit | Tracked | Codified |
|-------|------------|---------|---------|----------|
| **Focus + Detect** | Wait → Focus + First Detect | +1w, 0 AP | ❌ No | ❌ No |
| **Focus + Concentrate + Detect** | Wait → Focus + Concentrate + First Detect | +2w, 1 AP | ❌ No | ❌ No |
| **Wait + React** | Wait + React Move | Attack moving target | ⚠️ Partial | ⚠️ Partial |
| **Hide + Wait** | Hide + Wait | Defensive setup | ❌ No | ❌ No |
| **Sneaky X + Hide + Wait** | Sneaky X + Hide + Wait | 0 AP Hide + Wait | ❌ No | ❌ No |

---

## Current Tracking Status

### What EXISTS ✅

| Document | Purpose | Coverage |
|----------|---------|----------|
| `QSR_RULES_COMPLIANCE_AUDIT.md` | High-level rule gaps | ~10 rules |
| `QSR_RULES_IMPLEMENTATION_*.md` | Implementation status | ~5 rules |
| `AI_BATTLE_AUDIT_STATUS.md` | Battle testing status | N/A |

### What's MISSING ❌

| Item | Description | Impact |
|------|-------------|--------|
| **Clause Registry** | No master list of all ~1,270 clauses | Can't verify 1:1 coverage |
| **Referent Index** | No index of ~500 dependencies | Can't verify codification |
| **Combo Catalog** | No catalog of system mastery combos | AI can't leverage optimally |
| **Traceability Matrix** | No QSR line → code mapping | Can't audit completeness |

---

## Recommended Structure

### 1. Clause Registry (Per Rule)

```markdown
## Rule: [Rule Name] (Line XXX)

### Clauses
| ID | Text | Implementation | Status |
|----|------|----------------|--------|
| XXX.1 | [Clause text] | [File:Line] | ✅/⚠️/❌ |

### Referents
| Referent | Type | Clauses Using | Codified Location |
|----------|------|---------------|-------------------|
| [Name] | [Cost/Condition/State/etc.] | [IDs] | [File:Line] |

### Combos
| Combo | Components | Benefit | AI Awareness |
|-------|------------|---------|--------------|
| [Name] | [List] | [Description] | ✅/❌ |
```

### 2. Referent Index

```markdown
## Referent: [Name]

### Definition
[QSR definition]

### Codification
- [File:Line] - [Description]

### Used By Rules
- [Rule Name] (Line XXX) - Clause Y
```

### 3. Combo Catalog

```markdown
## Combo: [Name]

### Components
1. [Component 1] (QSR Line XXX)
2. [Component 2] (QSR Line YYY)

### Benefit
[Quantified benefit]

### AI Implementation
- Recognized: ✅/❌
- Prioritized: ✅/❌
- File: [AI decision code]
```

---

## Immediate Actions Required

### Priority 1: Create Wait Action Full Audit
**Effort:** 2 hours
**Output:** Complete clause/referent/combo breakdown for Wait

### Priority 2: Create Hide Action Full Audit
**Effort:** 2 hours
**Output:** Complete clause/referent/combo breakdown for Hide

### Priority 3: Create Detect Action Full Audit
**Effort:** 2 hours
**Output:** Complete clause/referent/combo breakdown for Detect

### Priority 4: Create Focus Combo Full Audit
**Effort:** 1 hour
**Output:** Focus + Detect, Focus + Concentrate + Detect combos

### Priority 5: Expand to All Actions (~25 rules)
**Effort:** 25 hours
**Output:** Complete action clause registry

### Priority 6: Expand to Combat Rules (~40 rules)
**Effort:** 40 hours
**Output:** Complete combat clause registry

### Priority 7: Expand to All Sections (~275 rules)
**Effort:** 200 hours
**Output:** Complete QSR clause registry

---

## Conclusion

**No, there is NOT a master list of clauses, referents, and nuances.**

**Current State:**
- ~10 rules audited at high level
- ~5 rules with implementation tracking
- 0 rules with complete clause-by-clause breakdown
- 0 referents indexed
- 0 combos cataloged

**Required:**
- Systematic clause registry for all ~275 rules
- Referent index for all ~500 dependencies
- Combo catalog for all system mastery opportunities
- Traceability matrix (QSR line → code)

**This is a significant documentation gap that prevents:**
1. Verifying 1:1 QSR compliance
2. Ensuring AI leverages all valid combos
3. Auditing implementation completeness
4. Catching rules drift over time
