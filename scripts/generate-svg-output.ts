import fs from 'fs/promises';
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
const maxNonAreaSpacing = 0.5;
const maxPlacementAttempts = 1000;
const maxFillerAttempts = 1000;
const maxPlacementMs = 30000;
const watchdogSeconds = Math.max(0, Number(process.env.SVG_WATCHDOG_SECONDS ?? 5));
const runTimeoutSeconds = Math.max(0, Number(process.env.SVG_RUN_TIMEOUT_SECONDS ?? 180));

let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
let runTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
const runDeadline = runTimeoutSeconds > 0 ? Date.now() + runTimeoutSeconds * 1000 : 0;
let runTimedOut = false;

function armWatchdog(): void {
  if (watchdogSeconds <= 0) return;
  if (watchdogTimer) {
    clearTimeout(watchdogTimer);
  }
  watchdogTimer = setTimeout(() => {
    process.exit(0);
  }, watchdogSeconds * 1000);
}

function armRunTimeout(): void {
  if (runTimeoutSeconds <= 0) return;
  if (runTimeoutTimer) {
    clearTimeout(runTimeoutTimer);
  }
  runTimeoutTimer = setTimeout(() => {
    if (!runTimedOut) {
      runTimedOut = true;
      console.error(`[generate:svg] Timeout after ${runTimeoutSeconds}s. Exiting.`);
    }
    writeIndexHtml()
      .catch(err => {
        console.error('Failed to write index.html on timeout:', err);
      })
      .finally(() => {
        process.exit(124);
      });
  }, runTimeoutSeconds * 1000);
}

