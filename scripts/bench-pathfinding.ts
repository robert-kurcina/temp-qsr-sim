import { performance } from 'node:perf_hooks';
import { BattlefieldFactory } from '../src/lib/mest-tactics/battlefield/BattlefieldFactory';
import { LOSOperations } from '../src/lib/mest-tactics/battlefield/LOSOperations';
import { PathfindingEngine } from '../src/lib/mest-tactics/battlefield/PathfindingEngine';
import type { Position } from '../src/lib/mest-tactics/battlefield/Position';

const width = 24;
const height = 24;
const densityRatio = Number(process.env.DENSITY ?? 50); // effective for densityRatio 100
const areaDensityRatio = Number(process.env.AREA_DENSITY ?? 25);
const paths = Number(process.env.PATHS ?? 10);
const maxAttempts = Number(process.env.ATTEMPTS ?? 20);
const minLen = Number(process.env.MIN_LEN ?? 30);
const maxLen = Number(process.env.MAX_LEN ?? 34);
const targetLen = Number(process.env.TARGET_LEN ?? 32);
const baseDiameter = 1;

const options = {
  footprintDiameter: 1,
  tightSpotFraction: 0.5,
  clearancePenalty: 1,
};

type TerrainFeature = { type: string; meta?: Record<string, any>; vertices: Position[] };

function isMovementBlocking(feature: TerrainFeature): boolean {
  if (feature.meta?.category === 'area' || feature.meta?.layer === 'area') {
    return false;
  }
  if (feature.type === 'Obstacle' || feature.type === 'Impassable') {
    return true;
  }
  return feature.meta?.initialMovement === 'Impassable';
}

function isFootprintClear(
  battlefield: { terrain: TerrainFeature[] },
  position: Position,
  diameter: number
): boolean {
  const samples = LOSOperations.buildCircularPerimeterPoints(position, diameter);
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
  battlefield: { terrain: TerrainFeature[] },
  desired: Position,
  diameter: number,
  attempts = 80
): Position {
  const radius = diameter / 2;
  const clamped = {
    x: Math.max(radius, Math.min(width - radius, desired.x)),
    y: Math.max(radius, Math.min(height - radius, desired.y)),
  };
  if (isFootprintClear(battlefield, clamped, diameter)) {
    return clamped;
  }
  for (let i = 0; i < attempts; i++) {
    const candidate = {
      x: radius + Math.random() * (width - radius * 2),
      y: radius + Math.random() * (height - radius * 2),
    };
    if (isFootprintClear(battlefield, candidate, diameter)) {
      return candidate;
    }
  }
  return clamped;
}

function randomPosition(min: number, max: number): Position {
  return {
    x: min + Math.random() * (max - min),
    y: min + Math.random() * (max - min),
  };
}

function distance(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function pickStartEnd(
  battlefield: { terrain: TerrainFeature[] },
  diameter: number,
  attempts = 60
): { start: Position; end: Position } {
  for (let i = 0; i < attempts; i++) {
    const start = findClearPosition(battlefield, randomPosition(0.5, width - 0.5), diameter);
    const end = findClearPosition(battlefield, randomPosition(0.5, width - 0.5), diameter);
    const direct = distance(start, end);
    if (direct >= minLen && direct <= maxLen) {
      return { start, end };
    }
  }
  return {
    start: findClearPosition(battlefield, { x: 1, y: 1 }, diameter),
    end: findClearPosition(battlefield, { x: width - 1, y: height - 1 }, diameter),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

const timings: number[] = [];
const lengths: number[] = [];
const attemptCounts: number[] = [];
let fallbackCount = 0;

const battlefield = BattlefieldFactory.create(width, height, {
  densityRatio,
  areaDensityRatio,
  maxPlacementAttempts: 2000,
  maxFillerAttempts: 4000,
});
const engine = new PathfindingEngine(battlefield);

for (let run = 0; run < paths; run++) {
  let accepted = false;
  let best: { time: number; length: number; delta: number } | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { start, end } = pickStartEnd(battlefield, baseDiameter);

    const t0 = performance.now();
    const result = engine.findPath(start, end, options);
    const t1 = performance.now();
    const length = result.totalLength;
    const time = t1 - t0;
    const delta = Math.abs(length - targetLen);

    if (!best || delta < best.delta) {
      best = { time, length, delta };
    }

    if (result.vectors.length > 0 && length >= minLen && length <= maxLen) {
      timings.push(time);
      lengths.push(length);
      attemptCounts.push(attempt + 1);
      accepted = true;
      break;
    }
  }

  if (!accepted && best) {
    timings.push(best.time);
    lengths.push(best.length);
    attemptCounts.push(maxAttempts);
    fallbackCount++;
  }
}

const avgMs = average(timings);
const avgLen = average(lengths);
const avgAttempts = average(attemptCounts);
const p50 = percentile(timings, 50);
const p90 = percentile(timings, 90);
const p95 = percentile(timings, 95);

console.log(`paths=${paths}`);
console.log(`densityRatio=${densityRatio} areaDensityRatio=${areaDensityRatio}`);
console.log(`targetLen=${targetLen} acceptedRange=[${minLen}, ${maxLen}] MU`);
console.log(`avgPathLen=${avgLen.toFixed(2)} MU`);
console.log(`avgTime=${avgMs.toFixed(2)} ms (p50 ${p50.toFixed(2)} ms, p90 ${p90.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms)`);
console.log(`avgAttempts=${avgAttempts.toFixed(2)} (fallbacks ${fallbackCount})`);
