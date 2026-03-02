# Items System Analysis

## QSR Rules Summary

According to MEST.Tactics.QSR.txt:

### Items Categories (Line 255)
**Items** = Weapons + Armors + Equipment

### Weapons (Lines 273-337)
**Classifications:**
- **Melee** - Close combat weapons (Swords, Axes, Spears, etc.)
- **Natural** - Innate weapons (Claws, Bite, etc.)
- **Bow** - Bows and crossbows
- **Thrown** - Throwables (Javelins, Daggers with Throwable)
- **Firearm** - Guns (not in QSR)
- **Range** - General ranged weapons
- **Support** - Support weapons

### Armors (Lines 338-382)
**Types (one of each allowed per character):**
- **Suit** - Full body armor (Light, Medium, Heavy)
- **Helm** - Head protection
- **Shield** - Hand-held protection (Small, Medium, Large, Tower)
- **Gear** - Small bits (bracers, padding, etc.)

**All armor items are in `src/data/armors.json`** and have classification `"Armor"` with types `"Suit"`, `"Helm"`, `"Shield"`, or `"Gear"`.

### Equipment (Lines 383+)
**All equipment items are in `src/data/equipment.json`** and have classification `"Misc"` with various types:

| Type | Examples |
|------|----------|
| **Accessory** | Amulets, rings, belts, collars |
| **Advantage** | Documents, agenda items |
| **Attachment** | Weapon attachments, arcanum attachments |
| **Device** | Comm-links, sensors, communicators |
| **Tool** | Grav belts, arcanums, codexes, automedics |
| **Upgrade** | Ammo types, ammo belts, arcanum attachments |
| **Munitions** | Ammunition (also classified as Upgrade) |

**Note:** The QSR mentions that Equipment with class "Helm", "Gear", or "Suit" **counts as armor** of that type. However, in the current data implementation:
- All armor items are in `armors.json` with `class: "Armor - [Type]"`
- All equipment items are in `equipment.json` with `class: "Misc - [Type]"`
- Equipment does **not** have Armor classification in the current data

This means the QSR rule about "Equipment that is Helm/Gear/Suit counts as armor" is **not currently implemented** in the data files. All armor is strictly in `armors.json`.

---

## Current Implementation Status

### ✅ What's Working

1. **Item Interface** (`src/lib/mest-tactics/core/Item.ts`)
   - Has `classification` and `type` fields
   - Properly structured for all item categories

2. **Data Files** (`src/data/`)
   - `melee_weapons.json` - classification: "Melee"
   - `bow_weapons.json` - classification: "Bow"
   - `ranged_weapons.json` - classification: "Firearm", "Range"
   - `thrown_weapons.json` - classification: "Thrown"
   - `support_weapons.json` - classification: "Support"
   - `armors.json` - classification: "Armor", type: "Suit/Helm/Shield/Gear"
   - `equipment.json` - classification: "Misc", type: "Tool/Device/Accessory/Upgrade/Advantage"
   - `item_classifications.json` - Master mapping

3. **Profile Structure** (`src/lib/mest-tactics/core/Profile.ts`)
   ```typescript
   items?: Item[];           // All items
   equipment?: Item[];       // Should be equipment items (currently same as items)
   inHandItems?: Item[];     // Currently wielded
   stowedItems?: Item[];     // Stored items
   adjustedItemCosts?: {
       meleeBp: number[],    // Melee weapon costs
       rangedBp: number[],   // Ranged weapon costs
       equipmentBp: number[] // Equipment costs
   }
   totalAR?: number;         // Total Armor Rating
   totalDeflect?: number;    // Total Deflect
   ```

4. **Profile Generator** (`src/lib/mest-tactics/utils/profile-generator.ts`)
   - Correctly categorizes items by classification
   - Tracks melee vs ranged BP separately
   - Enforces armor type limits (one Suit, one Helm, one Shield, one Gear)
   - Calculates totalAR and totalDeflect from traits

5. **AI Weapon Selection** (`src/lib/mest-tactics/ai/executor/AIActionExecutor.ts`)
   - `findMeleeWeapon()` - searches for Melee/Natural classification
   - `findRangedWeapon()` - searches for Bow/Thrown/Firearm/Range classification

### ⚠️ Issues Identified

1. **Equipment BP Tracking**
   - Code checks `dataKey === 'equipment'` but the variable is `equipmentItems` (for hand tracking)
   - `equipmentCount` is incremented but never used for validation in the same way as weapons

2. **Profile.equipment Not Properly Filtered**
   - `buildProfile()` sets `profile.equipment = profile.items` only if not already set
   - But `equipment` should be a filtered subset (only Misc classification items)

3. **AI Doesn't Use Armor/Equipment Benefits**
   - AI only looks for weapons
   - No logic for armor benefits (AR, Deflect)
   - No logic for equipment usage (Flight, Heal, Radio, etc.)

4. **Shield Classification in BP Calculation**
   - Shields are in `armors.json` with classification "Armor"
   - Code checks `item.class.includes('Shield')` to identify shields
   - This works but is string-based rather than type-based

---

## Data File Classification Reference (CORRECTED)

