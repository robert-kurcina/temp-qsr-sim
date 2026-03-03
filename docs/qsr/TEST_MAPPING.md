# Test-to-Clause Mapping

**Date:** 2026-03-03
**Status:** ⚠️ In Progress

**Purpose:** Map existing unit tests to QSR clauses for verification coverage

---

## Focus Rule (4 clauses)

| Clause | Test File | Test Name | Status | Notes |
|--------|-----------|-----------|--------|-------|
| 859.1 | `reacts-qsr.test.ts` | `should require Wait status to react` | ✅ Mapped | Indirect |
| 859.2 | `reacts-qsr.test.ts` | `should allow react when in Wait status` | ✅ Mapped | Indirect |
| 859.3 | `focus-detect-combo.test.ts` | `should apply +1w bonus from Focus to Detect Test` | ✅ Mapped | +1w bonus test |
| 859.4 | `reacts-qsr.test.ts` | `evaluateFocus()` comparison | ✅ Mapped | Logic exists, tested |

**Coverage:** 4/4 (100%)

---

## Detect Rule (10 clauses)

| Clause | Test File | Test Name | Status | Notes |
|--------|-----------|-----------|--------|-------|
| 855.1 | `executor.test.ts` | `executeDetect should cost 0 AP for first Detect` | ✅ Mapped | First Detect FREE |
| 855.2 | `executor.test.ts` | `executeDetect should cost 1 AP for subsequent` | ✅ Mapped | Subsequent cost |
| 855.3 | (needs test) | - | ❌ Missing | Free status check |
| 855.4 | `concealment.test.ts` | `should reveal hidden target on successful detect` | ✅ Mapped | Opposed REF Test |
| 855.5 | `concealment.test.ts` | (implicit in attemptDetect) | ✅ Mapped | Target must be Hidden |
| 855.6 | `concealment.test.ts` | (implicit in LOS check) | ✅ Mapped | Target must be within LOS |
| 855.7 | `concealment.test.ts` | `should reveal hidden target on successful detect` | ✅ Mapped | Removes Hidden |
| 855.8 | `concealment.test.ts` | (implicit) | ✅ Mapped | Makes Revealed |
| 856.1 | `concealment.test.ts` | (implicit in OR calculation) | ⚠️ Partial | Detect OR = Visibility |
| 857.1 | (needs test) | - | ❌ Missing | Situational modifiers |

**Coverage:** 7/10 (70%)

---

## Wait Rule (11 clauses)

| Clause | Test File | Test Name | Status | Notes |
|--------|-----------|-----------|--------|-------|
| 858.1 | `executor.test.ts` | `executeWait should cost 2 AP` | ✅ Mapped | Pay 2 AP |
| 858.2 | (needs test) | - | ❌ Missing | Remove at Initiative start |
| 858.3 | (needs test) | - | ❌ Missing | 1 AP maintenance if Free |
| 858.4 | (needs test) | - | ❌ Missing | Remove if not Free |
| 859.1 | `reacts-qsr.test.ts` | `canReact when in Wait status` | ✅ Mapped | React from Wait |
| 859.2 | `concealment.test.ts` | `should reveal hidden targets in LOS while waiting` | ✅ Mapped | Double Visibility OR |
| 859.3 | `concealment.test.ts` | `should reveal hidden targets in LOS while waiting` | ✅ Mapped | Reveal Hidden |
| 859.4 | (needs test) | - | ❌ Missing | Delay token interaction |
| 859.5 | `reacts-qsr.test.ts` | `evaluateFocus()` | ✅ Mapped | Focus option |
| 859.6 | `reacts-qsr.test.ts` | `checkREFRequirement with Waiting bonus` | ✅ Mapped | +1 REF for React |

**Coverage:** 6/11 (55%)

---

## Hide Rule (21 clauses)

