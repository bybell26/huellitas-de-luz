const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

function createServer(fetchPey = fetch, getToken = async () => process.env.PEY_API_KEY || JSON.parse(await fs.readFile(path.join(__dirname, 'config.local.json'), 'utf8')).apiKey, staticRoot = null) {
  return http.createServer(async (req, res) => {
    const reply = (status, value, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'});
      res.end(typeof value === 'string' ? value : JSON.stringify(value));
    };
    try {
      const allowedHost = `127.0.0.1:${req.socket.localPort}`;
      if (req.headers.host !== allowedHost) return reply(403, {error: 'Usa la URL local indicada al iniciar.'});
      const url = new URL(req.url, `http://${allowedHost}`);
      if (url.pathname === '/api/pey' && req.method === 'POST') {
        if (req.headers.origin !== `http://${allowedHost}` || req.headers['content-type'] !== 'application/json') return reply(403, {error: 'Origen o contenido no permitido.'});
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 65536) return reply(413, {error: 'Solicitud demasiado grande.'});
        }
        let input;
        try { input = JSON.parse(raw); } catch { return reply(400, {error: 'JSON inválido.'}); }
        const token = await getToken();
        let method, endpoint, body;
        if (input.action === 'create') {
          method = 'POST'; endpoint = '/codi/qr';
          body = {amount: 0.01, concept: 'Prueba Orbita Pets', expiration: 600, numRef: '1', generateImage: true};
        } else if (input.action === 'status' && typeof input.id === 'string' && /^[A-Za-z0-9_-]+$/.test(input.id)) {
          method = 'GET'; endpoint = '/transaction/codi/qr/' + input.id;
          if (typeof input.nextToken === 'string' && input.nextToken) endpoint += '?nextToken=' + encodeURIComponent(input.nextToken);
        } else return reply(400, {error: 'Accion no permitida.'});
        const upstream = await fetchPey(`https://api.pey.mx${endpoint}`, {
          method, headers: {Accept: 'application/json', Authorization: `Bearer ${token.trim()}`, ...(method === 'POST' ? {'Content-Type': 'application/json'} : {})},
          ...(method === 'POST' ? {body: JSON.stringify(body)} : {}),
          redirect: 'error', signal: AbortSignal.timeout(30000)
        });
        const text = await upstream.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }
        return reply(200, {ok: upstream.ok, status: upstream.status, data});
      }
      if (req.method === 'GET' && url.pathname === '/payment-flow.js') return reply(200, await fs.readFile(path.join(__dirname, '../js/payment-flow.js'), 'utf8'), 'text/javascript; charset=utf-8');
      if (staticRoot) {
        const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const allowed = /^(?:index\.html|display\.html|login\.html|hogar\.html|actividad\.html|manifest\.json|sw\.js|(?:js|css)\/[A-Za-z0-9_-]+\.(?:js|css)|assets\/[A-Za-z0-9_/-]+\.(?:png|svg))$/.test(file);
        if (req.method !== 'GET' || !allowed) return reply(404, {error: 'No encontrado.'});
        const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.png') ? 'image/png' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/javascript; charset=utf-8';
        const content = await fs.readFile(path.join(staticRoot, file));
        res.writeHead(200, {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}); return res.end(content);
      }
      const files = {'/payment.js': ['payment.js', 'text/javascript; charset=utf-8'], '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8']};
      if (req.method !== 'GET' || !files[url.pathname]) return reply(404, {error: 'No encontrado.'});
      const [file, type] = files[url.pathname];
      reply(200, await fs.readFile(path.join(__dirname, file), 'utf8'), type);
    } catch (error) {
      reply(502, {error: error.name === 'TimeoutError' ? 'Pey no respondió en 30 segundos. Antes de generar otro QR, verifica si el anterior fue creado.' : 'No fue posible conectar con Pey. Revisa la conexión; una solicitud de QR podría haberse procesado.'});
    }
  });
}

if (require.main === module) {
  const server = createServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'El puerto 8010 está ocupado.' : 'No se pudo iniciar el servidor.'); process.exitCode = 1; });
  server.listen(8010, '127.0.0.1', () => console.log('Pruebas Pey: http://127.0.0.1:8010\nDeja esta ventana abierta. Ctrl+C para cerrar.'));
}
module.exports = {createServer};
