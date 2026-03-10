import { describe, expect, it } from 'vitest';

import { classifyInventoryDomain, inferKeywordCategory } from './KeywordConstantInventory';

describe('KeywordConstantInventory helpers', () => {
  it('infers categories from declaration names', () => {
    expect(inferKeywordCategory('defaultVictoryConditionThreshold')).toBe('threshold');
    expect(inferKeywordCategory('isValidationAggregate')).toBe('gate');
    expect(inferKeywordCategory('pressureUrgencyMultiplier')).toBe('multiplier');
  });

  it('classifies domains for guarded AI modules', () => {
    expect(classifyInventoryDomain('scripts/ai-battle/validation/ValidationRunner.ts')).toBe(
      'ai-battle-script'
    );
    expect(classifyInventoryDomain('src/lib/mest-tactics/ai/core/UtilityScorer.ts')).toBe('ai-core');
    expect(classifyInventoryDomain('src/lib/mest-tactics/missions/mission-scoring.ts')).toBe(
      'missions'
    );
  });
});
