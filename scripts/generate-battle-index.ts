#!/usr/bin/env node
/**
 * Battle Index Generator
 * 
 * Scans generated battle reports and creates a searchable index file.
 * Run after battles to update the index.
 * 
 * Usage:
 *   npx tsx scripts/generate-battle-index.ts
 */

import fs from 'fs';
import path from 'path';

const BATTLE_REPORTS_DIR = path.join(process.cwd(), 'generated', 'ai-battle-reports');
const VISUAL_REPORTS_DIR = path.join(process.cwd(), 'generated', 'battle-reports');
const INDEX_PATH = path.join(BATTLE_REPORTS_DIR, 'battle-index.json');

interface BattleIndexEntry {
  id: string;
  timestamp: string;
  date: string;
  missionId: string;
  missionName: string;
  gameSize: string;
  seed?: number;
  turnsCompleted: number;
  winner: string;
  totalActions: number;
  totalEliminations: number;
  totalKOs: number;
  sides: Array<{
    name: string;
    models: number;
    bp: number;
    doctrine: string;
  }>;
  fitness?: string;
  tags: string[];
  svgAvailable: boolean;
  auditAvailable: boolean;
  summaryAvailable: boolean;
}

interface BattleIndex {
  version: string;
  generatedAt: string;
  totalBattles: number;
  battles: BattleIndexEntry[];
  // Indexes for fast lookup
  byMission: Record<string, string[]>;
  byGameSize: Record<string, string[]>;
  byDate: Record<string, string[]>;
  byWinner: Record<string, string[]>;
}

function scanBattleReports(): BattleIndexEntry[] {
  const entries: BattleIndexEntry[] = [];
  
  try {
    const files = fs.readdirSync(BATTLE_REPORTS_DIR)
      .filter(f => f.endsWith('.json') && f.startsWith('battle-report-'));
    
    for (const file of files) {
      try {
        const filePath = path.join(BATTLE_REPORTS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const report = JSON.parse(content);
        
        const battleId = file.replace('.json', '');
        const timestamp = battleId.replace('battle-report-', '');
        const date = timestamp.split('T')[0];
        
        // Count eliminations and KOs from audit
        let eliminations = 0;
        let kos = 0;
        
        if (report.audit?.turns) {
          report.audit.turns.forEach((turn: any) => {
            turn.activations.forEach((act: any) => {
              act.steps.forEach((step: any) => {
                if (step.details?.eliminated) eliminations++;
                if (step.details?.ko) kos++;
              });
            });
          });
        }
        
        // Check for associated files
        const svgAvailable = fs.readdirSync(BATTLE_REPORTS_DIR)
          .some(f => f.endsWith('.svg') && f.includes(timestamp.substring(0, timestamp.length - 5)));
        
        const hasInlineAudit = Boolean(report.audit && Array.isArray(report.audit.turns));
        const hasVisualAudit = fs.existsSync(path.join(VISUAL_REPORTS_DIR, battleId, 'audit.json'));
        const entry: BattleIndexEntry = {
          id: battleId,
          timestamp,
          date,
          missionId: report.config?.missionId || 'Unknown',
          missionName: report.config?.missionName || 'Unknown',
          gameSize: report.config?.gameSize || 'Unknown',
          seed: report.seed,
          turnsCompleted: report.stats?.turnsCompleted || 0,
          winner: report.winner || 'Unknown',
          totalActions: report.stats?.totalActions || 0,
          totalEliminations: eliminations,
          totalKOs: kos,
          sides: report.config?.sides?.map((s: any) => ({
            name: s.name,
            models: s.modelCount,
            bp: s.bp,
            doctrine: s.tacticalDoctrine || 'Unknown',
          })) || [],
          fitness: 'Good', // TODO: Calculate actual fitness score
          tags: generateTags(report, eliminations, kos),
          svgAvailable,
          auditAvailable: hasInlineAudit || hasVisualAudit,
          summaryAvailable: true,
        };
        
        entries.push(entry);
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
      }
    }
    
    // Sort by timestamp (newest first)
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
  } catch (error) {
    console.error('Error scanning battle reports:', error);
  }
  
  return entries;
}

function generateTags(report: any, eliminations: number, kos: number): string[] {
  const tags: string[] = [];
  
  // Battle length tags
  const turns = report.stats?.turnsCompleted || 0;
  if (turns <= 3) tags.push('short');
  else if (turns <= 6) tags.push('medium');
  else tags.push('long');
  
  // Action intensity tags
  const actions = report.stats?.totalActions || 0;
  if (actions < 50) tags.push('low-action');
  else if (actions < 150) tags.push('moderate');
  else tags.push('high-action');
  
  // Combat intensity tags
  if (eliminations > 5) tags.push('bloody');
  if (kos > 3) tags.push('brutal');
  
  // Outcome tags
  if (report.winner === 'Draw') tags.push('stalemate');
  else tags.push('decisive');
  
  // Mission-specific tags
  if (report.config?.missionId) {
    tags.push(report.config.missionId.toLowerCase());
  }
  
  return tags;
}

function buildIndexes(battles: BattleIndexEntry[]): BattleIndex {
  const index: BattleIndex = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    totalBattles: battles.length,
    battles,
    byMission: {},
    byGameSize: {},
    byDate: {},
    byWinner: {},
  };
  
  battles.forEach(battle => {
    // Index by mission
    if (!index.byMission[battle.missionId]) {
      index.byMission[battle.missionId] = [];
    }
    index.byMission[battle.missionId].push(battle.id);
    
    // Index by game size
    if (!index.byGameSize[battle.gameSize]) {
      index.byGameSize[battle.gameSize] = [];
    }
    index.byGameSize[battle.gameSize].push(battle.id);
    
    // Index by date
    if (!index.byDate[battle.date]) {
      index.byDate[battle.date] = [];
    }
    index.byDate[battle.date].push(battle.id);
    
    // Index by winner
    if (!index.byWinner[battle.winner]) {
      index.byWinner[battle.winner] = [];
    }
    index.byWinner[battle.winner].push(battle.id);
  });
  
  return index;
}

function generateIndex(): void {
  console.log('🔍 Scanning battle reports...');
  
  const battles = scanBattleReports();
  console.log(`📊 Found ${battles.length} battles`);
  
  console.log('📑 Building indexes...');
  const index = buildIndexes(battles);
  
  console.log('💾 Writing index file...');
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
  
  console.log(`✅ Index generated: ${INDEX_PATH}`);
  console.log('');
  console.log('📈 Index Summary:');
  console.log(`   Total Battles: ${index.totalBattles}`);
  console.log(`   Missions: ${Object.keys(index.byMission).length}`);
  console.log(`   Game Sizes: ${Object.keys(index.byGameSize).length}`);
  console.log(`   Dates: ${Object.keys(index.byDate).length}`);
  console.log('');
  console.log('🔗 Access via API:');
  console.log('   GET /api/battles - List all battles');
  console.log('   GET /api/battles?mission=QAI_11 - Filter by mission');
  console.log('   GET /api/battles?gameSize=VERY_SMALL - Filter by size');
  console.log('   GET /api/battles?date=2026-02-28 - Filter by date');
}

// Run if executed directly
if (process.argv[1]?.endsWith('generate-battle-index.ts')) {
  generateIndex();
}

// Export for use in server
export { generateIndex, INDEX_PATH };
