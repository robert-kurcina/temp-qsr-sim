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

function deploymentZoneHeight(width: number, height: number): number {
  const maxDimension = Math.max(width, height);
  if (maxDimension <= 24) return 2;
  if (maxDimension <= 36) return 4;
  if (maxDimension <= 48) return 6;
  return 8;
}

function buildDeploymentZones(width: number, height: number) {
  const zoneHeight = deploymentZoneHeight(width, height);
  return {
    zoneHeight,
    zones: [
      { x: 0, y: height - zoneHeight, width, height: zoneHeight, color: '#ff0000', opacity: 0.2 },
      { x: 0, y: 0, width, height: zoneHeight, color: '#0000ff', opacity: 0.2 },
    ],
  };
}

function segmentsIntersect(a: Position, b: Position, c: Position, d: Position): boolean {
  const orientation = (p: Position, q: Position, r: Position) => {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(val) < 1e-6) return 0;
    return val > 0 ? 1 : 2;
  };
  const onSegment = (p: Position, q: Position, r: Position) => {
    return (
      q.x <= Math.max(p.x, r.x) + 1e-6 &&
      q.x >= Math.min(p.x, r.x) - 1e-6 &&
      q.y <= Math.max(p.y, r.y) + 1e-6 &&
      q.y >= Math.min(p.y, r.y) - 1e-6
    );
  };
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;
  return false;
}

function polygonsOverlap(a: Position[], b: Position[]): boolean {
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    for (let m = 0, n = b.length - 1; m < b.length; n = m++) {
      if (segmentsIntersect(a[j], a[i], b[n], b[m])) {
        return true;
      }
    }
  }
  for (const point of a) {
    if (PathfindingEngine.isPointInPolygon(point, b)) {
      return true;
    }
  }
  for (const point of b) {
    if (PathfindingEngine.isPointInPolygon(point, a)) {
      return true;
    }
  }
  return false;
}

function overlapsNonAreaTerrain(battlefield: Battlefield, element: TerrainElement): boolean {
  const vertices = element.toFeature().vertices;
  for (const feature of battlefield.terrain) {
    if (feature.meta?.layer === 'area') continue;
    if (polygonsOverlap(vertices, feature.vertices)) {
      return true;
    }
  }
  return false;
}

function findNonOverlappingPlacement(
  battlefield: Battlefield,
  elementName: string,
  basePos: Position,
  direction: Position
): Position | null {
  const element = new TerrainElement(elementName, basePos, 0);
  const radius = element.getBoundingRadius();
  const len = Math.hypot(direction.x, direction.y) || 1;
  const dir = { x: direction.x / len, y: direction.y / len };
  const perp = { x: -dir.y, y: dir.x };
  const offsets = [0, 0.5, 1, 1.5, 2, 2.5, 3];

  const candidates: Position[] = [];
  for (const o of offsets) {
    if (o === 0) {
      candidates.push(basePos);
      continue;
    }
    candidates.push({ x: basePos.x + dir.x * o, y: basePos.y + dir.y * o });
    candidates.push({ x: basePos.x - dir.x * o, y: basePos.y - dir.y * o });
    candidates.push({ x: basePos.x + perp.x * o, y: basePos.y + perp.y * o });
    candidates.push({ x: basePos.x - perp.x * o, y: basePos.y - perp.y * o });
  }

  for (const o of offsets) {
    for (const p of offsets) {
      if (o === 0 || p === 0) continue;
      candidates.push({ x: basePos.x + dir.x * o + perp.x * p, y: basePos.y + dir.y * o + perp.y * p });
      candidates.push({ x: basePos.x + dir.x * o - perp.x * p, y: basePos.y + dir.y * o - perp.y * p });
      candidates.push({ x: basePos.x - dir.x * o + perp.x * p, y: basePos.y - dir.y * o + perp.y * p });
      candidates.push({ x: basePos.x - dir.x * o - perp.x * p, y: basePos.y - dir.y * o - perp.y * p });
    }
  }

  for (const candidate of candidates) {
    if (candidate.x < radius || candidate.y < radius || candidate.x > width - radius || candidate.y > height - radius) {
      continue;
    }
    const wall = new TerrainElement(elementName, candidate, 0);
    if (!overlapsNonAreaTerrain(battlefield, wall)) {
      return candidate;
    }
  }

  return null;
}

function isMovementBlocking(feature: { type: string; meta?: Record<string, any> }): boolean {
  if (feature.type === 'Obstacle' || feature.type === 'Impassable') {
    return true;
  }
  return feature.meta?.initialMovement === 'Impassable';
}

