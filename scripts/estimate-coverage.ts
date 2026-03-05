import { BattlefieldFactory } from '../src/lib/mest-tactics/battlefield/rendering/BattlefieldFactory';

type TerrainFeature = { vertices: { x: number; y: number }[]; meta?: Record<string, any> };

const width = 24;
const height = 24;
const runs = Number(process.env.COVERAGE_RUNS ?? 1000);
const thresholdHigh = 0.8;
const thresholdLow = 0.5;

const config = {
  densityRatio: 100,
  areaDensityRatio: 25,
  blockLos: 100,
  maxNonAreaSpacing: 0.5,
  maxPlacementAttempts: 1000,
  maxFillerAttempts: 1000,
};

function polygonArea(points: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  return Math.abs(area) / 2;
}

function nonAreaCoverageRatio(features: TerrainFeature[], totalArea: number): number {
  let area = 0;
  for (const feature of features) {
    if (feature.meta?.category === 'area' || feature.meta?.layer === 'area') continue;
    area += polygonArea(feature.vertices);
  }
  return totalArea > 0 ? area / totalArea : 0;
}

function seedRandom(seed: number) {
  let state = seed >>> 0;
  Math.random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

seedRandom(42);

const totalArea = width * height;
let meetHigh = 0;
let meetLow = 0;
let sum = 0;
let min = Number.POSITIVE_INFINITY;
let max = 0;

for (let i = 0; i < runs; i++) {
  const battlefield = BattlefieldFactory.create(width, height, config);
  const ratio = nonAreaCoverageRatio(battlefield.terrain, totalArea);
  sum += ratio;
  if (ratio < min) min = ratio;
  if (ratio > max) max = ratio;
  if (ratio >= thresholdHigh) meetHigh++;
  if (ratio >= thresholdLow) meetLow++;
}

const avg = sum / runs;
const pctHigh = (meetHigh / runs) * 100;
const pctLow = (meetLow / runs) * 100;

console.log(`runs=${runs}`);
console.log(`config=${JSON.stringify(config)}`);
console.log(`non-area coverage ratio: avg=${avg.toFixed(3)} min=${min.toFixed(3)} max=${max.toFixed(3)}`);
console.log(`>=${thresholdHigh}: ${meetHigh}/${runs} (${pctHigh.toFixed(1)}%)`);
console.log(`>=${thresholdLow}: ${meetLow}/${runs} (${pctLow.toFixed(1)}%)`);
