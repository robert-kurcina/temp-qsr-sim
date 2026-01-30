// /src/builder/MissionBuilder.js
import { AssemblyManager } from './AssemblyBuilder.js';

/**
 * Represents a mission with two opposing sides
 */
export class Mission {
  /**
   * @param {string} name - Mission name
   * @param {Object} [options]
   * @param {string[]} [options.sideA] - Assembly names for Side A
   * @param {string[]} [options.sideB] - Assembly names for Side B
   */
  constructor(name, options = {}) {
    this.name = name;
    this.sideA = options.sideA || [];
    this.sideB = options.sideB || [];
  }

  /**
   * Add an assembly to Side A
   * @param {string} assemblyName
   * @throws {Error} if assembly doesn't exist
   */
  addToSideA(assemblyName) {
    const assembly = AssemblyManager.load(assemblyName);
    if (!assembly) {
      throw new Error(`Assembly "${assemblyName}" not found`);
    }
    if (!this.sideA.includes(assemblyName)) {
      this.sideA.push(assemblyName);
    }
  }

  /**
   * Add an assembly to Side B
   * @param {string} assemblyName
   */
  addToSideB(assemblyName) {
    const assembly = AssemblyManager.load(assemblyName);
    if (!assembly) {
      throw new Error(`Assembly "${assemblyName}" not found`);
    }
    if (!this.sideB.includes(assemblyName)) {
      this.sideB.push(assemblyName);
    }
  }

  /**
   * Remove assembly from Side A
   * @param {string} assemblyName
   */
  removeFromSideA(assemblyName) {
    this.sideA = this.sideA.filter(name => name !== assemblyName);
  }

  /**
   * Remove assembly from Side B
   * @param {string} assemblyName
   */
  removeFromSideB(assemblyName) {
    this.sideB = this.sideB.filter(name => name !== assemblyName);
  }

  /**
   * Get all assemblies for Side A
   * @returns {Array<{ name: string, assembly: Assembly }>}
   */
  getSideA() {
    return this.sideA.map(name => ({
      name,
      assembly: AssemblyManager.load(name)
    })).filter(item => item.assembly !== null);
  }

  /**
   * Get all assemblies for Side B
   * @returns {Array<{ name: string, assembly: Assembly }>}
   */
  getSideB() {
    return this.sideB.map(name => ({
      name,
      assembly: AssemblyManager.load(name)
    })).filter(item => item.assembly !== null);
  }

  /**
   * Calculate total BP for Side A
   * @returns {number}
   */
  getTotalBPSideA() {
    return this.getSideA()
      .reduce((total, item) => total + item.assembly.getTotalBP(), 0);
  }

  /**
   * Calculate total BP for Side B
   * @returns {number}
   */
  getTotalBPSideB() {
    return this.getSideB()
      .reduce((total, item) => total + item.assembly.getTotalBP(), 0);
  }

  /**
   * Get total BP for mission
   * @returns {number}
   */
  getTotalBP() {
    return this.getTotalBPSideA() + this.getTotalBPSideB();
  }

  /**
   * Check if mission is valid (all assemblies exist)
   * @returns {boolean}
   */
  isValid() {
    return (
      this.sideA.every(name => AssemblyManager.load(name) !== null) &&
      this.sideB.every(name => AssemblyManager.load(name) !== null)
    );
  }

  

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      name: this.name,
      sideA: this.sideA,
      sideB: this.sideB
    };
  }

  /**
   * Deserialize from JSON
   * @param {Object} json
   * @returns {Mission}
   */
  static fromJSON(json) {
    return new Mission(json.name, {
      sideA: json.sideA,
      sideB: json.sideB
    });
  }
}

/**
 * Manages persistence of missions
 */
export class MissionManager {
  static STORAGE_KEY = 'mest_missions';

  /**
   * Save a mission
   * @param {Mission} mission
   * @throws {Error} if name already exists
   */
  static save(mission) {
    const missions = this.getAll();
    if (missions.has(mission.name)) {
      throw new Error(`Mission "${mission.name}" already exists`);
    }
    missions.set(mission.name, mission);
    this._saveToStorage(missions);
  }

  /**
   * Update an existing mission
   * @param {Mission} mission
   */
  static update(mission) {
    const missions = this.getAll();
    missions.set(mission.name, mission);
    this._saveToStorage(missions);
  }

  /**
   * Load a mission by name
   * @param {string} name
   * @returns {Mission|null}
   */
  static load(name) {
    const missions = this.getAll();
    return missions.get(name) || null;
  }

  /**
   * Delete a mission
   * @param {string} name
   */
  static delete(name) {
    const missions = this.getAll();
    missions.delete(name);
    this._saveToStorage(missions);
  }

  /**
   * Get all missions
   * @returns {Map<string, Mission>}
   */
  static getAll() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return new Map();
      
      const parsed = JSON.parse(stored);
      const missions = new Map();
      
      for (const [name, data] of Object.entries(parsed)) {
        try {
          const mission = Mission.fromJSON(data);
          missions.set(name, mission);
        } catch (error) {
          console.warn(`Failed to load mission "${name}":`, error.message);
        }
      }
      
      return missions;
    } catch (error) {
      console.error('Failed to load missions:', error);
      return new Map();
    }
  }

  /**
   * Export all missions as JSON
   * @returns {string}
   */
  static exportAll() {
    const missions = {};
    for (const [name, mission] of this.getAll()) {
      missions[name] = mission.toJSON();
    }
    return JSON.stringify(missions, null, 2);
  }

  /**
   * Import missions from JSON
   * @param {string} json
   */
  static importAll(json) {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Invalid JSON format');
      }
      
      const missions = new Map();
      for (const [name, data] of Object.entries(parsed)) {
        const mission = Mission.fromJSON(data);
        missions.set(name, mission);
      }
      
      this._saveToStorage(missions);
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  /**
   * Save missions to localStorage
   * @private
   */
  static _saveToStorage(missions) {
    const serializable = {};
    for (const [name, mission] of missions) {
      serializable[name] = mission.toJSON();
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serializable));
  }
}