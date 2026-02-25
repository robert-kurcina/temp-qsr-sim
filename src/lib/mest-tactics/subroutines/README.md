# Subroutines

This directory contains low-level game subroutines and dice mechanics.

## Files

- **`dice-roller.ts`** - Dice rolling mechanics and success calculation
- **`hit-test.ts`** - Hit test resolution (Close and Ranged)
- **`ranged-hit-test.ts`** - Ranged-specific hit test
- **`damage.ts`** - Damage resolution and wound application
- **`damage-test.ts`** - Damage test subroutine
- **`morale-test.ts`** - Morale test resolution
- **`accuracy-parser.ts`** - Accuracy string parsing
- **`hindrances.ts`** - Hindrance calculation
- **`optimal-range-parser.ts`** - Optimal Range parsing
- **`dice-roller.test.ts`** - Dice roller tests
- **`hit-test.test.ts`** - Hit test tests
- **`damage.test.ts`** - Damage tests
- **`morale-test.test.ts`** - Morale test tests
- **`hindrances.test.ts`** - Hindrance tests
- **`accuracy-parser.test.ts`** - Accuracy parser tests
- **`optimal-range-parser.test.ts`** - OR parser tests

## Dice System

### Dice Types
- **Base (white)** - Standard dice, succeed on 4-6, double on 6
- **Modifier (red)** - Support dice, succeed on 4-6, carry-over on 6
- **Wild (yellow)** - Special dice, succeed on 4-6, triple on 6

### Success Calculation
```typescript
Base die:  1-3 = 0, 4-5 = 1 success, 6 = 2 successes + carry-over
Modifier:  1-3 = 0, 4-5 = 1 success, 6 = 1 success + carry-over
Wild:      1-3 = 0, 4-5 = 1 success, 6 = 3 successes + carry-over
```

### Carry-Over
- Successful carry-over generates one additional die of same type
- Only one carry-over per die roll
- Carry-over dice are rolled in subsequent rounds

## Hit Test

```typescript
interface HitTestResult {
  attackerSuccesses: number;
  defenderSuccesses: number;
  attackerCarryOver?: DiceType;
  defenderCarryOver?: DiceType;
  hit: boolean;
  cascade?: boolean;
}
```

### Resolution
1. Build dice pools for attacker and defender
2. Apply modifiers (traits, terrain, status)
3. Roll dice and count successes
4. Compare: Attacker wins ties (Active model advantage)
5. Cascade on specific conditions

## Damage Test

```typescript
interface DamageTestResult {
  wound: boolean;
  damageValue: number;
  armorIgnored: boolean;
  statusEffects: StatusEffect[];
}
```

### Resolution
1. Attacker rolls STR + weapon Impact
2. Defender rolls FOR + Armor Rating
3. Compare: Attacker wins ties
4. Apply wound if attacker wins
5. Apply status effects (Stun, Delay, etc.)

## Morale Test

```typescript
interface MoraleTestResult {
  passed: boolean;
  fearAdded: number;
  additionalEffects: string[];
}
```

### Resolution
1. Unopposed POW Test
2. Apply modifiers (Leadership, Grit, etc.)
3. Fail = +1 Fear token
4. Critical fail = additional effects

## Usage

```typescript
import { performTest, TestDice } from './subroutines/dice-roller';
import { resolveHitTest } from './subroutines/hit-test';
import { resolveDamageTest } from './subroutines/damage';

// Dice roll
const dice: TestDice = { base: 3, modifier: 1, wild: 1 };
const result = performTest(dice, attributeValue, rolls);

// Hit test
const hitResult = await resolveHitTest({
  attacker,
  defender,
  weapon,
  context,
});

// Damage test
const damageResult = await resolveDamageTest({
  attacker,
  defender,
  damageValue,
  context,
});
```

## Testing Dice

For deterministic testing:

```typescript
import { setRoller, resetRoller } from './subroutines/dice-roller';

// Set fixed rolls
setRoller((count) => [6, 6, 6, 5, 4]);

// Run test...

// Reset to random
resetRoller();
```

## Dependencies

- `core/` - Character, Item, DiceType
- `traits/` - Trait modifiers
