/**
 * Deployment Exporter
 * 
 * Exports deployment data for battle reports and visualization.
 * Extracts side assemblies, model positions, and profiles.
 * 
 * @module mest-tactics/mission
 */

import { MissionSide } from './MissionSide';
import { Battlefield } from '../battlefield/Battlefield';
import { Position } from '../battlefield/Position';

/**
 * Deployment data for a single model
 */
export interface ModelDeployment {
  modelId: string;
  characterName: string;
  assemblyName: string;
  profile: string;
  position: Position;
}

/**
 * Deployment data for a single side
 */
export interface SideDeployment {
  sideId: string;
  sideName: string;
  totalBP: number;
  models: ModelDeployment[];
}

/**
 * Complete deployment export
 */
export interface DeploymentExport {
  sides: SideDeployment[];
  battlefieldSize: number;
  deploymentZones?: {
    side: string;
    yStart: number;
    yEnd: number;
  }[];
}

/**
 * Export deployment data from battlefield and sides
 */
export function exportDeployment(
  sides: MissionSide[],
  battlefield: Battlefield,
  battlefieldSize: number
): DeploymentExport {
  const deployment: DeploymentExport = {
    sides: sides.map(side => exportSideDeployment(side, battlefield)),
    battlefieldSize,
  };
  
  // Add deployment zones
  const deploymentDepth = Math.max(6, Math.floor(battlefieldSize * 0.22));
  const edgeMargin = 3;
  
  deployment.deploymentZones = sides.map((side, index) => {
    const sideStartY = index === 0
      ? edgeMargin
      : Math.max(edgeMargin, battlefieldSize - edgeMargin - deploymentDepth);
    
    return {
      side: side.id,
      yStart: sideStartY,
      yEnd: sideStartY + deploymentDepth,
    };
  });
  
  return deployment;
}

/**
 * Export single side deployment
 */
function exportSideDeployment(
  side: MissionSide,
  battlefield: Battlefield
): SideDeployment {
  return {
    sideId: side.id,
    sideName: side.name,
    totalBP: side.totalBP,
    models: side.members.map(member => {
      const pos = battlefield.getCharacterPosition(member.character);
      return {
        modelId: member.character.id,
        characterName: member.character.name || member.character.profile.name,
        assemblyName: member.assembly.name,
        profile: member.character.profile.name,
        position: pos ? { x: pos.x, y: pos.y } : { x: 0, y: 0 },
      };
    }),
  };
}

/**
 * Write deployment export to file (Node.js environment)
 */
export function writeDeploymentExport(
  exportData: DeploymentExport,
  outputPath: string
): void {
  const { writeFileSync } = require('node:fs');
  writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
}

/**
 * Format deployment for human-readable output
 */
export function formatDeploymentHuman(exportData: DeploymentExport): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════');
  lines.push('🏗️  DEPLOYMENT');
  lines.push('═══════════════════════════════════════');
  lines.push(`Battlefield: ${exportData.battlefieldSize}×${exportData.battlefieldSize} MU`);
  lines.push('');
  
  for (const side of exportData.sides) {
    lines.push(`${side.sideName} (${side.totalBP} BP)`);
    lines.push('───────────────────────────────────────');
    
    for (const model of side.models) {
      lines.push(`  ${model.modelId}: ${model.characterName}`);
      lines.push(`    Profile: ${model.profile}`);
      lines.push(`    Position: (${model.position.x}, ${model.position.y})`);
    }
    lines.push('');
  }
  
  if (exportData.deploymentZones) {
    lines.push('Deployment Zones:');
    lines.push('───────────────────────────────────────');
    for (const zone of exportData.deploymentZones) {
      lines.push(`  ${zone.side}: Y=${zone.yStart}-${zone.yEnd}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}
