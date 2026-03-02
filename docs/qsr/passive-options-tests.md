# QSR Passive Player Options Tests

**Last Updated:** February 26, 2026  
**Source:** `docs/MEST.Tactics.QSR.txt`, `src/lib/mest-tactics/status/passive-options.ts`

This document tracks unit test coverage for all Passive Player Options in MEST Tactics Quick Start Rules.

**Legend:**
- ✅ **DONE** - Unit test exists and passes
- ⏳ **PENDING** - Unit test needed

---

## Passive Player Options

Passive Player Options are available to the Defender (or target) of an Attack or Disengage action. They are marked with () in QSR indicating they are Advanced rules.

**Legend:**
- ✅ **DONE** - Unit test exists and passes
- ⏳ **PENDING** - Unit test needed

---

## Passive Player Options

| Option | Type | Trigger | Effect | Test File | Status |
|--------|------|---------|--------|-----------|--------|
| **Defend!** | Optional Tactic | Any Attack/Disengage | +1 Modifier die Defender Hit Test | `src/lib/mest-tactics/status/passive-options.test.ts` | ✅ DONE |
| **Take Cover!** | Optional Tactic | Range Combat Attack | Gain Cover benefits, -1 MOV | `src/lib/mest-tactics/status/passive-options.test.ts` | ✅ DONE |
| **Opportunity Attack!** | Optional Tactic | Move action within Melee Range | Free Close Combat Attack | `src/lib/mest-tactics/status/passive-options.test.ts` | ✅ DONE |
| **Counter-strike!** | Optional Response | Failed Attacker Hit Test (Close Combat) | Immediate Close Combat Attack | `src/lib/mest-tactics/status/passive-options.test.ts` | ✅ DONE |
| **Counter-fire!** | Optional Response | Failed Attacker Hit Test (Range Combat) | Immediate Range Combat Attack | `src/lib/mest-tactics/status/passive-options.test.ts` | ✅ DONE |
| **Counter-charge!** | Optional Response | Charge attack against this model | Immediate Close Combat Attack | `src/lib/mest-tactics/status/passive-options.test.ts` | ✅ DONE |
| **Counter-action!** | Optional Response | Any Attack/Disengage | Interrupt and perform same action | `src/lib/mest-tactics/status/passive-options.test.ts` | ✅ DONE |

---

## Passive Player Option Rules

### Optional Tactics

These are declared BEFORE the triggering action is resolved.

| Option | Timing | Cost | Effect |
|--------|--------|------|--------|
| **Defend!** | Before Attack/Disengage | AP cost | +1m Defender Hit Test |
| **Take Cover!** | Before Range Attack | AP cost | Gain Cover, -1 MOV |
| **Opportunity Attack!** | Before Move action | AP cost | Free Close Combat Attack |

### Optional Responses

These are declared AFTER the triggering action fails.

| Option | Timing | Trigger | Effect |
|--------|--------|---------|--------|
| **Counter-strike!** | After failed Hit Test | Close Combat | Free Close Combat Attack |
| **Counter-fire!** | After failed Hit Test | Range Combat | Free Range Combat Attack |
| **Counter-charge!** | After failed Hit Test | Charge attack | Free Close Combat Attack |
| **Counter-action!** | After any action | Attack/Disengage | Perform same action back |

---

## Existing Test Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/mest-tactics/status/passive-options.test.ts` | Passive option tests | ✅ 17 tests passing - All 7 options covered |
| `src/lib/mest-tactics/status/passive-options.ts` | Passive option implementation | Implemented |

---

## Test Coverage Summary

### Completed Tests (17 tests)

**Defend!**
- ✅ Defend! offered when defender is Attentive and Ordered before Close Combat
- ✅ Defend! offered when defender is Attentive and Ordered before Range Combat
- ✅ Defend! NOT offered when defender is not Attentive
- ✅ Defend! provides +1m bonus to Defender Hit Test

**Take Cover!**
- ✅ Take Cover! offered when defender is not engaged and REF >= attacker
- ✅ Take Cover! NOT offered when defender REF < attacker REF
- ✅ Take Cover! NOT offered when defender is not Attentive
- ✅ Take Cover! NOT offered for Close Combat attacks

**Opportunity Attack!**
- ✅ Opportunity Attack! defined for MoveConcluded event

**Counter-strike!**
- ✅ Counter-strike! offered when Close Combat Hit Test fails with Counter-strike! trait
- ✅ Counter-strike! NOT offered when defender has no Counter-strike! trait
- ✅ Counter-strike! NOT offered when defender is not Attentive

**Counter-fire!**
- ✅ Counter-fire! offered when Range Combat Hit Test fails with LOS and defender REF >= attacker
- ✅ Counter-fire! NOT offered when defender REF < attacker REF

**Counter-charge!**
- ✅ Counter-charge! offered when enemy moves and defender can engage

**Counter-action!**
- ✅ Counter-action! offered on HitTestFailed with carry-over dice

**Passive Option Costs**
- ✅ Defend! has payload property

---

## Notes

| Option | AP Cost | When Paid |
|--------|---------|-----------|
| Defend! | 1 AP | Before trigger |
| Take Cover! | 1 AP | Before trigger |
| Opportunity Attack! | 1 AP | Before trigger |
| Counter-strike! | 1 AP | After trigger fails |
| Counter-fire! | 1 AP | After trigger fails |
| Counter-charge! | 1 AP | After trigger fails |
| Counter-action! | 1 AP | After trigger fails |

---

## Passive Option Availability

| Option | Attentive | Ordered | Free | Engaged | Hidden |
|--------|-----------|---------|------|---------|--------|
| Defend! | ✅ | ✅ | ✅ | ✅ | ❌ |
| Take Cover! | ✅ | ✅ | ✅ | ❌ | ❌ |
| Opportunity Attack! | ✅ | ✅ | ✅ | ❌ | ❌ |
| Counter-strike! | ✅ | ✅ | ✅ | ✅ | ❌ |
| Counter-fire! | ✅ | ✅ | ✅ | ❌ | ❌ |
| Counter-charge! | ✅ | ✅ | ✅ | ❌ | ❌ |
| Counter-action! | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## Notes

1. Passive Player Options are marked with () in QSR indicating Advanced rules.
2. Optional Tactics are declared BEFORE the triggering action.
3. Optional Responses are declared AFTER the triggering action fails.
4. All Passive Options require the character to be Attentive and Ordered.
5. Hidden characters cannot use Passive Options.
6. Some options require specific positioning (Engaged, Melee Range, etc.).
7. AP cost is paid when the option is used (before or after trigger).
8. Only ONE Passive Option may be used per triggering action.
