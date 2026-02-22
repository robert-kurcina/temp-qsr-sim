# Combat System

This directory contains the combat resolution subsystem.

## Files

- **`close-combat.ts`** - Close combat attack resolution with trait handling
- **`ranged-combat.ts`** - Ranged combat attack resolution
- **`indirect-ranged-combat.ts`** - Indirect fire resolution (grenades, artillery)
- **`CombatEngine.ts`** - Core combat resolution engine
- **`combat.test.ts`** - Combat engine unit tests

## Combat Flow

### Close Combat
```
1. Determine engagement and valid attackers/defenders
2. Build dice pools (Base, Modifier, Wild)
3. Apply trait modifiers (Parry, Reach, Cleave, etc.)
4. Roll Hit Test (Opposed CCA vs CCA)
5. If hit, roll Damage Test (STR + weapon vs FOR)
6. Apply wounds and status effects
```

### Ranged Combat
```
1. Check LOS and range
2. Build dice pools with range penalties
3. Apply trait modifiers (Archery, Evasive, Detect, etc.)
4. Roll Hit Test (Opposed RCA vs REF)
5. If hit, roll Damage Test
6. Apply wounds and status effects
```

### Indirect Ranged Combat
```
1. Target location (not model)
2. Check for spotter requirements
3. Apply scatter if applicable
4. Resolve as area effect
5. Apply damage to all models in blast radius
```

## Trait Integration

Combat traits are applied through the `combat-traits.ts` registry:

| Trait | Effect |
|-------|--------|
| Cleave X | KO → Elimination, extra wounds |
| Parry X | +Xm Defender Close Combat |
| Reach X | +X MU melee range |
| Charge | +1m Hit, +1 Impact Damage |
| Knife-fighter X | +Xb +X Impact with [Stub] |
| Hafted | -1m Defender penalty |

## Usage

```typescript
import { makeCloseCombatAttack } from './combat/close-combat';
import { Character } from './core/Character';
import { Item } from './core/Item';

const result = await makeCloseCombatAttack({
  attacker,
  defender,
  weapon: attackerWeapon,
  context: testContext,
});
```

## Dependencies

- `core/` - Character, Item models
- `subroutines/` - Hit test, damage test, dice roller
- `traits/` - Trait logic
- `battlefield/` - Engagement, positioning
