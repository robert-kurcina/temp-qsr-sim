import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_GAME_LOOP_CONFIG } from './AIGameLoopTypes';

describe('AIGameLoopTypes', () => {
  it('exposes stable default game-loop config values', () => {
    expect(DEFAULT_AI_GAME_LOOP_CONFIG.enableStrategic).toBe(true);
    expect(DEFAULT_AI_GAME_LOOP_CONFIG.enableTactical).toBe(true);
    expect(DEFAULT_AI_GAME_LOOP_CONFIG.enableCharacterAI).toBe(true);
    expect(DEFAULT_AI_GAME_LOOP_CONFIG.enableValidation).toBe(true);
    expect(DEFAULT_AI_GAME_LOOP_CONFIG.enableReplanning).toBe(true);
    expect(DEFAULT_AI_GAME_LOOP_CONFIG.maxActionsPerTurn).toBe(3);
    expect(DEFAULT_AI_GAME_LOOP_CONFIG.allowKOdAttacks).toBe(false);
    expect(DEFAULT_AI_GAME_LOOP_CONFIG.visibilityOrMu).toBe(16);
    expect(DEFAULT_AI_GAME_LOOP_CONFIG.maxOrm).toBe(3);
    expect(DEFAULT_AI_GAME_LOOP_CONFIG.allowWaitAction).toBe(true);
    expect(DEFAULT_AI_GAME_LOOP_CONFIG.allowHideAction).toBe(true);
  });
});