| File | Classification | Type Examples | Notes |
|------|---------------|---------------|-------|
| `melee_weapons.json` | `"Melee"`, `"Natural"` | `"Melee"`, `"Energy"`, `"Magic"` | Weapons for close combat |
| `bow_weapons.json` | `"Bow"` | (none) | Bows and crossbows |
| `ranged_weapons.json` | `"Firearm"`, `"Range"` | `"Modern"`, `"Archaic"`, `"Energy"`, `"Magic"`, `"Futuristic"` | Ranged weapons |
| `thrown_weapons.json` | `"Thrown"` | (none) | Throwables |
| `support_weapons.json` | `"Support"` | `"Archaic"`, `"Modern"`, `"Energy"`, `"Futuristic"` | Support weapons |
| `grenade_weapons.json` | `"Thrown (Grenade)"` | `"Grenade"` | Grenades (classified as Equipment in mapping) |
| `armors.json` | `"Armor"` | `"Suit"`, `"Helm"`, `"Shield"`, `"Gear"` | **All armor items** - one of each type allowed |
| `equipment.json` | `"Misc"` | `"Tool"`, `"Device"`, `"Accessory"`, `"Upgrade"`, `"Advantage"` | **All equipment items** - non-armor gear |

---

## QSR Compliance Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| Items categorized as Weapons/Armor/Equipment | ⚠️ Partial | Structure exists but equipment field not filtered |
| Weapons split into Melee/Ranged | ✅ Yes | `adjustedItemCosts.meleeBp/rangedBp` |
| Armor types limited to one each | ✅ Yes | Validation in profile-generator.ts |
| Shields tracked separately | ⚠️ Partial | Identified by string match on 'Shield' in class |
| Equipment tracked separately | ❌ No | `equipment` field just copies `items` |
| AR and Deflect calculated | ✅ Yes | `totalAR`, `totalDeflect` in Profile |
| AI uses item classifications | ⚠️ Partial | Only for weapons, not armor/equipment |
| In-hand vs Stowed tracking | ✅ Yes | `inHandItems`, `stowedItems` exist |

---

## Recommended Fixes

### 1. Fix Equipment Field in Profile

```typescript
// In profile-generator.ts, after loading all items:
const weapons = items.filter(i => 
  i.classification === 'Melee' || 
  i.classification === 'Natural' ||
  i.classification === 'Bow' ||
  i.classification === 'Thrown' ||
  i.classification === 'Firearm' ||
  i.classification === 'Range' ||
  i.classification === 'Support'
);
const armors = items.filter(i => i.classification === 'Armor');
const equipment = items.filter(i => i.classification === 'Misc');

profile.items = items;
profile.weapons = weapons;      // NEW - explicit weapons array
profile.armors = armors;        // NEW - explicit armors array
profile.equipment = equipment;  // FIX - filter to Misc only
```

### 2. Add Helper Methods to Character

```typescript
// In Character.ts
getMeleeWeapons(): Item[] {
  return this.profile.items?.filter(i => 
    i.classification === 'Melee' || i.classification === 'Natural'
  ) || [];
}

getRangedWeapons(): Item[] {
  return this.profile.items?.filter(i => 
    ['Bow', 'Thrown', 'Firearm', 'Range', 'Support'].includes(i.classification)
  ) || [];
}

getArmors(): Item[] {
  return this.profile.items?.filter(i => i.classification === 'Armor') || [];
}

getEquipment(): Item[] {
  return this.profile.items?.filter(i => i.classification === 'Misc') || [];
}

getTotalAR(): number {
  return this.profile.totalAR || 0;
}

getTotalDeflect(): number {
  return this.profile.totalDeflect || 0;
}

getArmorType(type: 'Suit' | 'Helm' | 'Shield' | 'Gear'): Item | undefined {
  return this.getArmors().find(a => a.type === type);
}
```

### 3. Update AI to Use Full Item System

```typescript
// In AIActionExecutor.ts or CharacterAI.ts
private getBestWeapon(
  character: Character, 
  target: Character, 
  distance: number
): Item | null {
  const meleeWeapons = character.getMeleeWeapons();
  const rangedWeapons = character.getRangedWeapons();
  
  // Consider armor penetration (Impact vs AR)
  const targetAR = target.getTotalAR();
  
  // Select weapon with best Impact vs target's AR
  // ...
}

private hasFlightEquipment(character: Character): boolean {
  return character.getEquipment().some(e => 
    e.traits.some(t => t.includes('Flight'))
  );
}
```

---

## Conclusion

The **data structures are correct** and follow QSR rules with these clarifications:

1. **All armor is in `armors.json`** - classification "Armor", types: Suit/Helm/Shield/Gear
2. **All equipment is in `equipment.json`** - classification "Misc", types: Tool/Device/Accessory/Upgrade/Advantage
3. **The QSR rule about "Equipment that is Helm/Gear/Suit counts as armor" is NOT implemented** - all armor is strictly in armors.json

The main issues are:
1. **Profile.equipment** - Not properly filtered to Misc items
2. **AI utilization** - Only weapons are used, armor/equipment benefits ignored
3. **Helper methods** - Character class lacks convenience methods for item queries

The foundation is solid; fixes are mostly in properly filtering Profile fields and adding helper methods.
