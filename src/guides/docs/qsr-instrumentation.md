---
title: QSR Instrumentation System
description: Configurable battle report instrumentation for troubleshooting and analysis.
priority: 8
---

# QSR Instrumentation System

The QSR Instrumentation System provides configurable detail levels for battle reports and action logging. It enables detailed troubleshooting of combat resolution, Wait status handling, Damage application, and AI System behavior.

**See also:** [[rules-ai|AI System]] for AI behavior documentation, [[rules-bonus-actions|Bonus Actions]] for action resolution rules.

---

## Overview

The instrumentation system captures every action, test, dice roll, trait usage, and situational modifier during a battle. You can configure the level of detail from high-level summaries to complete granular logging.

### Use Cases

1. **Combat Troubleshooting** - Verify combat hit tests, damage resolution, and wound application
2. **Wait Status Verification** - Track Wait token assignment, removal, and React opportunities
3. **Damage Application** - Monitor damage tests, armor reduction, and KO/Elimination
4. **AI Behavior Analysis** - Understand AI decision-making and action selection
5. **Trait Interaction** - Verify trait bonuses, penalties, and source tracking
6. **Situational Modifiers** - Confirm modifier application (cover, flank, outnumber, etc.)

---

## Instrumentation Grades

The system provides **6 grades of detail** (0-5):

| Grade | Name | Description | Use Case |
|-------|------|-------------|----------|
| **0** | None | No instrumentation | Production runs, performance testing |
| **1** | Summary | High-level battle summary | Quick overview, result verification |
| **2** | By Action | Actions performed by each model | Action sequence analysis |
| **3** | By Action with Tests | Actions + Test results (pass/fail, cascades) | Combat resolution verification |
| **4** | By Action with Tests and Dice | Actions + Tests + individual dice results | Dice roll verification |
| **5** | Full Detail | Actions + Tests + Dice + Traits by source + Modifiers | Complete troubleshooting |

**Default:** Grade 1 (Summary)

---

## Grade Details

### Grade 0: None

No logging or instrumentation. Maximum performance.

```typescript
configureInstrumentation({ grade: InstrumentationGrade.NONE });
```

**Output:** None

---

### Grade 1: Summary

High-level battle summary with turn outcomes and casualties.

```typescript
configureInstrumentation({ grade: InstrumentationGrade.SUMMARY });
```

**Output Example:**
```
[T1 I1] Militia-1: Move
  Moved from (5,5) to (8,5)
  Outcome: Reached cover

[T1 I2] Veteran-1: Close Combat
  Attacked Militia-1
  Outcome: Hit, 2 Wounds applied
```

**Includes:**
- Turn and initiative number
- Actor name and action type
- Brief description
- Outcome summary

---

### Grade 2: By Action

Detailed action information including AP spent and targets.

```typescript
configureInstrumentation({ grade: InstrumentationGrade.BY_ACTION });
```

**Output Example:**
```
[T1 I1] Militia-1: Move
  Moved from (5,5) to (8,5)
  Outcome: Reached cover
  AP: 2 spent, 0 remaining

[T1 I2] Veteran-1: Close Combat
  Attacked Militia-1
  Outcome: Hit, 2 Wounds applied
  AP: 2 spent, 0 remaining
  Target: Militia-1
```

**Includes:**
- All Grade 1 information
- AP spent and remaining
- Target identification

---

### Grade 3: By Action with Tests

Test results with pass/fail status, scores, and cascades.

```typescript
configureInstrumentation({ grade: InstrumentationGrade.BY_ACTION_WITH_TESTS });
```

**Output Example:**
```
[T1 I2] Veteran-1: Close Combat
  Attacked Militia-1
  Outcome: Hit, 2 Wounds applied
  AP: 2 spent, 0 remaining
  Target: Militia-1
  Tests:
    Close Combat Hit: ✓ PASS (Score: 4, Cascades: 2)
    Close Combat Damage: ✓ PASS (Score: 3, Cascades: 1)
```

