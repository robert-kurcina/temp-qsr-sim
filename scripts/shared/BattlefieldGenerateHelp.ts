export interface BattlefieldGenerateHelpSpec {
  title: string;
  usageLine: string;
  examples: string[];
  notes?: string[];
}

export function formatBattlefieldGenerateHelp(spec: BattlefieldGenerateHelpSpec): string {
  const noteBlock =
    spec.notes && spec.notes.length > 0
      ? `\nNotes:\n${spec.notes.map(note => `  - ${note}`).join('\n')}\n`
      : '';

  return `
${spec.title}

Usage:
  ${spec.usageLine}

Game Sizes:
  VERY_SMALL SMALL MEDIUM LARGE VERY_LARGE
  Default if omitted: VERY_SMALL

Layer Tokens:
  A = Area terrain
  B = Buildings
  W = Walls
  R = Rocky terrain
  S = Shrubs
  T = Trees

Density Rules:
  - Default density for all layers is 0
  - Values are quantized to nearest 20 (17 -> 20, 73 -> 80)
  - If omitted entirely, output config is A0-B0-W0-R0-S0-T0

Options:
  --mode <fast|balanced|thorough>   Placement mode (default: balanced)
  --seed <number>                   Optional seed
  --game-size <SIZE[,SIZE...]>      Optional explicit size list
  --game-sizes <SIZE[,SIZE...]>     Alias of --game-size${noteBlock}
Examples:
${spec.examples.map(example => `  ${example}`).join('\n')}
`;
}

export function printBattlefieldGenerateHelp(spec: BattlefieldGenerateHelpSpec): void {
  console.log(formatBattlefieldGenerateHelp(spec));
}

