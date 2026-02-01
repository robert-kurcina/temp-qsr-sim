
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
export const getActiveOptions = () => fetchData('/data/active_options.json');
export const getMeleeWeapons = () => fetchData('/data/melee_weapons.json');
export const getBowWeapons = () => fetchData('/data/bow_weapons.json');
export const getRangedWeapons = () => fetchData('/data/ranged_weapons.json');
export const getThrownWeapons = () => fetchData('/data/thrown_weapons.json');
export const getSupportWeapons = () => fetchData('/data/support_weapons.json');
export const getGrenadeWeapons = () => fetchData('/data/grenade_weapons.json');

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
        activeOptions,
        meleeWeapons,
        bowWeapons,
        rangedWeapons,
        thrownWeapons,
        supportWeapons,
        grenadeWeapons 
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
        getActiveOptions(),
        getMeleeWeapons(),
        getBowWeapons(),
        getRangedWeapons(),
        getThrownWeapons(),
        getSupportWeapons(),
        getGrenadeWeapons()
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
        activeOptions,
        weapons: {
          ...meleeWeapons
          // ...bowWeapons,
          // ...rangedWeapons,
          // ...thrownWeapons,
          // ...supportWeapons,
          // ...grenadeWeapons
        },
    };
}
