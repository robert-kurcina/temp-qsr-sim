// /src/core/SampleCharacterValidator.js
import sampleCharacters from '../../../data/sample_characters.json';
import { Character } from './Character.js';

/**
 * Validates that sample_characters.json matches computed BP costs
 * from weapons.json, armors.json, and archetypes.json
 */
export class SampleCharacterValidator {
  /**
   * Run full validation suite
   * @returns {ValidationResult}
   */
  static validate() {
    const results = [];
    let isValid = true;

    sampleCharacters.forEach((sample, index) => {
      try {
        // Reconstruct character from sample data
        const config = this._sampleToConfig(sample);
        const character = new Character(config);
        const computedBP = character.getBP();
        const declaredBP = sample.bp;

        if (computedBP !== declaredBP) {
          isValid = false;
          results.push({
            type: 'bp_mismatch',
            index,
            name: `${sample.archetype} ${sample.weapons?.join(', ') || 'Unarmed'}`,
            declared: declaredBP,
            computed: computedBP,
            diff: computedBP - declaredBP
          });
        }
      } catch (error) {
        isValid = false;
        results.push({
          type: 'construction_error',
          index,
          error: error.message
        });
      }
    });

    return new ValidationResult(isValid, results);
  }

  /**
   * Convert sample character JSON to Character config
   * @param {Object} sample - Entry from sample_characters.json
   * @returns {Object} - Config for Character constructor
   */
  static _sampleToConfig(sample) {
    const config = {
      archetype: sample.archetype,
      weapons: sample.weapons || [],
      variant: null, // Handled via traits
      armor: {}
    };

    // Map traits to variants
    if (sample.traits.includes('Grit') && 
        !sample.traits.some(t => t.startsWith('Leadership') || t.startsWith('Tactics'))) {
      // Assume base Veteran with Grit = no variant
    } else if (sample.traits.includes('Leadership')) {
      config.variant = 'Wise';
    } else if (sample.traits.includes('Tactics')) {
      config.variant = 'Tactician';
    } else if (sample.traits.includes('Fight')) {
      config.variant = 'Fighter';
    } else if (sample.traits.includes('Brawl')) {
      config.variant = 'Brawler';
    }

    // Armor mapping
    if (sample.armor) {
      // Parse "Armor, Medium" → type: "Armor", size: "Medium"
      const [type, size] = sample.armor.split(', ').map(s => s.trim());
      config.armor.suit = size;
    }
    if (sample.shield) {
      const [type, size] = sample.shield.split(', ').map(s => s.trim());
      config.armor.shield = size;
    }
    if (sample.helm) {
      config.armor.helm = 'Light'; // Helm has no size in samples
    }

    return config;
  }
}

/**
 * Encapsulates validation results
 */
export class ValidationResult {
  constructor(isValid, issues) {
    this.isValid = isValid;
    this.issues = issues;
  }

  /**
   * Print human-readable report
   */
  printReport() {
    if (this.isValid) {
      console.log('✅ All sample characters are BP-consistent.');
      return;
    }

    console.log('❌ Sample character validation failed:');
    this.issues.forEach(issue => {
      if (issue.type === 'bp_mismatch') {
        console.log(
          `  • ${issue.name}: declared=${issue.declared}, computed=${issue.computed} (Δ=${issue.diff})`
        );
      } else if (issue.type === 'construction_error') {
        console.log(`  • Construction error: ${issue.error}`);
      }
    });
  }
}