**Includes:**
- All Grade 2 information
- Test type and result (PASS/FAIL)
- Test score (successes)
- Cascades generated
- Carry-over dice count

---

### Grade 4: By Action with Tests and Dice Rolls

Individual dice roll results for each test.

```typescript
configureInstrumentation({ grade: InstrumentationGrade.BY_ACTION_WITH_DICE });
```

**Output Example:**
```
[T1 I2] Veteran-1: Close Combat
  Attacked Militia-1
  Outcome: Hit, 2 Wounds applied
  AP: 2 spent, 0 remaining
  Target: Militia-1
  Tests:
    Close Combat Hit: ✓ PASS (Score: 4, Cascades: 2)
    Close Combat Damage: ✓ PASS (Score: 3, Cascades: 1)
  Dice:
    Base: [3, 5, 6] → 2 successes
    Modifier: [4, 6] → 1 success
    Wild: [6] → 1 success, 1 carry-over
```

**Includes:**
- All Grade 3 information
- Dice type (Base, Modifier, Wild)
- Individual die results
- Successes per roll
- Carry-over dice

---

### Grade 5: Full Detail

Complete instrumentation with trait sources and situational modifiers.

```typescript
configureInstrumentation({ 
  grade: InstrumentationGrade.FULL_DETAIL,
  includeTraitSources: true,
  includeSituationalModifiers: true,
  includeAIReasoning: true
});
```

**Output Example:**
```
[T1 I2] Veteran-1: Close Combat
  Attacked Militia-1
  Outcome: Hit, 2 Wounds applied
  AP: 2 spent, 0 remaining
  Target: Militia-1
  Tests:
    Close Combat Hit: ✓ PASS (Score: 4, Cascades: 2)
    Close Combat Damage: ✓ PASS (Score: 3, Cascades: 1)
  Dice:
    Base: [3, 5, 6] → 2 successes
    Modifier: [4, 6] → 1 success
    Wild: [6] → 1 success, 1 carry-over
  Traits:
    Fight 1 (archetype: Veteran) → +1 cascade for Bonus Actions
    [1H] (item: Sword) → One-handed weapon
  Modifiers:
    Charge: +1m (Moved into base-contact)
    Outnumber: +1m (3 vs 1)
    Cover: -1m (Target behind Soft Cover)
  AI Reasoning: Chose Close Combat due to melee weapon and adjacent target
```

**Includes:**
- All Grade 4 information
- **Trait sources:** archetype, item, status, terrain
- **Situational modifiers:** name, value, reason
- **AI reasoning:** decision rationale (if AI-controlled)

---

## Configuration

### Basic Configuration

```typescript
import { 
  configureInstrumentation, 
  InstrumentationGrade 
} from './instrumentation/QSRInstrumentation';

// Set grade only
configureInstrumentation({ 
  grade: InstrumentationGrade.FULL_DETAIL 
});

// Set grade with features
configureInstrumentation({ 
  grade: InstrumentationGrade.FULL_DETAIL,
  includeTraitSources: true,
  includeSituationalModifiers: true,
  includeAIReasoning: true,
  format: 'both'  // 'json' | 'console' | 'both'
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **grade** | `InstrumentationGrade` | `SUMMARY` | Detail level (0-5) |
| **includeTraitSources** | `boolean` | `false` | Include trait source (archetype/item) |
| **includeSituationalModifiers** | `boolean` | `false` | Include situational modifiers |
| **includeAIReasoning** | `boolean` | `false` | Include AI decision reasoning |
| **format** | `'json' \| 'console' \| 'both'` | `'both'` | Output format |

### Quick Grade Selection

```typescript
import { setInstrumentationGrade } from './instrumentation/QSRInstrumentation';

