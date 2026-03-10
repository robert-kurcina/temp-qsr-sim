import { describe, expect, it } from 'vitest';
import { formatBattlefieldGenerateHelp } from './BattlefieldGenerateHelp';

describe('formatBattlefieldGenerateHelp', () => {
  it('renders required sections and examples', () => {
    const text = formatBattlefieldGenerateHelp({
      title: 'battlefield:generate',
      usageLine: 'npm run battlefield:generate -- [GAME_SIZE ...]',
      examples: ['npm run battlefield:generate -- VERY_SMALL'],
    });

    expect(text).toContain('battlefield:generate');
    expect(text).toContain('Usage:');
    expect(text).toContain('Layer Tokens:');
    expect(text).toContain('Density Rules:');
    expect(text).toContain('Examples:');
    expect(text).toContain('npm run battlefield:generate -- VERY_SMALL');
  });

  it('includes optional notes section when provided', () => {
    const text = formatBattlefieldGenerateHelp({
      title: 'battlefield-generator',
      usageLine: 'node --import tsx scripts/battlefield-generator.ts [GAME_SIZE]',
      notes: ['If multiple game sizes are provided, the first one is used.'],
      examples: ['node --import tsx scripts/battlefield-generator.ts VERY_SMALL'],
    });

    expect(text).toContain('Notes:');
    expect(text).toContain('If multiple game sizes are provided, the first one is used.');
  });
});

