// /src/ui/molecules/TerrainPlacer.js
import { Button } from '../atoms/Button.js';

/**
 * Molecule: Terrain placement buttons
 */
export function TerrainPlacer({ onPlace }) {
  const terrainTypes = [
    { name: 'Wall', icon: '🧱', variant: 'secondary' },
    { name: 'Woods', icon: '🌲', variant: 'secondary' },
    { name: 'Hill', icon: '⛰️', variant: 'secondary' },
    { name: 'Debris', icon: '🪨', variant: 'secondary' }
  ];

  return `
    <div class="terrain-placer grid grid-cols-2 gap-2">
      ${terrainTypes.map(terrain => 
        Button({ 
          text: terrain.name, 
          variant: terrain.variant,
          icon: terrain.icon
        })
      ).join('')}
    </div>
  `;
}