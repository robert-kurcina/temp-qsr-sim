// /src/builder/ProfileManager.js
import { CharacterProfile } from './CharacterBuilder.js';

const STORAGE_KEY = 'mest_profiles';

/**
 * Manages persistence of character profiles
 * Uses localStorage with JSON serialization
 */
export class ProfileManager {
  /**
   * Save a character profile
   * @param {string} name - Unique profile name
   * @param {CharacterProfile} profile
   * @throws {Error} if name already exists
   */
  static save(name, profile) {
    const profiles = this.getAll();
    
    if (profiles.has(name)) {
      throw new Error(`Profile "${name}" already exists`);
    }
    
    profiles.set(name, profile);
    this._saveToStorage(profiles);
  }

  /**
   * Update an existing profile
   * @param {string} name
   * @param {CharacterProfile} profile
   */
  static update(name, profile) {
    const profiles = this.getAll();
    profiles.set(name, profile);
    this._saveToStorage(profiles);
  }

  /**
   * Load a profile by name
   * @param {string} name
   * @returns {CharacterProfile|null}
   */
  static load(name) {
    const profiles = this.getAll();
    return profiles.get(name) || null;
  }

  /**
   * Delete a profile
   * @param {string} name
   */
  static delete(name) {
    const profiles = this.getAll();
    profiles.delete(name);
    this._saveToStorage(profiles);
  }

  /**
   * Get all profiles
   * @returns {Map<string, CharacterProfile>}
   */
  static getAll() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return new Map();
      
      const parsed = JSON.parse(stored);
      const profiles = new Map();
      
      for (const [name, data] of Object.entries(parsed)) {
        try {
          // Validate structure
          if (!this._isValidProfile(data)) {
            console.warn(`Skipping invalid profile: ${name}`);
            continue;
          }
          
          const profile = CharacterProfile.fromJSON(data);
          profiles.set(name, profile);
        } catch (error) {
          console.warn(`Failed to load profile "${name}":`, error.message);
        }
      }
      
      return profiles;
    } catch (error) {
      console.error('Failed to load profiles:', error);
      return new Map();
    }
  }

  /**
   * Export all profiles as JSON string
   * @returns {string}
   */
  static exportAll() {
    const profiles = {};
    for (const [name, profile] of this.getAll()) {
      profiles[name] = profile.toJSON();
    }
    return JSON.stringify(profiles, null, 2);
  }

  /**
   * Import profiles from JSON string
   * @param {string} json
   * @throws {Error} on invalid JSON
   */
  static importAll(json) {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Invalid JSON format');
      }
      
      const profiles = new Map();
      for (const [name, data] of Object.entries(parsed)) {
        if (!this._isValidProfile(data)) {
          throw new Error(`Invalid profile structure for "${name}"`);
        }
        const profile = CharacterProfile.fromJSON(data);
        profiles.set(name, profile);
      }
      
      this._saveToStorage(profiles);
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  /**
   * Validate profile structure
   * @private
   */
  static _isValidProfile(data) {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.archetype === 'string' &&
      typeof data.bp === 'number' &&
      Array.isArray(data.weapons) &&
      Array.isArray(data.armor)
    );
  }

  /**
   * Save profiles to localStorage
   * @private
   */
  static _saveToStorage(profiles) {
    const serializable = {};
    for (const [name, profile] of profiles) {
      serializable[name] = profile.toJSON();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  }
}