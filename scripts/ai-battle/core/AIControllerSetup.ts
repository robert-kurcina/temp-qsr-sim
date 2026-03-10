import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { CharacterAI, DEFAULT_CHARACTER_AI_CONFIG } from '../../../src/lib/mest-tactics/ai/core/CharacterAI';
import type { GameConfig } from '../AIBattleConfig';

export function createAiControllersForRunner(
  config: GameConfig,
  sides: Array<{ characters: Character[] }>
): Map<string, CharacterAI> {
  const aiControllers = new Map<string, CharacterAI>();

  config.sides.forEach((sideConfig, sideIndex) => {
    const sideCharacters = sides[sideIndex]?.characters ?? [];
    sideCharacters.forEach(character => {
      const aiConfig = {
        ...DEFAULT_CHARACTER_AI_CONFIG,
        enablePatterns: false,
        enableGOAP: false,
        ai: {
          ...DEFAULT_CHARACTER_AI_CONFIG.ai,
          aggression: sideConfig.aggression,
          caution: sideConfig.caution,
          visibilityOrMu: config.visibilityOrMu,
          maxOrm: config.maxOrm,
          allowConcentrateRangeExtension: config.allowConcentrateRangeExtension,
          perCharacterFovLos: config.perCharacterFovLos,
          allowWaitAction: config.allowWaitAction ?? true,
          allowHideAction: config.allowHideAction ?? true,
          gameSize: config.gameSize,
          missionId: config.missionId,
        },
      } as any;
      aiControllers.set(character.id, new CharacterAI(aiConfig));
    });
  });

  return aiControllers;
}
