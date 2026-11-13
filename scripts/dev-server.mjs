import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import worker, { passwordHash } from '../server/worker.mjs';
import { openLocalDatabase } from '../server/local-db.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localDirectory = path.resolve(process.env.LOCAL_DATA_DIR || path.join(root, '.local'));
mkdirSync(localDirectory, { recursive: true });
const secretFile = path.join(localDirectory, 'admin.json');
let initialHash = process.env.ADMIN_BOOTSTRAP_HASH;
if (!initialHash) {
  if (existsSync(secretFile)) initialHash = JSON.parse(readFileSync(secretFile, 'utf8')).hash;
  else {
    const password = Array.from({ length: 12 }, () => randomInt(0, 10)).join('');
    initialHash = await passwordHash(password);
    writeFileSync(secretFile, JSON.stringify({ hash: initialHash }), { mode: 0o600 });
    console.log('Senha inicial da administração local: ' + password);
    console.log('Guarde a senha e troque-a no painel. Ela não será mostrada novamente.');
  }
}
const DB = openLocalDatabase(path.join(localDirectory, 'agendamentos.sqlite'), root);
const env = { DB, ADMIN_BOOTSTRAP_HASH: initialHash };
const routes = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/admin', ['admin.html', 'text/html; charset=utf-8']],
  ['/admin/', ['admin.html', 'text/html; charset=utf-8']],
  ['/admin.html', ['admin.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/script.js', ['script.js', 'text/javascript; charset=utf-8']],
  ['/admin.js', ['admin.js', 'text/javascript; charset=utf-8']]
]);
const localCookie = 'jaiane_admin_local';
const productionCookie = '__Host-jaiane_admin';
const server = http.createServer(async (incoming, outgoing) => {
  try {
    const host = incoming.headers.host || '';
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host)) {
      outgoing.writeHead(403); outgoing.end('Host não permitido.'); return;
    }
    const url = new URL(incoming.url, 'http://' + host);
    if (url.pathname === '/favicon.ico') { outgoing.writeHead(204); outgoing.end(); return; }
    // Accept links opened from either source folder as well as the project root.
    if (/^\/(public|dist)\//.test(url.pathname)) {
      outgoing.writeHead(302, { Location: url.pathname.replace(/^\/(public|dist)/, '') + url.search }); outgoing.end(); return;
    }
    const asset = routes.get(url.pathname);
    if (asset && ['GET', 'HEAD'].includes(incoming.method)) {
      outgoing.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      outgoing.end(incoming.method === 'HEAD' ? undefined : readFileSync(path.join(root, 'public', asset[0]))); return;
    }
    if (url.pathname === '/api/health' && incoming.method === 'GET') {
      outgoing.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      outgoing.end(JSON.stringify({ ok: true, mode: 'local' })); return;
    }
    if (!url.pathname.startsWith('/api/')) { outgoing.writeHead(404); outgoing.end('Página não encontrada.'); return; }
    const chunks = []; let size = 0;
    for await (const chunk of incoming) {
      size += chunk.length;
      if (size > 4096) { outgoing.writeHead(413); outgoing.end('Requisição muito grande.'); return; }
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) if (value != null) headers.set(key, Array.isArray(value) ? value.join(',') : value);
    headers.set('cf-connecting-ip', incoming.socket.remoteAddress || '127.0.0.1');
    if (headers.has('cookie')) {
      headers.set('cookie', headers.get('cookie').replace(new RegExp('(^|;\\s*)' + localCookie + '='), '$1' + productionCookie + '='));
    }
    const request = new Request(url, { method: incoming.method, headers, ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Buffer.concat(chunks) } : {}) });
    const response = await worker.fetch(request, env, { waitUntil(promise) { promise.catch(error => console.error(error.message)); } });
    const responseHeaders = Object.fromEntries(response.headers);
    // HTTP cookies are adapted only in this loopback-only development server.
    if (responseHeaders['set-cookie']) responseHeaders['set-cookie'] = responseHeaders['set-cookie'].replace(productionCookie + '=', localCookie + '=').replace('; Secure', '');
    outgoing.writeHead(response.status, responseHeaders);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error.message);
    if (!outgoing.headersSent) outgoing.writeHead(500, { 'Content-Type': 'application/json' });
    outgoing.end(JSON.stringify({ error: 'Não foi possível concluir a requisição local.' }));
  }
});
const port = Number(process.env.PORT || 5500);
server.on('error', error => {
  if (error.code === 'EADDRINUSE') console.error(`A porta ${port} já está em uso. Pare o Live Server (Go Live) e execute npm start novamente.`);
  else console.error(error.message);
  DB.close(); process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  const actualPort = server.address().port;
  console.log(`Agendamento: http://localhost:${actualPort}`);
  console.log(`Administração: http://localhost:${actualPort}/admin`);
  console.log(`Banco local persistente: ${path.join(localDirectory, 'agendamentos.sqlite')}`);
});
function shutdown() { server.close(() => { DB.close(); process.exit(0); }); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
