---
title: "Rules: Multiple Weapons"
dependencies:
  - "Rules: Actions"
  - "Rules: Combat"
  - "Rules: Items"
status: "Complete"
---

## Multiple Weapons (△)

Characters benefit from the **Multiple Weapons rule** if their model is sculpted showing multiple weapons **and** the weapons are purchased using BP.

### Qualification

Weapons in each hand must be **all capable of Ranged attacks** (Bow, Thrown, etc.), **or all capable of Melee attacks**.

**Weapon Classification:**
- **Melee weapons** — Close Combat weapons (Swords, Daggers, Spears, etc.)
- **Ranged weapons** — Range Combat weapons (Bows, Thrown weapons, etc.)
- **Throwable Melee weapons** — Count as **Ranged weapons** for Multiple Weapons
- **[Awkward] Ranged weapons** — Count as **Melee weapons** for Multiple Weapons
- **Natural weapons** — Their own sub-classification (Bite, Claws, Gore, etc.)
- **Improvised weapons** — **Do NOT count** for Multiple Weapons rule

### Assessment

Characters should be clearly sculpted with the weapon **"in hand"** unless the weapon has the **Conceal** or **Discrete** traits.

**Count Additional Weapons:**
- Each additional hand armed with a Ranged or Melee weapon
- Each additional pair of claws or fists
- Each additional independent tail
- Each additional independent mouth used for biting

**Examples:**
- **Bears/Tigers** — Have "Claws" and "Bite" as Natural weapons for Melee attacks
- **Dogs (Canids)** — Usually assigned only "Bite" (no Claws despite having four limbs)
- **Humanoid with Sword + Dagger** — Two Melee weapons qualify for Multiple Weapons bonus
- **Humanoid with Bow + Dagger** — Does NOT qualify (mixed Ranged/Melee)

### Benefit

When targeting the **same model**:

| Weapon Type | Bonus |
|-------------|-------|
| **Each additional Ranged weapon** "in hand" | **+1m** Attacker Range Combat Hit Test |
| **Each additional Melee weapon** "in hand" | **+1m** Attacker Close Combat Hit Test |

**Natural Weapons:**
- Characters with multiple Natural weapons (e.g., Bite + Claws) qualify for Multiple Weapons benefit
- Each type counts as an "in hand" weapon
- **NOT subject to Multiple Attack Penalty** (see below)

### Penalty

**Using the same weapon in consecutive Actions** during an Initiative penalizes:
- **−1m** Attacker Combat Tests
- Applies if there are **others of the same classification** already "in hand"

**Example:**
- Character has **two Swords** (both Melee)
- First attack with Sword A: **No penalty**
- Second attack with Sword A (consecutive): **−1m penalty**
- Second attack with Sword B (different weapon): **No penalty**

**Exemptions:**
- **Natural weapons** are **NOT penalized** for attacking more than once in a Turn
- **First attack** of an Initiative never penalized
- **Different weapon classification** never penalized

### Interruptions

A character that is using a specific weapon for an attack which is then **interrupted** (during Reacts or Passive Player Options) **must use that weapon for defense** as well.

**Weapon Declaration:**
- At the start of an Action, if it isn't clear, **both the target and the Attacker must specify which weapon is "in Hand"**
- The choice for weapon used when interrupted affects:
  - **React Actions**
  - **Bonus Actions**
  - **Passive Player Options**

---

## Implementation Notes

### Tracking Multiple Weapons

**Character State:**
```typescript
interface CharacterState {
  weaponsInHand: number[];  // Weapon indices currently "in hand"
  lastWeaponUsed: number | null;  // For consecutive attack penalty
  naturalWeapons: string[];  // Natural weapon types (Bite, Claws, etc.)
}
```

### Multiple Weapons Bonus Calculation

**For Close Combat:**
```typescript
function getMultipleWeaponsBonus(character: Character, isCloseCombat: boolean): number {
  const meleeWeapons = getMeleeWeaponsInHand(character);
  const rangedWeapons = getRangedWeaponsInHand(character);
  
  if (isCloseCombat) {
    // Count Melee weapons (including Natural weapons)
    return Math.max(0, meleeWeapons.length - 1);
  } else {
    // Count Ranged weapons
    return Math.max(0, rangedWeapons.length - 1);
  }
}
```

### Multiple Attack Penalty

**Check if penalty applies:**
```typescript
function getMultipleAttackPenalty(
  character: Character,
  weaponIndex: number
): { penalty: number; isConsecutive: boolean } {
  // Natural weapons are exempt
  if (isNaturalWeapon(character, weaponIndex)) {
    return { penalty: 0, isConsecutive: false };
  }
  
  // Check if same weapon used consecutively
  if (character.state.lastWeaponUsed === weaponIndex) {
    // Check if character has other weapons of same classification
    const hasOtherWeapons = hasOtherWeaponsOfClassification(
      character,
      weaponIndex,
      getWeaponClassification(character, weaponIndex)
    );
    
    if (hasOtherWeapons) {
      return { penalty: 1, isConsecutive: true };
    }
  }
  
  return { penalty: 0, isConsecutive: false };
}
```

### Weapon Classification

**Classify weapon for Multiple Weapons:**
```typescript
function getWeaponClassification(
  character: Character,
  weaponIndex: number
): 'Melee' | 'Ranged' | 'Natural' {
  const weapon = getWeapon(character, weaponIndex);
  
  // Natural weapons
  if (isNaturalWeapon(character, weaponIndex)) {
    return 'Natural';
  }
  
  // [Awkward] Ranged weapons count as Melee
  if (hasTrait(weapon, '[Awkward]')) {
    return 'Melee';
  }
  
  // Melee weapons with Throwable count as Ranged
  if (isMeleeWeapon(weapon) && hasTrait(weapon, 'Throwable')) {
    return 'Ranged';
  }
  
  // Standard classification
  if (hasORValue(weapon)) {
    return 'Ranged';
  }
  
  return 'Melee';
}
```

---

## Related Rules

- [[rules-actions|Rules: Actions]] — Close Combat Attack, Range Combat Attack
- [[rules-combat|Rules: Combat]] — Hit Tests, Damage Tests
- [[rules-items|Rules: Items]] — Weapon classifications, [Awkward], Throwable
- [[rules-traits-list|Rules: Traits List]] — Natural Weapon, Conceal, Discrete
- [[rules-advanced|Rules: Advanced]] — Reacts, Passive Player Options

---

## Quick Reference

| Situation | Bonus/Penalty |
|-----------|---------------|
| **2 Melee weapons** vs same target | **+1m** Close Combat Hit |
| **3 Melee weapons** vs same target | **+2m** Close Combat Hit |
| **2 Ranged weapons** vs same target | **+1m** Range Combat Hit |
| **Same weapon, consecutive attacks** | **−1m** (if others in hand) |
| **Natural weapons, multiple attacks** | **No penalty** |
| **Mixed Melee/Ranged** | **No bonus** |
| **Improvised weapons** | **No bonus** |
