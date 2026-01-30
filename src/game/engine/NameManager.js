// /src/engine/NameManager.js
/**
 * Manages unique character names with canonical letter assignment
 */
export class NameManager {
  constructor() {
    // Track used names globally
    this.usedNames = new Set();
    
    // Reset letter assignments when mission changes
    this.resetLetterAssignments();
  }
  
  resetLetterAssignments() {
    // Red side: A to N (14 letters)
    this.redLetters = 'ABCDEFGHIJKLMN'.split('');
    // Blue side: Z to M (14 letters, reverse order)
    this.blueLetters = 'ZYXWVUTSRQPONM'.split('');
    
    // Track which letters have been used
    this.usedRedLetters = new Set();
    this.usedBlueLetters = new Set();
  }
  
  /**
   * Get next available canonical letter for a side
   * @param {string} side - 'side-a' or 'side-b'
   * @returns {string}
   */
  getNextCanonicalLetter(side) {
    if (side === 'side-a') {
      // Find first unused red letter
      for (const letter of this.redLetters) {
        if (!this.usedRedLetters.has(letter)) {
          this.usedRedLetters.add(letter);
          return letter;
        }
      }
      // Fallback: use next available letter after N
      let next = 'O';
      while (this.usedNames.has(next)) {
        next = String.fromCharCode(next.charCodeAt(0) + 1);
        if (next > 'Z') next = 'AA'; // Handle overflow
      }
      return next;
    } else {
      // Find first unused blue letter
      for (const letter of this.blueLetters) {
        if (!this.usedBlueLetters.has(letter)) {
          this.usedBlueLetters.add(letter);
          return letter;
        }
      }
      // Fallback: use previous available letter before M
      let next = 'L';
      while (this.usedNames.has(next)) {
        next = String.fromCharCode(next.charCodeAt(0) - 1);
        if (next < 'A') next = 'ZZ'; // Handle underflow
      }
      return next;
    }
  }
  
  /**
   * Assign a name to a profile in an assembly
   * @param {string} proposedName - User input or empty string
   * @param {string} side - 'side-a' or 'side-b'
   * @param {string} currentName - Current assigned name (for editing)
   * @returns {Object} - { name: string, isCanonical: boolean, isValid: boolean }
   */
  assignName(proposedName, side, currentName = '') {
    // Release current name if editing
    if (currentName && this.usedNames.has(currentName)) {
      this.usedNames.delete(currentName);
      // Also release canonical letter if it was one
      if (this.isCanonicalLetter(currentName, side)) {
        this.releaseCanonicalLetter(currentName, side);
      }
    }
    
    let finalName = '';
    let isCanonical = false;
    let isValid = true;
    
    if (!proposedName.trim()) {
      // Use canonical letter
      finalName = this.getNextCanonicalLetter(side);
      isCanonical = true;
    } else {
      // Validate user-provided name
      finalName = this.validateAndSanitizeName(proposedName.trim());
      isCanonical = false;
      
      // Check uniqueness
      if (this.usedNames.has(finalName)) {
        isValid = false;
      }
    }
    
    // Reserve the name if valid
    if (isValid) {
      this.usedNames.add(finalName);
    } else {
      // If invalid, still use canonical as fallback for display
      const fallback = this.getNextCanonicalLetter(side);
      // But don't reserve it yet (user might fix the name)
      finalName = proposedName.trim(); // Show original for editing
    }
    
    return { name: finalName, isCanonical, isValid };
  }
  
  /**
   * Validate and sanitize user-provided name
   * @param {string} name
   * @returns {string}
   */
  validateAndSanitizeName(name) {
    // Allow alphanumeric only, max 12 characters
    let sanitized = name.replace(/[^a-zA-Z0-9]/g, '');
    if (sanitized.length > 12) {
      sanitized = sanitized.substring(0, 12);
    }
    return sanitized || 'A'; // Fallback to 'A' if empty after sanitization
  }
  
  /**
   * Check if a name is a canonical letter for the given side
   * @param {string} name
   * @param {string} side
   * @returns {boolean}
   */
  isCanonicalLetter(name, side) {
    if (name.length !== 1 || !name.match(/^[A-Z]$/)) {
      return false;
    }
    
    if (side === 'side-a') {
      return this.redLetters.includes(name);
    } else {
      return this.blueLetters.includes(name);
    }
  }
  
  /**
   * Release a canonical letter back to the pool
   * @param {string} letter
   * @param {string} side
   */
  releaseCanonicalLetter(letter, side) {
    if (side === 'side-a') {
      this.usedRedLetters.delete(letter);
    } else {
      this.usedBlueLetters.delete(letter);
    }
  }
  
  /**
   * Check if a name is unique
   * @param {string} name
   * @returns {boolean}
   */
  isUnique(name) {
    return !this.usedNames.has(name);
  }
  
  /**
   * Clear all used names (for new mission)
   */
  clearAll() {
    this.usedNames.clear();
    this.resetLetterAssignments();
  }
}