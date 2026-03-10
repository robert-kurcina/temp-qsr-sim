import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import { Character } from '../../../src/lib/mest-tactics/core/Character';
import type {
  GameConfig,
  ModelStateAudit,
  NestedSections,
} from '../../shared/BattleReportTypes';
import type { CharacterSection, SideSection } from '../validation/ValidationMetrics';

export function describeArchetypeForNestedSections(character: Character): string {
  const arch = character.profile.archetype as unknown;
  if (typeof arch === 'string') return arch;
  if (arch && typeof arch === 'object' && !Array.isArray(arch)) {
    const keys = Object.keys(arch as Record<string, unknown>);
    if (keys.length > 0) {
      return keys.join('|');
    }
  }
  return 'Unknown';
}

export function buildNestedSectionsForBattle(
  config: GameConfig,
  sides: Array<{ characters: Character[]; totalBP: number }>,
  battlefield: Battlefield,
  startPositions: Map<string, Position>,
  snapshotModelState: (character: Character) => ModelStateAudit
): NestedSections {
  const sideSections: SideSection[] = [];

  for (let sideIndex = 0; sideIndex < config.sides.length; sideIndex++) {
    const sideConfig = config.sides[sideIndex];
    const sideRuntime = sides[sideIndex];
    if (!sideConfig || !sideRuntime) continue;
    const assemblyName = sideConfig.assemblyName;
    const characters: CharacterSection[] = sideRuntime.characters.map(character => {
      const equipment = (character.profile.equipment || character.profile.items || [])
        .filter(Boolean)
        .map(item => ({
          name: item?.name ?? 'Unknown Item',
          classification: item?.classification ?? item?.class,
          traits: Array.isArray(item?.traits) ? item.traits : undefined,
        }));
      const endPosition = battlefield.getCharacterPosition(character);
      return {
        id: character.id,
        name: character.profile.name,
        profile: {
          name: character.profile.name,
          archetype: describeArchetypeForNestedSections(character),
          attributes: { ...(character.attributes as unknown as Record<string, number>) },
          finalAttributes: { ...(character.finalAttributes as unknown as Record<string, number>) },
          totalBp: character.profile.totalBp,
          burdenTotal: character.profile.burden?.totalBurden,
          equipment,
        },
        startPosition: startPositions.get(character.id),
        endPosition: endPosition ? { x: endPosition.x, y: endPosition.y } : undefined,
        state: snapshotModelState(character),
      };
    });

    sideSections.push({
      name: sideConfig.name,
      assemblies: [
        {
          name: assemblyName,
          totalBP: sideRuntime.totalBP,
          characters,
        },
      ],
    });
  }

  const deploymentIndex = new Map<string, { sideName: string; assemblyName: string; characterName: string }>();
  for (const side of sideSections) {
    for (const assembly of side.assemblies) {
      for (const character of assembly.characters) {
        deploymentIndex.set(character.id, {
          sideName: side.name,
          assemblyName: assembly.name,
          characterName: character.name,
        });
      }
    }
  }

  const deployments = Array.from(deploymentIndex.entries()).map(([characterId, metadata]) => {
    const current = sides
      .flatMap(side => side.characters)
      .find(character => character.id === characterId);
    const end = current ? battlefield.getCharacterPosition(current) : undefined;
    return {
      characterId,
      characterName: metadata.characterName,
      sideName: metadata.sideName,
      assemblyName: metadata.assemblyName,
      startPosition: startPositions.get(characterId),
      endPosition: end ? { x: end.x, y: end.y } : undefined,
    };
  });

  const terrainFeatures = battlefield.terrain.map(feature => ({
    id: feature.id,
    type: String(feature.type),
    metaName: feature.meta?.name,
    movement: feature.meta?.movement,
    los: feature.meta?.los,
    rotationDegrees: feature.meta?.rotationDegrees,
    vertices: feature.vertices.map(v => ({ x: v.x, y: v.y })),
  }));

  return {
    sides: sideSections,
    battlefieldLayout: {
      widthMu: battlefield.width,
      heightMu: battlefield.height,
      densityRatio: config.densityRatio,
      terrainFeatures,
      deployments,
    },
  } as unknown as NestedSections;
}
