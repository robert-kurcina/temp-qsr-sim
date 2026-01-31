// /src/engine/LOSSystem.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

/**
 * Enhanced LOS System with rotation and elevation support
 * This system is the definitive, consolidated implementation for Line-of-Sight.
 */
export class LOSSystem {
  constructor(scene, models, terrain, battlefieldSizeMU) {
    this.scene = scene;
    this.models = models;
    this.terrain = terrain;
    this.battlefieldSizeMU = battlefieldSizeMU;
    this.raycaster = new THREE.Raycaster();
    this.violationLines = [];

    // Pre-calculate terrain bounding volumes for performance
    this.updateTerrainBounds();
  }

  /**
   * Update terrain bounding volumes (called when terrain changes)
   */
  updateTerrainBounds() {
    this.terrainBounds = this.terrain.map(obj => {
      if (obj.type === 'building' || obj.type === 'wall') {
        // Calculate oriented bounding box for rotated objects
        return this.calculateOrientedBounds(obj);
      } else if (obj.type === 'hill') {
        // Hills use cylindrical bounds
        return {
          type: 'cylinder',
          center: new THREE.Vector3(obj.position.x, obj.position.y, 0),
          radius: obj.totalRadiusMU * 0.5, // Convert to meters
          height: obj.elevation * 0.5
        };
      } else {
        // Trees use simple sphere bounds
        return {
          type: 'sphere',
          center: new THREE.Vector3(obj.position.x, obj.position.y, 0),
          radius: this.getTreeRadius(obj) * 0.5
        };
      }
    });
  }

  /**
   * Calculate oriented bounding box for rotated rectangular objects
   */
  calculateOrientedBounds(obj) {
    const widthM = obj.size.width * 0.5; // MU to meters
    const depthM = obj.size.depth * 0.5;
    const heightM = obj.size.height * 0.5;

    // Create 8 corners of the bounding box
    const corners = [
      [-widthM, -depthM, 0], [widthM, -depthM, 0],
      [widthM, depthM, 0], [-widthM, depthM, 0],
      [-widthM, -depthM, heightM], [widthM, -depthM, heightM],
      [widthM, depthM, heightM], [-widthM, depthM, heightM]
    ];

    // Apply rotation to corners
    const rotationRad = obj.rotationZ * Math.PI / 180;
    const cosR = Math.cos(rotationRad);
    const sinR = Math.sin(rotationRad);

    const rotatedCorners = corners.map(corner => {
      const x = corner[0] * cosR - corner[1] * sinR;
      const y = corner[0] * sinR + corner[1] * cosR;
      return [x + obj.position.x, y + obj.position.y, corner[2]];
    });

    return {
      type: 'orientedBox',
      corners: rotatedCorners.map(c => new THREE.Vector3(c[0], c[1], c[2])),
      center: new THREE.Vector3(obj.position.x, obj.position.y, heightM / 2),
      blocking: obj.blocking
    };
  }

  /**
   * Performs a multi-point volumetric LOS check and returns a detailed report.
   * @param {object} attackerModel - The model initiating the LOS check.
   * @param {object} targetModel - The model being targeted.
   * @returns {{visibility: number, obstructions: Array<object>}} - A report containing the percentage of visible points and a list of obstructing terrain objects.
   */
  getObstructionReport(attackerModel, targetModel) {
    const attackerPoints = this.getPointsOnCylinder(attackerModel);
    const targetCenter = this.getModelEyePosition(targetModel);

    let visiblePoints = 0;
    const obstructions = new Set();

    for (const startPoint of attackerPoints) {
      const direction = targetCenter.clone().sub(startPoint).normalize();
      const distance = startPoint.distanceTo(targetCenter);
      this.raycaster.set(startPoint, direction);

      const intersects = this.raycaster.intersectObjects(this.terrain, true);
      const blockingHit = intersects.find(hit => hit.distance < distance && this.isBlockingTerrain(hit.object.userData));

      if (blockingHit) {
        obstructions.add(blockingHit.object.userData);
      } else {
        visiblePoints++;
      }
    }

    const visibility = visiblePoints / attackerPoints.length;
    return { visibility, obstructions: Array.from(obstructions) };
  }


  /**
   * Generates sample points on a model's cylinder for volumetric checks.
   * @param {object} model - The model to generate points for.
   * @returns {Array<THREE.Vector3>} - An array of sample points.
   */
  getPointsOnCylinder(model) {
    // If the model is leaning, use the lean position as the origin.
    const origin = model.isLeaning() && model.leanPosition ? model.leanPosition : this.getModelEyePosition(model);
    const radius = model.baseRadiusMU * 0.5; // Convert to meters

    return [
      origin, // Center
      new THREE.Vector3(origin.x + radius, origin.y, origin.z), // East
      new THREE.Vector3(origin.x - radius, origin.y, origin.z), // West
      new THREE.Vector3(origin.x, origin.y + radius, origin.z), // North
      new THREE.Vector3(origin.x, origin.y - radius, origin.z), // South
    ];
  }

