// /src/builder/AssemblyBuilder.js
import { ProfileManager } from './ProfileManager.js';

/**
 * Represents a group of character profiles (e.g., "Strike Team")
 */
export class Assembly {
  /**
   * @param {string} name - Assembly name
   * @param {Object} [options]
   * @param {string[]} [options.profileNames] - Initial profile names
   */
  constructor(name, options = {}) {
    this.name = name;
    this.profileNames = options.profileNames || [];
  }

  /**
   * Add a profile to the assembly
   * @param {string} profileName
   * @throws {Error} if profile doesn't exist
   */
  addProfile(profileName) {
    const profile = ProfileManager.load(profileName);
    if (!profile) {
      throw new Error(`Profile "${profileName}" not found`);
    }
    if (!this.profileNames.includes(profileName)) {
      this.profileNames.push(profileName);
    }
  }

  /**
   * Remove a profile from the assembly
   * @param {string} profileName
   */
  removeProfile(profileName) {
    this.profileNames = this.profileNames.filter(name => name !== profileName);
  }

  /**
   * Get all profiles in the assembly
   * @returns {Array<{ name: string, profile: CharacterProfile }>}
   */
  getProfiles() {
    return this.profileNames.map(name => ({
      name,
      profile: ProfileManager.load(name)
    })).filter(item => item.profile !== null);
  }

  /**
   * Calculate total BP cost
   * @returns {number}
   */
  getTotalBP() {
    return this.getProfiles()
      .reduce((total, item) => total + item.profile.bp, 0);
  }

  /**
   * Check if assembly is valid (all profiles exist)
   * @returns {boolean}
   */
  isValid() {
    return this.profileNames.every(name => ProfileManager.load(name) !== null);
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      name: this.name,
      profileNames: this.profileNames
    };
  }

  /**
   * Deserialize from JSON
   * @param {Object} json
   * @returns {Assembly}
   */
  static fromJSON(json) {
    return new Assembly(json.name, { profileNames: json.profileNames });
  }
}

/**
 * Manages persistence of assemblies
 */
export class AssemblyManager {
  static STORAGE_KEY = 'mest_assemblies';

  /**
   * Save an assembly
   * @param {Assembly} assembly
   * @throws {Error} if name already exists
   */
  static save(assembly) {
    const assemblies = this.getAll();
    if (assemblies.has(assembly.name)) {
      throw new Error(`Assembly "${assembly.name}" already exists`);
    }
    assemblies.set(assembly.name, assembly);
    this._saveToStorage(assemblies);
  }

  /**
   * Update an existing assembly
   * @param {Assembly} assembly
   */
  static update(assembly) {
    const assemblies = this.getAll();
    assemblies.set(assembly.name, assembly);
    this._saveToStorage(assemblies);
  }

  /**
   * Load an assembly by name
   * @param {string} name
   * @returns {Assembly|null}
   */
  static load(name) {
    const assemblies = this.getAll();
    return assemblies.get(name) || null;
  }

  /**
   * Delete an assembly
   * @param {string} name
   */
  static delete(name) {
    const assemblies = this.getAll();
    assemblies.delete(name);
    this._saveToStorage(assemblies);
  }

  /**
   * Get all assemblies
   * @returns {Map<string, Assembly>}
   */
  static getAll() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return new Map();
      
      const parsed = JSON.parse(stored);
      const assemblies = new Map();
      
      for (const [name, data] of Object.entries(parsed)) {
        try {
          const assembly = Assembly.fromJSON(data);
          assemblies.set(name, assembly);
        } catch (error) {
          console.warn(`Failed to load assembly "${name}":`, error.message);
        }
      }
      
      return assemblies;
    } catch (error) {
      console.error('Failed to load assemblies:', error);
      return new Map();
    }
  }

  /**
   * Export all assemblies as JSON
   * @returns {string}
   */
  static exportAll() {
    const assemblies = {};
    for (const [name, assembly] of this.getAll()) {
      assemblies[name] = assembly.toJSON();
    }
    return JSON.stringify(assemblies, null, 2);
  }

  /**
   * Import assemblies from JSON
   * @param {string} json
   */
  static importAll(json) {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Invalid JSON format');
      }
      
      const assemblies = new Map();
      for (const [name, data] of Object.entries(parsed)) {
        const assembly = Assembly.fromJSON(data);
        assemblies.set(name, assembly);
      }
      
      this._saveToStorage(assemblies);
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  /**
   * Save assemblies to localStorage
   * @private
   */
  static _saveToStorage(assemblies) {
    const serializable = {};
    for (const [name, assembly] of assemblies) {
      serializable[name] = assembly.toJSON();
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serializable));
  }
}