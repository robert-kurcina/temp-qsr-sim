---
title: Game Data System
description: How game data is bundled, structured, and used in MEST Tactics.
---

# Game Data System

## Overview

The MEST Tactics simulator uses a **data-driven architecture** where all game content (archetypes, items, traits, terrain, etc.) is stored in JSON files and compiled into a single TypeScript module at build time.

## Data Flow

```
src/data/*.json  →  scripts/bundle-data.cjs  →  src/lib/data.ts  →  Runtime Code
     ↓                       ↓                        ↓
  Source                  Build                  Generated
  (human-readable)        (processor)            (TypeScript export)
```

## Source Data Files (`src/data/`)

### Item Data Files
These files contain item definitions with a `class` field that is parsed into `classification` and `type`:

| File | Content | Classification Examples |
|------|---------|------------------------|
| `melee_weapons.json` | Melee weapons | `"Melee"`, `"Natural"`, `"Melee - Energy"` |
| `bow_weapons.json` | Bows and crossbows | `"Bow"` |
| `ranged_weapons.json` | Firearms, energy weapons | `"Firearm - Modern"`, `"Range - Magic"` |
| `thrown_weapons.json` | Throwables | `"Thrown"` |
| `support_weapons.json` | Support weapons | `"Support - Archaic"` |
| `grenade_weapons.json` | Grenades | `"Thrown (Grenade)"` |
| `armors.json` | Armor suits, helms, shields, gear | `"Armor - Suit"`, `"Armor - Helm"`, `"Armor - Shield"`, `"Armor - Gear"` |
| `equipment.json` | Non-armor equipment | `"Misc - Tool"`, `"Misc - Accessory"`, `"Munitions"` |

### Other Data Files
- `archetypes.json` - Character templates
- `active_options.json` - Action modifiers
- `game_rules.json` - Core rules
- `terrain_info.json` - Terrain definitions
- `trait_descriptions.json` - Trait keyword definitions
- `missions.json` - Mission definitions

## Build Process (`scripts/bundle-data.cjs`)

The build script performs the following transformations:

### 1. Item Classification Parsing
```javascript
// Input from JSON:
{ "class": "Armor - Suit", ... }

// Output in data.ts:
{
  "class": "Armor - Suit",
  "classification": "Armor",  // Split on ' - '
  "type": "Suit"              // Second part (or same as classification)
}
```

### 2. Trait Trimming
```javascript
// Input: traits: [" [Laden 2]", " Armor 4"]
// Output: traits: ["[Laden 2]", "Armor 4"]
```

### 3. Module Generation
Creates `src/lib/data.ts` with:
```typescript
export const gameData = {
  archetypes: { ... },
  melee_weapons: { ... },
  bow_weapons: { ... },
  // ... all other data files
};
```

## Runtime Usage

### Import Pattern
```typescript
import { gameData } from '../../data';
// or destructured
import { archetypes, melee_weapons, armors } from '../../data';
```

### Item Classification Access
```typescript
const item = gameData.melee_weapons['Sword, Broad'];
console.log(item.classification);  // "Melee"
console.log(item.type);            // "Melee" (same when no ' - ' in class)

const armor = gameData.armors['Armor, Medium'];
console.log(armor.classification); // "Armor"
console.log(armor.type);           // "Suit"
```

### Profile Generator Usage
```typescript
// src/lib/mest-tactics/utils/profile-generator.ts
const itemDataMapping = {
  'Melee': 'melee_weapons',
  'Bow': 'bow_weapons',
  'Armor': 'armors',
  'Equipment': 'equipment',
  // ...
};

// Classification-based lookups
if (item.classification === 'Melee') {
  meleeBp.push(item.bp);
}
if (item.classification === 'Armor' && item.type !== 'Shield') {
  // Track armor types for validation
}
```

### AI Usage
```typescript
// src/lib/mest-tactics/ai/executor/AIActionExecutor.ts
private findMeleeWeapon(character: Character): Item | null {
  const items = character.profile?.items ?? [];
  for (const item of items) {
    const classification = item.classification || item.class || '';
    if (classification.toLowerCase().includes('melee') ||
        classification.toLowerCase().includes('natural')) {
      return item;
    }
  }
  return null;
}
```

## Item Classification Hierarchy

### Weapons (QSR p.273-337)
```
Weapons
├── Melee (swords, axes, spears)
├── Natural (claws, bite)
├── Bow (bows, crossbows)
├── Thrown (javelins, throwable weapons)
├── Firearm (guns - not in QSR)
│   ├── Archaic
│   └── Modern
├── Range (general ranged)
│   ├── Archaic
│   ├── Modern
│   ├── Energy
│   └── Magic
└── Support (heavy weapons)
    ├── Archaic
    ├── Modern
    └── Energy
```

### Armors (QSR p.338-382)
```
Armors (one of each type allowed per character)
├── Suit (Light, Medium, Heavy)
├── Helm
├── Shield (Small, Medium, Large, Tower)
└── Gear (bracers, padding)
```

### Equipment (QSR p.383+)
```
Equipment
├── Accessory
├── Attachment
├── Gear (non-armor)
├── Helm (non-armor)
├── Medicine
├── Munitions
├── Suit (non-armor)
├── Tool
└── Upgrade
```

