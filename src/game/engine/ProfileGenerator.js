// /src/engine/ProfileGenerator.js
/**
 * Generates random but balanced character profiles
 */
export class ProfileGenerator {
  constructor(data) {
    this.data = data;
    this.archetypes = data.archetypes.common;
    this.weapons = data.weapons;
    this.armors = data.armors;
    this.equipment = data.equipment;
  }
  
  /**
   * Generate a random profile within BP range
   */
  generateProfile(minBP = 250, maxBP = 500) {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
      // Select archetype
      const archetype = this.getRandomWeighted(this.archetypes);
      let totalBP = archetype.bp;
      
      // Add weapon (90% chance, else unarmed -3 BP)
      let weapon = null;
      if (Math.random() < 0.9) {
        weapon = this.getRandomWeighted(this.weapons);
        totalBP += weapon.bp;
      } else {
        totalBP -= 3; // Unarmed penalty
      }
      
      // Add armor (70% chance for each piece)
      const armor = {};
      ['Helm', 'Armor', 'Shield'].forEach(type => {
        if (Math.random() < 0.7) {
          const armorType = this.armors.find(a => a.type === type);
          if (armorType) {
            const size = this.getRandomWeighted(armorType.sizes);
            armor[type.toLowerCase()] = size.size;
            totalBP += size.bp;
          }
        }
      });
      
      // Add equipment (20% chance)
      let equipment = null;
      if (Math.random() < 0.2 && this.equipment.length > 0) {
        equipment = this.getRandomWeighted(this.equipment);
        totalBP += equipment.bp;
      }
      
      // Check BP range
      if (totalBP >= minBP && totalBP <= maxBP) {
        const profileName = this.generateUniqueName();
        return {
          name: profileName,
          archetype: archetype.name,
          weapon: weapon ? weapon.name : 'Unarmed',
          armor: Object.keys(armor).length > 0 ? armor : null,
          equipment: equipment ? equipment.name : null,
          bp: totalBP,
          traits: []
        };
      }
      
      attempts++;
    }
    
    // Fallback: return basic profile
    return this.generateBasicProfile();
  }
  
  getRandomWeighted(items) {
    // Simple random selection (could be enhanced with weights)
    return items[Math.floor(Math.random() * items.length)];
  }
  
  generateBasicProfile() {
    const archetype = this.archetypes[0]; // First archetype
    return {
      name: 'Basic Profile',
      archetype: archetype.name,
      weapon: 'Unarmed',
      armor: null,
      equipment: null,
      bp: archetype.bp - 3, // Unarmed
      traits: []
    };
  }
  
  generateUniqueName() {
    const adjectives = ['Veteran', 'Elite', 'Skilled', 'Experienced', 'Capable'];
    const nouns = ['Warrior', 'Fighter', 'Guard', 'Sword', 'Archer', 'Rogue'];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adjective} ${noun}`;
  }
}