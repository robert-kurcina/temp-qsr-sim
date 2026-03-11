import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type {
  BattleEntityManifest,
  BattleEntityLoadout,
  BattleEntityProfile,
  GameConfig,
} from '../../shared/BattleReportTypes';

interface RuntimeSideForManifest {
  characters: Character[];
  totalBP: number;
  id?: string;
}

interface ExtractedItem {
  name: string;
  classification?: string;
  className?: string;
  type?: string;
  bp?: number;
}

const ENTITY_EXPORT_PATH_HINTS = {
  sides: 'entities/sides.json',
  assemblies: 'entities/assemblies.json',
  characters: 'entities/characters.json',
  profiles: 'entities/profiles.json',
  loadouts: 'entities/loadouts.json',
  modelIndex: 'entities/model-index.json',
  index: 'entities/index.json',
} as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'unknown';
}

function toSafeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function extractProfileArchetypeName(profile: Record<string, unknown>): string | undefined {
  const archetype = profile.archetype;
  if (!archetype) return undefined;
  if (typeof archetype === 'string') return archetype;
  if (typeof archetype !== 'object') return undefined;
  const typed = archetype as Record<string, unknown>;
  if (typeof typed.name === 'string' && typed.name.trim()) {
    return typed.name;
  }
  const keys = Object.keys(typed);
  return keys.length === 1 ? keys[0] : undefined;
}

function extractProfileItems(profile: Record<string, unknown>): ExtractedItem[] {
  const equipment = Array.isArray(profile.equipment) ? profile.equipment : [];
  const items = equipment.length > 0
    ? equipment
    : (Array.isArray(profile.items) ? profile.items : []);
  return items
    .filter(Boolean)
    .map((rawItem, index) => {
      const item = (rawItem ?? {}) as Record<string, unknown>;
      const name = String(item.name ?? item.id ?? `item-${index + 1}`);
      return {
        name,
        classification: typeof item.classification === 'string' ? item.classification : undefined,
        className: typeof item.class === 'string' ? item.class : undefined,
        type: typeof item.type === 'string' ? item.type : undefined,
        bp: toSafeNumber(item.bp),
      };
    });
}

function classifyItemKind(item: ExtractedItem): 'weapon' | 'armor' | 'gear' {
  const signature = `${item.classification ?? ''} ${item.className ?? ''} ${item.type ?? ''} ${item.name}`.toLowerCase();
  if (
    signature.includes('weapon')
    || signature.includes('melee')
    || signature.includes('ranged')
    || signature.includes('grenade')
    || signature.includes('support')
    || signature.includes('stiletto')
    || signature.includes('dagger')
    || signature.includes('sword')
    || signature.includes('bow')
    || signature.includes('rifle')
    || signature.includes('pistol')
  ) {
    return 'weapon';
  }
  if (
    signature.includes('armor')
    || signature.includes('shield')
    || signature.includes('helm')
    || signature.includes('vaumbrace')
  ) {
    return 'armor';
  }
  return 'gear';
}

function hasShieldItem(loadout: BattleEntityLoadout): boolean {
  return loadout.armors.some(name => name.toLowerCase().includes('shield'));
}

