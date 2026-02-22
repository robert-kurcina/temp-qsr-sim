# Actions System

This directory contains all game action implementations.

## Files

### Core Actions
- **`Action.ts`** - Base action interface and types
- **`Move.ts`** - Movement action result type
- **`activation.ts`** - Activation state management (Ready, Done, Waiting)
- **`simple-actions.ts`** - Simple actions (Fiddle, Hide, Detect, Rally, etc.)
- **`move-action.ts`** - Movement action with terrain and engagement
- **`disengage-action.ts`** - Disengage test and execution
- **`combat-actions.ts`** - Combat action orchestration
- **`group-actions.ts`** - Group action coordination
- **`combined-action.ts`** - Combined action handling

### Interrupts & Reactions
- **`interrupt-costs.ts`** - Interrupt AP costs and Wait removal
- **`interrupts.test.ts`** - Interrupt system tests
- **`counter-actions.ts`** - Counter Strike, Counter Charge, Counter Fire
- **`react-actions.ts`** - React system (Overwatch, React Actions)

### Special Actions
- **`transfix-action.ts`** - Transfix action resolution
- **`pushing-and-maneuvers.ts`** - Pushing and maneuver tests
- **`option-builders.ts`** - Action option builders
- **`status-cleanup.ts`** - KO and status cleanup
- **`bottle-tests.ts`** - Bottle test resolution

### Testing
- **`disengage.test.ts`** - Disengage action tests
- **`group-actions.test.ts`** - Group action tests
- **`laden.test.ts`** - Laden status tests
- **`transfix.test.ts`** - Transfix action tests
- **`react-actions.test.ts`** - React action tests
- **`pushing-and-maneuvers.test.ts`** - Pushing/maneuver tests

## Action Types

### Complex Actions (2 AP)
- Move (full movement)
- Close Combat Attack
- Ranged Combat Attack
- Disengage

### Simple Actions (1 AP)
- Fiddle (interact with objects)
- Hide (become Hidden)
- Detect (reveal Hidden models)
- Rally (remove Fear/Delay)
- Wait (become Waiting)

### Free Actions (0 AP)
- Drop items
- Speak/communicate
- Go Prone/Stand

### Bonus Actions
- Cascade from failed hits
- Trait-granted bonus actions
- Mission-specific bonuses

## Action Flow

```
1. beginActivation(character)
2. spendAP(character, amount)
3. executeAction(actionType, params)
4. endActivation(character) → Done status
```

## Interrupt System

Actions can be interrupted by opponents with React capabilities:

1. **Counter Strike** - Melee interrupt
2. **Counter Charge** - Charge interrupt
3. **Counter Fire** - Ranged interrupt
4. **Overwatch** - Movement-triggered attack

## Usage

```typescript
import { executeMoveAction } from './actions/move-action';
import { executeDisengageAction } from './actions/disengage-action';

// Move action
const moveResult = await executeMoveAction({
  character,
  battlefield,
  targetPosition,
  context,
});

// Disengage action
const disengageResult = await executeDisengageAction({
  disengager,
  defender,
  defenderWeapon,
  battlefield,
});
```

## Dependencies

- `core/` - Character, Item
- `battlefield/` - Movement validation, engagement
- `subroutines/` - Dice tests, hit tests
- `traits/` - Trait modifiers
- `status/` - Status effects
