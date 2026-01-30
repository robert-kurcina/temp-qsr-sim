// /src/engine/TerrainFactory.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

/**
 * Creates canonical MEST terrain meshes
 */
export class TerrainFactory {
  static createTree(x, y, MU_TO_M) {
    const group = new THREE.Group();
    
    // TRUNK: 0.5 MU diameter × 0.5 MU height
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.25 * MU_TO_M,   // radius
        0.25 * MU_TO_M,
        0.5 * MU_TO_M,    // height
        8
      ),
      new THREE.MeshLambertMaterial({ color: 0x5d4037 })
    );
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    trunk.position.y = 0.25 * MU_TO_M;
    group.add(trunk);
    
    // CANOPY: 2.0 MU base diameter × 6.5 MU height
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(
        1.0 * MU_TO_M,    // radius
        6.5 * MU_TO_M,    // height
        8
      ),
      new THREE.MeshLambertMaterial({ color: 0x27ae60 })
    );
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    canopy.position.y = 0.5 * MU_TO_M + (6.5 * MU_TO_M) / 2;
    group.add(canopy);
    
    // Rotate to stand upright
    group.rotation.x = Math.PI / 2;
    group.position.set(x, y, 0);
    
    return { mesh: group, type: 'woods', blocking: true, heightMU: 7.0 };
  }
  
  static createWoods(x, y, MU_TO_M) {
    const group = new THREE.Group();
    const offsets = [[-1,-1], [1,-1], [1,1], [-1,1]];
    offsets.forEach(([dx, dy]) => {
      const tree = this.createTree(dx * MU_TO_M, dy * MU_TO_M, MU_TO_M);
      group.add(tree.mesh);
    });
    group.position.set(x, y, 0);
    return { mesh: group, type: 'woods', blocking: true, heightMU: 7.0 };
  }
  
  static createWall(x, y, MU_TO_M) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(4 * MU_TO_M, 0.5 * MU_TO_M, 1.2 * MU_TO_M),
      new THREE.MeshLambertMaterial({ color: 0x7f8c8d })
    );
    mesh.position.set(x, y, 0.6 * MU_TO_M);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return { mesh, type: 'wall', blocking: true, heightMU: 1.2 };
  }
  
  static createHill(x, y, MU_TO_M) {
    // Conical hill with 26.6° slope (1 MU rise per 2 MU run)
    const heightMU = 2.0;
    const baseRadiusMU = 4.0; // 2:1 ratio for 26.6° slope
    
    const hill = new THREE.Mesh(
      new THREE.ConeGeometry(baseRadiusMU * MU_TO_M, heightMU * MU_TO_M, 16),
      new THREE.MeshLambertMaterial({ color: 0xd35400 })
    );
    hill.rotation.x = -Math.PI / 2; // Lay on side
    hill.position.y = heightMU * MU_TO_M / 2;
    hill.position.set(x, y, heightMU * MU_TO_M / 2);
    hill.castShadow = true;
    hill.receiveShadow = true;
    
    return { mesh: hill, type: 'hill', blocking: false, heightMU: heightMU };
  }
  
  static createDebris(x, y, MU_TO_M) {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xbdc3c7 });
    for (let i = 0; i < 4; i++) {
      const piece = new THREE.Mesh(
        new THREE.BoxGeometry(0.4 * MU_TO_M, 0.4 * MU_TO_M, 0.4 * MU_TO_M),
        mat
      );
      piece.position.set(
        (Math.random() - 0.5) * 2 * MU_TO_M,
        (Math.random() - 0.5) * 1.5 * MU_TO_M,
        0.2 * MU_TO_M
      );
      piece.castShadow = true;
      group.add(piece);
    }
    group.position.set(x, y, 0);
    return { mesh: group, type: 'debris', blocking: false, heightMU: 0.5 };
  }

  // Buildings are now 3 MU tall with 1 MU entrance
