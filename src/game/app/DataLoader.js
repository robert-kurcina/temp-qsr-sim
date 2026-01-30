
const dataCache = new Map();

async function fetchData(url) {
  if (dataCache.has(url)) {
    return dataCache.get(url);
  }
  const response = await fetch(url);
  const data = await response.json();
  dataCache.set(url, data);
  return data;
}

export const getArchetypes = () => fetchData('/data/archetypes.json');
export const getArmors = () => fetchData('/data/armors.json');
export const getBundledData = () => fetchData('/data/bundledData.js');
export const getEquipment = () => fetchData('/data/equipment.json');
export const getGameRules = () => fetchData('/data/game_rules.json');
export const getGameSizes = () => fetchData('/data/game_sizes.json');
export const getMissionSchema = () => fetchData('/data/missionSchema.js');
export const getRules = () => fetchData('/data/rules.json');
export const getSampleCharacters = () => fetchData('/data/sample_characters.json');
export const getTechLevel = () => fetchData('/data/tech_level.json');
export const getTerrain = () => fetchData('/data/terrain.json');
export const getTokenSpecs = () => fetchData('/data/tokenSpecs.js');
export const getTraits = () => fetchData('/data/traits.json');
export const getWeapons = () => fetchData('/data/weapons.json');

export async function loadAll() {
    const [
        archetypes,
        armors,
        equipment,
        game_rules,
        game_sizes,
        rules,
        sample_characters,
        tech_level,
        terrain,
        traits,
        weapons,
    ] = await Promise.all([
        getArchetypes(),
        getArmors(),
        getEquipment(),
        getGameRules(),
        getGameSizes(),
        getRules(),
        getSampleCharacters(),
        getTechLevel(),
        getTerrain(),
        getTraits(),
        getWeapons(),
    ]);

    return {
        archetypes,
        armors,
        equipment,
        game_rules,
        game_sizes,
        rules,
        sample_characters,
        tech_level,
        terrain,
        traits,
        weapons,
    };
}
