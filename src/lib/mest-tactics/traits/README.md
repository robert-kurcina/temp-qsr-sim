# Traits System

This directory contains the trait framework and implementations.

## Files

- **`Trait.ts`** - Base trait interface and types
- **`combat-traits.ts`** - Combat trait implementations (43 traits)
- **`item-traits.ts`** - Item trait implementations
- **`trait-parser.ts`** - Trait string parsing
- **`trait-utils.ts`** - Trait utility functions
- **`trait-logic-registry.ts`** - Trait logic registration and lookup
- **`attribute-modifier.ts`** - Attribute modification from traits
- **`Trait.test.ts`** - Trait tests
- **`trait-parser.test.ts`** - Parser tests
- **`trait-logic-registry.test.ts`** - Registry tests
- **`attribute-modifier.test.ts`** - Modifier tests

## Trait Categories

### Combat Traits (27 Integrated)
| Trait | Effect | Integration |
|-------|--------|-------------|
| Cleave X | KO → Elimination, extra wounds | close-combat.ts |
| Parry X | +Xm Defender CC | close-combat.ts |
| Reach X | +X MU melee range | engagement-manager.ts |
| Charge | +1m Hit, +1 Impact | close-combat.ts |
| Knife-fighter X | +Xb +X Impact [Stub] | close-combat.ts |
| Hafted | -1m Defender | close-combat.ts |
| Awkward | Delay on Charge | close-combat.ts |
| Bash | +1 cascade on Charge | close-combat.ts |
| Fight X | Penalty reduction | combat-actions.ts |
| Brawl X | Bonus on failed hit | combat-actions.ts |
| Perimeter | Attentive engagement | engagement-manager.ts |
| Insane | Morale immunity | morale.ts |
| Coward | +1 Fear on fail | morale.ts |
| Leadership X | +Xb Morale | morale-test.ts |
| Reload X | Weapon tracking | simple-actions.ts |
| Sneaky X | Auto-Hide | combat-actions.ts |
| Sprint X | +X×2" Movement | move-action.ts |
| Leap X | +X" Agility | move-action.ts |
| Surefooted X | Terrain upgrade | move-action.ts |
| Tactics X | +Xb Initiative | GameManager.ts |
| Unarmed | -1m penalties | close-combat.ts |
| Acrobatic X | +X Wild dice CC | close-combat.ts |
| Detect X | +X Max ORM | ranged-combat.ts |
| Evasive X | +Xm per ORM | ranged-combat.ts |
| Impale | -1b vs Distracted | damage-test.ts |
| [Discard] | Usage tracking | simple-actions.ts |
| Stun X | Delay calculation | damage-test.ts |

### Item Traits
- **Melee** - Close combat weapons
- **Ranged** - Ranged weapons (Bow, Crossbow, etc.)
- **Armor** - Protective gear
- **Shield** - Defensive equipment
- **Thrown** - Throw weapons
- **Two-Handed [2H]** - Requires both hands
- **One-Handed [1H]** - Single hand
- **[Stub]** - Poor quality
- **[Laden]** - Burden penalty

### Disability Traits (in brackets)
- **[Stub]** - Poor weapon quality
- **[Blinders]** - Vision restrictions
- **[Coward]** - Fear susceptibility
- **[Laden X]** - Movement burden
- **[1H], [2H]** - Hand requirements
- **[Discard]** - Limited uses
- **[Noise]** - Sound generation

## Trait Format

```
TraitName X > Dependency
```

- **X** = Level (optional, defaults to 1)
- **>** = Dependency arrow
- **Dependency** = Required condition or list

## Usage

```typescript
import { getCharacterTraitLevel } from './traits/trait-utils';
import { applyCombatTrait } from './traits/combat-traits';

// Get trait level
const gritLevel = getCharacterTraitLevel(character, 'Grit');

// Apply trait effect
const modifiedDice = applyCombatTrait('Parry', {
  character,
  target,
  dicePool,
});
```

## Trait Registry

Traits are registered in `trait-logic-registry.ts`:

```typescript
traitRegistry.register('Cleave', {
  name: 'Cleave',
  category: 'Combat',
  apply: (context) => { ... },
});
```

## Dependencies

- `core/` - Character, Item, Trait models
- `subroutines/` - Damage, hit test
- `status/` - Status effects
