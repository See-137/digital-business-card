// Static server for the tests: serves the repo root and gzips text, like GitHub Pages.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.vcf': 'text/vcard', '.txt': 'text/plain',
};

/** fontDelayMs: hold web fonts back, like a real network (layout-shift checks). */
export function serve(rootDir, port = 0, { fontDelayMs = 0 } = {}) {
  const root = path.resolve(rootDir);
  const server = http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.resolve(root, '.' + p);
      if (!f.startsWith(root)) {
        res.writeHead(403).end();
        return;
      }
      if (fontDelayMs && f.endsWith('.woff2')) await new Promise((r) => setTimeout(r, fontDelayMs));
      let body = await readFile(f);
      const type = TYPES[path.extname(f)] || 'application/octet-stream';
      const headers = { 'content-type': type, 'cache-control': 'no-store' };
      if (/text|javascript|json|svg|manifest/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {
        body = gzipSync(body);
        headers['content-encoding'] = 'gzip';
      }
      res.writeHead(200, headers).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}