export function buildBattleEntityManifestForRunner(params: {
  config: GameConfig;
  sides: RuntimeSideForManifest[];
}): BattleEntityManifest {
  const { config, sides } = params;
  const manifest: BattleEntityManifest = {
    version: '1.0',
    sides: [],
    assemblies: [],
    characters: [],
    profiles: [],
    loadouts: [],
    byModelId: {},
  };

  const loadoutBySignature = new Map<string, string>();
  const profileBySignature = new Map<string, string>();
  let loadoutCounter = 0;
  let profileCounter = 0;

  for (let sideIndex = 0; sideIndex < sides.length; sideIndex += 1) {
    const runtimeSide = sides[sideIndex];
    const sideConfig = config.sides[sideIndex];
    const sideName = sideConfig?.name ?? `Side ${sideIndex + 1}`;
    const assemblyName = sideConfig?.assemblyName ?? runtimeSide.id ?? `${sideName} Assembly`;
    const assemblyId = `assembly-${sideIndex + 1}-${slugify(assemblyName)}`;
    const sideId = `side-${sideIndex + 1}-${slugify(sideName)}`;
    const sideTotalBp = runtimeSide.totalBP;
    const sideCharacterIds: string[] = [];

    for (let characterIndex = 0; characterIndex < runtimeSide.characters.length; characterIndex += 1) {
      const character = runtimeSide.characters[characterIndex];
      const profile = (character.profile ?? {}) as unknown as Record<string, unknown>;
      const profileName = String(profile.name ?? character.id ?? `model-${characterIndex + 1}`);
      const profileArchetype = extractProfileArchetypeName(profile);
      const profileTotalBp = toSafeNumber(profile.totalBp);
      const items = extractProfileItems(profile);

      const weapons = items.filter(item => classifyItemKind(item) === 'weapon').map(item => item.name);
      const armors = items.filter(item => classifyItemKind(item) === 'armor').map(item => item.name);
      const gear = items.filter(item => classifyItemKind(item) === 'gear').map(item => item.name);
      const allItemNames = items.map(item => item.name);
      const loadoutTotalBp = Number(
        items.reduce((sum, item) => sum + (item.bp ?? 0), 0).toFixed(4)
      );

      const loadoutSignature = JSON.stringify({
        techAge: sideConfig?.technologicalAge ?? null,
        itemNames: [...allItemNames].sort(),
        totalBp: loadoutTotalBp,
      });
      let loadoutId = loadoutBySignature.get(loadoutSignature);
      if (!loadoutId) {
        loadoutCounter += 1;
        loadoutId = `loadout-${loadoutCounter}`;
        const loadout: BattleEntityLoadout = {
          id: loadoutId,
          techAge: sideConfig?.technologicalAge,
          itemNames: allItemNames,
          weapons,
          armors,
          gear,
          hasShield: false,
          totalBp: loadoutTotalBp,
        };
        loadout.hasShield = hasShieldItem(loadout);
        manifest.loadouts.push(loadout);
        loadoutBySignature.set(loadoutSignature, loadoutId);
      }

      const profileSignature = JSON.stringify({
        name: profileName,
        archetype: profileArchetype ?? null,
        totalBp: profileTotalBp ?? null,
        loadoutId,
      });
      let profileId = profileBySignature.get(profileSignature);
      if (!profileId) {
        profileCounter += 1;
        profileId = `profile-${profileCounter}`;
        const profileEntry: BattleEntityProfile = {
          id: profileId,
          name: profileName,
          archetype: profileArchetype,
          loadoutId,
          totalBp: profileTotalBp,
        };
        manifest.profiles.push(profileEntry);
        profileBySignature.set(profileSignature, profileId);
      }

      const characterEntry = {
        id: character.id,
        name: profileName,
        sideId,
        sideName,
        sideIndex,
        assemblyId,
        assemblyName,
        assemblyIndex: 0,
        profileId,
        loadoutId,
        totalBp: profileTotalBp,
      };
      manifest.characters.push(characterEntry);
      manifest.byModelId[character.id] = {
        sideId,
        sideName,
        sideIndex,
        assemblyId,
        assemblyName,
        profileId,
        loadoutId,
        characterId: character.id,
        paths: ENTITY_EXPORT_PATH_HINTS,
      };
      sideCharacterIds.push(character.id);
    }

    manifest.assemblies.push({
      id: assemblyId,
      name: assemblyName,
      sideId,
      sideName,
      sideIndex,
      members: sideCharacterIds,
      totalBp: sideTotalBp,
    });

    manifest.sides.push({
      id: sideId,
      name: sideName,
      sideIndex,
      tacticalDoctrine: sideConfig?.tacticalDoctrine,
      assemblyIds: [assemblyId],
      totalBp: sideTotalBp,
    });
  }

  return manifest;
}
