# Initiative Rules

This document describes the Initiative system in MEST Tactics, including Initiative Tests, Initiative Points, and activation order.

---

## Overview

**Initiative** determines which Side activates first each Turn and provides a resource (Initiative Points) that players can spend for tactical advantages.

### Key Principle: Initiative Points Belong to SIDES

> ⚠️ **IMPORTANT:** Initiative Points are held by **Players representing Sides**, NOT by individual characters.
>
> - Characters have an **Initiative Score** (used for activation order)
> - **Sides** have **Initiative Points** (spent for tactical abilities)
> - When a Player wins an Initiative Test, the IP awarded belong to their **entire Side**

---

## Start of Turn Sequence

At the start of each Turn, the following sequence occurs:

### 1. Ready Models
- Remove all **Done tokens** from all In-Play characters
- All characters become **Ready**

### 2. Determine Initiative
Each Side performs an **Initiative Test**:

1. **Select Designated Leader**
   - Each Player identifies one **In-Play Ordered character** as their temporary Designated Leader
   - If no characters qualify, that Side's Test Score is **zero**

2. **Perform Initiative Test**
   - Roll as an **Opposed INT Test** between all Sides
   - Apply **Hindrance** Situational Test Modifiers (Wound, Delay, Fear tokens)
   - **Optimized Rule** (Turn 1 only): Side with least BP spent gets **+1 Base die**

3. **Award Initiative Points**
   - **Winner**: Receives IP equal to the **difference** between their Test Score and the lowest Test Score
   - **All other Players**: Receive **1 IP** for each of their Base dice that scored a **carry-over** (rolled 6)
   - **Tie-breaker**: Highest total pips on dice → Re-roll with d6 until resolved
   - **Mission Attacker Option**: May automatically win ties but receives **zero IP**

4. **Determine Initiative Order**
   - Winner decides to **go first** OR **forces another Side to go first**
   - In 3+ Side games: Winner picks which Side goes next, then maintain that order

---

## Initiative Test Details

### Test Resolution

| Step | Action |
|------|--------|
| 1 | Each Side rolls **2 Base dice + INT modifier** |
| 2 | Apply Hindrance penalties (-1m per Wound/Delay/Fear token on Designated Leader) |
| 3 | Compare Test Scores (Attribute + dice successes) |
| 4 | Winner = highest Test Score |
| 5 | Award IP: Winner gets (winner score - lowest score), others get 1 IP per carry-over Base die |

### Situational Awareness (Advanced Rule)

After a Side is reduced to **less than half** its original model count:

- Check if Designated Leader has **half its forces within LOS and Awareness range** (Visibility × 3, or Visibility × 1 if Distracted)
- If **not**, do **not add INT** to the Test Score
- Characters with INT < 0 always add their INT
- **Hidden** characters behind Cover are never counted

---

## Spending Initiative Points

IP can be spent **at any time during a Player's own Round** on these Initiative Abilities:

| Ability | Cost | Effect |
|---------|------|--------|
| **Maintain Initiative** | 1 IP | Do not pass Initiative; activate another Ready model from your Side |
| **Force Initiative** | 1 IP | Pass Initiative to any other Opposing Player (useful in 3+ Side games) |
| **Refresh** | 1 IP | When a model receives its Done token, remove **one Delay token** from it |

### Important Rules

- **Unspent IP are lost** at the end of the Turn
- IP are tracked **per Side**, not per character
- Only the **active Player** can spend their Side's IP during their Round

---

## The Initiative Card (Advanced Rule)

A single **Initiative card** (Joker or Ace from Poker deck) is assigned to the **Mission Attacker** at game start.

### Card Abilities

| Ability | Trigger | Effect |
|---------|---------|--------|
| **Automatic Tie Win** | During Initiative Test | Win ties automatically but receive **zero cascades** |
| **Voluntary Transfer** | Any time | Transfer to Opposing Player to **re-roll any Test** (except Initiative) |
| **Return Penalty** | Card returns to Side that already had it | Cannot voluntarily transfer again; assign **Delay token** to Friendly model |

---

## Activation Order Within a Side

Once a Side wins Initiative and chooses to activate:

1. **Players on the same Side rotate** taking activations each Round
2. Each activated character receives **2 Action Points (AP)**
3. Remove **1 AP per Delay token** before spending on Actions
4. After activation, mark character with **Done token**
5. Initiative passes to next Side in Initiative Order

### Character Initiative Score

Characters have an **Initiative Score** (INT + dice roll) used for:
- Determining **activation order within a Side** when multiple models are Ready
- **Tie-breaking** when multiple characters have equal priority

This is **separate from** Initiative Points, which belong to the Side.

---

## Implementation Notes

### Current Code Status

| Concept | Current Implementation | QSR Compliance |
|---------|----------------------|----------------|
| **Character.initiative** | ✅ Number (Test Score) | ✅ Correct |
| **Character.state.initiativePoints** | ✅ **Removed** | ✅ **Fixed** |
| **Side.initiativePoints** | ✅ `MissionSide.state.initiativePoints` | ✅ **Implemented** |

### Data Model (Corrected)

```typescript
interface MissionSide {
  state: {
    initiativePoints: number;  // ✅ IP held by this Side
    // ... other fields
  };
}

interface Character {
  initiative: number;  // ✅ Test Score for activation order
  // ✅ NO initiativePoints field (removed)
}
```

### Required Changes (Completed)

1. ✅ **Removed** `initiativePoints` from `Character.state`
2. ✅ **Added** `initiativePoints: number` to `MissionSide.state`
3. ✅ **Updated** `GameManager.rollInitiative()` to award IP to Sides
4. ✅ **Updated** IP spending logic to use Side-level pool (`spendInitiativePoints`, `awardInitiativePoints`)
5. ✅ **Updated** `GameManager.startTurn()` to accept sides parameter
6. ✅ **Updated** `GameManager.forceInitiative()` to spend from Side IP pool
7. ✅ **Added** `GameManager.refresh()` for Refresh action (spend 1 IP to remove Delay)
8. ✅ **Added** helper functions in `MissionSide.ts`:
   - `awardInitiativePoints(side, amount)`
   - `getInitiativePoints(side)`
   - `spendInitiativePoints(side, amount)`
   - `clearInitiativePoints(side)` - Reset at End of Turn
   - `maintainInitiative(side)` - Spend 1 IP to activate another model
   - `forceInitiative(side)` - Spend 1 IP to pass Initiative to another Side
   - `refreshInitiative(side)` - Spend 1 IP to remove Delay token

---

## Summary

| Concept | Who Has It | Purpose |
|---------|------------|---------|
| **Initiative Test Score** | Character (temporary) | Determines activation order |
| **Initiative Points (IP)** | **Side / Player** | Spendable resource for tactical abilities |
| **Initiative Card** | Mission Attacker (transferable) | Advanced rule for tie-breaking and re-rolls |
| **Initiative Order** | Side-level | Sequence of Side activations per Turn |

---

## References

- QSR "Start of Turn" section: Initiative Tests and Initiative Points
- QSR "Spending Initiative Points" section: IP abilities (Maintain, Force, Refresh)
- QSR "The Initiative Card" section: Advanced rule for tie-breaking
- QSR "Game Play Sequence" summary: Turn structure
- `rules-actions.md`: Action Points and activation
- `MissionSide.ts`: Side state management (initiativePoints field)
