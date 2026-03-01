#!/usr/bin/env node
/**
 * Battle Audit Dashboard Server
 *
 * Serves the unified battle audit dashboard on port 3001.
 * Provides API endpoints for battle listing, SVG, audit, and summary data.
 *
 * Usage:
 *   npx tsx scripts/serve-terrain-audit.ts
 *
 * Then open: http://localhost:3001
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { generateBattleSummary, formatSummaryAsText } from './ai-battle/reporting/BattleSummaryFormatter';
import { INDEX_PATH } from './generate-battle-index';
import { generateBattlefield } from './battlefield-generator';
import { PathfindingEngine } from '../src/lib/mest-tactics/battlefield/pathfinding/PathfindingEngine';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { LOSOperations } from '../src/lib/mest-tactics/battlefield/los/LOSOperations';
import { LOFOperations } from '../src/lib/mest-tactics/battlefield/los/LOFOperations';
import { SpatialRules } from '../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { TerrainFeature, TerrainType } from '../src/lib/mest-tactics/battlefield/terrain/Terrain';

// Kill any existing server on port 3001
function killExistingServer(port: number) {
  try {
    // Find process using port 3001
    const result = execSync(`lsof -ti :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (result) {
      const pids = result.split('\n');
      console.log(`🔍 Found ${pids.length} process(es) using port ${port}, killing...`);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          console.log(`   ✓ Killed process ${pid}`);
        } catch (e) {
          // Process may have already exited
        }
      }
      // Wait a moment for port to be released
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  } catch (e) {
    // No process found on port, which is fine
  }
}

// Kill existing server before starting
killExistingServer(3001);

const PORT = 3001;
const DASHBOARD_PATH = path.join(process.cwd(), 'src', 'lib', 'mest-tactics', 'viewer', 'audit-dashboard.html');
const BATTLE_REPORTS_DIR = path.join(process.cwd(), 'generated', 'ai-battle-reports');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

interface BattleIndexEntry {
  id: string;
  timestamp: string;
  missionId: string;
  missionName: string;
  gameSize: string;
  seed?: number;
  turnsCompleted: number;
  winner: string;
  totalActions: number;
  fitness?: string;
}

// Get list of all battles (with optional filtering)
function getBattleIndex(filters?: { mission?: string; gameSize?: string; date?: string; winner?: string }): BattleIndexEntry[] {
  try {
    // Try to use pre-generated index first
    if (fs.existsSync(INDEX_PATH)) {
      const content = fs.readFileSync(INDEX_PATH, 'utf-8');
      const index = JSON.parse(content);
      let battles = index.battles || [];
      
      // Apply filters
      if (filters?.mission) {
        battles = battles.filter(b => b.missionId === filters.mission);
      }
      if (filters?.gameSize) {
        battles = battles.filter(b => b.gameSize === filters.gameSize);
      }
      if (filters?.date) {
        battles = battles.filter(b => b.date === filters.date);
      }
      if (filters?.winner) {
        battles = battles.filter(b => b.winner === filters.winner);
      }
      
      return battles;
    }
    
    // Fallback: generate index on the fly
    const files = fs.readdirSync(BATTLE_REPORTS_DIR)
      .filter(f => f.endsWith('.json') && f.startsWith('battle-report-'));
    
    return files.map(file => {
      const filePath = path.join(BATTLE_REPORTS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      return {
        id: file.replace('.json', ''),
        timestamp: file.match(/battle-report-(.+)\.json/)?.[1] || file,
        missionId: data.config?.missionId || 'Unknown',
        missionName: data.config?.missionName || 'Unknown',
        gameSize: data.config?.gameSize || 'Unknown',
        seed: data.seed,
        turnsCompleted: data.stats?.turnsCompleted || 0,
        winner: data.winner || 'Unknown',
        totalActions: data.stats?.totalActions || 0,
        fitness: 'Good',
      };
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch (error) {
    console.error('Error reading battle reports:', error);
    return [];
  }
}

// Get battle audit data
function getBattleAudit(battleId: string): object | null {
  try {
    const filePath = path.join(BATTLE_REPORTS_DIR, `${battleId}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// Get battle SVG
function getBattleSvg(battleId: string): string | null {
  try {
    // Extract timestamp portion from battle ID (battle-report-TIMESTAMP)
    const timestampMatch = battleId.match(/battle-report-(.+)/);
    if (!timestampMatch) return null;
    
    const battleTimestamp = timestampMatch[1]; // e.g., "2026-02-28T19-57-41-914Z"
    // Get just the main part without milliseconds for matching
    const mainTimestamp = battleTimestamp.substring(0, battleTimestamp.length - 5); // Remove last 4 chars + Z
    
    // Find SVG file that matches the battle timestamp
    const files = fs.readdirSync(BATTLE_REPORTS_DIR)
      .filter(f => f.endsWith('.svg') && f.startsWith('battlefield-'))
      .filter(f => {
        const svgTimestamp = f.replace('battlefield-', '').replace('.svg', '');
        // Match if timestamps are within 10 seconds of each other
        return svgTimestamp.startsWith(mainTimestamp.substring(0, mainTimestamp.length - 1));
      });
    
    if (files.length === 0) return null;
    
    const filePath = path.join(BATTLE_REPORTS_DIR, files[0]);
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error('Error getting SVG:', error);
    return null;
  }
}

// Generate human-readable summary
function getBattleSummary(battleId: string): object | null {
  try {
    const filePath = path.join(BATTLE_REPORTS_DIR, `${battleId}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const report = JSON.parse(content);
    
    const summary = generateBattleSummary(report);
    return {
      text: formatSummaryAsText(summary),
      structured: summary,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Analyze a path for Agility optimization opportunities
 */