function isFootprintClear(battlefield: Battlefield, position: Position, baseDiameter: number): boolean {
  const samples = LOSOperations.buildCircularPerimeterPoints(position, baseDiameter);
  samples.push(position);
  for (const feature of battlefield.terrain) {
    if (!isMovementBlocking(feature)) continue;
    for (const sample of samples) {
      if (PathfindingEngine.isPointInPolygon(sample, feature.vertices)) {
        return false;
      }
    }
  }
  return true;
}

function findClearPosition(
  battlefield: Battlefield,
  desired: Position,
  baseDiameter: number,
  maxAttempts = 80
): Position {
  const radius = baseDiameter / 2;
  const clamped = {
    x: Math.max(radius, Math.min(width - radius, desired.x)),
    y: Math.max(radius, Math.min(height - radius, desired.y)),
  };
  if (isFootprintClear(battlefield, clamped, baseDiameter)) {
    return clamped;
  }
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = {
      x: radius + Math.random() * (width - radius * 2),
      y: radius + Math.random() * (height - radius * 2),
    };
    if (isFootprintClear(battlefield, candidate, baseDiameter)) {
      return candidate;
    }
  }
  return clamped;
}

function renderBattlefieldGridCases() {
  const deployment = buildDeploymentZones(width, height);
  for (const density of densityValues) {
    for (const blockLos of blockValues) {
      const battlefield = BattlefieldFactory.create(width, height, {
        densityRatio: density,
        areaDensityRatio: 25,
        blockLos,
        deploymentZone: {
          side: 'both',
          height: deployment.zoneHeight,
          buffer: 3,
          corridorWidth: 2,
        },
      });
      const svg = SvgRenderer.render(battlefield, {
        width,
        height,
        title: `Battlefield 24x24 density ${density} blockLOS ${blockLos}`,
        deploymentZones: deployment.zones,
      });
      const filename = `battlefield-24x24-${density}_${blockLos}.svg`;
      writeSvg(filename, svg);
    }
  }
}

function renderPathfindingCases() {
  const densities = [50, 75, 100];
  densities.forEach((density, index) => {
    const deployment = buildDeploymentZones(width, height);
    const battlefield = BattlefieldFactory.create(width, height, {
      densityRatio: density,
      areaDensityRatio: 25,
      blockLos: 25,
      deploymentZone: {
        side: 'both',
        height: deployment.zoneHeight,
        buffer: 3,
        corridorWidth: 2,
      },
    });
    const engine = new PathfindingEngine(battlefield);

    let start: Position = findClearPosition(battlefield, { x: 2, y: 2 }, 1);
    let end: Position = findClearPosition(battlefield, { x: 22, y: 22 }, 1);
    let result = engine.findPath(start, end, { footprintDiameter: 1 });
    let attempts = 0;
    while (result.totalLength < 16 && attempts < 20) {
      start = findClearPosition(battlefield, randomPosition(2, 6), 1);
      end = findClearPosition(battlefield, randomPosition(18, 22), 1);
      result = engine.findPath(start, end, { footprintDiameter: 1 });
      attempts++;
    }

    const svg = SvgRenderer.render(battlefield, {
      width,
      height,
      title: `Pathfinding SIZ 3 density ${density} (len ${result.totalLength.toFixed(1)} MU)`,
      deploymentZones: deployment.zones,
      models: [
        { id: 'start', position: start, baseDiameter: 1, color: '#5aa469', label: 'Start' },
        { id: 'end', position: end, baseDiameter: 1, color: '#d35d6e', label: 'End' },
      ],
      paths: [
        { id: 'path', points: [start, ...result.vectors.map(v => v.to)], color: '#1144aa', label: 'Path' },
      ],
      vectors: result.vectors.map((vector, idx) => ({
        from: vector.from,
        to: vector.to,
        color: vector.terrain === 'Rough' ? '#c97b2f' : vector.terrain === 'Difficult' ? '#a15c1f' : '#2d6a4f',
        label: idx === 0 ? vector.terrain : undefined,
      })),
    });

    writeSvg(`battlefield-24x24-pathfinding-${index + 1}.svg`, svg);
  });
}