// Quick grade changes
setInstrumentationGrade(0);  // None
setInstrumentationGrade(1);  // Summary (default)
setInstrumentationGrade(2);  // By Action
setInstrumentationGrade(3);  // By Action with Tests
setInstrumentationGrade(4);  // By Action with Tests and Dice
setInstrumentationGrade(5);  // Full Detail
```

---

## Usage Examples

### Example 1: Troubleshooting Combat Resolution

```typescript
// Set to Grade 3 for test results
configureInstrumentation({ 
  grade: InstrumentationGrade.BY_ACTION_WITH_TESTS,
  format: 'console'
});

// Run battle
const result = await runBattle(config);

// Review console output for combat test results
```

**What you'll see:**
- Hit test scores and pass/fail
- Damage test scores
- Cascades generated
- Wounds applied

---

### Example 2: Verifying Wait Status Handling

```typescript
// Set to Grade 4 for dice rolls
configureInstrumentation({ 
  grade: InstrumentationGrade.BY_ACTION_WITH_DICE,
  format: 'both'
});

// Run battle with AI using Wait tactics
const result = await runBattle({
  side1: { doctrine: 'defensive' },
  side2: { doctrine: 'aggressive' }
});

// Check battle log for Wait actions
const waitActions = result.log.actions.filter(
  a => a.actionType === 'Wait'
);
```

**What you'll see:**
- Wait token assignment
- Wait token removal
- React opportunities
- Dice rolls for React tests

---

### Example 3: Analyzing AI Decision-Making

```typescript
// Set to Grade 5 with AI reasoning
configureInstrumentation({ 
  grade: InstrumentationGrade.FULL_DETAIL,
  includeAIReasoning: true,
  format: 'json'
});

// Run battle
const result = await runBattle(config);

// Export full log
const jsonLog = result.log.exportToJSON();
fs.writeFileSync('battle-log.json', jsonLog);
```

**What you'll see:**
- AI action selection reasoning
- Target priority decisions
- Positioning choices
- Risk assessment

---

### Example 4: Trait Interaction Verification

```typescript
// Set to Grade 5 with trait sources
configureInstrumentation({ 
  grade: InstrumentationGrade.FULL_DETAIL,
  includeTraitSources: true,
  format: 'console'
});

// Run battle with trait-heavy characters
const result = await runBattle({
  side1: { 
    characters: ['Elite with Fight', 'Veteran with Leadership'] 
  },
  side2: { 
    characters: ['Average with Brawl', 'Militia'] 
  }
});
```

**What you'll see:**
- Which traits activated
- Trait source (archetype vs item)
- Trait effects applied
- Trait level bonuses

---

### Example 5: Situational Modifier Analysis

```typescript
// Set to Grade 5 with modifiers
configureInstrumentation({ 
  grade: InstrumentationGrade.FULL_DETAIL,
  includeSituationalModifiers: true,
  format: 'console'
});

