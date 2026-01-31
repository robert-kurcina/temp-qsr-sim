/**
 * Represents a Trait with its properties.
 */
export class Trait {
  constructor({
    name,
    level = 1,
    variation = null,
    isDisability = false,
    classifiers = [],
    see = null,
    dependencies = [],
    synonymFor = null,
    description = ''
  }) {
    this.name = name;
    this.level = level;
    this.variation = variation;
    this.isDisability = isDisability;
    this.classifiers = classifiers;
    this.see = see;
    this.dependencies = dependencies;
    this.synonymFor = synonymFor;
    this.description = description;
  }
}

/**
 * Represents a collection of traits, like a Trait Package.
 */
export class TraitPackage {
    constructor(name, traits = []) {
        this.name = name;
        this.traits = traits; // Array of Trait objects
    }
}

/**
 * Parses trait strings into Trait objects and packages.
 */
export class TraitParser {
    /**
     * Parses a single trait string. It can handle complex formats.
     * @param {string} traitString - The string to parse.
     * @returns {Trait | Trait[]} A single Trait or an array for multi-part traits.
     */
    static parse(traitString) {
        traitString = traitString.trim();

        if (traitString.startsWith('[') && traitString.endsWith(']') && traitString.includes(',')) {
            const innerContent = traitString.substring(1, traitString.length - 1);
            return innerContent.split(',').map(s => s.trim()).flatMap(t => this.parse(`[${t}]`));
        }

        let name = traitString;
        let isDisability = false, level = 1, variation = null, see = null, classifiers = [], dependencies = [], synonymFor = null;

        if (name.startsWith('[') && name.endsWith(']')) {
            isDisability = true;
            name = name.substring(1, name.length - 1);
        }

        if (name.includes('>')) {
            const [main, deps] = name.split('>');
            name = main.trim();
            dependencies = deps.trim().replace(/\{|\}/g, '').split('.').map(d => d.trim());
        }

        if (name.includes('—')) {
            const [main, rest] = name.split('—').map(p => p.trim());
            name = main;
            if (rest.includes('see')) {
                const seeMatch = rest.match(/see\s(.*)/);
                if (seeMatch) see = seeMatch[1].trim();
            }
            classifiers = rest.replace(/see\s.*/, '').split('.').map(c => c.trim().toLowerCase()).filter(Boolean);
        }

        if (name.endsWith('+') || name.endsWith('!')) {
            variation = name.slice(-1);
            name = name.slice(0, -1).trim();
        }

        const levelMatch = name.match(/^(.*)\s(X|\d+)$/);
        if (levelMatch) {
            name = levelMatch[1].trim();
            if (levelMatch[2] !== 'X') level = parseInt(levelMatch[2], 10);
        }

        const synonymMatch = name.match(/^(.*)\s\((.*)\)$/);
        if (synonymMatch) {
            name = synonymMatch[1].trim();
            synonymFor = synonymMatch[2].trim();
        }

        return new Trait({ name, level, variation, isDisability, classifiers, see, dependencies, synonymFor });
    }

    /**
     * Parses a trait package string.
     * @param {string} packageString - e.g., "Warrior { Melee 2, [Tough] }"
     * @returns {TraitPackage}
     */
    static parsePackage(packageString) {
        const braceStart = packageString.indexOf('{');
        const braceEnd = packageString.lastIndexOf('}');

        if (braceStart === -1 || braceEnd === -1) {
            const traits = this.parse(packageString);
            return new TraitPackage(packageString, Array.isArray(traits) ? traits : [traits]);
        }

        const name = packageString.substring(0, braceStart).trim();
        const content = packageString.substring(braceStart + 1, braceEnd).trim();

        if (!content) return new TraitPackage(name, []);

        const traitStrings = content.match(/(\[[^\]]*\]|[^,])+/g).map(s => s.trim()).filter(Boolean);
        const traits = traitStrings.flatMap(ts => this.parse(ts));

        return new TraitPackage(name, traits);
    }
}