| Clause | Test File | Test Name | Status | Notes |
|--------|-----------|-----------|--------|-------|
| 846.1 | `concealment.test.ts` | `should not allow hide when exposed to LOS without cover` | ✅ Mapped | 1 AP if LOS+Cover |
| 846.2 | `concealment.test.ts` | `should allow hide when no opposing LOS` | ✅ Mapped | 0 AP if not in LOS |
| 846.3 | (needs test) | - | ❌ Missing | Sneaky X free Hide |
| 847.1 | (needs test) | - | ❌ Missing | Visibility halved |
| 847.2 | (needs test) | - | ❌ Missing | Cohesion halved |
| 847.3 | (needs test) | - | ❌ Missing | Terrain degraded |
| 847.4 | (needs test) | - | ❌ Missing | Full path out of LOS exception |
| 848.1 | `concealment.test.ts` | `should reveal hidden target when exposed` | ✅ Mapped | Lose Hidden on exposure |
| 848.2 | (needs test) | - | ❌ Missing | After reposition |
| 848.3 | (needs test) | - | ❌ Missing | Allow reposition MOV×1" |
| 849.1 | (needs test) | - | ❌ Missing | Lose Hidden at Initiative |
| 849.2 | (needs test) | - | ❌ Missing | Reposition at Initiative |
| 850.1 | (needs test) | - | ❌ Missing | Mutual exposure |
| 850.2 | (needs test) | - | ❌ Missing | Passive reposition first |
| 850.3 | (needs test) | - | ❌ Missing | Active may NOT reposition |
| 851.1 | (needs test) | - | ❌ Missing | Voluntary removal |
| 851.2 | (needs test) | - | ❌ Missing | Must remove when out of Cover |
| 851.3 | (needs test) | - | ❌ Missing | No reposition on forced removal |
| 852.1 | (needs test) | - | ❌ Missing | Visibility×3 rule |
| 852.2 | `concealment.test.ts` | `should not reveal hidden targets outside doubled wait visibility` | ✅ Mapped | Wait models exception |
| 853.1 | `combat.test.ts` | (implicit in Suddenness) | ⚠️ Partial | +1m Suddenness |

**Coverage:** 4/21 (19%)

---

## Close Combat Rule (25 clauses)

| Clause | Test File | Test Name | Status | Notes |
|--------|-----------|-----------|--------|-------|
| CC.1 | `close-combat.test.ts` | `should perform opposed CCA test` | ✅ Mapped | Opposed CCA |
| CC.2 | `close-combat.test.ts` | `attacker wins ties` | ✅ Mapped | Attacker wins ties |
| CC.3 | `combat.test.ts` | `apply situational modifiers` | ✅ Mapped | Modifiers applied |
| CB.1 | `combat.test.ts` | `Charge bonus +1m` | ✅ Mapped | Charge bonus |
| CB.2-CB.6 | (needs tests) | - | ❌ Missing | Charge qualifications |
| MW.1-MW.6 | `combat.test.ts` | `Multiple Weapons bonus` | ⚠️ Partial | Partial coverage |
| SM.1-SM.7 | `combat.test.ts` | `Situational modifiers` | ⚠️ Partial | Partial coverage |
| BA.1-BA.5 | `bonus-actions.test.ts` | `Bonus Actions` | ⚠️ Partial | Partial coverage |

**Coverage:** 8/25 (32%)

---

## Range Combat Rule (21 clauses)

| Clause | Test File | Test Name | Status | Notes |
|--------|-----------|-----------|--------|-------|
| RC.1 | `ranged-combat.test.ts` | `Opposed RCA vs REF` | ✅ Mapped | Opposed Test |
| RC.2 | `ranged-combat.test.ts` | `Attacker wins ties` | ✅ Mapped | Attacker wins |
| RC.3 | `combat.test.ts` | `Apply modifiers` | ✅ Mapped | Modifiers applied |
| SM.1 | `combat.test.ts` | `Point-blank +1m` | ✅ Mapped | Point-blank |
| SM.2-SM.10 | `combat.test.ts` | `Various modifiers` | ⚠️ Partial | Partial coverage |
| FF.1-FF.5 | `friendly-fire.test.ts` | `Friendly Fire resolution` | ✅ Mapped | Full coverage |
| MW.1 | `combat.test.ts` | `Multiple Weapons (Ranged)` | ⚠️ Partial | Partial coverage |
| KO.1 | `kod-attacks.test.ts` | `Attack KO'd model` | ✅ Mapped | Coupe-de-grace |

**Coverage:** 10/21 (48%)

---

## Damage Rule (21 clauses)

| Clause | Test File | Test Name | Status | Notes |
|--------|-----------|-----------|--------|-------|
| DM.1-DM.3 | `combat.test.ts` | `Damage Test resolution` | ✅ Mapped | Full coverage |
| CC.1-CC.3 | `close-combat.test.ts` | `Close Combat Damage` | ✅ Mapped | Full coverage |
| RC.1-RC.3 | `ranged-combat.test.ts` | `Range Combat Damage` | ✅ Mapped | Full coverage |
| AR.1-AR.4 | `combat.test.ts` | `Armor Rating application` | ✅ Mapped | Full coverage |
| KO.1-KO.4 | `kod-rules.test.ts` | `KO'd and Revive` | ✅ Mapped | Full coverage |
| EL.1-EL.5 | `kod-rules.test.ts` | `Elimination conditions` | ⚠️ Partial | EL.4 needs test |

