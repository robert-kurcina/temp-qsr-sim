<<<<<<< Updated upstream
import { Character, CharacterAttributes } from './lib/mest-tactics/character/Character';
import { CombatEngine } from './lib/mest-tactics/combat/CombatEngine';
import * as readline from 'readline';

const characters: Character[] = [
  new Character('1', 'Aris', { CCA: 4, RCA: 2, REF: 3, INT: 2, POW: 2, STR: 3, FOR: 3, MOV: 3, SIZ: 3 }, { x: 0, y: 0 }),
  new Character('2', 'Kaelen', { CCA: 3, RCA: 4, REF: 4, INT: 3, POW: 2, STR: 2, FOR: 2, MOV: 4, SIZ: 2 }, { x: 0, y: 0 }),
  new Character('3', 'Roric', { CCA: 3, RCA: 2, REF: 2, INT: 2, POW: 3, STR: 4, FOR: 4, MOV: 2, SIZ: 4 }, { x: 0, y: 0 }),
=======
import { Character } from './lib/mest-tactics/Character';
import { CombatEngine } from './lib/mest-tactics/combat/CombatEngine';
import * as readline from 'readline';
import { Profile } from './lib/mest-tactics/Profile';

const arisProfile: Profile = {
  name: 'Aris',
  archetype: 'Average',
  attributes: { cca: 4, rca: 2, ref: 3, int: 2, pow: 2, str: 3, for: 3, mov: 3, siz: 3 },
  traits: [],
  items: [],
};

const kaelenProfile: Profile = {
  name: 'Kaelen',
  archetype: 'Average',
  attributes: { cca: 3, rca: 4, ref: 4, int: 3, pow: 2, str: 2, for: 2, mov: 4, siz: 2 },
  traits: [],
  items: [],
};

const roricProfile: Profile = {
  name: 'Roric',
  archetype: 'Average',
  attributes: { cca: 3, rca: 2, ref: 2, int: 2, pow: 3, str: 4, for: 4, mov: 2, siz: 4 },
  traits: [],
  items: [],
};

const characters: Character[] = [
  new Character(arisProfile),
  new Character(kaelenProfile),
  new Character(roricProfile),
>>>>>>> Stashed changes
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function displayCharacters() {
  console.log('\nAvailable Characters:\n');
  characters.forEach((char, index) => {
    console.log(`${index + 1}. ${char.name}`);
  });
  console.log();
}

<<<<<<< Updated upstream
function selectCharacter(prompt: string): Promise<Character> {
  return new Promise((resolve, reject) => {
    rl.question(prompt, (answer) => {
=======
function selectCharacter(promptText: string): Promise<Character> {
  return new Promise((resolve, reject) => {
    rl.question(promptText, (answer) => {
>>>>>>> Stashed changes
      const index = parseInt(answer, 10) - 1;
      if (index >= 0 && index < characters.length) {
        resolve(characters[index]);
      } else {
        reject(new Error('Invalid character selection.'));
      }
    });
  });
}

async function runCombatSimulator() {
  displayCharacters();

  try {
    const attacker = await selectCharacter('Select an attacker (enter number): ');
    const defender = await selectCharacter('Select a defender (enter number): ');

    const result = CombatEngine.resolveCloseCombat(attacker, defender);

    console.log('\n--- Combat Result ---\n');
    console.log(`${attacker.name} vs. ${defender.name}`);
    console.log(`Hit: ${result.hit ? 'Yes' : 'No'}`);
    console.log(`Wound: ${result.wound ? 'Yes' : 'No'}`);
    console.log();

  } catch (error: any) {
    console.error(error.message);
  } finally {
    rl.close();
  }
}

runCombatSimulator();
