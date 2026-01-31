
import terrainData from '../../data/terrain.json';

export { terrainData };

export function createTree(data) {
  /* uses data from terrain.json */
}

export function createHill(params) {
  const hillData = terrainData.find(t => t.name === 'Hill');
  if (hillData) {
    // uses terrainData.Hill.height_mu
    const height = hillData.height_mu;
    // ... rest of the function logic
  }
}
