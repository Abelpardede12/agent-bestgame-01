// Tiny static file server for the game (Node 22+, stdlib only).
// Serves game/ at http://localhost:8080 — run with `node serve.ts`.

import { createReadStream, existsSync, lstatSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';

const gameDir = resolve(import.meta.dirname, 'game');
const port = 8080;

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  wasm: 'application/wasm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  ico: 'image/x-icon',
};

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/' || path === '') path = '/index.html';
    const file = join(gameDir, path);
    if (!file.startsWith(gameDir) || !existsSync(file) || !lstatSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found\n');
      return;
    }
    const ext = file.split('.').pop()?.toLowerCase() ?? '';
    res.writeHead(200, { 'content-type': TYPES[ext] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('server error\n');
  }
});

server.listen(port, () => {
  console.log(`serving ${gameDir} at http://localhost:${port}`);
});