// Run battle with varied terrain
const result = await runBattle({
  battlefield: {
    terrain: ['cover', 'difficult', 'elevated']
  }
});
```

**What you'll see:**
- Cover modifiers (+1m, +1b)
- Flank/Cornered penalties
- Outnumber bonuses
- Range penalties
- Terrain effects

---

## Battle Log Structure

### JSON Output Structure

```json
{
  "battleId": "battle-2026-02-26-001",
  "config": {
    "grade": 5,
    "includeTraitSources": true,
    "includeSituationalModifiers": true,
    "includeAIReasoning": true,
    "format": "json"
  },
  "startedAt": "2026-02-26T10:00:00.000Z",
  "endedAt": "2026-02-26T10:15:30.000Z",
  "totalTurns": 8,
  "actions": [
    {
      "turn": 1,
      "initiative": 1,
      "actorId": "militia-1",
      "actorName": "Militia-1",
      "actionType": "Close Combat",
      "description": "Attacked Veteran-1",
      "apSpent": 2,
      "apRemaining": 0,
      "targetId": "veteran-1",
      "targetName": "Veteran-1",
      "testResults": [
        {
          "testType": "Close Combat Hit",
          "score": 3,
          "opponentScore": 4,
          "passed": false,
          "cascades": 0,
          "carryOver": 1
        }
      ],
      "diceRolls": [
        {
          "diceType": "Base",
          "rolls": [2, 4, 5],
          "successes": 2,
          "carryOver": 0
        },
        {
          "diceType": "Modifier",
          "rolls": [3],
          "successes": 0,
          "carryOver": 0
        },
        {
          "diceType": "Wild",
          "rolls": [6],
          "successes": 1,
          "carryOver": 1
        }
      ],
      "traitsUsed": [
        {
          "trait": "Brawl",
          "level": 1,
          "sourceType": "archetype",
          "sourceName": "Militia",
          "effect": "+1 cascade"
        }
      ],
      "situationalModifiers": [
        {
          "name": "Engaged",
          "value": "+0m",
          "reason": "In base-contact with target"
        }
      ],
      "outcome": "Missed (Defender passed Counter-strike!)",
      "timestamp": "2026-02-26T10:01:15.000Z"
    }
  ],
  "summary": {
    "totalActions": 156,
    "actionsByType": {
      "Move": 45,
      "Close Combat": 38,
      "Range Combat": 32,
      "Wait": 18,
      "React": 12,
      "Bonus Action": 11
    },
    "totalTests": 98,
    "testsPassed": 67,
    "testsFailed": 31,
    "totalCascades": 234,
    "totalDiceRolled": 1456,
    "traitsUsedCount": 89,
    "waitActions": 18,
    "reactActions": 12,
    "bonusActions": 11,
    "casualties": {
      "side1": 3,
      "side2": 5
    }
  }
}
```

---

## Integration Points

### Battle Report Integration

The instrumentation system integrates with the [[rules-missions|Battle Report]] system:

```typescript
import { generateBattleReport } from './battle-report/BattleReport';
import { getInstrumentationLogger } from './instrumentation/QSRInstrumentation';

// After battle completes
const battleLog = getInstrumentationLogger().endBattle(totalTurns);
const battleReport = generateBattleReport(missionResult);

// Combine for comprehensive report
const comprehensiveReport = {
  ...battleReport,
  instrumentation: battleLog,
};
```

### AI System Integration

AI actions automatically include reasoning when `includeAIReasoning: true`:

```typescript
configureInstrumentation({
  grade: InstrumentationGrade.FULL_DETAIL,
  includeAIReasoning: true
});

// AI actions will include:
// "aiReasoning": "Chose Range Combat due to ranged weapon and optimal range"
```

---

## Performance Considerations

| Grade | Performance Impact | Recommended Use |
|-------|-------------------|-----------------|
| **0** | None | Production, batch processing |
| **1** | Minimal (<1%) | Default, general monitoring |
| **2** | Low (1-2%) | Action analysis |
| **3** | Moderate (3-5%) | Combat troubleshooting |
| **4** | High (5-10%) | Dice verification |
| **5** | Very High (10-20%) | Deep debugging |

**Recommendations:**
- Use Grade 1-2 for routine battles
- Use Grade 3-4 for combat issues
- Use Grade 5 only for specific troubleshooting
- Export to JSON for Grade 4-5 to avoid console overhead

---

## Related Files

- `src/lib/mest-tactics/instrumentation/QSRInstrumentation.ts` - Core implementation
- `src/lib/mest-tactics/battle-report/BattleReport.ts` - Battle report system
- `src/lib/mest-tactics/ai/` - AI System integration

---

## Source Reference

**Implementation:** `src/lib/mest-tactics/instrumentation/QSRInstrumentation.ts`

**Related Documentation:**
- [[rules-ai|AI System]]
- [[rules-bonus-actions|Bonus Actions & Passive Options]]
- [[rules-combat|Combat Resolution]]
- [[rules-status|Status Effects]]
