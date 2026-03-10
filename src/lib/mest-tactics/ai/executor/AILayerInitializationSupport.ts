import { Battlefield } from '../../battlefield/Battlefield';
import { MissionSide } from '../../mission/MissionSide';
import { CharacterAI, createSideAI as createCharacterAIs } from '../core/CharacterAI';
import { createSideAssemblyAIs, AssemblyAI } from '../strategic/AssemblyAI';
import { createSideAI, SideAI } from '../strategic/SideAI';

export interface AILayerInitializationConfig {
  enableStrategic: boolean;
  enableTactical: boolean;
  enableCharacterAI: boolean;
  allowKOdAttacks?: boolean;
  kodControllerTraitsByCharacterId?: Record<string, string[]>;
  kodCoordinatorTraitsByCharacterId?: Record<string, string[]>;
  visibilityOrMu?: number;
  maxOrm?: number;
  allowConcentrateRangeExtension?: boolean;
  perCharacterFovLos?: boolean;
  allowWaitAction?: boolean;
  allowHideAction?: boolean;
}

export interface InitializedAILayers {
  sideIds: string[];
  characterSideById: Map<string, string>;
  characterAssemblyById: Map<string, string>;
  sideAIs: Map<string, SideAI>;
  assemblyAIs: Map<string, AssemblyAI>;
  characterAIs: Map<string, CharacterAI>;
}

export function initializeAILayersForGameLoop(
  sides: MissionSide[],
  battlefield: Battlefield,
  config: AILayerInitializationConfig
): InitializedAILayers {
  const sideIds = sides.map(side => side.id);
  const characterSideById = new Map<string, string>();
  const characterAssemblyById = new Map<string, string>();
  const sideAIs = new Map<string, SideAI>();
  const assemblyAIs = new Map<string, AssemblyAI>();
  const characterAIs = new Map<string, CharacterAI>();

  for (const side of sides) {
    for (const member of side.members) {
      characterSideById.set(member.character.id, side.id);
      characterAssemblyById.set(member.character.id, member.assembly.name);
    }
  }

  for (let i = 0; i < sides.length; i++) {
    const side = sides[i];
    const enemySide = sides[(i + 1) % sides.length];

    if (config.enableStrategic) {
      const sideAI = createSideAI(side, battlefield, enemySide);
      sideAIs.set(side.id, sideAI);
    }

    if (config.enableTactical) {
      const sideAssemblyAIs = createSideAssemblyAIs(side, battlefield);
      for (const [assemblyId, assemblyAI] of sideAssemblyAIs.entries()) {
        assemblyAIs.set(assemblyId, assemblyAI);
      }
    }
  }

  if (config.enableCharacterAI) {
    for (const side of sides) {
      const characters = side.members
        .filter(m => !m.character.state.isEliminated && !m.character.state.isKOd)
        .map(m => m.character);

      const sideCharacterAIs = createCharacterAIs(characters);
      for (const [charId, charAI] of sideCharacterAIs.entries()) {
        charAI.setConfig({
          allowKOdAttacks: config.allowKOdAttacks ?? false,
          kodControllerTraitsByCharacterId: config.kodControllerTraitsByCharacterId,
          kodCoordinatorTraitsByCharacterId: config.kodCoordinatorTraitsByCharacterId,
          visibilityOrMu: config.visibilityOrMu,
          maxOrm: config.maxOrm,
          allowConcentrateRangeExtension: config.allowConcentrateRangeExtension,
          perCharacterFovLos: config.perCharacterFovLos,
          allowWaitAction: config.allowWaitAction,
          allowHideAction: config.allowHideAction,
        });
        characterAIs.set(charId, charAI);
      }
    }
  }

  return {
    sideIds,
    characterSideById,
    characterAssemblyById,
    sideAIs,
    assemblyAIs,
    characterAIs,
  };
}
