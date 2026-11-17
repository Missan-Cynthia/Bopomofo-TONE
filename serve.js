import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('public');
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.txt':'text/plain','.webmanifest':'application/manifest+json'};
const port = Number(process.env.PORT || 4173);
http.createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + sep)) throw Error('Not found');
    const data = await readFile(file);
    response.writeHead(200, {'Content-Type': (types[extname(file)] || 'application/octet-stream') + (extname(file) === '.png' ? '' : '; charset=utf-8'), 'Cache-Control':'no-cache'});
    response.end(data);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, 'localhost', () => console.log('http://localhost:' + port));
