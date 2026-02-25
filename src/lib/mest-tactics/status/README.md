# Status System

This directory contains status effects and condition management.

## Files

- **`status-system.ts`** - Core status tracking and application
- **`morale.ts`** - Morale test triggers and resolution
- **`concealment.ts`** - Hidden/Revealed status management
- **`compulsory-actions.ts`** - Compulsory action enforcement (Fear, Disorder)
- **`passive-options.ts`** - Passive option handling
- **`bottle-tests.ts`** - Bottle test resolution

## Status Effects

### Delay
- Acquired from failed tests, reactions, certain actions
- Removed at start of activation or via Rally
- Prevents actions while Stunned (2+ Delay)

### Fear
- Acquired from failed Morale tests, terrifying enemies
- 2+ Fear = Disordered
- Disordered models suffer penalties

### Wound
- Track damage on character
- SIZ wounds = KO
- KO + SIZ wounds = Eliminated

### Hidden
- Cannot be targeted until Revealed
- Removed by Detect tests, attacks, entering engagement
- Grants defensive bonuses

### Waiting
- Enables React actions (Standard React, etc.)
- Removed when Reacting or at Turn end
- Costs AP to acquire

### KO (Knocked Out)
- Cannot act, removed from activation order
- Revivable via Rally action
- KO + SIZ wounds = Eliminated

### Eliminated
- Removed from play
- Counts for victory conditions
- Cannot be revived

### Disordered
- 2+ Fear tokens
- Suffers action penalties
- Compulsory actions may apply

### Distracted
- Cannot perform Attack actions
- Suffers defensive penalties
- Cannot be targeted by some effects

## Morale System

```
Trigger: Friendly model KO'd/Eliminated within Visibility
Test: Unopposed POW Test
Fail: +1 Fear token
Critical Fail: Additional effects (Panic, Rout)
```

## Bottle Tests

End-of-turn test to determine if force continues fighting:

```
Calculate: Models Ready / Starting Models
Threshold: < 25% = Automatic fail
           < 50% = Test required
Test: Unopposed INT Test
Fail: Side "Bottled Out" - loses mission
```

## Usage

```typescript
import { applyStatusEffect, removeStatusEffect } from './status/status-system';
import { performMoraleTest } from './status/morale';

// Apply status
applyStatusEffect(character, 'Delay', 2);

// Remove status
removeStatusEffect(character, 'Delay');

// Morale test
const moraleResult = await performMoraleTest({
  character,
  trigger: 'Friendly KO',
  context,
});
```

## Dependencies

- `core/` - Character model
- `subroutines/` - Morale test subroutine
- `battlefield/` - Visibility checks