interface AgilityOpportunity {
  type: 'bypass' | 'climb_up' | 'climb_down' | 'jump_up' | 'jump_down' | 'jump_across' | 'running_jump' | 'moving_through';
  position: { x: number; y: number };
  muCost: number;
  muSaved: number;
  optimal: boolean;
  description: string;
}

interface AgilityAnalysisResult {
  pathLength: number;
  baseMuCost: number;
  agilityMuCost: number;
  muSaved: number;
  opportunities: AgilityOpportunity[];
  optimalPath: boolean;
  recommendations: string[];
}

function analyzePathForAgility(
  battlefield: Battlefield,
  path: Array<{ x: number; y: number }>,
  character: { mov: number; siz: number; baseDiameter: number }
): AgilityAnalysisResult {
  const opportunities: AgilityOpportunity[] = [];
  let baseMuCost = 0;
  let agilityMuCost = 0;
  const agility = character.mov * 0.5;

  // Analyze each segment of the path
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);
    
    // Check terrain along this segment
    const terrainUnderPath = battlefield.terrain.filter(feature => {
      // Check if segment intersects or passes through terrain
      for (let j = 0; j < feature.vertices.length - 1; j++) {
        const v1 = feature.vertices[j];
        const v2 = feature.vertices[j + 1];
        if (segmentsIntersect(from, to, v1, v2)) {
          return true;
        }
      }
      return false;
    });

    // Analyze terrain for Agility opportunities
    for (const feature of terrainUnderPath) {
      const terrainType = feature.type;
      const category = feature.meta?.category || '';
      
      // Bypass: Rough or Difficult terrain
      if (terrainType === TerrainType.Rough || terrainType === TerrainType.Difficult) {
        const requiredAgility = character.baseDiameter / 2;
        if (agility >= requiredAgility) {
          opportunities.push({
            type: 'bypass',
            position: from,
            muCost: requiredAgility,
            muSaved: segmentLength, // Bypass makes terrain Clear
            optimal: true,
            description: `Bypass ${category || terrainType} terrain (Agility ${agility} >= ${requiredAgility} MU required)`,
          });
          agilityMuCost += requiredAgility;
        } else {
          baseMuCost += segmentLength * 2; // Difficult terrain costs double
        }
      }
      
      // Climb up/down: Height changes
      const height = feature.meta?.height || 0;
      if (height > 0) {
        if (height <= character.baseDiameter) {
          const handsRequired = 2; // Simplified
          opportunities.push({
            type: height > 0 ? 'climb_up' : 'climb_down',
            position: from,
            muCost: Math.min(agility, Math.abs(height)),
            muSaved: 0,
            optimal: true,
            description: `Climb ${Math.abs(height)} MU (${handsRequired}H required)`,
          });
          agilityMuCost += Math.min(agility, Math.abs(height));
        }
      }
      
      // Jump up: Up to half Agility
      if (height > 0 && height <= agility / 2) {
        opportunities.push({
          type: 'jump_up',
          position: from,
          muCost: height,
          muSaved: 0,
          optimal: true,
          description: `Jump up ${height} MU (within ${agility / 2} MU max)`,
        });
      }
      
      // Jump down: Up to Agility
      if (height < 0 && Math.abs(height) <= agility) {
        const woundAdded = Math.abs(height) >= agility - 0.5;
        opportunities.push({
          type: 'jump_down',
          position: from,
          muCost: Math.abs(height),
          muSaved: 0,
          optimal: !woundAdded,
          description: `Jump down ${Math.abs(height)} MU${woundAdded ? ' - WOUND!' : ''}`,
        });
      }
    }
    
    // Check for gaps (jump across)
    // Simplified: assume gaps are detected by path discontinuity
    if (segmentLength > 1 && segmentLength <= agility) {
      opportunities.push({
        type: 'jump_across',
        position: from,
        muCost: segmentLength,
        muSaved: 0,
        optimal: true,
        description: `Jump across ${segmentLength.toFixed(1)} MU gap`,
      });
    }
    
    // Running jump: If segment is long and straight
    if (segmentLength > agility && segmentLength <= agility + agility / 2) {
      opportunities.push({
        type: 'running_jump',
        position: from,
        muCost: segmentLength,
        muSaved: 0,
        optimal: true,
        description: `Running jump ${segmentLength.toFixed(1)} MU (+${(segmentLength - agility).toFixed(1)} bonus)`,
      });
    }
    
    // Base cost for normal movement
    if (terrainUnderPath.length === 0) {
      baseMuCost += segmentLength;
    }
  }

  const muSaved = baseMuCost - agilityMuCost;
  const optimalPath = muSaved >= 0;

  // Generate recommendations
  const recommendations: string[] = [];
  if (!optimalPath) {
    recommendations.push('Path uses more MU than base movement - consider alternative route');
  }
  if (opportunities.length === 0) {
    recommendations.push('No Agility opportunities detected on this path');
  }
  const bypassCount = opportunities.filter(o => o.type === 'bypass').length;
  if (bypassCount > 0) {
    recommendations.push(`Bypass used ${bypassCount} time(s) - saves movement through difficult terrain`);
  }

  // Add SVG marker data for each opportunity
  const opportunitiesWithMarkers = opportunities.map(opp => ({
    ...opp,
    svgMarker: {
      type: opp.optimal ? 'optimal' : opp.muSaved < 0 ? 'missed' : 'sub-optimal',
      cx: opp.position.x,
      cy: opp.position.y,
      r: 0.5,
      color: opp.optimal ? '#4ade80' : opp.muSaved < 0 ? '#f87171' : '#fbbf24',
      label: opp.type.replace('_', ' ').toUpperCase(),
    }
  }));

  return {
    pathLength: path.length,
    baseMuCost: Math.round(baseMuCost * 10) / 10,
    agilityMuCost: Math.round(agilityMuCost * 10) / 10,
    muSaved: Math.round(muSaved * 10) / 10,
    opportunities: opportunitiesWithMarkers,
    optimalPath,
    recommendations,
  };
}

