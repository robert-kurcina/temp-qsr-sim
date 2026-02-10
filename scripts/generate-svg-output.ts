import fs from 'fs';
import path from 'path';
import { BattlefieldFactory } from '../src/lib/mest-tactics/battlefield/BattlefieldFactory';
import { SvgRenderer } from '../src/lib/mest-tactics/battlefield/SvgRenderer';
import { PathfindingEngine } from '../src/lib/mest-tactics/battlefield/PathfindingEngine';
import { LOSOperations } from '../src/lib/mest-tactics/battlefield/LOSOperations';
import { LOFOperations } from '../src/lib/mest-tactics/battlefield/LOFOperations';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { TerrainElement } from '../src/lib/mest-tactics/battlefield/TerrainElement';
import { Position } from '../src/lib/mest-tactics/battlefield/Position';

const outputDir = path.join(process.cwd(), 'svg-output');
const width = 24;
const height = 24;

const densityValues = [0, 25, 50, 75, 100];
const blockValues = [0, 25, 50, 75, 100];

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function writeSvg(name: string, svg: string) {
  fs.writeFileSync(path.join(outputDir, name), svg, 'utf8');
}

function randomPosition(min: number, max: number): Position {
  return {
    x: min + Math.random() * (max - min),
    y: min + Math.random() * (max - min),
  };
}

function renderBattlefieldGridCases() {
  for (const density of densityValues) {
    for (const blockLos of blockValues) {
      const battlefield = BattlefieldFactory.create(width, height, {
        densityRatio: density,
        blockLos,
      });
      const svg = SvgRenderer.render(battlefield, {
        width,
        height,
        title: `Battlefield 24x24 density ${density} blockLOS ${blockLos}`,
      });
      const filename = `battlefield-24x24-${density}_${blockLos}.svg`;
      writeSvg(filename, svg);
    }
  }
}

function renderPathfindingCases() {
  const battlefield = BattlefieldFactory.create(width, height, {
    densityRatio: 50,
    blockLos: 25,
  });
  const engine = new PathfindingEngine(battlefield);

  let start: Position = { x: 2, y: 2 };
  let end: Position = { x: 22, y: 22 };
  let result = engine.findPath(start, end, { footprintDiameter: 1 });
  let attempts = 0;
  while (result.totalLength < 16 && attempts < 20) {
    start = randomPosition(2, 6);
    end = randomPosition(18, 22);
    result = engine.findPath(start, end, { footprintDiameter: 1 });
    attempts++;
  }

  const svg = SvgRenderer.render(battlefield, {
    width,
    height,
    title: `Pathfinding SIZ 3 (len ${result.totalLength.toFixed(1)} MU)`,
    models: [
      { id: 'start', position: start, baseDiameter: 1, color: '#5aa469', label: 'Start' },
      { id: 'end', position: end, baseDiameter: 1, color: '#d35d6e', label: 'End' },
    ],
    paths: [
      { id: 'path', points: [start, ...result.vectors.map(v => v.to)], color: '#1144aa', label: 'Path' },
    ],
    vectors: result.vectors.map((vector, index) => ({
      from: vector.from,
      to: vector.to,
      color: vector.terrain === 'Rough' ? '#c97b2f' : vector.terrain === 'Difficult' ? '#a15c1f' : '#2d6a4f',
      label: index === 0 ? vector.terrain : undefined,
    })),
  });

  writeSvg('battlefield-24x24-pathfinding-1.svg', svg);
}

function renderLOSBlockedCases() {
  const battlefield = BattlefieldFactory.create(width, height, {
    densityRatio: 25,
    blockLos: 50,
  });

  const rays: { from: Position; to: Position; label: string; color: string }[] = [];
  const annotations: { position: Position; text: string; color?: string }[] = [];

  const start: Position = { x: 3, y: 3 };
  const unblockedEnd: Position = { x: 12, y: 3 };
  rays.push({ from: start, to: unblockedEnd, label: 'Unblocked', color: '#2d6a4f' });

  const blocked4 = { x: 2, y: 8 };
  const blocked4End = { x: 10, y: 8 };
  const blockingElement = new TerrainElement('Short Wall', { x: 6, y: 8 }, 0);
  battlefield.addTerrainElement(blockingElement);
  rays.push({ from: blocked4, to: blocked4End, label: 'Blocked ~4 MU', color: '#b02a37' });

  const blocked16 = { x: 2, y: 18 };
  const blocked16End = { x: 22, y: 18 };
  const blockingElement2 = new TerrainElement('Medium Wall', { x: 18, y: 18 }, 0);
  battlefield.addTerrainElement(blockingElement2);
  rays.push({ from: blocked16, to: blocked16End, label: 'Blocked ~16 MU', color: '#b02a37' });

  const svg = SvgRenderer.render(battlefield, {
    width,
    height,
    title: 'LOS Checks (SIZ 3) blockLOS 50',
    models: [
      { id: 'los-model', position: start, baseDiameter: 1, color: '#f4a261', label: 'Model' },
    ],
    losRays: rays,
    annotations,
  });

  writeSvg('battlefield-24x24-los-1.svg', svg);
}

function renderLOFCases() {
  const battlefield = new Battlefield(width, height);
  const attacker = { id: 'attacker', position: { x: 2, y: 12 }, baseDiameter: 1, isFriendly: true, isAttentive: true, isOrdered: true };
  const target = { id: 'target', position: { x: 22, y: 12 }, baseDiameter: 1, isFriendly: false };
  const s3 = { id: 's3', position: { x: 8, y: 12 }, baseDiameter: 1, isFriendly: true };
  const s4 = { id: 's4', position: { x: 12, y: 12 }, baseDiameter: 1.5, isFriendly: false };
  const s5 = { id: 's5', position: { x: 16, y: 12 }, baseDiameter: 2, isFriendly: false };

  const models = [attacker, target, s3, s4, s5];
  const lofModels = LOFOperations.getModelsAlongLOF(attacker.position, target.position, models);
  const friendlyFire = LOFOperations.resolveFriendlyFire(attacker, target, models);

  const svg = SvgRenderer.render(battlefield, {
    width,
    height,
    title: 'LOF + Friendly Fire',
    models: [
      { id: 'attacker', position: attacker.position, baseDiameter: attacker.baseDiameter, color: '#2a9d8f', label: 'Attacker' },
      { id: 'target', position: target.position, baseDiameter: target.baseDiameter, color: '#e76f51', label: 'Target' },
      { id: 's3', position: s3.position, baseDiameter: s3.baseDiameter, color: '#f4a261', label: 'SIZ 3' },
      { id: 's4', position: s4.position, baseDiameter: s4.baseDiameter, color: '#e9c46a', label: 'SIZ 4' },
      { id: 's5', position: s5.position, baseDiameter: s5.baseDiameter, color: '#cdb4db', label: 'SIZ 5' },
    ],
    lofRays: [
      { from: attacker.position, to: target.position, color: '#264653', label: 'LOF' },
    ],
    annotations: [
      { position: { x: 3, y: 13 }, text: `LOF models: ${lofModels.map(m => m.id).join(', ')}` },
      { position: { x: 3, y: 14 }, text: `Friendly fire: ${friendlyFire.selected?.id ?? 'none'}` },
    ],
  });

  writeSvg('battlefield-24x24-lof-1.svg', svg);
}

renderBattlefieldGridCases();
renderPathfindingCases();
renderLOSBlockedCases();
renderLOFCases();
