import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { generateBattlefield } from '../../battlefield-generator';
import { loadBattlefieldFromFile } from '../../../src/lib/mest-tactics/battlefield/BattlefieldExporter';
import { LOSOperations } from '../../../src/lib/mest-tactics/battlefield/los/LOSOperations';
import { PathfindingEngine } from '../../../src/lib/mest-tactics/battlefield/pathfinding/PathfindingEngine';
import { SpatialRules } from '../../../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { analyzePathForAgility } from '../BattlefieldAnalysis';
import { parseJsonBody, sendJson, sendText } from '../HttpUtils';
import {
  getBattlefieldFileById,
  getBattlefieldFileByPath,
  listBattlefieldFiles,
} from '../../shared/BattlefieldPaths';

function resolveBattlefieldRecord(requestedId: string | undefined) {
  const id = String(requestedId || '').trim();
  if (!id || id === 'latest') {
    const all = listBattlefieldFiles();
    return all.length > 0 ? all[all.length - 1] : null;
  }
  return getBattlefieldFileById(id);
}

export async function handleBattlefieldRoutes(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '/';

  if (url === '/api/battlefields/generate' && req.method === 'POST') {
    try {
      const config = await parseJsonBody(req);
      if (!config.gameSize) {
        sendJson(res, 400, { error: 'Missing required field: gameSize' });
        return true;
      }

      const args = Array.isArray(config.args)
        ? config.args.filter((token: unknown): token is string => typeof token === 'string' && token.trim().length > 0)
        : [];
      const mode =
        config.mode === 'fast' || config.mode === 'balanced' || config.mode === 'thorough'
          ? config.mode
          : undefined;

      const result = await generateBattlefield({
        gameSize: config.gameSize,
        args,
        mode,
        seed: config.seed,
      });

      if (!result.success) {
        sendJson(res, 500, { error: result.error || 'Generation failed' });
        return true;
      }

      const generatedRecord = getBattlefieldFileByPath(result.battlefieldPath);
      if (generatedRecord) {
        result.battlefieldId = generatedRecord.id;
      }

      try {
        await import('../../generate-battle-index.js').then(m => (m as any).generateBattleIndex?.());
      } catch {
        // optional index regeneration
      }

      sendJson(res, 200, result);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sendJson(res, 500, { error: errorMessage });
      return true;
    }
  }

  if (url === '/api/battlefields/pathfind' && req.method === 'POST') {
    try {
      const config = await parseJsonBody(req);
      if (!config.battlefieldId || !config.start || !config.end) {
        sendJson(res, 400, { error: 'Missing required fields: battlefieldId, start, end' });
        return true;
      }

      const record = resolveBattlefieldRecord(config.battlefieldId);
      if (!record) {
        sendJson(res, 404, { error: 'Battlefield not found' });
        return true;
      }

      const battlefield = loadBattlefieldFromFile(record.jsonPath);
      const pathfinder = new PathfindingEngine(battlefield);
      const pathResult = (pathfinder as any).findPathLimited(
        config.start,
        config.end,
        config.movementAllowance || 6
      );

      sendJson(res, 200, {
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
      });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sendJson(res, 500, { error: errorMessage });
      return true;
    }
  }

  if (url === '/api/battlefields/analyze-agility' && req.method === 'POST') {
    try {
      const config = await parseJsonBody(req);
      if (!config.battlefieldId || !config.path) {
        sendJson(res, 400, { error: 'Missing required fields: battlefieldId, path' });
        return true;
      }

      const record = resolveBattlefieldRecord(config.battlefieldId);
      if (!record) {
        sendJson(res, 404, { error: 'Battlefield not found' });
        return true;
      }

      const battlefield = loadBattlefieldFromFile(record.jsonPath);
      const agilityAnalysis = analyzePathForAgility(battlefield, config.path, config.character);
      sendJson(res, 200, agilityAnalysis);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sendJson(res, 500, { error: errorMessage });
      return true;
    }
  }

  if (url === '/api/battlefields/los-check' && req.method === 'POST') {
    try {
      const config = await parseJsonBody(req);
      if (!config.battlefieldId || !config.activeModel || !config.target) {
        sendJson(res, 400, { error: 'Missing required fields: battlefieldId, activeModel, target' });
        return true;
      }

      const record = resolveBattlefieldRecord(config.battlefieldId);
      if (!record) {
        sendJson(res, 404, { error: 'Battlefield not found' });
        return true;
      }

      const battlefield = loadBattlefieldFromFile(record.jsonPath);
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

      const hasLOS = SpatialRules.hasLineOfSight(battlefield, activeModel, targetModel);
      const coverResult = SpatialRules.getCoverResult(battlefield, activeModel, targetModel);
      const lofResult = config.showLofArc
        ? { hasLOF: hasLOS, arcDegrees: 60, targetsInArc: [] }
        : undefined;

      sendJson(res, 200, {
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
          lofArc: config.showLofArc
            ? {
                center: config.activeModel.position,
                direction: 0,
                arcDegrees: 60,
                radius: 16,
              }
            : undefined,
        },
      });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sendJson(res, 500, { error: errorMessage });
      return true;
    }
  }

  if (url === '/api/battlefields') {
    try {
      const battlefields = listBattlefieldFiles().map(entry => ({
        name: entry.id,
        relativePath: entry.relativePath,
        source: entry.source,
        gameSize: entry.gameSize,
        jsonPath: `/api/battlefields/${entry.id}.json`,
        svgPath: `/api/battlefields/${entry.id}.svg`,
      }));
      sendJson(res, 200, battlefields);
      return true;
    } catch {
      sendJson(res, 500, { error: 'Failed to list battlefield files' });
      return true;
    }
  }

  const jsonMatch = url.match(/^\/api\/battlefields\/([^/]+)\.json$/);
  if (jsonMatch) {
    const record = getBattlefieldFileById(jsonMatch[1]);
    if (!record) {
      sendText(res, 404, 'Battlefield not found');
      return true;
    }
    try {
      const content = fs.readFileSync(record.jsonPath, 'utf8');
      sendText(res, 200, content, 'application/json');
    } catch {
      sendText(res, 404, 'Battlefield not found');
    }
    return true;
  }

  const svgMatch = url.match(/^\/api\/battlefields\/([^/]+)\.svg$/);
  if (svgMatch) {
    const record = getBattlefieldFileById(svgMatch[1]);
    if (!record || !record.svgPath) {
      sendText(res, 404, 'Battlefield SVG not found');
      return true;
    }
    try {
      const content = fs.readFileSync(record.svgPath);
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(content);
    } catch {
      sendText(res, 404, 'Battlefield SVG not found');
    }
    return true;
  }

  return false;
}