/**
 * Check if two line segments intersect (helper for agility analysis)
 */
function segmentsIntersect(p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }, p4: { x: number; y: number }): boolean {
  const denominator = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denominator) < 1e-6) return false;
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denominator;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API: List all battles (with optional filtering)
  if (req.url === '/api/battles' || req.url?.startsWith('/api/battles?')) {
    const url = new URL(req.url || '/', 'http://localhost');
    const filters = {
      mission: url.searchParams.get('mission') || undefined,
      gameSize: url.searchParams.get('gameSize') || undefined,
      date: url.searchParams.get('date') || undefined,
      winner: url.searchParams.get('winner') || undefined,
    };
    
    const battles = getBattleIndex(filters);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(battles));
    return;
  }

  // API: Get battle audit
  if (req.url?.match(/^\/api\/battles\/([^\/]+)\/audit$/)) {
    const battleId = req.url.match(/^\/api\/battles\/([^\/]+)\/audit$/)?.[1];
    if (battleId) {
      const audit = getBattleAudit(battleId);
      if (audit) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(audit));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Battle not found' }));
      }
    }
    return;
  }

  // API: Get battle SVG
  if (req.url?.match(/^\/api\/battles\/([^\/]+)\/svg$/)) {
    const battleId = req.url.match(/^\/api\/battles\/([^\/]+)\/svg$/)?.[1];
    if (battleId) {
      const svg = getBattleSvg(battleId);
      if (svg) {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        res.end(svg);
      } else {
        res.writeHead(404);
        res.end('SVG not found');
      }
    }
    return;
  }

  // API: Get battle summary
  if (req.url?.match(/^\/api\/battles\/([^\/]+)\/summary$/)) {
    const battleId = req.url.match(/^\/api\/battles\/([^\/]+)\/summary$/)?.[1];
    if (battleId) {
      const summary = getBattleSummary(battleId);
      if (summary) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(summary));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Battle not found' }));
      }
    }
    return;
  }

  // API: Generate battlefield
  if (req.url === '/api/battlefields/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const config = JSON.parse(body);
        
        // Validate request
        if (!config.gameSize || !config.terrainDensities) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: gameSize, terrainDensities' }));
          return;
        }

        // Generate battlefield
        const result = await generateBattlefield({
          gameSize: config.gameSize,
          terrainDensities: config.terrainDensities,
          seed: config.seed,
        });

        if (result.success) {
          // Regenerate battle index to include new battlefield
          try {
            await import('./generate-battle-index.js').then(m => m.generateBattleIndex?.());
          } catch (e) {
            // Index regeneration is optional
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: result.error || 'Generation failed' }));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorMessage }));
      }
    });
    return;
  }

  // API: Calculate pathfinding
  if (req.url === '/api/battlefields/pathfind' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const config = JSON.parse(body);
        
        // Validate request
        if (!config.battlefieldId || !config.start || !config.end) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: battlefieldId, start, end' }));
          return;
        }

        // Load battlefield JSON
        const battlefieldPath = path.join(process.cwd(), 'generated', 'battlefields', `${config.battlefieldId}.json`);
        if (!fs.existsSync(battlefieldPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Battlefield not found' }));
          return;
        }

        const battlefieldData = JSON.parse(fs.readFileSync(battlefieldPath, 'utf-8'));
        
        // Create battlefield and load terrain
        const battlefield = new Battlefield(
          battlefieldData.dimensions?.width || 24,
          battlefieldData.dimensions?.height || 24
        );
        
        // Load terrain from battlefield data
        if (battlefieldData.terrainInstances) {
          // Reconstruct terrain from export format
          // For now, use a simplified approach
        }

        // Create pathfinding engine
        const pathfinder = new PathfindingEngine(battlefield, {
          gridResolution: 0.5,
          footprintDiameter: config.footprintDiameter || 1.0,
        });

        // Calculate path
        const pathResult = pathfinder.findPathLimited(
          config.start,
          config.end,
          config.movementAllowance || 6
        );

        // Format response
        const response = {
          success: true,
          path: {
            points: pathResult.points || [],
            vectors: pathResult.vectors || [],
            totalLength: pathResult.totalLength || 0,
            totalEffectiveMu: pathResult.totalEffectMu || 0,
            reachable: pathResult.reachedEnd || false,
            remainingMu: pathResult.remainingMu || 0,
          },
          gridCells: config.showGrid ? [] : undefined,
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorMessage }));
      }
    });
    return;
  }

  // API: Analyze Agility optimization for path
  if (req.url === '/api/battlefields/analyze-agility' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const config = JSON.parse(body);
        
        // Validate request
        if (!config.battlefieldId || !config.path) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: battlefieldId, path' }));
          return;
        }

        // Load battlefield JSON
        const battlefieldPath = path.join(process.cwd(), 'generated', 'battlefields', `${config.battlefieldId}.json`);
        if (!fs.existsSync(battlefieldPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Battlefield not found' }));
          return;
        }

        const battlefieldData = JSON.parse(fs.readFileSync(battlefieldPath, 'utf-8'));
        const battlefield = new Battlefield(
          battlefieldData.dimensions?.width || 24,
          battlefieldData.dimensions?.height || 24
        );

        // Analyze path for Agility opportunities
        const agilityAnalysis = analyzePathForAgility(battlefield, config.path, config.character);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(agilityAnalysis));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorMessage }));
      }
    });
    return;
  }

  // API: Check LOS and Cover
  if (req.url === '/api/battlefields/los-check' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const config = JSON.parse(body);
        
        // Validate request
        if (!config.battlefieldId || !config.activeModel || !config.target) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: battlefieldId, activeModel, target' }));
          return;
        }

        // Load battlefield JSON
        const battlefieldPath = path.join(process.cwd(), 'generated', 'battlefields', `${config.battlefieldId}.json`);
        if (!fs.existsSync(battlefieldPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Battlefield not found' }));
          return;
        }

        const battlefieldData = JSON.parse(fs.readFileSync(battlefieldPath, 'utf-8'));
        
        // Create battlefield
        const battlefield = new Battlefield(
          battlefieldData.dimensions?.width || 24,
          battlefieldData.dimensions?.height || 24
        );

        // Create spatial models for LOS/LOF check
        const activeModel = {
          id: 'active',
          position: config.activeModel.position,
          baseDiameter: config.activeModel.baseDiameter || 1,
          siz: config.activeModel.siz || 3,
        };

        const targetModel = {
          id: 'target',
          position: config.target.position,
          baseDiameter: config.target.baseDiameter || 1,
          siz: config.target.siz || 3,
        };

        // Check LOS
        const hasLOS = SpatialRules.hasLineOfSight(battlefield, activeModel, targetModel);
        
        // Get cover result
        const coverResult = SpatialRules.getCoverResult(battlefield, activeModel, targetModel);

        // Calculate LOF arc if requested
        let lofResult = undefined;
        if (config.showLofArc) {
          lofResult = {
            hasLOF: hasLOS,
            arcDegrees: 60,
            targetsInArc: [],
          };
        }

        // Format response
        const response = {
          success: true,
          los: {
            hasLOS,
            blockedBy: hasLOS ? undefined : 'terrain',
            blockingPoints: [],
          },
          cover: {
            hasDirectCover: coverResult.hasDirectCover,
            hasInterveningCover: coverResult.hasInterveningCover,
            directCoverType: coverResult.directCoverFeatures.length > 0 
              ? (coverResult.directCoverFeatures[0].meta?.los === 'Hard' ? 'hard' : 'soft')
              : undefined,
            interveningCoverType: coverResult.interveningCoverFeatures.length > 0
              ? (coverResult.interveningCoverFeatures[0].meta?.los === 'Hard' ? 'hard' : 'soft')
              : undefined,
            blockingFeature: coverResult.blockingFeature?.type,
            coveringModel: coverResult.coveringModelId,
            coverResult: coverResult.hasDirectCover || coverResult.hasInterveningCover
              ? (coverResult.hasDirectCover && coverResult.directCoverFeatures.some(f => f.meta?.los === 'Hard') ? 'hard' : 'soft')
              : 'none',
          },
          lof: lofResult,
          vectors: {
            losVector: {
              from: config.activeModel.position,
              to: config.target.position,
              length: LOSOperations.distance(config.activeModel.position, config.target.position),
            },
            lofArc: config.showLofArc ? {
              center: config.activeModel.position,
              direction: 0,
              arcDegrees: 60,
              radius: 16,
            } : undefined,
          },
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorMessage }));
      }
    });
    return;
  }

  // Serve static assets from /assets/
  if (req.url?.startsWith('/assets/')) {
    const filePath = path.join(process.cwd(), req.url || '');
    
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Asset not found');
        return;
      }
      
      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
    return;
  }

  // API: List battlefields
  if (req.url === '/api/battlefields') {
    const battlefieldsDir = path.join(process.cwd(), 'generated', 'battlefields');

    fs.readdir(battlefieldsDir, (err, files) => {
      if (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to read battlefields directory' }));
        return;
      }

      // Get unique battlefield names (without extension)
      const jsonFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.svg.json'));
      const battlefields = jsonFiles.map(f => ({
        name: f.replace('.json', ''),
        jsonPath: `/api/battlefields/${f}`,
        svgPath: `/api/battlefields/${f.replace('.json', '.svg')}`
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(battlefields));
    });
    return;
  }

  // API: Get battlefield JSON
  if (req.url?.match(/^\/api\/battlefields\/([^\/]+)\.json$/)) {
    const match = req.url.match(/^\/api\/battlefields\/([^\/]+)\.json$/);
    if (match) {
      const battlefieldName = match[1];
      const filePath = path.join(process.cwd(), 'generated', 'battlefields', `${battlefieldName}.json`);
      
      fs.readFile(filePath, 'utf8', (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Battlefield not found');
          return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(content);
      });
      return;
    }
  }

  // API: Get battlefield SVG
  if (req.url?.match(/^\/api\/battlefields\/([^\/]+)\.svg$/)) {
    const match = req.url.match(/^\/api\/battlefields\/([^\/]+)\.svg$/);
    if (match) {
      const battlefieldName = match[1];
      const filePath = path.join(process.cwd(), 'generated', 'battlefields', `${battlefieldName}.svg`);

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Battlefield SVG not found');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        res.end(content);
      });
      return;
    }
  }

  // Serve dashboard
  if (req.url === '/' || req.url === '/dashboard') {
    fs.readFile(DASHBOARD_PATH, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end(`Error loading dashboard: ${err.message}`);
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
    return;
  }

  // Handle generated battle reports (legacy)
  if (req.url?.startsWith('/battle-report-')) {
    const filePath = path.join(process.cwd(), 'generated', 'battle-reports', req.url || '');

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Battle report not found');
        return;
      }

      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
    return;
  }

  // Handle audit.json files (legacy)
  if (req.url?.endsWith('/audit.json')) {
    const filePath = path.join(process.cwd(), 'generated', 'battle-reports', req.url || '');

    fs.readFile(filePath, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Audit file not found');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(content);
    });
    return;
  }

  // 404 for everything else
  res.writeHead(404);
  res.end('Not found. Try /dashboard or /api/battles');
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║        ⚔️  Battle Audit Dashboard Running                 ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Open in browser:                                         ║
║  → http://localhost:${PORT}/dashboard                      ║
║                                                           ║
║  Dashboard Tabs:                                          ║
║  → Tab 1: 🗺️ Battlefields (SVG previews)                  ║
║  → Tab 2: 🎬 Visual Audit (timeline viewer)               ║
║  → Tab 3: 📊 Summary (human-readable)                     ║
║  → Tab 4: 🖼️ Portraits (sheet review)                     ║
║                                                           ║
║  API Endpoints:                                           ║
║  → GET /api/battles         - List all battles            ║
║  → GET /api/battles/:id/svg - Get battlefield SVG         ║
║  → GET /api/battles/:id/audit - Get full audit JSON       ║
║  → GET /api/battles/:id/summary - Get human-readable      ║
║                                                           ║
║  Assets:                                                  ║
║  → /assets/portraits/*      - Portrait sheets             ║
║                                                           ║
║  Legacy URLs:                                             ║
║  → /battle-report-*/audit.json                            ║
║  → /battle-report-*/battle-report.html                    ║
║                                                           ║
║  Press Ctrl+C to stop                                     ║
╚═══════════════════════════════════════════════════════════╝
`);
});
