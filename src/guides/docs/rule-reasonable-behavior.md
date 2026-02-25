---
title: Reasonable Character Behavior
description: Common sense behavioral rules for weapon throwing and discarding decisions.
---

# Reasonable Character Behavior

These rules capture common sense tactical decisions that characters should make regarding weapon throwing, discarding, and retention. They supplement the core combat rules by adding realistic behavioral constraints.

## Core Principle

**A character will never throw or discard their last weapon unless it is worse than an Improvised weapon.**

This principle ensures characters don't render themselves defenseless through poor tactical choices.

---

## Weapon Hierarchy

For throw/discard decisions, weapons are ranked from **best** to **worst**:

| Tier | Weapon Type | Examples | Throw Priority |
|------|-------------|----------|----------------|
| **1 (Best)** | Primary Melee | Sword, Broad; Axe, Battle; Spear, Medium | **NEVER throw** |
| **2** | Secondary Melee | Dagger; Club; Hand weapons | Keep if no primary |
| **3** | Thrown/Throwable | Javelin; Dagger (Throwable); Spear (Throwable) | Throw if better weapons held |
| **4** | Improvised Melee | Rocks; Chairs; Environmental objects | **Do NOT discard** |
| **5** | Improvised Melee, Large | Large environmental objects | **Do NOT discard** |
| **6 (Worst)** | Unarmed (Natural) | Fists; Natural attacks only | Can discard to grab better |

### Weapon Classifications

| Classification | Description | BP | Traits |
|---------------|-------------|-----|--------|
| **Unarmed** | Natural weapon when no weapons available | 0 | [Stub] |
| **Improvised Melee** | Makeshift melee weapon | 0 | [Stub], [1H] |
| **Improvised Melee, Large** | Large makeshift weapon | 0 | [Stub], [2H] |
| **Improvised Thrown** | Makeshift thrown weapon | 0 | [Stub], [Discard!] |
| **Improvised Thrown, Large** | Large makeshift thrown weapon | 0 | [Stub], [Discard!] |

### Key Rules

1. **Unarmed is a Natural weapon** — It is the result of having no weapons
2. **Unarmed is worse than Improvised** — Zero Impact, minimal damage (STR or STR-1m)
3. **Improvised weapons are NOT discarded** — A character with Improvised Melee will retain it over being Unarmed
4. **Improvised conversion is contextual:**
   - **Improvised Melee** used for throwing → becomes **Improvised Thrown**
   - **Improvised Thrown** used in close combat → becomes **Improvised Melee**
   - **Improvised Melee, Large** ↔ **Improvised Thrown, Large** (same conversion)

### Improvised Weapon Baseline

The baseline for comparison is **Improvised Melee** (0 BP, [Stub], [1H]):

- Any weapon **better than Improvised** should be retained over throwing
- **Unarmed** is worse than Improvised (no Impact, lower damage)
- A character will **NOT discard** Improvised Melee to become Unarmed

---

## Discard Trait Rules

### Understanding Discard Variants

Weapons with **Thrown** or **Throwable** classification effectively use discard mechanics:

| Trait | Effect | When Applied |
|-------|--------|--------------|
| **[Discard]** | Item is discarded after use | Normal throw |
| **[Discard!]** | Item is discarded, cannot be recovered | Forced discard |
| **[Discard+]** | Discard with additional effect | Enhanced discard |

### Key Insight

> **A character throwing a Thrown/Throwable weapon is mechanically equivalent to discarding it.**

Therefore, all throw decisions must follow the same logic as discard decisions.

### Improvised Weapon Throwing

When an Improvised Melee weapon is thrown:
- It becomes **Improvised Thrown**
- It gains **[Discard!]** trait (cannot be recovered)
- It uses STR for OR (Optimal Range)
- After throwing, character is **Unarmed** unless they have other weapons

**Decision:** A character with ONLY an Improvised Melee weapon should NOT throw it unless:
- The target can be **Eliminated** (game-winning throw), OR
- A **better weapon** is available to pick up immediately

---

## Decision Rules

### Rule 1: Last Weapon Retention

**A character will NEVER throw or discard their last weapon unless:**
- The weapon is **Unarmed** (Natural), OR
- The weapon is **Improvised Melee** AND a better weapon is immediately available

**Rationale:** A defenseless character is a dead character. Retain at least one usable weapon.

