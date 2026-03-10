import { describe, expect, it } from 'vitest';
import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameConfig } from '../AIBattleConfig';
import { createAiControllersForRunner } from './AIControllerSetup';

describe('AIControllerSetup', () => {
  it('creates per-character AI controllers with side and game config values', () => {
    const config: GameConfig = {
      missionId: 'QAI_11',
      missionName: 'Elimination',
      gameSize: GameSize.VERY_SMALL,
      battlefieldWidth: 18,
      battlefieldHeight: 24,
      maxTurns: 6,
      endGameTurn: 4,
      sides: [
        {
          name: 'Alpha',
          bp: 100,
          modelCount: 1,
          tacticalDoctrine: TacticalDoctrine.Aggressive,
          assemblyName: 'Alpha Assembly',
          aggression: 0.7,
          caution: 0.2,
        },
      ],
      densityRatio: 0,
      lighting: 'Day, Clear' as any,
      visibilityOrMu: 16,
      maxOrm: 3,
      allowConcentrateRangeExtension: true,
      perCharacterFovLos: true,
      allowWaitAction: false,
      allowHideAction: false,
      verbose: false,
    };
    const alpha = { id: 'alpha-1' } as Character;

    const controllers = createAiControllersForRunner(config, [{ characters: [alpha] }]);

    expect(controllers.size).toBe(1);
    const controller = controllers.get('alpha-1');
    expect(controller).toBeDefined();
    const appliedConfig = controller!.getConfig();
    expect(appliedConfig.aggression).toBe(0.7);
    expect(appliedConfig.caution).toBe(0.2);
    expect(appliedConfig.allowWaitAction).toBe(false);
    expect(appliedConfig.allowHideAction).toBe(false);
    expect(appliedConfig.missionId).toBe('QAI_11');
    expect(appliedConfig.gameSize).toBe(GameSize.VERY_SMALL);
  });
});
