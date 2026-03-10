#!/usr/bin/env node
/**
 * Universal Simulation Entry Point
 *
 * Consolidated front-door for battle execution workflows.
 * Internally delegates to existing battle sub-routines during migration.
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

type SimCommand =
  | 'quick'
  | 'interactive'
  | 'validate'
  | 'render-report'
  | 'serve-reports'
  | 'help';

interface DispatchTarget {
  script: string;
  args: string[];
}

const REMOVED_COMPAT_COMMANDS = new Set(['battle', 'run-battles', 'terrain-only']);

function isRemovedCompatCommand(raw: string | undefined): raw is string {
  return Boolean(raw && REMOVED_COMPAT_COMMANDS.has(raw.trim().toLowerCase()));
}

export function printHelp(): void {
  console.log(`
MEST Tactics Simulation CLI (sim)

Usage:
  npm run sim -- [command] [args...]

Commands:
  quick [SIZE] [DENSITY] [LIGHTING] [--audit] [--viewer] [--seed N] [--battlefield PATH]
    Default mode if omitted. Uses AI battle runner path (most robust).

  interactive
    Open interactive AI battle setup.

  validate SIZE DENSITY RUNS SEED [LIGHTING] [LOADOUT_PROFILE] [DOCTRINE_ALPHA[,DOCTRINE_BRAVO]] [MISSION_ID]
    Run validation batch.

  render-report <report.json>
    Render human-readable summary from an existing battle/validation report JSON.

  serve-reports
    Launch the battle reports dashboard server.

  help
    Show this help.

Examples:
  npm run sim -- quick VERY_SMALL 50 --audit --viewer
  npm run sim -- interactive
  npm run sim -- validate VERY_SMALL 50 3 424242
  npm run sim -- render-report generated/ai-battle-reports/battle-report-<ts>.json
  npm run sim -- serve-reports
`);
}

export function normalizeCommand(raw: string | undefined): SimCommand | null {
  if (!raw) return null;
  const token = raw.trim().toLowerCase();
  switch (token) {
    case 'quick':
    case 'interactive':
    case 'validate':
    case 'render-report':
    case 'serve-reports':
    case 'help':
      return token;
    case '-h':
    case '--help':
      return 'help';
    default:
      return null;
  }
}

export function resolveDispatch(argv: string[]): { command: SimCommand; target?: DispatchTarget } {
  const first = argv[0];
  if (isRemovedCompatCommand(first)) {
    return { command: 'help' };
  }
  const explicit = normalizeCommand(first);

  // Default command: quick
  const command: SimCommand = explicit ?? 'quick';
  const rest = explicit ? argv.slice(1) : argv;

  if (command === 'help') {
    return { command };
  }

  if (command === 'quick') {
    return {
      command,
      target: {
        script: join(process.cwd(), 'scripts', 'ai-battle-setup.ts'),
        args: rest,
      },
    };
  }

  if (command === 'interactive') {
    return {
      command,
      target: {
        script: join(process.cwd(), 'scripts', 'ai-battle-setup.ts'),
        args: ['--interactive', ...rest],
      },
    };
  }

  if (command === 'validate') {
    return {
      command,
      target: {
        script: join(process.cwd(), 'scripts', 'ai-battle-setup.ts'),
        args: ['--validate', ...rest],
      },
    };
  }

  if (command === 'render-report') {
    return {
      command,
      target: {
        script: join(process.cwd(), 'scripts', 'ai-battle-setup.ts'),
        args: ['--render-report', ...rest],
      },
    };
  }

  if (command === 'serve-reports') {
    return {
      command,
      target: {
        script: join(process.cwd(), 'scripts', 'serve-terrain-audit.ts'),
        args: rest,
      },
    };
  }

  return { command };
}

export function run(target: DispatchTarget): Promise<number> {
  return new Promise(resolve => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', target.script, ...target.args],
      { stdio: 'inherit', env: process.env }
    );
    child.on('exit', code => resolve(typeof code === 'number' ? code : 1));
    child.on('error', () => resolve(1));
  });
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return import.meta.url === pathToFileURL(entrypoint).href;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  if (isRemovedCompatCommand(argv[0])) {
    console.error(
      `Command '${argv[0]}' was removed. Use one of: quick, interactive, validate, render-report, serve-reports.`
    );
    printHelp();
    return 1;
  }

  const { command, target } = resolveDispatch(argv);

  if (command === 'help') {
    printHelp();
    return 0;
  }

  if (!target) {
    printHelp();
    return 1;
  }

  return await run(target);
}

if (isMainModule()) {
  main()
    .then(code => {
      if (code !== 0) {
        process.exitCode = code;
      }
    })
    .catch(error => {
      console.error('sim failed:', error);
      process.exitCode = 1;
    });
}