**Examples:**
| Current Weapon | Better Weapon Available | Throw Decision |
|----------------|------------------------|----------------|
| Unarmed | Sword on ground | **Pick up Sword** (not a throw) |
| Improvised Melee | Sword on ground | **Do NOT throw** (walk and pick up) |
| Improvised Melee | None | **Do NOT throw** (stay armed) |
| Dagger | Sword on ground | **Do NOT throw** (walk and pick up) |
| Dagger (Throwable) | Sword + Shield | **Throw Dagger** (keep Sword) |

### Rule 2: Primary Weapon Priority

**A character will NEVER throw their primary melee weapon while holding a secondary weapon.**

**Examples:**
- ✅ **Valid:** Throw Dagger, keep Sword
- ❌ **Invalid:** Throw Sword, keep Dagger
- ❌ **Invalid:** Throw Sword, keep nothing
- ❌ **Invalid:** Throw Improvised Melee, become Unarmed

**Rationale:** Primary weapons (Swords, Axes, Spears) are more effective in sustained combat than secondary weapons.

### Rule 3: Throwable Decision Matrix

When deciding whether to throw a Thrown/Throwable weapon:

| Current Loadout | Has Target in Range | Throw Decision |
|-----------------|---------------------|----------------|
| Sword + Dagger (Throwable) | Yes | **Throw Dagger** (keep primary) |
| Sword + Spear (Throwable) | Yes | **Throw Spear** (keep primary) |
| Dagger (Throwable) only | Yes | **Do NOT throw** (last weapon) |
| Dagger (Throwable) only | Yes, target can be Eliminated | **Consider throw** (game-winning) |
| Sword + Javelin | Yes | **Throw Javelin** (dedicated thrown weapon) |
| Improvised Melee only | Yes | **Do NOT throw** (becomes Unarmed) |

### Rule 4: Elimination Exception

