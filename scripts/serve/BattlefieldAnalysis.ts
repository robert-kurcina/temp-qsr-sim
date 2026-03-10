import { Battlefield } from '../../src/lib/mest-tactics/battlefield/Battlefield';
import { TerrainType } from '../../src/lib/mest-tactics/battlefield/terrain/Terrain';

export interface AgilityOpportunity {
  type: 'bypass' | 'climb_up' | 'climb_down' | 'jump_up' | 'jump_down' | 'jump_across' | 'running_jump' | 'moving_through';
  position: { x: number; y: number };
  muCost: number;
  muSaved: number;
  optimal: boolean;
  description: string;
}

export interface AgilityAnalysisResult {
  pathLength: number;
  baseMuCost: number;
  agilityMuCost: number;
  muSaved: number;
  opportunities: AgilityOpportunity[];
  optimalPath: boolean;
  recommendations: string[];
}

function segmentsIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): boolean {
  const denominator = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denominator) < 1e-6) return false;
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denominator;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function analyzePathForAgility(
  battlefield: Battlefield,
  path: Array<{ x: number; y: number }>,
  character: { mov: number; siz: number; baseDiameter: number }
): AgilityAnalysisResult {
  const opportunities: AgilityOpportunity[] = [];
  let baseMuCost = 0;
  let agilityMuCost = 0;
  const agility = character.mov * 0.5;

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);

    const terrainUnderPath = battlefield.terrain.filter(feature => {
      for (let j = 0; j < feature.vertices.length - 1; j++) {
        const v1 = feature.vertices[j];
        const v2 = feature.vertices[j + 1];
        if (segmentsIntersect(from, to, v1, v2)) {
          return true;
        }
      }
      return false;
    });

    for (const feature of terrainUnderPath) {
      const terrainType = feature.type;
      const category = feature.meta?.category || '';

      if (terrainType === TerrainType.Rough || terrainType === TerrainType.Difficult) {
        const requiredAgility = character.baseDiameter / 2;
        if (agility >= requiredAgility) {
          opportunities.push({
            type: 'bypass',
            position: from,
            muCost: requiredAgility,
            muSaved: segmentLength,
            optimal: true,
            description: `Bypass ${category || terrainType} terrain (Agility ${agility} >= ${requiredAgility} MU required)`,
          });
          agilityMuCost += requiredAgility;
        } else {
          baseMuCost += segmentLength * 2;
        }
      }

      const meta = feature.meta as any;
      const height = meta?.height || 0;
      if (height > 0) {
        if (height <= character.baseDiameter) {
          const handsRequired = 2;
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

    if (terrainUnderPath.length === 0) {
      baseMuCost += segmentLength;
    }
  }

  const muSaved = baseMuCost - agilityMuCost;
  const optimalPath = muSaved >= 0;

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

  const opportunitiesWithMarkers = opportunities.map(opp => ({
    ...opp,
    svgMarker: {
      type: opp.optimal ? 'optimal' : opp.muSaved < 0 ? 'missed' : 'sub-optimal',
      cx: opp.position.x,
      cy: opp.position.y,
      r: 0.5,
      color: opp.optimal ? '#4ade80' : opp.muSaved < 0 ? '#f87171' : '#fbbf24',
      label: opp.type.replace('_', ' ').toUpperCase(),
    },
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