function checkRunTimeout(context: string): boolean {
  if (runDeadline <= 0) return false;
  if (Date.now() <= runDeadline) return false;
  if (!runTimedOut) {
    runTimedOut = true;
    console.error(`[generate:svg] Timeout after ${runTimeoutSeconds}s at ${context}.`);
  }
  return true;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

const densityValues = [0, 25, 50, 75, 100];

function effectiveDensityRatio(density: number): number {
  return density === 100 ? 50 : density;
}

await fs.mkdir(outputDir, { recursive: true });

async function writeSvg(name: string, svg: string) {
  await fs.writeFile(path.join(outputDir, name), svg, 'utf8');
}

function sortSvgFiles(a: string, b: string): number {
  const key = (name: string): [number, number, string] => {
    const gridMatch = name.match(/^battlefield-24x24-(\d+)\.svg$/);
    if (gridMatch) return [0, Number(gridMatch[1]), name];
    const pathMatch = name.match(/^battlefield-24x24-pathfinding-(\d+)\.svg$/);
    if (pathMatch) return [1, Number(pathMatch[1]), name];
    const losMatch = name.match(/^battlefield-24x24-los-(\d+)\.svg$/);
    if (losMatch) return [2, Number(losMatch[1]), name];
    const lofMatch = name.match(/^battlefield-24x24-lof-(\d+)\.svg$/);
    if (lofMatch) return [3, Number(lofMatch[1]), name];
    return [4, 0, name];
  };
  const [groupA, numA, nameA] = key(a);
  const [groupB, numB, nameB] = key(b);
  if (groupA !== groupB) return groupA - groupB;
  if (numA !== numB) return numA - numB;
  return nameA.localeCompare(nameB);
}

async function writeIndexHtml() {
  const svgFiles = (await fs.readdir(outputDir))
    .filter(file => file.endsWith('.svg'))
    .sort(sortSvgFiles);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MEST Battlefield SVG Gallery</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 16px;
        color: #111;
      }
      .controls {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      select {
        font-size: 14px;
        padding: 4px 8px;
      }
      iframe {
        width: 100%;
        height: 900px;
        border: 1px solid #222;
      }
      .note {
        font-size: 12px;
        color: #444;
        margin-top: 8px;
      }
    </style>
  </head>
  <body>
    <h1>MEST Battlefield SVG Gallery</h1>
    <div class="controls">
      <label for="svgSelect">Select render:</label>
      <select id="svgSelect"></select>
    </div>
    <iframe id="svgFrame" title="SVG Render"></iframe>
    <div class="note">
      Layer toggles are embedded inside each SVG (click the checkbox labels in the SVG).
    </div>

    <script>
      const svgFiles = ${JSON.stringify(svgFiles, null, 2)};

      const select = document.getElementById("svgSelect");
      const frame = document.getElementById("svgFrame");

      svgFiles.forEach(file => {
        const option = document.createElement("option");
        option.value = file;
        option.textContent = file;
        select.appendChild(option);
      });

      function loadSvg(file) {
        frame.src = file;
      }

      select.addEventListener("change", () => loadSvg(select.value));

      if (svgFiles.length > 0) {
        select.value = svgFiles[0];
        loadSvg(svgFiles[0]);
      }
    </script>
  </body>
</html>
`;

  await fs.writeFile(path.join(outputDir, 'index.html'), html, 'utf8');
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

const maxCoverageRatio = 0.8;

function estimateCoverageRatio(
  battlefield: Battlefield,
  width: number,
  height: number,
  step: number,
  includeFeature: (feature: { meta?: Record<string, any>; vertices: Position[] }) => boolean
): number {
  const total = width * height;
  if (total <= 0) return 0;
  const features = battlefield.terrain.filter(includeFeature);
  if (features.length === 0) return 0;
  const halfStep = step / 2;
  let hits = 0;
  let samples = 0;
  for (let y = halfStep; y < height; y += step) {
    for (let x = halfStep; x < width; x += step) {
      samples += 1;
      const point = { x, y };
      for (const feature of features) {
        if (PathfindingEngine.isPointInPolygon(point, feature.vertices)) {
          hits += 1;
          break;
        }
      }
    }
  }
  return samples > 0 ? hits / samples : 0;
}

function buildCoverageLabel(battlefield: Battlefield): { text: string; secondaryText: string } {
  const step = 0.1;
  const nonAreaCoverage = estimateCoverageRatio(
    battlefield,
    width,
    height,
    step,
    feature => feature.meta?.category !== 'area' && feature.meta?.layer !== 'area'
  );
  const totalCoverage = estimateCoverageRatio(
    battlefield,
    width,
    height,
    step,
    () => true
  );

  const coveragePercent = Math.round(nonAreaCoverage * 100);
  const densityRatio = Math.round((nonAreaCoverage / maxCoverageRatio) * 100);

  const totalPercent = Math.round(totalCoverage * 100);
  const totalDensityRatio = Math.round((totalCoverage / maxCoverageRatio) * 100);

  return {
    text: `coverage (densityRatio): ${coveragePercent}% (${densityRatio})`,
    secondaryText: `coverage with area terrain (densityRatio): ${totalPercent}% (${totalDensityRatio})`,
  };
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
  if (feature.meta?.category === 'area' || feature.meta?.layer === 'area') {
    return false;
  }
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

async function renderBattlefieldGridCases() {
  const existing = await fs.readdir(outputDir);
  for (const file of existing) {
    if (/^battlefield-24x24-\d+_\d+\.svg$/.test(file)) {
      await fs.unlink(path.join(outputDir, file));
    }
  }
  const deployment = buildDeploymentZones(width, height);
  for (const density of densityValues) {
    if (checkRunTimeout(`grid ${density}`)) break;
    await yieldToEventLoop();
    console.log(`[generate:svg] grid density ${density}...`);
    const started = Date.now();
    const effectiveDensity = effectiveDensityRatio(density);
    const battlefield = BattlefieldFactory.create(width, height, {
      densityRatio: effectiveDensity,
      areaDensityRatio: 25,
      blockLos: 100,
      maxNonAreaSpacing,
      maxPlacementAttempts,
      maxFillerAttempts,
      maxPlacementMs,
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
      title: `Battlefield 24x24 density ${density} (effective ${effectiveDensity})`,
      coverageLabel: buildCoverageLabel(battlefield),
      deploymentZones: deployment.zones,
    });
    const filename = `battlefield-24x24-${density}.svg`;
    await writeSvg(filename, svg);
    console.log(`[generate:svg] wrote ${filename} in ${Date.now() - started}ms`);
  }
}

async function renderPathfindingCases() {
  const densities = [50, 75, 100];
  for (let index = 0; index < densities.length; index++) {
    const density = densities[index];
    if (checkRunTimeout(`pathfinding ${density}`)) break;
    await yieldToEventLoop();
    console.log(`[generate:svg] pathfinding density ${density}...`);
    const started = Date.now();
    const effectiveDensity = effectiveDensityRatio(density);
    const deployment = buildDeploymentZones(width, height);
    const battlefield = BattlefieldFactory.create(width, height, {
      densityRatio: effectiveDensity,
      areaDensityRatio: 25,
      blockLos: 25,
      maxNonAreaSpacing,
      maxPlacementAttempts,
      maxFillerAttempts,
      maxPlacementMs,
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
    let result = engine.findPath(start, end, { footprintDiameter: 1, tightSpotFraction: 0.5, clearancePenalty: 1 });
    let attempts = 0;
    while (result.totalLength < 32 && attempts < 30) {
      if (checkRunTimeout(`pathfinding ${density} attempt ${attempts + 1}`)) break;
      start = findClearPosition(battlefield, randomPosition(2, 6), 1);
      end = findClearPosition(battlefield, randomPosition(18, 22), 1);
      result = engine.findPath(start, end, { footprintDiameter: 1, tightSpotFraction: 0.5, clearancePenalty: 1 });
      attempts++;
    }

    const svg = SvgRenderer.render(battlefield, {
      width,
      height,
      title: `Pathfinding SIZ 3 density ${density} (effective ${effectiveDensity}) (len ${result.totalLength.toFixed(1)} MU)`,
      coverageLabel: buildCoverageLabel(battlefield),
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

    await writeSvg(`battlefield-24x24-pathfinding-${index + 1}.svg`, svg);
    console.log(`[generate:svg] wrote battlefield-24x24-pathfinding-${index + 1}.svg in ${Date.now() - started}ms`);
  }
}

async function renderLOSBlockedCases() {
  const cases = [
    { label: 'Unblocked', start: { x: 3, y: 3 }, end: { x: 12, y: 3 }, wallDistance: 0 },
    { label: 'Blocked ~4 MU', start: { x: 2, y: 8 }, end: { x: 10, y: 8 }, wallDistance: 4 },
    { label: 'Blocked ~16 MU', start: { x: 2, y: 18 }, end: { x: 22, y: 18 }, wallDistance: 16 },
  ];

  for (let index = 0; index < cases.length; index++) {
    const entry = cases[index];
    if (checkRunTimeout(`los ${entry.label}`)) break;
    await yieldToEventLoop();
    console.log(`[generate:svg] LOS case ${entry.label}...`);
    const started = Date.now();
    const deployment = buildDeploymentZones(width, height);
    const battlefield = BattlefieldFactory.create(width, height, {
      densityRatio: 25,
      areaDensityRatio: 25,
      blockLos: 50,
      maxNonAreaSpacing,
      maxPlacementAttempts,
      maxFillerAttempts,
      maxPlacementMs,
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
        battlefield.addTerrainElement(new TerrainElement(wallType, placement, 0), true);
      }
    }

    if (entry.wallDistance > 0) {
      battlefield.finalizeTerrain();
    }

    rays.push({ from: start, to: end, label: entry.label, color: entry.label === 'Unblocked' ? '#2d6a4f' : '#b02a37' });

    const svg = SvgRenderer.render(battlefield, {
      width,
      height,
      title: `LOS Checks (SIZ 3) blockLOS 50 - ${entry.label}`,
      coverageLabel: buildCoverageLabel(battlefield),
      deploymentZones: deployment.zones,
      models: [
        { id: 'los-model', position: start, baseDiameter: 1, color: '#f4a261', label: 'Model' },
      ],
      losRays: rays,
      annotations,
    });

    await writeSvg(`battlefield-24x24-los-${index + 1}.svg`, svg);
    console.log(`[generate:svg] wrote battlefield-24x24-los-${index + 1}.svg in ${Date.now() - started}ms`);
  }
}

async function renderLOFCases() {
  const blockLosValues = [50, 75, 100];
  for (let index = 0; index < blockLosValues.length; index++) {
    const blockLos = blockLosValues[index];
    if (checkRunTimeout(`lof ${blockLos}`)) break;
    await yieldToEventLoop();
    console.log(`[generate:svg] LOF blockLOS ${blockLos}...`);
    const started = Date.now();
    const deployment = buildDeploymentZones(width, height);
    const battlefield = BattlefieldFactory.create(width, height, {
      densityRatio: 25,
      areaDensityRatio: 25,
      blockLos,
      maxNonAreaSpacing,
      maxPlacementAttempts,
      maxFillerAttempts,
      maxPlacementMs,
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
      coverageLabel: buildCoverageLabel(battlefield),
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

    await writeSvg(`battlefield-24x24-lof-${index + 1}.svg`, svg);
    console.log(`[generate:svg] wrote battlefield-24x24-lof-${index + 1}.svg in ${Date.now() - started}ms`);
  }
}

let sigintHandled = false;
process.on('SIGINT', () => {
  if (sigintHandled) return;
  sigintHandled = true;
  writeIndexHtml()
    .catch(err => {
      console.error('Failed to write index.html after SIGINT:', err);
    })
    .finally(() => {
      process.exit(130);
    });
});

armRunTimeout();

try {
  await renderBattlefieldGridCases();
  await writeIndexHtml();
  await renderPathfindingCases();
  await writeIndexHtml();
  await renderLOSBlockedCases();
  await writeIndexHtml();
  await renderLOFCases();
} catch (err) {
  console.error('generate:svg failed:', err);
} finally {
  await writeIndexHtml();
  armWatchdog();
}