static createBuilding(x, y, params, MU_TO_M, rotationDegrees = 0) {
  const baseWidthMU = params.width || 4;
  const baseDepthMU = params.depth || 4;
  const heightMU = 3; // Fixed 3 MU height
  
  // Apply ±25% random sizing
  const widthMU = baseWidthMU * (0.75 + Math.random() * 0.5);
  const depthMU = baseDepthMU * (0.75 + Math.random() * 0.5);
  
  const widthM = widthMU * MU_TO_M;
  const depthM = depthMU * MU_TO_M;
  const heightM = heightMU * MU_TO_M;
  
  // Create building mesh
  const geometry = new THREE.BoxGeometry(widthM, depthM, heightM);
  const material = new THREE.MeshLambertMaterial({ color: 0x8b6b45 });
  const building = new THREE.Mesh(geometry, material);
  
  // Position at ground level
  building.position.set(x, y, heightM / 2);
  building.castShadow = true;
  building.receiveShadow = true;
  
  // Apply rotation
  const rotationRad = (rotationDegrees * Math.PI) / 180;
  building.rotation.z = rotationRad;
  
  // Add entrance (1 MU wide opening on one face)
  const entrance = this.createEntrance(widthM, depthM, heightM, rotationDegrees, MU_TO_M);
  building.add(entrance);
  
  return {
    mesh: building,
    type: 'building',
    blocking: true,
    size: { width: widthMU, depth: depthMU, height: heightMU },
    position: { x: x / MU_TO_M, y: y / MU_TO_M },
    rotationZ: rotationDegrees,
    entranceFace: this.getEntranceFace(rotationDegrees)
  };
}

static createEntrance(widthM, depthM, heightM, rotationDegrees, MU_TO_M) {
  // 1 MU wide entrance = 0.5 MU radius
  const entranceRadiusM = 0.5 * MU_TO_M;
  const entranceHeightM = 2 * MU_TO_M; // 2 MU tall entrance
  
  // Determine entrance position based on rotation
  const rotationRad = (rotationDegrees * Math.PI) / 180;
  const cosR = Math.cos(rotationRad);
  const sinR = Math.sin(rotationRad);
  
  // Place entrance on front face (facing positive Y when rotation=0)
  const entranceOffsetX = 0;
  const entranceOffsetY = depthM / 2 + 0.1; // Slightly outside building
  
  // Rotate entrance position
  const rotatedX = entranceOffsetX * cosR - entranceOffsetY * sinR;
  const rotatedY = entranceOffsetX * sinR + entranceOffsetY * cosR;
  
  // Create entrance as transparent area (visual only)
  const entranceGeometry = new THREE.CylinderGeometry(
    entranceRadiusM, entranceRadiusM, entranceHeightM, 16
  );
  const entranceMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff,
    transparent: true,
    opacity: 0.3
  });
  const entrance = new THREE.Mesh(entranceGeometry, entranceMaterial);
  entrance.position.set(rotatedX, rotatedY, entranceHeightM / 2);
  
  return entrance;
}

static getEntranceFace(rotationDegrees) {
  // Determine which face has the entrance based on rotation
  const normalized = ((rotationDegrees % 360) + 360) % 360;
  if (normalized < 45 || normalized >= 315) return 'front';
  if (normalized < 135) return 'right';
  if (normalized < 225) return 'back';
  return 'left';
}

  // Add to TerrainFactory.js
  static createRotatableTerrain(type, x, y, params, MU_TO_M, rotationDegrees = 0) {
    let mesh;
    
    switch(type) {
      case 'building':
        mesh = this.createBuilding(x, y, params, MU_TO_M);
        break;
      case 'wall':
        mesh = this.createWall(x, y, params, MU_TO_M);
        break;
      case 'hill':
        mesh = this.createHill(x, y, params.size, MU_TO_M);
        break;
      // ... other terrain types
    }
    
    // Apply Z-axis rotation (in radians)
    const rotationRad = (rotationDegrees * Math.PI) / 180;
    mesh.rotation.z = rotationRad;
    
    return mesh;
  }

  /**
   * Get rotation increment (15-degree steps)
   */
  static getRotationIncrement(currentRotation) {
    const increments = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 
                      195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345];
    const currentIdx = increments.indexOf(currentRotation);
    const nextIdx = (currentIdx + 1) % increments.length;
    return increments[nextIdx];
  }
  
}