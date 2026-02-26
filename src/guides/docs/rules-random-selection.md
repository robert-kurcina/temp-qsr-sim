---
title: Random Selection & Utility Rules
description: Dice methods for random selection, yes/no checks, and utility dice operations.
priority: 9
---

# Random Selection & Utility Rules

This module covers dice methods for random selection, yes/no checks, and other utility operations used throughout MEST Tactics.

---

## Random Selection Methods

Whenever a player needs to perform a **random selection** against a table or determine a random outcome, use the following dice methods.

### Y/N Check (Yes/No)

**Use:** Binary decisions, trait activation checks, simple success/failure

**Method:**
- Roll **1d6** (any color) or use a **MEST die**
- **4, 5, or 6** = **"Yes"** (pass)
- **1, 2, or 3** = **"No"** (fail)

**Examples:**
- Does the trap activate? Roll 4+ = Yes
- Does the ally arrive? Roll 4+ = Yes
- Is the door locked? Roll 4+ = Yes

---

### D6 (Single Die)

**Use:** Tables with 6 entries, simple random selection

**Method:**
- Roll **1d6**
- Result corresponds to table entry 1-6

**Example Table: Random Encounter**
| d6 | Encounter |
|----|-----------|
| 1 | None |
| 2 | Patrol (1 model) |
| 3 | Patrol (2 models) |
| 4 | Scout |
| 5 | Warrior |
| 6 | Champion |

---

### D66 (Two-Die Percentile)

**Also known as:** R+W, D66

**Use:** Tables with 36 entries (11-66), percentile-style rolls

**Method:**
1. Roll **Red d6** (tens column)
2. Roll **White d6** (ones column)
3. Combine: **Red × 10 + White** = Result (11-66)

**Can be rolled together** (read red first, then white)

**Example Table: Random Terrain Feature**
| D66 | Terrain |
|-----|---------|
| 11-16 | Clear field |
| 21-26 | Light woods |
| 31-36 | Dense forest |
| 41-46 | Rocky outcrop |
| 51-56 | Stream/river |
| 61-66 | Ruins |

**Note:** Entries typically skip the "0" results (no 10, 20, 30, etc.)

---

### D666 (Three-Die Percentile)

**Also known as:** RWY, D666

**Use:** Tables with 216 entries (111-666), complex random generation

**Method:**
1. Roll **Red d6** (hundreds column)
2. Roll **White d6** (tens column)
3. Roll **Yellow d6** (ones column)
4. Combine: **Red × 100 + White × 10 + Yellow** = Result (111-666)

**Can be rolled together** (read red first, white second, yellow third)

**Example Table: Random Mission Generator**
| D666 | Mission Type |
|------|--------------|
| 111-216 | Elimination |
| 221-326 | Convergence |
| 331-436 | Assault |
| 441-546 | Dominion |
| 551-656 | Recovery |
| 661-666 | Special (roll again) |

---

## Random Model Selection

When you need to **randomly select a model** from a group (e.g., for Friendly Fire, random targets, etc.):

### Method 1: Numbering

1. **Number each model** (1, 2, 3, ...)
2. **Roll appropriate dice**:
   - 2-6 models: 1d6 (re-roll if over)
   - 7-12 models: D66 (re-roll if over)
   - 13+ models: D666 (re-roll if over)
3. **Select matching model**

### Method 2: Scatter Die

1. **Place measuring stick** across group
2. **Roll 1d6 for direction**:
   - 1-2: Left end
   - 3-4: Center
   - 5-6: Right end
3. **Roll 1d6 for offset** (0-5 inches from reference point)
4. **Select closest model**

### Method 3: Closest Model

For effects that target "randomly selected model":

**Priority Order:**
1. **In base-contact** with reference point
2. **Within 1"** of reference point
3. **Within 1" of LOF** to reference point

**Tie-breaker:** Roll 1d6 among tied models

---

## Random Direction

When you need to determine a **random direction** (scatter, facing, etc.):

### Clock Method

1. **Imagine clock face** with reference at center
2. **Roll 1d12** (or 2d6 and interpret)
3. **Direction = hour hand position**

| d12 | Direction |
|-----|-----------|
| 12 | North (forward) |
| 3 | East (right) |
| 6 | South (backward) |
| 9 | West (left) |

### Hex Scatter Method

For scatter diagrams (see [[rules-scatter|Rules: Scatter]]):