**Coverage:** 19/21 (90%)

---

## Elimination Mission Rule (17 clauses)

| Clause | Test File | Test Name | Status | Notes |
|--------|-----------|-----------|--------|-------|
| PG.1-PG.4 | `mission-scoring.test.ts` | `Game size determination` | ✅ Mapped | Full coverage |
| BF.1-BF.2 | `battlefield.test.ts` | `Terrain placement` | ✅ Mapped | Full coverage |
| DP.1-DP.3 | `deployment-system.test.ts` | `Deployment` | ⚠️ Partial | DP.2 needs test |
| KV.1-KV.6 | `mission-scoring.test.ts` | `VP scoring` | ⚠️ Partial | KV.3, KV.6 need tests |

**Coverage:** 13/17 (76%)

---

## AI Decision Rules (43 clauses)

| Clause | Test File | Test Name | Status | Notes |
|--------|-----------|-----------|--------|-------|
| CA.1-CA.7 | `ai.test.ts` | `Compulsory actions` | ⚠️ Partial | CA.5-CA.7 need tests |
| DT.1-DT.5 | `executor.test.ts` | `Detect actions` | ⚠️ Partial | DT.3, DT.5 need tests |
| FC.1-FC.5 | `reacts-qsr.test.ts` | `Focus evaluation` | ❌ Missing | FC.4-FC.5 missing |
| HD.1-HD.4 | `concealment.test.ts` | `Hide evaluation` | ⚠️ Partial | HD.4 needs test |
| WT.1-WT.7 | `executor.test.ts` | `Wait actions` | ⚠️ Partial | Partial coverage |
| AS.1-AS.6 | `ai.test.ts` | `Attack selection` | ⚠️ Partial | Partial coverage |
| MV.1-MV.5 | `UtilityScorer.R3.test.ts` | `Movement scoring` | ⚠️ Partial | R3 coverage |
| MR.1-MR.5 | `morale.test.ts` | `Morale tests` | ❌ Missing | MR.5 missing |

**Coverage:** 19/43 (44%)

---

## Summary

| Rule | Clauses | Mapped Tests | Coverage | Priority |
|------|---------|--------------|----------|----------|
| **Focus** | 4 | 4 | 100% | P0 |
| **Detect** | 10 | 7 | 70% | P0 |
| **Wait** | 11 | 6 | 55% | P0 |
| **Hide** | 21 | 4 | 19% | P0 |
| **Close Combat** | 25 | 8 | 32% | P0 |
| **Range Combat** | 21 | 10 | 48% | P0 |
| **Damage** | 21 | 19 | 90% | P0 |
| **Elimination** | 17 | 13 | 76% | P0 |
| **AI Decision** | 43 | 19 | 44% | P0 |
| **Total P0** | **173** | **90** | **52%** | - |

---

## Critical Missing Tests

### Priority 1 (AI-Critical Combos)

1. **Focus + Detect Combo** - No test exists
   - Test: Character in Wait, uses Focus instead of React
   - Verify: +1w applied to subsequent Detect Test
   - File: `reacts-qsr.test.ts` or new `focus-detect-combo.test.ts`

2. **Focus + Concentrate + Detect** - No test exists
   - Test: Wait → Focus → Concentrate → Detect
   - Verify: +2w total applied
   - File: Same as above

3. **First Detect FREE prioritization** - No AI decision test
   - Test: AI chooses Detect when enemies Hidden
   - Verify: 0 AP cost, high priority
   - File: `executor.test.ts`

### Priority 2 (Rule Verification)

4. **Wait Maintenance** - 5 clauses need tests
5. **Hide: Visibility×3 rule** - Missing
6. **Hide: Mutual exposure** - Missing
7. **Charge qualifications** - 5 clauses need tests

---

## Next Steps

1. **Create Focus + Detect combo test** (CRITICAL)
2. **Create Focus + Concentrate + Detect test**
3. **Add Wait maintenance tests**
4. **Add Hide: Visibility×3 test**
5. **Add Charge qualification tests**
