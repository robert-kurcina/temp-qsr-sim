import { Character } from './lib/mest-tactics/Character';
import { CombatEngine } from './lib/mest-tactics/combat/CombatEngine';
import * as readline from 'readline';
import { Profile } from './lib/mest-tactics/Profile';
import { buildAssembly, buildProfile } from './lib/mest-tactics/assembly-builder';
import { buildMissionSide, formatMissionSideSummary, formatMissionSideCompactSummary } from './lib/mest-tactics/MissionSideBuilder';
import { GameManager } from './lib/mest-tactics/GameManager';
import { CharacterStatus } from './lib/mest-tactics/types';
import { Battlefield } from './lib/mest-tactics/battlefield/Battlefield';
import { TerrainElement } from './lib/mest-tactics/battlefield/TerrainElement';
import { Position } from './lib/mest-tactics/battlefield/Position';
import { getBaseDiameterFromSiz } from './lib/mest-tactics/battlefield/size-utils';
import { Item } from './lib/mest-tactics/Item';
import { ActionContextInput, buildLOSResultContext } from './lib/mest-tactics/battlefield/action-context';

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

function parseOrValue(orValue: Item['or']): number {
  if (typeof orValue === 'number') return orValue;
  if (typeof orValue === 'string') {
    const parsed = parseFloat(orValue);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function findWeapon(profile: Profile, kind: 'ranged' | 'melee'): Item | null {
  const equipment = profile.equipment || profile.items || [];
  for (const item of equipment) {
    if (!item) continue;
    const classification = item.classification || item.class || '';
    if (kind === 'melee' && classification.toLowerCase().includes('melee')) {
      return item;
    }
    if (kind === 'ranged' && !classification.toLowerCase().includes('melee') && item.or && item.dmg) {
      return item;
    }
  }
  return null;
}

function buildSpatialModel(character: Character, position: Position) {
  const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
  return {
    id: character.id,
    position,
    baseDiameter: getBaseDiameterFromSiz(siz),
    siz,
  };
}

function buildActionInput(
  battlefield: Battlefield,
  attacker: Character,
  target: Character,
  attackerPos: Position,
  targetPos: Position
): ActionContextInput {
  return {
    battlefield,
    attacker: buildSpatialModel(attacker, attackerPos),
    target: buildSpatialModel(target, targetPos),
  };
}

function pickClosestTarget(
  actor: Character,
  actorPos: Position,
  enemies: Character[],
  battlefield: Battlefield
): { target: Character; position: Position; distance: number } | null {
  let closest: { target: Character; position: Position; distance: number } | null = null;
  for (const enemy of enemies) {
    if (enemy.state.isEliminated) continue;
    const enemyPos = battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;
    const dx = enemyPos.x - actorPos.x;
    const dy = enemyPos.y - actorPos.y;
    const distance = Math.hypot(dx, dy);
    if (!closest || distance < closest.distance) {
      closest = { target: enemy, position: enemyPos, distance };
    }
  }
  return closest;
}

function stepToward(start: Position, target: Position): Position {
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;
  return { x: start.x + stepX, y: start.y + stepY };
}

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
  manager.rollInitiative();

  const maxTurns = 3;
  for (let turn = 1; turn <= maxTurns; turn++) {
    console.log(`Turn ${turn}`);
    while (!manager.isTurnOver()) {
      const active = manager.getNextToActivate();
      if (!active) break;
      if (active.state.isEliminated) {
        manager.setCharacterStatus(active.id, CharacterStatus.Done);
        continue;
      }

      const activePos = manager.getCharacterPosition(active);
      if (!activePos) {
        manager.setCharacterStatus(active.id, CharacterStatus.Done);
        continue;
      }

      const enemies = sideA.members.some(member => member.character.id === active.id)
        ? sideB.members.map(member => member.character)
        : sideA.members.map(member => member.character);

      const targetInfo = pickClosestTarget(active, activePos, enemies, battlefield);
      if (!targetInfo) {
        manager.setCharacterStatus(active.id, CharacterStatus.Done);
        continue;
      }

      const { target, position: targetPos } = targetInfo;
      const rangedWeapon = findWeapon(active.profile, 'ranged');
      const meleeWeapon = findWeapon(active.profile, 'melee');

      const spatial = buildActionInput(battlefield, active, target, activePos, targetPos);
      const hasRangedWeapon = Boolean(rangedWeapon);
      let rangedContext: ReturnType<typeof manager.executeRangedAttack> | null = null;
      const losResult = buildLOSResultContext(spatial);
      if (hasRangedWeapon && rangedWeapon && losResult.hasLOS) {
        rangedContext = manager.executeRangedAttack(active, target, rangedWeapon, {
          ...spatial,
          optimalRangeMu: parseOrValue(rangedWeapon.or),
          orm: 0,
        });
      }

      if (rangedContext && rangedContext.context && rangedContext.result.hit) {
        console.log(`${active.name} shoots ${target.name}: hit=${rangedContext.result.hit}`);
      } else {
        const edgeDistance = Math.max(0, rangedContext?.context.distance ?? 0);
        if (edgeDistance <= 0 && meleeWeapon) {
          const closeResult = manager.executeCloseCombatAttack(active, target, meleeWeapon, {
            ...spatial,
            moveStart: activePos,
            moveEnd: activePos,
            movedOverClear: false,
            wasFreeAtStart: true,
            opposingModels: enemies.map(enemy => {
              const enemyPos = manager.getCharacterPosition(enemy);
              return enemyPos ? buildSpatialModel(enemy, enemyPos) : null;
            }).filter(Boolean) as any,
          });
          console.log(`${active.name} strikes ${target.name}: hit=${closeResult.hit}`);
        } else {
          const step = stepToward(activePos, targetPos);
          const moved = manager.moveCharacter(active, step);
          console.log(`${active.name} moves to (${step.x}, ${step.y}) ${moved ? '' : '(blocked)'}`);
        }
      }

      manager.setCharacterStatus(active.id, CharacterStatus.Done);
    }
    manager.nextTurn();
  }
}

if (command === sideCommand) {
  const sideArgsStart = 1;
  const sideArgs = args.slice(sideArgsStart);
  runMissionSideDemo(sideArgs);
} else if (command === skirmishCommand) {
  runSkirmishDemo();
} else if (command === combatCommand) {
  runCombatSimulator();
} else {
  const helpLines = [
    'Usage:',
    '  npm run cli -- combat   # interactive combat demo',
    '  npm run cli -- side [--summary|--full|--compact|--format=summary|--format=full|--format=compact]  # build a merged side demo',
    '  npm run cli -- skirmish # simple automated skirmish demo',
  ];
  const newline = '\n';
  const helpText = helpLines.join(newline);
  console.log(helpText);
  rl.close();
}
