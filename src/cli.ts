import { Character } from './lib/mest-tactics/core/Character';
import { CombatEngine } from './lib/mest-tactics/combat/CombatEngine';
import * as readline from 'readline';
import { Profile } from './lib/mest-tactics/core/Profile';
import { buildAssembly, buildProfile } from './lib/mest-tactics/mission/assembly-builder';
import { buildMissionSide, formatMissionSideSummary, formatMissionSideCompactSummary } from './lib/mest-tactics/mission/MissionSideBuilder';
import { GameManager } from './lib/mest-tactics/engine/GameManager';
import { GameController } from './lib/mest-tactics/engine/GameController';
import { Battlefield } from './lib/mest-tactics/battlefield/Battlefield';
import { TerrainElement } from './lib/mest-tactics/battlefield/terrain/TerrainElement';
import { Position } from './lib/mest-tactics/battlefield/Position';

const arisProfile: Profile = {
  name: 'Aris',
  archetype: 'Average' as any,
  attributes: { cca: 4, rca: 2, ref: 3, int: 2, pow: 2, str: 3, for: 3, mov: 3, siz: 3 },
  items: [],
} as any;

const kaelenProfile: Profile = {
  name: 'Kaelen',
  archetype: 'Average' as any,
  attributes: { cca: 3, rca: 4, ref: 4, int: 3, pow: 2, str: 2, for: 2, mov: 4, siz: 2 },
  items: [],
} as any;

const roricProfile: Profile = {
  name: 'Roric',
  archetype: 'Average' as any,
  attributes: { cca: 3, rca: 2, ref: 2, int: 2, pow: 3, str: 4, for: 4, mov: 2, siz: 4 },
  items: [],
} as any;

const characters: Character[] = [
  new Character(arisProfile),
  new Character(kaelenProfile),
  new Character(roricProfile),
];

const rlOptions = {
  input: process.stdin,
  output: process.stdout,
};

const rl = readline.createInterface(rlOptions);

function displayCharacters(): void {
  const header = '\nAvailable Characters:\n';
  console.log(header);
  characters.forEach((char, index) => {
    const number = index + 1;
    const line = `${number}. ${char.name}`;
    console.log(line);
  });
  const spacer = '';
  console.log(spacer);
}

function selectCharacter(promptText: string): Promise<Character> {
  const promptValue = promptText;
  return new Promise((resolve, reject) => {
    rl.question(promptValue, (answer) => {
      const base = 10;
      const index = parseInt(answer, base) - 1;
      const isValid = index >= 0 && index < characters.length;
      if (isValid) {
        resolve(characters[index]);
      } else {
        const errorMessage = 'Invalid character selection.';
        reject(new Error(errorMessage));
      }
    });
  });
}

async function runCombatSimulator(): Promise<void> {
  displayCharacters();

  try {
    const attackerPrompt = 'Select an attacker (enter number): ';
    const defenderPrompt = 'Select a defender (enter number): ';
    const attacker = await selectCharacter(attackerPrompt);
    const defender = await selectCharacter(defenderPrompt);

    const result = CombatEngine.resolveCloseCombat(attacker, defender);

    const resultHeader = '\n--- Combat Result ---\n';
    console.log(resultHeader);
    const matchup = `${attacker.name} vs. ${defender.name}`;
    console.log(matchup);
    const hitLine = `Hit: ${result.hit ? 'Yes' : 'No'}`;
    console.log(hitLine);
    const woundLine = `Wound: ${result.wound ? 'Yes' : 'No'}`;
    console.log(woundLine);
    const spacer = '';
    console.log(spacer);
  } catch (error: any) {
    const errorMessage = error.message;
    console.error(errorMessage);
  } finally {
    rl.close();
  }
}

type SideOutputFormat = 'full' | 'summary' | 'compact';

function resolveSideOutputFormat(args: string[]): SideOutputFormat {
  const sideArgs = args;
  const summaryFlag = '--summary';
  const fullFlag = '--full';
  const compactFlag = '--compact';
  const formatPrefix = '--format=';
  const hasSummary = sideArgs.includes(summaryFlag);
  const hasFull = sideArgs.includes(fullFlag);
  const hasCompact = sideArgs.includes(compactFlag);
  if (hasSummary && !hasFull && !hasCompact) {
    return 'summary';
  }
  if (hasFull && !hasSummary && !hasCompact) {
    return 'full';
  }
  if (hasCompact && !hasSummary && !hasFull) {
    return 'compact';
  }

  const formatPredicate = (arg: string) => arg.startsWith(formatPrefix);
  const formatArg = sideArgs.find(formatPredicate);
  if (formatArg) {
    const formatValue = formatArg.slice(formatPrefix.length);
    if (formatValue === 'summary') {
      return 'summary';
    }
    if (formatValue === 'full') {
      return 'full';
    }
    if (formatValue === 'compact') {
      return 'compact';
    }
  }

  return 'full';
}

