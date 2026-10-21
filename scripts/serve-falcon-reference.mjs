import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const downloads = 'C:/Users/UNAS/Downloads';
const assets = resolve(downloads, 'Falcon _ Dashboard & Web App Template_files');
const local = resolve(downloads, 'Tutoria/tutoria-unas/frontend/src');
const types = { '.css': 'text/css', '.js': 'application/javascript', '.descargar': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (path === '/' || path === '/reference') {
      let html = await readFile(resolve(downloads, 'Falcon _ Dashboard & Web App Template.html'), 'utf8');
      html = html.replaceAll('./Falcon _ Dashboard &amp; Web App Template_files/', '/assets/');
      html = html.replaceAll('./Falcon _ Dashboard & Web App Template_files/', '/assets/');
      html = html.replace(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/g, '');
      html = html.replace('</head>', '<link rel="stylesheet" href="/fonts.css"></head>');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return;
    }
    const file = path === '/fonts.css' ? resolve(local, 'styles/fonts.css') : path.startsWith('/assets/fonts/') ? resolve(local, path.slice(1)) : resolve(assets, path.replace(/^\/assets\//, ''));
    if (![assets, local].some(root => file.startsWith(root))) { res.writeHead(403); res.end(); return; }
    let body = await readFile(file);
    if (path === '/fonts.css') body = Buffer.from(body.toString().replaceAll('../assets/fonts/', '/assets/fonts/'));
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'text/css' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(8766, '127.0.0.1', () => console.log('Falcon reference: http://127.0.0.1:8766/reference'));
