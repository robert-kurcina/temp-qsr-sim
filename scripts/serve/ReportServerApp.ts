import http, { type Server } from 'node:http';
import {
  dispatchReportServerRequest,
  defaultReportServerHandlers,
  type ReportServerDispatchContext,
  type ReportServerHandlers,
} from './ReportServerDispatcher';

export interface ReportServerAppOptions extends ReportServerDispatchContext {
  handlers?: ReportServerHandlers;
}

export function createReportServer(options: ReportServerAppOptions): Server {
  const handlers = options.handlers ?? defaultReportServerHandlers;
  return http.createServer(async (req, res) => {
    await dispatchReportServerRequest(
      req,
      res,
      { dashboardPath: options.dashboardPath, mimeTypes: options.mimeTypes },
      handlers
    );
  });
}
