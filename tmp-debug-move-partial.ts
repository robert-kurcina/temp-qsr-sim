import { GameManager } from './src/lib/mest-tactics/engine/GameManager';
import { Character } from './src/lib/mest-tactics/core/Character';
import type { Profile } from './src/lib/mest-tactics/core/Profile';
import { Battlefield } from './src/lib/mest-tactics/battlefield/Battlefield';
import { TerrainType } from './src/lib/mest-tactics/battlefield/terrain/Terrain';

function createCharacter(name: string): Character {
  const profile: Profile = {
    name,
    archetype: {
      name: 'Test',
      attributes: { cca: 0, rca: 0, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 4, siz: 3 },
      traits: [],
      bp: 0,
    },
    items: [],
    totalBp: 0,
    adjustedBp: 0,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: 0,
    adjPhysicality: 0,
    durability: 0,
    adjDurability: 0,
    burden: { totalLaden: 0, totalBurden: 0 } as any,
    totalHands: 0,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
  const c = new Character(profile);
  c.finalAttributes = { ...c.attributes };
  return c;
}

const mover = createCharacter('mover');
const enemy = createCharacter('enemy');
const battlefield = new Battlefield(12,12);
battlefield.addTerrain({
  id: 'rough-square',
  type: TerrainType.Rough,
  vertices: [
    {x:2,y:0},{x:4,y:0},{x:4,y:2},{x:2,y:2}
  ]
});
const gm = new GameManager([mover, enemy], battlefield);
gm.placeCharacter(mover,{x:0,y:1});
gm.placeCharacter(enemy,{x:10,y:10});
mover.finalAttributes.mov = 2;
const r = gm.executeMove(mover,{x:3,y:1});
console.log('rough result', r);
console.log('rough pos', gm.getCharacterPosition(mover));

const battlefield2 = new Battlefield(12,12);
battlefield2.addTerrain({
  id:'difficult-lane',
  type: TerrainType.Difficult,
  vertices:[{x:0,y:0},{x:6,y:0},{x:6,y:2},{x:0,y:2}]
});
const mover2 = createCharacter('mover2');
const enemy2 = createCharacter('enemy2');
const gm2 = new GameManager([mover2, enemy2], battlefield2);
gm2.placeCharacter(mover2,{x:0,y:1});
gm2.placeCharacter(enemy2,{x:10,y:10});
mover2.finalAttributes.mov = 6;
const r2 = gm2.executeMove(mover2,{x:3,y:1});
console.log('diff result', r2);
console.log('diff pos', gm2.getCharacterPosition(mover2));
