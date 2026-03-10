import type { IncomingMessage, ServerResponse } from 'node:http';

export async function parseJsonBody(req: IncomingMessage): Promise<any> {
  return await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

export function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

export function sendText(
  res: ServerResponse,
  statusCode: number,
  text: string,
  contentType: string = 'text/plain'
): void {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(text);
}

export function applyCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function handleCorsPreflight(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== 'OPTIONS') {
    return false;
  }
  res.writeHead(200);
  res.end();
  return true;
}

export function sendNotFound(res: ServerResponse, message: string = 'Not found. Try /dashboard or /api/battles'): void {
  res.writeHead(404);
  res.end(message);
}

export function sendServerError(res: ServerResponse, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unknown server error';
  sendJson(res, 500, { error: message });
}
