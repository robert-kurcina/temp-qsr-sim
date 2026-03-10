import type { IncomingMessage, ServerResponse } from 'node:http';
import { applyCorsHeaders, handleCorsPreflight, sendNotFound, sendServerError } from './HttpUtils';
import { handleBattleRoutes } from './routes/BattleRoutes';
import { handleBattlefieldRoutes } from './routes/BattlefieldRoutes';
import { handleStaticRoutes } from './routes/StaticRoutes';

export interface ReportServerDispatchContext {
  dashboardPath: string;
  mimeTypes: Record<string, string>;
}

export interface ReportServerHandlers {
  handleBattleRoutes: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
  handleBattlefieldRoutes: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
  handleStaticRoutes: (
    req: IncomingMessage,
    res: ServerResponse,
    context: ReportServerDispatchContext
  ) => Promise<boolean>;
}

export const defaultReportServerHandlers: ReportServerHandlers = {
  handleBattleRoutes,
  handleBattlefieldRoutes,
  handleStaticRoutes,
};

export async function dispatchReportServerRequest(
  req: IncomingMessage,
  res: ServerResponse,
  context: ReportServerDispatchContext,
  handlers: ReportServerHandlers = defaultReportServerHandlers
): Promise<void> {
  applyCorsHeaders(res);

  if (handleCorsPreflight(req, res)) {
    return;
  }

  try {
    if (await handlers.handleBattleRoutes(req, res)) {
      return;
    }
    if (await handlers.handleBattlefieldRoutes(req, res)) {
      return;
    }
    if (await handlers.handleStaticRoutes(req, res, context)) {
      return;
    }
    sendNotFound(res);
  } catch (error) {
    sendServerError(res, error);
  }
}
