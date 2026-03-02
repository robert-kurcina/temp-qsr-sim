# QSR Bonus Action Tests

**Last Updated:** February 26, 2026
**Source:** `docs/MEST.Tactics.QSR.txt`, `src/guides/docs/rules-bonus-actions.md`

This document tracks unit test coverage for all Bonus Actions in MEST Tactics Quick Start Rules.

**See also:** [[rules-bonus-actions|Rules: Bonus Actions & Passive Player Options]] — Complete rules documentation.

**Legend:**
- ✅ **DONE** - Unit test exists and passes
- ⏳ **PENDING** - Unit test needed

---

## Bonus Actions

Bonus Actions are awarded after a successful Hit Test or Damage Test. The Active character may choose one Bonus Action to perform.

**Bonus Assignment Rules:**
- During the current Initiative, an Active character is given a **single Bonus Action** after a successful Disengage Test or Combat Test (before applying Damage)
- The model **spends cascades** to pay for the Bonus Action (doesn't affect cascades for Damage)
- If **Distracted**, receive **one less cascade** for Bonus Actions
- If the Bonus Action causes the Active character to **no longer have the target within Melee Range**, **do not perform the Damage Test**
- The Active character performs **any Bonus Action before removing** their KO'd or Eliminated target

### Additional Clauses

| Symbol | Name | Affected Actions | Rule |
|--------|------|------------------|------|
| **◆** | Diamond-Star | Circle, Push-back, Pull-back, Reversal | +1 cascade unless in base-contact |
| **➔** | Arrow | Push-back, Pull-back | +1 cascade per Physicality difference |
| **✷** | Starburst | Circle, Reversal | +1 cascade if Engaged→Free |

**Physicality** = Higher of **STR** or **SIZ**

| Bonus Action | Trigger | Base Cost | Effect | Clause | Test File | Status |
|--------------|---------|-----------|--------|--------|-----------|--------|
| **Circle** | Successful Hit Test | 1 cascade | Reposition around target while maintaining engagement. | ◆✷ | `src/lib/mest-tactics/actions/bonus-actions.test.ts` | ✅ DONE |
| **Disengage** | Successful Hit Test | 1 cascade | Automatically succeed Disengage Test and move MOV × 1". | — | `src/lib/mest-tactics/actions/bonus-actions.test.ts` | ✅ DONE |
| **Hide** | Successful Hit Test | 1 cascade | Become Hidden if behind Cover. | — | `src/lib/mest-tactics/actions/bonus-actions.test.ts` | ✅ DONE |
| **Push-back** | Successful Hit Test | 1 cascade | Reposition target 1" directly away. +1" per 2 additional cascades. | ◆➔ | `src/lib/mest-tactics/actions/bonus-actions.test.ts` | ✅ DONE |
| **Pull-back** | Successful Hit Test | 1 cascade | After attack resolves, reposition self 1" directly away from target. | ➔ | `src/lib/mest-tactics/actions/bonus-actions.test.ts` | ✅ DONE |
| **Reversal** | Successful Hit Test | 1 cascade | Switch positions with target, maintaining separation distance. | ◆✷ | `src/lib/mest-tactics/actions/bonus-actions.test.ts` | ✅ DONE |
| **Reposition** | Successful Hit Test | 1 cascade | Reposition up to MOV × 1" to any valid location. | — | `src/lib/mest-tactics/actions/bonus-actions.test.ts` | ✅ DONE |
| **Refresh** | Successful Hit Test | 1 cascade | Remove Wait status or reduce Delay tokens by 1. | — | `src/lib/mest-tactics/actions/bonus-actions.test.ts` | ✅ DONE |

**Note:** Base cost is **1 cascade** for all Bonus Actions. **Additional Clauses** may add to this cost.

---

## Test Coverage Summary

**Test File:** `src/lib/mest-tactics/actions/bonus-actions.test.ts`

| Test Category | Tests | Status |
|---------------|-------|--------|
| Budget Computation | 5 | ✅ 5 passing |
| Hide Action | 2 | ✅ 2 passing |
| Refresh Action | 2 | ✅ 2 passing |
| Reposition Action | 2 | ✅ 2 passing |
| Circle Action | 2 | ✅ 2 passing |
| Disengage Action | 2 | ✅ 2 passing |
| Push-back Action | 5 | ✅ 5 passing |
| Pull-back Action | 3 | ✅ 3 passing |
| Reversal Action | 2 | ✅ 2 passing |
| Trait Interactions | 3 | ✅ 3 passing |
| **Total** | **28** | ✅ **28 passing** |

### Clause Coverage

| Clause | Tests | Status |
|--------|-------|--------|
| ◆ Diamond-Star | Tested via Circle, Push-back, Pull-back, Reversal | ✅ Covered |
| ➔ Arrow | Tested via Push-back, Pull-back (Physicality difference) | ✅ Covered |
| ✷ Starburst | Tested via Circle, Reversal | ✅ Covered |

### Trait Interaction Coverage

| Trait | Tests | Status |
|-------|-------|--------|
| Brawl | +1 cascade for Close Combat | ✅ Covered |
| Fight | Extra maxActions when Fight > opponent | ✅ Covered |
| [Blinders] | Cascades reduced to 0 when not Attentive | ✅ Covered |

## Bonus Action Rules

### Eligibility

1. **Awarded On:** Successful Hit Test OR successful Damage Test
2. **One Per Attack:** Only one Bonus Action may be chosen per attack
3. **Physicality Cost:** Some Bonus Actions require minimum Physicality
4. **Engagement:** Some Bonus Actions require being Engaged (base-contact)

### Additional Cascade Costs

| Clause | Symbol | Affected Actions | Additional Cost |
|--------|--------|------------------|-----------------|
| **Diamond-Star** | ◆ | Circle, Push-back, Pull-back, Reversal | +1 cascade unless in base-contact |
| **Arrow** | ➔ | Push-back, Pull-back | +1 cascade per Physicality difference (if Attacker < Target) |
| **Starburst** | ✷ | Circle, Reversal | +1 cascade if Engaged→Free |

### Physicality Requirements

**Physicality** = Higher of **STR** or **SIZ**

| Situation | Rule |
|-----------|------|
| **Attacker Physicality < Target's** | Requires **+1 cascade per point of difference** (Arrow Clause) |
| **Attacker Physicality > Target's SIZ** (Pull-back only) | Spend **target's SIZ cascades** per **additional base-diameter** |
| **Not enough cascades** | Bonus Action **may not be used** |

---

## Existing Test Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/mest-tactics/actions/bonus-actions.test.ts` | Bonus action tests | ⏳ PENDING - needs expansion |

---

## Test Coverage Needed

### Circle (◆✷)
- [ ] Basic Circle repositioning
- [ ] Circle while Engaged
- [ ] Circle with terrain obstacles
- [ ] Circle maintains engagement
- [ ] Diamond-Star clause: +1 cascade unless in base-contact
- [ ] Starburst clause: +1 cascade if Engaged→Free

### Disengage
- [ ] Automatic Disengage success
- [ ] Disengage movement distance
- [ ] Disengage with multiple enemies
- [ ] Disengage vs Outnumbered

### Hide
- [ ] Hide behind Cover
- [ ] Hide fails without Cover
- [ ] Hidden status applied
- [ ] Hidden LOS restrictions

### Push-back (◆➔)
- [ ] Basic Push-back 1"
- [ ] Push-back with extra cascades
- [ ] Push-back into terrain/wall
- [ ] Push-back into another model
- [ ] Push-back Delay token on collision
- [ ] Diamond-Star clause: +1 cascade unless in base-contact
- [ ] Arrow clause: +1 cascade per Physicality difference

### Pull-back (➔)
- [ ] Basic Pull-back 1"
- [ ] Pull-back timing (after attack)
- [ ] Pull-back maintains LOS
- [ ] Pull-back into Cover
- [ ] Arrow clause: +1 cascade per Physicality difference

### Reversal (◆✷)
- [ ] Basic position swap
- [ ] Reversal maintains distance
- [ ] Reversal with terrain
- [ ] Reversal with multiple enemies
- [ ] Diamond-Star clause: +1 cascade unless in base-contact
- [ ] Starburst clause: +1 cascade if Engaged→Free

### Reposition
- [ ] Basic Reposition MOV × 1"
- [ ] Reposition to Cover
- [ ] Reposition out of engagement
- [ ] Reposition line of sight

### Refresh
- [ ] Refresh removes Wait status
- [ ] Refresh reduces Delay tokens
- [ ] Refresh cannot reduce below 0
- [ ] Refresh when not Waiting

### Additional Clauses
- [ ] Diamond-Star clause enforcement (Circle, Push-back, Pull-back, Reversal)
- [ ] Arrow clause enforcement (Push-back, Pull-back)
- [ ] Starburst clause enforcement (Circle, Reversal)
- [ ] Physicality calculation (higher of STR or SIZ)
- [ ] Not enough cascades - Bonus Action denied

---

## Notes

1. Bonus Actions are marked with () in QSR indicating they are Intermediate rules.
2. Bonus Actions use cascades from the triggering test.
3. **Physicality** = higher of STR or SIZ.
4. Some Bonus Actions may be restricted by terrain or engagement status.
5. Bonus Actions are chosen BEFORE resolving Damage Test (if triggered by Hit Test).
6. **Additional Clauses** add cascade costs based on positioning and Physicality:
   - **Diamond-Star (◆):** +1 cascade unless in base-contact
   - **Arrow (➔):** +1 cascade per Physicality difference (if Attacker < Target)
   - **Starburst (✷):** +1 cascade if Engaged→Free
7. If there are **not enough cascades** to pay the total cost, the Bonus Action **may not be used**.

---

## Source Reference

**Source:** `MEST.Tactics.QSR.txt` lines ~1050-1150 (Bonus Actions)

**Related Documentation:**
- [[rules-bonus-actions|Rules: Bonus Actions & Passive Player Options]] — Complete rules with Additional Clauses
- [[rules-actions|Rules: Actions]] — Action types and AP costs
- [[rules-combat|Rules: Combat]] — Combat resolution and cascades
