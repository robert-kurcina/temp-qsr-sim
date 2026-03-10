export type AiBattleCommand = 'interactive' | 'render-report' | 'validate' | 'help' | 'quick';

export interface ParsedAiBattleFlags {
  enableAudit: boolean;
  enableViewer: boolean;
  seed?: number;
  battlefieldPath?: string;
  initiativeCardTieBreakerOnTie?: boolean;
  initiativeCardHolderSideId?: string;
}

export interface ParsedAiBattleCli {
  command: AiBattleCommand;
  commandToken: string;
  positionalArgs: string[];
  flags: ParsedAiBattleFlags;
}

const POSITIONAL_COMMAND_FLAGS = new Set(['--interactive', '--render-report', '--validate', '--help', '--quick']);

export function parseAiBattleCliArgs(args: string[]): ParsedAiBattleCli {
  const flags: ParsedAiBattleFlags = {
    enableAudit: false,
    enableViewer: false,
  };
  const consumedArgIndexes = new Set<number>();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--audit') {
      flags.enableAudit = true;
      consumedArgIndexes.add(i);
      continue;
    }
    if (arg === '--viewer') {
      flags.enableViewer = true;
      consumedArgIndexes.add(i);
      continue;
    }
    if (arg === '--seed' && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed)) {
        flags.seed = parsed;
      }
      consumedArgIndexes.add(i);
      consumedArgIndexes.add(i + 1);
      i++;
      continue;
    }
    if (arg === '--battlefield' && next) {
      flags.battlefieldPath = next;
      consumedArgIndexes.add(i);
      consumedArgIndexes.add(i + 1);
      i++;
      continue;
    }
    if (arg === '--no-initiative-card-tiebreak') {
      flags.initiativeCardTieBreakerOnTie = false;
      consumedArgIndexes.add(i);
      continue;
    }
    if (arg === '--initiative-card-tiebreak') {
      flags.initiativeCardTieBreakerOnTie = true;
      consumedArgIndexes.add(i);
      continue;
    }
    if (arg === '--initiative-card-holder' && next) {
      flags.initiativeCardHolderSideId = next;
      if (flags.initiativeCardTieBreakerOnTie === undefined) {
        flags.initiativeCardTieBreakerOnTie = true;
      }
      consumedArgIndexes.add(i);
      consumedArgIndexes.add(i + 1);
      i++;
      continue;
    }
  }

  const positionalArgs = args.filter(
    (arg, index) =>
      !consumedArgIndexes.has(index) &&
      (!arg.startsWith('--') || POSITIONAL_COMMAND_FLAGS.has(arg))
  );

  const commandToken = positionalArgs[0] ?? '';
  let command: AiBattleCommand = 'quick';
  if (commandToken === '--interactive' || commandToken === '-i') command = 'interactive';
  else if (commandToken === '--render-report' || commandToken === '-r') command = 'render-report';
  else if (commandToken === '--validate' || commandToken === '-v') command = 'validate';
  else if (commandToken === '--help' || commandToken === '-h') command = 'help';
  else if (commandToken === 'quick' || commandToken === '--quick' || commandToken === '-q') command = 'quick';

  return {
    command,
    commandToken,
    positionalArgs,
    flags,
  };
}

export interface QuickBattleCliDefaults {
  sizeArg: string;
  densityArg: number;
  lightingArg?: string;
}

export function resolveQuickBattleCliDefaults(positionalArgs: string[]): QuickBattleCliDefaults {
  const hasQuickToken = ['quick', '--quick', '-q'].includes((positionalArgs[0] || '').toLowerCase());
  const offset = hasQuickToken ? 1 : 0;
  const sizeArg = (positionalArgs[offset] || 'VERY_SMALL').toUpperCase();
  const densityParsed = Number.parseInt(positionalArgs[offset + 1] ?? '', 10);
  const densityArg = Number.isFinite(densityParsed) ? densityParsed : 50;
  const lightingArg = positionalArgs[offset + 2];
  return {
    sizeArg,
    densityArg,
    lightingArg,
  };
}