**A character MAY throw their last weapon IF:**
- The throw has **high probability** of causing the target to be **Removed from Play** (Eliminated or KO'd with follow-up), AND
- **Friendly models** are in position to provide support/cover afterwards, AND
- The tactical situation **warrants the risk** (e.g., stopping a charge, preventing escape)

**This is a high-risk, high-reward decision that should be rare.**

---

## Examples

### Example 1: Sword + Dagger Loadout

**Character:** Veteran with Sword, Broad + Daggers

| Situation | Action | Reasoning |
|-----------|--------|-----------|
| Enemy at 6 MU (in spear range) | **Throw Daggers** | Daggers are Throwable; Sword retained for melee |
| Enemy at 1 MU (base contact) | **Use Sword** | Melee is more effective at close range |
| Only Daggers remaining | **Do NOT throw** | Last weapon must be retained |

### Example 2: Spear Only Loadout

**Character:** Militia with Spear, Medium (has Throwable trait)

| Situation | Action | Reasoning |
|-----------|--------|-----------|
| Enemy at 8 MU, no other weapons | **Do NOT throw** | Spear is last weapon; throwing leaves character Unarmed |
| Enemy at 8 MU, has Shield | **Do NOT throw** | Shield is not a weapon; still leaves character Unarmed |
| Enemy at 1 MU, engaged | **Use Spear in melee** | Reach trait provides advantage; no discard risk |

### Example 3: Multiple Throwables

**Character:** Average with Javelin + Dagger (Throwable) + Club

| Situation | Action | Reasoning |
|-----------|--------|-----------|
| Enemy at 10 MU | **Throw Javelin** | Dedicated thrown weapon; best OR for distance |
| Enemy at 6 MU | **Throw Dagger** OR **Throw Javelin** | Either valid; Javelin preferred (better OR) |
| Enemy at 1 MU | **Use Club or Dagger** | Melee combat; no throwing needed |

### Example 4: Elimination Exception

**Character:** Elite with Dagger (Throwable) only

| Situation | Action | Reasoning |
|-----------|--------|-----------|
| Wounded enemy at 4 MU, 2 allies adjacent | **CONSIDER throw** | High chance of Elimination; allies can protect |
| Fresh enemy at 4 MU, no allies nearby | **Do NOT throw** | Too risky; character left Unarmed |
| Enemy charging, will reach next turn | **CONSIDER throw** | May stop charge; better than certain melee |

### Example 5: Improvised Weapon Scenario

**Character:** Untrained picks up Chair (Improvised Melee)

| Situation | Action | Reasoning |
|-----------|--------|-----------|
| Enemy at 5 MU, no other weapons | **Do NOT throw** | Becomes Improvised Thrown [Discard!]; character becomes Unarmed |
| Enemy at 1 MU | **Use Chair in melee** | Better than Unarmed; [Stub] trait applies |
| Sword on ground nearby | **Move and pick up Sword** | Upgrade from Improvised; no throw needed |

---

## AI Implementation Guidelines

### Weapon Evaluation Function

```typescript
function shouldThrowWeapon(character: Character, weapon: Item): boolean {
  const weapons = character.profile.items?.filter(isWeapon) || [];
  
  // Rule 1: Never throw last weapon unless it's Unarmed or Improvised with upgrade available
  if (weapons.length === 1) {
    if (isUnarmed(weapon)) {
      return false; // Can't throw Unarmed
    }
    if (isImprovised(weapon)) {
      const hasBetterNearby = hasBetterWeaponNearby(character);
      return hasBetterNearby; // Only if can pick up better immediately
    }
    return false; // Never throw last real weapon
  }
  
  // Rule 2: Never throw primary if secondary exists
  const isPrimary = isPrimaryMeleeWeapon(weapon);
  const hasBetterWeapon = weapons.some(w => 
    !isPrimary && isPrimaryMeleeWeapon(w)
  );
  if (isPrimary && hasBetterWeapon) {
    return false; // Keep the better weapon, throw the other
  }
  
  // Rule 3: Prefer throwing dedicated thrown weapons
  const hasDedicatedThrown = weapons.some(w => 
    w.classification === 'Thrown' && !isMelee(w)
  );
  if (hasDedicatedThrown && !isDedicatedThrown(weapon)) {
    return false; // Throw the dedicated thrown weapon instead
  }
  
  // Rule 4: Check elimination exception
  if (weapons.length === 1 && !isImprovised(weapon)) {
    const canEliminate = calculateEliminationProbability(weapon, target) > 0.8;
    const hasSupport = alliesAdjacent(character) >= 1;
    if (canEliminate && hasSupport) {
      return true; // Exception applies
    }
    return false;
  }
  
  return true; // Default: OK to throw
}
```

### Improvised Weapon Handling

```typescript
function getImprovisedWeaponType(
  weapon: Item, 
  usage: 'melee' | 'thrown'
): Item {
  if (weapon.classification === 'Melee' && weapon.name.includes('Improvised')) {
    if (usage === 'thrown') {
      // Improvised Melee → Improvised Thrown
      return {
        ...weapon,
        classification: 'Thrown',
        traits: ['[Stub]', '[Discard!]'],
        or: 'STR',
      };
    }
  }
  
  if (weapon.classification === 'Thrown' && weapon.name.includes('Improvised')) {
    if (usage === 'melee') {
      // Improvised Thrown → Improvised Melee
      return {
        ...weapon,
        classification: 'Melee',
        traits: ['[Stub]'],
        or: undefined,
      };
    }
  }
  
  return weapon;
}
```

### Priority Ordering

When multiple throwable weapons are available:

1. **Dedicated Thrown weapons** (Javelin, Throwing Axe) - throw first
2. **Throwable Melee weapons** (Spear, Dagger with Throwable) - throw if better weapons held
3. **Primary Melee weapons** (Sword, Axe) - NEVER throw
4. **Improvised Melee** - NEVER discard (better than Unarmed)
5. **Last remaining weapon** - NEVER throw (unless Improvised with upgrade available)
6. **Unarmed** - N/A (cannot throw)

---

## QSR Rule References

- **[Discard] Trait** — Item is discarded after use
- **[Discard!] Trait** — Item is discarded, cannot be recovered
- **Throwable Trait** — Weapon can be thrown using STR for OR
- **Thrown Classification** — Weapon designed for throwing
- **Improvised Weapons** — Makeshift weapons (0 BP, [Stub])
- **Unarmed** — Natural weapon when no weapons available (0 BP, [Stub])

---

## Related Rules

- [Items](./rules-items) — Weapon classifications and traits
- [Traits List](./rules-traits-list) — Complete trait descriptions
- [Performing Close Combat](./rule-close-combat) — Melee combat resolution
- [Performing Direct Range Combat](./rule-direct-range-combat) — Ranged/throwing resolution

---

## Source

Derived from MEST Tactics QSR rules for [Discard], [Discard!], Throwable, Improvised weapons, Unarmed status, and common tactical sense for weapon retention.
