import type { IncomingMessage, ServerResponse } from 'node:http';
import { getBattleAudit, getBattleIndex, getBattleSummary, getBattleSvg } from '../BattleReportData';
import { sendJson, sendText } from '../HttpUtils';

export async function handleBattleRoutes(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '/';

  if (url === '/api/battles' || url.startsWith('/api/battles?')) {
    const parsedUrl = new URL(url, 'http://localhost');
    const filters = {
      mission: parsedUrl.searchParams.get('mission') || undefined,
      gameSize: parsedUrl.searchParams.get('gameSize') || undefined,
      date: parsedUrl.searchParams.get('date') || undefined,
      winner: parsedUrl.searchParams.get('winner') || undefined,
      audit: ((): 'with' | 'without' | undefined => {
        const raw = (parsedUrl.searchParams.get('audit') || '').toLowerCase();
        if (raw === 'with') return 'with';
        if (raw === 'without') return 'without';
        return undefined;
      })(),
    };

    sendJson(res, 200, getBattleIndex(filters));
    return true;
  }

  const auditMatch = url.match(/^\/api\/battles\/([^/]+)\/audit$/);
  if (auditMatch) {
    const audit = getBattleAudit(auditMatch[1]);
    if (!audit) {
      sendJson(res, 404, { error: 'Battle not found' });
      return true;
    }
    sendJson(res, 200, audit);
    return true;
  }

  const svgMatch = url.match(/^\/api\/battles\/([^/]+)\/svg$/);
  if (svgMatch) {
    const svg = getBattleSvg(svgMatch[1]);
    if (!svg) {
      sendText(res, 404, 'SVG not found');
      return true;
    }
    sendText(res, 200, svg, 'image/svg+xml');
    return true;
  }

  const summaryMatch = url.match(/^\/api\/battles\/([^/]+)\/summary$/);
  if (summaryMatch) {
    const summary = getBattleSummary(summaryMatch[1]);
    if (!summary) {
      sendJson(res, 404, { error: 'Battle not found' });
      return true;
    }
    sendJson(res, 200, summary);
    return true;
  }

  return false;
}