1. **Roll 1d6**
2. **Direction based on LOF**:

| d6 | Direction |
|----|-----------|
| 1 | Forward (along LOF) |
| 2 | Forward-Right (60°) |
| 3 | Backward-Right (120°) |
| 4 | Backward (180°) |
| 5 | Backward-Left (240°) |
| 6 | Forward-Left (300°) |

---

## Random Table Usage

### Creating Random Tables

**Format:**
```
| D66 | Result | Details |
|-----|--------|---------|
| 11-22 | Common | Basic outcome |
| 33-44 | Uncommon | Better outcome |
| 55-66 | Rare | Best outcome |
```

**Range Guidelines:**
- **Common:** 50-60% of table (18-22 entries on D66)
- **Uncommon:** 30-40% of table (11-14 entries on D66)
- **Rare:** 10-20% of table (3-7 entries on D66)

### Rolling on Tables

**Procedure:**
1. **Identify correct table** for situation
2. **Determine dice method** (D6, D66, D666)
3. **Roll dice** and read result
4. **Apply outcome** immediately
5. **Note any follow-up rolls** required

---

## Special Dice Operations

### Keeping Fractions

When calculations result in **fractions**:

| Operation | Rule | Example |
|-----------|------|---------|
| **Agility** | Keep fractions up to 0.5" | MOV 3 × ½ = 1.5" Agility |
| **Movement** | Round down to nearest 0.5" | 7.7" → 7.5" |
| **Damage** | Round down (minimum 1) | 2.5 → 2 (or 1 if minimum) |
| **Cascades** | Never round (exact difference) | Score 7 vs 4 = 3 cascades |

### Minimum Values

| Value Type | Minimum | Notes |
|------------|---------|-------|
| **OR** | 0.5 MU | If OR is zero, becomes 0.5 MU |
| **Scatter Distance** | 1 MU | Even with 0 misses |
| **AR** | 0 | Cannot be negative |
| **Attribute** | 0 | Cannot go below zero |
| **Cascades on Pass** | 1 | Minimum 1 cascade on any pass |

### Maximum Values

| Value Type | Maximum | Notes |
|------------|---------|-------|
| **ORM** | 3 | Normal maximum OR Multiple |
| **Hands** | 4 | Maximum hands for humanoid |
| **Weapons** | 3 | Maximum weapons per character |
| **Equipment** | 3 | Maximum equipment items |
| **Fear Tokens** | 4 | At 4+, model is Eliminated |

---

## Tie-Breakers

When two or more options are **equally valid**:

### Distance Ties

**Roll 1d6:**
- **Odd (1, 3, 5):** Choose option A (or first option)
- **Even (2, 4, 6):** Choose option B (or second option)

### Initiative Ties

**Per QSR:**
1. **Highest total pips** on dice wins
2. If still tied: **Re-roll with d6** until resolved
3. **Mission Attacker option:** May auto-win ties but receives **zero IP**

### Score Ties

**General Rule:** **Active character always wins ties**

**Exceptions:**
- **Initiative Test:** See above
- **Mission VP ties:** Side with most RP wins
- **Still tied:** Current Initiative holder wins (if optional rule enabled)

---

## Quick Reference

### Dice Methods Summary

| Method | Dice | Range | Use Case |
|--------|------|-------|----------|
| **Y/N** | 1d6 | Yes (4-6) / No (1-3) | Binary checks |
| **D6** | 1d6 | 1-6 | 6-entry tables |
| **D66** | 2d6 (R+W) | 11-66 | 36-entry tables |
| **D666** | 3d6 (R+W+Y) | 111-666 | 216-entry tables |

### Random Selection Priority

```
1. In base-contact with target
2. Within 1" of target
3. Within 1" of LOF to target
```

### Minimum Values

```
OR: 0.5 MU (if zero)
Scatter: 1 MU (minimum)
AR: 0 (cannot be negative)
Cascades on Pass: 1 (minimum)
```

---

## Related Rules

- [[rules-tests-and-checks|Rules: Tests & Checks]] — Dice scoring and resolution
- [[rules-scatter|Rules: Scatter]] — Scatter diagram and direction
- [[rules-initiative|Rules: Initiative]] — Initiative tie-breakers

---

## Source Reference

**Source:** `MEST.Tactics.QSR.txt` lines ~1180-1200 (Random Selection methods)