  /**
   * A basic check for clear Line of Sight between two points.
   * @param {THREE.Vector3} startPoint - The starting point of the line of sight.
   * @param {THREE.Vector3} endPoint - The ending point of the line of sight.
   * @returns {boolean} - True if there is clear line of sight, false otherwise.
   */
  hasClearLOS(startPoint, endPoint) {
    const direction = endPoint.clone().sub(startPoint).normalize();
    const distance = startPoint.distanceTo(endPoint);

    this.raycaster.set(startPoint, direction);
    const intersects = this.raycaster.intersectObjects(this.terrain, true);

    // If there are no intersections, or the closest intersection is further away than the target, LOS is clear.
    return !intersects.length || intersects[0].distance > distance;
  }

  /**
   * Get model eye position (accounting for elevation).
   */
  getModelEyePosition(model) {
    let baseHeight = model.height / 2; // Half model height

    // Check if model is on a hill
    const hill = this.getHillAtPosition(model.position.x, model.position.y);
    if (hill) {
      baseHeight += hill.elevation * 0.5; // Add hill elevation
    }

    return new THREE.Vector3(model.position.x, model.position.y, baseHeight);
  }

  /**
   * Check if ray intersects terrain bounds
   */
  rayIntersectsBounds(ray, bounds, maxDistance) {
    switch(bounds.type) {
      case 'orientedBox':
        return this.rayIntersectsOrientedBox(ray, bounds, maxDistance);
      case 'cylinder':
        return this.rayIntersectsCylinder(ray, bounds, maxDistance);
      case 'sphere':
        return this.rayIntersectsSphere(ray, bounds, maxDistance);
      default:
        return false;
    }
  }

  /**
   * Ray vs Oriented Bounding Box intersection
   */
  rayIntersectsOrientedBox(ray, bounds, maxDistance) {
    // Simplified AABB check using world-aligned bounding box
    const minX = Math.min(...bounds.corners.map(c => c.x));
    const maxX = Math.max(...bounds.corners.map(c => c.x));
    const minY = Math.min(...bounds.corners.map(c => c.y));
    const maxY = Math.max(...bounds.corners.map(c => c.y));
    const minZ = Math.min(...bounds.corners.map(c => c.z));
    const maxZ = Math.max(...bounds.corners.map(c => c.z));

    // Ray-AABB intersection
    const t1 = (minX - ray.origin.x) / ray.direction.x;
    const t2 = (maxX - ray.origin.x) / ray.direction.x;
    const t3 = (minY - ray.origin.y) / ray.direction.y;
    const t4 = (maxY - ray.origin.y) / ray.direction.y;
    const t5 = (minZ - ray.origin.z) / ray.direction.z;
    const t6 = (maxZ - ray.origin.z) / ray.direction.z;

    const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
    const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));

    return tmax >= 0 && tmin <= tmax && tmin <= maxDistance;
  }

  /**
   * Ray vs Cylinder intersection (for hills)
   */
  rayIntersectsCylinder(ray, bounds, maxDistance) {
    const dx = ray.origin.x - bounds.center.x;
    const dy = ray.origin.y - bounds.center.y;
    const dz = ray.origin.z - bounds.center.z;

    const a = ray.direction.x * ray.direction.x + ray.direction.y * ray.direction.y;
    const b = 2 * (ray.direction.x * dx + ray.direction.y * dy);
    const c = dx * dx + dy * dy - bounds.radius * bounds.radius;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return false;

    const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
    const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);

    const t = Math.min(t1, t2);
    return t >= 0 && t <= maxDistance;
  }

  /**
   * Ray vs Sphere intersection (for trees)
   */
  rayIntersectsSphere(ray, bounds, maxDistance) {
    const dx = ray.origin.x - bounds.center.x;
    const dy = ray.origin.y - bounds.center.y;
    const dz = ray.origin.z - bounds.center.z;

    const a = ray.direction.x * ray.direction.x +
               ray.direction.y * ray.direction.y +
               ray.direction.z * ray.direction.z;
    const b = 2 * (ray.direction.x * dx + ray.direction.y * dy + ray.direction.z * dz);
    const c = dx * dx + dy * dy + dz * dz - bounds.radius * bounds.radius;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return false;

    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    return t >= 0 && t <= maxDistance;
  }

  /**
   * Check if terrain blocks LOS
   */
  isBlockingTerrain(terrainObj) {
    // All buildings and walls block LOS
    if (terrainObj.type === 'building' || terrainObj.type === 'wall') {
      return true;
    }

    // Trees block LOS
    if (terrainObj.type.startsWith('tree')) {
      return true;
    }

    // Hills do NOT block LOS (they provide elevation advantage)
    if (terrainObj.type === 'hill') {
      return false;
    }

    return false;
  }

  /**
   * Get hill at position (for elevation calculation)
   */
  getHillAtPosition(x, y) {
    for (const terrainObj of this.terrain) {
      if (terrainObj.type === 'hill') {
        const distance = Math.sqrt(
          Math.pow(x - terrainObj.position.x, 2) +
          Math.pow(y - terrainObj.position.y, 2)
        );
        if (distance <= terrainObj.plateauRadiusMU) {
          return terrainObj;
        }
      }
    }
    return null;
  }

  /**
   * Get tree radius in MU
   */
  getTreeRadius(treeObj) {
    switch(treeObj.type) {
      case 'tree_single': return 0.5;
      case 'tree_cluster': return 3;
      case 'tree_stand': return 6;
      default: return 1;
    }
  }
}