## Validation Rules

### Profile Generator Enforcements
1. **Armor Type Limit**: One of each armor type (Suit, Helm, Shield, Gear)
2. **Weapon Limit**: Maximum 3 weapons
3. **Hand Limit**: Maximum 4 hands required (1H = 1, 2H = 2)
4. **Equipment Limit**: Maximum 3 equipment items
5. **Burden Limit**: Maximum burden of 2 (totalLaden - adjPhysicality)

### Example Validation
```typescript
// Invalid: Two armor suits
['Armor, Medium', 'Armor, Light'] // ❌ Throws error

// Invalid: Too many hands
['Rifle, Medium, Semi/A', 'Rifle, Medium, Semi/A', 'Rifle, Medium, Semi/A'] 
// 3 × [2H] = 6 hands ❌ Throws error

// Valid: Mixed loadout
['Sword, Broad', 'Shield, Medium', 'Armor, Medium'] 
// 1H + 1H + 0H = 2 hands, one Suit, one Shield ✅
```

## Unit Tests

### Data Bundle Tests
**File**: `scripts/bundle-data.cjs`
- ✅ Validates JSON parsing
- ✅ Verifies classification/type splitting
- ✅ Confirms trait trimming

### Profile Generator Tests
**File**: `src/lib/mest-tactics/utils/profile-generator.test.ts`

Tests cover:
- ✅ Single item profile creation
- ✅ Multiple items with BP calculation
- ✅ Physicality/Durability calculation
- ✅ Brawn trait bonus to physicality
- ✅ Armor type validation (rejects duplicate types)
- ✅ Hand limit validation (max 4 hands)
- ✅ Weapon limit validation (max 3 weapons)
- ✅ In-hand item prioritization (2H weapons first)
- ✅ Stowed item assignment

### Assembly Builder Tests
**File**: `src/lib/mest-tactics/mission/assembly-builder.test.ts`

Tests cover:
- ✅ Profile building from archetypes
- ✅ Item assignment to profiles
- ✅ Assembly creation from profiles
- ✅ BP calculation

### Combat Tests Using Data
- `close-combat.test.ts` (7 tests) - Uses `gameData` for weapon stats
- `ranged-combat.test.ts` (10 tests) - Uses `gameData` for ranged weapons
- `indirect-ranged-combat.test.ts` (10 tests) - Uses `gameData` for indirect weapons
- `friendly-fire.test.ts` (26 tests) - Uses `gameData` for weapon classifications
- `disengage.test.ts` - Uses `gameData` for weapon accuracy
- `hit-test.test.ts` - Uses `gameData` for accuracy modifiers

### AI Tests Using Data
- `strategic.test.ts` (18 tests) - Uses `archetypes`, `melee_weapons`
- `reacts-qsr.test.ts` (11 tests) - Uses item classifications
- `reacts.test.ts` (8 tests) - Uses weapon classifications
- `GOAP.ts` tests - Uses weapon classification for planning
- `executor.test.ts` (12 tests) - Uses weapon finding logic
- `ai-integration.test.ts` (18 tests) - Full AI integration

### Test Coverage Summary

| Module | Test Files | Total Tests | Status |
|--------|-----------|-------------|--------|
| Profile Generator | 1 | 8 | ✅ Pass |
| Assembly Builder | 1 | 5 | ✅ Pass |
| Combat | 6 | 92 | ✅ Pass |
| AI System | 10 | 154 | ✅ Pass |
| **Total** | **18** | **259** | **✅ All Pass** |

## Running Tests

```bash
# Bundle data first (required before tests)
npm run prebuild

# Run all tests
npm test

# Run specific test file
npm test -- src/lib/mest-tactics/utils/profile-generator.test.ts

# Run tests with coverage
npm test -- --coverage
```

## Best Practices

### 1. Always Use `classification` Field
```typescript
// ✅ Correct
if (item.classification === 'Melee') { ... }

// ⚠️ Fallback pattern (for safety)
const classification = item.classification || item.class || '';
```

### 2. Use `type` for Sub-classification
```typescript
// Check for specific armor type
if (item.classification === 'Armor' && item.type === 'Shield') { ... }
```

### 3. Import from `gameData`
```typescript
// ✅ Correct
import { gameData } from '../../data';
const sword = gameData.melee_weapons['Sword, Broad'];

// ❌ Don't import JSON directly
import swordData from '../../../data/melee_weapons.json';
```

### 4. Run Bundle Before Tests
```bash
# Bundle data first
npm run prebuild  # or node scripts/bundle-data.cjs

# Then run tests
npm test
```

## Related Documents

- [Characters & Attributes](./rules-characters-and-attributes) - How archetypes define characters
- [Items](./rules-items) - Item rules and usage
- [Traits](./rules-traits) - Trait system
- [Traits List](./rules-traits-list) - Complete trait reference

## Source References

- **MEST.Tactics.QSR.txt** - Lines 255-386 (Items, Weapons, Armor, Equipment)
- **scripts/bundle-data.cjs** - Build script
- **src/lib/data.ts** - Generated data module
- **src/data/*.json** - Source data files