function renderLOSBlockedCases() {
  const cases = [
    { label: 'Unblocked', start: { x: 3, y: 3 }, end: { x: 12, y: 3 }, wallDistance: 0 },
    { label: 'Blocked ~4 MU', start: { x: 2, y: 8 }, end: { x: 10, y: 8 }, wallDistance: 4 },
    { label: 'Blocked ~16 MU', start: { x: 2, y: 18 }, end: { x: 22, y: 18 }, wallDistance: 16 },
  ];

  cases.forEach((entry, index) => {
    const deployment = buildDeploymentZones(width, height);
    const battlefield = BattlefieldFactory.create(width, height, {
      densityRatio: 25,
      areaDensityRatio: 25,
      blockLos: 50,
      deploymentZone: {
        side: 'both',
        height: deployment.zoneHeight,
        buffer: 3,
        corridorWidth: 2,
      },
    });
    const rays: { from: Position; to: Position; label: string; color: string }[] = [];
    const annotations: { position: Position; text: string; color?: string }[] = [];

    const start = findClearPosition(battlefield, entry.start, 1);
    const end = findClearPosition(battlefield, entry.end, 1);

    if (entry.wallDistance > 0) {
      const wallType = entry.wallDistance <= 4 ? 'Short Wall' : 'Medium Wall';
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const ratio = entry.wallDistance / length;
      const basePos = { x: start.x + dx * ratio, y: start.y + dy * ratio };
      const placement = findNonOverlappingPlacement(battlefield, wallType, basePos, { x: dx, y: dy });
      if (placement) {
        battlefield.addTerrainElement(new TerrainElement(wallType, placement, 0));
      }
    }

    rays.push({ from: start, to: end, label: entry.label, color: entry.label === 'Unblocked' ? '#2d6a4f' : '#b02a37' });

    const svg = SvgRenderer.render(battlefield, {
      width,
      height,
      title: `LOS Checks (SIZ 3) blockLOS 50 - ${entry.label}`,
      deploymentZones: deployment.zones,
      models: [
        { id: 'los-model', position: start, baseDiameter: 1, color: '#f4a261', label: 'Model' },
      ],
      losRays: rays,
      annotations,
    });

    writeSvg(`battlefield-24x24-los-${index + 1}.svg`, svg);
  });
}

function renderLOFCases() {
  const blockLosValues = [50, 75, 100];
  blockLosValues.forEach((blockLos, index) => {
    const deployment = buildDeploymentZones(width, height);
    const battlefield = BattlefieldFactory.create(width, height, {
      densityRatio: 25,
      areaDensityRatio: 25,
      blockLos,
      deploymentZone: {
        side: 'both',
        height: deployment.zoneHeight,
        buffer: 3,
        corridorWidth: 2,
      },
    });

    let yRow = 12;
    let attempt = 0;
    while (attempt < 40) {
      const candidateY = 4 + Math.random() * 16;
      const positions = [
        { x: 2, y: candidateY, diameter: 1 },
        { x: 22, y: candidateY, diameter: 1 },
        { x: 8, y: candidateY, diameter: 1 },
        { x: 12, y: candidateY, diameter: 1.5 },
        { x: 16, y: candidateY, diameter: 2 },
      ];
      if (positions.every(pos => isFootprintClear(battlefield, { x: pos.x, y: pos.y }, pos.diameter))) {
        yRow = candidateY;
        break;
      }
      attempt++;
    }

    const attacker = { id: 'attacker', position: { x: 2, y: yRow }, baseDiameter: 1, isFriendly: true, isAttentive: true, isOrdered: true };
    const target = { id: 'target', position: { x: 22, y: yRow }, baseDiameter: 1, isFriendly: false };
    const s3 = { id: 's3', position: { x: 8, y: yRow }, baseDiameter: 1, isFriendly: true };
    const s4 = { id: 's4', position: { x: 12, y: yRow }, baseDiameter: 1.5, isFriendly: false };
    const s5 = { id: 's5', position: { x: 16, y: yRow }, baseDiameter: 2, isFriendly: false };

    const models = [attacker, target, s3, s4, s5];
    const lofModels = LOFOperations.getModelsAlongLOF(attacker.position, target.position, models);
    const friendlyFire = LOFOperations.resolveFriendlyFire(attacker, target, models);

    const svg = SvgRenderer.render(battlefield, {
      width,
      height,
      title: `LOF + Friendly Fire (blockLOS ${blockLos})`,
      deploymentZones: deployment.zones,
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

    writeSvg(`battlefield-24x24-lof-${index + 1}.svg`, svg);
  });
}

renderBattlefieldGridCases();
renderPathfindingCases();
renderLOSBlockedCases();
renderLOFCases();
