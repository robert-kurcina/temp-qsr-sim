// /src/engine/AssemblyGenerator.js
/**
 * Generates balanced assemblies within game size limits
 */
export class AssemblyGenerator {
  constructor(profileGenerator, gameSize = 'medium') {
    this.profileGenerator = profileGenerator;
    this.gameSize = gameSize;
    this.GAME_SIZES = {
      small: { minBP: 250, maxBP: 500, minModels: 4, maxModels: 8 },
      medium: { minBP: 500, maxBP: 750, minModels: 6, maxModels: 12 },
      large: { minBP: 750, maxBP: 1000, minModels: 8, maxModels: 16 }
    };
  }
  
  /**
   * Generate a complete assembly
   */
  generateAssembly(name = 'Generated Assembly') {
    const config = this.GAME_SIZES[this.gameSize];
    const profiles = [];
    let totalBP = 0;
    let modelCount = 0;
    
    // Generate profiles until we reach target range
    while (modelCount < config.maxModels && totalBP < config.maxBP) {
      // Adjust BP target based on current count
      const remainingModels = config.maxModels - modelCount;
      const minBPPerModel = (config.minBP - totalBP) / remainingModels;
      const maxBPPerModel = (config.maxBP - totalBP) / remainingModels;
      
      const minProfileBP = Math.max(30, minBPPerModel);
      const maxProfileBP = Math.min(150, maxBPPerModel);
      
      if (minProfileBP <= maxProfileBP) {
        const profile = this.profileGenerator.generateProfile(minProfileBP, maxProfileBP);
        profiles.push(profile);
        totalBP += profile.bp;
        modelCount++;
        
        // Stop if we've reached minimum requirements
        if (modelCount >= config.minModels && totalBP >= config.minBP) {
          break;
        }
      } else {
        break;
      }
    }
    
    // Ensure minimum requirements are met
    if (modelCount < config.minModels || totalBP < config.minBP) {
      // Add more profiles or adjust
      while (modelCount < config.minModels) {
        const profile = this.profileGenerator.generateProfile(30, 100);
        profiles.push(profile);
        totalBP += profile.bp;
        modelCount++;
      }
    }
    
    return {
      name: name,
      profiles: profiles.map(p => p.name),
      totalBP: totalBP,
      modelCount: modelCount
    };
  }
}