function runMissionSideDemo(args: string[]): void {
  const archetypeName = 'Veteran';
  const swordName = 'Sword, Broad';
  const rifleName = 'Rifle, Medium, Semi/A';
  const profileOneOptions = { itemNames: [swordName] };
  const profileTwoOptions = { itemNames: [rifleName] };
  const profileOne = buildProfile(archetypeName, profileOneOptions);
  const profileTwo = buildProfile(archetypeName, profileTwoOptions);
  const firstAssemblyName = 'Assembly Alpha';
  const secondAssemblyName = 'Assembly Bravo';
  const firstRosterProfiles = [profileOne];
  const secondRosterProfiles = [profileTwo];
  const firstRoster = buildAssembly(firstAssemblyName, firstRosterProfiles);
  const secondRoster = buildAssembly(secondAssemblyName, secondRosterProfiles);
  const rosters = [firstRoster, secondRoster];
  const sideName = 'Demo Side';
  const sideOptions = { mergeAssemblies: true };
  const side = buildMissionSide(sideName, rosters, sideOptions);

  const jsonReplacer = null;
  const jsonSpacing = 2;
  const outputFormat = resolveSideOutputFormat(args);
  const outputPayload = outputFormat === 'summary'
    ? formatMissionSideSummary(side)
    : outputFormat === 'compact'
      ? formatMissionSideCompactSummary(side)
      : side;
  const jsonOutput = JSON.stringify(outputPayload, jsonReplacer, jsonSpacing);
  console.log(jsonOutput);
  rl.close();
}

const sliceStart = 2;
const args = process.argv.slice(sliceStart);
const command = args[0] ?? 'combat';
const combatCommand = 'combat';
const sideCommand = 'side';
const skirmishCommand = 'skirmish';
const transfixCommand = 'transfix';

function runSkirmishDemo(): void {
  const battlefield = new Battlefield(12, 12);
  battlefield.addTerrain(new TerrainElement('Tree', { x: 6, y: 6 }).toFeature());
  battlefield.addTerrain(new TerrainElement('Medium Wall', { x: 6, y: 3 }).toFeature());

  const sideAProfiles = [
    buildProfile('Veteran', { itemNames: ['Rifle, Light, Semi/A', 'Sword, Broad'] }),
    buildProfile('Militia', { itemNames: ['Rifle, Light, Semi/A', 'Sword, Broad'] }),
  ];
  const sideBProfiles = [
    buildProfile('Veteran', { itemNames: ['Rifle, Light, Semi/A', 'Sword, Broad'] }),
    buildProfile('Militia', { itemNames: ['Rifle, Light, Semi/A', 'Sword, Broad'] }),
  ];

  const sideARoster = buildAssembly('Side A', sideAProfiles);
  const sideBRoster = buildAssembly('Side B', sideBProfiles);
  const sideA = buildMissionSide('Side A', [sideARoster]);
  const sideB = buildMissionSide('Side B', [sideBRoster], { startingIndex: sideA.members.length });

  const allCharacters = [...sideA.members.map(member => member.character), ...sideB.members.map(member => member.character)];
  const manager = new GameManager(allCharacters, battlefield);

  const placements: Position[] = [
    { x: 2, y: 2 },
    { x: 4, y: 2 },
    { x: 2, y: 9 },
    { x: 4, y: 9 },
  ];

  allCharacters.forEach((character, index) => {
    manager.placeCharacter(character, placements[index]);
  });

  console.log('--- Skirmish Demo ---');
  const controller = new GameController(manager, battlefield);
  const log = controller.runSkirmish(
    sideA.members.map(member => member.character),
    sideB.members.map(member => member.character),
    { maxTurns: 3, enableTakeCover: true }
  );

  for (const entry of log) {
    const line = `[T${entry.turn} R${entry.round}] ${entry.actor} ${entry.action}${entry.detail ? `: ${entry.detail}` : ''}`;
    console.log(line);
  }
}

function runTransfixDemo(): void {
  const battlefield = new Battlefield(10, 10);
  const sourceProfile: Profile = {
    name: 'Transfixer',
    archetype: 'Average' as any,
    attributes: { cca: 2, rca: 2, ref: 2, int: 3, pow: 2, str: 2, for: 2, mov: 2, siz: 3 },
    items: [],
    finalTraits: ['Transfix 2'],
  } as any;
  const targetProfile: Profile = {
    name: 'Target',
    archetype: 'Average' as any,
    attributes: { cca: 2, rca: 2, ref: 2, int: 1, pow: 1, str: 2, for: 2, mov: 2, siz: 3 },
    items: [],
  } as any;

  const source = new Character(sourceProfile);
  const target = new Character(targetProfile);
  const manager = new GameManager([source, target], battlefield);
  manager.placeCharacter(source, { x: 2, y: 2 });
  manager.placeCharacter(target, { x: 4, y: 2 });

  console.log('--- Transfix Demo ---');
  const results = manager.executeTransfixAction(source, [target], { rating: 2 });
  for (const result of results) {
    const line = `${result.targetId}: inRange=${result.inRange} los=${result.hasLOS} misses=${result.misses}`;
    console.log(line);
  }
}

if (command === sideCommand) {
  const sideArgsStart = 1;
  const sideArgs = args.slice(sideArgsStart);
  runMissionSideDemo(sideArgs);
} else if (command === skirmishCommand) {
  runSkirmishDemo();
} else if (command === transfixCommand) {
  runTransfixDemo();
} else if (command === combatCommand) {
  runCombatSimulator();
} else {
  const helpLines = [
    'Usage:',
    '  npm run cli -- combat   # interactive combat demo',
    '  npm run cli -- side [--summary|--full|--compact|--format=summary|--format=full|--format=compact]  # build a merged side demo',
    '  npm run cli -- skirmish # simple automated skirmish demo',
    '  npm run cli -- transfix # transfix status demo',
  ];
  const newline = '\n';
  const helpText = helpLines.join(newline);
  console.log(helpText);
  rl.close();
}
