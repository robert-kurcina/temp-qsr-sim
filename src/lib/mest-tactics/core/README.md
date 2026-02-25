# Core Domain Models

This directory contains the fundamental domain models for the MEST Tactics simulator.

## Files

- **`Archetype.ts`** - Character archetype definitions (Untrained, Militia, Average, Veteran, Elite)
- **`Assembly.ts`** - Team assembly structure containing multiple characters
- **`Attributes.ts`** - Character attribute definitions (CCA, RCA, REF, INT, POW, STR, FOR, MOV, SIZ)
- **`Character.ts`** - Character class with state tracking and attribute computation
- **`Item.ts`** - Weapon, armor, and equipment item definitions
- **`Profile.ts`** - Character profile combining archetype with items
- **`Trait.ts`** - Trait definitions and interfaces
- **`types.ts`** - Shared type definitions (`FinalAttributes`, `ArmorState`, `CharacterStatus`, etc.)

## Usage

```typescript
import { Character } from './core/Character';
import { Profile } from './core/Profile';

const profile: Profile = {
  name: 'Veteran Swordsman',
  archetype: 'Veteran',
  attributes: { cca: 3, rca: 3, ref: 3, int: 2, pow: 3, str: 2, for: 2, mov: 2, siz: 3 },
  traits: ['Grit'],
  items: [],
};

const character = new Character(profile);
```

## Relationships

```
Archetype + Items → Profile → Character
                          ↓
                        Assembly (multiple Characters)
```

All core models are designed to be immutable where possible, with state changes tracked through explicit state objects.
